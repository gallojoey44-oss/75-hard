const TABS = [
  { id: 'home',     label: 'Home',     icon: '🏠' },
  { id: 'today',    label: 'Today',    icon: '✅' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function BottomNav({ view, setView }) {
  return (
    <nav className="bottom-nav">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`nav-tab${view === tab.id ? ' active' : ''}`}
          onClick={() => setView(tab.id)}
          aria-label={tab.label}
        >
          <span className="nav-tab-icon">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
