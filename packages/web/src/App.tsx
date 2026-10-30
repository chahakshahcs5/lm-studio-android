import React, { useState } from 'react';
import { useTelemetryWS } from './hooks/useTelemetryWS';
import { Header } from './components/Header';
import { TelemetryHUD } from './components/TelemetryHUD';
import { ChatPlayground } from './components/ChatPlayground';
import { ModelExplorer } from './components/ModelExplorer';
import { ApiPlayground } from './components/ApiPlayground';

export function App() {
  const { telemetry, engineStatus, downloadState, isConnected, refreshStatus } = useTelemetryWS();
  const [activeTab, setActiveTab] = useState<'chat' | 'models' | 'api'>('chat');
  const [currentTps, setCurrentTps] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-studio-bg text-slate-100 font-sans">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        engineStatus={engineStatus}
        telemetry={telemetry}
        isConnected={isConnected}
        onUnloadModel={handleUnloadModel}
        isLoading={isLoading}
      />

      {/* Main Studio Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Active Tab Screen */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activeTab === 'chat' && (
            <ChatPlayground engineStatus={engineStatus} onTpsUpdate={setCurrentTps} />
          )}

          {activeTab === 'models' && (
            <ModelExplorer
              engineStatus={engineStatus}
              telemetry={telemetry}
              downloadState={downloadState}
              onRefreshStatus={refreshStatus}
            />
          )}

          {activeTab === 'api' && <ApiPlayground engineStatus={engineStatus} />}
        </main>

        {/* Real-time Hardware Telemetry Rail */}
        <TelemetryHUD
          telemetry={telemetry}
          engineStatus={engineStatus}
          currentTps={currentTps}
        />
      </div>
    </div>
  );
}

export default App;
