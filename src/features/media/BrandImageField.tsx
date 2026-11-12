import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MediaImage } from '@/components/shared/MediaImage';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toaster';
import { MEDIA } from '@/config/catalog';
import { useSetBusinessInCache } from '@/features/businesses/hooks';
import { cn } from '@/lib/utils/cn';
import { toUserMessage } from '@/lib/utils/errors';
import { imageProblemMessage, processCover, processLogo, validateImageFile } from '@/lib/utils/image';
import { removeBrandImage, uploadCover, uploadLogo } from '@/services/business.service';
import type { Business } from '@/types/models';

interface BrandImageFieldProps {
  business: Business;
  kind: 'logo' | 'cover';
  /** Local preview while an upload is in progress (for live storefront previews). */
  onPreviewChange?: (url: string | null) => void;
}

const COPY = {
  logo: { title: 'Logo', hint: 'Square images work best. JPEG, PNG or WebP.', add: 'Upload logo' },
  cover: { title: 'Cover photo', hint: 'A wide photo of your work, products or shop. Also used when your link is shared.', add: 'Upload cover photo' },
};

export function BrandImageField({ business, kind, onPreviewChange }: BrandImageFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const setInCache = useSetBusinessInCache();
  const [busy, setBusy] = useState<'processing' | 'uploading' | 'removing' | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const path = kind === 'logo' ? business.logo_path : business.cover_path;
  const copy = COPY[kind];

  useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  async function handleFile(file: File) {
    setError(null);
    const problem = validateImageFile(file);
    if (problem) {
      setError(imageProblemMessage(problem, file.name));
      return;
    }
    setLastFile(file);
    setBusy('processing');
    setProgress(0);
    try {
      let updated: Business;
      if (kind === 'logo') {
        const logo = await processLogo(file);
        const url = URL.createObjectURL(logo.blob);
        setLocalPreview(url);
        onPreviewChange?.(url);
        setBusy('uploading');
        updated = await uploadLogo(business, logo, setProgress);
      } else {
        const images = await processCover(file);
        const url = URL.createObjectURL(images.cover.blob);
        setLocalPreview(url);
        onPreviewChange?.(url);
        setBusy('uploading');
        updated = await uploadCover(business, images, setProgress);
      }
      setInCache(updated);
      setLastFile(null);
      toast.success(kind === 'logo' ? 'Logo updated.' : 'Cover photo updated.');
    } catch (e) {
      setError(toUserMessage(e, 'The image could not be uploaded.'));
      onPreviewChange?.(null);
      setLocalPreview(null);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('removing');
    try {
      const updated = await removeBrandImage(business, kind);
      setInCache(updated);
      onPreviewChange?.(null);
      setLocalPreview(null);
      toast.success(kind === 'logo' ? 'Logo removed.' : 'Cover photo removed.');
    } catch (e) {
      toast.error(toUserMessage(e));
      throw e;
    } finally {
      setBusy(null);
    }
  }

  const shown = localPreview ?? null;
  const hasImage = Boolean(path || shown);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {copy.title} <span className="text-xs font-normal text-muted-foreground">Optional</span>
      </p>
      <div className={cn('flex gap-4', kind === 'cover' ? 'flex-col' : 'items-center')}>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy !== null}
          aria-label={hasImage ? `Change ${copy.title.toLowerCase()}` : copy.add}
          className={cn(
            'group relative shrink-0 overflow-hidden border border-dashed border-border-strong bg-surface-muted transition-colors hover:border-gold-strong',
            kind === 'logo' ? 'size-24 rounded-xl' : 'aspect-[21/9] w-full rounded-lg',
            hasImage && 'border-solid',
          )}
        >
          {hasImage ? (
            <MediaImage path={shown ? null : path} src={shown} alt="" className="absolute inset-0 size-full" fallbackIcon={false} />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <ImagePlus className="size-6" aria-hidden="true" />
              {kind === 'cover' && <span className="text-sm">{copy.add}</span>}
            </span>
          )}
          {busy && <span className="absolute inset-0 bg-surface/60" aria-hidden="true" />}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[0.8125rem] text-muted-foreground">{copy.hint}</p>
          {busy === 'processing' && <p className="text-sm text-muted-foreground">Optimising image…</p>}
          {busy === 'uploading' && <Progress value={progress * 100} label={`Uploading ${copy.title.toLowerCase()}`} />}
          {error && (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-danger">
              {error}
              {lastFile && (
                <Button variant="ghost" size="sm" onClick={() => void handleFile(lastFile)}>
                  <RefreshCw /> Retry
                </Button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={busy !== null}>
              <ImagePlus /> {hasImage ? 'Replace' : copy.add}
            </Button>
            {path && (
              <Button variant="danger-ghost" size="sm" onClick={() => setConfirmRemove(true)} disabled={busy !== null}>
                <Trash2 /> Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept={MEDIA.acceptedTypes.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleFile(file);
        }}
      />
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${copy.title.toLowerCase()}?`}
        description={kind === 'logo' ? 'Your storefront will show your initials instead.' : 'Your storefront header will no longer show a cover photo.'}
        confirmLabel="Remove"
        onConfirm={remove}
      />
    </div>
  );
}
