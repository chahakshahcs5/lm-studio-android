import { ChildProcess, spawn } from 'child_process';
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

  constructor() {
    this.logPath = path.join(os.homedir(), 'llama_server.log');
  }

  public findBinary(): string | null {
    const candidates = [
      path.join(os.homedir(), 'llama.cpp', 'build', 'bin', 'llama-server'),
      path.join(os.homedir(), 'llama.cpp', 'bin', 'llama-server'),
      path.join(os.homedir(), 'llama.cpp', 'llama-server'),
      '/data/data/com.termux/files/usr/bin/llama-server',
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
    return null;
  }

  public getStatus(): EngineStatus {
    const isAlive = this.isMockMode || (this.process !== null && !this.process.killed);
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

    const args: string[] = [
      '-m', model.path,
      '-c', config.ctxSize.toString(),
      '-t', threads.toString(),
      '--host', '127.0.0.1',
      '--port', this.port.toString(),
    ];

    if (config.flashAttn) {
      args.push('--flash-attn');
    }
    if (config.kvQuant && config.kvQuant !== 'f16') {
      args.push('-ctk', config.kvQuant, '-ctv', config.kvQuant);
    }
    if (config.gpuLayers > 0) {
      args.push('-ngl', config.gpuLayers.toString());
    }

    let executable = binary;
    let spawnArgs = args;

    // Pin to ARM big cores if available on Linux/Android
    if (config.pinCores && cpuTopo.affinityMask && os.platform() === 'linux') {
      spawnArgs = ['-c', cpuTopo.affinityMask, binary, ...args];
      executable = 'taskset';
    }

    console.log(`[LlamaEngine] Spawning: ${executable} ${spawnArgs.join(' ')}`);

    const logStream = fs.createWriteStream(this.logPath, { flags: 'a' });
    this.process = spawn(executable, spawnArgs, {
      detached: false,
      stdio: ['ignore', logStream, logStream],
      env: {
        ...process.env,
        LD_LIBRARY_PATH: `${path.join(os.homedir(), 'llama.cpp', 'build', 'bin')}:${path.join(os.homedir(), 'llama.cpp', 'lib')}:${process.env.LD_LIBRARY_PATH || ''}`,
      },
    });

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
    const isReady = await this.pollHealth(30);
    if (!isReady) {
      await this.stop();
      throw new Error('Engine failed to bind or initialize weights within 30s.');
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
        if (Date.now() - start > maxSeconds * 1000) {
          return resolve(false);
        }

        const req = http.get(`http://127.0.0.1:${this.port}/health`, (res) => {
          if (res.statusCode === 200) {
            resolve(true);
          } else {
            setTimeout(check, 500);
          }
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
