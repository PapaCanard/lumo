@echo off
rem Double-clique ici pour compiler et installer Lumo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer-lumo.ps1" %*
pause
