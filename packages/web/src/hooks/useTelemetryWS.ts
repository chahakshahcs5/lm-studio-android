import { useState, useEffect, useRef, useCallback } from 'react';
import { DownloadState, EngineStatus, HardwareTelemetry } from '@lm-studio-android/shared';

export function useTelemetryWS() {
  const [telemetry, setTelemetry] = useState<HardwareTelemetry | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? 'localhost:8080' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'telemetry') {
            setTelemetry(msg.data);
          } else if (msg.type === 'engine_status') {
            setEngineStatus(msg.data);
          } else if (msg.type === 'download_progress') {
            setDownloadState(msg.data);
          }
        } catch (e) {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Exponential reconnect
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Refresh status via REST fallback
  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        if (data.engine) setEngineStatus(data.engine);
        if (data.telemetry) setTelemetry(data.telemetry);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  return {
    telemetry,
    engineStatus,
    downloadState,
    isConnected,
    refreshStatus,
  };
}
