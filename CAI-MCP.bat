@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\bootstrap-customer-install.ps1" -ServerRoot "%SCRIPT_DIR:~0,-1%" %*
exit /b %ERRORLEVEL%
