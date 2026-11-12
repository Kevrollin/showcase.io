import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { BUSINESS_CATEGORIES, type BusinessType } from '@/config/catalog';
import { cn } from '@/lib/utils/cn';
import type { ContactValues, IdentityValues } from '@/lib/validation/schemas';

const GROUPS = ['Products', 'Services', 'Creative'] as const;

const PLACEHOLDERS: Record<BusinessType, { name: string; description: string }> = {
  products: { name: 'e.g. Campus Kicks', description: 'e.g. Original sneakers and streetwear, delivered around campus.' },
  services: { name: 'e.g. Kelvin Designs', description: 'e.g. Creative graphic design, branding and printing services.' },
  portfolio: { name: 'e.g. Wanjiru Photography', description: 'e.g. Graduation, portrait and event photography in Nakuru.' },
  mixed: { name: 'e.g. Njoro Print Hub', description: 'e.g. Printing, branded merchandise and design services.' },
};

export function CharacterCount({ value, max }: { value: string; max: number }) {
  return (
    <span className={cn('tabular-nums', value.length > max ? 'text-danger' : 'text-subtle-foreground')}>
      {value.length}/{max}
    </span>
  );
}

export function IdentityFields({ form, businessType }: { form: UseFormReturn<IdentityValues>; businessType: BusinessType }) {
  const { register, formState, control } = form;
  const description = useWatch({ control, name: 'description' }) ?? '';
  const placeholder = PLACEHOLDERS[businessType];
  return (
    <div className="space-y-5">
      <Field label="What's your business called?" hint="It doesn't need to be a registered name." error={formState.errors.name?.message}>
        <Input placeholder={placeholder.name} autoComplete="organization" maxLength={80} {...register('name')} />
      </Field>
      <Field
        label={
          <span className="flex w-full items-baseline justify-between">
            Short description <CharacterCount value={description} max={500} />
          </span>
        }
        optional
        hint="One or two sentences about what you offer."
        error={formState.errors.description?.message}
      >
        <Textarea rows={3} placeholder={placeholder.description} {...register('description')} />
      </Field>
      <Field label="Category" optional error={formState.errors.category?.message}>
        <Select {...register('category')}>
          <option value="">Choose a category</option>
          {GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {BUSINESS_CATEGORIES.filter((c) => c.group === group).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <Field label="Location or campus" optional hint="e.g. Egerton University, Njoro" error={formState.errors.location_label?.message}>
        <Input placeholder="Where customers can find you" maxLength={80} {...register('location_label')} />
      </Field>
    </div>
  );
}

export function ContactFields({ form, defaultOpenSocial = false }: { form: UseFormReturn<ContactValues>; defaultOpenSocial?: boolean }) {
  const { register, formState, getValues } = form;
  const errors = formState.errors;
  const hasSocial = Boolean(getValues('instagram') || getValues('tiktok') || getValues('facebook') || getValues('website'));
  const [open, setOpen] = useState(defaultOpenSocial || hasSocial || Boolean(errors.instagram || errors.tiktok || errors.facebook || errors.website));

  return (
    <div className="space-y-5">
      <Field
        label="WhatsApp number"
        hint="Customers tap “Chat on WhatsApp” to message you here. Kenyan numbers like 0712 345 678 work."
        error={errors.whatsapp_number?.message}
      >
        <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" {...register('whatsapp_number')} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone for calls" optional hint="If different from WhatsApp." error={errors.phone_number?.message}>
          <Input type="tel" inputMode="tel" placeholder="0712 345 678" {...register('phone_number')} />
        </Field>
        <Field label="Business email" optional error={errors.contact_email?.message}>
          <Input type="email" inputMode="email" placeholder="you@example.com" {...register('contact_email')} />
        </Field>
      </div>

      <div className="rounded-lg border border-border">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium"
        >
          <span>
            Social media and website <span className="font-normal text-muted-foreground">· optional</span>
          </span>
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
        {open && (
          <div className="grid gap-5 border-t border-border px-4 py-4 sm:grid-cols-2">
            <Field label="Instagram" error={errors.instagram?.message}>
              <Input placeholder="@yourbusiness" autoCapitalize="none" {...register('instagram')} />
            </Field>
            <Field label="TikTok" error={errors.tiktok?.message}>
              <Input placeholder="@yourbusiness" autoCapitalize="none" {...register('tiktok')} />
            </Field>
            <Field label="Facebook" error={errors.facebook?.message}>
              <Input placeholder="Page name or link" autoCapitalize="none" {...register('facebook')} />
            </Field>
            <Field label="Website" error={errors.website?.message}>
              <Input type="url" inputMode="url" placeholder="yourbusiness.com" autoCapitalize="none" {...register('website')} />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}
