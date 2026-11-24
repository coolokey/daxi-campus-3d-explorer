@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
if not exist dist\index.html (
  call npm run build
  if errorlevel 1 exit /b 1
)
start "" "http://127.0.0.1:5179/"
node node_modules\vite\bin\vite.js preview --host 127.0.0.1 --port 5179 --strictPort
