import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { apiRouter } from './routes/api.js';
import { hardwareMonitor } from './hardware/telemetry.js';
import { llamaEngine } from './engine/llama.js';
import { modelManager } from './hf/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '8080', 10);
const app = express();
const server = http.createServer(app);

// Enable CORS and JSON body parser
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Mount API routes
app.use(apiRouter);

// Serve static frontend assets if built
const webDistPath = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(webDistPath)) {
  console.log(`[Server] Serving compiled web UI from: ${webDistPath}`);
  app.use(express.static(webDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/v1')) {
      return next();
    }
    res.sendFile(path.join(webDistPath, 'index.html'));
  });
} else {
  console.log('[Server] Note: Web frontend not built yet. Run "npm run build:web" or use Vite dev server.');
}

// Setup WebSocket Server for Live Telemetry
const wss = new WebSocketServer({ server, path: '/ws' });
const connectedClients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  connectedClients.add(ws);

  // Send immediate initial telemetry
  const status = llamaEngine.getStatus();
  const initial = hardwareMonitor.getFullTelemetry(
    status.currentModel ? status.currentModel.sizeBytes : 0
  );
  ws.send(JSON.stringify({ type: 'telemetry', data: initial }));
  ws.send(JSON.stringify({ type: 'engine_status', data: status }));

  ws.on('close', () => {
    connectedClients.delete(ws);
  });
});

// Broadcast model download progress
modelManager.setProgressCallback((state) => {
  const msg = JSON.stringify({ type: 'download_progress', data: state });
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
});

// Periodic Telemetry Broadcast (1Hz)
setInterval(() => {
  if (connectedClients.size === 0) return;

  const status = llamaEngine.getStatus();
  const telemetry = hardwareMonitor.getFullTelemetry(
    status.currentModel ? status.currentModel.sizeBytes : 0
  );

  const payload = JSON.stringify({ type: 'telemetry', data: telemetry });
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}, 1000);

// Graceful cleanup
const cleanup = async () => {
  console.log('\n[Server] Shutting down gracefully...');
  await llamaEngine.stop();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(65));
  console.log('   ⚡ LM STUDIO ANDROID - EDGE AI ACCELERATOR SERVER');
  console.log('='.repeat(65));
  console.log(`[*] Local Studio Web UI : http://localhost:${PORT}`);
  console.log(`[*] OpenAI API Base     : http://localhost:${PORT}/v1`);
  console.log(`[*] Hardware Telemetry  : ws://localhost:${PORT}/ws`);
  console.log(`[*] CPU Architecture    : ${hardwareMonitor.detectCpuTopology().socModel}`);
  console.log('='.repeat(65));
});
