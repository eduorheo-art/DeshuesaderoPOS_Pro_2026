@echo off
title YonkePOS - Servidor para Celulares
cls
echo ========================================================
echo   Iniciando Servidor Local de YonkePOS para Celulares...
echo ========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Si ves algun error, puedes presionar una tecla para cerrar.
    pause
)
