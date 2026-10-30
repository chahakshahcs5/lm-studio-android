import React from 'react';
import { Cpu, HardDrive, Battery, Zap, Terminal, Database, Sparkles, RefreshCw } from 'lucide-react';
import { EngineStatus, HardwareTelemetry } from '@lm-studio-android/shared';

interface HeaderProps {
  activeTab: 'chat' | 'models' | 'api';
  setActiveTab: (tab: 'chat' | 'models' | 'api') => void;
  engineStatus: EngineStatus | null;
  telemetry: HardwareTelemetry | null;
  isConnected: boolean;
  onUnloadModel: () => Promise<void>;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  engineStatus,
  telemetry,
  isConnected,
  onUnloadModel,
  isLoading,
}) => {
  const isLoaded = engineStatus?.loaded;
  const currentModel = engineStatus?.currentModel;
  const battery = telemetry?.battery;
  const ram = telemetry?.ram;

  // Temperature color logic
  const temp = battery?.temperature;
  const tempColor =
    temp === null || temp === undefined
      ? 'text-slate-400'
      : temp >= 44
      ? 'text-crimson-accent font-bold animate-pulse'
      : temp >= 38
      ? 'text-amber-accent'
      : 'text-emerald-accent';

  return (
    <header className="h-16 bg-studio-surface border-b border-studio-border px-5 flex items-center justify-between flex-shrink-0 z-30 select-none">
      {/* Brand & Connection */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-accent to-emerald-600 flex items-center justify-center text-slate-950 shadow-glow-emerald">
            <Zap className="w-5 h-5 fill-slate-950 stroke-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm font-bold tracking-tight text-slate-100">LM STUDIO</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-muted text-emerald-accent border border-emerald-accent/30">
                ANDROID
              </span>
            </div>
            <p className="text-[11px] text-slate-400 tracking-wide font-medium">Edge AI Coprocessor</p>
          </div>
        </div>

        {/* Connection status pill */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-studio-card border border-studio-border text-xs font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-accent shadow-[0_0_8px_#00f5a0]' : 'bg-crimson-accent'
            }`}
          />
          <span className="text-slate-300">{isConnected ? 'Bridge Active' : 'Connecting...'}</span>
        </div>
      </div>

      {/* Model State Pill in Center */}
      <div className="hidden lg:flex items-center gap-3">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-studio-card border border-studio-border">
          <Database className="w-4 h-4 text-emerald-accent" />
          <div className="text-xs">
            <span className="text-slate-400 mr-1.5">Mounted:</span>
            {isLoaded ? (
              <span className="font-mono font-semibold text-emerald-accent">
                {currentModel?.name}
              </span>
            ) : (
              <span className="font-mono text-slate-500 italic">No model loaded</span>
            )}
          </div>
        </div>

        {isLoaded && (
          <button
            onClick={onUnloadModel}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-crimson-accent bg-crimson-muted border border-crimson-accent/30 hover:bg-crimson-accent/20 transition-all duration-150 active:scale-95 disabled:opacity-50"
            title="Terminate inference process and free 100% of phone RAM"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Free RAM</span>
          </button>
        )}
      </div>

      {/* Navigation & Telemetry Quick Glance */}
      <div className="flex items-center gap-4">
        {/* Hardware Quick Glance Bar */}
        {telemetry && (
          <div className="hidden xl:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-studio-card/80 border border-studio-border text-xs font-mono">
            {/* Battery & Temp */}
            <div className="flex items-center gap-1.5" title="Phone Battery & Temperature">
              <Battery className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-200">{battery?.level ?? '--'}%</span>
              <span className={`text-[11px] ${tempColor}`}>{temp !== null ? `${temp}°C` : ''}</span>
            </div>

            <div className="w-px h-3.5 bg-studio-border" />

            {/* RAM */}
            <div className="flex items-center gap-1.5" title="RAM Utilization">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-200">{ram?.percentUsed ?? '--'}%</span>
            </div>

            <div className="w-px h-3.5 bg-studio-border" />

            {/* Cores */}
            <div className="flex items-center gap-1.5" title="Detected CPU Cores">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-300">{telemetry.cpu.totalCores}C</span>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="flex items-center p-1 rounded-lg bg-studio-card border border-studio-border">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              activeTab === 'chat'
                ? 'bg-studio-surface text-emerald-accent shadow-sm border border-emerald-accent/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              activeTab === 'models'
                ? 'bg-studio-surface text-emerald-accent shadow-sm border border-emerald-accent/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Models</span>
          </button>

          <button
            onClick={() => setActiveTab('api')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              activeTab === 'api'
                ? 'bg-studio-surface text-emerald-accent shadow-sm border border-emerald-accent/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>API Docs</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
