/**
 * Active Challenge card — the button group's geometry.
 *
 * Run against a production build:  npx vite preview --port 4173
 * then:                            node tests/acc-buttons-e2e-test.mjs
 *
 * These assertions are MEASURED, not inspected: real bounding boxes from a real
 * layout at real iPhone widths. A spacing bug is a number, so it is tested as
 * one — "looks fine" is how the buttons ended up touching in the first place.
 *
 * Checked at three widths, with a short title and a long one, with and without
 * a support challenge attached, since the Add Support button is replaced by a
 * support card in that state and the row below it must still sit clear.
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
        templateId: 'sleep_reset_challenge', name: 'Sleep Reset', emoji: '😴',
        durationDays: 14, startDate: s,
      };
    }
    localStorage.setItem('profiles', JSON.stringify(p));
  }, { t: title, sup: support });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.bottom-nav .nav-tab, button')]
      .find(x => /Challenges/i.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForTimeout(450);
}

/** Measured geometry of the card and its three buttons. */
function measure(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.active-challenge-card');
    if (!card) return null;
    const box = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        top: r.top, bottom: r.bottom, left: r.left, right: r.right,
        w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100,
        radius: cs.borderTopLeftRadius, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        padT: cs.paddingTop, padB: cs.paddingBottom, padL: cs.paddingLeft,
        bg: cs.backgroundColor, border: cs.borderTopWidth,
        borderColor: cs.borderTopColor, color: cs.color,
      };
    };
    const cardCs = getComputedStyle(card);
    // clientWidth excludes the border, so this is the true content width the
    // buttons lay out inside. Deriving it from getBoundingClientRect would
    // count the card's 1px border twice over.
    const contentWidth = card.clientWidth
      - parseFloat(cardCs.paddingLeft) - parseFloat(cardCs.paddingRight);
    const actions = card.querySelector('.acc-actions');
    const btns = [...(actions?.querySelectorAll('.btn') || [])];
    // Whatever sits directly above the actions row: the Add Support button,
    // the support card, or a notice box.
    const addSupport = card.querySelector('.acc-add-support');
    const supportCard = card.querySelector('.acc-support');
    const above = addSupport || supportCard;
    return {
      card: { ...box(card), padBottom: cardCs.paddingBottom, padTop: cardCs.paddingTop },
      contentWidth: Math.round(contentWidth * 100) / 100,
      cardRight: card.getBoundingClientRect().right,
      cardLeft: card.getBoundingClientRect().left,
      addSupport: box(addSupport),
      supportCard: box(supportCard),
      above: box(above),
      actions: box(actions),
      logToday: box(btns[0]),
      dashboard: box(btns[1]),
      btnCount: btns.length,
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

  // ── No support challenge: all three buttons present ──────────────────────
  await setup(page, { title: 'LOCK IN', support: false });
  let m = await measure(page);
  check(`${name}: the Active Challenge card renders`, !!m);
  check(`${name}: all three buttons are present`,
    !!m.addSupport && m.btnCount === 2, `addSupport=${!!m.addSupport} row=${m.btnCount}`);

  // 1. 16px between Add Support and the Log Today / Dashboard row.
  const gap = Math.round((m.actions.top - m.addSupport.bottom) * 10) / 10;
  check(`${name}: 1 — exactly 16px between Add Support and the action row`,
    gap === 16, `${gap}px`);

  // 2. Add Support full width, 52–56px tall.
  const innerWidth = m.contentWidth;
  check(`${name}: 2 — Add Support is full width inside the card`,
    Math.abs(m.addSupport.w - innerWidth) <= 1, `${m.addSupport.w} vs ${Math.round(innerWidth)}`);
  check(`${name}: 2 — Add Support is 52–56px tall`,
    m.addSupport.h >= 52 && m.addSupport.h <= 56, `${m.addSupport.h}px`);

  // 3. Log Today and Dashboard side by side, 12px apart, equal widths.
  check(`${name}: 3 — Log Today and Dashboard are side by side`,
    Math.abs(m.logToday.top - m.dashboard.top) < 1 &&
    m.logToday.right <= m.dashboard.left + 0.5,
    `tops ${Math.round(m.logToday.top)}/${Math.round(m.dashboard.top)}`);
  const hGap = Math.round((m.dashboard.left - m.logToday.right) * 10) / 10;
  check(`${name}: 3 — a 12px horizontal gap`, hGap === 12, `${hGap}px`);
  check(`${name}: 3 — equal widths`,
    Math.abs(m.logToday.w - m.dashboard.w) <= 0.5, `${m.logToday.w} vs ${m.dashboard.w}`);
  check(`${name}: 3 — the row fills the card width`,
    Math.abs((m.logToday.w + m.dashboard.w + 12) - innerWidth) <= 1.5,
    `${m.logToday.w + m.dashboard.w + 12} vs ${Math.round(innerWidth)}`);

  // 4. Consistent radius, typography and internal padding across all three.
  const three = [m.addSupport, m.logToday, m.dashboard];
  check(`${name}: 4 — identical border radius on all three`,
    new Set(three.map(b => b.radius)).size === 1, three.map(b => b.radius).join(' / '));
  check(`${name}: 4 — identical font size and weight on all three`,
    new Set(three.map(b => `${b.fontSize}|${b.fontWeight}`)).size === 1,
    three.map(b => `${b.fontSize}/${b.fontWeight}`).join(' '));
  check(`${name}: 4 — identical internal padding on all three`,
    new Set(three.map(b => `${b.padT}|${b.padB}|${b.padL}`)).size === 1,
    three.map(b => `${b.padT} ${b.padL}`).join(' / '));
  check(`${name}: 4 — identical heights, so the group aligns`,
    new Set(three.map(b => b.h)).size === 1, three.map(b => b.h).join(' / '));

  // 5. Hierarchy: primary filled, secondary outlined, tertiary subtle.
  const alpha = (c) => {
    const n = c.match(/[\d.]+/g) || [];
    return n.length === 4 ? parseFloat(n[3]) : 1;
  };
  check(`${name}: 5 — Log Today is a filled primary (opaque purple)`,
    alpha(m.logToday.bg) === 1 && /rgb/.test(m.logToday.bg), m.logToday.bg);
  check(`${name}: 5 — Dashboard is outlined with no fill`,
    alpha(m.dashboard.bg) === 0 && parseFloat(m.dashboard.border) > 0,
    `${m.dashboard.bg} border ${m.dashboard.border}`);
  // An outline at the app-wide 7% white is invisible against this card's purple
  // tint, which is how the secondary button ended up reading as the faintest of
  // the three. The outline has to actually be visible.
  check(`${name}: 5 — Dashboard's outline is actually visible on the card`,
    alpha(m.dashboard.borderColor) >= 0.15, m.dashboard.borderColor);
  // Perceived brightness of the label, as a stand-in for prominence.
  const lum = (c) => {
    const [r, g, b] = (c.match(/\d+/g) || []).map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  check(`${name}: 5 — the hierarchy holds: Dashboard's label reads above Add Support's`,
    lum(m.dashboard.color) > lum(m.addSupport.color),
    `dash ${m.dashboard.color} / add ${m.addSupport.color}`);
  check(`${name}: 5 — Add Support is a subtle surface, not an opaque slab`,
    alpha(m.addSupport.bg) > 0 && alpha(m.addSupport.bg) < 0.2, m.addSupport.bg);
  check(`${name}: 5 — Add Support is not the bright white it used to be`,
    !/^rgb\(2[0-9]{2}, 2[0-9]{2}, 2[0-9]{2}\)$/.test(m.addSupport.bg) &&
    alpha(m.addSupport.bg) < 1, m.addSupport.bg);
  check(`${name}: 5 — Add Support is quieter than Log Today`,
    alpha(m.addSupport.bg) < alpha(m.logToday.bg));

  // 6. 20–24px of bottom padding inside the card.
  const padB = parseFloat(m.card.padBottom);
  check(`${name}: 6 — the card has 20–24px bottom padding`,
    padB >= 20 && padB <= 24, `${padB}px`);
  const toBorder = Math.round((m.card.bottom - m.actions.bottom) * 10) / 10;
  check(`${name}: 6 — the buttons sit clear of the card border`,
    toBorder >= 20, `${toBorder}px`);

  // Acceptance: nothing touches, nothing overlaps, nothing overflows.
  check(`${name}: nothing touches or overlaps`,
    m.actions.top - m.addSupport.bottom > 0 && m.dashboard.left - m.logToday.right > 0);
  check(`${name}: the buttons stay inside the card horizontally`,
    m.addSupport.left >= m.cardLeft - 0.5 && m.addSupport.right <= m.cardRight + 0.5 &&
    m.logToday.left >= m.cardLeft - 0.5 && m.dashboard.right <= m.cardRight + 0.5);
  check(`${name}: no horizontal page overflow`, m.pageOverflow <= 1, `${m.pageOverflow}px`);

  // ── A long challenge title must not break any of it ──────────────────────
  await setup(page, { title: LONG_TITLE, support: false });
  m = await measure(page);
  const longGap = Math.round((m.actions.top - m.addSupport.bottom) * 10) / 10;
  check(`${name}: 7 — a long title keeps the 16px gap`, longGap === 16, `${longGap}px`);
  check(`${name}: 7 — a long title does not overflow the page`, m.pageOverflow <= 1, `${m.pageOverflow}px`);
  check(`${name}: 7 — a long title does not widen the card past the viewport`,
    m.card.w <= m.viewport, `card ${m.card.w} vs viewport ${m.viewport}`);
  check(`${name}: 7 — the buttons keep their height with a long title`,
    m.addSupport.h >= 52 && m.addSupport.h <= 56, `${m.addSupport.h}px`);
  check(`${name}: 7 — the action row still has equal widths`,
    Math.abs(m.logToday.w - m.dashboard.w) <= 0.5);

  // ── With a support challenge, the row sits below the support CARD ────────
  await setup(page, { title: 'LOCK IN', support: true });
  m = await measure(page);
  if (m.supportCard) {
    const supGap = Math.round((m.actions.top - m.supportCard.bottom) * 10) / 10;
    check(`${name}: 8 — 16px between the support card and the action row`,
      supGap === 16, `${supGap}px`);
    check(`${name}: 8 — Add Support is replaced by the support card`, !m.addSupport);
  } else {
    check(`${name}: 8 — with a support challenge the row is still clear of what is above it`,
      m.actions.top - (m.above?.bottom ?? 0) >= 16,
      'support card not rendered in this state; checked the preceding block instead');
  }
  check(`${name}: 8 — no overflow with a support challenge`, m.pageOverflow <= 1, `${m.pageOverflow}px`);

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
