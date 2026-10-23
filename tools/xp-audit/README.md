# XP economy audit scripts

The scripts behind `XP-ECONOMY-PROPOSAL.md` and `XP-ECONOMY-DATA.md`. They are
analysis tools, not part of the app bundle and not part of the test suite.

They import app source with absolute paths, so bundle before running:

```sh
./node_modules/.bin/esbuild tools/xp-audit/<name>.mjs \
  --bundle --platform=node --format=esm --outfile=/tmp/x.mjs && node /tmp/x.mjs
```

| script | what it reports |
|---|---|
| `audit2.mjs` | every template, mode, duration and task with its current XP, read from `start_tasks` and the configured builders |
| `sim.mjs` | current XP totals per challenge, run through the real `computeTotalXP` |
| `exploits.mjs` | the streak-break exploit, profile task-count disparity, bonus-rate skew, cycle-accurate 365-day benchmark |
| `proposed.mjs` | the proposed budget model at 1× scale, solved against the one-year benchmark |
| `final.mjs` | the proposed model at ×10 scale with integer task allocation, plus migration arithmetic |
| `shipped.mjs` | the benchmark, the full challenge matrix and the anti-farm checks, run through the IMPLEMENTED engine rather than a model |
| `final-tables.mjs` | the finalized per-challenge XP tables as Markdown (proposal §15) |
| `ratio.mjs` | the keystone-to-minor-habit ratio bounds, derived from the weights and measured against every challenge (§14.9) |

`proposed.mjs` and `final.mjs` implement the proposal standalone and import
nothing from the app, so they can be run with plain `node`.

Re-run these after any XP change: if a figure in the proposal no longer
matches, the proposal is stale, not the code.
