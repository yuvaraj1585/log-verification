/**
 * open-dashboard.js
 * Run with: npm run admin
 *
 * Opens the admin dashboard in the default browser.
 * Requires the main server (npm start) to already be running.
 * Does NOT start a second server or create a second database connection.
 */
require('dotenv').config();
const { exec } = require('child_process');

const port = process.env.PORT || 3000;
const url = `http://localhost:${port}/dashboard.html`;

console.log('');
console.log('==============================================');
console.log('  Admin Dashboard');
console.log(`  URL: ${url}`);
console.log('  (Make sure the server is running: npm start)');
console.log('==============================================');
console.log('');

// Open browser cross-platform
const platform = process.platform;
let cmd;
if (platform === 'win32') {
    cmd = `start "" "${url}"`;
} else if (platform === 'darwin') {
    cmd = `open "${url}"`;
} else {
    cmd = `xdg-open "${url}"`;
}

exec(cmd, (err) => {
    if (err) {
        console.error('Could not open browser automatically.');
        console.log(`Please open manually: ${url}`);
    }
});
