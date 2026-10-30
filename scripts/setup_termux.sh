#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# LM Studio Android - Automated Termux Setup & Hardware Accelerator Builder
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}================================================================${NC}"
echo -e "${GREEN}${BOLD}   ⚡ LM STUDIO ANDROID: LOCAL AI ACCELERATOR HUB SETUP        ${NC}"
echo -e "${CYAN}================================================================${NC}"

# 1. Acquire Wake-Lock to keep phone CPU active in background
if command -v termux-wake-lock >/dev/null 2>&1; then
    echo -e "${CYAN}[*] Acquiring CPU wake-lock (prevents screen-off CPU throttle)...${NC}"
    termux-wake-lock
fi

# 2. Storage Setup
if [ ! -d "$HOME/storage" ]; then
    echo -e "${CYAN}[*] Requesting phone storage access...${NC}"
    termux-setup-storage || true
fi

# 3. Update packages and install build dependencies
echo -e "${CYAN}[*] Installing Node.js, Clang, CMake, Make, and Git...${NC}"
pkg update -y || true
pkg install -y nodejs git clang cmake make curl libandroid-support || true

# 4. Check for llama.cpp compilation
LLAMA_BIN="$HOME/llama.cpp/build/bin/llama-server"
if [ ! -f "$LLAMA_BIN" ]; then
    echo -e "${YELLOW}[*] llama.cpp not compiled yet. Building accelerated engine...${NC}"
    cd "$HOME"
    if [ ! -d "llama.cpp" ]; then
        git clone --depth 1 https://github.com/ggerganov/llama.cpp.git
    fi
    cd llama.cpp
    mkdir -p build && cd build
    cmake .. -DCMAKE_BUILD_TYPE=Release
    cmake --build . --config Release -j$(nproc) --target llama-server
fi

# 5. Build LM Studio Node Server & Static Frontend
REPO_DIR="$HOME/lm-studio-android"
if [ -d "$REPO_DIR" ]; then
    cd "$REPO_DIR"
    echo -e "${CYAN}[*] Building workspace packages...${NC}"
    npm install
    npm run build
    echo -e "${GREEN}[✓] LM Studio Android built successfully!${NC}"
    echo -e "${GREEN}[*] Starting server on port 8080...${NC}"
    npm start
else
    echo -e "${YELLOW}[!] Please place lm-studio-android into ~/lm-studio-android${NC}"
fi
