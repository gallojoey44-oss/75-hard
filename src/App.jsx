import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import ProfileSelector from './components/ProfileSelector';
import Dashboard from './components/Dashboard';
import DailyView from './components/DailyView';
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
  const [view, setView] = useState('home');

  if (!activeProfile) {
    return <ProfileSelector />;
  }

  // The Calendar tab was removed — day editing happens through the Today
  // page's Day Selector, so any leftover navigation to it lands on Today.
  function navigate(v) {
    setView(v === 'calendar' ? 'today' : v);
  }

  return (
    <div className="app" data-profile={activeProfile}>
      <main className="main-content">
        {view === 'home' && <Dashboard setView={navigate} />}
        {view === 'today' && (
          <>
            <DailyView editDayNum={null} setView={navigate} />
            {profile?.challengeStart && (
              <div className="home-quote-wrap">
                <QuoteOfTheDay />
              </div>
            )}
          </>
        )}
        {view === 'insights'   && <InsightsView />}
        {view === 'challenges' && <ChallengesView setView={navigate} />}
        {view === 'settings'   && <SettingsView setView={navigate} />}
      </main>
      <BottomNav view={view} setView={navigate} />
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
