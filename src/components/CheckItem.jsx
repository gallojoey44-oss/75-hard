export default function CheckItem({
  task, checked, onToggle, disabled, keystone = 0, xp, supports = null,
  onOpenGuide = null,
}) {
  const desc = task.desc;
  return (
    <div
      className={`check-item${supports ? ' shared-habit' : ''}${disabled ? ' disabled' : ''}${keystone ? ` keystone keystone-${keystone}` : ''}`}
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
        {desc && <span className="check-desc">{desc}</span>}
        {/* One behaviour, two challenges: this row satisfies both and pays XP once. */}
        {supports && <span className="check-supports">🔗 {supports}</span>}
      </span>
      {typeof xp === 'number' && <span className="check-xp">{xp} XP</span>}
      {/* Habits that carry a strategy guide get a way into it from the row. It
          stops propagation so opening the guide never toggles the task — the
          row's own tap target is unchanged for every other habit. */}
      {onOpenGuide && (
        <button
          className="check-guide"
          onClick={(e) => { e.stopPropagation(); onOpenGuide(); }}
          aria-label={`Open the ${task.name} strategy guide`}
          title="Strategy guide"
        >
          Guide
        </button>
      )}
    </div>
  );
}
