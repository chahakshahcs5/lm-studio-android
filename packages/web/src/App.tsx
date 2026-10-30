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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);
  const [errorModalData, setErrorModalData] = useState<ErrorModalData | null>(null);

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
      }
    } catch {
      // ignore
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
      />

      {/* Main Studio Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Active Tab Screen */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activeTab === 'chat' && (
            <ChatPlayground
              engineStatus={engineStatus}
              onTpsUpdate={setCurrentTps}
              onNavigateToModels={() => setActiveTab('models')}
              onError={showError}
            />
          )}

          {activeTab === 'models' && (
            <ModelExplorer
              engineStatus={engineStatus}
              telemetry={telemetry}
              downloadState={downloadState}
              onRefreshStatus={refreshStatus}
              onError={showError}
            />
          )}

          {activeTab === 'api' && (
            <ApiPlayground engineStatus={engineStatus} serverIp={serverIp} />
          )}
        </main>

        {/* Real-time Hardware Telemetry Rail */}
        <TelemetryHUD
          telemetry={telemetry}
          engineStatus={engineStatus}
          currentTps={currentTps}
        />
      </div>

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

