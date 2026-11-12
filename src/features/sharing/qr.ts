import { BRAND } from '@/config/brand';
import { displayUrl } from '@/config/site';

/**
 * QR generation is lazy-loaded so the library only downloads on the Share page.
 * Settings favour scan reliability: error correction "M", a 4-module quiet
 * zone, near-black on pure white.
 */
const DARK = '#111827';
const LIGHT = '#FFFFFF';

async function lib() {
  return (await import('qrcode')).default;
}

export async function qrSvg(url: string): Promise<string> {
  const QRCode = await lib();
  return QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: DARK, light: LIGHT } });
}

export async function qrCanvas(url: string, size: number): Promise<HTMLCanvasElement> {
  const QRCode = await lib();
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, url, { errorCorrectionLevel: 'M', margin: 4, width: size, color: { dark: DARK, light: LIGHT } });
  return canvas;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'));
}

export async function qrPng(url: string, size = 1200): Promise<Blob> {
  return canvasBlob(await qrCanvas(url, size));
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, weight: number, family: string): number {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > 24);
  return size;
}

/** Printable counter card (1200×1650 px PNG ≈ A6 at 300 dpi proportions). */
export async function qrCardPng(opts: { businessName: string; url: string; accent: string }): Promise<Blob> {
  await document.fonts?.ready;
  const W = 1200;
  const H = 1650;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const display = "'Manrope Variable', 'DM Sans Variable', system-ui, sans-serif";
  const body = "'DM Sans Variable', system-ui, sans-serif";

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = opts.accent;
  ctx.fillRect(0, 0, W, 24);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#172033';
  const nameSize = fitText(ctx, opts.businessName, W - 160, 88, 800, display);
  ctx.font = `800 ${nameSize}px ${display}`;
  ctx.fillText(opts.businessName, W / 2, 190);

  ctx.fillStyle = '#5B6375';
  ctx.font = `500 46px ${body}`;
  ctx.fillText('Scan to explore our catalogue', W / 2, 280);

  const qr = await qrCanvas(opts.url, 860);
  const qrX = (W - 860) / 2;
  const qrY = 350;
  ctx.strokeStyle = '#E6E1D7';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(qrX - 20, qrY - 20, 900, 900, 36);
  ctx.stroke();
  ctx.drawImage(qr, qrX, qrY, 860, 860);

  ctx.fillStyle = '#172033';
  const link = displayUrl(opts.url);
  const linkSize = fitText(ctx, link, W - 160, 44, 600, body);
  ctx.font = `600 ${linkSize}px ${body}`;
  ctx.fillText(link, W / 2, 1330);

  ctx.fillStyle = '#157A44';
  ctx.font = `600 40px ${body}`;
  ctx.fillText('Chat with us on WhatsApp from the catalogue', W / 2, 1410);

  ctx.fillStyle = '#868C99';
  ctx.font = `500 32px ${body}`;
  ctx.fillText(BRAND.poweredBy, W / 2, H - 80);

  return canvasBlob(canvas);
}
