export default function CheckItem({ task, checked, onToggle, disabled }) {
  return (
    <div
      className={`check-item${disabled ? ' disabled' : ''}`}
      onClick={disabled ? undefined : onToggle}
      role="checkbox"
      aria-checked={checked}
    >
      <div className={`check-box${checked ? ' checked' : ''}`}>
        {checked && <span className="check-tick">✓</span>}
      </div>
      <span className="check-icon">{task.icon || '•'}</span>
      <span className={`check-name${checked ? ' done' : ''}`}>{task.name}</span>
    </div>
  );
}
