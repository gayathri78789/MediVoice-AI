import React from 'react';
import { Activity, CalendarCheck, CalendarX, PhoneCall, PhoneOff, Wrench } from 'lucide-react';
import type { ActivityEvent } from '../types';

interface ActivityPageProps {
  activities: ActivityEvent[];
}

export const ActivityPage: React.FC<ActivityPageProps> = ({ activities }) => {
  const renderIcon = (type: string) => {
    switch (type) {
      case 'appointment_booked':
        return <CalendarCheck className="h-4 w-4 text-emerald-600" />;
      case 'appointment_cancelled':
        return <CalendarX className="h-4 w-4 text-rose-600" />;
      case 'tool_called':
        return <Wrench className="h-4 w-4 text-indigo-600" />;
      case 'call_started':
      case 'call_connected':
        return <PhoneCall className="h-4 w-4 text-teal-600" />;
      case 'call_ended':
        return <PhoneOff className="h-4 w-4 text-slate-500" />;
      default:
        return <Activity className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
      <div className="mb-4 border-b border-slate-100 pb-3">
        <h2 className="text-base font-semibold text-slate-900">Real-Time System Activity</h2>
        <p className="text-xs text-slate-500">
          Live audit trail of WebRTC calls, Gemini function calls, bookings, and cancellations
        </p>
      </div>

      {activities.length === 0 ? (
        <div className="py-12 text-center">
          <Activity className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">No events recorded yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Start a voice call or manage an appointment to see live events stream in.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((evt, idx) => (
            <div
              key={`${evt.timestamp}-${idx}`}
              className="flex items-start gap-3 rounded-lg border border-slate-100 bg-[#F8F7F4]/70 p-3.5"
            >
              <div className="mt-0.5 rounded-lg border border-slate-200 bg-white p-2">
                {renderIcon(evt.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-800 uppercase">
                    {evt.type.replace(/_/g, ' ')}
                  </span>
                  <span className="font-mono-num text-[11px] text-slate-400">
                    {new Date(evt.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {String(evt.payload?.message || evt.payload?.summary || JSON.stringify(evt.payload))}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
