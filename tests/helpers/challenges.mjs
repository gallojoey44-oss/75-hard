/**
 * Driving the Challenges tab from a test.
 *
 * The tab used to be one page: a challenge expanded in place and its Start
 * button was inside the expanded card. It is now a navigation stack — tile →
 * details page → stepped setup — so every suite that used to click a header
 * and read the card it came from needs the same three or four moves instead.
 *
 * They live here rather than in fourteen suites so the next change to the flow
 * is one edit, not fourteen. Each function does exactly what a person would:
 * no fixture writing, no shortcuts through the state layer.
 */

/** Open a challenge's details page from the library. */
export async function openChallenge(page, name) {
  await page.locator('.f4c-tile', { hasText: name }).first().click();
  await page.waitForSelector('.f4c-details', { timeout: 10000 });
  await page.waitForTimeout(250);
}

/** Back out of a details page (or any sub-screen) to the Challenges home. */
export async function backToChallenges(page) {
  for (let i = 0; i < 6; i++) {
    if (await page.locator('.f4c-home').count()) return;
    const back = page.locator('.f4c-back, .modal-card .btn-ghost').last();
    if (!(await back.count())) return;
    await back.click();
    await page.waitForTimeout(300);
  }
}

/** Choose a difficulty mode on a details page or a setup step. */
export async function pickMode(page, label) {
  await page.locator('.f4c-mode', { hasText: new RegExp(`^${label}`, 'i') }).first().click();
  await page.waitForTimeout(300);
}

/** Choose a length, by its number of days. */
export async function pickDuration(page, days) {
  await page.locator('.f4c-dur', { hasText: new RegExp(`^${days}\\b`) }).first().click();
  await page.waitForTimeout(300);
}

/** Begin the setup flow from an open details page. */
export async function beginSetup(page) {
  await page.locator('.f4c-btn.primary', { hasText: /^Start / }).first().click();
  await page.waitForTimeout(450);
}

/**
 * Walk the setup flow to its final step without confirming.
 *
 * Returns the label of the confirm button, which says whether the attempt
 * would start today or be scheduled — the one thing a caller usually wants to
 * assert before committing.
 */
export async function advanceToStart(page, { letter = 'Because I said I would.' } = {}) {
  for (let i = 0; i < 10; i++) {
    // The Future Self Letter and the configured setup screens are their own
    // components; they are filled and submitted as themselves.
    const ta = page.locator('.modal-card textarea').first();
    if (await ta.count()) {
      await ta.fill(letter);
      await page.waitForTimeout(150);
      const submit = page.locator('.modal-card button', { hasText: /Save|Begin|Continue|Start|Next/i }).last();
      if (await submit.count()) { await submit.click(); await page.waitForTimeout(450); continue; }
    }
    const primary = page.locator('.f4c-setup .f4c-btn.primary').last();
    if (await primary.count()) {
      const label = (await primary.textContent()) || '';
      if (/Start now|Schedule for/.test(label)) return label.trim();
      await primary.click();
      await page.waitForTimeout(450);
      continue;
    }
    // A configured challenge's own setup screen.
    const cfg = page.locator('.modal-card button, .modal-overlay button')
      .filter({ hasText: /Start|Continue|Next|Begin/i }).last();
    if (await cfg.count()) { await cfg.click(); await page.waitForTimeout(500); continue; }
    break;
  }
  return null;
}

/**
 * Step forward until the review of the commitment is on screen, and stop
 * there. Unlike `passReview`, this leaves the review showing so its priced
 * list can be read.
 */
export async function advanceToReview(page) {
  for (let i = 0; i < 6; i++) {
    if (await page.locator('.f4c-review-sec').count()) return true;
    const btn = page.locator('.f4c-setup .f4c-btn.primary').last();
    if (!(await btn.count())) return false;
    await btn.click();
    await page.waitForTimeout(450);
  }
  return (await page.locator('.f4c-review-sec').count()) > 0;
}

/**
 * Step back until a given setup step is on screen, identified by a selector
 * that only that step renders.
 */
export async function backToStep(page, selector) {
  for (let i = 0; i < 6; i++) {
    if (await page.locator(selector).count()) return true;
    const back = page.locator('.f4c-setup .f4c-btn.ghost, .modal-card .btn-ghost').last();
    if (!(await back.count())) return false;
    await back.click();
    await page.waitForTimeout(400);
  }
  return (await page.locator(selector).count()) > 0;
}

/**
 * Click past any setup step that is only showing information — the review of
 * the commitment, and the hard-mode confirmation. Stops as soon as a step
 * needs a real answer (the letter, the date, a configured setup screen).
 */
export async function passReview(page) {
  for (let i = 0; i < 4; i++) {
    const btn = page.locator('.f4c-setup .f4c-btn.primary').last();
    if (!(await btn.count())) return;
    const label = (await btn.textContent()) || '';
    if (/Start now|Schedule for/.test(label)) return;
    if (!/Looks right|Next/.test(label)) return;
    await btn.click();
    await page.waitForTimeout(450);
    if (await page.locator('.modal-card textarea').count()) return;
  }
}

/** Choose when Day 1 is, on the final step. */
export async function pickStartDate(page, when) {
  const label = when === 'today' ? 'Start Today'
    : when === 'tomorrow' ? 'Start Tomorrow' : 'Choose Date';
  await page.locator('.f4c-dur', { hasText: label }).first().click();
  await page.waitForTimeout(250);
}

/** Confirm, actually creating the attempt. */
export async function confirmStart(page) {
  await page.locator('.f4c-setup .f4c-btn.primary').last().click();
  await page.waitForTimeout(800);
}

/**
 * Tile → details → setup → confirm, in one call: the whole "start this
 * challenge" journey a person makes.
 */
export async function startChallenge(page, name, { mode = null, days = null, when = 'today' } = {}) {
  await openChallenge(page, name);
  if (mode) await pickMode(page, mode);
  if (days) await pickDuration(page, days);
  await beginSetup(page);
  await advanceToStart(page);
  await pickStartDate(page, when);
  await confirmStart(page);
}

/** Everything the open details page says, as one string. */
export function detailsText(page) {
  return page.textContent('.f4c-details');
}
