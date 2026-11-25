import React, { useState } from 'react';
import { CalendarX2, Filter, Search, X } from 'lucide-react';
import { api } from '../services/api';
import type { Appointment, Doctor } from '../types';

interface AppointmentsPageProps {
  appointments: Appointment[];
  doctors: Doctor[];
  loading: boolean;
  globalSearch: string;
  onRefresh: () => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

export const AppointmentsPage: React.FC<AppointmentsPageProps> = ({
  appointments,
  doctors,
  loading,
  globalSearch,
  onRefresh,
  onNotify,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string>('');

  const effectiveSearch = (localSearch || globalSearch).trim().toLowerCase();

  const filtered = appointments.filter((appt) => {
    const matchStatus = statusFilter === 'all' || appt.status === statusFilter;
    const matchDoctor = doctorFilter === 'all' || String(appt.doctor_id) === doctorFilter;
    const matchSearch =
      !effectiveSearch ||
      appt.patient_name.toLowerCase().includes(effectiveSearch) ||
      appt.doctor_name.toLowerCase().includes(effectiveSearch) ||
      appt.doctor_speciality.toLowerCase().includes(effectiveSearch) ||
      appt.masked_phone.includes(effectiveSearch);
    return matchStatus && matchDoctor && matchSearch;
  });

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setCancelError('');
    setSubmitting(true);
    try {
      await api.cancelAppointment({
        appointment_id: cancelTarget.id,
        patient_phone: phoneInput,
        patient_confirmed: true,
      });
      setCancelTarget(null);
      setPhoneInput('');
      onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cancellation failed';
      setCancelError(msg);
      onNotify('error', 'Cancellation Rejected', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            <span>Status:</span>
          </div>
          {(['all', 'confirmed', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                statusFilter === status
                  ? 'bg-[#0B192C] text-white'
                  : 'bg-[#F8F7F4] text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {status}
            </button>
          ))}

          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="ml-2 rounded-lg border border-slate-200 bg-[#F8F7F4] px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="all">All Doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name} ({d.speciality})
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search patient, doctor, or speciality..."
            className="w-full rounded-lg border border-slate-200 bg-[#F8F7F4] py-1.5 pr-3 pl-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none lg:w-72"
          />
        </div>
      </div>

      {/* Appointments Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarX2 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-700">No appointments match filters</p>
            <p className="mt-1 text-xs text-slate-500">
              Try clearing your search or use the Voice Assistant to book a new appointment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-[#F8F7F4]/80 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">ID</th>
                  <th className="px-5 py-3.5">Patient Name</th>
                  <th className="px-5 py-3.5">Masked Phone</th>
                  <th className="px-5 py-3.5">Doctor</th>
                  <th className="px-5 py-3.5">Speciality</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Time</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((appt) => {
                  const isConfirmed = appt.status === 'confirmed';
                  return (
                    <tr key={appt.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="font-mono-num px-5 py-3.5 text-xs text-slate-500">
                        #{appt.id}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {appt.patient_name}
                      </td>
                      <td className="font-mono-num px-5 py-3.5 text-xs text-slate-600">
                        {appt.masked_phone}
                      </td>
                      <td className="px-5 py-3.5 text-slate-800">{appt.doctor_name}</td>
                      <td className="px-5 py-3.5 text-slate-600">{appt.doctor_speciality}</td>
                      <td className="font-mono-num px-5 py-3.5 text-xs text-slate-700">
                        {appt.appointment_date}
                      </td>
                      <td className="font-mono-num px-5 py-3.5 text-xs text-slate-700">
                        {appt.appointment_time}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                            isConfirmed
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : 'bg-rose-50 text-rose-700 ring-rose-200'
                          }`}
                        >
                          {appt.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isConfirmed ? (
                          <button
                            onClick={() => {
                              setCancelTarget(appt);
                              setPhoneInput('');
                              setCancelError('');
                            }}
                            className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                          >
                            Cancel
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Released</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancellation Verification Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Verify Phone to Cancel Appointment #{cancelTarget.id}
              </h3>
              <button
                onClick={() => setCancelTarget(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Cancelling visit for <span className="font-semibold">{cancelTarget.patient_name}</span>{' '}
              with <span className="font-semibold">{cancelTarget.doctor_name}</span> on{' '}
              <span className="font-mono-num">{cancelTarget.appointment_date}</span> at{' '}
              <span className="font-mono-num">{cancelTarget.appointment_time}</span>. Enter the
              registered phone number ({cancelTarget.masked_phone}) to release the slot.
            </p>
            <form onSubmit={handleCancelSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Patient Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="e.g. 5550101001"
                  className="font-mono-num mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
              {cancelError && (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                  {cancelError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Keep Appointment
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
