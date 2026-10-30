import React from 'react';
import { Battery, Flame, HardDrive, Cpu, Zap, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';
import { EngineStatus, HardwareTelemetry } from '@lm-studio-android/shared';

interface TelemetryHUDProps {
  telemetry: HardwareTelemetry | null;
  engineStatus: EngineStatus | null;
  currentTps?: number;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  telemetry,
  engineStatus,
  currentTps = 0,
}) => {
  if (!telemetry) {
    return (
      <aside className="w-72 bg-studio-surface border-l border-studio-border p-4 flex flex-col items-center justify-center text-slate-500 text-xs">
        <Activity className="w-5 h-5 animate-pulse text-emerald-accent mb-2" />
        <span>Connecting to hardware telemetry...</span>
      </aside>
    );
  }

  const { battery, cpu, ram, isThrottled } = telemetry;
  const config = engineStatus?.activeConfig;

  // Format RAM bytes to GB
  const formatGb = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2);
  const totalRamGb = formatGb(ram.totalBytes);
  const usedRamGb = formatGb(ram.usedBytes);
  const modelRamGb = engineStatus?.currentModel
    ? (engineStatus.currentModel.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)
    : '0.00';

  const isHot = battery.temperature !== null && battery.temperature >= 42.0;

  return (
    <aside className="w-80 bg-studio-surface border-l border-studio-border flex flex-col h-full overflow-y-auto select-none p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-studio-border">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-accent" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            Hardware Inspector
          </h3>
        </div>
        <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-accent bg-emerald-muted px-2 py-0.5 rounded border border-emerald-accent/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-accent animate-ping" />
          1Hz Live
        </span>
      </div>

      {/* Thermal & Throttle Alert if triggered */}
      {isThrottled && (
        <div className="p-3 rounded-lg bg-crimson-muted border border-crimson-accent/40 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-crimson-accent flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-crimson-accent block">Thermal Throttle Warning</span>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Phone temperature is high ({battery.temperature}°C). Consider lowering thread count or pausing generation.
            </p>
          </div>
        </div>
      )}

      {/* Real-time Token Speedometer Badge */}
      <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>Inference Throughput</span>
          <Zap className="w-3.5 h-3.5 text-emerald-accent" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-extrabold text-emerald-accent tracking-tight">
            {currentTps > 0 ? currentTps.toFixed(1) : (engineStatus?.averageTps?.toFixed(1) || '0.0')}
          </span>
          <span className="font-mono text-xs font-semibold text-slate-400">tokens / sec</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-studio-borderSubtle">
          <span>Total Generated</span>
          <span className="text-slate-300">{engineStatus?.tokensGeneratedTotal || 0} tokens</span>
        </div>
      </div>

      {/* Battery & Thermal Station */}
      <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <div className="flex items-center gap-1.5">
            <Battery className="w-4 h-4 text-slate-400" />
            <span>Power & Battery</span>
          </div>
          <span className="font-mono text-emerald-accent">{battery.level ?? '--'}%</span>
        </div>

        {/* Battery Progress Bar */}
        <div className="w-full h-1.5 bg-studio-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-accent transition-all duration-300"
            style={{ width: `${battery.level ?? 0}%` }}
          />
        </div>

        {/* Temperature Reading */}
        <div className="flex items-center justify-between pt-2 border-t border-studio-borderSubtle text-xs">
          <div className="flex items-center gap-1.5">
            <Flame className={`w-3.5 h-3.5 ${isHot ? 'text-crimson-accent' : 'text-amber-accent'}`} />
            <span className="text-slate-400">Battery Temp</span>
          </div>
          <span
            className={`font-mono font-bold ${
              isHot ? 'text-crimson-accent' : battery.temperature && battery.temperature >= 38 ? 'text-amber-accent' : 'text-emerald-accent'
            }`}
          >
            {battery.temperature !== null ? `${battery.temperature}°C` : 'N/A'}
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Charging State</span>
          <span className="font-mono text-slate-300">
            {battery.isCharging ? '⚡ Fast Charging' : 'Discharging'}
          </span>
        </div>
      </div>

      {/* RAM Allocation Station */}
      <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-slate-400" />
            <span>Unified LPDDR RAM</span>
          </div>
          <span className="font-mono text-emerald-accent">{ram.percentUsed}%</span>
        </div>

        {/* Multi-segment RAM Visualizer */}
        <div className="w-full h-2 bg-studio-surface rounded-full overflow-hidden flex">
          {/* Model Weights Segment */}
          {parseFloat(modelRamGb) > 0 && (
            <div
              className="h-full bg-cyan-accent"
              style={{ width: `${(parseFloat(modelRamGb) / parseFloat(totalRamGb)) * 100}%` }}
              title={`Model: ${modelRamGb} GB`}
            />
          )}
          {/* System/App Segment */}
          <div
            className="h-full bg-emerald-accent/60"
            style={{
              width: `${Math.max(
                0,
                ram.percentUsed - (parseFloat(modelRamGb) / parseFloat(totalRamGb)) * 100
              )}%`,
            }}
            title="System & OS"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
          <div className="bg-studio-surface p-2 rounded border border-studio-borderSubtle">
            <span className="text-slate-500 block text-[10px]">USED RAM</span>
            <span className="text-slate-200 font-bold">{usedRamGb} GB</span>
          </div>
          <div className="bg-studio-surface p-2 rounded border border-studio-borderSubtle">
            <span className="text-slate-500 block text-[10px]">TOTAL RAM</span>
            <span className="text-slate-200 font-bold">{totalRamGb} GB</span>
          </div>
        </div>

        {engineStatus?.currentModel && (
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-accent inline-block" />
              Model Buffer
            </span>
            <span className="font-mono text-cyan-accent font-semibold">{modelRamGb} GB</span>
          </div>
        )}
      </div>

      {/* CPU Core Topology & Pinning Map */}
      <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-slate-400" />
            <span>ARM CPU Topology</span>
          </div>
          <span className="font-mono text-slate-400">{cpu.totalCores} Cores</span>
        </div>

        {/* Visual Core Grid */}
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: cpu.totalCores }).map((_, idx) => {
            const isBig = cpu.bigCores.includes(idx);
            const isPinned = config?.pinCores && isBig;

            return (
              <div
                key={idx}
                className={`flex flex-col items-center justify-center p-1.5 rounded border text-center transition-all ${
                  isPinned
                    ? 'bg-emerald-muted border-emerald-accent/40 shadow-glow-emerald'
                    : isBig
                    ? 'bg-studio-surface border-slate-700 text-slate-300'
                    : 'bg-studio-surface/50 border-studio-borderSubtle text-slate-600'
                }`}
                title={`Core ${idx}: ${isBig ? 'Big Performance Core' : 'Little Efficiency Core'}`}
              >
                <span className="font-mono text-[10px] font-bold">C{idx}</span>
                <span className="text-[9px] font-mono uppercase tracking-tighter">
                  {isBig ? 'BIG' : 'LIT'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span>Active Threads</span>
          <span className="font-mono text-emerald-accent font-bold">
            {config?.threads || cpu.recommendedThreads} Threads
          </span>
        </div>
      </div>

      {/* Active Acceleration Badges */}
      {config && (
        <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-accent" />
            <span>Active Acceleration</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {config.flashAttn && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-muted text-emerald-accent border border-emerald-accent/30 font-semibold">
                Flash-Attention
              </span>
            )}
            {config.kvQuant && config.kvQuant !== 'f16' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-muted text-cyan-accent border border-cyan-accent/30 font-semibold">
                KV: {config.kvQuant}
              </span>
            )}
            {config.gpuLayers > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-muted text-amber-accent border border-amber-accent/30 font-semibold">
                GPU: {config.gpuLayers} Layers
              </span>
            )}
            {config.pinCores && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                Core Pinning (taskset)
              </span>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
