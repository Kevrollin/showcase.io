import {
  ArrowRight,
  Brush,
  Check,
  FolderOpen,
  GraduationCap,
  Images,
  LayoutGrid,
  Link2,
  MessageCircle,
  PackageOpen,
  QrCode,
  Search,
  Send,
  ShoppingBag,
  Smartphone,
  Store,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/config/brand';
import { absoluteUrl } from '@/config/site';
import { PhonePreview } from '@/features/storefront/components/PhonePreview';
import { StorefrontView } from '@/features/storefront/components/StorefrontView';
import { usePageMeta } from '@/hooks/usePageMeta';
import { cn } from '@/lib/utils/cn';
import { DEMO_SHOP, DEMO_STUDIO } from './demo';
import { MarketingLayout } from './MarketingLayout';

const NO_FILTERS = { search: '', categoryId: null, itemType: null };
const noop = () => undefined;

function Demo({ demo }: { demo: typeof DEMO_SHOP }) {
  return (
    <StorefrontView
      business={demo.business}
      items={demo.items}
      total={demo.items.length}
      status="ready"
      filters={NO_FILTERS}
      onFiltersChange={noop}
      preview
    />
  );
}

function SectionHeading({ eyebrow, title, description, center }: { eyebrow: string; title: string; description?: ReactNode; center?: boolean }) {
  return (
    <div className={cn('max-w-2xl', center && 'mx-auto text-center')}>
      <p className="text-sm font-semibold uppercase tracking-wider text-gold-strong">{eyebrow}</p>
      <h2 className="mt-3 text-[1.75rem] font-bold leading-tight sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>}
    </div>
  );
}

const PROBLEMS: Array<{ icon: LucideIcon; text: string }> = [
  { icon: Send, text: 'Sending the same product photos one by one, to every new customer.' },
  { icon: Search, text: 'Scrolling through old WhatsApp chats to find work you did months ago.' },
  { icon: FolderOpen, text: 'Hundreds of photos scattered across your phone, Drive and Instagram.' },
  { icon: Link2, text: 'No professional link to share when someone asks “what do you sell?”' },
  { icon: Wallet, text: 'Paying for a full website when all you need is a place to show your work.' },
];

const FEATURES: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: Store, title: 'Your own digital storefront', text: 'A clean, fast page with your logo, description and contact details.' },
  { icon: ShoppingBag, title: 'Products and services', text: 'List items with photos, prices, availability and categories.' },
  { icon: Images, title: 'Portfolio gallery', text: 'Show previous projects without needing to set a price.' },
  { icon: Link2, title: 'One shareable link', text: 'Every storefront — and every item — gets its own link.' },
  { icon: QrCode, title: 'Downloadable QR code', text: 'Print it for your counter, stall, packaging or posters.' },
  { icon: MessageCircle, title: 'Enquiries on WhatsApp', text: 'Customers tap once to message you about a specific item.' },
];

const STEPS = [
  { title: 'Set up your business', text: 'Answer a few quick questions: your name, what you offer and your WhatsApp number.' },
  { title: 'Add what you offer', text: 'Upload products, services or previous work straight from your phone.' },
  { title: 'Your storefront is ready', text: 'We build a beautiful, mobile-friendly page for you automatically.' },
  { title: 'Share and get enquiries', text: 'Send your link or QR code. Customers browse and chat with you on WhatsApp.' },
];

const AUDIENCES: Array<{ icon: LucideIcon; title: string; text: string; tone: string }> = [
  { icon: GraduationCap, title: 'Student entrepreneurs', text: 'Selling clothes from your hostel, snacks, or printing services on campus.', tone: 'bg-gold-soft text-gold-strong' },
  { icon: PackageOpen, title: 'Product sellers', text: 'Fashion, shoes, electronics, cosmetics, books, cakes and handmade goods.', tone: 'bg-sage-soft text-sage' },
  { icon: Wrench, title: 'Freelancers', text: 'Barbers, tutors, makeup artists, technicians, cleaners and web developers.', tone: 'bg-[#e9f1f7] text-[#1d5b85]' },
  { icon: Brush, title: 'Creative professionals', text: 'Designers, photographers, videographers, artists and event decorators.', tone: 'bg-[#f8ecef] text-[#a23e58]' },
  { icon: Store, title: 'Local businesses', text: 'Bakeries, salons, print shops and stalls that run mostly on WhatsApp.', tone: 'bg-surface-sunken text-foreground' },
];

const BENEFITS = [
  'No coding required',
  'No technical knowledge needed',
  'No website to build or maintain',
  'Looks great on every phone',
  'Easy to update from your phone',
  'Free storefront link',
  'Printable QR code',
  'Photos optimised to save data',
];

export function Component() {
  usePageMeta({ canonical: absoluteUrl('/') });

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="overflow-hidden">
        <div className="container-page grid items-center gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-8 lg:pb-24 lg:pt-20">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm font-medium text-muted-foreground">
              <Smartphone className="size-4 text-gold-strong" aria-hidden="true" /> Built for selling on WhatsApp
            </p>
            <h1 className="mt-5 text-[2.375rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Your business deserves more than scattered WhatsApp photos.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              Create your own digital catalogue, showcase your products or services, and share everything through one simple link.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-13 px-6 text-base">
                <Link to="/signup">
                  Create your free catalogue <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="h-13 px-6 text-base">
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Free to start · Ready in a few minutes · Works on any phone</p>
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
            <div className="absolute inset-x-6 top-10 bottom-6 -z-10 rounded-[3rem] bg-surface-sunken lg:inset-x-10" aria-hidden="true" />
            <figure>
              <div inert className="select-none">
                <PhonePreview label="Example storefront for a sneaker seller" tall>
                  <Demo demo={DEMO_SHOP} />
                </PhonePreview>
              </div>
              <figcaption className="sr-only">An example storefront for a campus sneaker seller, showing products with prices and a Chat on WhatsApp button.</figcaption>
            </figure>
            <div aria-hidden="true" className="absolute -left-4 bottom-24 hidden w-56 rounded-xl border border-border bg-surface p-3 shadow-lg sm:block lg:-left-16">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-whatsapp">
                <MessageCircle className="size-3.5" /> New WhatsApp message
              </p>
              <p className="mt-1.5 text-[0.8125rem] leading-snug text-foreground">Hi, I found your catalogue and I&apos;m interested in the Air Max 90.</p>
            </div>
            <div aria-hidden="true" className="absolute -right-4 top-20 hidden items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-lg sm:flex lg:-right-12">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-white">
                <QrCode className="size-5" />
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">Your link</span>
                <span className="block text-sm font-semibold">/s/campus-kicks</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-border bg-surface py-16 sm:py-24">
        <div className="container-page grid gap-10 lg:grid-cols-2 lg:gap-16">
          <SectionHeading
            eyebrow="Sound familiar?"
            title="Selling through scattered photos is exhausting."
            description="Customers ask what you have. You search, forward, screenshot and repeat — and still lose sales because they can't see everything you offer."
          />
          <ul className="space-y-3">
            {PROBLEMS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-4 rounded-lg border border-border bg-background p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <p className="pt-2 text-[0.9375rem] leading-snug">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Solution / features */}
      <section id="features" className="scroll-mt-20 py-16 sm:py-24">
        <div className="container-page">
          <SectionHeading center eyebrow="The solution" title={BRAND.promise} description="Everything a small business needs to look professional online — without building a website." />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-xl border border-border bg-surface p-6 shadow-xs">
                <span className="flex size-11 items-center justify-center rounded-lg bg-gold-soft text-gold-strong">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-surface py-16 sm:py-24">
        <div className="container-page">
          <SectionHeading center eyebrow="How it works" title="From your phone to a professional storefront in minutes" />
          <ol className="relative mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <div className="absolute left-[12.5%] right-[12.5%] top-6 hidden h-px bg-border-strong lg:block" aria-hidden="true" />
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative flex flex-col items-start lg:items-center lg:text-center">
                <span className="relative z-10 flex size-12 items-center justify-center rounded-full bg-primary font-display text-lg font-bold text-white ring-8 ring-surface">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-1.5 max-w-xs text-[0.9375rem] leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex justify-center">
            <Button asChild size="lg">
              <Link to="/signup">
                Start now — it&apos;s free <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section id="who-its-for" className="scroll-mt-20 py-16 sm:py-24">
        <div className="container-page">
          <SectionHeading eyebrow="Who it's for" title="Made for people who sell or create — not web developers" />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {AUDIENCES.map(({ icon: Icon, title, text, tone }) => (
              <li key={title} className="flex flex-col rounded-xl border border-border bg-surface p-5 shadow-xs">
                <span className={cn('flex size-11 items-center justify-center rounded-lg', tone)}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Product preview */}
      <section className="border-y border-border bg-surface-muted py-16 sm:py-24">
        <div className="container-page">
          <SectionHeading
            center
            eyebrow="See it in action"
            title="What your customers see"
            description="Your logo, what you do, your products and services with prices, and a one-tap WhatsApp button."
          />
          <figure className="mx-auto mt-12 max-w-5xl">
            <div className="overflow-hidden rounded-xl border border-border-strong bg-surface shadow-lg">
              <div className="flex items-center gap-3 border-b border-border bg-surface-muted px-4 py-3" aria-hidden="true">
                <span className="flex gap-1.5">
                  <span className="size-3 rounded-full bg-[#e0d9cc]" />
                  <span className="size-3 rounded-full bg-[#e0d9cc]" />
                  <span className="size-3 rounded-full bg-[#e0d9cc]" />
                </span>
                <span className="flex h-8 flex-1 items-center gap-2 rounded-md bg-surface px-3 text-[0.8125rem] text-muted-foreground">
                  <LayoutGrid className="size-3.5" /> yourlink/s/kelvin-designs
                </span>
              </div>
              <div inert className="h-[36rem] overflow-hidden select-none">
                {/* Scaled down so the header and the first row of cards fit in the frame. */}
                <div style={{ zoom: 0.8 }}>
                  <Demo demo={DEMO_STUDIO} />
                </div>
              </div>
            </div>
            <figcaption className="mt-4 text-center text-sm text-muted-foreground">Example storefront for a graphic design and printing business.</figcaption>
          </figure>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 sm:py-24">
        <div className="container-page grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <SectionHeading
            eyebrow="Why it's different"
            title="All the professionalism of a website, none of the hassle"
            description="If you can send a WhatsApp message, you can run your storefront. Update prices, add new stock or hide sold-out items in seconds."
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 text-[0.9375rem] font-medium shadow-xs">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section className="pb-16 sm:pb-24">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-14 text-center sm:px-12 sm:py-16">
            <div className="absolute inset-x-0 top-0 h-1 bg-gold" aria-hidden="true" />
            <h2 className="mx-auto max-w-2xl text-[1.75rem] font-bold leading-tight text-white sm:text-4xl">Give customers one link that shows everything you do.</h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/75 sm:text-lg">Set up your storefront today. It&apos;s free to start and takes just a few minutes.</p>
            <Button asChild size="lg" variant="secondary" className="mt-8 h-13 border-0 px-6 text-base">
              <Link to="/signup">
                Create your free catalogue <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
