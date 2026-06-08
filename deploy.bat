@echo off
setlocal enableextensions
cd /d "%~dp0"

echo.
echo  ========================================
echo    DEPLOY - Uploading Beyahad to GitHub
echo  ========================================
echo.

REM --- הגדרות git שמונעות את שגיאת הנעילה ב-Windows ---
REM gc.auto=0 מונע מ-git לארוז מחדש (repack) באמצע ה-commit -
REM זו הסיבה ל-"Unlink of file .git/objects/pack/...idx failed".
git config gc.auto 0 >nul 2>&1
git config core.fscache true >nul 2>&1
git config core.longpaths true >nul 2>&1

set /p msg="Commit message (or Enter for default): "
if "%msg%"=="" set msg=update

echo.
echo  [1/3] Adding files...
git add .

echo  [2/3] Creating commit...
git commit -m "%msg%"
if errorlevel 1 (
  echo     ^(Nothing new to commit - continuing to push^)
)

echo  [3/3] Pushing to GitHub...
call :push_with_retry

echo.
echo  ========================================
echo    DONE! Vercel will update in 2-3 min.
echo  ========================================
echo.
pause
exit /b 0

REM ===== ניסיון push עם חזרה אוטומטית (עד 3 פעמים) =====
:push_with_retry
set /a tries=0
:retry
git push
if not errorlevel 1 goto :eof
set /a tries+=1
if %tries% GEQ 3 (
  echo.
  echo  !! Push failed after 3 attempts.
  echo     Close any program using the folder ^(antivirus / VS Code / GitHub Desktop^) and run again.
  goto :eof
)
echo.
echo  Push attempt %tries% failed ^(temporary file lock^). Retrying in 3 seconds...
timeout /t 3 /nobreak >nul
goto retry
