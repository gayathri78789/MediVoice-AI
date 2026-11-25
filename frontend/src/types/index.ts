export type NavSection =
  | 'overview'
  | 'voice-assistant'
  | 'doctors'
  | 'appointments'
  | 'activity'
  | 'settings';

export type CallState = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

export interface Slot {
  id: number;
  doctor_id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: 'available' | 'booked' | 'blocked';
}

export interface Doctor {
  id: number;
  name: string;
  speciality: string;
  qualification: string;
  experience: number;
  consultation_fee: number;
  available_days: string;
  is_active: boolean;
  available_slots_count: number;
}

export interface DoctorDetail extends Doctor {
  slots: Slot[];
}

export interface DoctorAvailability {
  doctor_id: number;
  doctor_name: string;
  speciality: string;
  appointment_date: string | null;
  available_slots: Slot[];
}

export interface Appointment {
  id: number;
  patient_name: string;
  masked_phone: string;
  doctor_id: number;
  doctor_name: string;
  doctor_speciality: string;
  slot_id: number | null;
  appointment_date: string;
  appointment_time: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface TrendPoint {
  date: string;
  confirmed: number;
  cancelled: number;
  available: number;
}

export interface ActivityEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface DashboardStats {
  total_doctors: number;
  today_appointments: number;
  available_slots: number;
  confirmed_appointments: number;
  cancelled_appointments: number;
  upcoming_appointments: Appointment[];
  trends: TrendPoint[];
  recent_activity: ActivityEvent[];
}

export interface HealthStatus {
  status: string;
  database: string;
  voice_pipeline_ready: boolean;
  missing_credentials: string[];
  gemini_model: string;
}

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  text: string;
  timestamp: string;
  isFinal?: boolean;
  toolName?: string;
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: string;
}
