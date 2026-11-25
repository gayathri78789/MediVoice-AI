import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, DollarSign, GraduationCap, Search, Stethoscope } from 'lucide-react';
import { api } from '../services/api';
import type { Doctor, DoctorDetail, NavSection } from '../types';

interface DoctorsPageProps {
  doctors: Doctor[];
  loading: boolean;
  globalSearch: string;
  onNavigate: (section: NavSection) => void;
}

export const DoctorsPage: React.FC<DoctorsPageProps> = ({
  doctors,
  loading,
  globalSearch,
  onNavigate,
}) => {
  const [selectedSpeciality, setSelectedSpeciality] = useState<string>('All');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const specialities = ['All', ...Array.from(new Set(doctors.map((d) => d.speciality)))];
  const effectiveSearch = (localSearch || globalSearch).trim().toLowerCase();

  const filteredDoctors = doctors.filter((doc) => {
    const matchesSpec = selectedSpeciality === 'All' || doc.speciality === selectedSpeciality;
    const matchesSearch =
      !effectiveSearch ||
      doc.name.toLowerCase().includes(effectiveSearch) ||
      doc.speciality.toLowerCase().includes(effectiveSearch) ||
      doc.qualification.toLowerCase().includes(effectiveSearch);
    return matchesSpec && matchesSearch;
  });

  const handleSelectDoctor = async (docId: number) => {
    setDetailLoading(true);
    try {
      const detail = await api.getDoctorDetail(docId);
      setSelectedDoctor(detail);
      const dates = Array.from(new Set(detail.slots.map((s) => s.appointment_date)));
      setSelectedDate(dates[0] || '');
    } catch {
      setSelectedDoctor(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedDoctor && doctors.length > 0) {
      handleSelectDoctor(doctors[0].id);
    }
  }, [doctors, selectedDoctor]);

  const detailDates = selectedDoctor
    ? Array.from(new Set(selectedDoctor.slots.map((s) => s.appointment_date)))
    : [];

  const visibleSlots = selectedDoctor
    ? selectedDoctor.slots.filter((s) => !selectedDate || s.appointment_date === selectedDate)
    : [];

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {specialities.map((spec) => (
            <button
              key={spec}
              onClick={() => setSelectedSpeciality(spec)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                selectedSpeciality === spec
                  ? 'bg-[#0B192C] text-white'
                  : 'bg-[#F8F7F4] text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {spec}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Filter doctors..."
            className="w-full rounded-lg border border-slate-200 bg-[#F8F7F4] py-1.5 pr-3 pl-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none sm:w-56"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Doctor Directory Grid */}
        <div className="space-y-4 xl:col-span-2">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white"
                />
              ))}
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <Stethoscope className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">No matching doctors found</p>
              <p className="mt-1 text-xs text-slate-500">
                Adjust your speciality filter or search term.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredDoctors.map((doc, idx) => {
                const isSelected = selectedDoctor?.id === doc.id;
                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => handleSelectDoctor(doc.id)}
                    className={`cursor-pointer rounded-xl border bg-white p-5 transition ${
                      isSelected
                        ? 'border-teal-600 ring-2 ring-teal-500/15'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                          {doc.speciality}
                        </span>
                        <h3 className="mt-2 text-base font-semibold text-slate-900">{doc.name}</h3>
                      </div>
                      <span className="font-mono-num rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {doc.available_slots_count} open
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                        <span>{doc.qualification}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {doc.experience} yrs exp
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5 text-slate-400" />$
                          {doc.consultation_fee.toFixed(0)} fee
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{doc.available_days}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Doctor Live Schedule Panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          {detailLoading ? (
            <div className="space-y-3">
              <div className="h-6 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="h-32 animate-pulse rounded bg-slate-100" />
            </div>
          ) : selectedDoctor ? (
            <div>
              <div className="border-b border-slate-100 pb-4">
                <span className="text-xs font-semibold tracking-wide text-teal-700 uppercase">
                  Live Slot Schedule
                </span>
                <h3 className="mt-1 text-base font-semibold text-slate-900">
                  {selectedDoctor.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDoctor.speciality} · {selectedDoctor.qualification}
                </p>
              </div>

              {/* Date Selector */}
              <div className="mt-4">
                <label className="text-xs font-medium text-slate-600">Select Date</label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {detailDates.map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelectedDate(d)}
                      className={`font-mono-num rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        selectedDate === d
                          ? 'bg-teal-600 text-white'
                          : 'border border-slate-200 bg-[#F8F7F4] text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {d.slice(5)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slots */}
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Time Slots ({selectedDate})</span>
                  <span className="text-slate-500">
                    {visibleSlots.filter((s) => s.status === 'available').length} available
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {visibleSlots.map((slot) => {
                    const isAvail = slot.status === 'available';
                    return (
                      <div
                        key={slot.id}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                          isAvail
                            ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                            : 'border-slate-200 bg-slate-50 text-slate-400 line-through'
                        }`}
                      >
                        <span className="font-mono-num font-medium">{slot.start_time}</span>
                        <span className="text-[10px] font-semibold uppercase">{slot.status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-slate-100 bg-[#F8F7F4] p-3 text-xs text-slate-600">
                Patients book or cancel these slots by speaking with{' '}
                <button
                  onClick={() => onNavigate('voice-assistant')}
                  className="font-semibold text-teal-700 hover:underline"
                >
                  MediVoice Assistant
                </button>
                .
              </div>
            </div>
          ) : (
            <p className="py-10 text-center text-xs text-slate-500">
              Select a doctor to inspect available slots.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
