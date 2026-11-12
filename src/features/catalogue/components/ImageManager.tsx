import { ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, RefreshCw, Star, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { MediaImage } from '@/components/shared/MediaImage';
import { MEDIA } from '@/config/catalog';
import { cn } from '@/lib/utils/cn';
import { toUserMessage } from '@/lib/utils/errors';
import { formatBytes, imageProblemMessage, processCatalogueImage, validateImageFile } from '@/lib/utils/image';
import type { ImageDraft, NewImageDraft } from '@/services/catalogue.service';
import { revokeDraft } from '../imageDrafts';

export interface ImageManagerProps {
  drafts: ImageDraft[];
  onChange: (next: ImageDraft[]) => void;
  /** Existing images the user removed (deleted on save). */
  onRemoveExisting: (draft: Extract<ImageDraft, { kind: 'existing' }>) => void;
  maxImages: number;
  progress: Record<string, number>;
  failed: Record<string, string>;
  saving: boolean;
  itemTitle: string;
}

let keySeq = 0;
const nextKey = () => `img-${Date.now().toString(36)}-${(keySeq++).toString(36)}`;

async function toDraft(file: File): Promise<NewImageDraft> {
  const { main, thumb } = await processCatalogueImage(file);
  return { kind: 'new', key: nextKey(), main, thumb, previewUrl: URL.createObjectURL(thumb.blob), fileName: file.name };
}

export function ImageManager({ drafts, onChange, onRemoveExisting, maxImages, progress, failed, saving, itemTitle }: ImageManagerProps) {
  const input = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);
  const [processing, setProcessing] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const latest = useRef(drafts);
  useEffect(() => {
    latest.current = drafts;
  }, [drafts]);

  // Release preview object URLs when the editor closes.
  useEffect(() => () => latest.current.forEach(revokeDraft), []);

  const remaining = maxImages - drafts.length;

  async function addFiles(files: File[]) {
    const replacing = replaceTarget.current;
    replaceTarget.current = null;
    const problems: string[] = [];
    const accepted = files.filter((f) => {
      const problem = validateImageFile(f);
      if (problem) problems.push(imageProblemMessage(problem, f.name));
      return !problem;
    });
    const limit = replacing ? 1 : Math.max(0, remaining);
    if (!replacing && accepted.length > limit) {
      problems.push(`You can add ${limit} more image${limit === 1 ? '' : 's'} to this item (maximum ${maxImages}).`);
    }
    const toProcess = accepted.slice(0, limit);
    setErrors(problems);
    if (toProcess.length === 0) return;

    setProcessing({ done: 0, total: toProcess.length });
    const created: NewImageDraft[] = [];
    for (const file of toProcess) {
      try {
        created.push(await toDraft(file));
      } catch (error) {
        problems.push(`${file.name}: ${toUserMessage(error, 'could not be processed.')}`);
      }
      setProcessing((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setProcessing(null);
    setErrors([...problems]);

    const current = latest.current;
    if (replacing) {
      const index = current.findIndex((d) => d.key === replacing);
      const old = current[index];
      if (index >= 0 && old && created[0]) {
        if (old.kind === 'existing') onRemoveExisting(old);
        else revokeDraft(old);
        onChange(current.map((d, i) => (i === index ? created[0]! : d)));
      }
    } else {
      onChange([...current, ...created]);
    }
  }

  function move(index: number, to: number) {
    if (to < 0 || to >= drafts.length) return;
    const next = [...drafts];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved!);
    onChange(next);
  }

  function remove(draft: ImageDraft) {
    if (draft.kind === 'existing') onRemoveExisting(draft);
    else revokeDraft(draft);
    onChange(drafts.filter((d) => d.key !== draft.key));
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (saving) return;
    void addFiles(Array.from(event.dataTransfer.files));
  }

  const busy = saving || processing !== null;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">Photos</p>
        <p className="text-xs text-muted-foreground">
          {drafts.length}/{maxImages} · first photo is the cover
        </p>
      </div>

      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {drafts.map((draft, index) => {
          const pct = progress[draft.key];
          const error = failed[draft.key];
          const uploading = saving && draft.kind === 'new' && pct !== undefined && pct < 1 && !error;
          return (
            <li key={draft.key} className="group relative">
              <div className={cn('overflow-hidden rounded-md border', index === 0 ? 'border-gold' : 'border-border', error && 'border-danger')}>
                {draft.kind === 'new' ? (
                  <MediaImage src={draft.previewUrl} alt={`New photo ${index + 1}`} aspect="1 / 1" />
                ) : (
                  <MediaImage path={draft.image.thumb_path ?? draft.image.storage_path} alt={draft.image.alt_text ?? itemTitle} aspect="1 / 1" />
                )}
              </div>
              {index === 0 && (
                <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-surface/95 px-1.5 py-0.5 text-[0.6875rem] font-semibold shadow-xs">
                  <Star className="size-3 fill-gold text-gold" aria-hidden="true" /> Cover
                </span>
              )}
              {draft.kind === 'new' && !uploading && !error && (
                <span className="absolute bottom-1.5 left-1.5 rounded bg-[#172033]/70 px-1.5 py-0.5 text-[0.6875rem] text-white">
                  {formatBytes(draft.main.blob.size)}
                </span>
              )}
              {uploading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-md bg-surface/75 px-3">
                  <LoaderCircle className="size-5 animate-spin text-foreground" aria-hidden="true" />
                  <div className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round((pct ?? 0) * 100)}%` }} />
                  </div>
                  <span className="sr-only">Uploading photo {index + 1}</span>
                </div>
              )}
              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-md bg-danger-soft/90 p-2 text-center" role="alert">
                  <TriangleAlert className="size-4 text-danger" aria-hidden="true" />
                  <span className="text-[0.6875rem] leading-tight text-danger">Upload failed</span>
                </div>
              )}
              {!saving && (
                <div className="mt-1.5 flex items-center justify-between gap-1">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, index - 1)}
                      disabled={index === 0}
                      aria-label={`Move photo ${index + 1} earlier`}
                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-sunken disabled:opacity-30"
                    >
                      <ArrowLeft className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, index + 1)}
                      disabled={index === drafts.length - 1}
                      aria-label={`Move photo ${index + 1} later`}
                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-sunken disabled:opacity-30"
                    >
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    {index !== 0 && (
                      <button
                        type="button"
                        onClick={() => move(index, 0)}
                        aria-label={`Make photo ${index + 1} the cover`}
                        title="Make cover"
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-sunken"
                      >
                        <Star className="size-4" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        replaceTarget.current = draft.key;
                        input.current?.click();
                      }}
                      aria-label={`Replace photo ${index + 1}`}
                      title="Replace"
                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-sunken"
                    >
                      <RefreshCw className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(draft)}
                      aria-label={`Remove photo ${index + 1}`}
                      title="Remove"
                      className="flex size-8 items-center justify-center rounded-md text-danger hover:bg-danger-soft"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}

        {remaining > 0 && (
          <li>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                replaceTarget.current = null;
                input.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed bg-surface-muted px-2 text-center text-muted-foreground transition-colors hover:border-gold-strong hover:text-foreground disabled:opacity-60',
                dragging ? 'border-gold-strong bg-gold-soft' : 'border-border-strong',
              )}
            >
              {processing ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-5" aria-hidden="true" />}
              <span className="text-xs font-medium">
                {processing ? `Optimising ${Math.min(processing.done + 1, processing.total)} of ${processing.total}` : drafts.length === 0 ? 'Add photos' : 'Add more'}
              </span>
            </button>
          </li>
        )}
      </ul>

      {Object.keys(failed).length > 0 && !saving && (
        <p role="alert" className="text-sm text-danger">
          Some photos didn&apos;t upload. Check your connection and press save again to retry them.
        </p>
      )}
      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-danger">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {drafts.length === 0 && (
        <p className="text-[0.8125rem] text-muted-foreground">
          Photos are resized and compressed on your phone before uploading, so they load fast and save data.
        </p>
      )}

      <input
        ref={input}
        type="file"
        accept={MEDIA.acceptedTypes.join(',')}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length > 0) void addFiles(files);
        }}
      />
      {remaining <= 0 && <p className="text-[0.8125rem] text-muted-foreground">You&apos;ve reached the maximum of {maxImages} photos for one item.</p>}
    </div>
  );
}
