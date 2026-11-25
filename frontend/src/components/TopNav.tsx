import React, { useState } from 'react';
import { Bell, Menu, PhoneCall, Search } from 'lucide-react';
import type { ActivityEvent, NavSection } from '../types';

interface TopNavProps {
  title: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activities: ActivityEvent[];
  onOpenMobileMenu: () => void;
  onNavigate: (section: NavSection) => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  title,
  searchQuery,
  onSearchChange,
  activities,
  onOpenMobileMenu,
  onNavigate,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);

  const notableEvents = activities.filter((a) =>
    ['appointment_booked', 'appointment_cancelled', 'call_error', 'call_started'].includes(a.type)
  );

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Global Search */}
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search doctors or patients..."
            className="w-64 rounded-lg border border-slate-200 bg-[#F8F7F4] py-1.5 pr-3 pl-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
          />
        </div>

        {/* Try Call Quick Button */}
        <button
          onClick={() => onNavigate('voice-assistant')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B192C] px-3 py-1.5 text-xs font-medium text-white shadow-xs transition hover:bg-slate-800"
        >
          <PhoneCall className="h-3.5 w-3.5 text-teal-400" />
          <span>Try Call</span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((prev) => !prev)}
            className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {notableEvents.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-[10px] font-semibold text-white">
                {Math.min(notableEvents.length, 9)}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-semibold text-slate-900">Recent Notifications</span>
                <button
                  onClick={() => {
                    setNotifOpen(false);
                    onNavigate('activity');
                  }}
                  className="text-xs font-medium text-teal-700 hover:underline"
                >
                  View all
                </button>
              </div>
              {notableEvents.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500">
                  No recent booking or call notifications.
                </p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {notableEvents.slice(0, 6).map((evt, idx) => (
                    <div
                      key={`${evt.timestamp}-${idx}`}
                      className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-xs"
                    >
                      <div className="font-medium text-slate-800">
                        {String(evt.payload?.message || evt.type.replace('_', ' '))}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile Indicator */}
        <div className="hidden items-center gap-2.5 border-l border-slate-200 pl-3 sm:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-800 ring-1 ring-teal-200">
            MV
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold text-slate-800">Reception Desk</div>
            <div className="text-[11px] text-slate-500">Mock Clinic Mode</div>
          </div>
        </div>
      </div>
    </header>
  );
};
