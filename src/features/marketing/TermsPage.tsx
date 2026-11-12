import { BRAND } from '@/config/brand';
import { absoluteUrl } from '@/config/site';
import { usePageMeta } from '@/hooks/usePageMeta';
import { LegalLayout } from './LegalLayout';

export function Component() {
  usePageMeta({ title: 'Terms of Service', canonical: absoluteUrl('/terms') });
  return (
    <LegalLayout title="Terms of Service" updated="11 November 2026">
      <p>
        These terms apply when you use {BRAND.name} to create and share a digital storefront. By creating an account you agree to them.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must provide accurate information and keep your password secure.</li>
        <li>You are responsible for activity on your account and for the content you publish.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You keep ownership of everything you upload. You give {BRAND.name} permission to store, resize and display that content in order to run
        your storefront, sharing links and QR codes.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to use {BRAND.name} to:</p>
      <ul>
        <li>offer illegal, counterfeit, stolen or dangerous goods or services;</li>
        <li>impersonate another person or business, or use content you do not have the right to use;</li>
        <li>publish misleading, hateful, harassing or sexually explicit content;</li>
        <li>attempt to access other users&apos; data or interfere with the service.</li>
      </ul>
      <p>We may remove content or suspend accounts that break these rules.</p>

      <h2>Sales and enquiries</h2>
      <p>
        {BRAND.name} is a presentation tool. Enquiries, orders, payments and deliveries happen directly between you and your customers (for
        example on WhatsApp). {BRAND.name} is not a party to those transactions and is not responsible for them.
      </p>

      <h2>Availability</h2>
      <p>
        We work to keep the service reliable but provide it &ldquo;as is&rdquo;, without guarantees of uninterrupted availability. Keep your own
        copies of important photos.
      </p>

      <h2>Ending your account</h2>
      <p>You can delete your account at any time from Settings. We may end access for accounts that violate these terms.</p>

      <h2>Changes</h2>
      <p>We may update these terms. Continued use after changes means you accept the updated terms.</p>
      <p className="text-sm text-muted-foreground">
        These terms are a starting point written for the pilot release and should be reviewed by a qualified legal professional before commercial
        launch.
      </p>
    </LegalLayout>
  );
}
