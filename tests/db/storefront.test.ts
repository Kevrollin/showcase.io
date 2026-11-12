import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCENT_COLORS, STOREFRONT_THEMES } from '../../src/config/catalog';
import { affectedAs, as, createTestDatabase, createUser, rowsAs, type TestUser } from './harness';

let db: PGlite;
let owner: TestUser;
let other: TestUser;
let bizId: string;
let shoes: string;
let bags: string;

interface StorefrontRow {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  image: { path: string; thumb_path: string | null } | null;
  image_count: number;
  total_count: string | number;
  is_featured: boolean;
}

beforeAll(async () => {
  db = await createTestDatabase();
  owner = await createUser(db, 'owner@example.com');
  other = await createUser(db, 'other@example.com');

  bizId = (
    await rowsAs<{ id: string }>(
      db, owner,
      `insert into public.businesses (name, slug, business_type, description, whatsapp_number, status)
       values ('Campus Kicks', 'Campus-Kicks', 'mixed', 'Sneakers and repairs', '+254700111222', 'published') returning id`,
    )
  )[0]!.id;

  await as(db, owner, async (tx) => {
    shoes = (await tx.query<{ id: string }>(`insert into public.categories (business_id, name, sort_order) values ($1, 'Shoes', 0) returning id`, [bizId])).rows[0]!.id;
    bags = (await tx.query<{ id: string }>(`insert into public.categories (business_id, name, sort_order) values ($1, 'Bags', 1) returning id`, [bizId])).rows[0]!.id;
    await tx.query(`insert into public.categories (business_id, name, sort_order) values ($1, 'Empty', 2)`, [bizId]);

    // [type, category, title, description, price, price mode, featured, published]; sort order = index
    const items: Array<[string, string | null, string, string, number | null, string, boolean, boolean]> = [
      ['product', shoes, 'Air Max 90', 'Classic runners', 4500, 'fixed', true, true],
      ['product', shoes, 'Jordan 1 Low', 'Size 40-45', 6000, 'fixed', false, true],
      ['product', bags, 'Canvas tote', 'Holds 100% of your books', 1200, 'fixed', false, true],
      ['service', null, 'Sneaker cleaning', 'Deep clean_and restore', 500, 'starting_from', false, true],
      ['product', shoes, 'Unreleased colourway', 'Not yet', null, 'contact', false, false],
    ];
    for (const [index, [type, category, title, description, price, mode, featured, published]] of items.entries()) {
      await tx.query(
        `insert into public.catalogue_items (business_id, category_id, item_type, title, description, price, price_mode, is_featured, is_published, sort_order)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [bizId, category, type, title, description, price, mode, featured, published, index],
      );
    }
    const air = (await tx.query<{ id: string }>(`select id from public.catalogue_items where slug = 'air-max-90'`)).rows[0]!.id;
    for (const n of [1, 0]) {
      await tx.query(
        `insert into public.catalogue_images (business_id, item_id, storage_path, thumb_path, width, height, sort_order)
         values ($1, $2, $3, $4, 1600, 1600, $5)`,
        [bizId, air, `${owner.id}/${bizId}/${air}/img-${n}.webp`, `${owner.id}/${bizId}/${air}/img-${n}-thumb.webp`, n],
      );
    }
  });
});

afterAll(async () => {
  await db.close();
});

describe('slugs', () => {
  it('are normalised to lowercase', async () => {
    const rows = await rowsAs<{ slug: string }>(db, owner, `select slug from public.businesses where id = $1`, [bizId]);
    expect(rows[0]?.slug).toBe('campus-kicks');
  });

  it('are generated from the name and de-duplicated', async () => {
    const rows = await rowsAs<{ slug: string }>(
      db, other, `insert into public.businesses (name, business_type) values ('Campus Kicks!!', 'products') returning slug`,
    );
    expect(rows[0]?.slug).toBe('campus-kicks-2');
  });

  it('reject duplicates regardless of case', async () => {
    await expect(
      affectedAs(db, other, `update public.businesses set slug = 'CAMPUS-KICKS' where owner_id = $1`, [other.id]),
    ).rejects.toThrow(/duplicate key/);
  });

  it('reject reserved words and invalid formats', async () => {
    for (const slug of ['admin', 'dashboard', 'api', 's', 'login']) {
      await expect(
        affectedAs(db, other, `update public.businesses set slug = $1 where owner_id = $2`, [slug, other.id]),
      ).rejects.toThrow(/check constraint/);
    }
    for (const slug of ['a', 'has space', '-leading', 'trailing-', 'double--dash', 'émoji']) {
      await expect(
        affectedAs(db, other, `update public.businesses set slug = $1 where owner_id = $2`, [slug, other.id]),
      ).rejects.toThrow(/check constraint/);
    }
  });

  it('never generate a reserved slug', async () => {
    const user = await createUser(db, 'admin-name@example.com');
    const rows = await rowsAs<{ slug: string }>(
      db, user, `insert into public.businesses (name, business_type) values ('Admin', 'services') returning slug`,
    );
    expect(rows[0]?.slug).toBe('admin-store');
  });

  it('availability check sees other users’ drafts and ignores the caller’s own business', async () => {
    const check = (slug: string, businessId: string | null = null) =>
      rowsAs<{ ok: boolean }>(db, other, `select public.is_slug_available($1, $2) as ok`, [slug, businessId]).then((r) => r[0]?.ok);
    expect(await check('campus-kicks')).toBe(false);
    expect(await check('Campus-Kicks')).toBe(false);
    expect(await check('admin')).toBe(false);
    expect(await check('x')).toBe(false);
    expect(await check('a-brand-new-name')).toBe(true);
    expect(await check('campus-kicks', bizId)).toBe(true);
  });

  it('availability check is not exposed to anonymous visitors', async () => {
    await expect(rowsAs(db, 'anon', `select public.is_slug_available('abc')`)).rejects.toThrow(/permission denied/);
  });
});

describe('get_storefront', () => {
  it('returns public business data and filter metadata', async () => {
    const rows = await rowsAs<{ s: Record<string, unknown> }>(db, 'anon', `select public.get_storefront('CAMPUS-KICKS') as s`);
    const s = rows[0]!.s;
    expect(s.name).toBe('Campus Kicks');
    expect(s.whatsapp_number).toBe('+254700111222');
    expect(s.item_count).toBe(4);
    expect(s.item_types).toEqual({ product: 3, service: 1 });
    // Only categories with published items, in sort order.
    expect(s.categories).toEqual([
      { id: shoes, name: 'Shoes', item_count: 2 },
      { id: bags, name: 'Bags', item_count: 1 },
    ]);
    expect(s).not.toHaveProperty('owner_id');
    expect(s).not.toHaveProperty('status');
  });

  it('returns null for unknown or unpublished storefronts', async () => {
    const unknown = await rowsAs<{ s: unknown }>(db, 'anon', `select public.get_storefront('nope-not-here') as s`);
    expect(unknown[0]?.s).toBeNull();

    await affectedAs(db, owner, `update public.businesses set status = 'unpublished' where id = $1`, [bizId]);
    const hidden = await rowsAs<{ s: unknown }>(db, 'anon', `select public.get_storefront('campus-kicks') as s`);
    expect(hidden[0]?.s).toBeNull();
    // The owner does not get a different answer from the public function either.
    const ownerView = await rowsAs<{ s: unknown }>(db, owner, `select public.get_storefront('campus-kicks') as s`);
    expect(ownerView[0]?.s).toBeNull();
    await affectedAs(db, owner, `update public.businesses set status = 'published' where id = $1`, [bizId]);
  });
});

describe('get_storefront_items', () => {
  const list = (args: string, params: unknown[] = []) =>
    rowsAs<StorefrontRow>(db, 'anon', `select * from public.get_storefront_items(${args})`, params);

  it('lists published items, featured first, with the primary image', async () => {
    const rows = await list(`'campus-kicks'`);
    expect(rows.map((r) => r.title)).toEqual(['Air Max 90', 'Jordan 1 Low', 'Canvas tote', 'Sneaker cleaning']);
    expect(rows[0]?.is_featured).toBe(true);
    expect(rows[0]?.image?.path).toMatch(/img-0\.webp$/);
    expect(rows[0]?.image?.thumb_path).toMatch(/img-0-thumb\.webp$/);
    expect(rows[0]?.image_count).toBe(2);
    expect(Number(rows[0]?.total_count)).toBe(4);
  });

  it('filters by category and item type', async () => {
    expect((await list(`'campus-kicks', p_category_id => $1`, [bags])).map((r) => r.title)).toEqual(['Canvas tote']);
    expect((await list(`'campus-kicks', p_item_type => 'service'`)).map((r) => r.title)).toEqual(['Sneaker cleaning']);
  });

  it('searches title and description, treating wildcards literally', async () => {
    expect((await list(`'campus-kicks', p_search => 'jordan'`)).map((r) => r.title)).toEqual(['Jordan 1 Low']);
    expect((await list(`'campus-kicks', p_search => '100%'`)).map((r) => r.title)).toEqual(['Canvas tote']);
    expect((await list(`'campus-kicks', p_search => 'clean_and'`)).map((r) => r.title)).toEqual(['Sneaker cleaning']);
    // "%" and "_" are literal characters, not wildcards.
    expect((await list(`'campus-kicks', p_search => '%'`)).map((r) => r.title)).toEqual(['Canvas tote']);
    expect(await list(`'campus-kicks', p_search => 'Air_Max'`)).toHaveLength(0);
    expect(await list(`'campus-kicks', p_search => 'zzz-no-match'`)).toHaveLength(0);
  });

  it('paginates with a stable order and total count', async () => {
    const page1 = await list(`'campus-kicks', p_limit => 2, p_offset => 0`);
    const page2 = await list(`'campus-kicks', p_limit => 2, p_offset => 2`);
    expect(page1.map((r) => r.title)).toEqual(['Air Max 90', 'Jordan 1 Low']);
    expect(page2.map((r) => r.title)).toEqual(['Canvas tote', 'Sneaker cleaning']);
    expect(Number(page2[0]?.total_count)).toBe(4);
  });

  it('caps the page size', async () => {
    // A huge limit is clamped instead of returning the whole table.
    expect(await list(`'campus-kicks', p_limit => 100000`)).toHaveLength(4);
  });

  it('returns nothing for a draft storefront', async () => {
    const draftOwner = await createUser(db, 'drafty@example.com');
    const draft = (
      await rowsAs<{ id: string }>(db, draftOwner, `insert into public.businesses (name, business_type) values ('Draft Store', 'products') returning id`)
    )[0]!.id;
    await affectedAs(db, draftOwner, `insert into public.catalogue_items (business_id, item_type, title, price_mode) values ($1, 'product', 'Hidden', 'contact')`, [draft]);
    expect(await list(`'draft-store'`)).toHaveLength(0);
  });
});

describe('get_storefront_item', () => {
  it('returns a published item with all images in order', async () => {
    const rows = await rowsAs<{ i: { title: string; category_name: string; images: Array<{ path: string }> } }>(
      db, 'anon', `select public.get_storefront_item('campus-kicks', 'air-max-90') as i`,
    );
    const item = rows[0]!.i;
    expect(item.title).toBe('Air Max 90');
    expect(item.category_name).toBe('Shoes');
    expect(item.images.map((im) => im.path.split('/').pop())).toEqual(['img-0.webp', 'img-1.webp']);
  });

  it('returns null for unpublished items', async () => {
    const rows = await rowsAs<{ i: unknown }>(db, 'anon', `select public.get_storefront_item('campus-kicks', 'unreleased-colourway') as i`);
    expect(rows[0]?.i).toBeNull();
  });
});

describe('appearance options stay in sync with the frontend config', () => {
  it('accepts every configured theme and accent colour', async () => {
    for (const theme of STOREFRONT_THEMES) {
      expect(await affectedAs(db, owner, `update public.businesses set theme_id = $1 where id = $2`, [theme.id, bizId])).toBe(1);
    }
    for (const accent of ACCENT_COLORS) {
      expect(await affectedAs(db, owner, `update public.businesses set accent_color = $1 where id = $2`, [accent.id, bizId])).toBe(1);
    }
  });

  it('rejects unknown values', async () => {
    await expect(affectedAs(db, owner, `update public.businesses set theme_id = 'neon' where id = $1`, [bizId])).rejects.toThrow(/check constraint/);
    await expect(affectedAs(db, owner, `update public.businesses set accent_color = '#ff00ff' where id = $1`, [bizId])).rejects.toThrow(/check constraint/);
  });
});
