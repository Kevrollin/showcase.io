import type { ImageDraft } from '@/services/catalogue.service';

/** Releases the object URL used to preview a not-yet-uploaded image. */
export function revokeDraft(draft: ImageDraft): void {
  if (draft.kind === 'new') URL.revokeObjectURL(draft.previewUrl);
}
