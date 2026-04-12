@echo off
echo Building app for production...
cd /d "C:\Users\jesse\OneDrive\Desktop\productivity-tracker"
set DATABASE_URL=file:C:\Users\jesse\OneDrive\Desktop\productivity-tracker\prisma\dev.db
call npm run build
if %errorlevel% neq 0 (
  echo Build failed. Check for errors above.
  pause
  exit /b 1
)

echo.
echo Copying startup script to Windows startup folder...
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
copy /y "start-silent.vbs" "%STARTUP%\productivity-tracker.vbs"

echo.
echo Done! The app will now start automatically when you log in.
echo.
echo To use it now:
echo   1. Double-click start-silent.vbs  (starts the server in the background)
echo   2. Find your desktop IP: open Command Prompt and type "ipconfig"
echo      Look for IPv4 Address under your WiFi adapter (e.g. 192.168.1.50)
echo   3. On desktop: open http://localhost:3000
echo   4. On mobile: open http://YOUR-IP:3000 (e.g. http://192.168.1.50:3000)
echo   5. On mobile Chrome, tap the share/menu icon and "Add to Home Screen"
echo.
pause
