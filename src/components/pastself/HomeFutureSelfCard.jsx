import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  readPastSelf, deliveryActive, nextDelivery, describeNext, formatTime, eligibleMessages,
} from '../../utils/pastSelf';

/**
 * Home's way in to Letters to My Future Self.
 *
 * It shows counts and the next delivery, and deliberately none of the words.
 * Home is the screen most likely to be open when someone else can see the
 * phone, and what a person writes to themselves about their fears does not
 * belong on it. The words appear only when they ask for them.
 */
export default function HomeFutureSelfCard({ onOpen, onRead }) {
  const { profile } = useApp();
  const state = useMemo(() => readPastSelf(profile), [profile]);
  const letters = state.letters.length;
  const messages = state.messages.length;
  const empty = letters === 0 && messages === 0;
  const next = nextDelivery(state);
  const canRead = eligibleMessages(state).length > 0 || letters > 0;

  return (
    <section className="f41-card ps-home" data-testid="home-future-self">
      <div className="f41-card-head">
        <h3 className="f41-card-title">A Message to My Future Self</h3>
        {!empty && (
          <span className="f41-card-meta">
            {letters} letter{letters === 1 ? '' : 's'} · {messages} message{messages === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {empty ? (
        <p className="ps-home-text">
          Write to the person you are becoming. Forge will send your own words back on the days you need them.
        </p>
      ) : (
        <p className="ps-home-text">
          {deliveryActive(state) && next
            ? <>Your next message arrives <strong>{next.daysAway <= 1 ? describeNext(next).toLowerCase() : `on ${describeNext(next)}`}</strong>, around {formatTime(state.delivery.time)}.</>
            : 'Notifications are off. Your letters and messages are here whenever you want them.'}
        </p>
      )}

      <div className="ps-home-actions">
        <button type="button" className="btn btn-primary ps-home-btn" onClick={() => onOpen(empty ? 'letters' : undefined)}>
          {empty ? 'Write my first letter' : 'Open my letters'}
        </button>
        {canRead && (
          <button type="button" className="btn btn-ghost ps-home-btn" onClick={onRead}>
            Read a message
          </button>
        )}
      </div>
    </section>
  );
}
