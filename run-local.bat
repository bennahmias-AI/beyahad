@echo off
cd /d "%~dp0"

echo.
echo  ========================================
echo    BEYAHAD - Running locally
echo  ========================================
echo.
echo  Starting the dev server...
echo  The browser will open automatically in a few seconds.
echo.
echo  To STOP the server: press Ctrl+C in this window,
echo  or just close this window.
echo.
echo  ========================================
echo.

REM Open the browser after a short delay (gives Vite time to start)
start "" cmd /c "timeout /t 4 >nul && start http://localhost:5174"

REM Start the Vite dev server
npm run dev

pause
