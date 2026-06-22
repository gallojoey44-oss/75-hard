import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import ProfileSelector from './components/ProfileSelector';
import Dashboard from './components/Dashboard';
import DailyView from './components/DailyView';
import CalendarView from './components/CalendarView';
import SettingsView from './components/SettingsView';
import BottomNav from './components/BottomNav';

function AppContent() {
  const { activeProfile } = useApp();
  const [view, setView] = useState('home');
  const [editDayNum, setEditDayNum] = useState(null);

  if (!activeProfile) {
    return <ProfileSelector />;
  }

  function handleEditDay(n) {
    setEditDayNum(n);
    setView('today');
  }

  function handleBackFromEdit() {
    setEditDayNum(null);
  }

  return (
    <div className="app" data-profile={activeProfile}>
      <main className="main-content">
        {view === 'home'     && <Dashboard setView={setView} />}
        {view === 'today'    && (
          <DailyView
            editDayNum={editDayNum}
            onBack={editDayNum ? handleBackFromEdit : undefined}
          />
        )}
        {view === 'calendar' && <CalendarView onEditDay={handleEditDay} />}
        {view === 'settings' && <SettingsView />}
      </main>
      <BottomNav view={view} setView={(v) => { setView(v); if (v !== 'today') setEditDayNum(null); }} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
