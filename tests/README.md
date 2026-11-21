# Forge tests

These live in the repo (not a temp directory) so they survive environment resets.

## Running

Unit tests import app source directly and are bundled with esbuild first.
End-to-end tests drive a real browser against a production build.

```bash
npm install
npm run build
npx vite preview --port 4173 --strictPort &   # e2e tests expect this on :4173
node tests/run.mjs               # runs everything
```

Run a single suite:

```bash
node tests/run.mjs fatloss-duration      # matches by name
```

`FORGE_BASE` overrides the e2e base URL (default `http://localhost:4173`).

## Suites

| Suite | Type | Covers |
| --- | --- | --- |
| `fatloss-duration-unit-test.mjs` | unit | Fat Loss 14/30/60 duration options, defaults, labels, per-duration completion bonuses and XP balance, duration-aware program copy, scoping to other templates |
| `fatloss-duration-e2e-test.mjs` | e2e | Duration setup UI, persistence per attempt, completion timing at day 14/30/60, archives, legacy 30-day attempts, backup/restore, current-day fairness |
| `past-self-unit-test.mjs` | unit | Letters to My Future Self: weekday and time-zone scheduling across both DST changes, rotation, the privacy boundary (what is and is not uploaded), send-once dispatch, the shared-subscription guard, and that no function, storage key or tab was added |
| `past-self-e2e-test.mjs` | e2e | The same feature in a browser: letters, messages, scheduling, both profiles, refused permission, backup and restore, and delivery through the real dispatcher and service worker. Builds a second copy of the app with a placeholder VAPID key on **:4174** and needs full Chromium (`channel: 'chromium'`), because the headless shell reports notifications as denied. `PS_ONLY=A,C,D,E` runs chosen parts |
| `mental-training-unit-test.mjs` | unit | Mental Training's six practices: one habit with unchanged id, weight and XP; the practice content and its no-promises rule; 5/15/30 minutes with each mode's minimum; identical XP at every length; the per-attempt stamp, legacy attempts and template syncs; the support lane; overlaps named, never ticked; the timestamp timer |
| `mental-training-e2e-test.mjs` | e2e | The same in a browser: the setup step, the Today row and Begin Training, nothing but confirmation completing anything, device-free practices, one completion and one reward, a second session paying nothing, undo, reload, navigation, both profiles, legacy attempts and syncs, 320/390/430px, and Mental Training as a Support Challenge |
| `smoke-e2e-test.mjs` | e2e | Broad regression pass: navigation, task logging, XP, challenge performance, current-day neutrality, bonus-mission exclusion, insights, settings, backup/restore, profile separation |
| `xp-integrity-unit-test.mjs` | unit | XP accounting fixes, with the rules pinned first (Forge Daily −60 per missed day, partial days, the toggle, challenge rates). Stored data reads exactly as before; ending any segment moves no XP (gross archives, carried no-record periods, support challenges in the primary's units); the rank floor protects XP but never creates it (transitions, retroactive edits, the toggle, legacy credits); a randomised history never gains XP; the notice shows each missed day once |
| `xp-integrity-e2e-test.mjs` | e2e | The same in a browser, on a fake clock: the Forge Daily note on Home (on, off, not started, both profiles), the Settings description, 7 days −420 then "1 more missed day" −60 the next morning, dismissal moving no XP, starting a challenge from Forge Daily with a deficit and from the floor (75,000 stays 75,000), retroactive edits and the toggle at the floor, pre-fix data and old acknowledgements, 320/390/430px |

## Note on history

Earlier feature work in this project was verified by a larger set of suites that
were kept in a temporary scratch directory. An environment cleanup removed them,
so they are not recoverable. Anything added from now on belongs here, in the
repo, and should be runnable via `tests/run.mjs`.
