import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';
import { DownloadState, HfModelPreset, LocalModel } from '@lm-studio-android/shared';

export const CURATED_MODELS: HfModelPreset[] = [
  {
    id: 'smollm2-135m-q4_0',
    repo: 'HuggingFaceTB/SmolLM2-135M-Instruct-GGUF',
    filename: 'smollm2-135m-instruct-q4_0.gguf',
    name: 'SmolLM2 135M Instruct',
    params: '135M',
    quantization: 'Q4_0',
    sizeBytes: 85 * 1024 * 1024,
    sizeFormatted: '85 MB',
    minRamGb: 3,
    recommended: true,
    tier: 1,
    downloadUrl: 'https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct-GGUF/resolve/main/smollm2-135m-instruct-q4_0.gguf',
    description: 'Ultra-fast ARM NEON DotProd execution with sub-second TTFT on any smartphone.',
  },
  {
    id: 'smollm2-360m-q4_k_m',
    repo: 'HuggingFaceTB/SmolLM2-360M-Instruct-GGUF',
    filename: 'smollm2-360m-instruct-q4_k_m.gguf',
    name: 'SmolLM2 360M Instruct',
    params: '360M',
    quantization: 'Q4_K_M',
    sizeBytes: 240 * 1024 * 1024,
    sizeFormatted: '240 MB',
    minRamGb: 3,
    recommended: false,
    tier: 1,
    downloadUrl: 'https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q4_k_m.gguf',
    description: 'Balanced lightweight assistant with high instruction adherence and minimal RAM footprint.',
  },
  {
    id: 'qwen2.5-0.5b-q4_k_m',
    repo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
    filename: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    name: 'Qwen 2.5 0.5B Instruct',
    params: '0.5B',
    quantization: 'Q4_K_M',
    sizeBytes: 395 * 1024 * 1024,
    sizeFormatted: '395 MB',
    minRamGb: 4,
    recommended: true,
    tier: 1,
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    description: 'Multi-lingual powerhouse capable of structured JSON output and coding tasks in under 400MB.',
  },
  {
    id: 'llama-3.2-1b-q4_k_m',
    repo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    name: 'Meta Llama 3.2 1B Instruct',
    params: '1B',
    quantization: 'Q4_K_M',
    sizeBytes: 810 * 1024 * 1024,
    sizeFormatted: '810 MB',
    minRamGb: 4,
    recommended: true,
    tier: 1,
    downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    description: 'Meta flagship lightweight general reasoning model. Fast, versatile, and high accuracy.',
  },
  {
    id: 'qwen2.5-1.5b-q4_k_m',
    repo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    name: 'Qwen 2.5 1.5B Instruct',
    params: '1.5B',
    quantization: 'Q4_K_M',
    sizeBytes: 1050 * 1024 * 1024,
    sizeFormatted: '1.05 GB',
    minRamGb: 4,
    recommended: false,
    tier: 1,
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    description: 'Strong mathematical reasoning, coding assistance, and multi-turn dialogue retention.',
  },
  {
    id: 'gemma-2-2b-q4_k_m',
    repo: 'bartowski/gemma-2-2b-it-GGUF',
    filename: 'gemma-2-2b-it-Q4_K_M.gguf',
    name: 'Google Gemma 2 2B IT',
    params: '2B',
    quantization: 'Q4_K_M',
    sizeBytes: 1650 * 1024 * 1024,
    sizeFormatted: '1.65 GB',
    minRamGb: 6,
    recommended: true,
    tier: 2,
    downloadUrl: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
    description: 'Google state-of-the-art 2B parameter architecture derived from the Gemini family.',
  },
  {
    id: 'llama-3.2-3b-q4_k_m',
    repo: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    name: 'Meta Llama 3.2 3B Instruct',
    params: '3B',
    quantization: 'Q4_K_M',
    sizeBytes: 2050 * 1024 * 1024,
    sizeFormatted: '2.05 GB',
    minRamGb: 6,
    recommended: true,
    tier: 2,
    downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    description: 'The premier choice for daily driver chat, creative writing, and complex summarization.',
  },
  {
    id: 'qwen2.5-coder-3b-q4_k_m',
    repo: 'Qwen/Qwen2.5-Coder-3B-Instruct-GGUF',
    filename: 'qwen2.5-coder-3b-instruct-q4_k_m.gguf',
    name: 'Qwen 2.5 Coder 3B',
    params: '3B',
    quantization: 'Q4_K_M',
    sizeBytes: 2150 * 1024 * 1024,
    sizeFormatted: '2.15 GB',
    minRamGb: 8,
    recommended: true,
    tier: 3,
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/qwen2.5-coder-3b-instruct-q4_k_m.gguf',
    description: 'Specialist programming powerhouse for Python, TypeScript, algorithms, and bug fixing.',
  },
];

export class ModelManager {
  private modelsDir: string;
  private downloadState: DownloadState = {
    active: false,
    modelId: '',
    modelName: '',
    downloadedBytes: 0,
    totalBytes: 0,
    percent: 0,
    speedFormatted: '0 MB/s',
    etaSeconds: null,
    error: null,
  };
  private onProgressCallback?: (state: DownloadState) => void;
  private cachedLocalModels: LocalModel[] = [];
  private lastScanTimestamp: number = 0;

  // Active download tracking for cancellation
  private activeRequest: http.ClientRequest | null = null;
  private activeResponse: http.IncomingMessage | null = null;
  private activeFileStream: fs.WriteStream | null = null;
  private activeDestPath: string | null = null;
  private isCancelled: boolean = false;

  constructor() {
    this.modelsDir = process.env.MODELS_DIR || path.join(os.homedir(), 'models');
    if (!fs.existsSync(this.modelsDir)) {
      try {
        fs.mkdirSync(this.modelsDir, { recursive: true });
      } catch {
        // ignore
      }
    }
  }

  public setProgressCallback(cb: (state: DownloadState) => void) {
    this.onProgressCallback = cb;
  }

  public getModelsDir(): string {
    return this.modelsDir;
  }

  public getDownloadState(): DownloadState {
    return { ...this.downloadState };
  }

  public cancelDownload(): boolean {
    if (!this.downloadState.active) {
      return false;
    }
    this.isCancelled = true;
    if (this.activeRequest) {
      try {
        this.activeRequest.destroy();
      } catch {
        // ignore
      }
      this.activeRequest = null;
    }
    if (this.activeResponse) {
      try {
        this.activeResponse.destroy();
      } catch {
        // ignore
      }
      this.activeResponse = null;
    }
    if (this.activeFileStream) {
      try {
        this.activeFileStream.close();
      } catch {
        // ignore
      }
      this.activeFileStream = null;
    }
    if (this.activeDestPath && fs.existsSync(this.activeDestPath)) {
      try {
        fs.unlinkSync(this.activeDestPath);
      } catch {
        // ignore
      }
      this.activeDestPath = null;
    }

    this.downloadState.active = false;
    this.downloadState.error = 'Download cancelled by user';
    this.notifyProgress();
    return true;
  }

  public deleteLocalModel(filenameOrPath: string): boolean {
    const filename = path.basename(filenameOrPath);
    if (!filename.toLowerCase().endsWith('.gguf')) {
      throw new Error('Only .gguf model files can be removed from storage.');
    }

    // Check in modelsDir
    const dest = path.join(this.modelsDir, filename);
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
      this.lastScanTimestamp = 0;
      return true;
    }

    // Check if absolute path was provided and exists
    if (fs.existsSync(filenameOrPath)) {
      const stat = fs.statSync(filenameOrPath);
      if (stat.isFile()) {
        fs.unlinkSync(filenameOrPath);
        this.lastScanTimestamp = 0;
        return true;
      }
    }

    return false;
  }

  public scanLocalModels(force: boolean = false): LocalModel[] {
    const now = Date.now();
    if (!force && this.cachedLocalModels.length > 0 && now - this.lastScanTimestamp < 3000) {
      return this.cachedLocalModels;
    }

    const list: LocalModel[] = [];
    const seen = new Set<string>();

    const scanDir = (dir: string, location: 'internal' | 'downloads' | 'custom') => {
      if (!fs.existsSync(dir)) return;
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.toLowerCase().endsWith('.gguf')) {
            const fullPath = path.join(dir, file);
            try {
              const real = fs.realpathSync(fullPath);
              if (seen.has(real)) continue;
              seen.add(real);

              const stat = fs.statSync(fullPath);
              if (stat.size < 1024 * 1024) continue; // Skip incomplete

              const sizeMb = stat.size / (1024 * 1024);
              const sizeFormatted = sizeMb > 1000 ? `${(sizeMb / 1024).toFixed(2)} GB` : `${sizeMb.toFixed(1)} MB`;

              list.push({
                id: file,
                name: file.replace('.gguf', ''),
                path: fullPath,
                sizeBytes: stat.size,
                sizeFormatted,
                location,
                lastModified: stat.mtimeMs,
              });
            } catch {
              // skip unreadable
            }
          }
        }
      } catch {
        // skip inaccessible dir
      }
    };

    scanDir(this.modelsDir, 'internal');

    const dlDirs = [
      '/sdcard/Download',
      '/sdcard/Downloads',
      '/storage/emulated/0/Download',
      path.join(os.homedir(), 'storage', 'downloads'),
      path.join(os.homedir(), 'storage', 'shared', 'Download'),
      path.join(os.homedir(), 'Downloads'),
    ];

    for (const d of dlDirs) {
      scanDir(d, 'downloads');
    }

    this.cachedLocalModels = list;
    this.lastScanTimestamp = now;
    return list;
  }

  public startDownload(presetOrUrl: { url: string; filename: string; id?: string }): DownloadState {
    if (this.downloadState.active) {
      throw new Error('A model download is already in progress.');
    }

    const { url, filename, id } = presetOrUrl;

    // Validate and sanitize filename to prevent path traversal
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!safeFilename || !safeFilename.toLowerCase().endsWith('.gguf')) {
      throw new Error('Invalid model filename. Must be a valid .gguf filename.');
    }

    const dest = path.join(this.modelsDir, safeFilename);
    const resolvedModelsDir = path.resolve(this.modelsDir);
    if (!path.resolve(dest).startsWith(resolvedModelsDir)) {
      throw new Error('Security violation: Destination path must reside within models directory.');
    }

    // SSRF validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('Invalid download URL format.');
    }

    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      throw new Error('Only HTTP and HTTPS download protocols are allowed.');
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      throw new Error('Restricted target: Cannot download from internal or loopback addresses.');
    }

    this.isCancelled = false;
    this.activeDestPath = dest;

    this.downloadState = {
      active: true,
      modelId: id || safeFilename,
      modelName: safeFilename,
      downloadedBytes: 0,
      totalBytes: 0,
      percent: 0,
      speedFormatted: '0 MB/s',
      etaSeconds: null,
      error: null,
    };

    this.notifyProgress();

    this.downloadFile(url, dest, 0)
      .then(() => {
        this.downloadState.active = false;
        this.downloadState.percent = 100;
        this.activeRequest = null;
        this.activeResponse = null;
        this.activeFileStream = null;
        this.activeDestPath = null;
        this.lastScanTimestamp = 0; // Invalidate cache so new model appears immediately
        this.notifyProgress();
      })
      .catch((err) => {
        this.activeRequest = null;
        this.activeResponse = null;
        this.activeFileStream = null;
        this.downloadState.active = false;
        if (!this.isCancelled) {
          this.downloadState.error = err.message || 'Download failed';
        }
        this.notifyProgress();
        if (this.activeDestPath && fs.existsSync(this.activeDestPath)) {
          try {
            fs.unlinkSync(this.activeDestPath);
          } catch {
            // ignore
          }
        }
        this.activeDestPath = null;
      });

    return this.getDownloadState();
  }

  private downloadFile(url: string, destPath: string, redirectCount: number = 0): Promise<void> {
    if (this.isCancelled) {
      return Promise.reject(new Error('Download cancelled by user.'));
    }

    if (redirectCount > 5) {
      return Promise.reject(new Error('Too many HTTP redirects (exceeded limit of 5).'));
    }

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const getter = parsedUrl.protocol === 'https:' ? https : http;

      const request = getter.get(
        url,
        {
          headers: {
            'User-Agent': 'LM-Studio-Android/1.0',
          },
        },
        (res) => {
          if (this.isCancelled) {
            res.destroy();
            return reject(new Error('Download cancelled by user.'));
          }

          this.activeResponse = res;

          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, url).toString();
            return this.downloadFile(redirectUrl, destPath, redirectCount + 1).then(resolve).catch(reject);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Server returned HTTP ${res.statusCode}`));
          }

          const totalHeader = res.headers['content-length'];
          const totalBytes = totalHeader ? parseInt(totalHeader, 10) : 0;
          this.downloadState.totalBytes = totalBytes;

          const fileStream = fs.createWriteStream(destPath);
          this.activeFileStream = fileStream;
          let downloaded = 0;
          let startTime = Date.now();
          let lastCheckTime = startTime;
          let lastDownloaded = 0;

          res.on('data', (chunk: Buffer) => {
            if (this.isCancelled) {
              res.destroy();
              fileStream.close();
              return;
            }

            downloaded += chunk.length;
            this.downloadState.downloadedBytes = downloaded;

            const now = Date.now();
            if (now - lastCheckTime >= 500) {
              const elapsedSec = (now - lastCheckTime) / 1000;
              const bytesDiff = downloaded - lastDownloaded;
              const speedBytesPerSec = bytesDiff / elapsedSec;
              const speedMb = speedBytesPerSec / (1024 * 1024);
              this.downloadState.speedFormatted = `${speedMb.toFixed(1)} MB/s`;

              if (totalBytes > 0) {
                this.downloadState.percent = Math.round((downloaded / totalBytes) * 1000) / 10;
                const remaining = totalBytes - downloaded;
                this.downloadState.etaSeconds = speedBytesPerSec > 0 ? Math.round(remaining / speedBytesPerSec) : null;
              }

              lastCheckTime = now;
              lastDownloaded = downloaded;
              this.notifyProgress();
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            this.activeFileStream = null;
            this.activeResponse = null;
            resolve();
          });

          fileStream.on('error', (err) => {
            this.activeFileStream = null;
            reject(err);
          });
        }
      );

      this.activeRequest = request;

      request.on('error', (err) => {
        if (!this.isCancelled) {
          reject(err);
        }
      });
    });
  }

  private notifyProgress() {
    if (this.onProgressCallback) {
      this.onProgressCallback(this.getDownloadState());
    }
  }
}

export const modelManager = new ModelManager();
