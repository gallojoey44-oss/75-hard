import { useState } from 'react';
import { useApp } from '../context/AppContext';

const PRESET_COLORS = [
  '#FF6B6B','#FF8FAB','#FFB347','#F9E04B',
  '#6BCB77','#4ECDC4','#74B9FF','#A78BFA',
  '#DDA0DD','#A8E6CF',
];

const PRESET_ICONS = ['🏋️','🥗','💧','📚','📸','😴','📊','🧠','🏃','🧘','⚡','🎯','💪','🔥','🍎','🛌','📝','✅'];

function ColorPicker({ value, onChange }) {
  return (
    <div className="color-picker-row">
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          className={`color-swatch${value === c ? ' selected' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
    </div>
  );
}

function IconPicker({ value, onChange }) {
  return (
    <div>
      <div className="color-picker-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {PRESET_ICONS.map(ic => (
          <button
            key={ic}
            className={`color-swatch${value === ic ? ' selected' : ''}`}
            style={{
              background: value === ic ? 'var(--accent-glow)' : 'var(--card2)',
              border: value === ic ? '2.5px solid var(--accent)' : '2.5px solid transparent',
              fontSize: '1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => onChange(ic)}
            aria-label={ic}
          >
            {ic}
          </button>
        ))}
      </div>
      <input
        className="form-input"
        placeholder="Or type any emoji"
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={2}
        style={{ marginTop: 8 }}
      />
    </div>
  );
}

export default function TaskManager() {
  const { activeProfile, profile, addTask, updateTask, deleteTask, reorderTasks, getTaskSource } = useApp();
  const isGf = activeProfile === 'girlfriend';
  // Only label task sources when the active challenge actually syncs with a
  // template — otherwise every task is user-managed and labels are noise.
  const hasTemplateTasks = (profile?.tasks || []).some(t => getTaskSource(t) === 'template');

  const [showAdd, setShowAdd]     = useState(false);
  const [newName, setNewName]     = useState('');
  const [newColor, setNewColor]   = useState(PRESET_COLORS[0]);
  const [newIcon, setNewIcon]     = useState('✅');

  const [editId, setEditId]       = useState(null);
  const [editName, setEditName]   = useState('');
  const [editIcon, setEditIcon]   = useState('');
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);

  const tasks = [...(profile?.tasks || [])].sort((a, b) => a.order - b.order);

  function handleAdd() {
    if (!newName.trim()) return;
    addTask(isGf
      ? { name: newName.trim(), color: newColor }
      : { name: newName.trim(), icon: newIcon || '•' }
    );
    setNewName('');
    setNewIcon('✅');
    setNewColor(PRESET_COLORS[0]);
    setShowAdd(false);
  }

  function startEdit(task) {
    setEditId(task.id);
    setEditName(task.name);
    setEditIcon(task.icon || '•');
    setEditColor(task.color || PRESET_COLORS[0]);
  }

  function saveEdit(task) {
    const updates = { name: editName.trim() || task.name };
    if (!isGf) updates.icon = editIcon || '•';
    if (isGf)  updates.color = editColor;
    updateTask(task.id, updates);
    setEditId(null);
  }

  function cancelEdit() {
    setEditId(null);
  }

  function moveUp(i) {
    if (i === 0) return;
    const arr = [...tasks];
    [arr[i], arr[i-1]] = [arr[i-1], arr[i]];
    reorderTasks(arr);
  }

  function moveDown(i) {
    if (i === tasks.length - 1) return;
    const arr = [...tasks];
    [arr[i], arr[i+1]] = [arr[i+1], arr[i]];
    reorderTasks(arr);
  }

  return (
    <div>
      <div className="section-title">📋 Daily Tasks ({tasks.length})</div>

      {tasks.map((task, i) => (
        <div key={task.id}>
          {/* Task row */}
          <div className="task-manager-item">
            <div className="task-reorder">
              <button
                className="btn btn-icon"
                style={{ height: 22, fontSize: 12 }}
                onClick={() => moveUp(i)}
                disabled={i === 0}
              >↑</button>
              <button
                className="btn btn-icon"
                style={{ height: 22, fontSize: 12 }}
                onClick={() => moveDown(i)}
                disabled={i === tasks.length - 1}
              >↓</button>
            </div>

            {isGf && task.color && (
              <div className="task-color-dot" style={{ background: task.color }} />
            )}
            {!isGf && (
              <span style={{ fontSize: '1rem', width: 22, textAlign: 'center', flexShrink: 0 }}>
                {task.icon || '•'}
              </span>
            )}

            <span className="task-name-edit">
              {task.name}
              {hasTemplateTasks && (
                <span className={`task-source-chip${getTaskSource(task) === 'template' ? ' template' : ''}`}>
                  {getTaskSource(task) === 'template' ? 'Template Task' : 'Custom Task'}
                </span>
              )}
            </span>

            <div className="task-actions">
              <button
                className="btn btn-icon"
                onClick={() => editId === task.id ? saveEdit(task) : startEdit(task)}
                title={editId === task.id ? 'Save' : 'Edit'}
              >
                {editId === task.id ? '✓' : '✏️'}
              </button>
              <button
                className="btn btn-icon"
                style={{ color: 'var(--danger)' }}
                onClick={() => deleteTask(task.id)}
                title="Delete"
              >
                🗑
              </button>
            </div>
          </div>

          {/* Expanded edit panel */}
          {editId === task.id && (
            <div className="task-edit-panel">
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">Task name</label>
                <input
                  className="form-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveEdit(task)}
                  autoFocus
                />
              </div>

              {!isGf && (
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">Icon</label>
                  <IconPicker value={editIcon} onChange={setEditIcon} />
                </div>
              )}

              {isGf && (
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">Card color</label>
                  <ColorPicker value={editColor} onChange={setEditColor} />
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveEdit(task)}>Save</button>
                <button className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {tasks.length === 0 && (
        <p className="text-muted" style={{ padding: '12px 0', textAlign: 'center' }}>
          No tasks yet. Add one below.
        </p>
      )}

      {/* Add task form */}
      {showAdd ? (
        <div className="add-task-form">
          <div className="form-group">
            <label className="form-label">Task name</label>
            <input
              className="form-input"
              placeholder="e.g. Morning walk"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              autoFocus
            />
          </div>

          {!isGf && (
            <div className="form-group">
              <label className="form-label">Icon</label>
              <IconPicker value={newIcon} onChange={setNewIcon} />
            </div>
          )}

          {isGf && (
            <div className="form-group">
              <label className="form-label">Card color</label>
              <ColorPicker value={newColor} onChange={setNewColor} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAdd}>Add Task</button>
            <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-ghost btn-full"
          style={{ marginTop: 10 }}
          onClick={() => setShowAdd(true)}
        >
          + Add Task
        </button>
      )}
    </div>
  );
}
