import { useApp } from '../context/AppContext';

export default function ProfileSelector() {
  const { profiles, setActiveProfile } = useApp();

  return (
    <div className="profile-selector">
      <div className="profile-selector-header">
        <h1>Forge</h1>
        <p>Health OS — choose your profile</p>
      </div>

      <div className="profile-cards">
        <button
          className="profile-card me"
          onClick={() => setActiveProfile('me')}
        >
          <span className="profile-card-emoji">{profiles.me?.emoji || '💪'}</span>
          <div className="profile-card-info">
            <h2>{profiles.me?.name || 'Male'}</h2>
            <p>Challenges · mental training</p>
          </div>
          <span className="profile-card-arrow">›</span>
        </button>

        <button
          className="profile-card girlfriend"
          onClick={() => setActiveProfile('girlfriend')}
        >
          <span className="profile-card-emoji">{profiles.girlfriend?.emoji || '🌸'}</span>
          <div className="profile-card-info">
            <h2>{profiles.girlfriend?.name || 'Female'}</h2>
            <p>Daily habits · custom tasks</p>
          </div>
          <span className="profile-card-arrow">›</span>
        </button>
      </div>
    </div>
  );
}
