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
  private port: number = parseInt(process.env.LLAMA_PORT || '50053', 10);
  private isMockMode: boolean = false;
  private tokensGeneratedTotal: number = 0;
  private lastRunTps: number = 0;
  private isIntentionalStop: boolean = false;
  private lastExitCode: number | null = null;
  private lastExitSignal: string | null = null;
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
      for (const name of ['llama-server']) {
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
      isMock: this.isMockMode,
      currentModel: isAlive ? this.currentModel : null,
      activeConfig: isAlive ? this.activeConfig : null,
      pid: this.process?.pid ?? null,
      port: this.port,
      tokensGeneratedTotal: this.tokensGeneratedTotal,
      lastRunTps: this.lastRunTps,
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

    // Clean fresh log for each spawn
    const logFd = fs.openSync(this.logPath, 'w');

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

    this.lastExitCode = null;
    this.lastExitSignal = null;

    this.process.on('error', (err) => {
      console.error('[LlamaEngine] Process error:', err);
      this.stop();
    });

    this.process.on('exit', (code, signal) => {
      this.lastExitCode = code;
      this.lastExitSignal = signal;

      if (this.isIntentionalStop) {
        console.log(`[LlamaEngine] ✓ Model successfully unloaded. 100% RAM freed.`);
      } else if (code === 0) {
        console.log(`[LlamaEngine] llama-server stopped cleanly (code 0).`);
      } else if (signal) {
        console.log(
          `[LlamaEngine] llama-server terminated by signal: ${signal}${
            signal === 'SIGKILL' ? ' (Likely Android Kernel OOM / memory pressure)' : ''
          }`
        );
      } else {
        console.log(`[LlamaEngine] llama-server exited with code: ${code}`);
      }

      this.process = null;
      this.currentModel = null;
      this.activeConfig = null;
    });

    // Wait for health check (90s limit for large models on smartphone storage)
    const isReady = await this.pollHealth(90);
    if (!isReady) {
      let errMsg = 'Engine failed to initialize model within 90 seconds. Model weights might still be allocating or RAM is constrained.';
      if (this.lastExitCode !== null) {
        errMsg = `llama-server exited with code: ${this.lastExitCode}. Check arguments or model compatibility.`;
      } else if (this.lastExitSignal) {
        errMsg = `llama-server terminated by signal: ${this.lastExitSignal}${
          this.lastExitSignal === 'SIGKILL' ? ' (Android Kernel OOM / memory pressure)' : ''
        }.`;
      }

      if (fs.existsSync(this.logPath)) {
        try {
          const lines = fs.readFileSync(this.logPath, 'utf8').trim().split('\n');
          const recent = lines.slice(-15).join('\n');
          if (recent) errMsg = `${errMsg}\n\nServer Log:\n${recent}`;
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
    const proc = this.process;
    const pid = proc?.pid;

    if (proc) {
      this.isIntentionalStop = true;
      try {
        // If taskset spawned llama-server as child on Linux, terminate the child process tree
        if (os.platform() === 'linux' && pid) {
          try {
            execFileSync('pkill', ['-9', '-P', pid.toString()], {
              timeout: 1000,
              stdio: ['ignore', 'ignore', 'ignore'],
            });
          } catch {
            // ignore
          }
        }
        proc.kill('SIGTERM');
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      } catch {
        // ignore
      }
      this.process = null;
      this.isIntentionalStop = false;
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

  public setLastRunTps(tps: number): void {
    if (tps > 0) {
      this.lastRunTps = Math.round(tps * 10) / 10;
    }
  }

  public getPid(): number | null {
    return this.process?.pid || null;
  }

  private pollHealth(maxSeconds: number): Promise<boolean> {
    const start = Date.now();
    return new Promise((resolve) => {
      let isDone = false;
      let timer: NodeJS.Timeout | null = null;

      const finish = (result: boolean) => {
        if (isDone) return;
        isDone = true;
        if (timer) clearTimeout(timer);
        resolve(result);
      };

      // If child process exits or errors, abort polling INSTANTLY (under 1ms)
      if (this.process) {
        this.process.once('exit', () => finish(false));
        this.process.once('error', () => finish(false));
      }

      const check = () => {
        if (isDone) return;

        // If process exited prematurely (e.g. invalid arguments or OOM)
        if (this.process === null || this.process.exitCode !== null) {
          return finish(false);
        }

        if (Date.now() - start > maxSeconds * 1000) {
          return finish(false);
        }

        const req = http.get(
          `http://127.0.0.1:${this.port}/health`,
          { timeout: 1500 },
          (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
              if (res.statusCode === 200) {
                return finish(true);
              }
              // HTTP 503 means {"status": "loading model"} - keep polling until weights load!
              if (!isDone) {
                timer = setTimeout(check, 500);
              }
            });
          }
        );

        req.on('timeout', () => {
          req.destroy();
          if (!isDone) timer = setTimeout(check, 500);
        });

        req.on('error', () => {
          if (!isDone) timer = setTimeout(check, 500);
        });

        req.end();
      };

      check();
    });
  }
}

export const llamaEngine = new LlamaEngine();
