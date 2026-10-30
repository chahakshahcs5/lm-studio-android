import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  HardDrive,
  Cpu,
  Layers,
  CheckCircle,
  Play,
  RotateCw,
  Search,
  Check,
  AlertCircle,
  ExternalLink,
  Trash2,
  X,
  Star,
  SlidersHorizontal,
  StopCircle,
  Globe,
  Zap,
  FolderDown,
  ShieldAlert,
  ArrowDownToLine,
} from 'lucide-react';
import {
  DownloadState,
  EngineStatus,
  HardwareTelemetry,
  HfHubModel,
  HfModelFile,
  HfModelPreset,
  LocalModel,
} from '@lm-studio-android/shared';
import { ErrorModalData } from './ErrorModal';
import { CustomSelect } from './ui/CustomSelect';

interface ModelExplorerProps {
  engineStatus: EngineStatus | null;
  telemetry: HardwareTelemetry | null;
  downloadState: DownloadState | null;
  onRefreshStatus: () => void;
  onError?: (data: Partial<ErrorModalData> & { message: string }) => void;
}

const TRENDING_QUICK_SEARCHES = [
  'Llama 3.2',
  'Qwen 2.5',
  'DeepSeek-R1',
  'SmolLM2',
  'Gemma 2',
  'Phi-3.5',
  'Coder',
];

export const ModelExplorer: React.FC<ModelExplorerProps> = ({
  engineStatus,
  telemetry,
  downloadState,
  onRefreshStatus,
  onError,
}) => {
  // Navigation View Tab
  const [activeTab, setActiveTab] = useState<'hub' | 'curated' | 'local'>('hub');

  // Hub Explorer State
  const [hubModels, setHubModels] = useState<HfHubModel[]>([]);
  const [isLoadingHub, setIsLoadingHub] = useState<boolean>(false);
  const [hubSearchQuery, setHubSearchQuery] = useState<string>('');
  const [hubCategory, setHubCategory] = useState<string>('all');
  const [hubSort, setHubSort] = useState<string>('downloads');
  const [fitRamOnly, setFitRamOnly] = useState<boolean>(false);

  // Custom Repo input toggle & state
  const [showCustomRepoBox, setShowCustomRepoBox] = useState<boolean>(false);
  const [customRepoInput, setCustomRepoInput] = useState<string>('');
  const [isInspectingCustomRepo, setIsInspectingCustomRepo] = useState<boolean>(false);

  // Quantization Inspector Modal State
  const [inspectingModel, setInspectingModel] = useState<HfHubModel | null>(null);
  const [modelFiles, setModelFiles] = useState<HfModelFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [filesFilterQuant, setFilesFilterQuant] = useState<string>('all');
  const [filesSearchQuery, setFilesSearchQuery] = useState<string>('');

  // Local & Curated Models State
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [presets, setPresets] = useState<HfModelPreset[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState<boolean>(false);
  const [localSearchQuery, setLocalSearchQuery] = useState<string>('');
  const [filterTier, setFilterTier] = useState<number | 'all'>('all');

  // Delete Confirmation State
  const [modelToDelete, setModelToDelete] = useState<LocalModel | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Tuning options for model loading modal
  const [selectedModelForConfig, setSelectedModelForConfig] = useState<LocalModel | null>(null);
  const [threads, setThreads] = useState<number>(telemetry?.cpu.recommendedThreads || 4);
  const [hasUserModifiedThreads, setHasUserModifiedThreads] = useState<boolean>(false);
  const [ctxSize, setCtxSize] = useState<number>(2048);
  const [flashAttn, setFlashAttn] = useState<boolean>(true);
  const [kvQuant, setKvQuant] = useState<'f16' | 'q8_0' | 'q4_0'>('f16');
  const [gpuLayers, setGpuLayers] = useState<number>(0);
  const [pinCores, setPinCores] = useState<boolean>(true);
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);

  // Debounced search timer
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const phoneRamGb = telemetry ? Math.round(telemetry.ram.totalBytes / (1024 * 1024 * 1024)) : 6;

  // Format downloads and likes (e.g. 1.2M, 45.2k)
  const formatNumber = (num: number): string => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  // Fetch local models & presets
  const fetchLocalAndPresets = async () => {
    setIsLoadingLocal(true);
    try {
      const [modelsRes, presetsRes] = await Promise.all([
        fetch('/api/models'),
        fetch('/api/presets'),
      ]);
      if (modelsRes.ok) {
        const m = await modelsRes.json();
        setLocalModels(m);
      }
      if (presetsRes.ok) {
        const p = await presetsRes.json();
        setPresets(p);
      }
    } catch (e: any) {
      if (onError) {
        onError({
          title: 'Catalog Refresh Failed',
          message: e.message || 'Failed to fetch models from the local server.',
        });
      }
    } finally {
      setIsLoadingLocal(false);
    }
  };

  // Fetch Hugging Face Hub Models
  const fetchHubModels = async (query: string, sort: string, category: string) => {
    setIsLoadingHub(true);
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        sort,
        category,
        limit: '36',
      });
      const res = await fetch(`/api/hf/search?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setHubModels(json.data);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
    } catch (e: any) {
      if (onError) {
        onError({
          title: 'Hugging Face Hub Error',
          message: e.message || 'Failed to query Hugging Face API.',
          tips: ['Check your internet connection or Wi-Fi', 'Hugging Face public API might be temporarily rate limited'],
        });
      }
    } finally {
      setIsLoadingHub(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchLocalAndPresets();
    fetchHubModels('', hubSort, hubCategory);
  }, []);

  // Update threads recommendation if untouched by user
  useEffect(() => {
    if (!hasUserModifiedThreads && telemetry?.cpu.recommendedThreads) {
      setThreads(telemetry.cpu.recommendedThreads);
    }
  }, [telemetry?.cpu.recommendedThreads, hasUserModifiedThreads]);

  // Handle Search Input Change with Debounce
  const handleHubSearchChange = (value: string) => {
    setHubSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchHubModels(value, hubSort, hubCategory);
    }, 400);
  };

  const handleQuickSearchClick = (keyword: string) => {
    setHubSearchQuery(keyword);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    fetchHubModels(keyword, hubSort, hubCategory);
  };

  const handleCategoryChange = (cat: string) => {
    setHubCategory(cat);
    fetchHubModels(hubSearchQuery, hubSort, cat);
  };

  const handleSortChange = (s: string) => {
    setHubSort(s);
    fetchHubModels(hubSearchQuery, s, hubCategory);
  };

  // Open Quantization Inspector for a Model
  const handleOpenInspector = async (model: HfHubModel) => {
    setInspectingModel(model);
    setModelFiles([]);
    setIsLoadingFiles(true);
    setFilesFilterQuant('all');
    setFilesSearchQuery('');

    try {
      const res = await fetch(`/api/hf/files?repo=${encodeURIComponent(model.id)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setModelFiles(json.data);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to retrieve repository files.');
      }
    } catch (e: any) {
      if (onError) {
        onError({
          title: 'File Tree Fetch Failed',
          message: e.message || `Unable to inspect files for ${model.id}`,
        });
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Inspect Custom Hugging Face Repo directly
  const handleInspectCustomRepo = async () => {
    const raw = customRepoInput.trim();
    if (!raw) return;

    const cleanRepo = raw.replace(/^https?:\/\/huggingface\.co\//, '').replace(/\/$/, '');
    if (!cleanRepo.includes('/')) {
      if (onError) {
        onError({
          title: 'Invalid Repository Identifier',
          message: 'Please provide a valid Hugging Face repository in the format "author/repo-name".',
        });
      }
      return;
    }

    setIsInspectingCustomRepo(true);
    try {
      const detailsRes = await fetch(`/api/hf/model?repo=${encodeURIComponent(cleanRepo)}`);
      if (!detailsRes.ok) {
        const err = await detailsRes.json().catch(() => ({}));
        throw new Error(err.error || `Repository "${cleanRepo}" not found.`);
      }
      const detailsJson = await detailsRes.json();
      const model: HfHubModel = detailsJson.data;
      handleOpenInspector(model);
    } catch (e: any) {
      if (onError) {
        onError({
          title: 'Custom Repo Lookup Failed',
          message: e.message || `Could not inspect repository ${cleanRepo}`,
        });
      }
    } finally {
      setIsInspectingCustomRepo(false);
    }
  };

  // Start Download
  const handleStartDownload = async (url: string, filename: string, id: string) => {
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, filename, id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (onError) {
          onError({
            title: 'Download Failed',
            message: err.error || 'Failed to initiate download for ' + filename,
          });
        }
      } else {
        fetchLocalAndPresets();
      }
    } catch (e: any) {
      if (onError) {
        onError({
          title: 'Download Error',
          message: e.message || 'Error communicating with download service',
        });
      }
    }
  };

  // Cancel Download
  const handleCancelDownload = async () => {
    try {
      const res = await fetch('/api/download/cancel', { method: 'POST' });
      if (res.ok) {
        fetchLocalAndPresets();
      }
    } catch (e: any) {
      if (onError) {
        onError({
          title: 'Cancel Error',
          message: e.message || 'Failed to cancel download',
        });
      }
    }
  };

  // Delete Local Model
  const handleDeleteModel = async (model: LocalModel) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/models/${encodeURIComponent(model.id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setModelToDelete(null);
        fetchLocalAndPresets();
        onRefreshStatus();
      } else {
        const err = await res.json().catch(() => ({}));
        if (onError) {
          onError({
            title: 'Deletion Failed',
            message: err.error || 'Failed to delete model file from storage.',
          });
        }
      }
    } catch (e: any) {
      if (onError) {
        onError({
          title: 'Deletion Error',
          message: e.message || 'Communication error during model deletion',
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Load Model onto Engine
  const handleLoadModel = async (model: LocalModel) => {
    setLoadingModelId(model.id);
    try {
      const res = await fetch('/api/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: model.path,
          threads,
          ctxSize,
          flashAttn,
          kvQuant,
          gpuLayers,
          pinCores,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (onError) {
          onError({
            title: 'Model Acceleration Failed',
            message: err.error || 'Failed to start llama-server with the requested profile.',
            details: err.details || err.error,
            onOpenConfig: () => setSelectedModelForConfig(model),
            onRetry: () => handleLoadModel(model),
          });
        }
      } else {
        onRefreshStatus();
        setSelectedModelForConfig(null);
      }
    } catch (e: any) {
      if (onError) {
        onError({
          title: 'Communication Error',
          message: e.message || 'Error communicating with engine server',
          onRetry: () => handleLoadModel(model),
        });
      }
    } finally {
      setLoadingModelId(null);
    }
  };

  // Unload Active Model
  const handleUnloadActiveModel = async () => {
    try {
      const res = await fetch('/api/unload', { method: 'POST' });
      if (res.ok) {
        onRefreshStatus();
      }
    } catch (e: any) {
      if (onError) {
        onError({
          title: 'Unload Failed',
          message: e.message || 'Failed to unload model from memory',
        });
      }
    }
  };

  // Filtered Hub Models (with RAM filter)
  const filteredHubModels = useMemo(() => {
    return hubModels.filter((m) => {
      if (fitRamOnly && m.minRamGb) {
        if (m.minRamGb > phoneRamGb) return false;
      }
      return true;
    });
  }, [hubModels, fitRamOnly, phoneRamGb]);

  // Filtered Curated Presets
  const filteredPresets = useMemo(() => {
    return presets.filter((p) => {
      const matchQuery =
        p.name.toLowerCase().includes(hubSearchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(hubSearchQuery.toLowerCase()) ||
        p.quantization.toLowerCase().includes(hubSearchQuery.toLowerCase());
      const matchTier = filterTier === 'all' || p.tier === filterTier;
      return matchQuery && matchTier;
    });
  }, [presets, hubSearchQuery, filterTier]);

  // Filtered Local Models
  const filteredLocalModels = useMemo(() => {
    return localModels.filter((m) => {
      const q = localSearchQuery.toLowerCase();
      return m.name.toLowerCase().includes(q) || m.path.toLowerCase().includes(q);
    });
  }, [localModels, localSearchQuery]);

  // Filtered Inspector Files
  const filteredInspectorFiles = useMemo(() => {
    return modelFiles.filter((f) => {
      const matchesGroup =
        filesFilterQuant === 'all' ||
        (filesFilterQuant === 'recommended' && (f.quantization === 'Q4_K_M' || f.quantization === 'Q4_K_S')) ||
        (filesFilterQuant === 'fast' && (f.quantGroup === 'fast' || f.quantization === 'Q4_0')) ||
        (filesFilterQuant === 'quality' && (f.quantGroup === 'quality' || f.quantGroup === 'full')) ||
        (filesFilterQuant === 'extreme' && f.quantGroup === 'extreme');

      const matchesSearch =
        !filesSearchQuery ||
        f.filename.toLowerCase().includes(filesSearchQuery.toLowerCase()) ||
        f.quantization.toLowerCase().includes(filesSearchQuery.toLowerCase());

      return matchesGroup && matchesSearch;
    });
  }, [modelFiles, filesFilterQuant, filesSearchQuery]);

  // Total disk space used by local models
  const totalLocalStorageBytes = useMemo(() => {
    return localModels.reduce((acc, curr) => acc + (curr.sizeBytes || 0), 0);
  }, [localModels]);

  const totalLocalStorageFormatted = useMemo(() => {
    const gb = totalLocalStorageBytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = totalLocalStorageBytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }, [totalLocalStorageBytes]);

  return (
    <div className="flex-1 flex flex-col h-full bg-studio-bg overflow-y-auto select-none p-4 md:p-8 space-y-6 transition-colors">
      {/* Top Banner & Primary Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-studio-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-mono tracking-tight text-studio-text flex items-center gap-2">
              <Globe className="w-5 h-5 text-accent animate-pulse" />
              Model Explorer & Hugging Face Hub
            </h2>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-accent/10 border border-accent/30 text-accent font-semibold">
              Live HF Hub
            </span>
          </div>
          <p className="text-xs text-studio-textMuted mt-1">
            Browse, filter, inspect quants, and download GGUF models directly to smartphone memory.
          </p>
        </div>

        {/* View Switcher Tabs & Rescan Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-studio-surface border border-studio-border shadow-studio-subtle">
            <button
              onClick={() => setActiveTab('hub')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'hub'
                  ? 'bg-accent text-white shadow-accent-glow'
                  : 'text-studio-textMuted hover:text-studio-text hover:bg-studio-card'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Hugging Face</span>
            </button>

            <button
              onClick={() => setActiveTab('curated')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'curated'
                  ? 'bg-accent text-white shadow-accent-glow'
                  : 'text-studio-textMuted hover:text-studio-text hover:bg-studio-card'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Curated Mobile</span>
            </button>

            <button
              onClick={() => setActiveTab('local')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
                activeTab === 'local'
                  ? 'bg-accent text-white shadow-accent-glow'
                  : 'text-studio-textMuted hover:text-studio-text hover:bg-studio-card'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>On-Device</span>
              {localModels.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    activeTab === 'local'
                      ? 'bg-white/20 text-white'
                      : 'bg-accent/15 text-accent'
                  }`}
                >
                  {localModels.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() => {
              fetchLocalAndPresets();
              if (activeTab === 'hub') {
                fetchHubModels(hubSearchQuery, hubSort, hubCategory);
              }
            }}
            disabled={isLoadingLocal || isLoadingHub}
            className="p-2 rounded-xl bg-studio-surface border border-studio-border text-studio-textMuted hover:text-studio-text hover:border-accent/40 transition-colors shadow-studio-subtle"
            title="Refresh catalog & rescan storage"
          >
            <RotateCw
              className={`w-4 h-4 ${isLoadingLocal || isLoadingHub ? 'animate-spin text-accent' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Active Download Sticky Banner */}
      {downloadState && downloadState.active && (
        <div className="p-4 rounded-2xl bg-studio-card border border-accent/40 shadow-accent-glow animate-in slide-in-from-top duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
                <Download className="w-4 h-4 text-accent animate-bounce" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-studio-text truncate">
                    {downloadState.modelName}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-accent/15 text-accent font-semibold flex-shrink-0">
                    GGUF STREAM
                  </span>
                </div>
                <div className="text-[11px] font-mono text-studio-textMuted flex items-center gap-2 mt-0.5">
                  <span className="text-accent font-bold">{downloadState.percent.toFixed(1)}%</span>
                  <span>•</span>
                  <span>{downloadState.speedFormatted}</span>
                  {downloadState.etaSeconds && (
                    <>
                      <span>•</span>
                      <span>ETA: {downloadState.etaSeconds}s</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleCancelDownload}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 transition-all active:scale-95 flex-shrink-0"
              title="Abort download and clean up partial file"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>Cancel Download</span>
            </button>
          </div>

          <div className="w-full h-2 bg-studio-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-200 rounded-full"
              style={{ width: `${Math.max(1, downloadState.percent)}%` }}
            />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW TAB 1: LIVE HUGGING FACE HUB                                     */}
      {/* ===================================================================== */}
      {activeTab === 'hub' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Search, Filter & Quick Options Bar */}
          <div className="p-4 rounded-2xl bg-studio-surface border border-studio-border shadow-studio-subtle space-y-4">
            {/* Search Input & Custom Repo Toggle */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-studio-textMuted absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search 10,000+ GGUF models on Hugging Face (e.g. llama-3.2, deepseek, qwen, coder)..."
                  value={hubSearchQuery}
                  onChange={(e) => handleHubSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      fetchHubModels(hubSearchQuery, hubSort, hubCategory);
                    }
                  }}
                  className="w-full pl-10 pr-9 py-2 rounded-xl bg-studio-card border border-studio-border text-xs text-studio-text placeholder:text-studio-textMuted focus:outline-none focus:border-accent transition-all shadow-inner"
                />
                {hubSearchQuery && (
                  <button
                    onClick={() => handleHubSearchChange('')}
                    className="absolute right-3 top-2.5 p-0.5 text-studio-textMuted hover:text-studio-text rounded-md"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowCustomRepoBox(!showCustomRepoBox)}
                className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                  showCustomRepoBox
                    ? 'bg-accent-muted text-accent border-accent/40'
                    : 'bg-studio-card border-studio-border text-studio-textMuted hover:text-studio-text hover:border-accent/30'
                }`}
              >
                <FolderDown className="w-3.5 h-3.5" />
                <span>Direct Repo / URL</span>
              </button>
            </div>

            {/* Custom Repo Drawer if toggled */}
            {showCustomRepoBox && (
              <div className="p-3.5 rounded-xl bg-studio-card border border-studio-borderSubtle flex flex-col sm:flex-row items-stretch sm:items-center gap-2 animate-in fade-in duration-150">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Enter Hugging Face repo (e.g. bartowski/Llama-3.2-3B-Instruct-GGUF) or paste URL..."
                    value={customRepoInput}
                    onChange={(e) => setCustomRepoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleInspectCustomRepo();
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-studio-surface border border-studio-border text-xs text-studio-text font-mono placeholder:text-studio-textMuted focus:outline-none focus:border-accent"
                  />
                </div>
                <button
                  onClick={handleInspectCustomRepo}
                  disabled={!customRepoInput.trim() || isInspectingCustomRepo}
                  className="flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-all shadow-accent-glow"
                >
                  {isInspectingCustomRepo ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Layers className="w-3.5 h-3.5" />
                  )}
                  <span>Inspect Quants</span>
                </button>
              </div>
            )}

            {/* Quick Search Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-studio-borderSubtle">
              <span className="text-[11px] font-mono text-studio-textMuted flex items-center gap-1 mr-1">
                <Zap className="w-3 h-3 text-accent" />
                Popular:
              </span>
              {TRENDING_QUICK_SEARCHES.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleQuickSearchClick(chip)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
                    hubSearchQuery.toLowerCase() === chip.toLowerCase()
                      ? 'bg-accent text-white font-semibold shadow-sm'
                      : 'bg-studio-card text-studio-textMuted hover:text-studio-text hover:bg-studio-border/30 border border-studio-borderSubtle'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Filters & Sorting Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-studio-borderSubtle">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Category Select */}
                <CustomSelect
                  value={hubCategory}
                  onChange={handleCategoryChange}
                  options={[
                    { value: 'all', label: 'All Tasks & Categories' },
                    { value: 'chat', label: '💬 Chat & Dialogue' },
                    { value: 'code', label: '💻 Code & Dev' },
                    { value: 'reasoning', label: '🧠 Reasoning & Math' },
                    { value: 'vision', label: '👁️ Vision / Multimodal' },
                    { value: 'lightweight', label: '🪶 Ultra-Light (<2B)' },
                  ]}
                  size="sm"
                />

                {/* Sort Select */}
                <CustomSelect
                  value={hubSort}
                  onChange={handleSortChange}
                  options={[
                    { value: 'downloads', label: '📥 Most Downloads' },
                    { value: 'likes', label: '★ Most Stars / Likes' },
                    { value: 'trendingScore', label: '⚡ Trending Score' },
                    { value: 'lastModified', label: '🕒 Recently Updated' },
                  ]}
                  size="sm"
                />
              </div>

              {/* Hardware RAM Compatibility Filter */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-studio-text select-none">
                  <input
                    type="checkbox"
                    checked={fitRamOnly}
                    onChange={(e) => setFitRamOnly(e.target.checked)}
                    className="accent-accent cursor-pointer rounded"
                  />
                  <span>Fit My Phone RAM ({phoneRamGb}GB)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Model Cards Grid */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-mono font-semibold text-studio-textMuted">
                {isLoadingHub
                  ? 'Querying Hugging Face Hub...'
                  : `${filteredHubModels.length} GGUF Models Found`}
              </span>
              <span className="text-[11px] text-studio-textMuted font-mono">
                Device Memory: {phoneRamGb} GB RAM
              </span>
            </div>

            {isLoadingHub ? (
              <div className="p-12 rounded-2xl bg-studio-surface border border-studio-border flex flex-col items-center justify-center gap-3">
                <RotateCw className="w-6 h-6 text-accent animate-spin" />
                <p className="text-xs text-studio-textMuted font-mono">
                  Fetching live models from Hugging Face...
                </p>
              </div>
            ) : filteredHubModels.length === 0 ? (
              <div className="p-12 rounded-2xl bg-studio-surface border border-studio-border text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-studio-textMuted mx-auto" />
                <h4 className="text-sm font-semibold text-studio-text">No Matching Models Found</h4>
                <p className="text-xs text-studio-textMuted max-w-sm mx-auto">
                  Try broadening your search term or disable the "Fit My Phone RAM" filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredHubModels.map((model) => {
                  const isInstalled = localModels.some(
                    (m) =>
                      m.name.toLowerCase().includes(model.name.toLowerCase()) ||
                      m.path.toLowerCase().includes(model.name.toLowerCase())
                  );

                  const estRam = model.minRamGb || 4;
                  const isRamFit = phoneRamGb >= estRam;
                  const isRamTight = phoneRamGb >= estRam - 1 && phoneRamGb < estRam;

                  return (
                    <div
                      key={model.id}
                      className="p-5 rounded-2xl bg-studio-surface border border-studio-border hover:border-accent/40 transition-all flex flex-col justify-between gap-4 shadow-studio-subtle group hover:shadow-lg"
                    >
                      <div className="space-y-3">
                        {/* Header: Author & Repo */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {model.author && (
                              <span className="text-[11px] font-mono text-studio-textMuted truncate block">
                                {model.author}
                              </span>
                            )}
                            <h4
                              className="font-mono text-xs font-bold text-studio-text truncate group-hover:text-accent transition-colors"
                              title={model.name}
                            >
                              {model.name}
                            </h4>
                          </div>

                          <a
                            href={`https://huggingface.co/${model.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg text-studio-textMuted hover:text-studio-text hover:bg-studio-card transition-colors flex-shrink-0"
                            title="Open repository on Hugging Face"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        {/* Badges: Params, Pipeline, Base */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {model.estimatedParams && (
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-accent font-bold">
                              {model.estimatedParams}
                            </span>
                          )}
                          {model.pipelineTag && (
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-studio-card border border-studio-border text-studio-textMuted">
                              {model.pipelineTag}
                            </span>
                          )}
                          {model.gated && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Gated License
                            </span>
                          )}
                        </div>

                        {/* Stats Row: Downloads, Likes */}
                        <div className="flex items-center gap-3 text-[11px] font-mono text-studio-textMuted">
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3 text-studio-textMuted" />
                            {formatNumber(model.downloads)}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            {formatNumber(model.likes)}
                          </span>
                        </div>

                        {/* RAM Compatibility Badge */}
                        <div className="pt-2 border-t border-studio-borderSubtle">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${
                              isRamFit
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : isRamTight
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}
                          >
                            {isRamFit ? '🟢 Fits Phone RAM' : isRamTight ? '🟡 Tight RAM' : '🔴 Heavy for Phone'}
                            <span>(Est. {estRam} GB RAM)</span>
                          </span>
                        </div>
                      </div>

                      {/* Action Footer */}
                      <div className="pt-3 border-t border-studio-borderSubtle flex items-center justify-between">
                        {isInstalled ? (
                          <span className="flex items-center gap-1 text-[11px] font-mono text-accent font-semibold">
                            <Check className="w-3.5 h-3.5" />
                            Installed
                          </span>
                        ) : (
                          <span className="text-[11px] text-studio-textMuted font-mono">
                            Multiple Quants Available
                          </span>
                        )}

                        <button
                          onClick={() => handleOpenInspector(model)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-studio-card border border-studio-border text-studio-text hover:text-accent hover:border-accent/40 hover:bg-studio-surface transition-all active:scale-95 shadow-studio-subtle"
                        >
                          <Layers className="w-3.5 h-3.5 text-accent" />
                          <span>Inspect Quants</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW TAB 2: CURATED MOBILE MODELS                                     */}
      {/* ===================================================================== */}
      {activeTab === 'curated' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-studio-surface border border-studio-border shadow-studio-subtle">
            <div>
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-studio-text flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent" />
                <span>Battle-Tested Smartphone Architectures</span>
              </h3>
              <p className="text-[11px] text-studio-textMuted mt-0.5">
                Pre-calibrated Q4 quantized models verified for zero thermal crash and optimal token speeds on ARM processors.
              </p>
            </div>

            {/* RAM Tier Filters */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-studio-card border border-studio-border text-xs">
              <button
                onClick={() => setFilterTier('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  filterTier === 'all'
                    ? 'bg-studio-surface text-accent shadow-sm'
                    : 'text-studio-textMuted hover:text-studio-text'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterTier(1)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  filterTier === 1
                    ? 'bg-studio-surface text-accent shadow-sm'
                    : 'text-studio-textMuted hover:text-studio-text'
                }`}
              >
                3-4GB RAM
              </button>
              <button
                onClick={() => setFilterTier(2)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  filterTier === 2
                    ? 'bg-studio-surface text-accent shadow-sm'
                    : 'text-studio-textMuted hover:text-studio-text'
                }`}
              >
                6GB RAM
              </button>
              <button
                onClick={() => setFilterTier(3)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  filterTier === 3
                    ? 'bg-studio-surface text-accent shadow-sm'
                    : 'text-studio-textMuted hover:text-studio-text'
                }`}
              >
                8GB+ RAM
              </button>
            </div>
          </div>

          {/* Curated Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPresets.map((p) => {
              const isInstalled = localModels.some(
                (m) => m.name.toLowerCase() === p.name.toLowerCase() || m.path.includes(p.filename)
              );
              const isRamCompatible = phoneRamGb >= p.minRamGb;

              return (
                <div
                  key={p.id}
                  className="p-5 rounded-2xl bg-studio-surface border border-studio-border hover:border-accent/40 transition-all flex flex-col justify-between gap-4 shadow-studio-subtle"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent font-bold">
                          Tier {p.tier}
                        </span>
                        <h4 className="font-mono text-xs font-bold text-studio-text mt-1.5">{p.name}</h4>
                      </div>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-studio-card border border-studio-border text-accent font-semibold flex-shrink-0">
                        {p.quantization}
                      </span>
                    </div>

                    <p className="text-[11px] text-studio-textMuted line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>

                    <div className="flex items-center gap-2 text-[11px] font-mono pt-2 border-t border-studio-borderSubtle">
                      <span className="text-studio-text font-semibold">{p.sizeFormatted}</span>
                      <span className="text-studio-textMuted">•</span>
                      <span className="text-studio-textMuted">{p.params}</span>
                      <span className="text-studio-textMuted">•</span>
                      <span
                        className={`text-[10px] font-semibold ${
                          isRamCompatible ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {isRamCompatible ? '🟢 Fits RAM' : '🟡 High RAM'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-studio-borderSubtle flex items-center justify-between">
                    <a
                      href={`https://huggingface.co/${p.repo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-studio-textMuted hover:text-studio-text flex items-center gap-1 transition-colors"
                    >
                      <span>HF Repo</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    {isInstalled ? (
                      <span className="flex items-center gap-1 text-[11px] font-mono text-accent font-semibold">
                        <Check className="w-3.5 h-3.5" />
                        Downloaded
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          handleStartDownload(p.downloadUrl, p.filename, p.id)
                        }
                        disabled={downloadState?.active}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-studio-card border border-studio-border text-studio-text hover:text-accent hover:border-accent/40 transition-all active:scale-95 disabled:opacity-40 shadow-studio-subtle"
                      >
                        <Download className="w-3.5 h-3.5 text-accent" />
                        <span>Download</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW TAB 3: ON-DEVICE STORAGE                                         */}
      {/* ===================================================================== */}
      {activeTab === 'local' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Storage Overview Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-studio-surface border border-studio-border shadow-studio-subtle">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
                <HardDrive className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-studio-text">
                  On-Device Storage Overview
                </h3>
                <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-studio-textMuted">
                  <span>{localModels.length} Models Installed</span>
                  <span>•</span>
                  <span>Total Space: <strong className="text-studio-text">{totalLocalStorageFormatted}</strong></span>
                </div>
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-studio-textMuted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter local models..."
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-studio-card border border-studio-border text-xs text-studio-text placeholder:text-studio-textMuted focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Local Models List */}
          {filteredLocalModels.length === 0 ? (
            <div className="p-12 rounded-2xl bg-studio-surface border border-studio-border text-center space-y-3">
              <FolderDown className="w-8 h-8 text-studio-textMuted mx-auto" />
              <h4 className="text-sm font-semibold text-studio-text">No Models in Local Storage</h4>
              <p className="text-xs text-studio-textMuted max-w-sm mx-auto">
                No GGUF models were detected in internal storage or /sdcard/Download. Explore the Hugging Face Hub to download models directly.
              </p>
              <button
                onClick={() => setActiveTab('hub')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-white shadow-accent-glow hover:opacity-90 transition-all"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Explore Hugging Face Models</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLocalModels.map((m) => {
                const isCurrentlyLoaded =
                  engineStatus?.loaded && engineStatus.currentModel?.path === m.path;

                return (
                  <div
                    key={m.path}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 shadow-studio-subtle ${
                      isCurrentlyLoaded
                        ? 'bg-accent/5 border-accent shadow-accent-glow'
                        : 'bg-studio-surface border-studio-border hover:border-accent/40'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4
                            className="font-mono text-xs font-bold text-studio-text truncate"
                            title={m.name}
                          >
                            {m.name}
                          </h4>
                          <span className="text-[10px] font-mono text-studio-textMuted truncate block mt-0.5">
                            {m.path}
                          </span>
                        </div>

                        {isCurrentlyLoaded && (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-accent font-semibold bg-accent/15 px-2 py-0.5 rounded-full border border-accent/30 flex-shrink-0">
                            <CheckCircle className="w-3 h-3" />
                            Online
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2 text-[11px] font-mono">
                        <span className="font-semibold text-studio-text">{m.sizeFormatted}</span>
                        <span className="text-studio-textMuted">•</span>
                        <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-studio-card border border-studio-border text-studio-textMuted font-mono">
                          {m.location}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-studio-borderSubtle flex items-center justify-between gap-2">
                      <button
                        onClick={() => setModelToDelete(m)}
                        disabled={isCurrentlyLoaded}
                        className="p-1.5 rounded-lg text-studio-textMuted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        title={
                          isCurrentlyLoaded
                            ? 'Cannot delete an active running model'
                            : 'Delete model from phone storage'
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-2">
                        {isCurrentlyLoaded ? (
                          <button
                            onClick={handleUnloadActiveModel}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-studio-textMuted bg-studio-card border border-studio-border hover:text-studio-text transition-all"
                          >
                            <span>Unload</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedModelForConfig(m)}
                            disabled={loadingModelId !== null}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-accent text-white hover:opacity-90 transition-all active:scale-95 disabled:opacity-40 shadow-accent-glow"
                          >
                            {loadingModelId === m.id ? (
                              <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-white stroke-white" />
                            )}
                            <span>Mount & Run</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: QUANTIZATION INSPECTOR (PORTALED)                            */}
      {/* ===================================================================== */}
      {inspectingModel &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-200"
            onClick={() => setInspectingModel(null)}
          >
            <div
              className="bg-studio-surface border border-studio-border rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-studio-border flex items-start justify-between gap-3 bg-studio-card/50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-studio-textMuted">
                      {inspectingModel.author}
                    </span>
                    <span className="text-studio-textMuted">•</span>
                    <a
                      href={`https://huggingface.co/${inspectingModel.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent hover:underline flex items-center gap-1 font-mono"
                    >
                      <span>View on Hugging Face</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <h3 className="text-base font-bold font-mono text-studio-text truncate mt-1">
                    {inspectingModel.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-studio-textMuted">
                    <span>{formatNumber(inspectingModel.downloads)} Downloads</span>
                    <span>•</span>
                    <span>{formatNumber(inspectingModel.likes)} Stars</span>
                    {inspectingModel.estimatedParams && (
                      <>
                        <span>•</span>
                        <span className="text-accent font-semibold">
                          {inspectingModel.estimatedParams}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setInspectingModel(null)}
                  className="p-1.5 rounded-lg text-studio-textMuted hover:text-studio-text hover:bg-studio-card transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quantization Filter Toolbar */}
              <div className="p-4 border-b border-studio-borderSubtle bg-studio-bg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Quant Groups */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'all', label: 'All Files' },
                    { id: 'recommended', label: '⭐ Recommended (Q4_K)' },
                    { id: 'fast', label: '⚡ Fast ARM (Q4_0)' },
                    { id: 'quality', label: '🎯 Quality (Q5/Q6/Q8)' },
                    { id: 'extreme', label: '📦 Compact (IQ)' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFilesFilterQuant(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap transition-colors ${
                        filesFilterQuant === tab.id
                          ? 'bg-accent text-white font-semibold shadow-sm'
                          : 'text-studio-textMuted hover:text-studio-text hover:bg-studio-card'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Filter Search */}
                <div className="relative w-full sm:w-48">
                  <Search className="w-3 h-3 text-studio-textMuted absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Filter file / quant..."
                    value={filesSearchQuery}
                    onChange={(e) => setFilesSearchQuery(e.target.value)}
                    className="w-full pl-7 pr-2.5 py-1 rounded-lg bg-studio-card border border-studio-border text-[11px] text-studio-text placeholder:text-studio-textMuted focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Quant Files List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {isLoadingFiles ? (
                  <div className="p-12 text-center space-y-2">
                    <RotateCw className="w-6 h-6 text-accent animate-spin mx-auto" />
                    <p className="text-xs text-studio-textMuted font-mono">
                      Scanning repository for GGUF files and quantization formats...
                    </p>
                  </div>
                ) : filteredInspectorFiles.length === 0 ? (
                  <div className="p-8 text-center space-y-1">
                    <p className="text-xs text-studio-text font-semibold">No GGUF Files Match Filter</p>
                    <p className="text-[11px] text-studio-textMuted">
                      Try selecting "All Files" or clear your filter search.
                    </p>
                  </div>
                ) : (
                  filteredInspectorFiles.map((file) => {
                    const isRamFit = phoneRamGb >= file.minRamGb;
                    const isRamTight = phoneRamGb >= file.minRamGb - 1 && phoneRamGb < file.minRamGb;
                    const isDownloadingThis =
                      downloadState?.active &&
                      (downloadState.modelId === file.filename ||
                        downloadState.modelName === file.filename);

                    return (
                      <div
                        key={file.path}
                        className="p-3.5 rounded-xl bg-studio-card border border-studio-border hover:border-accent/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-studio-subtle"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-accent px-2 py-0.5 rounded bg-accent/15 border border-accent/20">
                              {file.quantization}
                            </span>
                            <span className="text-xs font-mono font-medium text-studio-text truncate">
                              {file.filename}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] font-mono text-studio-textMuted flex-wrap">
                            <span className="font-bold text-studio-text">{file.sizeFormatted}</span>
                            <span>•</span>
                            <span
                              className={`text-[10px] font-semibold ${
                                isRamFit
                                  ? 'text-emerald-400'
                                  : isRamTight
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {isRamFit
                                ? `🟢 Safe for RAM (Req. ~${file.minRamGb} GB)`
                                : isRamTight
                                ? `🟡 Tight Fit (Req. ~${file.minRamGb} GB)`
                                : `🔴 Heavy (Req. ~${file.minRamGb} GB)`}
                            </span>
                          </div>
                        </div>

                        {/* Action: Download / Downloaded / Progress */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {file.isDownloaded ? (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold text-accent bg-accent/10 border border-accent/30">
                              <Check className="w-3.5 h-3.5" />
                              <span>Downloaded</span>
                            </span>
                          ) : isDownloadingThis ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono bg-accent/20 text-accent border border-accent/40">
                              <RotateCw className="w-3 h-3 animate-spin" />
                              <span>{downloadState?.percent.toFixed(0)}%</span>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                handleStartDownload(file.downloadUrl, file.filename, file.filename)
                              }
                              disabled={downloadState?.active}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-accent text-white hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all shadow-accent-glow"
                            >
                              <ArrowDownToLine className="w-3.5 h-3.5" />
                              <span>Download ({file.sizeFormatted})</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-studio-border bg-studio-card/30 flex items-center justify-between">
                <span className="text-[11px] text-studio-textMuted font-mono">
                  Target Destination: <code className="text-studio-text">/models/</code>
                </span>
                <button
                  onClick={() => setInspectingModel(null)}
                  className="px-4 py-1.5 rounded-xl text-xs font-medium bg-studio-surface border border-studio-border text-studio-text hover:border-accent/40 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===================================================================== */}
      {/* MODAL 2: DELETE CONFIRMATION MODAL                                    */}
      {/* ===================================================================== */}
      {modelToDelete &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
            onClick={() => setModelToDelete(null)}
          >
            <div
              className="bg-studio-surface border border-studio-border rounded-2xl max-w-sm w-full p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-red-400">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-mono text-sm font-bold text-studio-text">
                    Delete GGUF Model?
                  </h3>
                  <span className="text-xs text-studio-textMuted">Free up device storage</span>
                </div>
              </div>

              <p className="text-xs text-studio-textMuted leading-relaxed">
                Are you sure you want to delete <strong className="text-studio-text font-mono">{modelToDelete.name}</strong> ({modelToDelete.sizeFormatted}) from storage?
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-studio-border">
                <button
                  onClick={() => setModelToDelete(null)}
                  disabled={isDeleting}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-studio-textMuted hover:text-studio-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteModel(modelToDelete)}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-all active:scale-95 disabled:opacity-40 shadow-lg shadow-red-500/20"
                >
                  {isDeleting ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Delete File</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===================================================================== */}
      {/* MODAL 3: ACCELERATION PROFILE TUNING MODAL                            */}
      {/* ===================================================================== */}
      {selectedModelForConfig &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
            onClick={() => setSelectedModelForConfig(null)}
          >
            <div
              className="bg-studio-surface border border-studio-border rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-accent/15 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between pb-3 border-b border-studio-border">
                <div>
                  <h3 className="font-mono text-sm font-bold text-studio-text">
                    Configure Acceleration Profile
                  </h3>
                  <span className="text-xs text-accent font-mono">
                    {selectedModelForConfig.name}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedModelForConfig(null)}
                  className="p-1 rounded-lg text-studio-textMuted hover:text-studio-text hover:bg-studio-card transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Tuning Options */}
              <div className="space-y-3 text-xs">
                {/* Threads */}
                <div className="flex items-center justify-between">
                  <span className="text-studio-text">Inference Threads</span>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={threads}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setThreads(isNaN(val) ? 1 : Math.max(1, Math.min(16, val)));
                      setHasUserModifiedThreads(true);
                    }}
                    className="w-20 bg-studio-card border border-studio-border rounded px-2 py-1 text-right font-mono text-accent focus:outline-none"
                  />
                </div>

                {/* Context Window */}
                <div className="flex items-center justify-between">
                  <span className="text-studio-text">Context Window</span>
                  <CustomSelect
                    value={ctxSize}
                    onChange={(val) => setCtxSize(Number(val))}
                    options={[
                      { value: 1024, label: '1024 tokens', badge: 'Low RAM' },
                      { value: 2048, label: '2048 tokens', badge: 'Balanced' },
                      { value: 4096, label: '4096 tokens', badge: 'High Ctx' },
                      { value: 8192, label: '8192 tokens', badge: 'Max Ctx' },
                    ]}
                    size="sm"
                  />
                </div>

                {/* Flash-Attention */}
                <div className="flex items-center justify-between">
                  <span className="text-studio-text">Flash-Attention (-fa)</span>
                  <input
                    type="checkbox"
                    checked={flashAttn}
                    onChange={(e) => setFlashAttn(e.target.checked)}
                    className="accent-accent cursor-pointer"
                  />
                </div>

                {/* KV Quant */}
                <div className="flex items-center justify-between">
                  <span className="text-studio-text">KV Cache Quantization</span>
                  <CustomSelect
                    value={kvQuant}
                    onChange={(val) => setKvQuant(val as any)}
                    options={[
                      { value: 'f16', label: 'f16', badge: 'Standard' },
                      { value: 'q8_0', label: 'q8_0', badge: '-50% RAM' },
                      { value: 'q4_0', label: 'q4_0', badge: '-75% RAM' },
                    ]}
                    size="sm"
                  />
                </div>

                {/* GPU Layers */}
                <div className="flex items-center justify-between">
                  <span className="text-studio-text">Mobile GPU Offload (Vulkan)</span>
                  <input
                    type="number"
                    min="0"
                    max="64"
                    value={gpuLayers}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setGpuLayers(isNaN(val) ? 0 : Math.max(0, Math.min(64, val)));
                    }}
                    className="w-20 bg-studio-card border border-studio-border rounded px-2 py-1 text-right font-mono text-studio-text focus:outline-none"
                  />
                </div>

                {/* Big core pinning */}
                <div className="flex items-center justify-between">
                  <span className="text-studio-text">Pin to ARM Big Cores (taskset)</span>
                  <input
                    type="checkbox"
                    checked={pinCores}
                    onChange={(e) => setPinCores(e.target.checked)}
                    className="accent-accent cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-studio-border">
                <button
                  onClick={() => setSelectedModelForConfig(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-studio-textMuted hover:text-studio-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleLoadModel(selectedModelForConfig)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-accent text-white hover:opacity-90 transition-all shadow-accent-glow"
                >
                  Launch & Accelerate
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
