# Forge tests

These live in the repo (not a temp directory) so they survive environment resets.

## Running

Unit tests import app source directly and are bundled with esbuild first.
End-to-end tests drive a real browser against a production build.

```bash
npm install
npm run build
npx vite preview --port 4173 &   # e2e tests expect this on :4173
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
| `smoke-e2e-test.mjs` | e2e | Broad regression pass: navigation, task logging, XP, challenge performance, current-day neutrality, bonus-mission exclusion, insights, settings, backup/restore, profile separation |

## Note on history

Earlier feature work in this project was verified by a larger set of suites that
were kept in a temporary scratch directory. An environment cleanup removed them,
so they are not recoverable. Anything added from now on belongs here, in the
repo, and should be runnable via `tests/run.mjs`.
