@echo off
echo ========================================
echo Deploying AHM GRN UI to GitHub
echo ========================================
echo.

cd /d "%~dp0"

echo Checking git status...
git status

echo.
echo Adding all files...
git add .

echo.
set /p commit_msg="Enter commit message (or press Enter for default): "
if "%commit_msg%"=="" set commit_msg=Update AHM GRN UI

echo.
echo Committing with message: %commit_msg%
git commit -m "%commit_msg%"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo ========================================
echo Deployment complete!
echo GitHub will trigger Render auto-deploy
echo Check: https://github.com/eacdc/grn-ui-ahm
echo ========================================
echo.

pause

