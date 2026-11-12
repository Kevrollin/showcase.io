import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormError } from '@/components/ui/field';
import { BUSINESS_TYPE_COPY, type BusinessType } from '@/config/catalog';
import { IdentityFields } from '@/features/businesses/components/BusinessFields';
import { identityDefaults } from '@/features/businesses/forms';
import { useFormDraft } from '@/hooks/useFormDraft';
import { toUserMessage } from '@/lib/utils/errors';
import { identitySchema, type IdentityValues } from '@/lib/validation/schemas';
import type { Business } from '@/types/models';
import { StepFooter, StepHeader } from '../WizardLayout';

export function IdentityStep({
  business,
  businessType,
  draftKey,
  onBack,
  onSubmit,
}: {
  business: Business | null;
  businessType: BusinessType;
  draftKey: string;
  onBack: () => void;
  onSubmit: (values: IdentityValues) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<IdentityValues>({ resolver: zodResolver(identitySchema), defaultValues: identityDefaults(business) });
  const clearDraft = useFormDraft(draftKey, form);

  async function submit(values: IdentityValues) {
    setError(null);
    try {
      await onSubmit(values);
      clearDraft();
    } catch (e) {
      setError(toUserMessage(e));
    }
  }

  const noun = BUSINESS_TYPE_COPY[businessType].itemNounPlural;
  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate>
      <StepHeader title="Tell customers who you are" description={`This appears at the top of your storefront, above your ${noun}.`} />
      <div className="space-y-5">
        <FormError message={error} />
        <IdentityFields form={form} businessType={businessType} />
      </div>
      <StepFooter onBack={onBack} loading={form.formState.isSubmitting} />
    </form>
  );
}
