require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

// Ensure data directory exists for SQLite
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Connect to SQLite database
const dbPath = path.join(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database at:', dbPath);

    // New legitimate users table with password hashing
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT
    )`, (err) => {
      if (err) {
        console.error('Error creating users table:', err.message);
      } else {
        // Create a default admin account if table is empty
        db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
          if (!err && row.count === 0) {
            const adminUser = process.env.ADMIN_USER || 'admin';
            const adminPass = process.env.ADMIN_PASS || 'admin123';
            bcrypt.hash(adminPass, 10, (err, hash) => {
              if (!err) {
                db.run('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
                  [adminUser, hash, new Date().toISOString()]);
                console.log(`Default admin user '${adminUser}' created.`);
              }
            });
          }
        });
      }
    });

    // New table: forgot-password audit logs
    db.run(`CREATE TABLE IF NOT EXISTS forgot_password_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT,
      device_name TEXT,
      user_agent TEXT,
      log_time TEXT
    )`, (err) => {
      if (err) {
        console.error('Error creating forgot_password_logs table:', err.message);
      }
    });
  }
});

module.exports = db;
