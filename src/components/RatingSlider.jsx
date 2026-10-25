/**
 * A 1–10 rating, as one draggable track instead of ten small targets.
 *
 * Ten buttons across a phone gives each one about 26px — under the 44px that
 * is reliably tappable — and ten chances to hit the wrong number. A range
 * input is one gesture, has a real thumb to drag, is operable from the
 * keyboard, and is announced correctly by VoiceOver. It also takes a single
 * row rather than two.
 *
 * The SCALE IS UNCHANGED. This writes the same 1–10 integers to the same
 * fields, so every stored day, every archive and every insight that compares
 * them stays directly comparable. Nothing was rescaled to fit a nicer control.
 *
 * 0 means "not rated". The control shows an empty track and the thumb sits at
 * the start; tapping the same value again clears it, which is how the previous
 * control cleared a rating too.
 */
export default function RatingSlider({ label, emoji, value, onChange, hint }) {
  const v = Number(value) || 0;
  const rated = v > 0;

  return (
    <div className="rating-row">
      <div className="rating-label-row">
        <span className="rating-label-left">
          <span aria-hidden="true">{emoji}</span>
          <span>{label}</span>
        </span>
        <span className={`rating-val${rated ? '' : ' empty'}`}>
          {rated ? `${v}` : '–'}<span className="rating-val-max">/10</span>
        </span>
      </div>
      {hint && <div className="rating-hint">{hint}</div>}
      <div className="rating-track-wrap">
        <input
          type="range"
          className="rating-track"
          min={0}
          max={10}
          step={1}
          value={v}
          aria-label={`${label}, 1 to 10`}
          aria-valuetext={rated ? `${v} out of 10` : 'not rated'}
          onChange={e => onChange(Number(e.target.value))}
          style={{ '--rating-pct': `${(v / 10) * 100}%` }}
        />
        {/* Ten tick marks, so the scale is still legible as a 1–10 scale
            rather than an anonymous slider. */}
        <div className="rating-ticks" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <span key={n} className={`rating-tick${n <= v ? ' on' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
