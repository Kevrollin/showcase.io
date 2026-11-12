import type { ReactNode } from 'react';
import { CONTACT_EMAIL } from '@/config/site';
import { MarketingLayout } from './MarketingLayout';

export function LegalLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <MarketingLayout>
      <article className="container-page max-w-3xl py-12 sm:py-16">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
        <div className="mt-8 space-y-6 text-[0.9375rem] leading-relaxed text-foreground/90 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
          {children}
          <h2>Contact</h2>
          <p>
            {CONTACT_EMAIL ? (
              <>
                Questions about this policy? Email us at{' '}
                <a className="underline decoration-gold underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>
                .
              </>
            ) : (
              'Questions about this policy? Contact the operator of this service using the details provided on the homepage.'
            )}
          </p>
        </div>
      </article>
    </MarketingLayout>
  );
}
