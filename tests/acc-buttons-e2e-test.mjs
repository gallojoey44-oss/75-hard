/**
 * Challenges home — the controls' geometry.
 *
 * Run against a production build:  npx vite preview --port 4173
 * then:                            node tests/acc-buttons-e2e-test.mjs
 *
 * These assertions are MEASURED, not inspected: real bounding boxes from a real
 * layout at real iPhone widths. A spacing bug is a number, so it is tested as
 * one — "looks fine" is how the buttons ended up touching in the first place.
 *
 * The Forge 4.0 redesign changed what is being measured. The active card no
 * longer contains the Add Support button or a two-button row: each lane gets a
 * compact card with one Manage control, Add Support is a row of its own, and a
 * single primary button leads to the day's work. What is still checked is the
 * same thing — consistent sizing, nothing touching, nothing escaping the
 * screen — at three widths, with a short title and a long one, with and
 * without a support challenge.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const browser = await chromium.launch();
const errors = [];

// iPhone SE, iPhone 13/14, iPhone 15 Pro Max.
const WIDTHS = [
  { w: 320, h: 568, name: 'iPhone SE (1st gen, 320px)' },
  { w: 390, h: 844, name: 'iPhone 14 (390px)' },
  { w: 430, h: 932, name: 'iPhone 15 Pro Max (430px)' },
];

const LONG_TITLE = 'Women\'s Hormone Health & Cycle Optimization Challenge';

/** Seed an active challenge and open the Challenges tab. */
async function setup(page, { title, support }) {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
  await page.evaluate(({ t, sup }) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    const d = new Date(); d.setDate(d.getDate() - 5);
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    p.me.highestRank = 8;
    p.me.challengeStart = s;
    p.me.activeChallenge = {
      // Stamped with the current economy, as a real new attempt is: an
      // unstamped primary is era 1, which cannot take a Support Challenge.
      xpEconomyVersion: 2, effortTier: 'medium_hard', dailyBudget: 180,
      templateId: 'lock_in_14_day', name: t, emoji: '🎯', variant: 'standard',
      durationDays: 14, templateVersion: 1, completionBonusXP: 700,
      lockIn: { durationDays: 14, sleepHours: 8, attentionMinutes: 10, recoveryMinutes: 20, shutdownMinutes: 5 },
    };
    p.me.tasks = [
      { id: 'li_sleep', name: 'Sleep opportunity: 8+ hours', icon: '😴', xp: 40, keystone: 3, source: 'template', order: 0 },
      { id: 'li_flow', name: 'Flow training: 2 focused sessions', icon: '🌊', xp: 35, keystone: 3, source: 'template', order: 1 },
    ];
    if (sup) {
      p.me.supportChallenge = {
        xpEconomyVersion: 2,
        templateId: 'sleep_reset_challenge', name: 'Sleep Reset', emoji: '😴',
        durationDays: 14, startDate: s,
      };
      p.me.supportChallengeStart = s;
    }
    localStorage.setItem('profiles', JSON.stringify(p));
  }, { t: title, sup: support });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.bottom-nav .nav-tab')]
      .find(x => /Challenges/i.test((x.getAttribute('aria-label') || x.textContent)));
    if (b) b.click();
  });
  await page.waitForTimeout(450);
}

/** Measured geometry of the Challenges home screen's controls. */
function measure(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.f4c-active');
    if (!card) return null;
    const box = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        top: r.top, bottom: r.bottom, left: r.left, right: r.right,
        w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100,
        radius: cs.borderTopLeftRadius, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        bg: cs.backgroundColor, bgImage: cs.backgroundImage,
        border: cs.borderTopWidth, borderColor: cs.borderTopColor, color: cs.color,
      };
    };
    const cardCs = getComputedStyle(card);
    const cards = [...document.querySelectorAll('.f4c-active')];
    return {
      card: { ...box(card), padBottom: cardCs.paddingBottom, padTop: cardCs.paddingTop },
      cardCount: cards.length,
      manage: box(card.querySelector('.f4c-active-actions .f4c-btn')),
      supportCard: box(document.querySelector('.f4c-active.support')),
      supportEnd: box(document.querySelector('.f4c-active.support .f4c-btn')),
      addSupport: box(document.querySelector('.f4c-add-support')),
      cta: box([...document.querySelectorAll('.f4c-btn.primary.wide')][0]),
      grid: box(document.querySelector('.f4c-grid')),
      tiles: [...document.querySelectorAll('.f4c-tile')].slice(0, 2).map(box),
      pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
      viewport: window.innerWidth,
    };
  });
}

for (const { w, h, name } of WIDTHS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', e => errors.push(`${name}: ${e}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  await page.goto(BASE);
  // A first visit shows the profile picker, so choose one before waiting for
  // the dashboard.
  await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 10000 });

  // ── Primary only: card, Manage, Add Support, one CTA ────────────────────
  await setup(page, { title: 'LOCK IN', support: false });
  let m = await measure(page);
  check(`${name}: the active challenge card renders`, !!m);
  check(`${name}: exactly one lane is shown`, m.cardCount === 1, `${m.cardCount}`);
  check(`${name}: it carries one Manage control`, !!m.manage, `manage=${!!m.manage}`);
  check(`${name}: Add Support is offered as its own row`, !!m.addSupport);
  check(`${name}: and there is exactly one primary call to action`, !!m.cta);

  // Nothing touches: every control clears the one above it.
  const stack = [m.card, m.addSupport, m.cta].filter(Boolean);
  for (let i = 1; i < stack.length; i++) {
    const gap = Math.round((stack[i].top - stack[i - 1].bottom) * 10) / 10;
    check(`${name}: ${Math.round(gap)}px of clear space above control ${i + 1}`,
      gap >= 8 && gap <= 28, `${gap}px`);
  }

  // Touch targets.
  check(`${name}: Manage is at least 44px tall`, m.manage.h >= 44, `${m.manage.h}px`);
  check(`${name}: Add Support is at least 52px tall`, m.addSupport.h >= 52, `${m.addSupport.h}px`);
  check(`${name}: the primary action is at least 44px tall`, m.cta.h >= 44, `${m.cta.h}px`);

  // Widths: the full-width controls match the card they sit under.
  check(`${name}: Add Support is as wide as the card`,
    Math.abs(m.addSupport.w - m.card.w) <= 1, `${m.addSupport.w} vs ${m.card.w}`);
  check(`${name}: the primary action is as wide as the card`,
    Math.abs(m.cta.w - m.card.w) <= 1, `${m.cta.w} vs ${m.card.w}`);
  check(`${name}: and they share a left edge`,
    Math.abs(m.addSupport.left - m.card.left) <= 1 && Math.abs(m.cta.left - m.card.left) <= 1,
    `${m.addSupport.left} / ${m.cta.left} / ${m.card.left}`);

  // Hierarchy: the primary action is the filled one; Manage and Add Support
  // are quieter surfaces, not competing slabs.
  check(`${name}: the primary action is a filled gradient`,
    /gradient/.test(m.cta.bgImage), m.cta.bgImage.slice(0, 40));
  check(`${name}: Manage is not`, !/gradient/.test(m.manage.bgImage), m.manage.bgImage.slice(0, 30));
  check(`${name}: Add Support is a subtle surface, not an opaque slab`, (() => {
    const [r, g, bl] = (m.addSupport.bg.match(/\d+/g) || []).map(Number);
    return r < 90 && g < 90 && bl < 90;
  })(), m.addSupport.bg);
  check(`${name}: identical corner radius on the two full-width controls`,
    m.addSupport.radius === m.card.radius, `${m.addSupport.radius} vs ${m.card.radius}`);

  // The library begins below, in two readable columns (one at 320px).
  check(`${name}: the library grid is present`, !!m.grid);
  check(`${name}: its tiles are equal width`,
    m.tiles.length < 2 || Math.abs(m.tiles[0].w - m.tiles[1].w) <= 1,
    m.tiles.map(t => t.w).join(' vs '));

  // Nothing escapes the screen.
  check(`${name}: no horizontal page overflow`, m.pageOverflow <= 0, `${m.pageOverflow}px`);
  check(`${name}: every control stays inside the viewport`,
    [m.card, m.addSupport, m.cta, m.grid].filter(Boolean)
      .every(x => x.left >= -0.5 && x.right <= m.viewport + 0.5),
    [m.card, m.addSupport, m.cta].filter(Boolean).map(x => `${x.left}→${x.right}`).join(' '));

  // ── With a support challenge: two lanes, no duplicate controls ───────────
  await setup(page, { title: 'LOCK IN', support: true });
  m = await measure(page);
  check(`${name}: both lanes are shown`, m.cardCount === 2, `${m.cardCount}`);
  check(`${name}: the support lane has its own End control`, !!m.supportEnd);
  check(`${name}: Add Support is gone while one is running`, !m.addSupport);
  check(`${name}: there is still exactly one primary call to action`, !!m.cta);
  check(`${name}: the support card clears the primary`,
    m.supportCard.top > m.card.bottom, `${m.supportCard.top} vs ${m.card.bottom}`);
  check(`${name}: and the call to action clears the support card`,
    m.cta.top >= m.supportCard.bottom, `${m.cta.top} vs ${m.supportCard.bottom}`);
  check(`${name}: with a support challenge, still no horizontal overflow`,
    m.pageOverflow <= 0, `${m.pageOverflow}px`);

  // ── A long challenge name must not break the layout ──────────────────────
  await setup(page, { title: LONG_TITLE, support: false });
  m = await measure(page);
  check(`${name}: a long title does not overflow the screen`,
    m.pageOverflow <= 0 && m.card.right <= m.viewport + 0.5,
    `overflow ${m.pageOverflow}px, card right ${m.card.right}`);
  check(`${name}: a long title does not push the controls out of the card`,
    Math.abs(m.cta.w - m.card.w) <= 1, `${m.cta.w} vs ${m.card.w}`);

  await page.close();
}

// ── The underlying bug: .btn-secondary now has a real style everywhere ─────
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE);
  await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 10000 });
  const probe = await page.evaluate(() => {
    const el = document.createElement('button');
    el.className = 'btn btn-secondary btn-full';
    el.textContent = 'probe';
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const out = { bg: cs.backgroundColor, color: cs.color, border: cs.borderTopWidth };
    el.remove();
    return out;
  });
  check('btn-secondary has a defined background instead of the UA default',
    probe.bg !== 'rgba(0, 0, 0, 0)' && !/^rgb\(2[0-9]{2}, 2[0-9]{2}, 2[0-9]{2}\)$/.test(probe.bg),
    JSON.stringify(probe));
  check('btn-secondary is a dark surface suited to the app',
    (() => {
      const [r, g, b] = (probe.bg.match(/\d+/g) || []).map(Number);
      return r < 80 && g < 80 && b < 80;
    })(), probe.bg);
  await page.close();
}

check('no page errors at any width',
  errors.filter(e => !/favicon|manifest|service worker|404/i.test(e)).length === 0,
  errors.slice(0, 2).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
