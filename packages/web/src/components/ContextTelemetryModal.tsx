import React from 'react';
import {
  X,
  Database,
  Zap,
  Clock,
  Cpu,
  Layers,
  Sparkles,
  ShieldCheck,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { EngineStatus, GenerationMetrics } from '@lm-studio-android/shared';

interface ContextTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  engineStatus: EngineStatus | null;
  conversationContextTokens: number;
  maxContextWindow: number;
  systemPromptTokens: number;
  historyTokens: number;
  latestMetrics: GenerationMetrics | null;
  messageCount: number;
}

export const ContextTelemetryModal: React.FC<ContextTelemetryModalProps> = ({
  isOpen,
  onClose,
  engineStatus,
  conversationContextTokens,
  maxContextWindow,
  systemPromptTokens,
  historyTokens,
  latestMetrics,
  messageCount,
}) => {
  if (!isOpen) return null;

  const totalUsed = conversationContextTokens;
  const remaining = Math.max(0, maxContextWindow - totalUsed);
  const usagePercent = Math.min(100, Math.round((totalUsed / maxContextWindow) * 1000) / 10);

  const promptTokens = latestMetrics?.promptTokens ?? (systemPromptTokens + historyTokens);
  const outputTokens = latestMetrics?.completionTokens ?? latestMetrics?.evalCount ?? 0;
  const cachedTokens = latestMetrics?.cachedTokens ?? 0;
  const cacheHitRatio = latestMetrics?.cacheHitRatio ?? (promptTokens > 0 ? Math.round((cachedTokens / promptTokens) * 100) : 0);

  // Segment percentages for the visual bar
  const systemPct = Math.max(0, Math.round((systemPromptTokens / maxContextWindow) * 100));
  const historyPct = Math.max(0, Math.round((historyTokens / maxContextWindow) * 100));
  const outputPct = Math.max(0, Math.round((outputTokens / maxContextWindow) * 100));
  const remainingPct = Math.max(0, 100 - (systemPct + historyPct + outputPct));

  const tps = latestMetrics?.tokensPerSecond ?? 0;
  const promptTps = latestMetrics?.promptTokensPerSecond ?? null;
  const ttft = latestMetrics?.timeToFirstTokenMs ?? 0;
  const totalDuration = latestMetrics?.totalDurationMs ? (latestMetrics.totalDurationMs / 1000).toFixed(2) : '0';

  const modelName = engineStatus?.currentModel?.name || 'Local GGUF Model';
  const activeConfig = engineStatus?.activeConfig;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-studio-surface border border-studio-border rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-5 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow blob */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-accent/15 rounded-full blur-3xl" />
        </div>

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-studio-border relative">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-accent" />
              <h3 className="font-mono text-sm font-bold text-studio-text">
                Context & KV Cache Telemetry
              </h3>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-studio-textMuted font-mono">
              <span className="text-accent font-semibold">{modelName}</span>
              <span>•</span>
              <span>{activeConfig?.threads || 4} threads</span>
              {activeConfig?.kvQuant && (
                <>
                  <span>•</span>
                  <span>KV: {activeConfig.kvQuant}</span>
                </>
              )}
              {activeConfig?.flashAttn && (
                <>
                  <span>•</span>
                  <span className="text-emerald-500">Flash-Attn</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-studio-textMuted hover:text-studio-text hover:bg-studio-card transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Context Window Usage Gauge */}
        <div className="space-y-2 bg-studio-card/60 p-4 rounded-xl border border-studio-border">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-studio-text font-semibold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-accent" />
              Context Window Utilization
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-studio-text font-bold">{totalUsed.toLocaleString()}</span>
              <span className="text-studio-textMuted">/ {maxContextWindow.toLocaleString()} tokens</span>
              <span
                className={`text-[11px] font-bold px-1.5 py-0.2 rounded ${
                  usagePercent > 85
                    ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                    : usagePercent > 60
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                    : 'bg-accent-muted text-accent border border-accent/20'
                }`}
              >
                {usagePercent}%
              </span>
            </div>
          </div>

          {/* Segmented Visual Progress Bar */}
          <div className="h-2.5 w-full bg-studio-surface rounded-full overflow-hidden flex border border-studio-border/60">
            {systemPct > 0 && (
              <div
                style={{ width: `${systemPct}%` }}
                className="bg-indigo-500 h-full transition-all duration-300"
                title={`System Prompt: ${systemPromptTokens} tokens (${systemPct}%)`}
              />
            )}
            {historyPct > 0 && (
              <div
                style={{ width: `${historyPct}%` }}
                className="bg-accent h-full transition-all duration-300"
                title={`Conversation History: ${historyTokens} tokens (${historyPct}%)`}
              />
            )}
            {outputPct > 0 && (
              <div
                style={{ width: `${outputPct}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
                title={`Generated Output: ${outputTokens} tokens (${outputPct}%)`}
              />
            )}
            <div
              style={{ width: `${remainingPct}%` }}
              className="bg-transparent h-full"
              title={`Remaining Headroom: ${remaining} tokens (${remainingPct}%)`}
            />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] font-mono text-studio-textMuted">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>System ({systemPromptTokens})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span>History ({historyTokens})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Output ({outputTokens})</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto text-studio-text">
              <span className="w-2 h-2 rounded-full bg-studio-border" />
              <span>{remaining.toLocaleString()} tokens free</span>
            </div>
          </div>
        </div>

        {/* 4 Cards Grid: Input, Output, Cached, Capacity */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {/* Card 1: Input Context Tokens */}
          <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border flex flex-col justify-between gap-1 shadow-sm">
            <div className="flex items-center justify-between text-studio-textMuted font-mono text-[11px]">
              <span>INPUT CONTEXT</span>
              <Layers className="w-3.5 h-3.5 text-accent" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-studio-text">
                {promptTokens.toLocaleString()}
                <span className="text-xs font-normal text-studio-textMuted ml-1">tokens</span>
              </div>
              <p className="text-[10.5px] text-studio-textMuted mt-0.5">
                System instructions + past {messageCount} chat turns
              </p>
            </div>
          </div>

          {/* Card 2: KV Cached Prefix Tokens */}
          <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border flex flex-col justify-between gap-1 shadow-sm">
            <div className="flex items-center justify-between text-studio-textMuted font-mono text-[11px]">
              <span>KV CACHE REUSE</span>
              <Zap className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-emerald-500">
                {cachedTokens.toLocaleString()}
                <span className="text-xs font-normal text-studio-textMuted ml-1">tokens</span>
              </div>
              <p className="text-[10.5px] text-studio-textMuted mt-0.5">
                {cacheHitRatio > 0 ? (
                  <span className="text-emerald-500 font-semibold">{cacheHitRatio}% prefix hit rate</span>
                ) : (
                  'Zero recomputation needed'
                )}
              </p>
            </div>
          </div>

          {/* Card 3: Output Tokens */}
          <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border flex flex-col justify-between gap-1 shadow-sm">
            <div className="flex items-center justify-between text-studio-textMuted font-mono text-[11px]">
              <span>GENERATED OUTPUT</span>
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-studio-text">
                {outputTokens.toLocaleString()}
                <span className="text-xs font-normal text-studio-textMuted ml-1">tokens</span>
              </div>
              <p className="text-[10.5px] text-studio-textMuted mt-0.5">
                Latest completion reply
              </p>
            </div>
          </div>

          {/* Card 4: Available Headroom */}
          <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border flex flex-col justify-between gap-1 shadow-sm">
            <div className="flex items-center justify-between text-studio-textMuted font-mono text-[11px]">
              <span>AVAILABLE CAPACITY</span>
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-studio-text">
                {remaining.toLocaleString()}
                <span className="text-xs font-normal text-studio-textMuted ml-1">tokens left</span>
              </div>
              <p className="text-[10.5px] text-studio-textMuted mt-0.5">
                Window limit: {maxContextWindow.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Speed & Inference Latency Profile */}
        <div className="p-3.5 rounded-xl bg-studio-card/80 border border-studio-border space-y-2">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-studio-text flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-accent" />
            Inference Latency & Velocity Profile
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-center">
            <div className="p-2 rounded-lg bg-studio-surface border border-studio-border/60">
              <span className="text-[10px] text-studio-textMuted block">GENERATION SPEED</span>
              <span className="text-sm font-bold text-accent">{tps} t/s</span>
            </div>
            <div className="p-2 rounded-lg bg-studio-surface border border-studio-border/60">
              <span className="text-[10px] text-studio-textMuted block">PROMPT SPEED</span>
              <span className="text-sm font-bold text-studio-text">
                {promptTps ? `${promptTps} t/s` : 'Instant'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-studio-surface border border-studio-border/60">
              <span className="text-[10px] text-studio-textMuted block">TIME TO FIRST TOKEN</span>
              <span className="text-sm font-bold text-studio-text">{ttft}ms</span>
            </div>
            <div className="p-2 rounded-lg bg-studio-surface border border-studio-border/60">
              <span className="text-[10px] text-studio-textMuted block">TOTAL RUNTIME</span>
              <span className="text-sm font-bold text-studio-text">{totalDuration}s</span>
            </div>
          </div>
        </div>

        {/* Explanation Note on KV Caching */}
        <div className="p-3 rounded-xl bg-accent-muted/40 border border-accent/20 text-xs text-studio-textMuted leading-relaxed flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-studio-text block mb-0.5">
              KV Prefix Caching & Memory Efficiency
            </span>
            <span>
              LM Studio Android preserves evaluated key/value attention tensors in RAM across multi-turn chats. When replying to questions in an ongoing conversation, cached prefix tokens are reused instantly with zero re-evaluation, saving significant battery and processor thermals.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-studio-border">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-accent text-white hover:opacity-90 transition-all"
          >
            Close Telemetry
          </button>
        </div>
      </div>
    </div>
  );
};
