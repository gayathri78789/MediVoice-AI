import React from 'react';
import { CheckCircle2, Database, KeyRound, ShieldAlert, Volume2 } from 'lucide-react';
import type { HealthStatus } from '../types';

interface SettingsPageProps {
  health: HealthStatus | null;
  wsConnected: boolean;
  onRefreshHealth: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  health,
  wsConnected,
  onRefreshHealth,
}) => {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Voice Pipeline & Backend Configuration
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              API credentials remain strictly on the FastAPI backend via environment variables.
            </p>
          </div>
          <button
            onClick={onRefreshHealth}
            className="rounded-lg border border-slate-200 bg-[#F8F7F4] px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Re-check System Health
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Database className="h-4 w-4 text-teal-600" />
              SQLite Database
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{health?.database === 'ok' ? 'Connected (WAL Mode)' : 'Checking...'}</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Volume2 className="h-4 w-4 text-teal-600" />
              Pipecat Voice Pipeline
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900">
              {health?.voice_pipeline_ready ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Ready for WebRTC Calls
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-700">
                  <ShieldAlert className="h-4 w-4" /> Missing API Keys
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Model: <span className="font-mono-num">{health?.gemini_model || 'gemini-2.5-flash'}</span>
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <KeyRound className="h-4 w-4 text-teal-600" />
              WebSocket Event Sync
            </div>
            <div className="mt-2 text-sm font-medium text-slate-900">
              {wsConnected ? 'Connected (/ws/events)' : 'Disconnected'}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Real-time transcripts & appointment events
            </p>
          </div>
        </div>

        {health && health.missing_credentials.length > 0 && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-semibold text-amber-900">
              Missing Backend Environment Credentials
            </div>
            <p className="mt-1 text-xs text-amber-800">
              Add the following variables to your root <code className="font-mono-num">.env</code>{' '}
              file and restart the FastAPI backend to enable live ElevenLabs STT/TTS and Gemini voice
              conversations:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs font-medium text-amber-900">
              {health.missing_credentials.map((cred) => (
                <li key={cred} className="font-mono-num">
                  {cred}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <h3 className="text-sm font-semibold text-slate-900">Voice Identity & Privacy Policy</h3>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
          <li>• No user login, OTP, caller-ID, or browser fingerprinting is used.</li>
          <li>• Patients identify solely by speaking their phone number during the voice call.</li>
          <li>
            • The AI receptionist repeats the full phone number digit-by-digit and requires
            confirmation before booking or cancelling.
          </li>
          <li>
            • Dashboard tables display privacy-masked phone numbers and fictional clinic mock data.
          </li>
        </ul>
      </div>
    </div>
  );
};
