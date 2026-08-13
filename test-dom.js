const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('public/index.html', 'utf-8');
const dom = new JSDOM(html, { runScripts: 'dangerously' });
const document = dom.window.document;

const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const toggleBtn = document.getElementById('toggle-password');

console.log("Initial password type:", passwordInput.type);
console.log("Initial login button disabled:", loginBtn.disabled);
console.log("Initial toggle button text:", toggleBtn.textContent);

// Test toggle button
toggleBtn.click();
console.log("After 1st click - password type:", passwordInput.type);
console.log("After 1st click - toggle text:", toggleBtn.textContent);

toggleBtn.click();
console.log("After 2nd click - password type:", passwordInput.type);
console.log("After 2nd click - toggle text:", toggleBtn.textContent);

// Test input
passwordInput.value = '123456';
passwordInput.dispatchEvent(new dom.window.Event('input'));
console.log("After input (6 chars) - login disabled:", loginBtn.disabled);

passwordInput.value = '1234567';
passwordInput.dispatchEvent(new dom.window.Event('input'));
console.log("After input (7 chars) - login disabled:", loginBtn.disabled);
