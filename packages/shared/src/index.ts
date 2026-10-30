// ============================================================================
// LM Studio Android - Shared Types & Interfaces
// ============================================================================

export interface BatteryTelemetry {
  level: number | null; // 0 - 100
  temperature: number | null; // Celsius
  isCharging: boolean | null;
  health?: string;
  voltage?: number; // mV
  source?: 'sysfs' | 'termux-api' | 'thermal_zone' | 'estimated';
  sensorLabel?: string;
}

export interface CpuTopology {
  totalCores: number;
  bigCores: number[];
  littleCores: number[];
  recommendedThreads: number;
  affinityMask?: string;
  socModel?: string;
  deviceModel?: string;
  architecture?: string;
  overallCpuUsage?: number; // 0 - 100%
  coreUsages?: number[]; // [12, 45, 80, ...]
}

export interface RamTelemetry {
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
  modelAllocatedBytes?: number;
  percentUsed: number;
}

export interface HardwareTelemetry {
  battery: BatteryTelemetry;
  cpu: CpuTopology;
  ram: RamTelemetry;
  isThrottled?: boolean;
  timestamp: number;
}

// Model Information
export interface LocalModel {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
  sizeFormatted: string;
  quantization?: string;
  location: 'internal' | 'downloads' | 'custom';
  lastModified?: number;
}

export interface HfModelPreset {
  id: string;
  repo: string;
  filename: string;
  name: string;
  params: string; // e.g. "1.1B", "3B"
  quantization: string; // e.g. "Q4_K_M"
  sizeBytes: number;
  sizeFormatted: string;
  minRamGb: number;
  recommended: boolean;
  tier: 1 | 2 | 3; // 1: 3-4GB, 2: 6GB, 3: 8GB+
  downloadUrl: string;
  description: string;
}

export interface HfModelFile {
  path: string;
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  quantization: string;
  quantGroup: 'fast' | 'balanced' | 'quality' | 'extreme' | 'full';
  minRamGb: number;
  downloadUrl: string;
  isDownloaded?: boolean;
}

export interface HfHubModel {
  id: string; // e.g. "bartowski/Llama-3.2-3B-Instruct-GGUF"
  author: string;
  name: string;
  downloads: number;
  likes: number;
  lastModified: string;
  pipelineTag?: string;
  tags: string[];
  description?: string;
  baseModel?: string;
  gated?: boolean | string;
  estimatedParams?: string;
  minRamGb?: number;
  files?: HfModelFile[];
}

export interface HfSearchOptions {
  query?: string;
  sort?: 'downloads' | 'likes' | 'lastModified' | 'trendingScore';
  category?: 'all' | 'chat' | 'code' | 'reasoning' | 'vision' | 'lightweight';
  limit?: number;
}

export interface DownloadState {
  active: boolean;
  modelId: string;
  modelName: string;
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
  speedFormatted: string;
  etaSeconds: number | null;
  error: string | null;
}

export interface RuntimeConfig {
  threads: number;
  ctxSize: number;
  flashAttn: boolean;
  kvQuant: 'f16' | 'q8_0' | 'q4_0';
  gpuLayers: number;
  pinCores: boolean;
  batchSize?: number;
  ubatchSize?: number;
}

export interface EngineStatus {
  loaded: boolean;
  isMock?: boolean;
  currentModel: LocalModel | null;
  activeConfig: RuntimeConfig | null;
  pid: number | null;
  port: number;
  tokensGeneratedTotal?: number;
  averageTps?: number;
  lastRunTps?: number;
  lastError?: string | null;
}

// Inference & Chat
export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  metrics?: GenerationMetrics;
}

export interface GenerationMetrics {
  evalCount?: number;
  evalDurationMs?: number;
  promptCount?: number;
  promptDurationMs?: number;
  tokensPerSecond?: number;
  timeToFirstTokenMs?: number;
  totalDurationMs?: number;
  // Advanced context and token telemetry
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  cacheHitRatio?: number;
  promptTokensPerSecond?: number;
  contextWindow?: number;
  contextUsagePercent?: number;
}

export interface InferenceParams {
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  maxTokens: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stop?: string[];
  stream: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  preview?: string;
  modelId?: string;
  isPinned?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  systemPrompt?: string;
  systemPromptId?: string;
  messages: ChatMessage[];
  modelId?: string;
  params?: InferenceParams;
  isPinned?: boolean;
}

export interface CreateConversationDTO {
  title?: string;
  systemPrompt?: string;
  systemPromptId?: string;
  modelId?: string;
  params?: InferenceParams;
  messages?: ChatMessage[];
  isPinned?: boolean;
}

export interface UpdateConversationDTO {
  title?: string;
  systemPrompt?: string;
  systemPromptId?: string;
  modelId?: string;
  params?: InferenceParams;
  messages?: ChatMessage[];
  isPinned?: boolean;
}

export interface CustomPersona {
  id: string;
  name: string;
  description: string;
  content: string;
  isBuiltin?: boolean;
  createdAt?: number;
}

export interface InferencePreset {
  id: string;
  name: string;
  description: string;
  params: InferenceParams;
  isBuiltin?: boolean;
}

// System Prompt Presets
export interface SystemPromptPreset {
  id: string;
  name: string;
  description: string;
  content: string;
  icon?: string;
  isBuiltin?: boolean;
}

// Server-to-Client WebSocket Messages
export type WsMessage =
  | { type: 'telemetry'; data: HardwareTelemetry }
  | { type: 'engine_status'; data: EngineStatus }
  | { type: 'download_progress'; data: DownloadState }
  | { type: 'log'; data: { level: 'info' | 'warn' | 'error'; message: string } };

// API Response Wrappers
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
