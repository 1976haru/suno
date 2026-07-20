@echo off
setlocal

rem TASK v3.31 (Part 2) - launcher for the Suno semi-automated field filler.
rem This batch file only starts the Node script below; it never automates
rem clicking Create/Generate on suno.com. See README.md for the full
rem principles this tool follows.

cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies for the first run...
  call npm install
  if errorlevel 1 goto :error
  call npx playwright install chromium
  if errorlevel 1 goto :error
)

set /p SONGS_PATH="Path to songs-output.json or suno-pack.json: "
if "%SONGS_PATH%"=="" (
  echo No path entered. Exiting.
  goto :end
)

call npm run helper -- "%SONGS_PATH%"
goto :end

:error
echo.
echo Setup failed. See the messages above.
pause
exit /b 1

:end
pause
