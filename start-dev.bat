@echo off
REM =====================================================
REM TrackEezy - Start/Restart Development Servers
REM =====================================================
REM This script starts both the React frontend and Next.js app
REM Run this script from the Trackeezy root folder

echo.
echo ========================================
echo   TrackEezy Dev Server Launcher
echo ========================================
echo.

REM Kill any existing Node processes on common dev ports
echo [1/4] Stopping existing servers...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 >nul

REM Start React App (Vite) on port 5173
echo [2/4] Starting React Frontend (Vite)...
cd /d "%~dp0react-app"
start "TrackEezy-React" cmd /k "npm run dev"

REM Give it a moment to start
timeout /t 3 >nul

REM Start Next.js App on port 3000
echo [3/4] Starting Next.js App...
cd /d "%~dp0app"
start "TrackEezy-NextJS" cmd /k "npm run dev"

echo.
echo [4/4] Servers starting...
echo.
echo ========================================
echo   React App:    http://localhost:5173
echo   Next.js App:  http://localhost:3000
echo ========================================
echo.
echo Press any key to exit this launcher...
echo (Dev servers will continue running in their windows)
pause >nul
