import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import ProfileSelector from './components/ProfileSelector';
import Dashboard from './components/Dashboard';
import DailyView from './components/DailyView';
import CalendarView from './components/CalendarView';
import InsightsView from './components/InsightsView';
import ChallengesView from './components/ChallengesView';
import SettingsView from './components/SettingsView';
import BottomNav from './components/BottomNav';
import QuoteOfTheDay from './components/QuoteOfTheDay';
import { applyUpdate } from './utils/swUtils.js';

// Listens for the 'sw-update-available' event dispatched by swUtils
// and shows a fixed top banner. Rendered outside AppContent so it
// appears regardless of which screen is active.
function UpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener('sw-update-available', handler);
    return () => window.removeEventListener('sw-update-available', handler);
  }, []);

  if (!visible) return null;

  return (
    <div className="update-banner" role="alert">
      <span>🆕 New version available</span>
      <button
        className="update-banner-btn"
        onClick={applyUpdate}
      >
        Tap to update →
      </button>
    </div>
  );
}

function AppContent() {
  const { activeProfile, profile } = useApp();
  const [view, setView]         = useState('home');
  const [editDayNum, setEditDayNum] = useState(null);

  if (!activeProfile) {
    return <ProfileSelector />;
  }

  // The old Today tab is merged into Home — any leftover setView('today')
  // safely lands on Home, which now hosts the daily logging flow.
  function navigate(v) {
    setView(v === 'today' ? 'home' : v);
  }

  function handleEditDay(n) {
    setView('home');
    setEditDayNum(n);
  }

  return (
    <div className="app" data-profile={activeProfile}>
      <main className="main-content">
        {view === 'home' && (
          <>
            <Dashboard setView={navigate} />
            {profile?.challengeStart && (
              <>
                <DailyView
                  editDayNum={editDayNum}
                  setView={navigate}
                />
                <div className="home-quote-wrap">
                  <QuoteOfTheDay />
                </div>
              </>
            )}
          </>
        )}
        {view === 'calendar'   && <CalendarView onEditDay={handleEditDay} />}
        {view === 'insights'   && <InsightsView />}
        {view === 'challenges' && <ChallengesView setView={navigate} />}
        {view === 'settings'   && <SettingsView setView={navigate} />}
      </main>
      <BottomNav
        view={view}
        setView={v => { navigate(v); setEditDayNum(null); }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      {/* Banner lives outside AppContent so it renders on every screen */}
      <UpdateBanner />
      <AppContent />
    </AppProvider>
  );
}
