import type {
  Appointment,
  DashboardStats,
  Doctor,
  DoctorAvailability,
  DoctorDetail,
  HealthStatus,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string') {
        detail = body.detail;
      } else if (body?.detail) {
        detail = JSON.stringify(body.detail);
      }
    } catch {
      // keep fallback detail
    }
    throw new Error(detail);
  }

  return res.json() as Promise<T>;
}

export const api = {
  getHealth: () => request<HealthStatus>('/api/health'),

  getDashboardStats: () => request<DashboardStats>('/api/dashboard/stats'),

  getDoctors: (params?: { speciality?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.speciality) qs.set('speciality', params.speciality);
    if (params?.search) qs.set('search', params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<Doctor[]>(`/api/doctors${suffix}`);
  },

  getDoctorDetail: (doctorId: number) => request<DoctorDetail>(`/api/doctors/${doctorId}`),

  getDoctorAvailability: (doctorId: number, date?: string) => {
    const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
    return request<DoctorAvailability>(`/api/doctors/${doctorId}/availability${suffix}`);
  },

  getAppointments: (params?: {
    status?: string;
    doctor_id?: number;
    date?: string;
    search?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status && params.status !== 'all') qs.set('status', params.status);
    if (params?.doctor_id) qs.set('doctor_id', String(params.doctor_id));
    if (params?.date) qs.set('date', params.date);
    if (params?.search) qs.set('search', params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<Appointment[]>(`/api/appointments${suffix}`);
  },

  getAppointmentsByPhone: (phone: string) =>
    request<Appointment[]>(`/api/appointments/phone/${encodeURIComponent(phone)}`),

  bookAppointment: (payload: {
    patient_name: string;
    patient_phone: string;
    doctor_id: number;
    appointment_date: string;
    appointment_time: string;
    patient_confirmed: boolean;
  }) =>
    request<Appointment>('/api/appointments/book', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cancelAppointment: (payload: {
    patient_phone: string;
    appointment_id: number;
    patient_confirmed: boolean;
  }) =>
    request<Appointment>('/api/appointments/cancel', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
