import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  RotateCcw,
  User,
  Wrench,
} from 'lucide-react';
import type { CallState, HealthStatus, TranscriptEntry } from '../types';
import { WaveformVisualizer } from './WaveformVisualizer';

interface VoiceAssistantPageProps {
  callState: CallState;
  statusMessage: string;
  errorMessage: string;
  muted: boolean;
  botSpeaking: boolean;
  audioLevel: number;
  elapsedSeconds: number;
  transcripts: TranscriptEntry[];
  health: HealthStatus | null;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export const VoiceAssistantPage: React.FC<VoiceAssistantPageProps> = ({
  callState,
  statusMessage,
  errorMessage,
  muted,
  botSpeaking,
  audioLevel,
  elapsedSeconds,
  transcripts,
  health,
  onStartCall,
  onEndCall,
  onToggleMute,
}) => {
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const badgeConfig: Record<CallState, { label: string; classes: string }> = {
    idle: { label: 'Idle', classes: 'bg-slate-100 text-slate-700 ring-slate-200' },
    connecting: { label: 'Connecting', classes: 'bg-amber-50 text-amber-700 ring-amber-200' },
    connected: { label: 'Connected', classes: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    ended: { label: 'Ended', classes: 'bg-slate-100 text-slate-600 ring-slate-200' },
    error: { label: 'Error', classes: 'bg-rose-50 text-rose-700 ring-rose-200' },
  };

  const currentBadge = badgeConfig[callState];
  const isLive = callState === 'connected';
  const isConnecting = callState === 'connecting';

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left Phone Console */}
      <div className="space-y-5 xl:col-span-5">
        {health && !health.voice_pipeline_ready && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>Voice Pipeline API Keys Required</span>
            </div>
            <p className="mt-1 leading-relaxed text-amber-800">
              Missing backend credentials:{' '}
              <span className="font-mono-num font-semibold">
                {health.missing_credentials.join(', ')}
              </span>
              . Configure them in <code className="font-mono-num">.env</code> to connect real
              ElevenLabs STT/TTS and Google Gemini calls.
            </p>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Phone Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-[#0B192C] px-6 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-teal-500/20 ring-1 ring-teal-400/40">
                <Bot className="h-5 w-5 text-teal-300" />
                {isLive && (
                  <span className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-[#0B192C] bg-emerald-400" />
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold">MediVoice Assistant</h2>
                <p className="text-[11px] text-slate-300">Hospital Voice Receptionist</p>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${currentBadge.classes}`}
            >
              {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
              {currentBadge.label}
            </span>
          </div>

          {/* Call Body */}
          <div className="p-6 text-center">
            <div className="font-mono-num text-3xl font-semibold tracking-tight text-slate-900">
              {formatDuration(elapsedSeconds)}
            </div>
            <p className="mt-1.5 text-xs font-medium text-slate-500">{statusMessage}</p>

            {/* Audio Waveform */}
            <div className="my-6 rounded-xl border border-slate-100 bg-[#F8F7F4] px-4 py-5">
              <WaveformVisualizer
                callState={callState}
                audioLevel={audioLevel}
                botSpeaking={botSpeaking}
                muted={muted}
              />
              <div className="mt-3 flex items-center justify-center gap-4 text-[11px] font-medium text-slate-500">
                <span>Transport: Pipecat WebRTC</span>
                <span>·</span>
                <span>VAD: Silero</span>
                <span>·</span>
                <span>Voice: ElevenLabs</span>
              </div>
            </div>

            {/* Error State Box */}
            <AnimatePresence>
              {callState === 'error' && errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-left text-xs text-rose-800"
                >
                  <div className="font-semibold">Connection Error</div>
                  <div className="mt-0.5 leading-relaxed">{errorMessage}</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Primary Controls */}
            <div className="flex items-center justify-center gap-3">
              {callState === 'idle' || callState === 'ended' || callState === 'error' ? (
                <button
                  onClick={onStartCall}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
                >
                  {callState === 'ended' || callState === 'error' ? (
                    <RotateCcw className="h-4 w-4" />
                  ) : (
                    <PhoneCall className="h-4 w-4" />
                  )}
                  <span>{callState === 'idle' ? 'Try Call' : 'Start New Call'}</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={onToggleMute}
                    disabled={!isLive}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                      muted
                        ? 'border-amber-300 bg-amber-50 text-amber-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    } disabled:opacity-50`}
                  >
                    {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    <span>{muted ? 'Unmute' : 'Mute'}</span>
                  </button>

                  <button
                    onClick={onEndCall}
                    disabled={isConnecting && false}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-rose-700"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span>End Call</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Spoken Workflow Tips */}
          <div className="border-t border-slate-100 bg-[#F8F7F4]/70 px-6 py-4 text-left">
            <div className="text-xs font-semibold text-slate-800">Voice Verification Protocol</div>
            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-600">
              <li>1. Ask for doctor availability by name or speciality and date.</li>
              <li>2. Speak your full name and phone number clearly.</li>
              <li>3. Confirm the digit-by-digit phone readback and final summary.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Right Live Transcript & Tool Events */}
      <div className="flex h-[620px] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xs xl:col-span-7">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Live Conversation Transcript</h3>
            <p className="text-xs text-slate-500">
              Real-time speech transcripts & Gemini function-calling audit
            </p>
          </div>
          {isLive && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
              Audio Stream Active
            </span>
          )}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {transcripts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="rounded-full bg-[#F8F7F4] p-4">
                <Mic className="h-6 w-6 text-slate-400" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-700">
                No conversation transcript yet
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Click <span className="font-semibold">Try Call</span> to establish a real WebRTC
                session with MediVoice Assistant.
              </p>
            </div>
          ) : (
            transcripts.map((item) => {
              if (item.role === 'tool') {
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3.5 py-2 text-xs text-indigo-900"
                  >
                    <Wrench className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                    <span className="font-mono-num font-semibold">{item.toolName}:</span>
                    <span className="flex-1">{item.text}</span>
                  </div>
                );
              }

              const isUser = item.role === 'user';
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isUser ? 'bg-[#0B192C] text-white' : 'bg-teal-50 text-teal-700'
                    }`}
                  >
                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[#0B192C] text-white'
                        : 'border border-slate-200 bg-[#F8F7F4] text-slate-800'
                    }`}
                  >
                    <div>{item.text}</div>
                    <div
                      className={`font-mono-num mt-1 text-[10px] ${
                        isUser ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>
    </div>
  );
};
