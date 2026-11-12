import { Compass, RefreshCw, TriangleAlert } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { LogoMark } from './Logo';

function ScreenShell({ icon, title, description, actions }: { icon: ReactNode; title: string; description: string; actions: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <LogoMark className="mb-10 size-9" />
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-gold-soft text-gold-strong">{icon}</div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">{description}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>
    </main>
  );
}

export function NotFoundScreen({
  title = 'Page not found',
  description = "The page you're looking for doesn't exist or may have moved.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <ScreenShell
      icon={<Compass className="size-6" aria-hidden="true" />}
      title={title}
      description={description}
      actions={
        <Button asChild>
          <Link to="/">Go to the homepage</Link>
        </Button>
      }
    />
  );
}

export function CrashScreen({ onRetry }: { onRetry?: () => void }) {
  return (
    <ScreenShell
      icon={<TriangleAlert className="size-6" aria-hidden="true" />}
      title="Something went wrong"
      description="An unexpected error occurred. Reloading the page usually fixes it. Your saved work is safe."
      actions={
        <>
          <Button onClick={onRetry ?? (() => window.location.reload())}>
            <RefreshCw /> Reload page
          </Button>
          <Button variant="secondary" asChild>
            <a href="/">Go to the homepage</a>
          </Button>
        </>
      }
    />
  );
}

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically/i.test(message);
}

/** errorElement for routes: handles 404s, stale deploys and crashes. */
export function RouteErrorScreen() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundScreen />;
  if (isChunkLoadError(error)) {
    return (
      <ScreenShell
        icon={<RefreshCw className="size-6" aria-hidden="true" />}
        title="A new version is available"
        description="We've updated the app since this page was opened. Reload to continue."
        actions={<Button onClick={() => window.location.reload()}>Reload</Button>}
      />
    );
  }
  if (import.meta.env.DEV) console.error(error);
  return <CrashScreen />;
}

/** Last-resort boundary around the whole app (outside the router). */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error(error, info.componentStack);
  }

  render() {
    if (this.state.error) return <CrashScreen />;
    return this.props.children;
  }
}
