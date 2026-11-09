@echo off
REM Windows entry for fnOS packaging. cmd.exe is not subject to PowerShell
REM execution policy, so this always runs build.ps1 with Bypass.
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" %*
exit /b %ERRORLEVEL%
