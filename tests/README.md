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
| `mental-training-unit-test.mjs` | unit | Mental Training's six practices: one habit with unchanged id, weight and XP; the practice content and its no-promises rule; 5/10/15/30 minutes with each mode's minimum (Standard from 10), a running attempt keeping its own length; identical XP at every length; the per-attempt stamp, legacy attempts and template syncs; the support lane; overlaps named, never ticked; the timestamp timer; every new length recorded as default or customized, and Retry following it; the one-time Standard 15 → 10 choice (who is asked, switch and keep, XP, completed days and streak unchanged, never asked twice, either lane) |
| `mental-training-e2e-test.mjs` | e2e | The same in a browser: the setup step, the Today row and Begin Training, nothing but confirmation completing anything, device-free practices, one completion and one reward, a second session paying nothing, undo, reload, navigation, both profiles, legacy attempts and syncs, 320/390/430px, Mental Training as a Support Challenge; and the length choice on Home — shown only for a Standard attempt saved at 15 with nothing recorded, Switch and Keep on each profile, no repeat after a reload, answers fired together saved once, a scheduled attempt, the support lane, setup recording default or chosen, and Retry of a default, a chosen and an unanswered length |
| `daily-log-stress-e2e-test.mjs` | e2e | Stress beside Mood and Energy in the Daily Log: the order (Mood, Energy, Stress, Hours Slept, Notes, then More metrics), the 1 = minimal / 10 = extreme note, one Stress control and More metrics keeping the other four, every value 1–10 saved to the same `stress` field and kept through a reload, the Daily Log completing once with unchanged XP, stress saved before this release (any day), both profiles, a backup exported and an older one restored, 320/390/430px |
| `ios-native-shell-e2e-test.mjs` | e2e | The iPhone app (Capacitor) and the web app from one build. Web: the service worker still registers, the Home Screen and update sections stay, the web notification guidance, the backup download, and no Capacitor code is loaded. App, through a simulated native bridge (`window.webkit.messageHandlers.bridge`, the plugin list and `nativePromise`): a fresh start, no service worker, no `/api` or Web Push traffic, the web-only sections hidden, honest notification copy (Settings and past-self delivery), the backup written with Filesystem and shared with Share (a cancelled sheet is not an error, a failure is), restore, both profiles with their own accents and data, reloads, every tab, no errors. Device-only checks are listed in `IOS.md` |
| `smoke-e2e-test.mjs` | e2e | Broad regression pass: navigation, task logging, XP, challenge performance, current-day neutrality, bonus-mission exclusion, insights, settings, backup/restore, profile separation |
| `xp-integrity-unit-test.mjs` | unit | XP accounting fixes, with the rules pinned first (Forge Daily −60 per missed day, partial days, the toggle, challenge rates). Stored data reads exactly as before; ending any segment moves no XP (gross archives, carried no-record periods, support challenges in the primary's units); the rank floor protects XP but never creates it (transitions, retroactive edits, the toggle, legacy credits); a randomised history never gains XP; the notice shows each missed day once |
| `xp-integrity-e2e-test.mjs` | e2e | The same in a browser, on a fake clock: the Forge Daily note on Home (on, off, not started, both profiles), the Settings description, 7 days −420 then "1 more missed day" −60 the next morning, dismissal moving no XP, starting a challenge from Forge Daily with a deficit and from the floor (75,000 stays 75,000), retroactive edits and the toggle at the floor, pre-fix data and old acknowledgements, 320/390/430px; and a transition never running twice — a control fired twice in one task, a real double-click, both lanes finishing at the same moment |
| `support-promotion-unit-test.mjs` | unit | Promoting a Support Challenge: stamped with the economy the support ran under (the same stamp a new attempt gets on the current economy; the old economy kept for a support that ran beside a pre-October attempt), habit values never repriced, a promoted day paying face value instead of ten times over, shared days counted once, a choice left waiting from an earlier version read from the finished primary's archive |
| `support-promotion-e2e-test.mjs` | e2e | The same in a browser: a support added from the picker and promoted after its primary finishes (current economy, no XP moved, Day 6 start), an old-economy promotion that pays exactly what it always did, a choice left waiting from an earlier version (unchanged on load, shared days counted once on promotion), an already-promoted old-economy attempt untouched on load, the other profile untouched |

## Note on history

Earlier feature work in this project was verified by a larger set of suites that
were kept in a temporary scratch directory. An environment cleanup removed them,
so they are not recoverable. Anything added from now on belongs here, in the
repo, and should be runnable via `tests/run.mjs`.
