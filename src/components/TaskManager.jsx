import { useState } from 'react';
import { useApp } from '../context/AppContext';

const PRESET_COLORS = [
  '#FF6B6B','#FF8FAB','#FFB347','#F9E04B',
  '#6BCB77','#4ECDC4','#74B9FF','#A78BFA',
  '#DDA0DD','#A8E6CF',
];

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

export default function TaskManager() {
  const { activeProfile, profile, addTask, updateTask, deleteTask, reorderTasks } = useApp();
  const isGf = activeProfile === 'girlfriend';

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newIcon, setNewIcon] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  const tasks = [...(profile?.tasks || [])].sort((a, b) => a.order - b.order);

  function handleAdd() {
    if (!newName.trim()) return;
    addTask(isGf
      ? { name: newName.trim(), color: newColor }
      : { name: newName.trim(), icon: newIcon.trim() || '•' }
    );
    setNewName('');
    setNewIcon('');
    setNewColor(PRESET_COLORS[0]);
    setShowAdd(false);
  }

  function startEdit(task) {
    setEditId(task.id);
    setEditName(task.name);
  }

  function saveEdit(task) {
    if (editName.trim()) updateTask(task.id, { name: editName.trim() });
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
      <div className="section-card" style={{ marginBottom: 0 }}>
        <div className="section-title">📋 Tasks ({tasks.length})</div>

        {tasks.map((task, i) => (
          <div key={task.id} className="task-manager-item">
            {/* Reorder */}
            <div className="task-reorder">
              <button className="btn btn-icon" style={{ height: 22, fontSize: 12 }} onClick={() => moveUp(i)} disabled={i === 0}>↑</button>
              <button className="btn btn-icon" style={{ height: 22, fontSize: 12 }} onClick={() => moveDown(i)} disabled={i === tasks.length - 1}>↓</button>
            </div>

            {/* Color dot for girlfriend */}
            {isGf && task.color && (
              <div className="task-color-dot" style={{ background: task.color }} />
            )}

            {/* Icon for me */}
            {!isGf && <span style={{ fontSize: '1rem', width: 20, textAlign: 'center' }}>{task.icon || '•'}</span>}

            {/* Name / inline edit */}
            {editId === task.id ? (
              <input
                className="inline-input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => saveEdit(task)}
                onKeyDown={e => e.key === 'Enter' && saveEdit(task)}
                autoFocus
              />
            ) : (
              <span className="task-name-edit">{task.name}</span>
            )}

            {/* Actions */}
            <div className="task-actions">
              <button
                className="btn btn-icon"
                onClick={() => editId === task.id ? saveEdit(task) : startEdit(task)}
                title="Edit"
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
        ))}

        {tasks.length === 0 && (
          <p className="text-muted" style={{ padding: '12px 0', textAlign: 'center' }}>No tasks yet. Add one below.</p>
        )}
      </div>

      {/* Add task */}
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
              <label className="form-label">Icon (emoji)</label>
              <input
                className="form-input"
                placeholder="e.g. 🏃"
                value={newIcon}
                onChange={e => setNewIcon(e.target.value)}
                maxLength={2}
              />
            </div>
          )}

          {isGf && (
            <div className="form-group">
              <label className="form-label">Color</label>
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
