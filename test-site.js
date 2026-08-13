const http = require('http');

const runTest = async () => {
    const TARGET_HOST = 'localhost';
    const TARGET_PORT = 3000;

    // Safety Check: Prevent running against production
    if (TARGET_HOST !== 'localhost' && TARGET_HOST !== '127.0.0.1') {
        console.error("SAFETY ABORT: test-site.js is only allowed to run against localhost!");
        process.exit(1);
    }

    console.log(`Starting tests against ${TARGET_HOST}:${TARGET_PORT}...`);
    
    // Helper for requests
    const makeRequest = (method, path, body = null, token = null) => {
        return new Promise((resolve, reject) => {
            const headers = {};
            if (body) headers['Content-Type'] = 'application/json';
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const req = http.request({
                hostname: TARGET_HOST,
                port: TARGET_PORT,
                path: path,
                method: method,
                headers: headers
            }, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({ status: res.statusCode, body: data });
                });
            });
            
            req.on('error', reject);
            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    };

    try {
        console.log("1. Testing login endpoint (public)...");
        const loginRes = await makeRequest('POST', '/api/login', { username: 'testuser', password: 'testpassword123' });
        console.log(`Login Status: ${loginRes.status}, Body: ${loginRes.body}`);

        console.log("2. Verifying unauthorized access to users is blocked...");
        const usersBlockedRes = await makeRequest('GET', '/api/users');
        console.log(`Users Blocked Status: ${usersBlockedRes.status}`);

        console.log("3. Verifying authorized user fetch...");
        const usersRes = await makeRequest('GET', '/api/users', null, '1585');
        console.log(`Users Authorized Status: ${usersRes.status}`);
        if (usersRes.status === 200) {
            const users = JSON.parse(usersRes.body).data;
            console.log(`Users Count: ${users.length}`);
        }

        console.log("4. Testing reset with WRONG token...");
        const resetWrongRes = await makeRequest('POST', '/api/reset', { password: 'wrong' }, 'wrongtoken');
        console.log(`Reset Wrong Status: ${resetWrongRes.status}`);
        
        console.log("5. Testing reset with CORRECT password (1585) but valid token...");
        const resetCorrectRes = await makeRequest('POST', '/api/reset', { password: '1585' }, '1585');
        console.log(`Reset Correct Status: ${resetCorrectRes.status}`);

        console.log("6. Verifying database is empty...");
        const usersAfterRes = await makeRequest('GET', '/api/users', null, '1585');
        if (usersAfterRes.status === 200) {
            const usersAfter = JSON.parse(usersAfterRes.body).data;
            console.log(`Users Count After Reset: ${usersAfter.length}`);
        }
        
        console.log("ALL TESTS FINISHED.");
    } catch (err) {
        console.error("Test failed:", err.message);
    }
};

runTest();
