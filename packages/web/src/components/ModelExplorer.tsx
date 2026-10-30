import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import {
  DownloadState,
  EngineStatus,
  HardwareTelemetry,
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

export const ModelExplorer: React.FC<ModelExplorerProps> = ({
  engineStatus,
  telemetry,
  downloadState,
  onRefreshStatus,
  onError,
}) => {
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [presets, setPresets] = useState<HfModelPreset[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTier, setFilterTier] = useState<number | 'all'>('all');

  // Tuning options for model loading modal
  const [selectedModelForConfig, setSelectedModelForConfig] = useState<LocalModel | null>(null);
  const [threads, setThreads] = useState<number>(telemetry?.cpu.recommendedThreads || 4);
  const [ctxSize, setCtxSize] = useState<number>(2048);
  const [flashAttn, setFlashAttn] = useState<boolean>(true);
  const [kvQuant, setKvQuant] = useState<'f16' | 'q8_0' | 'q4_0'>('f16');
  const [gpuLayers, setGpuLayers] = useState<number>(0);
  const [pinCores, setPinCores] = useState<boolean>(true);

  // Fetch local models & presets
  const fetchData = async () => {
    setIsLoading(true);
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
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (telemetry?.cpu.recommendedThreads) {
      setThreads(telemetry.cpu.recommendedThreads);
    }
  }, [telemetry]);

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

  const handleStartDownload = async (preset: HfModelPreset) => {
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: preset.downloadUrl,
          filename: preset.filename,
          id: preset.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (onError) {
          onError({
            title: 'Download Failed',
            message: err.error || 'Failed to initiate download for ' + preset.name,
            details: err.details,
          });
        }
      } else {
        fetchData();
      }
    } catch (e: any) {
      if (onError) {
        onError({
          title: 'Download Error',
          message: e.message || 'Error initiating download',
        });
      }
    }
  };

  const phoneRamGb = telemetry ? Math.round(telemetry.ram.totalBytes / (1024 * 1024 * 1024)) : 6;

  const filteredPresets = presets.filter((p) => {
    const matchQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.quantization.toLowerCase().includes(searchQuery.toLowerCase());
    const matchTier = filterTier === 'all' || p.tier === filterTier;
    return matchQuery && matchTier;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-studio-bg overflow-y-auto select-none p-6 md:p-8 space-y-8 transition-colors">
      {/* Top Banner & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-studio-border">
        <div>
          <h2 className="text-xl font-bold font-mono tracking-tight text-studio-text flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-accent" />
            Model Explorer & Hugging Face Hub
          </h2>
          <p className="text-xs text-studio-textMuted mt-1">
            Discover, quantize, and mount GGUF neural models directly on smartphone storage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-studio-textMuted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search models, quant, parameters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-lg bg-studio-surface border border-studio-border text-xs text-studio-text placeholder:text-studio-textMuted focus:outline-none focus:border-accent w-64 transition-colors"
            />
          </div>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 rounded-lg bg-studio-surface border border-studio-border text-studio-textMuted hover:text-studio-text transition-colors"
            title="Rescan internal storage and downloads"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-accent' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Download Progress Card if downloading */}
      {downloadState && downloadState.active && (
        <div className="p-4 rounded-xl bg-studio-card border border-accent/40 shadow-accent-glow">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-accent animate-bounce" />
              <span className="text-xs font-semibold text-studio-text">
                Downloading: <span className="text-accent font-mono">{downloadState.modelName}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs text-studio-textMuted">
              <span className="text-accent font-bold">{downloadState.percent.toFixed(1)}%</span>
              <span>{downloadState.speedFormatted}</span>
              {downloadState.etaSeconds && <span>ETA: {downloadState.etaSeconds}s</span>}
            </div>
          </div>

          <div className="w-full h-2 bg-studio-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-200"
              style={{ width: `${downloadState.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Section 1: Mounted / Local Models on Phone */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-studio-text flex items-center gap-2">
            <span>On-Device Storage</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-studio-card border border-studio-border text-accent font-semibold">
              {localModels.length} Installed
            </span>
          </h3>
          <span className="text-[11px] text-studio-textMuted">Scans /sdcard/Download and internal models</span>
        </div>

        {localModels.length === 0 ? (
          <div className="p-6 rounded-xl bg-studio-surface border border-studio-border text-center shadow-studio-subtle">
            <p className="text-xs text-studio-textMuted">
              No GGUF models found in storage. Download a verified model from the catalog below or push one via USB ADB.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {localModels.map((m) => {
              const isCurrentlyLoaded =
                engineStatus?.loaded && engineStatus.currentModel?.path === m.path;

              return (
                <div
                  key={m.path}
                  className={`p-4 rounded-xl border transition-all shadow-studio-subtle ${
                    isCurrentlyLoaded
                      ? 'bg-accent-muted/20 border-accent shadow-accent-glow'
                      : 'bg-studio-surface border-studio-border hover:border-accent/40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-mono text-xs font-bold text-studio-text truncate max-w-[200px]">
                        {m.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-mono text-studio-textMuted">{m.sizeFormatted}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-studio-card border border-studio-border uppercase text-studio-textMuted">
                          {m.location}
                        </span>
                      </div>
                    </div>

                    {isCurrentlyLoaded ? (
                      <span className="flex items-center gap-1 text-[11px] font-mono text-accent font-semibold bg-accent-muted px-2 py-0.5 rounded border border-accent/30">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Online
                      </span>
                    ) : (
                      <button
                        onClick={() => setSelectedModelForConfig(m)}
                        disabled={loadingModelId !== null}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 transition-all active:scale-95 disabled:opacity-40 shadow-accent-glow"
                      >
                        {loadingModelId === m.id ? (
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-white stroke-white" />
                        )}
                        <span>Mount</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Configuration Modal when Mount is clicked (Portaled to document.body for full viewport coverage) */}
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
              {/* Subtle top ambient glow */}
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
                  title="Close modal"
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
                    onChange={(e) => setThreads(parseInt(e.target.value, 10))}
                    className="w-20 bg-studio-card border border-studio-border rounded px-2 py-1 text-right font-mono text-accent focus:outline-none"
                  />
                </div>

                {/* Context Size */}
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
                    max="33"
                    value={gpuLayers}
                    onChange={(e) => setGpuLayers(parseInt(e.target.value, 10))}
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
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-studio-textMuted hover:text-studio-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleLoadModel(selectedModelForConfig)}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 transition-all shadow-accent-glow"
                >
                  Launch & Accelerate
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Section 2: Curated Hugging Face Model Catalog */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-studio-text">
              Curated Hugging Face Model Catalog
            </h3>
            <p className="text-[11px] text-studio-textMuted">
              Compact Q4 quantized models tested for zero thermal crash on ARM processors.
            </p>
          </div>

          {/* Tier Filters */}
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-studio-card border border-studio-border text-xs">
            <button
              onClick={() => setFilterTier('all')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                filterTier === 'all'
                  ? 'bg-studio-surface text-accent shadow-sm'
                  : 'text-studio-textMuted hover:text-studio-text'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterTier(1)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                filterTier === 1
                  ? 'bg-studio-surface text-accent shadow-sm'
                  : 'text-studio-textMuted hover:text-studio-text'
              }`}
            >
              3-4GB RAM
            </button>
            <button
              onClick={() => setFilterTier(2)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                filterTier === 2
                  ? 'bg-studio-surface text-accent shadow-sm'
                  : 'text-studio-textMuted hover:text-studio-text'
              }`}
            >
              6GB RAM
            </button>
            <button
              onClick={() => setFilterTier(3)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                filterTier === 3
                  ? 'bg-studio-surface text-accent shadow-sm'
                  : 'text-studio-textMuted hover:text-studio-text'
              }`}
            >
              8GB+ RAM
            </button>
          </div>
        </div>

        {/* Catalog Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPresets.map((p) => {
            const isInstalled = localModels.some(
              (m) => m.name.toLowerCase() === p.name.toLowerCase() || m.path.includes(p.filename)
            );
            const isRamCompatible = phoneRamGb >= p.minRamGb;

            return (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-studio-surface border border-studio-border hover:border-accent/40 transition-all flex flex-col justify-between gap-3 shadow-studio-subtle"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-mono text-xs font-bold text-studio-text">{p.name}</h4>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-studio-card border border-studio-border text-accent font-semibold flex-shrink-0">
                      {p.quantization}
                    </span>
                  </div>

                  <p className="text-[11px] text-studio-textMuted mt-1 line-clamp-2">{p.description}</p>

                  <div className="flex items-center gap-2 mt-3 text-[11px] font-mono">
                    <span className="text-studio-text font-semibold">{p.sizeFormatted}</span>
                    <span className="text-studio-textMuted">•</span>
                    <span className="text-studio-textMuted">{p.params}</span>
                    <span className="text-studio-textMuted">•</span>
                    <span
                      className={`text-[10px] font-semibold ${
                        isRamCompatible ? 'text-accent' : 'text-amber-accent'
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
                    <span className="flex items-center gap-1 text-[11px] font-mono text-studio-textMuted">
                      <Check className="w-3.5 h-3.5 text-accent" />
                      Downloaded
                    </span>
                  ) : (
                    <button
                      onClick={() => handleStartDownload(p)}
                      disabled={downloadState?.active}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-studio-card border border-studio-border text-studio-text hover:text-accent hover:border-accent/40 transition-all active:scale-95 disabled:opacity-40"
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
    </div>
  );
};
