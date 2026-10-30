@echo off
setlocal
title LM Studio Android - PC USB Bridge & Accelerator Launcher

echo ==============================================================================
echo       ⚡ LM STUDIO ANDROID - PC USB BRIDGE & LAUNCHER
echo ==============================================================================
echo.

where adb >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if exist "C:\platform-tools\adb.exe" (
        set "ADB_PATH=C:\platform-tools\adb.exe"
    ) else if exist "C:\scrcpy-win64-v4.0\adb.exe" (
        set "ADB_PATH=C:\scrcpy-win64-v4.0\adb.exe"
    ) else (
        echo [ERROR] ADB not found in PATH or standard directories.
        echo Please install Android Platform Tools and ensure USB Debugging is ON.
        pause
        exit /b 1
    )
) else (
    set "ADB_PATH=adb"
)

echo [*] Using ADB from: %ADB_PATH%
echo [*] Checking connected Android devices...
"%ADB_PATH%" devices
echo.

echo [*] Forwarding Studio Web UI & OpenAI API port (8080) over USB...
"%ADB_PATH%" forward tcp:8080 tcp:8080

echo [*] Forwarding internal llama.cpp engine port (50053) over USB...
"%ADB_PATH%" forward tcp:50053 tcp:50053

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==============================================================================
    echo   [SUCCESS] USB ZERO-LATENCY BRIDGE IS LIVE!
    echo ==============================================================================
    echo.
    echo  1. Studio Web Dashboard: http://localhost:8080
    echo  2. OpenAI API Endpoint : http://localhost:8080/v1
    echo.
    echo Opening Studio UI in your default browser...
    start http://localhost:8080
) else (
    echo [ERROR] Failed to forward ports. Check USB cable and ensure phone is unlocked with USB Debugging enabled.
)

echo.
echo Active forwarded ports:
"%ADB_PATH%" forward --list
echo.
echo Press any key to close this bridge.
pause
