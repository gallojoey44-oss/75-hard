/**
 * The notification as a phone would show it.
 *
 * A picture rather than a description, because "private" and "show my words"
 * are far easier to choose between when you can see both. The text comes from
 * the same function the server and the test notification use, so what is drawn
 * here is what arrives.
 */
export default function LockScreenPreview({ title, body }) {
  return (
    <div className="ps-lock" data-testid="lock-preview" aria-label="Notification preview">
      <div className="ps-lock-note" aria-hidden="true">
        <span className="ps-lock-icon">⚔️</span>
        <div className="ps-lock-text">
          <div className="ps-lock-top">
            <span className="ps-lock-app">FORGE</span>
            <span className="ps-lock-when">now</span>
          </div>
          <div className="ps-lock-title">{title}</div>
          <div className="ps-lock-body">{body}</div>
        </div>
      </div>
      <span className="sr-only">{title}. {body}</span>
    </div>
  );
}
