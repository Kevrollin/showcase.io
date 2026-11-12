import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/primitives';
import { cn } from '@/lib/utils/cn';
import { STEP_TITLES, TOTAL_STEPS } from './wizard';

export function WizardLayout({ step, headerAction, children, wide }: { step: number; headerAction?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="container-page flex h-14 items-center justify-between gap-3">
          <Logo label={false} to="/" />
          <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
            Step {step} of {TOTAL_STEPS}
            <span className="hidden sm:inline"> · {STEP_TITLES[step - 1]}</span>
          </p>
          <div className="flex min-w-8 justify-end">{headerAction}</div>
        </div>
        <Progress value={(step / TOTAL_STEPS) * 100} label="Setup progress" className="h-1 rounded-none" />
      </header>
      <main className={cn('mx-auto w-full flex-1 px-4 pb-10 pt-8 sm:px-6 sm:pt-12', wide ? 'max-w-5xl' : 'max-w-xl')}>
        <div key={step} className="animate-slide-up">
          {children}
        </div>
      </main>
    </div>
  );
}

export function StepHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gold-strong">{eyebrow}</p>}
      <h1 className="text-[1.75rem] font-bold leading-tight sm:text-[2rem]">{title}</h1>
      {description && <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}

/** Back / Continue bar; sticks to the bottom of the screen on phones. */
export function StepFooter({
  onBack,
  continueLabel = 'Continue',
  continueDisabled,
  loading,
  onContinue,
  extra,
  form,
}: {
  onBack?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  loading?: boolean;
  /** Omit to make the button submit its enclosing form. */
  onContinue?: () => void;
  extra?: ReactNode;
  form?: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-10 flex items-center gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur safe-bottom sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
      {onBack && (
        <Button type="button" variant="ghost" onClick={onBack} disabled={loading}>
          <ArrowLeft /> Back
        </Button>
      )}
      <div className="ml-auto flex items-center gap-2">
        {extra}
        <Button
          type={onContinue ? 'button' : 'submit'}
          form={form}
          size="lg"
          onClick={onContinue}
          disabled={continueDisabled}
          loading={loading}
          className="min-w-32"
        >
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
