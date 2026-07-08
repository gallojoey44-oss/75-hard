import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getMonthDays, getTodayStr, isFuture, isToday, getDateForDayNumber, getDayNumberFromStart } from '../utils/dateUtils';

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CalendarView({ onEditDay }) {
  const { profile, getChallengeMeta, getDayCompletion, getDayNumber } = useApp();
  const challengeDuration = getChallengeMeta().durationDays || 75;

  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const start = profile?.challengeStart;
  const currentDayNum = getDayNumber();

  function getDayNumForDate(dateStr) {
    if (!start || dateStr < start) return null;
    const s = new Date(start + 'T00:00:00');
    const d = new Date(dateStr + 'T00:00:00');
    const diff = Math.floor((d - s) / 86400000) + 1;
    if (diff < 1 || diff > challengeDuration) return null;
    return diff;
  }

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const days = getMonthDays(year, month);
  const todayStr = getTodayStr();

  function getStatus(dateStr) {
    if (!dateStr) return 'empty';
    if (isFuture(dateStr)) return 'future';
    const n = getDayNumForDate(dateStr);
    if (n === null) return 'out-of-challenge';
    const pct = getDayCompletion(n);
    if (isToday(dateStr)) return 'today';
    if (pct === 100) return 'complete';
    if (pct > 0) return 'partial';
    return 'incomplete';
  }

  function handleDayPress(dateStr) {
    if (!dateStr) return;
    const n = getDayNumForDate(dateStr);
    if (n === null) return;
    onEditDay(n);
  }

  return (
    <div className="calendar-view">
      <div className="cal-header">
        <button className="btn btn-icon" onClick={prev}>‹</button>
        <span className="cal-month">{MONTHS[month]} {year}</span>
        <button className="btn btn-icon" onClick={next}>›</button>
      </div>

      <div className="section-card">
        <div className="cal-grid">
          {DOW.map(d => (
            <div key={d} className="cal-dow">{d}</div>
          ))}
          {days.map((dateStr, i) => {
            const status = getStatus(dateStr);
            const n = dateStr ? getDayNumForDate(dateStr) : null;
            const dayOfMonth = dateStr ? parseInt(dateStr.split('-')[2]) : null;
            return (
              <div
                key={i}
                className={`cal-day ${status}`}
                onClick={() => handleDayPress(dateStr)}
                title={n ? `Day ${n}` : ''}
              >
                {dayOfMonth}
              </div>
            );
          })}
        </div>

        <div className="cal-legend">
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'rgba(16,185,129,0.5)', border: '1.5px solid rgba(16,185,129,0.4)' }} />
            Complete
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'rgba(245,158,11,0.4)', border: '1.5px solid rgba(245,158,11,0.3)' }} />
            Partial
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'rgba(239,68,68,0.3)', border: '1.5px solid rgba(239,68,68,0.25)' }} />
            Missed
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ border: '2px solid var(--accent)' }} />
            Today
          </div>
        </div>
      </div>

      {!start && (
        <div className="warn-banner" style={{ marginTop: 14 }}>
          ℹ️ Start your challenge on the Home tab to see day tracking here.
        </div>
      )}
    </div>
  );
}
