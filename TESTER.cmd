@echo off
rem Double-clique ici pour lancer Lumo sans l'installer (mode test).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer-lumo.ps1" -Dev
pause
