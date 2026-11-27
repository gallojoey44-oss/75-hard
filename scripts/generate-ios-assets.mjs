#!/usr/bin/env node
/**
 * Draws the iPhone app icon and launch image from Forge's existing artwork
 * (public/icon.svg: the purple gradient with the white "75").
 *
 *   node scripts/generate-ios-assets.mjs
 *
 * Writes into ios/App/App/Assets.xcassets:
 *   AppIcon.appiconset/AppIcon-512@2x.png   1024×1024, square and opaque. iOS
 *                                           rounds the corners itself, and the
 *                                           App Store refuses an icon with
 *                                           transparency.
 *   Splash.imageset/splash-2732x2732*.png   the launch screen: Forge's dark
 *                                           background with the icon centred,
 *                                           instead of Capacitor's white one.
 *
 * The images are committed, so this only needs running again if the artwork
 * changes. It renders with Playwright's Chromium, which is not a dependency of
 * the app: set PLAYWRIGHT_MODULE to its index.mjs if `playwright` cannot be
 * imported from here.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'ios', 'App', 'App', 'Assets.xcassets');

const BG = '#0D0D14';        // --bg in src/index.css and the manifest's background
const SPLASH = 2732;         // the size Capacitor's launch storyboard expects
const SPLASH_TILE = 384;     // the icon on the launch screen, about a third of a phone's width

// public/icon.svg, drawn full-bleed (no dark border: iOS applies its own mask).
// `rounded` gives the launch-screen copy corners like an icon on the Home Screen.
function iconSvg(rounded) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="100%" height="100%">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#4F46E5"/>
    </linearGradient>
  </defs>
  <rect width="192" height="192" rx="${rounded ? 43 : 0}" fill="url(#g)"/>
  <text x="96" y="108" font-family="-apple-system, 'SF Pro Display', 'Inter Display', Inter, 'Helvetica Neue', Arial, sans-serif"
    font-size="72" font-weight="800" fill="white" text-anchor="middle" dominant-baseline="middle">75</text>
</svg>`;
}

async function loadChromium() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'].filter(Boolean);
  for (const spec of candidates) {
    try { return (await import(spec)).chromium; } catch { /* try the next */ }
  }
  throw new Error('Playwright not found. Install it (npm i -g playwright) or set PLAYWRIGHT_MODULE.');
}

const chromium = await loadChromium();
const browser = await chromium.launch();
try {
  async function render(size, html, outFiles) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:${BG};width:${size}px;height:${size}px;overflow:hidden">${html}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    for (const file of outFiles) {
      mkdirSync(dirname(file), { recursive: true });
      // Chromium writes an opaque page as RGB with no alpha channel.
      await page.screenshot({ path: file, type: 'png' });
      console.log(`✓ ${file.slice(root.length + 1)} (${size}×${size})`);
    }
    await page.close();
  }

  await render(1024, `<div style="width:1024px;height:1024px">${iconSvg(false)}</div>`, [
    join(assets, 'AppIcon.appiconset', 'AppIcon-512@2x.png'),
  ]);

  const offset = (SPLASH - SPLASH_TILE) / 2;
  await render(SPLASH, `<div style="position:absolute;left:${offset}px;top:${offset}px;width:${SPLASH_TILE}px;height:${SPLASH_TILE}px">${iconSvg(true)}</div>`, [
    join(assets, 'Splash.imageset', 'splash-2732x2732.png'),
    join(assets, 'Splash.imageset', 'splash-2732x2732-1.png'),
    join(assets, 'Splash.imageset', 'splash-2732x2732-2.png'),
  ]);
} finally {
  await browser.close();
}
