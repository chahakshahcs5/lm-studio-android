#!/bin/bash
# ==============================================================================
# LM Studio Android - PC USB Bridge & Launcher (Linux / macOS)
# ==============================================================================

echo "=================================================================="
echo "      ⚡ LM STUDIO ANDROID - PC USB BRIDGE & LAUNCHER"
echo "=================================================================="
echo ""

if ! command -v adb >/dev/null 2>&1; then
    echo "[ERROR] ADB not found. Please install Android Platform Tools."
    exit 1
fi

echo "[*] Connected devices:"
adb devices
echo ""

echo "[*] Forwarding Studio Web UI & OpenAI API port (8080) over USB..."
adb forward tcp:8080 tcp:8080

echo "[*] Forwarding internal llama.cpp engine port (50053) over USB..."
adb forward tcp:50053 tcp:50053

echo ""
echo "=================================================================="
echo "  [SUCCESS] USB BRIDGE IS LIVE!"
echo "=================================================================="
echo "  1. Studio Web Dashboard: http://localhost:8080"
echo "  2. OpenAI API Endpoint : http://localhost:8080/v1"
echo ""

# Open browser based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:8080
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:8080 2>/dev/null || sensible-browser http://localhost:8080 2>/dev/null || true
fi
