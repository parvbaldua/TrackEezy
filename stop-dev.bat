@echo off
REM =====================================================
REM TrackEezy - Stop All Development Servers
REM =====================================================

echo.
echo Stopping all Node.js processes...
taskkill /F /IM node.exe >nul 2>&1

echo.
echo All development servers stopped.
echo.
pause
