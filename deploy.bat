@echo off
cd /d "%~dp0"

echo.
echo  ========================================
echo    DEPLOY - Uploading Beyahad to GitHub
echo  ========================================
echo.

set /p msg="Commit message (or Enter for default): "
if "%msg%"=="" set msg=update

echo.
echo  [1/3] Adding files...
git add .

echo  [2/3] Creating commit...
git commit -m "%msg%"

echo  [3/3] Pushing to GitHub...
git push

echo.
echo  ========================================
echo    DONE! Vercel will update in 2-3 min.
echo  ========================================
echo.
pause
