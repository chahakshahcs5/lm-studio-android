import React, { useState } from 'react';
import {
  Cpu,
  HardDrive,
  Battery,
  Zap,
  Terminal,
  Database,
  Sparkles,
  RefreshCw,
  Sun,
  Moon,
  Wifi,
  Copy,
  Check,
  Palette,
  Activity,
} from 'lucide-react';
import { EngineStatus, HardwareTelemetry } from '@lm-studio-android/shared';
import { copyToClipboard } from '../utils/clipboard';

interface HeaderProps {
  activeTab: 'chat' | 'models' | 'api';
  setActiveTab: (tab: 'chat' | 'models' | 'api') => void;
  engineStatus: EngineStatus | null;
  telemetry: HardwareTelemetry | null;
  isConnected: boolean;
  onUnloadModel: () => Promise<void>;
  isLoading: boolean;
  mode: 'dark' | 'light';
  onToggleMode: () => void;
  onOpenThemeModal: () => void;
  serverIp?: string;
  onToggleMobileTelemetry?: () => void;
  isMobileTelemetryOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  engineStatus,
  telemetry,
  isConnected,
  onUnloadModel,
  isLoading,
  mode,
  onToggleMode,
  onOpenThemeModal,
  serverIp,
  onToggleMobileTelemetry,
  isMobileTelemetryOpen = false,
}) => {
  const [copiedIp, setCopiedIp] = useState(false);

  const isLoaded = engineStatus?.loaded;
  const currentModel = engineStatus?.currentModel;
  const battery = telemetry?.battery;
  const ram = telemetry?.ram;

  // Temperature color logic
  const temp = battery?.temperature;
  const isBatterySensor =
    battery?.sensorLabel?.toLowerCase().includes('battery') ||
    battery?.sensorLabel?.toLowerCase().includes('bms');
  const tempLimit = isBatterySensor ? 45 : 78;
  const tempWarn = isBatterySensor ? 39 : 68;
  const tempColor =
    temp === null || temp === undefined
      ? 'text-studio-textMuted'
      : temp >= tempLimit
      ? 'text-crimson-accent font-bold animate-pulse'
      : temp >= tempWarn
      ? 'text-amber-accent'
      : 'text-accent';

  // Wi-Fi LAN URL
  const ip =
    serverIp || (window.location.hostname !== 'localhost' ? window.location.hostname : '192.168.1.16');
  const lanUrl = `http://${ip}:8080`;

  const handleCopyLanUrl = async () => {
    const ok = await copyToClipboard(lanUrl);
    if (ok) {
      setCopiedIp(true);
      setTimeout(() => setCopiedIp(false), 2000);
    }
  };

  return (
    <header className="h-16 bg-studio-surface border-b border-studio-border px-4 md:px-6 flex items-center justify-between flex-shrink-0 z-30 select-none transition-colors">
      {/* Brand & Connection */}
      <div className="flex items-center gap-4 lg:gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center shadow-accent-glow transition-all">
            <Zap className="w-4 h-4 fill-white stroke-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm font-bold tracking-tight text-studio-text">
                LM STUDIO
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-accent-muted text-accent border border-accent/20">
                ANDROID
              </span>
            </div>
            <p className="text-[11px] text-studio-textMuted tracking-wide font-medium">
              Smartphone AI Accelerator
            </p>
          </div>
        </div>

        {/* Local Wi-Fi LAN Pill */}
        <button
          onClick={handleCopyLanUrl}
          className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-studio-card border border-studio-border text-xs font-mono hover:border-accent transition-all group"
          title="Click to copy Local Wi-Fi LAN URL"
        >
          <Wifi className="w-3.5 h-3.5 text-accent" />
          <span className="text-studio-textMuted font-sans">LAN:</span>
          <span className="font-semibold text-studio-text group-hover:text-accent transition-colors">
            {lanUrl}
          </span>
          {copiedIp ? (
            <Check className="w-3 h-3 text-accent" />
          ) : (
            <Copy className="w-3 h-3 text-studio-textMuted opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      </div>

      {/* Model State Pill in Center (Desktop) */}
      <div className="hidden lg:flex items-center gap-3">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-studio-card border border-studio-border shadow-studio-subtle">
          <Database className="w-4 h-4 text-accent" />
          <div className="text-xs">
            <span className="text-studio-textMuted mr-1.5">Mounted:</span>
            {isLoaded ? (
              <span className="font-mono font-semibold text-accent">
                {currentModel?.name}
              </span>
            ) : (
              <span className="font-mono text-studio-textMuted italic">Standby (No model loaded)</span>
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

      {/* Right Controls: Mobile Drawer Toggle + Tabs + Theme Switcher */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Mounted Pill */}
        {isLoaded && (
          <div className="flex lg:hidden items-center gap-1.5 px-2 py-1 rounded-lg bg-studio-card border border-studio-border text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="font-mono text-[10px] text-accent font-semibold truncate max-w-[80px] sm:max-w-[120px]">
              {currentModel?.name}
            </span>
            <button
              onClick={onUnloadModel}
              disabled={isLoading}
              className="p-0.5 rounded text-crimson-accent hover:bg-crimson-muted transition-colors"
              title="Free RAM"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}

        {/* Mobile Hardware Inspector Button */}
        {onToggleMobileTelemetry && (
          <button
            onClick={onToggleMobileTelemetry}
            className={`lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all border ${
              isMobileTelemetryOpen
                ? 'bg-accent text-white border-accent shadow-accent-glow'
                : 'bg-studio-card border-studio-border text-studio-text hover:border-accent'
            }`}
            title="Toggle Hardware Inspector"
          >
            <Activity className="w-3.5 h-3.5 text-accent" />
            <span className="hidden sm:inline text-xs font-sans">HUD</span>
            {telemetry?.cpu.overallCpuUsage !== undefined && (
              <span className="text-[10px] font-bold">
                {telemetry.cpu.overallCpuUsage}%
              </span>
            )}
          </button>
        )}
        {/* Navigation Tabs */}
        <nav className="flex items-center p-1 rounded-lg bg-studio-card border border-studio-border">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              activeTab === 'chat'
                ? 'bg-studio-surface text-accent shadow-sm border border-accent/20'
                : 'text-studio-textMuted hover:text-studio-text'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              activeTab === 'models'
                ? 'bg-studio-surface text-accent shadow-sm border border-accent/20'
                : 'text-studio-textMuted hover:text-studio-text'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Models</span>
          </button>

          <button
            onClick={() => setActiveTab('api')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              activeTab === 'api'
                ? 'bg-studio-surface text-accent shadow-sm border border-accent/20'
                : 'text-studio-textMuted hover:text-studio-text'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>API</span>
          </button>
        </nav>

        {/* Theme Studio & Custom Color Switcher Button */}
        <button
          onClick={onOpenThemeModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-studio-card border border-studio-border text-studio-textMuted hover:text-studio-text hover:border-accent transition-all group"
          title="Customize Theme & Palette (Primary/Secondary Colors)"
        >
          <Palette className="w-4 h-4 text-accent transition-transform group-hover:rotate-12" />
          <span className="text-xs font-medium hidden md:inline">Theme</span>
        </button>

        {/* Quick Light / Dark Mode Toggle */}
        <button
          onClick={onToggleMode}
          className="p-2 rounded-lg bg-studio-card border border-studio-border text-studio-textMuted hover:text-studio-text transition-all active:scale-95"
          title={`Switch to ${mode === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {mode === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-500" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-500" />
          )}
        </button>
      </div>
    </header>
  );
};
