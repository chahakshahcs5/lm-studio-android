import { Router, Request, Response } from 'express';
import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { hardwareMonitor } from '../hardware/telemetry.js';
import { llamaEngine } from '../engine/llama.js';
import { LocalModel } from '@lm-studio-android/shared';
import { modelManager, CURATED_MODELS } from '../hf/models.js';
import { searchHfHub, getHfModelFiles, getHfModelDetails } from '../hf/hub.js';
import { getLocalIp } from '../utils/network.js';
import { fileDb } from '../db/fileDb.js';

export const apiRouter = Router();

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
    isAndroid: hardwareMonitor.getIsAndroid(),
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
    if (!modelPath || typeof modelPath !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid model path' });
    }

    const localModels = modelManager.scanLocalModels();
    let target = localModels.find((m) => m.path === modelPath || m.id === modelPath);
    if (!target) {
      if (!fs.existsSync(modelPath)) {
        return res.status(404).json({ error: `Model file not found at: ${modelPath}` });
      }
      if (!modelPath.toLowerCase().endsWith('.gguf')) {
        return res.status(400).json({ error: 'Only .gguf model files can be mounted' });
      }

      const stat = fs.statSync(modelPath);
      if (!stat.isFile()) {
        return res.status(400).json({ error: 'Specified path is a directory, not a file' });
      }

      const sizeMb = stat.size / (1024 * 1024);
      const sizeFormatted = sizeMb > 1000 ? `${(sizeMb / 1024).toFixed(2)} GB` : `${sizeMb.toFixed(1)} MB`;

      target = {
        id: path.basename(modelPath),
        name: path.basename(modelPath).replace('.gguf', ''),
        path: modelPath,
        sizeBytes: stat.size,
        sizeFormatted,
        location: 'custom',
        lastModified: stat.mtimeMs,
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
  try {
    await llamaEngine.stop();
    res.json({ success: true, message: 'RAM freed and llama-server unloaded' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to stop engine' });
  }
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

apiRouter.post('/api/download/cancel', (req: Request, res: Response) => {
  const cancelled = modelManager.cancelDownload();
  res.json({ success: cancelled, state: modelManager.getDownloadState() });
});

apiRouter.get('/api/download_status', (req: Request, res: Response) => {
  res.json(modelManager.getDownloadState());
});

// Delete Local Model from Storage
apiRouter.delete('/api/models/:filename', (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    const currentModel = llamaEngine.getStatus().currentModel;
    if (llamaEngine.getStatus().loaded && currentModel) {
      if (
        currentModel.id === filename ||
        currentModel.name === filename ||
        currentModel.path.includes(filename)
      ) {
        return res
          .status(400)
          .json({ error: 'Cannot delete actively mounted model. Please unload it first.' });
      }
    }
    const success = modelManager.deleteLocalModel(filename);
    if (!success) {
      return res.status(404).json({ error: `Model "${filename}" not found in local storage.` });
    }
    res.json({ success: true, message: `Model "${filename}" removed from device storage.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete model file' });
  }
});

// Hugging Face Hub Search & Discovery
apiRouter.get('/api/hf/search', async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const sort = typeof req.query.sort === 'string' ? (req.query.sort as any) : 'downloads';
    const category = typeof req.query.category === 'string' ? (req.query.category as any) : 'all';
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 30;

    const models = await searchHfHub({ query, sort, category, limit });
    res.json({ success: true, data: models });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to search Hugging Face Hub' });
  }
});

// Hugging Face Model Files (GGUF list)
apiRouter.get('/api/hf/files', async (req: Request, res: Response) => {
  try {
    const repo = typeof req.query.repo === 'string' ? req.query.repo : '';
    if (!repo) {
      return res.status(400).json({ error: 'Missing required "repo" query parameter (e.g. author/repo-name)' });
    }
    const files = await getHfModelFiles(repo);
    res.json({ success: true, data: files });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list repository files' });
  }
});

// Hugging Face Model Card & Details
apiRouter.get('/api/hf/model', async (req: Request, res: Response) => {
  try {
    const repo = typeof req.query.repo === 'string' ? req.query.repo : '';
    if (!repo) {
      return res.status(400).json({ error: 'Missing required "repo" query parameter' });
    }
    const details = await getHfModelDetails(repo);
    res.json({ success: true, data: details });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get model details' });
  }
});

// ============================================================================
// OpenAI Compatible API Suite (/v1)
// ============================================================================

// Explicit CORS preflight for all /v1 endpoints
apiRouter.options('/v1/*', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.sendStatus(204);
});

// OpenAI Base URL Service Discovery & Health Probe
apiRouter.get(['/v1', '/v1/'], (req: Request, res: Response) => {
  const status = llamaEngine.getStatus();
  const localModels = modelManager.scanLocalModels();
  const host = req.headers.host || '127.0.0.1:8080';
  res.json({
    status: 'online',
    service: 'LM Studio Android OpenAI-Compatible Inference Server',
    version: '1.0.0',
    model_loaded: status.loaded,
    active_model: status.currentModel?.name || null,
    available_models: localModels.map((m) => m.name),
    endpoints: {
      models: `http://${host}/v1/models`,
      chat_completions: `http://${host}/v1/chat/completions`,
      completions: `http://${host}/v1/completions`,
      embeddings: `http://${host}/v1/embeddings`,
    },
    sample_usage: {
      curl: `curl http://${host}/v1/chat/completions -H "Content-Type: application/json" -d '{"model": "${status.currentModel?.name || (localModels[0]?.name || 'default')}", "messages": [{"role": "user", "content": "Hello!"}]}'`,
      python: `from openai import OpenAI\nclient = OpenAI(base_url="http://${host}/v1", api_key="not-needed")\nresp = client.chat.completions.create(model="${status.currentModel?.name || (localModels[0]?.name || 'default')}", messages=[{"role": "user", "content": "Hello!"}])`,
    },
  });
});

// OpenAI Compatible Models Endpoint
apiRouter.get(['/v1/models', '/v1/models/'], (req: Request, res: Response) => {
  const status = llamaEngine.getStatus();
  const localModels = modelManager.scanLocalModels();

  const modelList: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
    active?: boolean;
    size?: string;
  }> = [];

  // Active loaded model always at top
  if (status.loaded && status.currentModel) {
    modelList.push({
      id: status.currentModel.name,
      object: 'model',
      created: Math.floor((status.currentModel.lastModified || Date.now()) / 1000),
      owned_by: 'lm-studio-android',
      active: true,
      size: status.currentModel.sizeFormatted,
    });
  }

  // Include all other available local models
  for (const m of localModels) {
    if (!modelList.some((existing) => existing.id === m.name)) {
      modelList.push({
        id: m.name,
        object: 'model',
        created: Math.floor((m.lastModified || Date.now()) / 1000),
        owned_by: 'lm-studio-android',
        active: false,
        size: m.sizeFormatted,
      });
    }
  }

  // Fallback descriptor if no models are installed yet
  if (modelList.length === 0) {
    modelList.push({
      id: 'default',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'lm-studio-android',
    });
  }

  res.json({
    object: 'list',
    data: modelList,
  });
});

// Single model retrieval
apiRouter.get('/v1/models/:modelId', (req: Request, res: Response) => {
  const { modelId } = req.params;
  const status = llamaEngine.getStatus();
  const localModels = modelManager.scanLocalModels();
  const match = localModels.find((m) => m.name === modelId || m.id === modelId || m.path.includes(modelId));

  res.json({
    id: match ? match.name : modelId,
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'lm-studio-android',
    active: status.loaded && status.currentModel?.name === (match ? match.name : modelId),
  });
});

// OpenAI Compatible Embeddings Endpoint
apiRouter.post('/v1/embeddings', async (req: Request, res: Response) => {
  const status = llamaEngine.getStatus();
  if (!status.loaded) {
    return res.status(400).json({
      error: {
        message: 'No model loaded. Please load a model from the Models pane.',
        type: 'invalid_request_error',
      },
    });
  }

  if (llamaEngine.getIsMock()) {
    const input = Array.isArray(req.body.input) ? req.body.input : [req.body.input || ''];
    return res.json({
      object: 'list',
      data: input.map((_: any, idx: number) => ({
        object: 'embedding',
        index: idx,
        embedding: Array.from({ length: 64 }, () => Math.random() * 2 - 1),
      })),
      model: status.currentModel?.name || 'mock-embedding',
      usage: { prompt_tokens: 16, total_tokens: 16 },
    });
  }

  const targetUrl = new URL(llamaEngine.getLlamaUrl() + '/v1/embeddings');
  const proxyReq = http.request(
    targetUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    (proxyRes) => {
      res.status(proxyRes.statusCode || 200);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('error', (err) => {
    res.status(502).json({
      error: { message: `Embedding error: ${err.message}`, type: 'bad_gateway' },
    });
  });
  proxyReq.write(JSON.stringify(req.body));
  proxyReq.end();
});

// OpenAI Compatible Chat Completions Proxy
apiRouter.post(['/v1/chat/completions', '/v1/completions'], async (req: Request, res: Response) => {
  let status = llamaEngine.getStatus();

  // If engine is not running, attempt on-demand auto-mount of the requested model or first local model
  if (!status.loaded) {
    const localModels = modelManager.scanLocalModels();
    const targetModel = findMatchingModel(req.body?.model, localModels);

    if (targetModel) {
      console.log(`[API] Auto-mounting model '${targetModel.name}' on-demand for incoming OpenAI API request...`);
      try {
        const cpuTopo = hardwareMonitor.detectCpuTopology();
        const threads = cpuTopo.recommendedThreads || 4;
        status = await llamaEngine.start(targetModel, {
          threads,
          ctxSize: 2048,
          flashAttn: true,
          kvQuant: 'f16',
          gpuLayers: 0,
          pinCores: true,
        });
      } catch (loadErr: any) {
        return res.status(500).json({
          error: {
            message: `Failed to auto-mount requested model '${targetModel.name}': ${loadErr.message}`,
            type: 'internal_error',
            code: 'auto_mount_failed',
          },
        });
      }
    } else {
      return res.status(400).json({
        error: {
          message: 'No model loaded and no local .gguf models found on device storage. Please download a model from the Models pane.',
          type: 'invalid_request_error',
          code: 'no_models_available',
        },
      });
    }
  }

  const isStream = req.body.stream === true;

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
          const estPromptTokens = Math.max(12, Math.round(prompt.length / 3.8));
          const estCachedTokens = Math.round(estPromptTokens * 0.65);
          const usagePayload = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: status.currentModel?.name,
            choices: [],
            usage: {
              prompt_tokens: estPromptTokens,
              completion_tokens: words.length,
              total_tokens: estPromptTokens + words.length,
              prompt_tokens_details: {
                cached_tokens: estCachedTokens,
              },
            },
            timings: {
              prompt_n: estPromptTokens,
              prompt_ms: 32,
              prompt_per_second: 375.0,
              predicted_n: words.length,
              predicted_ms: words.length * 35,
              predicted_per_second: 28.5,
              cache_n: estCachedTokens,
            },
          };
          res.write(`data: ${JSON.stringify(usagePayload)}\n\n`);
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
      const estPromptTokens = Math.max(12, Math.round(prompt.length / 3.8));
      const estCachedTokens = Math.round(estPromptTokens * 0.65);
      const completionTokens = simulatedResponse.split(' ').length;
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
        usage: {
          prompt_tokens: estPromptTokens,
          completion_tokens: completionTokens,
          total_tokens: estPromptTokens + completionTokens,
          prompt_tokens_details: {
            cached_tokens: estCachedTokens,
          },
        },
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

// ============================================================================
// Ollama Compatible API Suite (/api/chat, /api/generate, /api/tags, /api/version, /api/show)
// ============================================================================

/**
 * Dynamically extract model metadata (family, parameter size, quantization, template, stop tokens)
 * from model name, filename, and size without hardcoding any specific model family.
 */
function extractModelMetadata(modelNameOrPath: string, sizeBytes?: number) {
  const cleanName = path.basename(modelNameOrPath).replace(/\.gguf$/i, '');
  const lower = cleanName.toLowerCase();

  // 1. Detect architecture / family dynamically
  let family = 'llama';
  if (lower.includes('qwen')) {
    family = 'qwen2';
  } else if (lower.includes('deepseek')) {
    family = 'deepseek';
  } else if (lower.includes('gemma')) {
    family = 'gemma2';
  } else if (lower.includes('mistral') || lower.includes('mixtral')) {
    family = 'mistral';
  } else if (lower.includes('phi')) {
    family = 'phi3';
  } else if (lower.includes('starcoder')) {
    family = 'starcoder2';
  } else if (lower.includes('smollm')) {
    family = 'smollm';
  } else if (lower.includes('command-r') || lower.includes('command_r')) {
    family = 'command-r';
  } else if (lower.includes('falcon')) {
    family = 'falcon';
  } else if (lower.includes('internlm')) {
    family = 'internlm2';
  } else if (lower.includes('yi')) {
    family = 'yi';
  } else if (lower.includes('baichuan')) {
    family = 'baichuan';
  } else if (lower.includes('bert') || lower.includes('nomic') || lower.includes('minilm')) {
    family = 'bert';
  }

  // 2. Detect parameter size (e.g. 0.5B, 1.5B, 1B, 2B, 3B, 4B, 7B, 8B, 9B, 14B, 27B, 32B, 70B, 360M, 135M)
  let parameterSize = 'Unknown';
  const paramMatch = lower.match(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*([bm])(?:[^a-z0-9]|$)/i);
  if (paramMatch) {
    parameterSize = `${paramMatch[1]}${paramMatch[2].toUpperCase()}`;
  } else if (lower.includes('mini')) {
    parameterSize = '3.8B';
  } else if (sizeBytes && sizeBytes > 0) {
    const sizeGb = sizeBytes / (1024 * 1024 * 1024);
    if (sizeGb < 0.6) {
      parameterSize = '<1B';
    } else if (sizeGb < 1.4) {
      parameterSize = '1B';
    } else if (sizeGb < 2.5) {
      parameterSize = '2B-3B';
    } else if (sizeGb < 5.0) {
      parameterSize = '7B-8B';
    } else if (sizeGb < 9.0) {
      parameterSize = '14B';
    } else {
      parameterSize = `${Math.round(sizeGb * 1.5)}B`;
    }
  }

  // 3. Detect quantization level (e.g., Q4_K_M, Q5_K_S, Q8_0, IQ4_XS, F16, BF16)
  let quantizationLevel = 'Q4_K_M';
  const quantMatch = cleanName.match(/(Q[0-9]+_[A-Z0-9_]+|IQ[0-9]+_[A-Z0-9_]+|F16|F32|BF16)/i);
  if (quantMatch) {
    quantizationLevel = quantMatch[1].toUpperCase();
  }

  // 4. Construct appropriate template & stop tokens based on detected family
  let template = '{{ if .System }}{{ .System }}\n{{ end }}{{ .Prompt }}\n';
  let stopTokens = ['<|end|>'];

  switch (family) {
    case 'qwen2':
      template = '{{ if .System }}<|im_start|>system\n{{ .System }}<|im_end|>\n{{ end }}<|im_start|>user\n{{ .Prompt }}<|im_end|>\n<|im_start|>assistant\n';
      stopTokens = ['<|im_end|>', '<|endoftext|>'];
      break;
    case 'llama':
      template = '{{ if .System }}<|start_header_id|>system<|end_header_id|>\n\n{{ .System }}<|eot_id|>{{ end }}<|start_header_id|>user<|end_header_id|>\n\n{{ .Prompt }}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n';
      stopTokens = ['<|eot_id|>', '<|end_of_text|>'];
      break;
    case 'gemma2':
      template = '{{ if .System }}<start_of_turn>system\n{{ .System }}<end_of_turn>\n{{ end }}<start_of_turn>user\n{{ .Prompt }}<end_of_turn>\n<start_of_turn>model\n';
      stopTokens = ['<end_of_turn>', '<eos>'];
      break;
    case 'mistral':
      template = '{{ if .System }}[INST] {{ .System }}\n\n{{ .Prompt }} [/INST]{{ else }}[INST] {{ .Prompt }} [/INST]{{ end }}';
      stopTokens = ['</s>', '[/INST]'];
      break;
    case 'phi3':
      template = '{{ if .System }}<|system|>\n{{ .System }}<|end|>\n{{ end }}<|user|>\n{{ .Prompt }}<|end|>\n<|assistant|>\n';
      stopTokens = ['<|end|>', '<|endoftext|>'];
      break;
    case 'deepseek':
      template = '{{ if .System }}<|System|>{{ .System }}<|User|>{{ .Prompt }}<|Assistant|>{{ else }}<|User|>{{ .Prompt }}<|Assistant|>{{ end }}';
      stopTokens = ['<｜end of sentence｜>', '<|EOT|>'];
      break;
    default:
      template = '{{ if .System }}{{ .System }}\n{{ end }}{{ .Prompt }}\n';
      stopTokens = ['<|end|>'];
      break;
  }

  return {
    family,
    parameterSize,
    quantizationLevel,
    template,
    stopTokens,
  };
}

/**
 * Dynamically find the matching model among local scanned models
 */
function findMatchingModel(query: string | undefined, localModels: LocalModel[]): LocalModel | undefined {
  if (!query) return localModels[0];
  const clean = query.replace(/:latest$/, '').toLowerCase().trim();
  // 1. Exact match by name or id
  const exact = localModels.find(
    (m) => m.name.toLowerCase() === clean || m.id.toLowerCase() === clean
  );
  if (exact) return exact;

  // 2. Exact match by basename without .gguf
  const exactBase = localModels.find(
    (m) => path.basename(m.path).toLowerCase().replace(/\.gguf$/i, '') === clean
  );
  if (exactBase) return exactBase;

  // 3. Substring match
  const substring = localModels.find(
    (m) =>
      m.name.toLowerCase().includes(clean) ||
      m.id.toLowerCase().includes(clean) ||
      m.path.toLowerCase().includes(clean)
  );
  if (substring) return substring;

  // 4. Default fallback to first model
  return localModels[0];
}

// Ollama Version
apiRouter.get(['/api/version', '/api/version/'], (req: Request, res: Response) => {
  res.json({ version: '0.5.4' });
});

// Ollama Model Listing (/api/tags)
apiRouter.get(['/api/tags', '/api/tags/'], (req: Request, res: Response) => {
  const status = llamaEngine.getStatus();
  const localModels = modelManager.scanLocalModels();

  const models: any[] = [];
  for (const m of localModels) {
    const sizeBytes = m.sizeBytes || 1024 * 1024 * 1024;
    const meta = extractModelMetadata(m.name || m.path, sizeBytes);
    const modelObj = {
      name: `${m.name}:latest`,
      model: `${m.name}:latest`,
      modified_at: new Date(m.lastModified || Date.now()).toISOString(),
      size: sizeBytes,
      digest: `sha256:${Buffer.from(m.name).toString('hex').padEnd(64, '0').slice(0, 64)}`,
      details: {
        parent_model: '',
        format: 'gguf',
        family: meta.family,
        families: [meta.family],
        parameter_size: meta.parameterSize,
        quantization_level: meta.quantizationLevel,
      },
    };
    models.push(modelObj);
    models.push({
      ...modelObj,
      name: m.name,
      model: m.name,
    });
  }

  if (models.length === 0) {
    const meta = extractModelMetadata('default', 1024 * 1024 * 1024);
    models.push({
      name: 'default:latest',
      model: 'default:latest',
      modified_at: new Date().toISOString(),
      size: 1024 * 1024 * 1024,
      digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      details: {
        format: 'gguf',
        family: meta.family,
        parameter_size: meta.parameterSize,
        quantization_level: meta.quantizationLevel,
      },
    });
  }

  res.json({ models });
});

// Ollama Model Info (/api/show)
apiRouter.post(['/api/show', '/api/show/'], (req: Request, res: Response) => {
  const modelName = (req.body?.model || req.body?.name || 'default').replace(/:latest$/, '');
  const localModels = modelManager.scanLocalModels();
  const matched = findMatchingModel(modelName, localModels);

  const meta = extractModelMetadata(matched?.name || modelName, matched?.sizeBytes);
  const stopParam = meta.stopTokens.map((t) => `stop "${t}"`).join('\n');

  res.json({
    modelfile: `# Modelfile for ${modelName}\nFROM ${modelName}\nTEMPLATE """${meta.template}"""\n${stopParam}`,
    parameters: stopParam,
    template: meta.template,
    details: {
      parent_model: '',
      format: 'gguf',
      family: meta.family,
      families: [meta.family],
      parameter_size: meta.parameterSize,
      quantization_level: meta.quantizationLevel,
    },
  });
});

// Ollama Chat Completions (/api/chat)
apiRouter.post(['/api/chat', '/api/chat/'], async (req: Request, res: Response) => {
  let status = llamaEngine.getStatus();

  // On-demand auto-mounting if no model loaded
  if (!status.loaded) {
    const localModels = modelManager.scanLocalModels();
    const targetModel = findMatchingModel(req.body?.model, localModels);

    if (targetModel) {
      console.log(`[Ollama API] Auto-mounting model '${targetModel.name}' on-demand for /api/chat...`);
      try {
        const cpuTopo = hardwareMonitor.detectCpuTopology();
        const threads = cpuTopo.recommendedThreads || 4;
        status = await llamaEngine.start(targetModel, {
          threads,
          ctxSize: 2048,
          flashAttn: true,
          kvQuant: 'f16',
          gpuLayers: 0,
          pinCores: true,
        });
      } catch (loadErr: any) {
        return res.status(500).json({ error: `Auto-mount failed: ${loadErr.message}` });
      }
    } else {
      return res.status(400).json({ error: 'No GGUF models found on device storage' });
    }
  }

  const activeModelName = status.currentModel?.name || req.body?.model || 'local-model';
  const isStream = req.body.stream !== false; // Ollama default is stream: true

  // Handle Mock Mode
  if (llamaEngine.getIsMock()) {
    const prompt = req.body.messages?.[req.body.messages.length - 1]?.content || 'Hello!';
    const simulatedResponse = `⚡ **LM Studio Android Engine (Ollama)**\n\nPrompt: "${prompt}"\n\nGenerated efficiently on mobile ARM hardware!`;
    const words = simulatedResponse.split(' ');

    if (isStream) {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      let wordIdx = 0;
      const interval = setInterval(() => {
        if (wordIdx >= words.length) {
          clearInterval(interval);
          res.write(
            JSON.stringify({
              model: activeModelName,
              created_at: new Date().toISOString(),
              message: { role: 'assistant', content: '' },
              done: true,
              total_duration: 1200000000,
              load_duration: 100000000,
              prompt_eval_count: Math.round(prompt.length / 4) + 10,
              prompt_eval_duration: 350000000,
              eval_count: words.length,
              eval_duration: 750000000,
            }) + '\n'
          );
          res.end();
          return;
        }
        const chunkText = (wordIdx === 0 ? '' : ' ') + words[wordIdx];
        llamaEngine.incrementTokens(1);
        wordIdx++;
        res.write(
          JSON.stringify({
            model: activeModelName,
            created_at: new Date().toISOString(),
            message: { role: 'assistant', content: chunkText },
            done: false,
          }) + '\n'
        );
      }, 35);
      req.on('close', () => clearInterval(interval));
      return;
    } else {
      return res.json({
        model: activeModelName,
        created_at: new Date().toISOString(),
        message: { role: 'assistant', content: simulatedResponse },
        done: true,
        total_duration: 1200000000,
        prompt_eval_count: Math.round(prompt.length / 4) + 10,
        eval_count: words.length,
      });
    }
  }

  // Real llama-server proxy via /v1/chat/completions translation
  const openAiPayload = {
    model: activeModelName,
    messages: req.body.messages || [],
    temperature: req.body.options?.temperature ?? 0.7,
    top_p: req.body.options?.top_p ?? 0.9,
    top_k: req.body.options?.top_k,
    max_tokens: req.body.options?.num_predict,
    stream: isStream,
    stream_options: { include_usage: true },
  };

  const targetUrl = new URL(llamaEngine.getLlamaUrl() + '/v1/chat/completions');
  const proxyReq = http.request(
    targetUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    (proxyRes) => {
      if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
        res.status(proxyRes.statusCode);
        proxyRes.pipe(res);
        return;
      }

      if (isStream) {
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        let streamBuffer = '';
        let promptTokens = 0;
        let completionTokens = 0;
        const startTime = Date.now();

        proxyRes.on('data', (chunk: Buffer) => {
          streamBuffer += chunk.toString('utf8');
          const lines = streamBuffer.split('\n');
          streamBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            if (trimmed === 'data: [DONE]') {
              const totalDurationNs = (Date.now() - startTime) * 1000000;
              res.write(
                JSON.stringify({
                  model: activeModelName,
                  created_at: new Date().toISOString(),
                  message: { role: 'assistant', content: '' },
                  done: true,
                  total_duration: totalDurationNs,
                  prompt_eval_count: promptTokens,
                  eval_count: completionTokens,
                }) + '\n'
              );
              res.end();
              return;
            }

            try {
              const parsed = JSON.parse(trimmed.slice(6));
              if (parsed.usage) {
                if (parsed.usage.prompt_tokens) promptTokens = parsed.usage.prompt_tokens;
                if (parsed.usage.completion_tokens) completionTokens = parsed.usage.completion_tokens;
              }
              const deltaContent = parsed.choices?.[0]?.delta?.content;
              if (deltaContent) {
                completionTokens++;
                llamaEngine.incrementTokens(1);
                res.write(
                  JSON.stringify({
                    model: activeModelName,
                    created_at: new Date().toISOString(),
                    message: { role: 'assistant', content: deltaContent },
                    done: false,
                  }) + '\n'
                );
              }
            } catch {}
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
            const content = parsed.choices?.[0]?.message?.content || '';
            res.json({
              model: activeModelName,
              created_at: new Date().toISOString(),
              message: { role: 'assistant', content },
              done: true,
              total_duration: 1000000000,
              prompt_eval_count: parsed.usage?.prompt_tokens,
              eval_count: parsed.usage?.completion_tokens,
            });
          } catch {
            res.status(500).json({ error: 'Failed to parse engine completion' });
          }
        });
      }
    }
  );

  proxyReq.on('error', (err) => {
    res.status(502).json({ error: `Engine proxy error: ${err.message}` });
  });

  proxyReq.write(JSON.stringify(openAiPayload));
  proxyReq.end();
});

// Ollama Raw Prompt Generate (/api/generate)
apiRouter.post(['/api/generate', '/api/generate/'], async (req: Request, res: Response) => {
  const prompt = req.body?.prompt || '';
  req.body.messages = [{ role: 'user', content: prompt }];
  // Forward to /api/chat
  return (apiRouter as any).handle(req, res);
});

// Proxy tokenize & server properties
apiRouter.all(['/tokenize', '/detokenize', '/props', '/slots'], async (req: Request, res: Response) => {
  const status = llamaEngine.getStatus();
  if (!status.loaded || llamaEngine.getIsMock()) {
    if (req.path === '/tokenize') {
      const text = req.body?.content || '';
      const estimated = Math.max(1, Math.ceil(text.length / 3.8));
      return res.json({ tokens: Array.from({ length: estimated }, (_, i) => i + 1) });
    }
    return res.status(503).json({ error: 'Engine not active' });
  }

  const targetUrl = new URL(llamaEngine.getLlamaUrl() + req.path);
  const proxyReq = http.request(
    targetUrl,
    {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
    },
    (proxyRes) => {
      res.status(proxyRes.statusCode || 200);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('error', (err) => {
    res.status(502).json({ error: err.message });
  });
  if (req.method === 'POST' || req.method === 'PUT') {
    proxyReq.write(JSON.stringify(req.body));
  }
  proxyReq.end();
});

// ============================================================================
// Local File DB - Conversations API
// ============================================================================

// List conversations
apiRouter.get('/api/conversations', (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q : undefined;
  const list = fileDb.listConversations(query);
  res.json({ success: true, data: list });
});

// Export all conversations backup
apiRouter.get('/api/conversations/export/all', (req: Request, res: Response) => {
  const all = fileDb.exportAllConversations();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="lm-studio-conversations-backup-${Date.now()}.json"`
  );
  res.json(all);
});

// Import conversations backup
apiRouter.post('/api/conversations/import', (req: Request, res: Response) => {
  const items = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Body must be an array of conversations' });
  }
  const result = fileDb.importConversations(items);
  res.json({ success: true, ...result });
});

// Clear all conversations
apiRouter.delete('/api/conversations', (req: Request, res: Response) => {
  const success = fileDb.clearAllConversations();
  res.json({ success });
});

// Create conversation
apiRouter.post('/api/conversations', (req: Request, res: Response) => {
  try {
    const conv = fileDb.createConversation(req.body);
    res.json({ success: true, data: conv });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single conversation
apiRouter.get('/api/conversations/:id', (req: Request, res: Response) => {
  const conv = fileDb.getConversation(req.params.id);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  res.json({ success: true, data: conv });
});

// Update conversation (title, messages, persona, params, pinned)
apiRouter.put('/api/conversations/:id', (req: Request, res: Response) => {
  const updated = fileDb.updateConversation(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  res.json({ success: true, data: updated });
});

// Delete single conversation
apiRouter.delete('/api/conversations/:id', (req: Request, res: Response) => {
  const success = fileDb.deleteConversation(req.params.id);
  res.json({ success });
});

// Export single conversation as Markdown or JSON
apiRouter.get('/api/conversations/:id/export', (req: Request, res: Response) => {
  const format = req.query.format === 'json' ? 'json' : 'md';
  const conv = fileDb.getConversation(req.params.id);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const safeTitle = (conv.title || 'conversation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30);

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.json"`);
    return res.json(conv);
  }

  const md = fileDb.exportConversationMarkdown(req.params.id);
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.md"`);
  res.send(md);
});

// ============================================================================
// Custom Personas / System Prompts API
// ============================================================================

apiRouter.get('/api/personas', (req: Request, res: Response) => {
  const personas = fileDb.listPersonas();
  res.json({ success: true, data: personas });
});

apiRouter.post('/api/personas', (req: Request, res: Response) => {
  try {
    const { name, description, content, id } = req.body;
    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }
    const saved = fileDb.savePersona({ id, name, description: description || '', content });
    res.json({ success: true, data: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/api/personas/:id', (req: Request, res: Response) => {
  const success = fileDb.deletePersona(req.params.id);
  if (!success) {
    return res.status(400).json({ error: 'Cannot delete built-in persona or persona not found' });
  }
  res.json({ success: true });
});

// ============================================================================
// Parameter Presets API
// ============================================================================

apiRouter.get('/api/presets/params', (req: Request, res: Response) => {
  const presets = fileDb.listPresets();
  res.json({ success: true, data: presets });
});

apiRouter.post('/api/presets/params', (req: Request, res: Response) => {
  try {
    const { name, description, params, id } = req.body;
    if (!name || !params) {
      return res.status(400).json({ error: 'Name and params are required' });
    }
    const saved = fileDb.savePreset({ id, name, description: description || '', params });
    res.json({ success: true, data: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/api/presets/params/:id', (req: Request, res: Response) => {
  const success = fileDb.deletePreset(req.params.id);
  if (!success) {
    return res.status(400).json({ error: 'Cannot delete built-in preset or preset not found' });
  }
  res.json({ success: true });
});
