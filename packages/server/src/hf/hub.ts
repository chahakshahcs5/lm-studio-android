import { HfHubModel, HfModelFile, HfSearchOptions } from '@lm-studio-android/shared';
import { modelManager } from './models.js';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 1000; // 1 minute
const searchCache = new Map<string, CacheEntry<HfHubModel[]>>();
const filesCache = new Map<string, CacheEntry<HfModelFile[]>>();
const detailsCache = new Map<string, CacheEntry<HfHubModel>>();

/**
 * Extract quantization string from filename (e.g. Q4_K_M, Q8_0, IQ3_M, F16)
 */
export function extractQuantization(filename: string): {
  quant: string;
  group: 'fast' | 'balanced' | 'quality' | 'extreme' | 'full';
} {
  const upper = filename.toUpperCase();

  // Match common quantization patterns
  const match = upper.match(
    /(IQ[1-4]_[A-Z0-9_]+|Q[2-8]_[A-Z0-9_]+|Q[2-8]_[0-1]|FP16|F16|BF16|FP32)/i
  );

  const quant = match ? match[1].toUpperCase() : 'UNKNOWN';

  // Categorize
  if (quant.startsWith('IQ') || quant.startsWith('Q2_') || quant.startsWith('Q3_K_S')) {
    return { quant, group: 'extreme' };
  }
  if (quant === 'Q4_0' || quant.startsWith('Q4_0_') || quant === 'Q4_1') {
    return { quant, group: 'fast' };
  }
  if (quant === 'Q4_K_M' || quant === 'Q4_K_S' || quant === 'Q4_K_L' || quant.startsWith('Q4_K')) {
    return { quant, group: 'balanced' };
  }
  if (quant.startsWith('Q5_') || quant.startsWith('Q6_')) {
    return { quant, group: 'quality' };
  }
  if (quant.startsWith('Q8_') || quant.includes('16') || quant.includes('32')) {
    return { quant, group: 'full' };
  }

  return { quant, group: 'balanced' };
}

/**
 * Extract parameter size label from model ID or tags (e.g. 135M, 0.5B, 1B, 3B, 7B, 14B)
 */
export function extractEstimatedParams(modelId: string, tags: string[] = []): string {
  const combined = `${modelId} ${tags.join(' ')}`;
  const match = combined.match(/\b(\d+(?:\.\d+)?)\s*([BM])\b/i);
  if (match) {
    return `${match[1]}${match[2].toUpperCase()}`;
  }
  return '';
}

/**
 * Estimate minimum RAM required in GB from parameter string or file size
 */
export function estimateRamFromSize(sizeBytes: number): number {
  const sizeGb = sizeBytes / (1024 * 1024 * 1024);
  // Add 1.2 GB overhead for OS, context window & KV cache
  return Math.ceil((sizeGb + 1.2) * 2) / 2;
}

export function estimateRamFromParams(params: string): number {
  if (!params) return 4;
  const upper = params.toUpperCase();
  if (upper.endsWith('M')) {
    const num = parseFloat(upper);
    return num <= 500 ? 3 : 4;
  }
  if (upper.endsWith('B')) {
    const num = parseFloat(upper);
    if (num <= 1) return 3;
    if (num <= 2) return 4;
    if (num <= 3.5) return 6;
    if (num <= 8) return 8;
    if (num <= 14) return 12;
    return 16;
  }
  return 4;
}

/**
 * Format bytes to readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

/**
 * Search Hugging Face Hub for GGUF models
 */
export async function searchHfHub(options: HfSearchOptions = {}): Promise<HfHubModel[]> {
  const query = (options.query || '').trim();
  const sort = options.sort || 'downloads';
  const category = options.category || 'all';
  const limit = Math.min(options.limit || 30, 50);

  const cacheKey = `${query}|${sort}|${category}|${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Build filter list
  const filters: string[] = ['gguf'];
  if (category === 'chat') {
    filters.push('text-generation');
  } else if (category === 'vision') {
    filters.push('image-text-to-text');
  }

  // Build query URL
  const params = new URLSearchParams();
  if (query) {
    params.set('search', query);
  }
  params.set('filter', filters.join(','));
  params.set('sort', sort);
  params.set('direction', '-1');
  params.set('limit', String(limit));
  params.set('full', 'true');

  // If category is code or reasoning, inject keyword into search if not already present
  if (category === 'code' && !query.toLowerCase().includes('code')) {
    const currentSearch = params.get('search') || '';
    params.set('search', `${currentSearch} coder`.trim());
  } else if (category === 'reasoning' && !query.toLowerCase().includes('reason')) {
    const currentSearch = params.get('search') || '';
    params.set('search', `${currentSearch} reasoning`.trim());
  }

  const url = `https://huggingface.co/api/models?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'LM-Studio-Android/1.0 (Mobile AI Accelerator)',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Hugging Face API returned HTTP ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as any[];
  const models: HfHubModel[] = [];

  for (const item of data) {
    if (!item.id || typeof item.id !== 'string') continue;

    const parts = item.id.split('/');
    const author = parts.length > 1 ? parts[0] : '';
    const name = parts.length > 1 ? parts.slice(1).join('/') : item.id;

    const estimatedParams = extractEstimatedParams(item.id, item.tags);
    const minRamGb = estimateRamFromParams(estimatedParams);

    // Base model if tagged
    let baseModel: string | undefined = undefined;
    if (item.cardData && typeof item.cardData.base_model === 'string') {
      baseModel = item.cardData.base_model;
    } else if (Array.isArray(item.tags)) {
      const baseTag = item.tags.find((t: string) => t.startsWith('base_model:'));
      if (baseTag) {
        baseModel = baseTag.replace(/^base_model:(quantized:)?/, '');
      }
    }

    // Filter lightweight category if selected
    if (category === 'lightweight') {
      if (estimatedParams) {
        const isLightweight =
          estimatedParams.endsWith('M') ||
          (estimatedParams.endsWith('B') && parseFloat(estimatedParams) <= 2.5);
        if (!isLightweight) continue;
      }
    }

    models.push({
      id: item.id,
      author,
      name,
      downloads: item.downloads || 0,
      likes: item.likes || 0,
      lastModified: item.lastModified || '',
      pipelineTag: item.pipeline_tag,
      tags: Array.isArray(item.tags) ? item.tags : [],
      baseModel,
      gated: item.gated,
      estimatedParams,
      minRamGb,
    });
  }

  searchCache.set(cacheKey, { data: models, timestamp: Date.now() });
  return models;
}

/**
 * Get all available .gguf files inside a Hugging Face repo
 */
export async function getHfModelFiles(repoId: string): Promise<HfModelFile[]> {
  const cleanRepo = repoId.trim().replace(/^https?:\/\/huggingface\.co\//, '');
  if (!cleanRepo || !cleanRepo.includes('/')) {
    throw new Error('Invalid repository identifier. Format must be "author/model-name".');
  }

  const cached = filesCache.get(cleanRepo);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    // Cross check download status dynamically
    const localModels = modelManager.scanLocalModels();
    return cached.data.map((file) => ({
      ...file,
      isDownloaded: localModels.some(
        (m) => m.name.toLowerCase() === file.filename.replace('.gguf', '').toLowerCase() || m.path.endsWith(file.filename)
      ),
    }));
  }

  const url = `https://huggingface.co/api/models/${cleanRepo}/tree/main?recursive=true`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'LM-Studio-Android/1.0',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Repository "${cleanRepo}" not found on Hugging Face.`);
    }
    throw new Error(`Hugging Face API returned HTTP ${res.status}: ${res.statusText}`);
  }

  const tree = (await res.json()) as any[];
  if (!Array.isArray(tree)) {
    throw new Error('Invalid response structure received from Hugging Face tree API.');
  }

  const localModels = modelManager.scanLocalModels();
  const files: HfModelFile[] = [];

  for (const item of tree) {
    if (!item.path || typeof item.path !== 'string') continue;
    if (!item.path.toLowerCase().endsWith('.gguf')) continue;

    const sizeBytes = item.size || item.lfs?.size || 0;
    const filename = item.path.split('/').pop() || item.path;
    const { quant, group } = extractQuantization(filename);
    const minRamGb = estimateRamFromSize(sizeBytes);
    const downloadUrl = `https://huggingface.co/${cleanRepo}/resolve/main/${encodeURIComponent(item.path)}`;

    const isDownloaded = localModels.some(
      (m) => m.name.toLowerCase() === filename.replace('.gguf', '').toLowerCase() || m.path.endsWith(filename)
    );

    files.push({
      path: item.path,
      filename,
      sizeBytes,
      sizeFormatted: formatBytes(sizeBytes),
      quantization: quant,
      quantGroup: group,
      minRamGb,
      downloadUrl,
      isDownloaded,
    });
  }

  // Sort files: Recommended balanced quants (Q4_K_M, Q4_0, Q5_K_M) first, then by size
  files.sort((a, b) => {
    const priority = (f: HfModelFile) => {
      if (f.quantization === 'Q4_K_M') return 1;
      if (f.quantization === 'Q4_0') return 2;
      if (f.quantization === 'Q5_K_M') return 3;
      if (f.quantGroup === 'balanced') return 4;
      if (f.quantGroup === 'fast') return 5;
      if (f.quantGroup === 'quality') return 6;
      if (f.quantGroup === 'full') return 7;
      return 8;
    };
    const pDiff = priority(a) - priority(b);
    if (pDiff !== 0) return pDiff;
    return a.sizeBytes - b.sizeBytes;
  });

  filesCache.set(cleanRepo, { data: files, timestamp: Date.now() });
  return files;
}

/**
 * Get detailed metadata and files for a specific Hugging Face model
 */
export async function getHfModelDetails(repoId: string): Promise<HfHubModel> {
  const cleanRepo = repoId.trim().replace(/^https?:\/\/huggingface\.co\//, '');
  if (!cleanRepo || !cleanRepo.includes('/')) {
    throw new Error('Invalid repository identifier. Format must be "author/model-name".');
  }

  const cached = detailsCache.get(cleanRepo);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    const files = await getHfModelFiles(cleanRepo);
    return { ...cached.data, files };
  }

  const url = `https://huggingface.co/api/models/${cleanRepo}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'LM-Studio-Android/1.0',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Repository "${cleanRepo}" not found on Hugging Face.`);
    }
    throw new Error(`Hugging Face API returned HTTP ${res.status}: ${res.statusText}`);
  }

  const item = (await res.json()) as any;
  const parts = item.id.split('/');
  const author = parts.length > 1 ? parts[0] : '';
  const name = parts.length > 1 ? parts.slice(1).join('/') : item.id;

  const estimatedParams = extractEstimatedParams(item.id, item.tags);
  const minRamGb = estimateRamFromParams(estimatedParams);

  let baseModel: string | undefined = undefined;
  if (item.cardData && typeof item.cardData.base_model === 'string') {
    baseModel = item.cardData.base_model;
  }

  const files = await getHfModelFiles(cleanRepo);

  const model: HfHubModel = {
    id: item.id,
    author,
    name,
    downloads: item.downloads || 0,
    likes: item.likes || 0,
    lastModified: item.lastModified || '',
    pipelineTag: item.pipeline_tag,
    tags: Array.isArray(item.tags) ? item.tags : [],
    baseModel,
    gated: item.gated,
    estimatedParams,
    minRamGb,
    files,
  };

  detailsCache.set(cleanRepo, { data: model, timestamp: Date.now() });
  return model;
}

