@echo off
cd /d "%~dp0"

echo.
echo  ========================================
echo    BEYAHAD - Running locally
echo  ========================================
echo.
echo  Starting BOTH servers:
echo    1. LiveKit token server (port 8080) - needed for video/cafe
echo    2. Vite dev server (the app)
echo.
echo  The browser will open automatically in a few seconds.
echo.
echo  To STOP: close this window (both servers will stop).
echo.
echo  ========================================
echo.

REM Start the LiveKit token server in its own window (needed for cafe + in-game video)
start "BEYAHAD token-server" cmd /k "cd /d "%~dp0" && node token-server.js"

REM Open the browser after a short delay (gives Vite time to start)
start "" cmd /c "timeout /t 4 >nul && start http://localhost:5174"

REM Start the Vite dev server in this window
npm run dev

pause
