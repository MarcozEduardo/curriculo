@echo off
chcp 65001 >nul
title Curriculo - Servidor Local
cd /d "%~dp0"

echo.
echo  =====================================
echo   Iniciando servidor do curriculo...
echo  =====================================
echo.

timeout /t 1 /nobreak >nul

start "" http://localhost:3333

node server.js

pause
