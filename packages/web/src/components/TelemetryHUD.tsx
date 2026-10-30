import React from 'react';
import {
  Battery,
  Flame,
  HardDrive,
  Cpu,
  Zap,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Smartphone,
  X,
  Gauge,
} from 'lucide-react';
import { EngineStatus, HardwareTelemetry } from '@lm-studio-android/shared';

interface TelemetryHUDProps {
  telemetry: HardwareTelemetry | null;
  engineStatus: EngineStatus | null;
  currentTps?: number;
  lastTps?: number;
  onCloseMobile?: () => void;
  isMobileDrawer?: boolean;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  telemetry,
  engineStatus,
  currentTps = 0,
  lastTps = 0,
  onCloseMobile,
  isMobileDrawer = false,
}) => {
  if (!telemetry) {
    return (
      <aside className="w-80 bg-studio-surface border-l border-studio-border p-4 flex flex-col items-center justify-center text-studio-textMuted text-xs h-full">
        <Activity className="w-5 h-5 animate-pulse text-accent mb-2" />
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
  const availableRamGb = formatGb(ram.availableBytes);
  const modelRamGb = engineStatus?.currentModel
    ? (engineStatus.currentModel.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)
    : '0.00';

  const isBattery =
    battery.sensorLabel?.toLowerCase().includes('battery') ||
    battery.sensorLabel?.toLowerCase().includes('bms');
  // Silicon junction (TSENS) runs normally at 50°C-75°C under LLM compute; battery limit is 45°C
  const hotThreshold = isBattery ? 45.0 : 78.0;
  const warmThreshold = isBattery ? 39.0 : 68.0;
  const isHot = battery.temperature !== null && battery.temperature >= hotThreshold;
  const isWarm = battery.temperature !== null && battery.temperature >= warmThreshold;

  // Speedometer TPS: live if generating, else last run TPS if available
  const displayTps =
    currentTps > 0
      ? currentTps.toFixed(1)
      : lastTps > 0
      ? lastTps.toFixed(1)
      : engineStatus?.lastRunTps
      ? engineStatus.lastRunTps.toFixed(1)
      : '0.0';

  const isActivelyGenerating = currentTps > 0;

  return (
    <aside className="w-80 max-w-full bg-studio-surface border-l border-studio-border flex flex-col h-full overflow-y-auto select-none p-4 gap-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-studio-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-studio-text">
            Hardware Inspector
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] font-mono text-accent bg-accent-muted px-2 py-0.5 rounded border border-accent/20">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isActivelyGenerating ? 'bg-accent animate-ping' : 'bg-emerald-500'
              }`}
            />
            {isActivelyGenerating ? 'Inference ⚡' : '1Hz Live'}
          </span>

          {isMobileDrawer && onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1 rounded-md text-studio-textMuted hover:text-studio-text hover:bg-studio-card transition-colors"
              title="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Device & Processor Header Chip */}
      {(cpu.deviceModel || cpu.socModel) && (
        <div className="p-2.5 rounded-xl bg-studio-card border border-studio-border flex items-center justify-between gap-2 shadow-studio-subtle text-xs flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Smartphone className="w-4 h-4 text-accent flex-shrink-0" />
            <div className="min-w-0">
              <span className="font-mono text-[11px] font-bold text-studio-text block truncate">
                {cpu.deviceModel || 'Android Device'}
              </span>
              <span className="text-[10px] text-studio-textMuted block truncate">
                {cpu.socModel || `${cpu.totalCores} Cores (${cpu.architecture})`}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-studio-surface border border-studio-borderSubtle text-accent font-semibold flex-shrink-0">
            {cpu.architecture}
          </span>
        </div>
      )}

      {/* Thermal & Throttle Alert if triggered */}
      {isThrottled && (
        <div className="p-3 rounded-xl bg-crimson-muted border border-crimson-accent/40 text-xs flex items-start gap-2.5 animate-pulse flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-crimson-accent flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-crimson-accent block">Thermal Throttle Warning</span>
            <p className="text-[11px] text-studio-textMuted mt-0.5">
              {isBattery ? 'Battery' : 'SoC processor'} temperature is high ({battery.temperature}°C). Consider reducing threads or pausing generation.
            </p>
          </div>
        </div>
      )}

      {/* Real-time Token Speedometer Badge */}
      <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border relative shadow-studio-subtle flex-shrink-0 flex flex-col justify-between min-h-[115px]">
        <div className="flex items-center justify-between text-xs text-studio-textMuted">
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-accent" />
            <span className="font-semibold text-studio-text">Throughput Speed</span>
          </div>
          <span
            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border transition-all ${
              isActivelyGenerating
                ? 'bg-accent text-white border-accent shadow-accent-glow animate-pulse'
                : parseFloat(displayTps) > 0
                ? 'bg-accent-muted text-accent border-accent/30'
                : 'bg-studio-surface text-studio-textMuted border-studio-borderSubtle'
            }`}
          >
            {isActivelyGenerating ? 'Generating ⚡' : parseFloat(displayTps) > 0 ? 'Last Run' : 'Standby'}
          </span>
        </div>

        <div className="flex items-baseline gap-2 my-1">
          <span className="font-mono text-3xl font-extrabold text-accent tracking-tight leading-none">
            {displayTps}
          </span>
          <span className="font-mono text-xs font-semibold text-studio-textMuted">tokens / sec</span>
        </div>

        {/* Live Generation Pulse Bar */}
        <div className="w-full h-1 bg-studio-surface rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isActivelyGenerating
                ? 'bg-accent animate-pulse w-full'
                : parseFloat(displayTps) > 0
                ? 'bg-accent-muted w-2/3'
                : 'bg-studio-borderSubtle w-0'
            }`}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-studio-textMuted pt-1.5 border-t border-studio-borderSubtle">
          <span>Total Generated</span>
          <span className="text-studio-text font-bold">
            {engineStatus?.tokensGeneratedTotal || 0} tokens
          </span>
        </div>
      </div>

      {/* Live CPU Topology & Dynamic Core Loads */}
      <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border flex flex-col gap-3 shadow-studio-subtle flex-shrink-0">
        <div className="flex items-center justify-between text-xs font-semibold text-studio-text">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-studio-textMuted" />
            <span>ARM CPU & Live Cores</span>
          </div>
          <span className="font-mono text-accent text-xs">
            {cpu.overallCpuUsage !== undefined ? `${cpu.overallCpuUsage}% Load` : `${cpu.totalCores} Cores`}
          </span>
        </div>

        {/* Overall CPU Load Bar */}
        {cpu.overallCpuUsage !== undefined && (
          <div className="w-full h-1.5 bg-studio-surface rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                cpu.overallCpuUsage > 80
                  ? 'bg-crimson-accent'
                  : cpu.overallCpuUsage > 50
                  ? 'bg-amber-accent'
                  : 'bg-accent'
              }`}
              style={{ width: `${Math.min(100, Math.max(2, cpu.overallCpuUsage))}%` }}
            />
          </div>
        )}

        {/* Visual Core Grid with Live % & Progress Meters */}
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: cpu.totalCores }).map((_, idx) => {
            const isBig = cpu.bigCores.includes(idx);
            const isPinned = config?.pinCores && isBig;
            const coreLoad = cpu.coreUsages?.[idx] ?? 0;

            const isHighLoad = coreLoad >= 70;
            const isMidLoad = coreLoad >= 35;

            return (
              <div
                key={idx}
                className={`relative overflow-hidden flex flex-col items-center justify-between p-1.5 rounded-lg border text-center transition-all ${
                  isPinned
                    ? 'border-accent/50 shadow-accent-glow bg-accent-muted/20'
                    : isBig
                    ? 'border-studio-border bg-studio-surface'
                    : 'border-studio-borderSubtle bg-studio-surface/50'
                }`}
                title={`Core ${idx} (${isBig ? 'Big Performance' : 'Little Efficiency'}): ${coreLoad}% load`}
              >
                {/* Background Core Load Fill */}
                <div
                  className={`absolute bottom-0 left-0 right-0 opacity-25 transition-all duration-300 pointer-events-none ${
                    isHighLoad
                      ? 'bg-crimson-accent'
                      : isMidLoad
                      ? 'bg-amber-accent'
                      : 'bg-accent'
                  }`}
                  style={{ height: `${Math.min(100, Math.max(4, coreLoad))}%` }}
                />

                <div className="w-full flex items-center justify-between text-[9px] font-mono font-bold leading-none z-10">
                  <span className={isPinned ? 'text-accent' : 'text-studio-text'}>C{idx}</span>
                  <span className={`text-[8px] uppercase ${isBig ? 'text-accent' : 'text-studio-textMuted'}`}>
                    {isBig ? 'BIG' : 'LIT'}
                  </span>
                </div>

                <span
                  className={`font-mono text-[10px] font-extrabold mt-1 z-10 ${
                    isHighLoad
                      ? 'text-crimson-accent'
                      : isMidLoad
                      ? 'text-amber-accent'
                      : coreLoad > 10
                      ? 'text-accent'
                      : 'text-studio-textMuted'
                  }`}
                >
                  {coreLoad}%
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-studio-textMuted pt-1 border-t border-studio-borderSubtle">
          <span>Active Threads</span>
          <span className="font-mono text-accent font-bold">
            {config?.threads || cpu.recommendedThreads} Threads
          </span>
        </div>
      </div>

      {/* Battery & Thermal Station */}
      <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border flex flex-col gap-3 shadow-studio-subtle flex-shrink-0">
        <div className="flex items-center justify-between text-xs font-semibold text-studio-text">
          <div className="flex items-center gap-1.5">
            <Battery className="w-4 h-4 text-studio-textMuted" />
            <span>Power & Battery</span>
          </div>
          <span className="font-mono text-accent font-bold">
            {battery.level !== null ? `${battery.level}%` : '--%'}
          </span>
        </div>

        {/* Battery Progress Bar */}
        <div className="w-full h-1.5 bg-studio-surface rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              battery.level === null
                ? 'w-0'
                : battery.level <= 20
                ? 'bg-crimson-accent'
                : battery.level <= 40
                ? 'bg-amber-accent'
                : 'bg-accent'
            }`}
            style={{ width: battery.level !== null ? `${battery.level}%` : '0%' }}
          />
        </div>

        {battery.level === null && (
          <p className="text-[10px] text-studio-textMuted -mt-1 leading-tight">
            Battery level restricted by SELinux. Run{' '}
            <code className="text-accent bg-studio-surface px-1 py-0.5 rounded font-mono text-[9px]">
              pkg install termux-api
            </code>{' '}
            for live stats.
          </p>
        )}

        {/* Temperature Reading */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <div className="flex items-center gap-1.5">
            <Flame
              className={`w-3.5 h-3.5 ${
                isHot
                  ? 'text-crimson-accent'
                  : isWarm
                  ? 'text-amber-accent'
                  : 'text-accent'
              }`}
            />
            <span className="text-studio-textMuted">
              {battery.sensorLabel || 'Device Temp'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`font-mono font-bold ${
                isHot
                  ? 'text-crimson-accent'
                  : isWarm
                  ? 'text-amber-accent'
                  : 'text-accent'
              }`}
            >
              {battery.temperature !== null ? `${battery.temperature}°C` : 'N/A'}
            </span>
            {battery.temperature !== null && !isHot && (
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                Optimal
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-studio-textMuted pt-1 border-t border-studio-borderSubtle">
          <span>Power Source</span>
          <span className="font-mono text-studio-text font-medium">
            {battery.isCharging ? '⚡ Fast Charging' : '🔋 On Battery'}
          </span>
        </div>
      </div>

      {/* Unified RAM Allocation Station */}
      <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border flex flex-col gap-3 shadow-studio-subtle flex-shrink-0">
        <div className="flex items-center justify-between text-xs font-semibold text-studio-text">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-studio-textMuted" />
            <span>Unified LPDDR RAM</span>
          </div>
          <span className="font-mono text-accent font-bold">{ram.percentUsed}%</span>
        </div>

        {/* Multi-segment RAM Visualizer */}
        <div className="w-full h-2 bg-studio-surface rounded-full overflow-hidden flex">
          {/* Model Weights Segment */}
          {parseFloat(modelRamGb) > 0 && (
            <div
              className="h-full bg-accent"
              style={{ width: `${(parseFloat(modelRamGb) / parseFloat(totalRamGb)) * 100}%` }}
              title={`Model: ${modelRamGb} GB`}
            />
          )}
          {/* System/App Segment */}
          <div
            className="h-full bg-accent-muted"
            style={{
              width: `${Math.max(
                0,
                ram.percentUsed - (parseFloat(modelRamGb) / parseFloat(totalRamGb)) * 100
              )}%`,
            }}
            title="System & Apps"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
          <div className="bg-studio-surface p-2 rounded-lg border border-studio-borderSubtle">
            <span className="text-studio-textMuted block text-[10px]">USED RAM</span>
            <span className="text-studio-text font-bold">{usedRamGb} GB</span>
          </div>
          <div className="bg-studio-surface p-2 rounded-lg border border-studio-borderSubtle">
            <span className="text-studio-textMuted block text-[10px]">TOTAL RAM</span>
            <span className="text-studio-text font-bold">{totalRamGb} GB</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-studio-textMuted pt-1 border-t border-studio-borderSubtle">
          <span>Available RAM</span>
          <span className="font-mono text-emerald-400 font-bold">{availableRamGb} GB</span>
        </div>

        {engineStatus?.currentModel && (
          <div className="flex items-center justify-between text-[11px] text-studio-textMuted">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent inline-block" />
              Model Buffer
            </span>
            <span className="font-mono text-accent font-semibold">{modelRamGb} GB</span>
          </div>
        )}
      </div>

      {/* Active Acceleration Badges */}
      {config && (
        <div className="p-3.5 rounded-xl bg-studio-card border border-studio-border flex flex-col gap-2 shadow-studio-subtle flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-studio-text mb-1">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>Active Acceleration</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {config.flashAttn && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-accent-muted text-accent border border-accent/30 font-semibold">
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
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-studio-surface text-studio-textMuted border border-studio-border font-semibold">
                Core Pinning (taskset)
              </span>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
