export default function CheckItem({ task, checked, onToggle, disabled, keystone = 0, xp }) {
  return (
    <div
      className={`check-item${disabled ? ' disabled' : ''}${keystone ? ` keystone keystone-${keystone}` : ''}`}
      onClick={disabled ? undefined : onToggle}
      role="checkbox"
      aria-checked={checked}
    >
      <div className={`check-box${checked ? ' checked' : ''}`}>
        {checked && <span className="check-tick">✓</span>}
      </div>
      <span className="check-icon">{task.icon || '•'}</span>
      <span className={`check-name${checked ? ' done' : ''}`}>
        {task.name}
        {keystone > 0 && <span className="keystone-stars">{'⭐'.repeat(keystone)}</span>}
      </span>
      {typeof xp === 'number' && <span className="check-xp">{xp} XP</span>}
    </div>
  );
}
