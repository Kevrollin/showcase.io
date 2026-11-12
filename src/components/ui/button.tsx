import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export const buttonVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-[1.125rem] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover',
        secondary: 'border border-border-strong bg-surface text-foreground shadow-xs hover:bg-surface-muted',
        ghost: 'text-foreground hover:bg-surface-sunken',
        subtle: 'bg-surface-sunken text-foreground hover:bg-border',
        danger: 'bg-danger text-white shadow-xs hover:bg-[#962f20]',
        'danger-ghost': 'text-danger hover:bg-danger-soft',
        whatsapp: 'bg-whatsapp text-white shadow-xs hover:bg-whatsapp-hover',
        accent: 'bg-sf-accent text-white shadow-xs hover:opacity-90',
        link: 'h-auto px-0 text-foreground underline decoration-gold underline-offset-4 hover:decoration-2',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-[0.9375rem]',
        lg: 'h-12 px-5 text-base',
        icon: 'size-11',
        'icon-sm': 'size-9',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, disabled, children, type, ...props },
  ref,
) {
  if (asChild) {
    return (
      <Slot ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});
