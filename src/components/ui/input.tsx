import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const fieldBase =
  'w-full rounded-md border border-border-strong bg-surface text-[0.9375rem] text-foreground shadow-xs transition-colors placeholder:text-subtle-foreground hover:border-[#c2b9a8] focus-visible:border-gold-strong focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-gold/40 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:outline-danger/30';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Text or icon shown inside the field before the value (e.g. "KES"). */
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, trailing, ...props },
  ref,
) {
  if (!leading && !trailing) {
    return <input ref={ref} className={cn(fieldBase, 'h-11 px-3.5', className)} {...props} />;
  }
  return (
    <div className="relative">
      {leading && (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm text-muted-foreground">
          {leading}
        </span>
      )}
      <input
        ref={ref}
        className={cn(fieldBase, 'h-11 px-3.5', leading ? 'pl-14' : '', trailing ? 'pr-11' : '', className)}
        {...props}
      />
      {trailing && <span className="absolute inset-y-0 right-0 flex items-center pr-3">{trailing}</span>}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(fieldBase, 'min-h-24 resize-y px-3.5 py-3 leading-relaxed', className)} {...props} />;
});

/** Native select: best experience on Android/iOS pickers and zero extra JS. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(fieldBase, 'h-11 appearance-none pl-3.5 pr-10', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  );
});
