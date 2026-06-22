import { useApp } from '../context/AppContext';

export default function ProfileSelector() {
  const { setActiveProfile } = useApp();

  return (
    <div className="profile-selector">
      <div className="profile-selector-header">
        <h1>75 Hard</h1>
        <p>Choose your profile to get started</p>
      </div>

      <div className="profile-cards">
        <button
          className="profile-card me"
          onClick={() => setActiveProfile('me')}
        >
          <span className="profile-card-emoji">💪</span>
          <div className="profile-card-info">
            <h2>Joey</h2>
            <p>75-day challenge · mental training</p>
          </div>
          <span className="profile-card-arrow">›</span>
        </button>

        <button
          className="profile-card girlfriend"
          onClick={() => setActiveProfile('girlfriend')}
        >
          <span className="profile-card-emoji">🌸</span>
          <div className="profile-card-info">
            <h2>Girlfriend</h2>
            <p>Daily routine · custom tasks</p>
          </div>
          <span className="profile-card-arrow">›</span>
        </button>
      </div>
    </div>
  );
}
