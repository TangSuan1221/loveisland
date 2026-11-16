@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules\vite\bin\vite.js (
  call npm ci
  if errorlevel 1 exit /b 1
)
node node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5188 --strictPort false --open
if errorlevel 1 pause
