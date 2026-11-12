import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface FieldProps {
  label: ReactNode;
  /** The control. Receives id, aria-invalid and aria-describedby automatically. */
  children: ReactElement<Record<string, unknown>>;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean;
}

export function Field({ label, children, hint, error, optional, className, hideLabel }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const controlId = (isValidElement(children) && typeof children.props.id === 'string' ? children.props.id : undefined) ?? id;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={controlId} className={cn('flex items-baseline gap-2 text-sm font-medium text-foreground', hideLabel && 'sr-only')}>
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">Optional</span>}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-[0.8125rem] leading-snug text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[0.8125rem] leading-snug text-danger">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-md border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm text-danger">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
