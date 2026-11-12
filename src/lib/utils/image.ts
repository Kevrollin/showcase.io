import { MEDIA } from '@/config/catalog';
import { AppError } from './errors';

/**
 * Browser-side image pipeline (no paid Supabase transformations needed):
 *   validate → decode (EXIF orientation applied) → resize → re-encode (WebP,
 *   JPEG fallback) → step quality down until the size target is met.
 * Re-encoding through a canvas also strips EXIF/GPS metadata.
 */

export type OutputType = 'image/webp' | 'image/jpeg';

export interface EncodedImage {
  blob: Blob;
  width: number;
  height: number;
  type: OutputType;
  extension: 'webp' | 'jpg';
}

export interface Size {
  width: number;
  height: number;
}

/** Scales (w, h) to fit inside a square of `max`, never upscaling. */
export function fitWithin(width: number, height: number, max: number): Size {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Source rectangle for a centred "object-fit: cover" crop to the target aspect. */
export function coverCrop(width: number, height: number, target: Size): { sx: number; sy: number; sw: number; sh: number } {
  const targetRatio = target.width / target.height;
  const sourceRatio = width / height;
  if (sourceRatio > targetRatio) {
    const sw = Math.round(height * targetRatio);
    return { sx: Math.round((width - sw) / 2), sy: 0, sw, sh: height };
  }
  const sh = Math.round(width / targetRatio);
  return { sx: 0, sy: Math.round((height - sh) / 2), sw: width, sh };
}

export type ImageFileProblem = 'type' | 'size' | 'empty';

export function validateImageFile(file: File): ImageFileProblem | null {
  if (file.size === 0) return 'empty';
  if (!(MEDIA.acceptedTypes as readonly string[]).includes(file.type)) return 'type';
  if (file.size > MEDIA.maxInputBytes) return 'size';
  return null;
}

export function imageProblemMessage(problem: ImageFileProblem, fileName?: string): string {
  const name = fileName ? `“${fileName}”` : 'This file';
  switch (problem) {
    case 'type':
      return `${name} is not supported. Please choose a JPEG, PNG or WebP image.`;
    case 'size':
      return `${name} is larger than ${Math.round(MEDIA.maxInputBytes / 1024 / 1024)} MB. Please choose a smaller image.`;
    case 'empty':
      return `${name} appears to be empty.`;
  }
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Fall through to <img> decoding (older Safari, unusual encodings).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw new AppError('This image could not be read. Please try a different photo.', 'image_decode', { cause: error });
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

interface EncodeOptions {
  /** Long edge limit (ignored when `crop` is given). */
  maxDimension?: number;
  /** Exact output size with a centred cover crop. */
  crop?: Size;
  /** Force JPEG (e.g. social preview images for maximum crawler support). */
  forceJpeg?: boolean;
  targetBytes?: number;
  maxBytes?: number;
}

const QUALITY_STEPS = [0.82, 0.76, 0.7, 0.62, 0.54];

function render(decoded: Decoded, output: Size, crop: ReturnType<typeof coverCrop> | null, opaque: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = output.width;
  canvas.height = output.height;
  const ctx = canvas.getContext('2d', { alpha: !opaque });
  if (!ctx) throw new AppError('Your browser could not process this image.', 'canvas_unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (opaque) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, output.width, output.height);
  }
  if (crop) {
    ctx.drawImage(decoded.source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, output.width, output.height);
  } else {
    ctx.drawImage(decoded.source, 0, 0, output.width, output.height);
  }
  return canvas;
}

async function encodeDecoded(decoded: Decoded, options: EncodeOptions): Promise<EncodedImage> {
  const targetBytes = options.targetBytes ?? MEDIA.targetBytes;
  const maxBytes = options.maxBytes ?? MEDIA.maxOutputBytes;
  let scale = 1;

  for (let attempt = 0; attempt < 4; attempt++) {
    const crop = options.crop ? coverCrop(decoded.width, decoded.height, options.crop) : null;
    const base = options.crop ?? fitWithin(decoded.width, decoded.height, options.maxDimension ?? MEDIA.maxDimension);
    const output = { width: Math.max(1, Math.round(base.width * scale)), height: Math.max(1, Math.round(base.height * scale)) };

    let type: OutputType = options.forceJpeg ? 'image/jpeg' : 'image/webp';
    let canvas = render(decoded, output, crop, type === 'image/jpeg');
    let best: Blob | null = null;

    for (const quality of QUALITY_STEPS) {
      let blob = await canvasToBlob(canvas, type, quality);
      if (blob && blob.type !== type) {
        // Browser cannot encode WebP (it silently returns PNG) → use JPEG.
        type = 'image/jpeg';
        canvas = render(decoded, output, crop, true);
        blob = await canvasToBlob(canvas, type, quality);
      }
      if (!blob) break;
      best = blob;
      if (blob.size <= targetBytes) break;
    }

    if (best && best.size <= maxBytes) {
      return { blob: best, width: output.width, height: output.height, type, extension: type === 'image/webp' ? 'webp' : 'jpg' };
    }
    scale *= 0.8;
  }
  throw new AppError('This image is too detailed to compress. Please choose a different photo.', 'image_too_large');
}

export async function encodeImage(file: Blob, options: EncodeOptions): Promise<EncodedImage> {
  const decoded = await decode(file);
  try {
    return await encodeDecoded(decoded, options);
  } finally {
    decoded.release();
  }
}

/** Main image (≈1600px) + card thumbnail (≈640px) from a single decode. */
export async function processCatalogueImage(file: File): Promise<{ main: EncodedImage; thumb: EncodedImage }> {
  const decoded = await decode(file);
  try {
    const main = await encodeDecoded(decoded, { maxDimension: MEDIA.maxDimension });
    const thumb = await encodeDecoded(decoded, { maxDimension: MEDIA.thumbDimension, targetBytes: 120 * 1024 });
    return { main, thumb };
  } finally {
    decoded.release();
  }
}

export async function processLogo(file: File): Promise<EncodedImage> {
  return encodeImage(file, { maxDimension: MEDIA.logoDimension, targetBytes: 150 * 1024 });
}

/** Cover photo + a 1200×630 JPEG used as the storefront's social preview image. */
export async function processCover(file: File): Promise<{ cover: EncodedImage; share: EncodedImage }> {
  const decoded = await decode(file);
  try {
    // Higher budget than catalogue photos: the cover is the full-width hero background.
    const cover = await encodeDecoded(decoded, { maxDimension: MEDIA.coverDimension, targetBytes: 900 * 1024 });
    const share = await encodeDecoded(decoded, { crop: MEDIA.shareImage, forceJpeg: true, targetBytes: 250 * 1024, maxBytes: 600 * 1024 });
    return { cover, share };
  } finally {
    decoded.release();
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
