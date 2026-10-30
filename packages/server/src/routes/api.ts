import { Router, Request, Response } from 'express';
import http from 'http';
import os from 'os';
import { hardwareMonitor } from '../hardware/telemetry.js';
import { llamaEngine } from '../engine/llama.js';
import { modelManager, CURATED_MODELS } from '../hf/models.js';

export const apiRouter = Router();

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// System Status & Hardware Telemetry
apiRouter.get('/api/status', (req: Request, res: Response) => {
  const engineStatus = llamaEngine.getStatus();
  const telemetry = hardwareMonitor.getFullTelemetry(
    engineStatus.currentModel ? engineStatus.currentModel.sizeBytes : 0
  );

  res.json({
    engine: engineStatus,
    telemetry,
    ip: getLocalIp(),
    platform: os.platform(),
    isAndroid: hardwareMonitor['isAndroid'],
  });
});

// Local Models Scan
apiRouter.get('/api/models', (req: Request, res: Response) => {
  const models = modelManager.scanLocalModels();
  res.json(models);
});

// Curated HF Presets
apiRouter.get('/api/presets', (req: Request, res: Response) => {
  res.json(CURATED_MODELS);
});

// Load Model
apiRouter.post('/api/load', async (req: Request, res: Response) => {
  try {
    const { path: modelPath, threads, ctxSize, flashAttn, kvQuant, gpuLayers, pinCores } = req.body;
    if (!modelPath) {
      return res.status(400).json({ error: 'Missing model path' });
    }

    const localModels = modelManager.scanLocalModels();
    let target = localModels.find((m) => m.path === modelPath || m.id === modelPath);
    if (!target) {
      // Direct path fallback
      target = {
        id: modelPath.split(/[/\\]/).pop() || 'model.gguf',
        name: (modelPath.split(/[/\\]/).pop() || 'model').replace('.gguf', ''),
        path: modelPath,
        sizeBytes: 1024 * 1024 * 500,
        sizeFormatted: '500 MB',
        location: 'custom',
      };
    }

    const config = {
      threads: Number(threads) || 4,
      ctxSize: Number(ctxSize) || 2048,
      flashAttn: flashAttn !== false,
      kvQuant: kvQuant || 'f16',
      gpuLayers: Number(gpuLayers) || 0,
      pinCores: pinCores !== false,
    };

    const status = await llamaEngine.start(target, config);
    res.json({ success: true, status });
  } catch (err: any) {
    const errorMsg = err.message || 'Failed to start engine';
    const recentLogs = llamaEngine.getRecentLogs(30);
    res.status(500).json({
      error: errorMsg,
      details: recentLogs || errorMsg,
    });
  }
});

// Unload Model (Free RAM)
apiRouter.post('/api/unload', async (req: Request, res: Response) => {
  await llamaEngine.stop();
  res.json({ success: true, message: 'RAM freed and llama-server unloaded' });
});

// Update TPS metric
apiRouter.post('/api/metrics/tps', (req: Request, res: Response) => {
  const { tps } = req.body;
  if (typeof tps === 'number' && tps > 0) {
    llamaEngine.setLastRunTps(tps);
  }
  res.json({ success: true, lastRunTps: llamaEngine.getStatus().lastRunTps });
});

// Model Download
apiRouter.post('/api/download', (req: Request, res: Response) => {
  try {
    const { url, filename, id } = req.body;
    if (!url || !filename) {
      return res.status(400).json({ error: 'Missing url or filename' });
    }
    const state = modelManager.startDownload({ url, filename, id });
    res.json(state);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/api/download_status', (req: Request, res: Response) => {
  res.json(modelManager.getDownloadState());
});

// OpenAI Compatible Models Endpoint
apiRouter.get('/v1/models', (req: Request, res: Response) => {
  const status = llamaEngine.getStatus();
  const currentModel = status.currentModel?.name || 'none';
  res.json({
    object: 'list',
    data: [
      {
        id: currentModel,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'lm-studio-android',
      },
    ],
  });
});

// OpenAI Compatible Chat Completions Proxy
apiRouter.post(['/v1/chat/completions', '/v1/completions'], async (req: Request, res: Response) => {
  const status = llamaEngine.getStatus();
  if (!status.loaded) {
    return res.status(400).json({
      error: {
        message: 'No model loaded. Please load a model from the Models pane.',
        type: 'invalid_request_error',
      },
    });
  }

  const isStream = req.body.stream !== false;

  // Handle Mock Mode for developer testing without llama.cpp on PC
  if (llamaEngine.getIsMock()) {
    const prompt = req.body.messages?.[req.body.messages.length - 1]?.content || 'Hello!';
    const simulatedResponse = `⚡ **Running on LM Studio Android Engine**

I received your prompt:
> *"${prompt}"*

### Hardware Status
* **Engine**: Simulated ARM NEON DotProd Matrix Engine
* **Offload**: Vulkan Mobile Compute Kernel
* **Model**: \`${status.currentModel?.name}\`
* **Optimal Threads**: \`${status.activeConfig?.threads || 4}\` threads pinned

Here is a quick code benchmark example:
\`\`\`typescript
import { OpenAI } from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:8080/v1",
  apiKey: "not-needed"
});

const completion = await client.chat.completions.create({
  model: "${status.currentModel?.name}",
  messages: [{ role: "user", content: "Optimize mobile inference" }],
  stream: true,
});
\`\`\`

Everything is operating with sub-second Time-To-First-Token! How else can I assist with your edge AI workflow?`;

    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const words = simulatedResponse.split(' ');
      let wordIdx = 0;

      const interval = setInterval(() => {
        if (wordIdx >= words.length) {
          clearInterval(interval);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }

        const chunkText = (wordIdx === 0 ? '' : ' ') + words[wordIdx];
        llamaEngine.incrementTokens(1);
        wordIdx++;

        const chunkPayload = {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: status.currentModel?.name,
          choices: [
            {
              index: 0,
              delta: { content: chunkText },
              finish_reason: null,
            },
          ],
        };
        res.write(`data: ${JSON.stringify(chunkPayload)}\n\n`);
      }, 35);

      req.on('close', () => {
        clearInterval(interval);
      });
      return;
    } else {
      return res.json({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: status.currentModel?.name,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: simulatedResponse },
            finish_reason: 'stop',
          },
        ],
      });
    }
  }

  // Real llama-server proxy
  const targetUrl = new URL(llamaEngine.getLlamaUrl() + req.path);
  const proxyReq = http.request(
    targetUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    (proxyRes) => {
      res.status(proxyRes.statusCode || 200);
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (value) res.setHeader(key, value);
      }
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (isStream) {
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Accel-Buffering', 'no');

        let streamBuffer = '';
        proxyRes.on('data', (chunk: Buffer) => {
          res.write(chunk);
          streamBuffer += chunk.toString('utf8');
          const lines = streamBuffer.split('\n');
          streamBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  llamaEngine.incrementTokens(1);
                }
              } catch {
                // ignore
              }
            }
          }
        });

        proxyRes.on('end', () => {
          res.end();
        });
      } else {
        let fullBody = '';
        proxyRes.on('data', (chunk: Buffer) => {
          fullBody += chunk.toString('utf8');
        });
        proxyRes.on('end', () => {
          try {
            const parsed = JSON.parse(fullBody);
            if (parsed.usage?.completion_tokens) {
              llamaEngine.incrementTokens(parsed.usage.completion_tokens);
            }
          } catch {
            // ignore
          }
          res.send(fullBody);
        });
      }
    }
  );

  proxyReq.on('error', (err) => {
    res.status(502).json({
      error: {
        message: `Failed to proxy to internal llama-server: ${err.message}`,
        type: 'bad_gateway',
      },
    });
  });

  proxyReq.write(JSON.stringify(req.body));
  proxyReq.end();
});
