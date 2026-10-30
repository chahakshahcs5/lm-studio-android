import { ChildProcess, spawn, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { EngineStatus, LocalModel, RuntimeConfig } from '@lm-studio-android/shared';
import { hardwareMonitor } from '../hardware/telemetry.js';

export class LlamaEngine {
  private process: ChildProcess | null = null;
  private currentModel: LocalModel | null = null;
  private activeConfig: RuntimeConfig | null = null;
  private port: number = 50053;
  private isMockMode: boolean = false;
  private tokensGeneratedTotal: number = 0;
  private logPath: string;
  private featuresCache: Map<
    string,
    {
      flashAttnStyle: 'value' | 'flag' | 'none';
      supportsKvQuant: boolean;
      supportsGpuLayers: boolean;
    }
  > = new Map();

  constructor() {
    this.logPath = path.join(os.homedir(), 'llama_server.log');
  }

  public getRecentLogs(maxLines: number = 25): string {
    if (fs.existsSync(this.logPath)) {
      try {
        const lines = fs.readFileSync(this.logPath, 'utf8').trim().split('\n');
        return lines.slice(-maxLines).join('\n');
      } catch {
        return '';
      }
    }
    return '';
  }

  public getBinaryFeatures(binaryPath: string): {
    flashAttnStyle: 'value' | 'flag' | 'none';
    supportsKvQuant: boolean;
    supportsGpuLayers: boolean;
  } {
    if (this.featuresCache.has(binaryPath)) {
      return this.featuresCache.get(binaryPath)!;
    }

    const defaultFeatures = {
      flashAttnStyle: 'value' as 'value' | 'flag' | 'none',
      supportsKvQuant: true,
      supportsGpuLayers: true,
    };

    try {
      const output = execFileSync(binaryPath, ['-h'], {
        timeout: 3000,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const combined = output.toLowerCase();

      if (combined.includes('--flash-attn') || combined.includes('-fa')) {
        if (
          combined.includes('[on|off|auto]') ||
          combined.includes('<on|off|auto>') ||
          combined.includes('set flash attention use') ||
          combined.includes('llama_arg_flash_attn')
        ) {
          defaultFeatures.flashAttnStyle = 'value';
        } else {
          defaultFeatures.flashAttnStyle = 'flag';
        }
      } else {
        defaultFeatures.flashAttnStyle = 'none';
      }

      defaultFeatures.supportsKvQuant = combined.includes('-ctk') || combined.includes('--cache-type-k');
      defaultFeatures.supportsGpuLayers = combined.includes('-ngl') || combined.includes('--n-gpu-layers');
    } catch (err: any) {
      const combined = ((err.stdout || '') + (err.stderr || '')).toLowerCase();
      if (combined.includes('--flash-attn') || combined.includes('-fa')) {
        if (
          combined.includes('[on|off|auto]') ||
          combined.includes('<on|off|auto>') ||
          combined.includes('set flash attention use') ||
          combined.includes('llama_arg_flash_attn')
        ) {
          defaultFeatures.flashAttnStyle = 'value';
        } else {
          defaultFeatures.flashAttnStyle = 'flag';
        }
      }
    }

    this.featuresCache.set(binaryPath, defaultFeatures);
    return defaultFeatures;
  }

  public findBinary(): string | null {
    const candidates = [
      path.join(os.homedir(), 'llama.cpp', 'build', 'bin', 'llama-server'),
      path.join(os.homedir(), 'llama.cpp', 'bin', 'llama-server'),
      path.join(os.homedir(), 'llama.cpp', 'llama-server'),
      '/data/data/com.termux/files/usr/bin/llama-server',
      '/data/data/com.termux/files/usr/bin/server',
      path.join(os.homedir(), 'bin', 'llama-server'),
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        try {
          fs.accessSync(c, fs.constants.X_OK);
          return c;
        } catch {
          // not executable
        }
      }
    }

    // Check system PATH
    const pathDirs = (process.env.PATH || '').split(path.delimiter);
    for (const dir of pathDirs) {
      for (const name of ['llama-server', 'server']) {
        const p = path.join(dir, name);
        if (fs.existsSync(p)) {
          try {
            fs.accessSync(p, fs.constants.X_OK);
            return p;
          } catch {
            // ignore
          }
        }
      }
    }

    return null;
  }

  public getStatus(): EngineStatus {
    const isAlive = this.isMockMode || (this.process !== null && !this.process.killed && this.process.exitCode === null);
    return {
      loaded: isAlive && this.currentModel !== null,
      currentModel: isAlive ? this.currentModel : null,
      activeConfig: isAlive ? this.activeConfig : null,
      pid: this.process?.pid || null,
      port: this.port,
      tokensGeneratedTotal: this.tokensGeneratedTotal,
    };
  }

  public async start(model: LocalModel, config: RuntimeConfig): Promise<EngineStatus> {
    await this.stop();

    const binary = this.findBinary();
    if (!binary) {
      // Switch to intelligent dev simulation mode when not on Termux/ARM
      console.log(`[LlamaEngine] llama-server not found locally. Enabling Studio Dev Engine simulation for: ${model.name}`);
      this.isMockMode = true;
      this.currentModel = model;
      this.activeConfig = config;
      return this.getStatus();
    }

    this.isMockMode = false;
    const cpuTopo = hardwareMonitor.detectCpuTopology();
    const threads = config.threads || cpuTopo.recommendedThreads;

    const baseArgs: string[] = [
      '-m', model.path,
      '-c', config.ctxSize.toString(),
      '-t', threads.toString(),
      '--host', '127.0.0.1',
      '--port', this.port.toString(),
    ];

    const features = this.getBinaryFeatures(binary);

    // Optional acceleration flags
    const accelArgs = [...baseArgs];

    if (features.flashAttnStyle === 'value') {
      accelArgs.push('--flash-attn', config.flashAttn ? 'on' : 'off');
    } else if (features.flashAttnStyle === 'flag' && config.flashAttn) {
      accelArgs.push('--flash-attn');
    }

    if (config.kvQuant && config.kvQuant !== 'f16' && features.supportsKvQuant) {
      accelArgs.push('-ctk', config.kvQuant, '-ctv', config.kvQuant);
    }
    if (config.gpuLayers > 0 && features.supportsGpuLayers) {
      accelArgs.push('-ngl', config.gpuLayers.toString());
    }

    let executable = binary;
    let spawnArgs = accelArgs;

    // Pin to ARM big cores if taskset is available
    if (config.pinCores && cpuTopo.affinityMask && os.platform() === 'linux') {
      const hasTaskset =
        fs.existsSync('/system/bin/taskset') ||
        fs.existsSync('/data/data/com.termux/files/usr/bin/taskset') ||
        fs.existsSync('/usr/bin/taskset');
      if (hasTaskset) {
        spawnArgs = ['-c', cpuTopo.affinityMask, binary, ...accelArgs];
        executable = 'taskset';
      }
    }

    console.log(`[LlamaEngine] Spawning: ${executable} ${spawnArgs.join(' ')}`);

    // Ensure log file exists and open file descriptor safely (Fixes fd: null stdio error)
    const logFd = fs.openSync(this.logPath, 'a');

    try {
      this.process = spawn(executable, spawnArgs, {
        detached: false,
        stdio: ['ignore', logFd, logFd],
        env: {
          ...process.env,
          LD_LIBRARY_PATH: `${path.join(os.homedir(), 'llama.cpp', 'build', 'bin')}:${path.join(os.homedir(), 'llama.cpp', 'lib')}:${process.env.LD_LIBRARY_PATH || ''}`,
        },
      });
    } finally {
      // Close parent copy of fd safely; child process retains cloned descriptor
      fs.closeSync(logFd);
    }

    this.process.on('error', (err) => {
      console.error('[LlamaEngine] Process error:', err);
      this.stop();
    });

    this.process.on('exit', (code) => {
      console.log(`[LlamaEngine] Process exited with code ${code}`);
      this.process = null;
      this.currentModel = null;
      this.activeConfig = null;
    });

    // Wait for health check
    const isReady = await this.pollHealth(35);
    if (!isReady) {
      let errMsg = 'Engine failed to initialize model within 35 seconds.';
      if (fs.existsSync(this.logPath)) {
        try {
          const lines = fs.readFileSync(this.logPath, 'utf8').trim().split('\n');
          const recent = lines.slice(-8).join('\n');
          if (recent) errMsg = `Server Log:\n${recent}`;
        } catch {}
      }
      await this.stop();
      throw new Error(errMsg);
    }

    this.currentModel = model;
    this.activeConfig = config;
    return this.getStatus();
  }

  public async stop(): Promise<void> {
    if (this.process) {
      try {
        this.process.kill('SIGKILL');
      } catch (e) {
        // ignore
      }
      this.process = null;
    }
    this.isMockMode = false;
    this.currentModel = null;
    this.activeConfig = null;
  }

  public getLlamaUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  public getIsMock(): boolean {
    return this.isMockMode;
  }

  public incrementTokens(count: number): void {
    this.tokensGeneratedTotal += count;
  }

  private pollHealth(maxSeconds: number): Promise<boolean> {
    const start = Date.now();
    return new Promise((resolve) => {
      const check = () => {
        // If process exited prematurely (e.g. invalid arguments or OOM)
        if (this.process === null || this.process.exitCode !== null) {
          return resolve(false);
        }

        if (Date.now() - start > maxSeconds * 1000) {
          return resolve(false);
        }

        const req = http.get(`http://127.0.0.1:${this.port}/health`, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            if (res.statusCode === 200) {
              return resolve(true);
            }
            // HTTP 503 means {"status": "loading model"} - keep polling until weights load!
            setTimeout(check, 500);
          });
        });

        req.on('error', () => {
          setTimeout(check, 500);
        });
        req.end();
      };
      check();
    });
  }
}

export const llamaEngine = new LlamaEngine();
