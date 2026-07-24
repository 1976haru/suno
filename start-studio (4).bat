@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

set "BRANCH=feat/notion-genre-library"
set "KEYFILE=%~dp0.anthropic_key"
set "GEMINIKEYFILE=%~dp0.gemini_key"

REM Turn on Anthropic debug logging so [GEN DIAG] / [GEN USAGE] lines print
REM in this window. Remove this line later once generation is stable.
set "DEBUG_ANTHROPIC=1"

echo ============================================
echo   Suno Weaver Studio Launcher  (DEBUG MODE)
echo ============================================
echo.

if not exist "package.json" (
    echo ERROR: package.json not found in this folder.
    echo Put this .bat file in the project root folder
    echo the folder that contains package.json
    echo.
    pause
    exit /b 1
)

if exist "%KEYFILE%" (
    set /p ANTHROPIC_API_KEY=<"%KEYFILE%"
    echo [KEY] Using saved Claude API key.
) else (
    echo [KEY] No saved Claude API key found.
    echo       Paste your Claude API key and press Enter.
    echo       It starts with sk-ant-
    echo.
    set /p "NEWKEY=Key: "
    if "!NEWKEY!"=="" (
        echo.
        echo  No key entered. Running in LOCAL-ONLY mode.
        echo.
    ) else (
        >"%KEYFILE%" echo !NEWKEY!
        set "ANTHROPIC_API_KEY=!NEWKEY!"
        echo  Key saved. It will be used automatically next time.
    )
)
echo.

if exist "%GEMINIKEYFILE%" (
    set /p GEMINI_API_KEY=<"%GEMINIKEYFILE%"
    echo [KEY] Using saved Gemini API key ^(thumbnail/cover image generation^).
) else (
    echo [KEY] No saved Gemini API key found.
    echo       This key is only needed for the thumbnail/cover image generator.
    echo       Paste your Gemini API key and press Enter, or press Enter to skip.
    echo.
    set /p "NEWGEMINIKEY=Gemini Key (optional): "
    if "!NEWGEMINIKEY!"=="" (
        echo.
        echo  No Gemini key entered. Image generation will need a key added
        echo  later in Settings, or you can rerun this script.
        echo.
    ) else (
        >"%GEMINIKEYFILE%" echo !NEWGEMINIKEY!
        set "GEMINI_API_KEY=!NEWGEMINIKEY!"
        echo  Gemini key saved. It will be used automatically next time.
    )
)
echo.

echo [1/3] Switching to branch %BRANCH% ...
call git checkout %BRANCH%
if errorlevel 1 (
    echo.
    echo  git checkout failed. You may have local edits to stash first.
    echo.
    pause
    exit /b 1
)

echo [2/3] Pulling latest code ...
call git pull origin %BRANCH%
if errorlevel 1 (
    echo.
    echo  git pull failed. Check your internet connection.
    echo.
    pause
    exit /b 1
)

echo [3/3] Checking packages ^(fast if nothing changed^) ...
call npm install
if errorlevel 1 (
    echo.
    echo  npm install failed. See the error above.
    echo.
    pause
    exit /b 1
)

echo.
if defined ANTHROPIC_API_KEY (
    echo Ready ^(Claude API ENABLED, DEBUG ON^). Starting server and opening browser...
) else (
    echo Ready ^(LOCAL-ONLY, no API key^). Starting server and opening browser...
)
echo.
echo  ^>^>^> When you generate songs, watch THIS window for lines starting with
echo       [GEN DIAG] and [GEN USAGE]  -- copy all of them and send to Claude.
echo.
echo Keep this black window open while you work. Closing it stops the app.
echo.

call npm run dev -- --open

pause
