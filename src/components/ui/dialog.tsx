import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from './button';

const overlay = 'fixed inset-0 z-50 bg-[#172033]/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in';
const panel =
  'fixed z-50 w-full bg-surface shadow-lg focus:outline-none data-[state=open]:animate-slide-up ' +
  // Bottom sheet on phones, centred dialog from sm upwards.
  'inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-xl safe-bottom ' +
  'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Dialog({ open, onOpenChange, title, description, children, footer, className }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlay} />
        <DialogPrimitive.Content className={cn(panel, className)}>
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0 space-y-1">
              <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close" className="-mr-2 -mt-1">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="px-5 py-5">{children}</div>
          {footer && <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  /** May return a promise; the dialog stays open with a spinner until it settles. */
  onConfirm: () => unknown;
  children?: ReactNode;
  confirmDisabled?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  children,
  confirmDisabled,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm(event: React.MouseEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The caller reports the error (toast); keep the dialog open to retry.
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className={overlay} />
        <AlertDialogPrimitive.Content className={cn(panel, 'sm:max-w-md')}>
          <div className="space-y-2 px-5 pb-2 pt-5">
            <AlertDialogPrimitive.Title className="text-lg font-semibold">{title}</AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </AlertDialogPrimitive.Description>
          </div>
          {children && <div className="px-5 pt-2">{children}</div>}
          <div className="flex flex-col-reverse gap-2 px-5 pb-5 pt-4 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary" disabled={busy}>
                {cancelLabel}
              </Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy} disabled={confirmDisabled} onClick={handleConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

/** Full-height side sheet used for the mobile navigation menu. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  side = 'right',
  full = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  side?: 'left' | 'right';
  /** Cover the whole screen (mobile menus). */
  full?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlay} />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 flex flex-col bg-surface shadow-lg focus:outline-none data-[state=open]:animate-fade-in',
            full ? 'inset-0 h-dvh w-full' : cn('inset-y-0 w-[86vw] max-w-sm', side === 'right' ? 'right-0' : 'left-0'),
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close menu">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className={cn('flex-1 overflow-y-auto', full && 'safe-bottom')}>{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
