import { Router, Request, Response } from 'express';
import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { hardwareMonitor } from '../hardware/telemetry.js';
import { llamaEngine } from '../engine/llama.js';
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

// OpenAI Compatible Models Endpoint
apiRouter.get('/v1/models', (req: Request, res: Response) => {
  const status = llamaEngine.getStatus();
  const currentModel = status.currentModel?.name;
  res.json({
    object: 'list',
    data: status.loaded && currentModel
      ? [
          {
            id: currentModel,
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'lm-studio-android',
          },
        ]
      : [],
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
