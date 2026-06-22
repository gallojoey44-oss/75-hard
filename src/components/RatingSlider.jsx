export default function RatingSlider({ label, emoji, value, onChange }) {
  return (
    <div className="rating-row">
      <div className="rating-label-row">
        <span className="rating-label-left">
          <span>{emoji}</span>
          <span>{label}</span>
        </span>
        {value > 0 && <span className="rating-val">{value}/10</span>}
      </div>
      <div className="rating-bubbles">
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <button
            key={n}
            className={`rating-bubble${n < value ? ' filled' : ''}${n === value ? ' selected' : ''}`}
            onClick={() => onChange(n === value ? 0 : n)}
            aria-label={`${label} ${n}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
