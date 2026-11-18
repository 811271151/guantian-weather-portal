@echo off
setlocal
cd /d "%~dp0" || exit /b 1

set "PORTAL_URL=http://127.0.0.1:8000"
curl.exe --fail --silent --max-time 3 "%PORTAL_URL%/api/health" >nul 2>&1
if not errorlevel 1 (
    echo Weather portal is already running at %PORTAL_URL%
    exit /b 0
)

if not exist ".venv\Scripts\python.exe" (
    echo Python environment is missing. See PORTAL.md.
    pause
    exit /b 1
)
if not exist "frontend\dist\index.html" (
    echo Frontend build is missing. See PORTAL.md.
    pause
    exit /b 1
)

curl.exe --fail --silent --max-time 3 "http://127.0.0.1:11434/api/version" >nul 2>&1
if errorlevel 1 (
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama app.exe" (
        start "" "%LOCALAPPDATA%\Programs\Ollama\ollama app.exe"
    ) else (
        echo Start Ollama from the Windows Start menu for the chat feature.
    )
)

echo Open %PORTAL_URL% once Uvicorn is running. Press Ctrl+C to stop.
".venv\Scripts\python.exe" -m uvicorn portal:app --host 127.0.0.1 --port 8000
if errorlevel 1 pause
