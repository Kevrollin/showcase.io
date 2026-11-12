import { BRAND } from '@/config/brand';
import { absoluteUrl } from '@/config/site';
import { usePageMeta } from '@/hooks/usePageMeta';
import { LegalLayout } from './LegalLayout';

export function Component() {
  usePageMeta({ title: 'Privacy Policy', canonical: absoluteUrl('/privacy') });
  return (
    <LegalLayout title="Privacy Policy" updated="11 November 2026">
      <p>
        This policy explains what information {BRAND.name} collects, why, and the choices you have. We collect only what is needed to
        run your storefront.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information:</strong> your name, email address and an encrypted password. Your account email is never shown on your
          storefront.
        </li>
        <li>
          <strong>Storefront content:</strong> the business details, contact details, photos, products, services and portfolio items you add.
        </li>
        <li>
          <strong>Technical data:</strong> your browser stores a session so you stay signed in, and short-lived drafts of forms you have not yet
          saved. This data stays on your device.
        </li>
      </ul>
      <p>We do not track visitors across websites, build advertising profiles or store visitors&apos; device fingerprints.</p>

      <h2>What is public</h2>
      <p>
        When you publish your storefront, the business information, contact options and items you mark as visible can be seen by anyone with the
        link. Drafts, hidden items and unpublished storefronts are private to you.
      </p>

      <h2>How we use information</h2>
      <ul>
        <li>To create and display your storefront and its sharing links and QR codes.</li>
        <li>To let you sign in, recover your password and secure your account.</li>
        <li>To send service emails such as account confirmation and password resets.</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>Service providers</h2>
      <p>
        {BRAND.name} uses Supabase for authentication, database and file storage, and a hosting provider to serve the website. They process data
        on our behalf under their own security and privacy commitments.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Edit or delete any item, photo or detail at any time from your dashboard.</li>
        <li>Unpublish your storefront to hide it instantly.</li>
        <li>Delete your business, or your whole account, from Settings. Deletion removes your data and uploaded photos.</li>
      </ul>

      <h2>Changes</h2>
      <p>We may update this policy as the product changes. We will update the date at the top when we do.</p>
      <p className="text-sm text-muted-foreground">
        This policy is a starting point written for the pilot release. The operator should have it reviewed for their jurisdiction (for example,
        Kenya&apos;s Data Protection Act, 2019) before commercial launch.
      </p>
    </LegalLayout>
  );
}
