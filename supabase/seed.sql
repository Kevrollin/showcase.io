-- ════════════════════════════════════════════════════════════════════════════
-- Local development seed (runs on `supabase db reset`). NEVER run in production.
--
-- Demo login:  demo@showcase.test  /  demo-password-1
-- Storefront:  http://localhost:5173/s/kelvin-designs
-- Items have no photos (Storage objects can't be seeded from SQL); upload
-- some from the dashboard to see the image pipeline.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_user uuid := 'a0000000-0000-4000-8000-000000000001';
  v_biz uuid := 'b0000000-0000-4000-8000-000000000001';
  v_logos uuid := 'c0000000-0000-4000-8000-000000000001';
  v_print uuid := 'c0000000-0000-4000-8000-000000000002';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated', 'demo@showcase.test',
    extensions.crypt('demo-password-1', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Kelvin Mwangi"}', now(), now(),
    '', '', '', ''
  ) on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_user, v_user::text,
    jsonb_build_object('sub', v_user::text, 'email', 'demo@showcase.test', 'email_verified', true),
    'email', now(), now(), now()
  ) on conflict do nothing;

  insert into public.businesses (
    id, owner_id, name, slug, description, business_type, category, location_label,
    whatsapp_number, instagram_url, theme_id, accent_color, status, onboarding_step, onboarding_completed_at
  ) values (
    v_biz, v_user, 'Kelvin Designs', 'kelvin-designs',
    'Creative graphic design, branding and printing services.', 'mixed', 'graphic-design',
    'Egerton University / Njoro', '+254712345678', 'https://instagram.com/kelvindesigns',
    'minimal', 'navy', 'published', 6, now()
  ) on conflict (id) do nothing;

  insert into public.categories (id, business_id, name, sort_order) values
    (v_logos, v_biz, 'Logos & branding', 0),
    (v_print, v_biz, 'Printing', 1)
  on conflict (id) do nothing;

  insert into public.catalogue_items (business_id, category_id, item_type, title, description, price, price_mode, availability_status, is_featured, is_published, sort_order) values
    (v_biz, v_logos, 'service', 'Logo design', 'Three concepts, two rounds of revisions and every file format you need.', 2500, 'starting_from', 'available', true, true, 0),
    (v_biz, v_logos, 'service', 'Full brand identity', 'Logo, colour palette, typography and social media templates.', null, 'quote', 'available', false, true, 1),
    (v_biz, v_print, 'product', 'Business cards (100 pcs)', 'Matte 350gsm, double-sided.', 1800, 'fixed', 'available', false, true, 2),
    (v_biz, v_print, 'product', 'Custom printed T-shirt', 'Your design on a quality cotton tee. Sizes S–XXL.', 850, 'fixed', 'preorder', false, true, 3),
    (v_biz, null, 'portfolio', 'Campus Tech Week poster', 'Event branding for a student tech conference.', null, 'none', 'available', false, true, 4),
    (v_biz, null, 'service', 'Wedding stationery', 'Coming soon — not visible to customers yet.', null, 'contact', 'available', false, false, 5)
  on conflict do nothing;
end $$;
