import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormError } from '@/components/ui/field';
import { ContactFields } from '@/features/businesses/components/BusinessFields';
import { contactDefaults } from '@/features/businesses/forms';
import { useFormDraft } from '@/hooks/useFormDraft';
import { toUserMessage } from '@/lib/utils/errors';
import { contactSchema, type ContactValues } from '@/lib/validation/schemas';
import type { Business } from '@/types/models';
import { StepFooter, StepHeader } from '../WizardLayout';

export function ContactStep({
  business,
  onBack,
  onSubmit,
}: {
  business: Business;
  onBack: () => void;
  onSubmit: (values: ContactValues) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ContactValues>({ resolver: zodResolver(contactSchema), defaultValues: contactDefaults(business) });
  const clearDraft = useFormDraft(`showcase:draft:contact:${business.id}`, form);

  async function submit(values: ContactValues) {
    setError(null);
    try {
      await onSubmit(values);
      clearDraft();
    } catch (e) {
      setError(toUserMessage(e));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate>
      <StepHeader
        title="How should customers reach you?"
        description="WhatsApp is how most customers will contact you. Everything else is optional."
      />
      <div className="space-y-5">
        <FormError message={error} />
        <ContactFields form={form} />
      </div>
      <StepFooter onBack={onBack} loading={form.formState.isSubmitting} />
    </form>
  );
}
