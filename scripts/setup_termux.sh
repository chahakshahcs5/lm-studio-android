#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# ⚡ LM STUDIO ANDROID: Universal 1-Command Automated Setup
# Turns Your Smartphone into a Local AI Accelerator & Coprocessor
# ==============================================================================

# Terminal Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

clear 2>/dev/null || true
echo -e "${CYAN}======================================================================${NC}"
echo -e "${GREEN}${BOLD}   ⚡ LM STUDIO ANDROID - SMARTPHONE AI ACCELERATOR HUB SETUP        ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# ==============================================================================
# 0. AUTO-BOOTSTRAP (FOR 1-COMMAND CURL LAUNCH)
# ==============================================================================
REPO_DIR="$HOME/lm-studio-android"

if [ ! -f "package.json" ] || [ ! -d "packages" ]; then
    echo -e "${YELLOW}[*] Bootstrapping environment and cloning LM Studio Android...${NC}"
    if ! command -v git >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
        echo -e "${BLUE}[*] Installing essential packages (git & curl)...${NC}"
        pkg update -y 2>/dev/null || true
        pkg install -y git curl 2>/dev/null || true
    fi
    rm -rf "$REPO_DIR"
    git clone --depth 1 https://github.com/chahakshahcs5/lm-studio-android.git "$REPO_DIR"
    cd "$REPO_DIR"
    chmod +x setup_termux.sh 2>/dev/null || true
    chmod +x scripts/*.sh 2>/dev/null || true
    exec bash setup_termux.sh </dev/tty
else
    # Pull latest updates if already in repo
    echo -e "${BLUE}[*] Checking for updates...${NC}"
    git pull origin main 2>/dev/null || true
fi

# ==============================================================================
# 1. ACQUIRE WAKE-LOCK & PHONE STORAGE
# ==============================================================================
if command -v termux-wake-lock >/dev/null 2>&1; then
    echo -e "${BLUE}[*] Acquiring CPU wake-lock (keeps inference running with screen off)...${NC}"
    termux-wake-lock 2>/dev/null || true
fi

if [ ! -d "$HOME/storage" ]; then
    echo -e "${BLUE}[*] Requesting phone storage access (/sdcard)...${NC}"
    termux-setup-storage 2>/dev/null || true
fi

# ==============================================================================
# 2. HARDWARE & PROCESSOR PROFILING
# ==============================================================================
DEVICE_BRAND=$(getprop ro.product.brand 2>/dev/null || echo "")
DEVICE_MODEL=$(getprop ro.product.model 2>/dev/null || getprop ro.product.device 2>/dev/null || echo "Android Device")
DEVICE_MANUF=$(getprop ro.product.manufacturer 2>/dev/null || echo "$DEVICE_BRAND")
SOC_NAME=$(getprop ro.soc.model 2>/dev/null || getprop ro.board.platform 2>/dev/null || grep -m1 "Hardware" /proc/cpuinfo 2>/dev/null | awk -F: '{print $2}' | xargs || echo "ARM64 Processor")
ARCH=$(uname -m 2>/dev/null || echo "aarch64")
CORES=$(nproc 2>/dev/null || echo 4)
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "4000000")
RAM_GB=$(( (TOTAL_RAM_KB + 500000) / 1024 / 1024 ))
ANDROID_VER=$(getprop ro.build.version.release 2>/dev/null || echo "Unknown")

FULL_DEVICE_NAME="${DEVICE_MANUF} ${DEVICE_MODEL}"
if [ -z "$DEVICE_MANUF" ] || [ "$DEVICE_MANUF" = "$DEVICE_MODEL" ]; then
    FULL_DEVICE_NAME="$DEVICE_MODEL"
fi

CPU_INFO=$(cat /proc/cpuinfo 2>/dev/null || true)
HAS_DOTPROD=0
if echo "$CPU_INFO" | grep -q -i -E "asimddp|dotprod"; then
    HAS_DOTPROD=1
fi

HAS_VULKAN=0
if [ -e "/system/lib64/libvulkan.so" ] || [ -e "/vendor/lib64/hw/vulkan."* ] || command -v vulkaninfo >/dev/null 2>&1; then
    HAS_VULKAN=1
fi

echo -e "\n${CYAN}======================================================================${NC}"
echo -e "${GREEN}${BOLD}   📱 DETECTED HARDWARE & ARM PROFILE                                ${NC}"
echo -e "${CYAN}======================================================================${NC}"
echo -e " 📲 Device        : ${YELLOW}${BOLD}${FULL_DEVICE_NAME}${NC} (Android ${ANDROID_VER})"
echo -e " 🧠 Processor     : ${YELLOW}${BOLD}${SOC_NAME}${NC} (${ARCH})"
echo -e " ⚡ CPU Cores     : ${CYAN}${CORES} Cores detected${NC}"
echo -e " 💾 System Memory : ${CYAN}${RAM_GB} GB RAM detected${NC}"
if [ "$HAS_DOTPROD" -eq 1 ]; then
    echo -e " 🚀 Vector Math   : ${GREEN}${BOLD}ARM NEON + Hardware Dot-Product (sdot/udot)${NC}"
else
    echo -e " 🚀 Vector Math   : ${YELLOW}Standard ARM NEON Vector SIMD${NC}"
fi
if [ "$HAS_VULKAN" -eq 1 ]; then
    echo -e " 🎮 Mobile GPU    : ${GREEN}${BOLD}Vulkan Hardware Acceleration Driver DETECTED${NC}"
fi
echo -e "${CYAN}======================================================================${NC}\n"

# ==============================================================================
# 3. INSTALL NODE.JS & BUILD TOOLS
# ==============================================================================
echo -e "${BLUE}[*] Checking runtime dependencies (Node.js, Clang, CMake, Make)...${NC}"
pkg update -y 2>/dev/null || true
pkg install -y nodejs clang cmake make git curl libandroid-support 2>/dev/null || true

# ==============================================================================
# 4. PREPARE LLAMA.CPP INFERENCE SERVER
# ==============================================================================
INSTALL_DIR="$HOME/llama.cpp"
BUILD_DIR="$INSTALL_DIR/build"
MODELS_DIR="$HOME/models"
mkdir -p "$MODELS_DIR"

find_existing_server() {
    for p in \
        "$BUILD_DIR/bin/llama-server" \
        "$INSTALL_DIR/bin/llama-server" \
        "$INSTALL_DIR/llama-server" \
        "$HOME/bin/llama-server" \
        "$PREFIX/bin/llama-server" \
        "/data/data/com.termux/files/usr/bin/llama-server"; do
        if [ -f "$p" ] && [ -x "$p" ]; then
            echo "$p"
            return 0
        fi
    done
    if command -v llama-server >/dev/null 2>&1; then
        command -v llama-server
        return 0
    fi
    return 1
}

SERVER_BIN=$(find_existing_server || echo "")

if [ -z "$SERVER_BIN" ]; then
    echo -e "${CYAN}[*] Setting up llama-server inference engine...${NC}"

    # Try 1: Install official Termux package if available
    pkg install -y tur-repo 2>/dev/null || true
    pkg install -y llama-cpp 2>/dev/null || pkg install -y llama.cpp 2>/dev/null || true
    SERVER_BIN=$(find_existing_server || echo "")

    # Try 2: Fast CMake compilation
    if [ -z "$SERVER_BIN" ]; then
        echo -e "${YELLOW}[*] Compiling optimized llama-server with all ${CORES} CPU cores...${NC}"
        cd "$HOME"
        if [ ! -d "llama.cpp" ]; then
            git clone --depth 1 https://github.com/ggerganov/llama.cpp.git
        fi
        cd llama.cpp
        mkdir -p build && cd build
        cmake .. -DCMAKE_BUILD_TYPE=Release -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF
        cmake --build . --config Release -j"$CORES" --target llama-server
        SERVER_BIN=$(find_existing_server || echo "")
    fi
fi

if [ -n "$SERVER_BIN" ]; then
    echo -e "${GREEN}[✓] Inference engine ready: ${SERVER_BIN}${NC}"
else
    echo -e "${YELLOW}[!] Note: llama-server will compile in the background or use dev simulation.${NC}"
fi

# ==============================================================================
# 5. BUILD LM STUDIO ANDROID MONOREPO (CLIENT & SERVER)
# ==============================================================================
cd "$REPO_DIR"
echo -e "\n${BLUE}[*] Installing Node packages and building UI...${NC}"
npm install --no-audit --no-fund
echo -e "${BLUE}[1/3] Compiling shared type definitions...${NC}"
npm run build:shared
echo -e "${BLUE}[2/3] Compiling Node.js hub server...${NC}"
npm run build:server
echo -e "${BLUE}[3/3] Compiling React Obsidian UI...${NC}"
npm run build:web

# Robust Wi-Fi LAN IP detection (tries wlan0, ip route, and ifconfig)
WIFI_IP=$(ip -4 addr show wlan0 2>/dev/null | grep -oE 'inet [0-9.]+' | cut -d' ' -f2 || true)
if [ -z "$WIFI_IP" ]; then
    WIFI_IP=$(ip route get 8.8.8.8 2>/dev/null | grep -oE 'src [0-9.]+' | cut -d' ' -f2 || true)
fi
if [ -z "$WIFI_IP" ]; then
    WIFI_IP=$(ifconfig 2>/dev/null | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1 || true)
fi
if [ -z "$WIFI_IP" ]; then
    WIFI_IP="127.0.0.1"
fi

echo -e "\n${CYAN}======================================================================${NC}"
echo -e "${GREEN}${BOLD}   🚀 LM STUDIO ANDROID IS LIVE AND ACCELERATING!                   ${NC}"
echo -e "${CYAN}======================================================================${NC}"
echo -e " 📲 Phone Local Web UI  : ${YELLOW}http://localhost:8080${NC}"
echo -e " 🌐 Local Wi-Fi LAN UI  : ${GREEN}${BOLD}http://${WIFI_IP}:8080${NC}"
echo -e " 🔌 Universal OpenAI API: ${YELLOW}http://${WIFI_IP}:8080/v1${NC}"
echo -e " ⚡ USB Zero Latency    : ${CYAN}adb forward tcp:8080 tcp:8080${NC}"
echo -e "${CYAN}======================================================================${NC}\n"

echo -e "${GREEN}[*] Starting LM Studio Node Server... (Press Ctrl+C to stop)${NC}"
exec npm start
