@echo off
cd /d "C:\Users\User\Desktop\beyahad"
echo.
echo ==========================================
echo    Beyahad - build + cap sync (Android)
echo ==========================================
echo.
call npm run build
if errorlevel 1 goto err
echo.
call npx cap sync android
if errorlevel 1 goto err
echo.
echo ==========================================
echo    DONE!  Open Android Studio and Run.
echo ==========================================
echo.
pause
exit /b

:err
echo.
echo ******************************************
echo    ERROR - see the messages above.
echo ******************************************
echo.
pause
exit /b
