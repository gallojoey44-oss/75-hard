import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { LENGTH_CHOICE } from '../data/mentalPractices';

/**
 * The Standard length choice, on Home — asked once per attempt.
 *
 * Standard Mental Training now recommends ten minutes instead of fifteen. An
 * attempt saved at fifteen before Forge recorded whether a length was chosen
 * cannot say whether fifteen was the old recommendation or a decision, so it is
 * never changed for the person: they are asked, and nothing changes until they
 * answer. Either answer is stored on the attempt and the card does not return.
 *
 * Switching applies from today. Completed days keep their ticks, and XP,
 * streaks and history are read from those ticks, so none of them move.
 */
export default function TrainingLengthChoice() {
  const { profiles, activeProfile, trainingLengthChoiceLane, answerTrainingLengthChoice, LANE } = useApp();
  // The lane answered on this visit, so the card can confirm what was stored.
  const [answeredLane, setAnsweredLane] = useState(null);
  const lane = trainingLengthChoiceLane(activeProfile);
  const prof = profiles[activeProfile];
  const metaOf = (l) => (l === LANE.SUPPORT ? prof?.supportChallenge : prof?.activeChallenge);

  if (!lane) {
    // The confirmation reads the answer from the attempt itself, so it always
    // says what was actually saved.
    const decision = answeredLane ? metaOf(answeredLane)?.mentalTraining?.lengthChoice?.decision : null;
    if (!decision) return null;
    return (
      <div className="tlc-card tlc-done" role="status">
        {decision === 'switched'
          ? `✓ Mental Training is now ${LENGTH_CHOICE.to} minutes a day, from today.`
          : `✓ Keeping ${LENGTH_CHOICE.from} minutes a day. Forge won’t ask again.`}
      </div>
    );
  }

  const name = metaOf(lane)?.name || 'Mental Training Phase';
  const which = lane === LANE.SUPPORT ? `${name} (your Support Challenge)` : name;

  function answer(decision) {
    if (answerTrainingLengthChoice(lane, decision, activeProfile)) setAnsweredLane(lane);
  }

  return (
    <div className="tlc-card" data-lane={lane}>
      <div className="tlc-title">🧘 Standard now recommends {LENGTH_CHOICE.to} minutes</div>
      <p className="tlc-body">
        {which} asks for {LENGTH_CHOICE.from} minutes of Mental Training a day, the previous
        recommendation. The phase already includes reading, prayer, gratitude and a focus block,
        so Standard now asks for {LENGTH_CHOICE.to}.
      </p>
      <p className="tlc-body">
        Forge can’t tell whether {LENGTH_CHOICE.from} was your choice, so it won’t change it
        without asking. Completed days, XP and your streak stay as they are either way.
      </p>
      <button className="btn btn-primary btn-full tlc-switch" onClick={() => answer('switch')}>
        <span className="tlc-label">Switch to {LENGTH_CHOICE.to} minutes</span> <span className="tlc-tag">Recommended</span>
      </button>
      <button className="btn btn-secondary btn-full tlc-keep" onClick={() => answer('keep')}>
        Keep {LENGTH_CHOICE.from} minutes
      </button>
      <p className="tlc-foot">A switch applies from today.</p>
    </div>
  );
}
