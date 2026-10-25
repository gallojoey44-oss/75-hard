/**
 * A progress ring.
 *
 * Pure SVG so it scales crisply on any screen, costs no layout work while it
 * animates, and inherits the profile's accent colour from CSS rather than
 * carrying a palette of its own.
 */
export default function ProgressRing({
  value = 0,
  size = 72,
  stroke = 7,
  children,
  className = '',
  label,
}) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);

  return (
    <div
      className={`f4-ring${pct >= 100 ? ' complete' : ''}${className ? ' ' + className : ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label || `${Math.round(pct)}% complete`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="f4-ring-track"
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke}
        />
        <circle
          className="f4-ring-fill"
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="f4-ring-center">{children}</div>
    </div>
  );
}
