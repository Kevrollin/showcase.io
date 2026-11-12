import { Toaster as SonnerToaster } from 'sonner';

export { toast } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      closeButton
      duration={3500}
      toastOptions={{
        classNames: {
          toast: 'font-sans !rounded-lg !border !border-border !bg-surface !text-foreground !shadow-md',
          description: '!text-muted-foreground',
          success: '[&_[data-icon]]:!text-success',
          error: '[&_[data-icon]]:!text-danger',
        },
      }}
    />
  );
}
