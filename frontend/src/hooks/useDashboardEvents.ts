import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActivityEvent, ToastNotification, TranscriptEntry } from '../types';

interface UseDashboardEventsOptions {
  onAppointmentChanged?: () => void;
  onCallStatusEvent?: (type: string, payload: Record<string, unknown>) => void;
}

export function useDashboardEvents(options: UseDashboardEventsOptions = {}) {
  const [wsConnected, setWsConnected] = useState(false);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [serverTranscripts, setServerTranscripts] = useState<TranscriptEntry[]>([]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const pushToast = useCallback(
    (type: ToastNotification['type'], title: string, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastNotification = {
        id,
        type,
        title,
        message,
        timestamp: new Date().toISOString(),
      };
      setToasts((prev) => [item, ...prev].slice(0, 5));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearServerTranscripts = useCallback(() => {
    setServerTranscripts([]);
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${host}/ws/events`;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
        pingTimer = window.setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 25000);
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (pingTimer) clearInterval(pingTimer);
        if (!unmounted) {
          reconnectTimer = window.setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return;

          if (data.type === 'history' && Array.isArray(data.events)) {
            setActivities(data.events);
            return;
          }

          const activityItem: ActivityEvent = {
            type: data.type,
            payload: data.payload || {},
            timestamp: data.timestamp || new Date().toISOString(),
          };

          if (data.type !== 'transcript') {
            setActivities((prev) => [activityItem, ...prev].slice(0, 60));
          }

          if (data.type === 'transcript') {
            const p = data.payload || {};
            const entry: TranscriptEntry = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              role: p.role === 'user' ? 'user' : 'assistant',
              text: String(p.text || ''),
              timestamp: activityItem.timestamp,
              isFinal: Boolean(p.final ?? true),
            };
            if (entry.text.trim()) {
              setServerTranscripts((prev) => [...prev, entry]);
            }
          } else if (data.type === 'tool_called') {
            const p = data.payload || {};
            setServerTranscripts((prev) => [
              ...prev,
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                role: 'tool',
                toolName: String(p.tool_name || 'tool'),
                text: String(p.summary || `Executed ${p.tool_name}`),
                timestamp: activityItem.timestamp,
                isFinal: true,
              },
            ]);
          } else if (data.type === 'appointment_booked') {
            pushToast(
              'success',
              'Appointment Booked',
              String(data.payload?.message || 'A new appointment has been confirmed.')
            );
            optionsRef.current.onAppointmentChanged?.();
          } else if (data.type === 'appointment_cancelled') {
            pushToast(
              'warning',
              'Appointment Cancelled',
              String(data.payload?.message || 'An appointment was cancelled and the slot released.')
            );
            optionsRef.current.onAppointmentChanged?.();
          } else if (data.type === 'call_error') {
            pushToast(
              'error',
              'Voice Pipeline Error',
              String(data.payload?.message || 'An error occurred in the voice pipeline.')
            );
            optionsRef.current.onCallStatusEvent?.(data.type, data.payload || {});
          } else if (
            data.type === 'call_started' ||
            data.type === 'call_connected' ||
            data.type === 'call_ended'
          ) {
            optionsRef.current.onCallStatusEvent?.(data.type, data.payload || {});
          }
        } catch {
          // ignore malformed messages
        }
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      ws?.close();
    };
  }, [pushToast]);

  return {
    wsConnected,
    activities,
    serverTranscripts,
    clearServerTranscripts,
    toasts,
    pushToast,
    dismissToast,
  };
}
