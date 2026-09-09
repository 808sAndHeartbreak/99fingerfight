@echo off
cd /d "%~dp0"
if not exist node_modules call npm ci
if errorlevel 1 goto end
call npm run build
if errorlevel 1 goto end
echo Open http://localhost:3000/
call npm start
:end
pause
