export type ImageFit = 'cover' | 'contain' | 'smart';

function aspectRatio(aspect: string | undefined): number | null {
  const m = /^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/.exec(aspect ?? '');
  return m ? Number(m[1]) / Number(m[2]) : null;
}

/** Crops of up to ~23% look natural; beyond that, show the whole image instead. */
const MAX_COVER_MISMATCH = Math.log(1.3);

/**
 * Picks how an image fills a fixed frame without distortion:
 * `cover` when its shape is close to the frame's, `contain` (whole image over a
 * blurred fill) when cropping would cut off too much.
 */
export function resolveFit(fit: ImageFit, aspect: string | undefined, width?: number | null, height?: number | null): 'cover' | 'contain' {
  if (fit !== 'smart') return fit;
  const frame = aspectRatio(aspect);
  if (!frame || !width || !height) return 'cover';
  return Math.abs(Math.log(width / height / frame)) > MAX_COVER_MISMATCH ? 'contain' : 'cover';
}
