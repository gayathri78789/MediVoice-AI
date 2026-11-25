import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Calendar,
  CalendarCheck,
  Clock,
  PhoneCall,
  Stethoscope,
} from 'lucide-react';
import type { DashboardStats, NavSection } from '../types';

interface OverviewPageProps {
  stats: DashboardStats | null;
  loading: boolean;
  onNavigate: (section: NavSection) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ stats, loading, onNavigate }) => {
  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white p-5" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Doctors',
      value: stats?.total_doctors ?? 0,
      sub: 'Active specialists',
      icon: Stethoscope,
      accent: 'text-teal-700 bg-teal-50 border-teal-100',
    },
    {
      label: "Today's Appointments",
      value: stats?.today_appointments ?? 0,
      sub: 'Scheduled for today',
      icon: Calendar,
      accent: 'text-sky-700 bg-sky-50 border-sky-100',
    },
    {
      label: 'Available Slots',
      value: stats?.available_slots ?? 0,
      sub: 'Open over next 7 days',
      icon: Clock,
      accent: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    },
    {
      label: 'Confirmed Appointments',
      value: stats?.confirmed_appointments ?? 0,
      sub: `${stats?.cancelled_appointments ?? 0} cancelled total`,
      icon: CalendarCheck,
      accent: 'text-indigo-700 bg-indigo-50 border-indigo-100',
    },
  ];

  const maxTrend = Math.max(
    1,
    ...(stats?.trends || []).map((t) => t.confirmed + t.available + t.cancelled)
  );

  return (
    <div className="space-y-6">
      {/* Quick Voice Reception Banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs sm:flex-row sm:items-center"
      >
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
            MediVoice Assistant Ready
          </div>
          <h2 className="mt-2 text-base font-semibold text-slate-900">
            Voice-First Patient Appointment Reception
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Check doctor availability, book slots, or cancel appointments through natural spoken
            phone verification over WebRTC.
          </p>
        </div>
        <button
          onClick={() => onNavigate('voice-assistant')}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-700"
        >
          <PhoneCall className="h-4 w-4" />
          <span>Launch Voice Call</span>
        </button>
      </motion.div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{card.label}</p>
                  <p className="font-mono-num mt-2 text-2xl font-bold text-slate-900">
                    {card.value}
                  </p>
                </div>
                <div className={`rounded-lg border p-2 ${card.accent}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">{card.sub}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Trends + Upcoming Appointments */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 7-Day Slot & Appointment Trends */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">7-Day Appointment Trends</h3>
              <p className="text-xs text-slate-500">
                Live breakdown of open slots, confirmed bookings, and cancellations
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-teal-600" />
                Confirmed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-200" />
                Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                Cancelled
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-3 pt-2">
            {(stats?.trends || []).map((day) => {
              const total = day.confirmed + day.available + day.cancelled;
              const confH = Math.round((day.confirmed / maxTrend) * 120);
              const availH = Math.round((day.available / maxTrend) * 120);
              const cancH = Math.round((day.cancelled / maxTrend) * 120);
              const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                weekday: 'short',
              });
              const dateNum = day.date.slice(5);

              return (
                <div key={day.date} className="flex flex-col items-center">
                  <div className="flex h-36 w-full max-w-[38px] flex-col-reverse overflow-hidden rounded-lg bg-slate-50 p-1">
                    {day.confirmed > 0 && (
                      <div
                        style={{ height: `${Math.max(4, confH)}px` }}
                        className="w-full rounded-xs bg-teal-600 transition-all"
                        title={`Confirmed: ${day.confirmed}`}
                      />
                    )}
                    {day.cancelled > 0 && (
                      <div
                        style={{ height: `${Math.max(4, cancH)}px` }}
                        className="mt-0.5 w-full rounded-xs bg-rose-400 transition-all"
                        title={`Cancelled: ${day.cancelled}`}
                      />
                    )}
                    {day.available > 0 && (
                      <div
                        style={{ height: `${Math.max(4, availH)}px` }}
                        className="mt-0.5 w-full rounded-xs bg-slate-200 transition-all"
                        title={`Available: ${day.available}`}
                      />
                    )}
                    {total === 0 && <div className="h-1 w-full rounded-xs bg-slate-100" />}
                  </div>
                  <div className="mt-2 text-xs font-medium text-slate-700">{label}</div>
                  <div className="font-mono-num text-[11px] text-slate-400">{dateNum}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
            <button
              onClick={() => onNavigate('activity')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
            >
              <span>All</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {!stats?.recent_activity || stats.recent_activity.length === 0 ? (
            <div className="flex h-44 flex-col items-center justify-center text-center">
              <Activity className="h-6 w-6 text-slate-300" />
              <p className="mt-2 text-xs text-slate-500">
                Real-time call, booking, and cancellation events appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.recent_activity.slice(0, 5).map((evt, idx) => (
                <div
                  key={`${evt.timestamp}-${idx}`}
                  className="rounded-lg border border-slate-100 bg-[#F8F7F4] px-3 py-2 text-xs"
                >
                  <div className="font-medium text-slate-800">
                    {String(evt.payload?.message || evt.payload?.summary || evt.type)}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Appointments Table Preview */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Upcoming Appointments</h3>
            <p className="text-xs text-slate-500">Next confirmed clinical visits from SQLite</p>
          </div>
          <button
            onClick={() => onNavigate('appointments')}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
          >
            <span>Manage appointments</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {!stats?.upcoming_appointments || stats.upcoming_appointments.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No upcoming confirmed appointments.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium text-slate-500">
                  <th className="pb-2.5">Patient</th>
                  <th className="pb-2.5">Phone</th>
                  <th className="pb-2.5">Doctor</th>
                  <th className="pb-2.5">Speciality</th>
                  <th className="pb-2.5">Date & Time</th>
                  <th className="pb-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.upcoming_appointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-slate-50/60">
                    <td className="py-3 font-medium text-slate-900">{appt.patient_name}</td>
                    <td className="font-mono-num py-3 text-xs text-slate-500">{appt.masked_phone}</td>
                    <td className="py-3 text-slate-700">{appt.doctor_name}</td>
                    <td className="py-3 text-slate-600">{appt.doctor_speciality}</td>
                    <td className="font-mono-num py-3 text-xs text-slate-700">
                      {appt.appointment_date} · {appt.appointment_time}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                        {appt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
