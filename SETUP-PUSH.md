# Forge background push — production setup

Background reminders need **four** things to be true at once. If any one of them
is missing, the "Send Test Notification" button still works (it is a purely
local notification that needs only permission) while **nothing** arrives when
Forge is closed. That is exactly the failure this document exists to remove.

1. Forge is installed to the iPhone Home Screen (iOS grants the Push API only
   to an installed web app — Safari tabs cannot receive push at all).
2. The build that is deployed contains `VITE_VAPID_PUBLIC_KEY`.
   **This is inlined at build time**, so setting it in Vercel is not enough —
   the app must be redeployed afterwards.
3. The server has the matching VAPID private key and a Redis/KV store.
4. Something calls `/api/cron/dispatch` every few minutes. Vercel Hobby cron
   runs **once per day**, which cannot deliver time-of-day reminders.

Settings → Notifications → "This device" and "Push diagnostics" report each of
these separately, so you can see which one is false.

---

## 1. Generate the VAPID key pair

Run locally (the repo already depends on `web-push`):

```bash
npx web-push generate-vapid-keys
```

It prints a `Public Key` and a `Private Key`. Keep both; the private key must
never be exposed to the browser.

## 2. Vercel environment variables

Vercel dashboard → the **75-hard-v2** project → **Settings** → **Environment
Variables**. Add each of the following for **Production** (ticking Preview and
Development too is fine):

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key from step 1 |
| `VAPID_PRIVATE_KEY` | the private key from step 1 |
| `VAPID_SUBJECT` | `mailto:your@email.com` (any contactable address) |
| `VITE_VAPID_PUBLIC_KEY` | **the same public key again** |
| `CRON_SECRET` | a long random string, e.g. `openssl rand -hex 32` |

`VITE_VAPID_PUBLIC_KEY` is deliberately a duplicate: variables prefixed `VITE_`
are the only ones Vite exposes to the client, and it is baked into the bundle
during `npm run build`.

> **If you only ever set the three unprefixed keys, this is the bug.** The
> client would call `subscribeToPush()`, find no public key, return
> `no-vapid-key`, and never create a subscription — so the server has nothing to
> send to, forever, with no visible error.

## 3. Attach a Redis / KV store

Vercel dashboard → **Storage** → **Create Database** → **Upstash for Redis**
(the Vercel KV option works identically) → connect it to the **75-hard-v2**
project.

That injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically. If you
created the database directly at upstash.com instead, add its REST URL and
token by hand as either `KV_REST_API_URL` / `KV_REST_API_TOKEN` or
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

Subscriptions, schedules, the send-once markers and the diagnostics all live
here. Without it the push endpoints return HTTP 503.

## 4. Redeploy — this step is mandatory

Vercel dashboard → **Deployments** → the most recent one → **⋯** →
**Redeploy**, with *Use existing Build Cache* **unticked**.

Environment variables are not applied retroactively. `VITE_VAPID_PUBLIC_KEY`
only reaches the app through a fresh build.

## 5. Give the dispatcher a real schedule

`vercel.json` keeps one daily cron entry (`0 8 * * *`) purely as a backstop,
because a more frequent schedule is rejected on the Hobby plan. Choose one of
the following to drive the real cadence.

### Option A — GitHub Actions (already in the repo, free here)

`.github/workflows/push-dispatch.yml` runs every 5 minutes. It needs two
repository secrets: GitHub → the repo → **Settings** → **Secrets and variables**
→ **Actions** → **New repository secret**:

| Name | Value |
|---|---|
| `FORGE_BASE_URL` | `https://75-hard-v2.vercel.app` |
| `CRON_SECRET` | the *same* value as `CRON_SECRET` in Vercel |

Then GitHub → **Actions** → **Push reminder dispatcher** → **Enable workflow**
if it is listed as disabled. You can also hit **Run workflow** there at any time
to flush a queued test push immediately.

Two things that make this fail silently:

- **Scheduled workflows run only from the repository's default branch.** This
  repo's default branch is `claude/75day-challenge-tracker-pwa-td1cnx`, so the
  workflow file must be present there. If it only exists on another branch the
  schedule never fires and GitHub reports no error at all.
- GitHub disables scheduled workflows in repositories with no activity for 60
  days. If reminders stop after a quiet couple of months, re-enable it on the
  Actions tab.

GitHub enforces a 5-minute minimum for scheduled workflows and runs them on a
best-effort basis, so a run can land a few minutes late. The dispatcher's
90-minute catch-up window absorbs that, and its per-day idempotency means a
reminder is still sent exactly once.

Actions minutes are free here because this repository is public. On a private
repo a 5-minute schedule (~8,600 runs a month, each billed as a whole minute)
would blow straight through the free allowance — use Option B there.

### Option B — cron-job.org (1-minute precision, free)

Create a job at <https://cron-job.org>:

- URL: `https://75-hard-v2.vercel.app/api/cron/dispatch`
- Method: `POST`
- Schedule: every minute
- Header: `Authorization: Bearer <your CRON_SECRET>`

Prefer the header over `?key=…`; a secret in a URL ends up in logs.

### Option C — Vercel Pro

On Pro, change `vercel.json` to `"schedule": "* * * * *"` and drop options A/B.

---

## 6. Verify it on the phone

1. Open Forge **from the Home Screen icon**, not Safari.
2. Settings → Notifications. Check the **This device** panel:
   - Installed to Home Screen — Yes
   - Notification permission — Enabled
   - Push API available — Yes
   - Push subscription on device — **Active**

   If the subscription says *None* while permission is granted, step 2/4 above
   has not taken effect yet.
3. Check **Push diagnostics**:
   - Server VAPID configured — Yes
   - Subscription store — Connected
   - Dispatcher running — **Yes**, with an observed interval of about 5 minutes
4. Tap **⏱️ Test Background Push in 3 Minutes**. It reports the due time, and
   warns instead of reassuring you if the dispatcher is not running.
5. **Close Forge completely** (swipe it away from the app switcher) and **lock
   the phone**. Do not reopen it.
6. The notification should appear on the lock screen within roughly 3 minutes
   plus one dispatcher interval.
7. Reopen Forge → Settings → Notifications → Refresh. **Confirmed on device**
   should now show a timestamp. That row is written by Forge's service worker
   after the push actually arrived — it is the only row that proves delivery.
   *Accepted by push service* means Apple took the request and says nothing
   about whether the phone received it.
8. Finally test a real reminder: set one for 5 minutes from now (Settings →
   Notifications → e.g. Water), reopen the Today screen once so the schedule
   syncs, then close Forge and lock the phone again.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Local test works, nothing in background | `VITE_VAPID_PUBLIC_KEY` missing from the build, or no subscription on device |
| *Push subscription on device: None* | Not installed to Home Screen, or the build has no public key |
| HTTP 503 from the push endpoints | VAPID keys or the KV store not configured |
| HTTP 401 from `/api/cron/dispatch` | `CRON_SECRET` differs between Vercel and the caller |
| *Dispatcher running: Never run* | Step 5 not done, or the GitHub secrets are unset |
| Queued test never arrives, dispatcher live | Check *Last error* in diagnostics; a `410 Gone` means the subscription was revoked — toggle Notifications off and on |
| Nothing fires at a reminder time | Check *In quiet hours* and *Due now* in diagnostics |
