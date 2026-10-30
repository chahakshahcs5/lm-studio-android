import React, { useState } from 'react';
import { useTelemetryWS } from './hooks/useTelemetryWS';
import { useTheme } from './hooks/useTheme';
import { Header } from './components/Header';
import { TelemetryHUD } from './components/TelemetryHUD';
import { ChatPlayground } from './components/ChatPlayground';
import { ModelExplorer } from './components/ModelExplorer';
import { ApiPlayground } from './components/ApiPlayground';
import { ThemeModal } from './components/ThemeModal';
import { ErrorModal, ErrorModalData } from './components/ErrorModal';

export function App() {
  const { telemetry, engineStatus, downloadState, isConnected, serverIp, refreshStatus } =
    useTelemetryWS();
  const {
    mode,
    primaryColor,
    secondaryColor,
    activePreset,
    toggleMode,
    setMode,
    applyPreset,
    updatePrimary,
    updateSecondary,
    resetToDefault,
  } = useTheme();

  const [activeTab, setActiveTab] = useState<'chat' | 'models' | 'api'>('chat');
  const [currentTps, setCurrentTps] = useState<number>(0);
  const [lastTps, setLastTps] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);
  const [isMobileTelemetryOpen, setIsMobileTelemetryOpen] = useState<boolean>(false);
  const [errorModalData, setErrorModalData] = useState<ErrorModalData | null>(null);

  const handleTpsUpdate = (liveTps: number, completedTps?: number) => {
    setCurrentTps(liveTps);
    if (completedTps && completedTps > 0) {
      setLastTps(completedTps);
    }
  };

  const showError = (opts: Partial<ErrorModalData> & { message: string }) => {
    setErrorModalData({
      isOpen: true,
      title: opts.title || 'Engine Diagnostic Notice',
      message: opts.message,
      details: opts.details,
      tips: opts.tips,
      onRetry: opts.onRetry,
      onOpenConfig: opts.onOpenConfig,
    });
  };

  const handleUnloadModel = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/unload', { method: 'POST' });
      if (res.ok) {
        refreshStatus();
      } else {
        const data = await res.json().catch(() => ({}));
        showError({
          title: 'Unload Model Failed',
          message: data.error || 'Server failed to unload model from memory.',
        });
      }
    } catch (err: any) {
      showError({
        title: 'Communication Error',
        message: err.message || 'Failed to communicate with server to unload model.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-studio-bg text-studio-text font-sans transition-colors">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        engineStatus={engineStatus}
        telemetry={telemetry}
        isConnected={isConnected}
        onUnloadModel={handleUnloadModel}
        isLoading={isLoading}
        mode={mode}
        onToggleMode={toggleMode}
        onOpenThemeModal={() => setIsThemeModalOpen(true)}
        serverIp={serverIp}
        onToggleMobileTelemetry={() => setIsMobileTelemetryOpen(!isMobileTelemetryOpen)}
        isMobileTelemetryOpen={isMobileTelemetryOpen}
      />

      {/* Main Studio Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Active Tab Screen (persisted in DOM to preserve chat & UI state) */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <div className={`flex-1 flex flex-col overflow-hidden relative ${activeTab === 'chat' ? '' : 'hidden'}`}>
            <ChatPlayground
              engineStatus={engineStatus}
              onTpsUpdate={handleTpsUpdate}
              onNavigateToModels={() => setActiveTab('models')}
              onError={showError}
            />
          </div>

          <div className={`flex-1 flex flex-col overflow-hidden relative ${activeTab === 'models' ? '' : 'hidden'}`}>
            <ModelExplorer
              engineStatus={engineStatus}
              telemetry={telemetry}
              downloadState={downloadState}
              onRefreshStatus={refreshStatus}
              onError={showError}
            />
          </div>

          <div className={`flex-1 flex flex-col overflow-hidden relative ${activeTab === 'api' ? '' : 'hidden'}`}>
            <ApiPlayground engineStatus={engineStatus} serverIp={serverIp} />
          </div>
        </main>

        {/* Real-time Hardware Telemetry Rail (Persistent on Desktop >= lg) */}
        <div className="hidden lg:flex h-full flex-shrink-0">
          <TelemetryHUD
            telemetry={telemetry}
            engineStatus={engineStatus}
            currentTps={currentTps}
            lastTps={lastTps}
          />
        </div>
      </div>

      {/* Mobile Slide-Over Hardware Drawer (< lg) */}
      {isMobileTelemetryOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden flex justify-end animate-in fade-in duration-200"
          onClick={() => setIsMobileTelemetryOpen(false)}
        >
          <div
            className="w-80 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-right duration-200 bg-studio-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <TelemetryHUD
              telemetry={telemetry}
              engineStatus={engineStatus}
              currentTps={currentTps}
              lastTps={lastTps}
              isMobileDrawer
              onCloseMobile={() => setIsMobileTelemetryOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Theme Studio & Custom Color Switcher Modal */}
      <ThemeModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        mode={mode}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        activePreset={activePreset}
        onToggleMode={toggleMode}
        onSetMode={setMode}
        onApplyPreset={applyPreset}
        onUpdatePrimary={updatePrimary}
        onUpdateSecondary={updateSecondary}
        onResetToDefault={resetToDefault}
      />

      {/* High-Fidelity Diagnostic Error Modal */}
      <ErrorModal
        data={errorModalData}
        onClose={() => setErrorModalData(null)}
      />
    </div>
  );
}

export default App;

