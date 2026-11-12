import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toaster';
import { BUSINESS_TYPES, type BusinessType } from '@/config/catalog';
import { useAuth } from '@/features/auth/auth-context';
import { identityToColumns } from '@/features/businesses/forms';
import { pickCurrentBusiness, rememberCurrentBusiness, useMyBusinesses, useSetBusinessInCache } from '@/features/businesses/hooks';
import { clearDraft, readDraft, writeDraft } from '@/hooks/useFormDraft';
import { usePageMeta } from '@/hooks/usePageMeta';
import { toUserMessage } from '@/lib/utils/errors';
import { contactToColumns, type ContactValues, type IdentityValues } from '@/lib/validation/schemas';
import { signOut } from '@/services/auth.service';
import { createBusiness, setBusinessStatus, updateBusiness, type BusinessPatch } from '@/services/business.service';
import type { Business } from '@/types/models';
import { AppearanceStep } from './steps/AppearanceStep';
import { ContactStep } from './steps/ContactStep';
import { IdentityStep } from './steps/IdentityStep';
import { ItemsStep } from './steps/ItemsStep';
import { PublishStep } from './steps/PublishStep';
import { SuccessScreen } from './steps/SuccessScreen';
import { TypeStep } from './steps/TypeStep';
import { TOTAL_STEPS } from './wizard';
import { WizardLayout } from './WizardLayout';

interface LocalProgress {
  type?: BusinessType;
}

function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === 'string' && (BUSINESS_TYPES as readonly string[]).includes(value);
}

/**
 * Guided setup. Steps 1–2 live in a local draft until the business row is
 * created (step 2); every later step is saved to the database as soon as it
 * is completed, and `businesses.onboarding_step` lets the user resume.
 */
export function Component() {
  usePageMeta({ title: 'Set up your storefront', noindex: true });
  const { user } = useAuth();
  const businesses = useMyBusinesses();

  if (businesses.isPending) return <PageLoader label="Loading your setup" />;
  if (businesses.isError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted-foreground">{toUserMessage(businesses.error)}</p>
        <Button onClick={() => void businesses.refetch()}>Try again</Button>
      </div>
    );
  }
  return <OnboardingWizard business={pickCurrentBusiness(businesses.data)} userId={user?.id ?? 'anon'} />;
}

/** Where to resume: the saved step for an existing business, otherwise the local draft. */
function initialProgress(business: Business | null, progressKey: string): { step: number; type: BusinessType | null } {
  if (business) return { step: Math.min(Math.max(business.onboarding_step, 2), TOTAL_STEPS), type: business.business_type };
  const local = readDraft<LocalProgress>(progressKey);
  const localType = isBusinessType(local?.type) ? local.type : null;
  return { step: localType ? 2 : 1, type: localType };
}

function OnboardingWizard({ business, userId }: { business: Business | null; userId: string }) {
  const setInCache = useSetBusinessInCache();
  const progressKey = `showcase:onboarding:${userId}`;
  const [initial] = useState(() => initialProgress(business, progressKey));
  const [step, setStep] = useState<number>(initial.step);
  const [type, setType] = useState<BusinessType | null>(initial.type);
  const [savingType, setSavingType] = useState(false);
  const [published, setPublished] = useState<Business | null>(null);
  /** Set when the user jumps back from the publish step to edit something. */
  const [returnToPublish, setReturnToPublish] = useState(false);

  // Finished earlier and opened /onboarding again: go to the dashboard.
  if (business?.onboarding_completed_at && !published) return <Navigate to="/dashboard" replace />;

  const advanceTo = (next: number) => {
    if (returnToPublish) {
      setReturnToPublish(false);
      setStep(TOTAL_STEPS);
      return;
    }
    setStep(Math.min(next, TOTAL_STEPS));
  };

  async function saveBusiness(patch: BusinessPatch, nextStep: number) {
    if (!business) return;
    const updated = await updateBusiness(business.id, {
      ...patch,
      onboarding_step: Math.max(business.onboarding_step, nextStep),
    });
    setInCache(updated);
    advanceTo(nextStep);
  }

  async function continueFromType() {
    if (!type) return;
    writeDraft(progressKey, { type } satisfies LocalProgress);
    if (business && business.business_type !== type) {
      setSavingType(true);
      try {
        await saveBusiness({ business_type: type }, 2);
      } catch (error) {
        toast.error(toUserMessage(error));
        return;
      } finally {
        setSavingType(false);
      }
    }
    advanceTo(2);
  }

  async function submitIdentity(values: IdentityValues) {
    if (!type) return;
    if (business) {
      await saveBusiness(identityToColumns(values), 3);
      return;
    }
    const created = await createBusiness({ ...identityToColumns(values), business_type: type, onboarding_step: 3 });
    setInCache(created);
    rememberCurrentBusiness(created.id);
    clearDraft(progressKey);
    advanceTo(3);
  }

  async function submitContact(values: ContactValues) {
    await saveBusiness(contactToColumns(values), 4);
  }

  async function publish(slug: string) {
    if (!business) return;
    let current = business;
    if (slug !== business.slug) current = await updateBusiness(business.id, { slug });
    const live = await setBusinessStatus(current.id, 'published');
    setInCache(live);
    toast.success('Your storefront is now live.');
    setPublished(live);
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  const headerAction = business ? (
    <Button asChild variant="ghost" size="sm">
      <Link to="/dashboard">Save &amp; exit</Link>
    </Button>
  ) : (
    <Button variant="ghost" size="sm" onClick={() => void handleSignOut()} aria-label="Sign out">
      <LogOut /> <span className="hidden sm:inline">Sign out</span>
    </Button>
  );

  if (published) {
    return (
      <WizardLayout step={TOTAL_STEPS} headerAction={headerAction}>
        <SuccessScreen business={published} />
      </WizardLayout>
    );
  }

  const back = () => {
    setReturnToPublish(false);
    setStep((s) => Math.max(1, s - 1));
  };
  const editFromPublish = (target: number) => {
    setReturnToPublish(true);
    setStep(target);
  };
  // Steps 3+ need the business row; without it (e.g. deleted elsewhere) restart at step 2.
  const current = !business && step > 2 ? (type ? 2 : 1) : step;
  const wide = current === 4 || current === 6;

  return (
    <WizardLayout step={current} headerAction={headerAction} wide={wide}>
      {current === 1 && <TypeStep value={type} onChange={setType} onContinue={() => void continueFromType()} saving={savingType} />}
      {current === 2 && type && (
        <IdentityStep business={business} businessType={type} draftKey={`showcase:draft:identity:${userId}`} onBack={back} onSubmit={submitIdentity} />
      )}
      {current === 3 && business && <ContactStep business={business} onBack={back} onSubmit={submitContact} />}
      {current === 4 && business && <AppearanceStep business={business} onBack={back} onSubmit={(v) => saveBusiness(v, 5)} />}
      {current === 5 && business && <ItemsStep business={business} onBack={back} onContinue={() => saveBusiness({}, 6)} />}
      {current === 6 && business && <PublishStep business={business} onEdit={editFromPublish} onBack={back} onPublish={publish} />}
    </WizardLayout>
  );
}
