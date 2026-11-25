import { useCallback, useEffect, useRef, useState } from 'react';
import { PipecatClient } from '@pipecat-ai/client-js';
import { SmallWebRTCTransport } from '@pipecat-ai/small-webrtc-transport';
import type { CallState, TranscriptEntry } from '../types';

interface UseVoiceCallOptions {
  onErrorToast?: (title: string, message: string) => void;
}

export function useVoiceCall({ onErrorToast }: UseVoiceCallOptions = {}) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Ready to start voice consultation');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [muted, setMuted] = useState<boolean>(false);
  const [botSpeaking, setBotSpeaking] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [clientTranscripts, setClientTranscripts] = useState<TranscriptEntry[]>([]);

  const clientRef = useRef<PipecatClient | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const stopAudioMeter = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  const attachAudioMeter = useCallback(
    (track: MediaStreamTrack) => {
      try {
        stopAudioMeter();
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const stream = new MediaStream([track]);
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);

        audioCtxRef.current = ctx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length / 255;
          setAudioLevel(Math.min(1, avg * 2.4));
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // AudioContext meter is optional visual enhancement
      }
    },
    [stopAudioMeter]
  );

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setElapsedSeconds(0);
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }, [stopTimer]);

  const appendTranscript = useCallback(
    (role: 'user' | 'assistant' | 'system', text: string, isFinal = true) => {
      const cleaned = text.trim();
      if (!cleaned) return;
      setClientTranscripts((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role,
          text: cleaned,
          timestamp: new Date().toISOString(),
          isFinal,
        },
      ]);
    },
    []
  );

  const startCall = useCallback(async () => {
    if (callState === 'connecting' || callState === 'connected') return;

    setErrorMessage('');
    setClientTranscripts([]);
    setMuted(false);
    setBotSpeaking(false);
    setCallState('connecting');
    setStatusMessage('Requesting microphone & establishing WebRTC peer connection...');

    try {
      // Pre-check backend readiness so missing credentials surface clearly before WebRTC setup
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) {
        const health = await healthRes.json();
        if (!health.voice_pipeline_ready) {
          const missing = (health.missing_credentials || []).join(', ');
          const msg = `Backend voice pipeline is missing required API keys: ${missing}. Add them to .env and restart the backend.`;
          setCallState('error');
          setStatusMessage('Missing voice pipeline credentials');
          setErrorMessage(msg);
          onErrorToast?.('Configuration Required', msg);
          return;
        }
      }

      const transport = new SmallWebRTCTransport({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      const client = new PipecatClient({
        transport,
        enableCam: false,
        enableMic: true,
        callbacks: {
          onConnected: () => {
            setCallState('connected');
            setStatusMessage('Connected — Speak with MediVoice Assistant');
            startTimer();
          },
          onDisconnected: () => {
            stopTimer();
            stopAudioMeter();
            setBotSpeaking(false);
            setCallState((prev) => (prev === 'error' ? 'error' : 'ended'));
            setStatusMessage('Call ended');
          },
          onBotReady: () => {
            setCallState('connected');
            setStatusMessage('MediVoice Assistant is listening');
          },
          onBotStartedSpeaking: () => {
            setBotSpeaking(true);
            setStatusMessage('MediVoice Assistant is speaking...');
          },
          onBotStoppedSpeaking: () => {
            setBotSpeaking(false);
            setStatusMessage('Listening for your response...');
          },
          onUserStartedSpeaking: () => {
            setStatusMessage('Hearing patient speech...');
          },
          onUserStoppedSpeaking: () => {
            setStatusMessage('Processing response...');
          },
          onUserInput: (data) => {
            if (data?.final && data?.text) {
              appendTranscript('user', data.text, true);
            }
          },
          onBotOutput: (data) => {
            if (data?.text && data?.spoken_status !== 'in-progress') {
              appendTranscript('assistant', data.text, true);
            }
          },
          onUserTranscript: (data) => {
            if (data?.final && data?.text) {
              appendTranscript('user', data.text, true);
            }
          },
          onBotTranscript: (data) => {
            if (data?.text) {
              appendTranscript('assistant', data.text, true);
            }
          },
          onTrackStarted: (track: MediaStreamTrack, participant?: { local?: boolean }) => {
            if (track.kind === 'audio') {
              if (!participant?.local) {
                if (!audioElRef.current) {
                  audioElRef.current = new Audio();
                  audioElRef.current.autoplay = true;
                }
                audioElRef.current.srcObject = new MediaStream([track]);
                audioElRef.current.play().catch(() => {});
              } else {
                attachAudioMeter(track);
              }
            }
          },
          onError: (err: unknown) => {
            const msg =
              err instanceof Error
                ? err.message
                : typeof err === 'string'
                ? err
                : 'WebRTC connection error';
            setErrorMessage(msg);
            setCallState('error');
            setStatusMessage('Connection failed');
            stopTimer();
            stopAudioMeter();
          },
        },
      });

      clientRef.current = client;

      await client.connect({
        webrtcRequestParams: {
          endpoint: `${window.location.origin}/api/offer`,
        },
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not establish WebRTC voice connection with the backend.';
      setErrorMessage(msg);
      setCallState('error');
      setStatusMessage('Failed to connect');
      stopTimer();
      stopAudioMeter();
      onErrorToast?.('Voice Call Failed', msg);
    }
  }, [appendTranscript, attachAudioMeter, callState, onErrorToast, startTimer, stopAudioMeter, stopTimer]);

  const endCall = useCallback(async () => {
    stopTimer();
    stopAudioMeter();
    setBotSpeaking(false);
    try {
      await clientRef.current?.disconnect();
    } catch {
      // ignore disconnect errors
    } finally {
      clientRef.current = null;
      if (audioElRef.current) {
        audioElRef.current.srcObject = null;
      }
      setCallState('ended');
      setStatusMessage('Call ended');
    }
  }, [stopAudioMeter, stopTimer]);

  const toggleMute = useCallback(() => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    try {
      clientRef.current?.enableMic(!nextMuted);
    } catch {
      // ignore if transport not active
    }
  }, [muted]);

  useEffect(() => {
    return () => {
      stopTimer();
      stopAudioMeter();
      clientRef.current?.disconnect().catch(() => {});
    };
  }, [stopAudioMeter, stopTimer]);

  return {
    callState,
    statusMessage,
    errorMessage,
    muted,
    botSpeaking,
    audioLevel,
    elapsedSeconds,
    clientTranscripts,
    startCall,
    endCall,
    toggleMute,
  };
}
