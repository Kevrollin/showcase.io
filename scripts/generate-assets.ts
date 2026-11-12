/**
 * Renders the PNG brand assets from HTML with Playwright's Chromium:
 *   public/favicon/favicon-32.png, apple-touch-icon.png, icon-192.png,
 *   icon-512.png and public/og-default.png (1200×630 social preview).
 *
 * Usage:  node scripts/generate-assets.ts   (after `npx playwright install chromium`)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const mark = readFileSync('public/favicon/favicon.svg', 'utf8');
// Inline the fonts: pages created with setContent() cannot load file:// URLs.
const font = (pkg: string, file: string) =>
  `data:font/woff2;base64,${readFileSync(resolve('node_modules', pkg, 'files', file)).toString('base64')}`;

const fonts = `
@font-face { font-family: 'Manrope'; src: url('${font('@fontsource-variable/manrope', 'manrope-latin-wght-normal.woff2')}') format('woff2'); font-weight: 200 800; }
@font-face { font-family: 'DM Sans'; src: url('${font('@fontsource-variable/dm-sans', 'dm-sans-latin-wght-normal.woff2')}') format('woff2'); font-weight: 100 1000; }
`;

function iconHtml(size: number, padded: boolean): string {
  const inset = padded ? Math.round(size * 0.12) : 0;
  return `<html><body style="margin:0;background:${padded ? '#FAF8F4' : 'transparent'}">
    <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">
      <div style="width:${size - inset * 2}px;height:${size - inset * 2}px">${mark.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
    </div></body></html>`;
}

const tile = (bg: string, fg: string) =>
  `<div style="aspect-ratio:1;border-radius:14px;background:${bg};display:flex;align-items:center;justify-content:center"><div style="width:46%;height:46%;border-radius:50%;background:${fg}"></div></div>`;

const ogHtml = `<html><head><style>${fonts}
  body { margin:0; width:1200px; height:630px; background:#FAF8F4; font-family:'DM Sans',sans-serif; color:#172033; overflow:hidden; }
  .wrap { display:flex; height:100%; padding:72px 80px; box-sizing:border-box; gap:56px; align-items:center; }
  h1 { font-family:'Manrope',sans-serif; font-weight:800; font-size:64px; line-height:1.05; letter-spacing:-1.5px; margin:28px 0 0; }
  p { font-size:26px; color:#5B6375; line-height:1.4; margin:24px 0 0; max-width:560px; }
  .brand { display:flex; align-items:center; gap:16px; font-family:'Manrope',sans-serif; font-weight:800; font-size:34px; }
  .phone { width:330px; height:520px; flex-shrink:0; border-radius:44px; background:#1B2741; padding:14px; box-sizing:border-box; box-shadow:0 30px 60px -20px rgba(23,32,51,.35); transform: rotate(3deg); }
  .screen { width:100%; height:100%; border-radius:32px; background:#fff; padding:28px 20px; box-sizing:border-box; }
  .row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:20px; }
  .btn { margin-top:18px; height:42px; border-radius:10px; background:#157A44; color:#fff; font-weight:600; font-size:16px; display:flex; align-items:center; justify-content:center; }
  .gold { height:6px; width:120px; background:#B8924A; border-radius:3px; margin-top:32px; }
</style></head><body><div class="wrap">
  <div style="flex:1">
    <div class="brand"><div style="width:56px;height:56px">${mark.replace('<svg ', '<svg width="100%" height="100%" ')}</div>Showcase</div>
    <h1>Everything you sell or do, in one simple link.</h1>
    <p>Create a digital catalogue for your products, services or previous work — and share it on WhatsApp.</p>
    <div class="gold"></div>
  </div>
  <div class="phone"><div class="screen">
    <div style="display:flex;gap:12px;align-items:center"><div style="width:44px;height:44px;border-radius:12px;background:#A4472A"></div>
      <div><div style="font-family:Manrope,sans-serif;font-weight:800;font-size:18px">Campus Kicks</div><div style="font-size:12px;color:#5B6375">Sneakers · Njoro</div></div></div>
    <div class="btn">Chat on WhatsApp</div>
    <div class="row">${tile('#F4F1EA', '#A4472A')}${tile('#E9F0EC', '#2E5E4E')}${tile('#EEF0F5', '#1F2A44')}${tile('#F6F0E2', '#B8924A')}</div>
  </div></div>
</div></body></html>`;

const browser = await chromium.launch();
try {
  const shots: Array<{ file: string; size: number; html: string; omitBackground?: boolean }> = [
    { file: 'public/favicon/favicon-32.png', size: 32, html: iconHtml(32, false), omitBackground: true },
    { file: 'public/favicon/apple-touch-icon.png', size: 180, html: iconHtml(180, true) },
    { file: 'public/favicon/icon-192.png', size: 192, html: iconHtml(192, true) },
    { file: 'public/favicon/icon-512.png', size: 512, html: iconHtml(512, true) },
  ];
  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: shot.size, height: shot.size } });
    await page.setContent(shot.html);
    await page.screenshot({ path: shot.file, omitBackground: shot.omitBackground ?? false });
    await page.close();
    console.log('wrote', shot.file);
  }
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await og.setContent(ogHtml, { waitUntil: 'load' });
  await og.evaluate(() => document.fonts.ready);
  await og.screenshot({ path: 'public/og-default.png' });
  console.log('wrote public/og-default.png');
} finally {
  await browser.close();
}
