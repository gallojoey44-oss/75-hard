# Friends and Our Journey — design, privacy and setup

Our Journey is a private space for two people to grow, on their own and together:
shared goals both people agree to, each person's contributions toward them,
**Our Future** (long-term plans), and an optional weekly check-in. It sits on a
small **Friends** system: people connect by exact username or invite code, and a
Journey can only be started with an accepted friend who agrees to it.

This branch (`claude/shared-journey-mvp`) is **not deployed to production**.
Production builds don't receive the server settings, so the Our Journey card
doesn't appear there at all.

---

## 1. How it fits into Forge

| | Personal Forge | Friends & Our Journey |
|---|---|---|
| Where data lives | This device (`localStorage`), as before | Supabase (Postgres) |
| Sign-in | None | Email one-time code |
| Works offline | Yes, fully | Shows the last-seen Journey, read-only |
| In backups | Yes, as before | No: a backup never contains Journey data, sessions or tokens |

* **Accounts are not profiles.** The Male/Female slots on a device are local
  profiles. A Forge account is a person, signed in with their email. Each local
  profile remembers its own sign-in, so on a shared phone one person's account
  never appears under the other's profile. Switching profiles signs no one in
  or out.
* **Nothing personal is uploaded.** The Journey code never reads habits, XP,
  ranks, Daily Logs, ratings, notes, letters, health data or challenges, and
  the server has no table that could hold them. The two-phone test inspects
  every request each phone sends to prove it.
* **Personal Forge pays almost nothing for it.** The Journey screens and the
  Supabase client are loaded only when someone opens Our Journey. A signed-in
  profile's Home card also refreshes in the background. The always-loaded app
  grows by about 2.5 KB gzipped (the Home card).
* **No new tab.** Our Journey is a place reached from a card on Home, like
  Letters to My Future Self.
* **No XP, no scoring.** Shared goals show combined progress and who
  contributed what. There are no points, ranks or comparisons.

### Why Supabase

Forge is a static React PWA on Vercel. A handful of Vercel functions with
Upstash Redis handle push reminders, and there were no user accounts.
Supabase fits without changing any of that:

* **Auth:** email one-time codes, sessions and refresh handled by Supabase.
  There are no passwords to store.
* **Server-side rules:** Postgres functions enforce who may see or change
  what. A modified app can't bypass them.
* **Two-device sync:** both phones read and write the same database.
* **Native iOS later:** `supabase-swift` calls the same functions, so the rules
  carry over unchanged.
* **No privileged key in the app:** the app only ever holds the public anon
  key.

---

## 2. Privacy and access rules

All shared data lives in a Postgres schema called `forge`. That schema is
**not exposed** through Supabase's Data API. Its tables have row-level security
switched on and grant nothing to `anon` or `authenticated`. Even someone with
the public key and a valid session cannot read or write a single row directly.

The only way in is a set of `public.forge_*` functions. Each one:

* is callable only when signed in (`anon` can call none of them);
* starts from `auth.uid()`, the person proven by their session;
* checks the relationship it needs before touching anything: that two people
  are friends, that both agreed to the Journey, that a goal belongs to the
  caller's own Journey;
* answers "not found" for anything outside your own Journey, so it never
  reveals that someone else's data exists.

**What other people can see:**

* **Friends** see your username and optional display name. Nothing else.
* **Anyone** who types your exact username, or holds your invite code, sees
  only your username and display name. There is no partial search, no listing
  and no suggestions.
* **Your Journey partner** sees only what either of you adds to the Journey:
  goals, contributions (with notes), Our Future plans and check-ins.
  Check-ins are shared once saved, and the screen says so.

**Consent and ways out:**

* **Friend requests** must be accepted. Declining deletes the request and
  nothing is recorded.
* **A Journey** stays *pending* until the invited friend accepts. Nothing can
  be written into it before then.
* **Each goal** must be agreed by the other member before contributions count.
* **Cancel** a friend request or a Journey invitation at any time.
* **Make a new invite code:** every link already shared stops working.
* **Leave a Journey:** it ends for both people, and its goals, contributions,
  Our Future plans and check-ins are deleted. You stay friends.
* **Remove a friend:** the friendship ends, and so does any Journey you share,
  with its content.
* **Delete an account** in the Supabase dashboard: the person is removed
  everywhere and their Journey ends.
* **Sign out** removes this profile's session and cached Journey from the
  phone. "Delete all profile data" in Settings does the same.

---

## 3. Data model

```
accounts ── friendships (pending → accepted; declined/removed rows are deleted)
   └─ journey_members ── journeys (pending → active) ── goals ── contributions
                                         ├── future_items
                                         └── checkins (one per person per week)
```

A Journey has *members* rather than "two people", so groups and more than one
Journey per person can be added later without migrating data. For now:

* **Size:** exactly two members.
* **One at a time:** each person may have one open Journey, either an
  invitation they sent or an active Journey. The database enforces this with a
  unique index.

The full schema and every rule are in
`supabase/migrations/20261127000000_forge_friends_and_journey.sql`, written to
be read top to bottom.

---

## 4. Setting it up (exactly what to do)

### 4.1 Create the Supabase project

1. At supabase.com, choose **New project**. Pick a region near you and save the
   database password (the app never uses it).
2. Open **SQL Editor**, then **New query**. Paste the whole of
   `supabase/migrations/20261127000000_forge_friends_and_journey.sql` and choose
   **Run**. It should finish with "Success. No rows returned".
3. Open **Project Settings**, then **Data API**. Leave **Exposed schemas** as
   `public, graphql_public`. **Do not add `forge`.**

### 4.2 Email sign-in with a code

1. **Authentication → Sign In / Providers → Email:** turn it on and keep
   **Confirm email** on.
2. **Authentication → Emails → Templates:** edit **both** of these templates
   so the email contains the code:
   * **Confirm signup**, which new accounts receive;
   * **Magic Link**, which returning accounts receive.

   Without `{{ .Token }}` the email has only a link, which Forge doesn't use.

   ```html
   <h2>Your Forge code</h2>
   <p>Enter this code in Forge:</p>
   <p style="font-size:24px;letter-spacing:4px"><strong>{{ .Token }}</strong></p>
   <p>It expires in an hour. If you didn't ask for it, you can ignore this email.</p>
   ```

3. **Authentication → URL Configuration:** set **Site URL** to the Forge
   address you will use. Codes don't need it, but leave it correct.
4. **Rate limits:** Supabase's built-in email service is meant for testing and
   sends only a few emails an hour. Two people signing in once is fine, and
   sessions last a long time. If codes stop arriving, wait a little, or add your
   own SMTP under **Authentication → Emails → SMTP Settings** (for example
   Resend or Postmark).

### 4.3 Get the keys

In **Project Settings → API Keys**, copy:

* the **Project URL** (`https://<ref>.supabase.co`);
* the **anon / public** key, or the newer **publishable** key
  (`sb_publishable_…`). Either works.

**Never put the `service_role` / secret key in Vercel or in the app.**

### 4.4 Point a preview deployment at it (not production)

1. In Vercel, open project **75-hard-v2**, then **Settings → Environment
   Variables**. Add:

   | Name | Value | Environments |
   |---|---|---|
   | `VITE_SUPABASE_URL` | the Project URL | **Preview** only (optionally just the branch `claude/shared-journey-mvp`) |
   | `VITE_SUPABASE_ANON_KEY` | the anon or publishable key | **Preview** only (optionally just the branch `claude/shared-journey-mvp`) |

2. These values are built into the app, so **redeploy** the branch: in
   **Deployments**, open the latest `claude/shared-journey-mvp` preview, then
   **⋯ → Redeploy**.
3. Production is untouched. It has no such variables, and the Our Journey card
   only appears on a build that has them.

### 4.5 Check the project before relying on it

On your own computer, from this repository:

```bash
npm install
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_ANON_KEY=<anon or publishable key> \
SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
node tools/verify-journey.mjs
```

The script:

* uses the service-role key **only on your machine**, to create three
  throwaway accounts (no email is sent) and to delete them afterwards;
* runs every check as those people through the real Data API:
  * signed-out callers are refused;
  * lookups only work by exact username;
  * friend requests and Journeys need consent;
  * two separate sessions see the same combined goal;
  * an outsider can't read or change anything;
  * no table is readable directly;
  * leaving ends the Journey for both;
* should end with every line `PASS`.

### 4.6 Connect your two phones

1. **Sign in on both phones.** Each person opens the preview URL on their own
   phone, then **Home → Open Our Journey**, enters their email and the code it
   sends, and chooses a username.
2. **Become friends.** One person opens **Friends**, types the other's exact
   username and sends a request. They can also share their invite code or link
   instead. The other person opens **Friends** and accepts.
3. **Start the Journey.** One person taps **Invite** under **Start a Journey**,
   and the other accepts.
4. **Use it.** Suggest a shared goal; the other agrees; both add
   contributions. While Our Journey is open, each phone checks for the other's
   changes every few seconds and whenever it comes back to the foreground.

An app installed to the Home Screen keeps its own storage, separate from
Safari. Sign in inside whichever one you'll use.

---

## 5. Tests

These need Docker. They start a local copy of Supabase's own services:

* Supabase Postgres;
* Supabase Auth;
* PostgREST;
* Mailpit, which catches the sign-in emails;
* a small gateway in place of Supabase's API gateway.

The migration is applied fresh each run.

| Suite | What it proves |
|---|---|
| `tests/journey-api-e2e-test.mjs` | Every server rule, tried from outside with three real accounts signed in by emailed codes. Checks signed-out refusal, username rules, exact-only lookup, requests, invitations and agreement, contributions, revoked invite codes, direct table access, sessions edited to impersonate someone, leaving, removing and account deletion. |
| `tests/journey-e2e-test.mjs` | Two phones (separate browser contexts) through the real UI: signing in by email code, friends, invitation, agreed goal, contributions syncing both ways, completion celebrated on both phones, Our Future, check-ins, invite link and revoked code, leaving and removing. Also proves that no personal data is in any request, that profiles, XP and backups are untouched, that an account is not a profile, and that layouts fit at 320, 390 and 430px. |

```bash
node tests/journey-api-e2e-test.mjs
node tests/journey-e2e-test.mjs        # JOURNEY_SHOTS=<dir> saves screenshots
```

---

## 6. Known limits and next steps

* **Sync is by refresh, not push.** An open Journey screen checks every 8
  seconds and when the app returns to the foreground. Supabase Realtime, or a
  push notification when your partner contributes, can come next.
* **Invite links on iPhone.** A link opens in Safari, not in an installed
  Home Screen app. The invite code works everywhere and is shown alongside the
  link.
* **Leaving deletes the Journey's content for both people.** That is the
  clearest and most private rule for now. An "archive before leaving" option
  could be added.
* **No in-app account deletion yet.** Deleting the user in the Supabase
  dashboard removes them everywhere.
* **One Journey per person, two members.** The data model is ready for more.
* **The Personal Development Path isn't linked to shared goals yet**, by
  design.
