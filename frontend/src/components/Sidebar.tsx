import React from 'react';
import {
  Activity,
  CalendarCheck,
  LayoutDashboard,
  PhoneCall,
  Settings,
  Stethoscope,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { CallState, NavSection } from '../types';

interface SidebarProps {
  activeSection: NavSection;
  onSelect: (section: NavSection) => void;
  wsConnected: boolean;
  callState: CallState;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'voice-assistant', label: 'Voice Assistant', icon: PhoneCall },
  { id: 'doctors', label: 'Doctors', icon: Stethoscope },
  { id: 'appointments', label: 'Appointments', icon: CalendarCheck },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelect,
  wsConnected,
  callState,
  mobileOpen,
  onCloseMobile,
}) => {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#0B192C] text-slate-200 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15 ring-1 ring-teal-400/30">
            <svg
              className="h-5 w-5 text-teal-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v4" />
              <path d="M12 18v4" />
              <path d="M4.93 4.93l2.83 2.83" />
              <path d="M16.24 16.24l2.83 2.83" />
              <path d="M2 12h4" />
              <path d="M18 12h4" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-white">MediVoice AI</div>
            <div className="text-[11px] font-medium text-slate-400">Clinical Voice Desk</div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 px-3 py-5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            const isVoiceLive = item.id === 'voice-assistant' && callState === 'connected';
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item.id);
                  onCloseMobile();
                }}
                className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-teal-500/15 text-white ring-1 ring-teal-400/25'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      active ? 'text-teal-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  {item.label}
                </span>
                {isVoiceLive && (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    LIVE
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* System Status Footer */}
        <div className="border-t border-white/10 p-4">
          <div className="rounded-lg bg-white/5 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Live Event Stream</span>
              {wsConnected ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                  <Wifi className="h-3.5 w-3.5" />
                  Synced
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-amber-400">
                  <WifiOff className="h-3.5 w-3.5" />
                  Reconnecting
                </span>
              )}
            </div>
            <div className="mt-2 text-[11px] leading-relaxed text-slate-400">
              Pipecat WebRTC + ElevenLabs + Gemini Function Calling
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
