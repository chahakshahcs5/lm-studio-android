# ⚡ LM Studio Android: Smartphone AI Coprocessor & Local LLM Hub

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![Node](https://img.shields.io/badge/Node.js-22+-green.svg)
![Engine](https://img.shields.io/badge/Engine-llama.cpp%20%7C%20ARM%20NEON-00F5A0.svg)
![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20Windows%20%7C%20macOS%20%7C%20Linux-black.svg)
![API](https://img.shields.io/badge/API-OpenAI%20v1%20Compatible-informational.svg)

**Turn your Android smartphone into a high-performance local AI accelerator with an LM Studio-grade interface.**

[⚡ Quick Start](#-quick-start) • [✨ Key Enhancements](#-key-enhancements) • [🏗️ Architecture](#️-system-architecture) • [📊 Hardware Telemetry](#-hardware-telemetry--thermal-monitoring) • [🔌 OpenAI Integration](#-openai-api-integration)

</div>

---

## ⚡ Quick Start (1-Command Setup)

### 1. On Your Android Smartphone (Termux)
Open the **Termux** app on your phone, paste this single command, and press **Enter**:

```bash
curl -sL https://raw.githubusercontent.com/chahakshahcs5/lm-studio-android/main/setup_termux.sh | bash
```
*(or via:* `bash -c "$(curl -fsSL https://raw.githubusercontent.com/chahakshahcs5/lm-studio-android/main/setup_termux.sh)"`*)*

> **What this command automatically handles:**
> 1. Clones the latest `lm-studio-android` repository.
> 2. Acquires CPU wake-lock (keeps the model running with the screen off).
> 3. Detects phone ARM hardware, RAM capacity, and big.LITTLE core layout.
> 4. Installs Node.js & compilers, then builds `llama-server`.
> 5. Compiles the high-speed Studio Obsidian Web UI and launches the server at `http://localhost:8080`.

### 2. Connect from PC (Zero Latency USB Bridge)
Connect your phone with a USB cable (with **USB Debugging** enabled):
* **On Windows**: Double-click **`scripts/start_pc_bridge.bat`**
* **On Linux / macOS**: Run **`bash scripts/start_pc_bridge.sh`**

Your browser will automatically open to `http://localhost:8080`.

---

## ✨ Key Enhancements Over Original Android-GPU

* **Modular TypeScript Monorepo Architecture**: Clean separation between `@lm-studio-android/shared`, `@lm-studio-android/server`, and `@lm-studio-android/web`.
* **Sub-35MB RAM Footprint**: The modern React interface compiles directly into static assets served with zero overhead by the lightweight Node daemon, saving precious RAM for model weights.
* **Studio Obsidian Design System**: Custom handcrafted UI inspired by LM Studio, Linear, and Raycast. No generic AI templates or bloated libraries.
* **Live WebSocket Telemetry**: Sub-second, real-time broadcast of battery percentage, thermal degrees, big.LITTLE core pinning, unified RAM allocation, and token generation speed.
* **Curated Hugging Face Catalog**: RAM compatibility calculator automatically validates whether a model safely fits within your device's memory before downloading.
* **Fine-Grained Inference Tuning**: Adjust Temperature, Top-P, Top-K, Repetition Penalty, Max Tokens, Flash-Attention, and 8-bit KV Cache in real-time.
* **One-Click Memory Purge**: Instantly kill inference processes and recover 100% of phone RAM with a single click.

---

## 🏗️ System Architecture

```text
+-------------------------------------------------------------------+
|                        YOUR COMPUTER                              |
|                                                                   |
|   [LM Studio Obsidian UI]     [VS Code / Continue]    [Agent]     |
|              │                         │                 │        |
|              └─────────────────────────┼─────────────────┘        |
|                                        │ http://localhost:8080    |
+────────────────────────────────────────┼──────────────────────────+
                                         │
                        USB Cable (ADB Port Forward)
                           or Local Wi-Fi Network
                                         │
+────────────────────────────────────────┼──────────────────────────+
|                    ANDROID PHONE (Termux)                         |
|                                        │                          |
|         ┌──────────────────────────────┴─────────────────┐        |
|         ▼                                                ▼        |
|  [React 18 / Vite UI]                        [Node.js + TS Server]|
|  (Static Bundle <1MB)                         - Express & WS Hub  |
|                                               - OpenAI SSE Proxy  |
|                                               - Telemetry Monitor |
|                                                          │        |
|                                        Process Lifecycle │        |
|                                                          ▼        |
|                                                [llama-server]     |
|                                                - Port 50053       |
|                                                - ARM NEON SIMD    |
|                                                - Unified LPDDR    |
+-------------------------------------------------------------------+
```

---

## 📊 Hardware Telemetry & Thermal Monitoring

The system monitors low-level Android kernel metrics via `/sys`:
* **Battery Level & State**: Real-time percentage, voltage, and fast-charging status.
* **Thermal Throttling Guard**: Automatically flags warnings when phone battery thermals exceed 42°C to prevent hardware wear.
* **big.LITTLE Core Pinning**: Distinguishes high-performance Cortex cores from efficiency cores and pins compute threads via `taskset` for maximum tokens/second.
* **LPDDR Memory Tracker**: Visualizes model weights vs Android OS system allocations.

---

## 🔌 OpenAI API Integration

LM Studio Android provides a universal OpenAI-compatible endpoint at `http://localhost:8080/v1`:

### VS Code (Continue / Cline / Roo Code)
Add this to your `config.json`:
```json
{
  "models": [
    {
      "title": "LM Studio Android",
      "provider": "openai",
      "model": "local-phone-model",
      "apiBase": "http://localhost:8080/v1",
      "apiKey": "not-needed"
    }
  ]
}
```

### Python
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="not-needed"
)

response = client.chat.completions.create(
    model="local-phone-model",
    messages=[{"role": "user", "content": "Explain ARM NEON vector math in 2 sentences."}],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Start the full-stack server (serves compiled UI on port 8080)
npm start

# Or run frontend with Vite HMR in development
npm run dev:web
```

---

## 📄 License
MIT License.
