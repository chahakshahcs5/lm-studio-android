import { useState, useEffect, useRef, useCallback } from 'react';
import { DownloadState, EngineStatus, HardwareTelemetry } from '@lm-studio-android/shared';

export function useTelemetryWS() {
  const [telemetry, setTelemetry] = useState<HardwareTelemetry | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [serverIp, setServerIp] = useState<string>('127.0.0.1');
  const wsRef = useRef<WebSocket | null>(null);
  const retryDelayRef = useRef<number>(1000);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        retryDelayRef.current = 1000; // Reset backoff on successful connect
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
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(delay * 1.5, 10000); // Exponential backoff up to 10s
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 1.5, 10000);
      reconnectTimerRef.current = setTimeout(connect, delay);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
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
        if (data.ip) setServerIp(data.ip);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    telemetry,
    engineStatus,
    downloadState,
    isConnected,
    serverIp,
    refreshStatus,
  };
}
