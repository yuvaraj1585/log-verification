require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin token must be set in .env as ADMIN_TOKEN
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
    console.warn('⚠️  WARNING: ADMIN_TOKEN is not set in .env — admin routes will be inaccessible.');
}

// Store connected clients for real-time updates
let dashboardClients = [];
const MAX_SSE_CLIENTS = 100;

// Trust first proxy hop (e.g. nginx, Render, Railway, Heroku)
// Only set trust proxy if running behind a known reverse proxy in production.
// Hard-coding trust proxy = 1 is safe for single-proxy deployments.
app.set('trust proxy', 1);

app.use(helmet());

// Security: Block access to sensitive files before static middleware
app.use((req, res, next) => {
    const blocked = [
        /^\/\.env/i,
        /^\/server\.js$/i,
        /^\/db\.js$/i,
        /^\/package\.json$/i,
        /^\/package-lock\.json$/i,
        /^\/\.gitignore$/i,
        /^\/node_modules\//i,
        /^\/data\//i,
        /\.sqlite$/i,
        /\.db$/i,
        /\.bat$/i,
        /^\/open-dashboard\.js$/i,
        /^\/test-/i,
    ];
    if (blocked.some(pattern => pattern.test(req.path))) {
        return res.status(404).send('Not Found');
    }
    next();
});

// Serve static files from project root
app.use(express.static(__dirname, {
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
    }
}));

// Explicit GET / route for Render
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.json({ limit: '10kb' }));

// Rate limiting — applies to all /api/ routes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the real client IP, honouring the trust proxy setting.
 * Falls back to req.socket.remoteAddress if req.ip is unavailable.
 */
function getClientIP(req) {
    let ip = req.ip || req.socket?.remoteAddress || 'Unknown';
    // Normalise IPv4-mapped IPv6 addresses
    if (ip === '::1') ip = '127.0.0.1';
    if (ip.startsWith('::ffff:')) ip = ip.substring(7);
    return ip;
}

/** Broadcast a plain-text event to all connected SSE clients. */
function broadcastUpdate(eventData = 'update') {
    dashboardClients.forEach(client => {
        try { client.write(`data: ${eventData}\n\n`); } catch (_) { /* ignore dead connections */ }
    });
}

// ─── Admin Auth Middleware ─────────────────────────────────────────────────────

const adminAuth = (req, res, next) => {
    if (!ADMIN_TOKEN) {
        return res.status(503).json({ error: 'Admin access not configured on this server.' });
    }

    let providedToken = '';
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        providedToken = authHeader.substring(7);
    } else if (req.query.token) {
        providedToken = req.query.token;
    }

    if (providedToken === ADMIN_TOKEN) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// ─── SSE Heartbeat ────────────────────────────────────────────────────────────

setInterval(() => {
    dashboardClients.forEach(client => {
        try { client.write(': heartbeat\n\n'); } catch (_) { /* ignore */ }
    });
}, 30000);

// ─── Public Routes ─────────────────────────────────────────────────────────────

/**
 * GET /api/config
 * Returns non-secret public configuration for the frontend.
 * App Store / Play Store URLs come from environment variables — never hard-coded.
 */
app.get('/api/config', (req, res) => {
    res.json({
        appStoreUrl: process.env.APP_STORE_URL || null,
        playStoreUrl: process.env.PLAY_STORE_URL || null
    });
});

/**
 * POST /api/login
 * Standard authentication endpoint. No credentials are logged.
 */
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || typeof password !== 'string' || password.length === 0) {
        return res.status(400).json({ error: 'Invalid username or password' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        bcrypt.compare(password, user.password_hash, (err, isMatch) => {
            if (err) return res.status(500).json({ error: 'Server error' });
            if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

            // Generate a token or start a session in a real app
            res.json({ success: true, message: 'Logged in successfully', username: user.username });
        });
    });
});

/**
 * POST /api/forgot-password
 * Logs an audit record when a visitor clicks "Forgot password?".
 * Does NOT store passwords or reset tokens.
 */
app.post('/api/forgot-password', (req, res) => {
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const deviceName = userAgent;
    const logTime = new Date().toLocaleString();

    db.run(
        'INSERT INTO forgot_password_logs (ip_address, device_name, user_agent, log_time) VALUES (?, ?, ?, ?)',
        [ipAddress, deviceName, userAgent, logTime],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
            broadcastUpdate('fp-update');
        }
    );
});

// ─── Admin Routes (protected by adminAuth) ────────────────────────────────────

/** GET /api/updates — SSE stream for real-time dashboard updates */
app.get('/api/updates', adminAuth, (req, res) => {
    if (dashboardClients.length >= MAX_SSE_CLIENTS) {
        return res.status(503).json({ error: 'Too many concurrent connections' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    dashboardClients.push(res);

    req.on('close', () => {
        dashboardClients = dashboardClients.filter(c => c !== res);
    });
});

/** GET /api/users — fetch legitimate user accounts (admin only) */
app.get('/api/users', adminAuth, (req, res) => {
    // NEVER select or return password_hash
    db.all('SELECT id, username, created_at FROM users ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

/** GET /api/forgot-password-logs — fetch all forgot-password audit records (admin only) */
app.get('/api/forgot-password-logs', adminAuth, (req, res) => {
    db.all('SELECT * FROM forgot_password_logs ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

/** POST /api/reset — delete all users except admin (admin only) */
app.post('/api/reset', adminAuth, (req, res) => {
    db.run('DELETE FROM users WHERE username != ?', [process.env.ADMIN_USER || 'admin'], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
        broadcastUpdate('update');
    });
});

/** POST /api/reset-forgot-password-logs — delete all forgot-password audit records (admin only) */
app.post('/api/reset-forgot-password-logs', adminAuth, (req, res) => {
    db.run('DELETE FROM forgot_password_logs', [], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
        broadcastUpdate('fp-update');
    });
});

// ─── Start Server ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log('');
    console.log('==============================================');
    console.log(`  Server running on port ${PORT}`);
    console.log(`  Public site:  http://localhost:${PORT}/`);
    console.log(`  Dashboard:    http://localhost:${PORT}/dashboard.html`);
    console.log('  (Run "npm run admin" to open the dashboard)');
    console.log('==============================================');
    console.log('');
});
