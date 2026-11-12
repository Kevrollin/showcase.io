import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { EyeOff, Mail, Rocket, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { queryKeys } from '@/app/queryClient';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardBody, CardHeader } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toaster';
import { BUSINESS_TYPE_COPY, BUSINESS_TYPES, type BusinessType } from '@/config/catalog';
import { displayUrl, storefrontUrl } from '@/config/site';
import { useAuth } from '@/features/auth/auth-context';
import { ContactFields, IdentityFields } from '@/features/businesses/components/BusinessFields';
import { contactDefaults, identityDefaults, identityToColumns } from '@/features/businesses/forms';
import { SlugField } from '@/features/businesses/components/SlugField';
import { useSlugCheck } from '@/features/businesses/useSlugCheck';
import { useCurrentBusiness, usePublishBusiness, useUpdateBusiness } from '@/features/businesses/hooks';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { toUserMessage } from '@/lib/utils/errors';
import {
  contactSchema,
  contactToColumns,
  identitySchema,
  resetPasswordSchema,
  type ContactValues,
  type IdentityValues,
  type ResetPasswordValues,
} from '@/lib/validation/schemas';
import { deleteMyAccount } from '@/services/account.service';
import { signedInRecently, signInMethods, signInWithGoogle, updatePassword, verifyPassword } from '@/services/auth.service';
import { listConnectedApps, revokeConnectedApp, type ConnectedApp } from '@/services/oauth.service';
import { GoogleIcon } from '@/components/shared/BrandIcons';
import { useQuery } from '@tanstack/react-query';
import { deleteBusiness } from '@/services/business.service';
import type { Business } from '@/types/models';
import { PageHeader } from '../dashboard/PageHeader';
import { StatusBadge } from '../dashboard/DashboardLayout';

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader title={title} description={description} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function BusinessSection({ business }: { business: Business }) {
  const update = useUpdateBusiness();
  const [type, setType] = useState<BusinessType>(business.business_type);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<IdentityValues>({ resolver: zodResolver(identitySchema), defaultValues: identityDefaults(business) });

  async function save(values: IdentityValues) {
    setError(null);
    try {
      const updated = await update.mutateAsync({ id: business.id, patch: { ...identityToColumns(values), business_type: type } });
      form.reset(identityDefaults(updated));
      toast.success('Business details saved.');
    } catch (e) {
      setError(toUserMessage(e));
    }
  }

  return (
    <Section id="business" title="Business details">
      <form onSubmit={form.handleSubmit(save)} noValidate className="space-y-5">
        <FormError message={error} />
        <Field label="What you showcase" hint="Changes the wording used in your dashboard and storefront.">
          <Select value={type} onChange={(e) => setType(e.target.value as BusinessType)}>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {BUSINESS_TYPE_COPY[t].label}
              </option>
            ))}
          </Select>
        </Field>
        <IdentityFields form={form} businessType={type} />
        <div className="flex justify-end">
          <Button type="submit" loading={form.formState.isSubmitting} disabled={!form.formState.isDirty && type === business.business_type}>
            Save details
          </Button>
        </div>
      </form>
    </Section>
  );
}

function ContactSection({ business }: { business: Business }) {
  const update = useUpdateBusiness();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ContactValues>({ resolver: zodResolver(contactSchema), defaultValues: contactDefaults(business) });

  async function save(values: ContactValues) {
    setError(null);
    try {
      const updated = await update.mutateAsync({ id: business.id, patch: contactToColumns(values) });
      form.reset(contactDefaults(updated));
      toast.success('Contact details saved.');
    } catch (e) {
      setError(toUserMessage(e));
    }
  }

  return (
    <Section id="contact" title="Contact details" description="Only the details you fill in are shown on your storefront.">
      <form onSubmit={form.handleSubmit(save)} noValidate className="space-y-5">
        <FormError message={error} />
        <ContactFields form={form} />
        <div className="flex justify-end">
          <Button type="submit" loading={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
            Save contact details
          </Button>
        </div>
      </form>
    </Section>
  );
}

function LinkSection({ business }: { business: Business }) {
  const update = useUpdateBusiness();
  const [slug, setSlug] = useState(business.slug);
  const [confirm, setConfirm] = useState(false);
  const check = useSlugCheck(slug, business.id, business.slug);
  const canSave = check.status === 'available';

  async function save() {
    try {
      const updated = await update.mutateAsync({ id: business.id, patch: { slug: slug.trim().toLowerCase() } });
      setSlug(updated.slug);
      toast.success(`Your new link is ${displayUrl(storefrontUrl(updated.slug))}`);
    } catch (e) {
      toast.error(toUserMessage(e));
      throw e;
    }
  }

  return (
    <Section id="link" title="Storefront link">
      <div className="space-y-4">
        <SlugField value={slug} onChange={setSlug} status={check.status} message={check.message} />
        {check.status !== 'unchanged' && (
          <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2.5 text-sm text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Links and QR codes you've already shared with the old address will stop working.
          </p>
        )}
        <div className="flex justify-end gap-2">
          {check.status !== 'unchanged' && (
            <Button variant="ghost" onClick={() => setSlug(business.slug)}>
              Cancel
            </Button>
          )}
          <Button onClick={() => setConfirm(true)} disabled={!canSave}>
            Change link
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone="primary"
        title="Change your storefront link?"
        description={`Your storefront will move to ${displayUrl(storefrontUrl(slug.trim().toLowerCase()))}. The old link and any printed QR codes will stop working, so remember to share the new one.`}
        confirmLabel="Change link"
        onConfirm={save}
      />
    </Section>
  );
}

function VisibilitySection({ business }: { business: Business }) {
  const publish = usePublishBusiness();
  const [confirmHide, setConfirmHide] = useState(false);
  const live = business.status === 'published';

  async function setStatus(status: 'published' | 'unpublished') {
    try {
      await publish.mutateAsync({ id: business.id, status });
      toast.success(status === 'published' ? 'Your storefront is now live.' : 'Your storefront is now hidden.');
    } catch (e) {
      toast.error(toUserMessage(e));
      throw e;
    }
  }

  return (
    <Section id="visibility" title="Visibility">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <StatusBadge status={business.status} />
          <p className="text-sm text-muted-foreground">
            {live
              ? 'Anyone with your link can see your storefront.'
              : business.status === 'unpublished'
                ? 'Your storefront is temporarily hidden. Your items and settings are kept.'
                : 'Your storefront is a draft. Publish it when you are ready.'}
          </p>
        </div>
        {live ? (
          <Button variant="secondary" onClick={() => setConfirmHide(true)}>
            <EyeOff /> Unpublish temporarily
          </Button>
        ) : (
          <Button onClick={() => void setStatus('published').catch(() => undefined)} loading={publish.isPending}>
            <Rocket /> {business.status === 'unpublished' ? 'Restore storefront' : 'Publish storefront'}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmHide}
        onOpenChange={setConfirmHide}
        tone="primary"
        title="Unpublish your storefront?"
        description="Customers will see a “not available” page until you publish again. Nothing is deleted."
        confirmLabel="Unpublish"
        onConfirm={() => setStatus('unpublished')}
      />
    </Section>
  );
}

function AccountSection() {
  const { user } = useAuth();
  const methods = signInMethods(user);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', confirm: '' } });

  async function save(values: ResetPasswordValues) {
    setError(null);
    try {
      await updatePassword(values.password);
      form.reset();
      toast.success(methods.google ? 'Your password has been saved.' : 'Your password has been changed.');
    } catch (e) {
      setError(toUserMessage(e));
    }
  }

  return (
    <Section id="account" title="Account">
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium">Email</p>
          <p className="text-[0.9375rem] text-muted-foreground">{user?.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">Your account email is private and never shown on your storefront.</p>
        </div>
        <div>
          <p className="text-sm font-medium">Sign-in methods</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {methods.google && (
              <li className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
                <GoogleIcon className="size-4" /> Google
              </li>
            )}
            {methods.email && (
              <li className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
                <Mail className="size-4 text-muted-foreground" aria-hidden="true" /> Email and password
              </li>
            )}
          </ul>
        </div>
        <form onSubmit={form.handleSubmit(save)} noValidate className="space-y-4 border-t border-border pt-5">
          <div>
            <p className="text-sm font-semibold">{methods.google ? 'Set or change password' : 'Change password'}</p>
            {methods.google && (
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">Optional: add a password so you can also sign in with your email address.</p>
            )}
          </div>
          <FormError message={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" error={form.formState.errors.password?.message}>
              <PasswordInput autoComplete="new-password" {...form.register('password')} />
            </Field>
            <Field label="Confirm new password" error={form.formState.errors.confirm?.message}>
              <PasswordInput autoComplete="new-password" {...form.register('confirm')} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" loading={form.formState.isSubmitting}>
              Update password
            </Button>
          </div>
        </form>
      </div>
    </Section>
  );
}

function ConnectedAppsSection() {
  const apps = useQuery({ queryKey: ['connected-apps'], queryFn: listConnectedApps, staleTime: 60_000 });
  const [toRevoke, setToRevoke] = useState<ConnectedApp | null>(null);
  if (!apps.data || apps.data.length === 0) return null;

  async function revoke() {
    if (!toRevoke) return;
    try {
      await revokeConnectedApp(toRevoke.clientId);
      toast.success(`${toRevoke.name} can no longer access your account.`);
      await apps.refetch();
    } catch (e) {
      toast.error(toUserMessage(e));
      throw e;
    }
  }

  return (
    <Section id="connected-apps" title="Connected apps" description="Apps you have allowed to access your account.">
      <ul className="divide-y divide-border">
        {apps.data.map((app) => (
          <li key={app.clientId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{app.name}</p>
              <p className="truncate text-[0.8125rem] text-muted-foreground">
                Allowed {new Date(app.grantedAt).toLocaleDateString()} · {app.scopes.join(', ') || 'basic access'}
              </p>
            </div>
            <Button variant="danger-ghost" size="sm" onClick={() => setToRevoke(app)}>
              Remove access
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={toRevoke !== null}
        onOpenChange={(open) => !open && setToRevoke(null)}
        title={`Remove ${toRevoke?.name ?? 'this app'}?`}
        description="It will no longer be able to access your account. You can allow it again later."
        confirmLabel="Remove access"
        onConfirm={revoke}
      />
    </Section>
  );
}

function DangerZone({ business }: { business: Business }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteBizOpen, setDeleteBizOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [typedDelete, setTypedDelete] = useState('');
  const [password, setPassword] = useState('');
  // Google accounts may have no password: they re-confirm with Google instead.
  const viaGoogle = signInMethods(user).google;
  const [recentSignIn, setRecentSignIn] = useState(false);

  async function removeBusiness() {
    try {
      await deleteBusiness(business);
      queryClient.setQueryData<Business[]>(queryKeys.myBusinesses, (list) => list?.filter((b) => b.id !== business.id));
      queryClient.removeQueries({ queryKey: queryKeys.items(business.id) });
      queryClient.removeQueries({ queryKey: queryKeys.categories(business.id) });
      toast.success('Your business was deleted.');
      navigate('/onboarding', { replace: true });
    } catch (e) {
      toast.error(toUserMessage(e));
      throw e;
    }
  }

  async function removeAccount() {
    if (!user?.email) return;
    try {
      // The database also requires a sign-in within the last 15 minutes.
      if (!viaGoogle) await verifyPassword(user.email, password);
      await deleteMyAccount();
      toast.success('Your account has been deleted.');
      navigate('/', { replace: true });
    } catch (e) {
      toast.error(toUserMessage(e));
      throw e;
    }
  }

  return (
    <Card id="danger" className="border-danger/30">
      <CardHeader title="Danger zone" description="These actions are permanent and cannot be undone." />
      <CardBody className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Delete this business</p>
            <p className="text-sm text-muted-foreground">Removes the storefront, every item, category and photo.</p>
          </div>
          <Button variant="danger" onClick={() => setDeleteBizOpen(true)}>
            Delete business
          </Button>
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Delete your account</p>
            <p className="text-sm text-muted-foreground">Deletes your login and all of your businesses and photos.</p>
          </div>
          <Button
            variant="danger"
            onClick={() => {
              setRecentSignIn(signedInRecently(user, 10));
              setDeleteAccountOpen(true);
            }}
          >
            Delete account
          </Button>
        </div>
      </CardBody>

      <ConfirmDialog
        open={deleteBizOpen}
        onOpenChange={(open) => {
          setDeleteBizOpen(open);
          if (!open) setTypedName('');
        }}
        title={`Delete ${business.name}?`}
        description="Your storefront link will stop working and all items, categories and photos will be permanently deleted."
        confirmLabel="Delete business"
        confirmDisabled={typedName.trim() !== business.name}
        onConfirm={removeBusiness}
      >
        <Field label={`Type “${business.name}” to confirm`}>
          <Input value={typedName} onChange={(e) => setTypedName(e.target.value)} autoComplete="off" />
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteAccountOpen}
        onOpenChange={(open) => {
          setDeleteAccountOpen(open);
          if (!open) {
            setTypedDelete('');
            setPassword('');
          }
        }}
        title="Delete your account?"
        description="This permanently deletes your account, your storefront and every photo you uploaded."
        confirmLabel="Delete my account"
        confirmDisabled={typedDelete !== 'DELETE' || (viaGoogle ? !recentSignIn : password.length === 0)}
        onConfirm={removeAccount}
      >
        <div className="space-y-4">
          {viaGoogle ? (
            recentSignIn ? (
              <p className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2.5 text-sm text-success">
                <GoogleIcon className="size-4 shrink-0" /> You confirmed it is you with Google.
              </p>
            ) : (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm text-muted-foreground">For your security, confirm it is you with Google first. You will come back here.</p>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => void signInWithGoogle('/dashboard/settings#danger').catch((e: unknown) => toast.error(toUserMessage(e)))}
                >
                  <GoogleIcon /> Confirm with Google
                </Button>
              </div>
            )
          ) : (
            <Field label="Your password">
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
          )}
          <Field label="Type DELETE to confirm">
            <Input value={typedDelete} onChange={(e) => setTypedDelete(e.target.value)} autoComplete="off" autoCapitalize="characters" />
          </Field>
        </div>
      </ConfirmDialog>
    </Card>
  );
}

export function Component() {
  usePageMeta({ title: 'Settings', noindex: true });
  useScrollToHash();
  const business = useCurrentBusiness();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Update your business, contact details, link and account." />
      <div className="space-y-6">
        <BusinessSection business={business} />
        <ContactSection business={business} />
        <LinkSection key={`l-${business.slug}`} business={business} />
        <VisibilitySection business={business} />
        <AccountSection />
        <ConnectedAppsSection />
        <DangerZone business={business} />
      </div>
    </div>
  );
}
