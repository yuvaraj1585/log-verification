@echo off
setlocal
cd /d "%~dp0"

echo Checking for Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo =======================================================
    echo [ERROR] Node.js is not installed or not in your PATH. 
    echo Please install Node.js from https://nodejs.org/
    echo =======================================================
    pause
    exit /b
)

echo Checking for node_modules...
if not exist "node_modules\" (
    echo 'node_modules' folder not found. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo =======================================================
        echo [ERROR] Failed to install dependencies.
        echo =======================================================
        pause
        exit /b
    )
)

echo Checking if server is already running...
netstat -ano | findstr /C:":3000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo Server appears to be already running on port 3000.
    echo Opening your browser...
) else (
    echo Starting the Node.js server...
    start "Node Server" cmd /k "node server.js"
    
    echo Waiting for the server to initialize...
    timeout /t 3 /nobreak >nul
    echo Opening your browser...
)

start http://localhost:3000/

echo Done! You can close this window now.
