import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './services/api';
import { useDashboardEvents } from './hooks/useDashboardEvents';
import { useVoiceCall } from './hooks/useVoiceCall';
import type {
  Appointment,
  DashboardStats,
  Doctor,
  HealthStatus,
  NavSection,
  TranscriptEntry,
} from './types';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { ToastContainer } from './components/ToastContainer';
import { OverviewPage } from './components/OverviewPage';
import { VoiceAssistantPage } from './components/VoiceAssistantPage';
import { DoctorsPage } from './components/DoctorsPage';
import { AppointmentsPage } from './components/AppointmentsPage';
import { ActivityPage } from './components/ActivityPage';
import { SettingsPage } from './components/SettingsPage';

const SECTION_TITLES: Record<NavSection, string> = {
  overview: 'Clinical Overview',
  'voice-assistant': 'Voice Assistant',
  doctors: 'Medical Directory & Availability',
  appointments: 'Appointments',
  activity: 'Live Activity Log',
  settings: 'System & Pipeline Settings',
};

export function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAllData = useCallback(async () => {
    try {
      const [statsData, docsData, apptsData, healthData] = await Promise.all([
        api.getDashboardStats(),
        api.getDoctors(),
        api.getAppointments(),
        api.getHealth(),
      ]);
      setStats(statsData);
      setDoctors(docsData);
      setAppointments(apptsData);
      setHealth(healthData);
    } catch (err) {
      console.error('Failed loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const {
    wsConnected,
    activities,
    serverTranscripts,
    clearServerTranscripts,
    toasts,
    pushToast,
    dismissToast,
  } = useDashboardEvents({
    onAppointmentChanged: () => {
      fetchAllData();
    },
  });

  const voice = useVoiceCall({
    onErrorToast: (title, message) => pushToast('error', title, message),
  });

  const handleStartCall = useCallback(() => {
    clearServerTranscripts();
    voice.startCall();
  }, [clearServerTranscripts, voice]);

  // Merge client RTVI transcripts + server tool/transcript events cleanly
  const mergedTranscripts: TranscriptEntry[] = useMemo(() => {
    const combined = [...voice.clientTranscripts, ...serverTranscripts];
    const seen = new Set<string>();
    const deduped: TranscriptEntry[] = [];
    for (const item of combined.sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
      const key = `${item.role}:${item.text.trim()}`;
      if (item.role !== 'tool' && seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }
    return deduped;
  }, [voice.clientTranscripts, serverTranscripts]);

  return (
    <div className="flex min-h-screen bg-[#F8F7F4] text-slate-900">
      <Sidebar
        activeSection={activeSection}
        onSelect={setActiveSection}
        wsConnected={wsConnected}
        callState={voice.callState}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          title={SECTION_TITLES[activeSection]}
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          activities={activities}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNavigate={setActiveSection}
        />

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          {activeSection === 'overview' && (
            <OverviewPage stats={stats} loading={loading} onNavigate={setActiveSection} />
          )}
          {activeSection === 'voice-assistant' && (
            <VoiceAssistantPage
              callState={voice.callState}
              statusMessage={voice.statusMessage}
              errorMessage={voice.errorMessage}
              muted={voice.muted}
              botSpeaking={voice.botSpeaking}
              audioLevel={voice.audioLevel}
              elapsedSeconds={voice.elapsedSeconds}
              transcripts={mergedTranscripts}
              health={health}
              onStartCall={handleStartCall}
              onEndCall={voice.endCall}
              onToggleMute={voice.toggleMute}
            />
          )}
          {activeSection === 'doctors' && (
            <DoctorsPage
              doctors={doctors}
              loading={loading}
              globalSearch={globalSearch}
              onNavigate={setActiveSection}
            />
          )}
          {activeSection === 'appointments' && (
            <AppointmentsPage
              appointments={appointments}
              doctors={doctors}
              loading={loading}
              globalSearch={globalSearch}
              onRefresh={fetchAllData}
              onNotify={pushToast}
            />
          )}
          {activeSection === 'activity' && <ActivityPage activities={activities} />}
          {activeSection === 'settings' && (
            <SettingsPage
              health={health}
              wsConnected={wsConnected}
              onRefreshHealth={fetchAllData}
            />
          )}
        </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
