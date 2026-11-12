import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { affectedAs, as, createTestDatabase, createUser, rowsAs, type TestUser } from './harness';

let db: PGlite;
let alice: TestUser; // owns a published storefront
let bob: TestUser; // owns a draft storefront
let aliceBiz: string;
let bobBiz: string;
let aliceCategory: string;
let alicePublishedItem: string;
let aliceHiddenItem: string;
let bobItem: string;

beforeAll(async () => {
  db = await createTestDatabase();
  alice = await createUser(db, 'alice@example.com', 'Alice Wanjiru');
  bob = await createUser(db, 'bob@example.com', 'Bob Otieno');

  aliceBiz = await as(db, alice, async (tx) => {
    const r = await tx.query<{ id: string }>(
      `insert into public.businesses (name, business_type, whatsapp_number, status)
       values ('Alice Threads', 'products', '+254712345678', 'published') returning id`,
    );
    return r.rows[0]!.id;
  });
  bobBiz = await as(db, bob, async (tx) => {
    const r = await tx.query<{ id: string }>(
      `insert into public.businesses (name, business_type) values ('Bob Prints', 'services') returning id`,
    );
    return r.rows[0]!.id;
  });

  await as(db, alice, async (tx) => {
    aliceCategory = (
      await tx.query<{ id: string }>(
        `insert into public.categories (business_id, name) values ($1, 'Shoes') returning id`,
        [aliceBiz],
      )
    ).rows[0]!.id;
    alicePublishedItem = (
      await tx.query<{ id: string }>(
        `insert into public.catalogue_items (business_id, category_id, item_type, title, price, price_mode)
         values ($1, $2, 'product', 'Nike Air Max', 4500, 'fixed') returning id`,
        [aliceBiz, aliceCategory],
      )
    ).rows[0]!.id;
    aliceHiddenItem = (
      await tx.query<{ id: string }>(
        `insert into public.catalogue_items (business_id, item_type, title, price_mode, is_published)
         values ($1, 'product', 'Secret Drop', 'contact', false) returning id`,
        [aliceBiz],
      )
    ).rows[0]!.id;
  });
  bobItem = await as(db, bob, async (tx) => {
    return (
      await tx.query<{ id: string }>(
        `insert into public.catalogue_items (business_id, item_type, title, price_mode)
         values ($1, 'service', 'Poster design', 'quote') returning id`,
        [bobBiz],
      )
    ).rows[0]!.id;
  });
});

afterAll(async () => {
  await db.close();
});

describe('profiles', () => {
  it('are created automatically on signup with the supplied name', async () => {
    const rows = await rowsAs<{ full_name: string; plan_id: string }>(
      db, alice, `select full_name, plan_id from public.profiles where id = $1`, [alice.id],
    );
    expect(rows).toEqual([{ full_name: 'Alice Wanjiru', plan_id: 'free' }]);
  });

  it('are private to their owner', async () => {
    const rows = await rowsAs(db, bob, `select id from public.profiles where id = $1`, [alice.id]);
    expect(rows).toHaveLength(0);
    await expect(rowsAs(db, 'anon', `select id from public.profiles`)).rejects.toThrow(/permission denied/);
  });

  it('allow changing the name but not the plan', async () => {
    expect(await affectedAs(db, alice, `update public.profiles set full_name = 'Alice W.' where id = $1`, [alice.id])).toBe(1);
    await expect(
      affectedAs(db, alice, `update public.profiles set plan_id = 'free' where id = $1`, [alice.id]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('businesses', () => {
  it('derive owner_id from the session, ignoring client input', async () => {
    const rows = await rowsAs<{ owner_id: string }>(db, alice, `select owner_id from public.businesses where id = $1`, [aliceBiz]);
    expect(rows[0]?.owner_id).toBe(alice.id);

    // Bob tries to create a business on Alice's behalf: blocked by the plan limit
    // trigger running for *Bob* (owner forced to auth.uid()), never assigned to Alice.
    const extra = await createUser(db, 'carol@example.com');
    const created = await rowsAs<{ owner_id: string }>(
      db, extra,
      `insert into public.businesses (owner_id, name, business_type) values ($1, 'Spoofed', 'products') returning owner_id`,
      [alice.id],
    );
    expect(created[0]?.owner_id).toBe(extra.id);
  });

  it('cannot be reassigned to another owner', async () => {
    await affectedAs(db, alice, `update public.businesses set owner_id = $1 where id = $2`, [bob.id, aliceBiz]);
    const rows = await rowsAs<{ owner_id: string }>(db, alice, `select owner_id from public.businesses where id = $1`, [aliceBiz]);
    expect(rows[0]?.owner_id).toBe(alice.id);
  });

  it('owners can read their own drafts', async () => {
    const rows = await rowsAs<{ id: string; status: string }>(db, bob, `select id, status from public.businesses`);
    expect(rows.map((r) => r.id)).toContain(bobBiz);
    expect(rows.find((r) => r.id === bobBiz)?.status).toBe('draft');
  });

  it('other users cannot read drafts', async () => {
    const rows = await rowsAs(db, alice, `select id from public.businesses where id = $1`, [bobBiz]);
    expect(rows).toHaveLength(0);
  });

  it('anonymous visitors only see published businesses', async () => {
    const rows = await rowsAs<{ id: string }>(db, 'anon', `select id, name, slug from public.businesses`);
    expect(rows.map((r) => r.id)).toEqual([aliceBiz]);
  });

  it('anonymous visitors cannot read private columns', async () => {
    await expect(rowsAs(db, 'anon', `select owner_id from public.businesses`)).rejects.toThrow(/permission denied/);
    await expect(rowsAs(db, 'anon', `select * from public.businesses`)).rejects.toThrow(/permission denied/);
    await expect(rowsAs(db, 'anon', `select onboarding_step from public.businesses`)).rejects.toThrow(/permission denied/);
  });

  it('other users cannot update or delete someone else’s business', async () => {
    expect(await affectedAs(db, bob, `update public.businesses set name = 'Hacked' where id = $1`, [aliceBiz])).toBe(0);
    expect(await affectedAs(db, bob, `delete from public.businesses where id = $1`, [aliceBiz])).toBe(0);
    const rows = await rowsAs<{ name: string }>(db, alice, `select name from public.businesses where id = $1`, [aliceBiz]);
    expect(rows[0]?.name).toBe('Alice Threads');
  });

  it('anonymous visitors cannot write', async () => {
    await expect(
      affectedAs(db, 'anon', `insert into public.businesses (name, business_type) values ('Anon', 'products')`),
    ).rejects.toThrow(/permission denied/);
    await expect(affectedAs(db, 'anon', `update public.businesses set name = 'x'`)).rejects.toThrow(/permission denied/);
    await expect(affectedAs(db, 'anon', `delete from public.businesses`)).rejects.toThrow(/permission denied/);
  });

  it('unpublishing hides a storefront from the public immediately', async () => {
    await affectedAs(db, alice, `update public.businesses set status = 'unpublished' where id = $1`, [aliceBiz]);
    expect(await rowsAs(db, 'anon', `select id from public.businesses where id = $1`, [aliceBiz])).toHaveLength(0);
    expect(await rowsAs(db, 'anon', `select id from public.catalogue_items where business_id = $1`, [aliceBiz])).toHaveLength(0);
    await affectedAs(db, alice, `update public.businesses set status = 'published' where id = $1`, [aliceBiz]);
    expect(await rowsAs(db, 'anon', `select id from public.businesses where id = $1`, [aliceBiz])).toHaveLength(1);
  });
});

describe('categories', () => {
  it('only the owner can create categories', async () => {
    await expect(
      affectedAs(db, bob, `insert into public.categories (business_id, name) values ($1, 'Injected')`, [aliceBiz]),
    ).rejects.toThrow(/row-level security/);
  });

  it('other users cannot rename or delete categories', async () => {
    expect(await affectedAs(db, bob, `update public.categories set name = 'x' where id = $1`, [aliceCategory])).toBe(0);
    expect(await affectedAs(db, bob, `delete from public.categories where id = $1`, [aliceCategory])).toBe(0);
  });

  it('are public only for published storefronts', async () => {
    expect(await rowsAs(db, 'anon', `select id, name from public.categories where business_id = $1`, [aliceBiz])).toHaveLength(1);
    await as(db, bob, (tx) => tx.query(`insert into public.categories (business_id, name) values ($1, 'Posters')`, [bobBiz]));
    expect(await rowsAs(db, 'anon', `select id, name from public.categories where business_id = $1`, [bobBiz])).toHaveLength(0);
  });

  it('names are unique per business, case-insensitively', async () => {
    await expect(
      affectedAs(db, alice, `insert into public.categories (business_id, name) values ($1, ' shoes ')`, [aliceBiz]),
    ).rejects.toThrow(/duplicate key/);
  });

  it('deleting a category keeps its items (moved to uncategorised)', async () => {
    const tempCategory = (
      await rowsAs<{ id: string }>(db, alice, `insert into public.categories (business_id, name) values ($1, 'Temp') returning id`, [aliceBiz])
    )[0]!.id;
    const item = (
      await rowsAs<{ id: string }>(
        db, alice,
        `insert into public.catalogue_items (business_id, category_id, item_type, title, price_mode) values ($1, $2, 'product', 'Temp item', 'contact') returning id`,
        [aliceBiz, tempCategory],
      )
    )[0]!.id;
    await affectedAs(db, alice, `delete from public.categories where id = $1`, [tempCategory]);
    const rows = await rowsAs<{ category_id: string | null }>(db, alice, `select category_id from public.catalogue_items where id = $1`, [item]);
    expect(rows).toEqual([{ category_id: null }]);
    await affectedAs(db, alice, `delete from public.catalogue_items where id = $1`, [item]);
  });
});

describe('catalogue items', () => {
  it('anonymous visitors see published items of published businesses only', async () => {
    const rows = await rowsAs<{ id: string }>(db, 'anon', `select id from public.catalogue_items`);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(alicePublishedItem);
    expect(ids).not.toContain(aliceHiddenItem); // unpublished item
    expect(ids).not.toContain(bobItem); // draft business
  });

  it('other signed-in users cannot see unpublished items or draft catalogues', async () => {
    const rows = await rowsAs<{ id: string }>(db, bob, `select id from public.catalogue_items where business_id = $1`, [aliceBiz]);
    expect(rows.map((r) => r.id)).toEqual([alicePublishedItem]);
    const drafts = await rowsAs(db, alice, `select id from public.catalogue_items where business_id = $1`, [bobBiz]);
    expect(drafts).toHaveLength(0);
  });

  it('owners see all of their items', async () => {
    const rows = await rowsAs<{ id: string }>(db, alice, `select id from public.catalogue_items where business_id = $1`, [aliceBiz]);
    expect(rows.map((r) => r.id).sort()).toEqual([alicePublishedItem, aliceHiddenItem].sort());
  });

  it('other users cannot create, edit or delete items in someone else’s business', async () => {
    await expect(
      affectedAs(db, bob, `insert into public.catalogue_items (business_id, item_type, title, price_mode) values ($1, 'product', 'x', 'contact')`, [aliceBiz]),
    ).rejects.toThrow(/row-level security/);
    expect(await affectedAs(db, bob, `update public.catalogue_items set title = 'x' where id = $1`, [alicePublishedItem])).toBe(0);
    expect(await affectedAs(db, bob, `delete from public.catalogue_items where id = $1`, [alicePublishedItem])).toBe(0);
  });

  it('cannot be moved to another business', async () => {
    await affectedAs(db, alice, `update public.catalogue_items set business_id = $1 where id = $2`, [bobBiz, alicePublishedItem]);
    const rows = await rowsAs<{ business_id: string }>(db, alice, `select business_id from public.catalogue_items where id = $1`, [alicePublishedItem]);
    expect(rows[0]?.business_id).toBe(aliceBiz);
  });

  it('cannot reference a category from another business', async () => {
    const bobCategory = (
      await rowsAs<{ id: string }>(db, bob, `select id from public.categories where business_id = $1`, [bobBiz])
    )[0]!.id;
    await expect(
      affectedAs(db, alice, `update public.catalogue_items set category_id = $1 where id = $2`, [bobCategory, alicePublishedItem]),
    ).rejects.toThrow(/foreign key/);
  });

  it('get a stable, unique slug per business', async () => {
    const rows = await rowsAs<{ slug: string }>(
      db, alice,
      `insert into public.catalogue_items (business_id, item_type, title, price, price_mode)
       values ($1, 'product', 'Nike Air Max!', 4000, 'fixed') returning slug`,
      [aliceBiz],
    );
    expect(rows[0]?.slug).toBe('nike-air-max-2');
    const original = await rowsAs<{ slug: string }>(db, alice, `select slug from public.catalogue_items where id = $1`, [alicePublishedItem]);
    expect(original[0]?.slug).toBe('nike-air-max');
    // Renaming keeps the slug so shared links keep working.
    await affectedAs(db, alice, `update public.catalogue_items set title = 'Nike Air Max 90' where id = $1`, [alicePublishedItem]);
    const renamed = await rowsAs<{ slug: string }>(db, alice, `select slug from public.catalogue_items where id = $1`, [alicePublishedItem]);
    expect(renamed[0]?.slug).toBe('nike-air-max');
  });

  it('require a price exactly when the price mode shows one', async () => {
    await expect(
      affectedAs(db, alice, `insert into public.catalogue_items (business_id, item_type, title, price_mode) values ($1, 'product', 'No price', 'fixed')`, [aliceBiz]),
    ).rejects.toThrow(/price_matches_mode/);
    await expect(
      affectedAs(db, alice, `insert into public.catalogue_items (business_id, item_type, title, price, price_mode) values ($1, 'service', 'Quote', 100, 'quote')`, [aliceBiz]),
    ).rejects.toThrow(/price_matches_mode/);
  });

  it('reject invalid enum values', async () => {
    await expect(
      affectedAs(db, alice, `insert into public.catalogue_items (business_id, item_type, title, price_mode) values ($1, 'weapon', 'x', 'contact')`, [aliceBiz]),
    ).rejects.toThrow(/check constraint/);
    await expect(
      affectedAs(db, alice, `update public.catalogue_items set availability_status = 'gone' where id = $1`, [alicePublishedItem]),
    ).rejects.toThrow(/check constraint/);
  });
});

describe('catalogue images', () => {
  let imagePath: string;

  it('must be stored under the owner’s item folder', async () => {
    imagePath = `${alice.id}/${aliceBiz}/${alicePublishedItem}/11111111-1111-4111-8111-111111111111.webp`;
    await as(db, alice, (tx) =>
      tx.query(
        `insert into public.catalogue_images (business_id, item_id, storage_path, thumb_path, width, height) values ($1, $2, $3, $4, 1200, 1200)`,
        [aliceBiz, alicePublishedItem, imagePath, imagePath.replace('.webp', '-thumb.webp')],
      ),
    );
    await expect(
      affectedAs(
        db, alice,
        `insert into public.catalogue_images (business_id, item_id, storage_path) values ($1, $2, $3)`,
        [aliceBiz, alicePublishedItem, `${bob.id}/${bobBiz}/${bobItem}/x.webp`],
      ),
    ).rejects.toThrow(/INVALID_MEDIA_PATH/);
  });

  it('cannot be attached to another user’s item', async () => {
    await expect(
      affectedAs(
        db, alice,
        `insert into public.catalogue_images (business_id, item_id, storage_path) values ($1, $2, $3)`,
        [bobBiz, bobItem, `${alice.id}/${bobBiz}/${bobItem}/x.webp`],
      ),
    ).rejects.toThrow(/INVALID_MEDIA_PATH|row-level security/);
    // Mixing the caller's business with another business's item violates the composite FK.
    await expect(
      affectedAs(
        db, alice,
        `insert into public.catalogue_images (business_id, item_id, storage_path) values ($1, $2, $3)`,
        [aliceBiz, bobItem, `${alice.id}/${aliceBiz}/${bobItem}/y.webp`],
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it('are public only for public items', async () => {
    const hiddenPath = `${alice.id}/${aliceBiz}/${aliceHiddenItem}/22222222-2222-4222-8222-222222222222.webp`;
    await as(db, alice, (tx) =>
      tx.query(`insert into public.catalogue_images (business_id, item_id, storage_path) values ($1, $2, $3)`, [aliceBiz, aliceHiddenItem, hiddenPath]),
    );
    const rows = await rowsAs<{ storage_path: string }>(db, 'anon', `select storage_path from public.catalogue_images`);
    expect(rows.map((r) => r.storage_path)).toEqual([imagePath]);
  });

  it('other users cannot delete or modify them', async () => {
    expect(await affectedAs(db, bob, `delete from public.catalogue_images where business_id = $1`, [aliceBiz])).toBe(0);
    expect(await affectedAs(db, bob, `update public.catalogue_images set alt_text = 'x' where business_id = $1`, [aliceBiz])).toBe(0);
  });

  it('enforce the per-item image limit from the plan', async () => {
    const item = (
      await rowsAs<{ id: string }>(
        db, alice,
        `insert into public.catalogue_items (business_id, item_type, title, price_mode) values ($1, 'portfolio', 'Gallery', 'none') returning id`,
        [aliceBiz],
      )
    )[0]!.id;
    const insertImage = (n: number) =>
      affectedAs(
        db, alice,
        `insert into public.catalogue_images (business_id, item_id, storage_path, sort_order) values ($1, $2, $3, $4)`,
        [aliceBiz, item, `${alice.id}/${aliceBiz}/${item}/img-${n}.webp`, n],
      );
    for (let n = 0; n < 8; n++) await insertImage(n);
    await expect(insertImage(8)).rejects.toThrow(/PLAN_LIMIT_IMAGES/);
  });
});

describe('plan limits', () => {
  it('free accounts can own one business', async () => {
    await expect(
      affectedAs(db, alice, `insert into public.businesses (name, business_type) values ('Second shop', 'products')`),
    ).rejects.toThrow(/PLAN_LIMIT_BUSINESSES/);
  });

  it('limit the number of published storefronts', async () => {
    await db.exec(`insert into public.plans (id, name, max_businesses, max_published_businesses, max_items_per_business, max_images_per_item)
                   values ('test_multi', 'Multi', 3, 1, 10, 4)`);
    const dave = await createUser(db, 'dave@example.com');
    await db.query(`update public.profiles set plan_id = 'test_multi' where id = $1`, [dave.id]);
    await affectedAs(db, dave, `insert into public.businesses (name, business_type, status) values ('Dave One', 'products', 'published')`);
    const second = (
      await rowsAs<{ id: string }>(db, dave, `insert into public.businesses (name, business_type) values ('Dave Two', 'products') returning id`)
    )[0]!.id;
    await expect(
      affectedAs(db, dave, `update public.businesses set status = 'published' where id = $1`, [second]),
    ).rejects.toThrow(/PLAN_LIMIT_PUBLISHED/);
  });

  it('limit the number of items per business', async () => {
    const erin = await createUser(db, 'erin@example.com');
    await db.query(`update public.profiles set plan_id = 'test_multi' where id = $1`, [erin.id]);
    const biz = (
      await rowsAs<{ id: string }>(db, erin, `insert into public.businesses (name, business_type) values ('Erin Bakes', 'products') returning id`)
    )[0]!.id;
    for (let n = 0; n < 10; n++) {
      await affectedAs(db, erin, `insert into public.catalogue_items (business_id, item_type, title, price_mode) values ($1, 'product', $2, 'contact')`, [biz, `Cake ${n}`]);
    }
    await expect(
      affectedAs(db, erin, `insert into public.catalogue_items (business_id, item_type, title, price_mode) values ($1, 'product', 'One too many', 'contact')`, [biz]),
    ).rejects.toThrow(/PLAN_LIMIT_ITEMS/);
  });
});

describe('reorder helpers', () => {
  it('only reorder the caller’s own rows', async () => {
    const before = await rowsAs<{ sort_order: number }>(db, alice, `select sort_order from public.catalogue_items where id = $1`, [alicePublishedItem]);
    await as(db, bob, (tx) => tx.query(`select public.reorder_items($1, $2)`, [aliceBiz, [aliceHiddenItem, alicePublishedItem]]));
    const after = await rowsAs<{ sort_order: number }>(db, alice, `select sort_order from public.catalogue_items where id = $1`, [alicePublishedItem]);
    expect(after).toEqual(before);

    await as(db, alice, (tx) => tx.query(`select public.reorder_items($1, $2)`, [aliceBiz, [aliceHiddenItem, alicePublishedItem]]));
    const mine = await rowsAs<{ id: string; sort_order: number }>(
      db, alice, `select id, sort_order from public.catalogue_items where id = any($1) order by sort_order`, [[aliceHiddenItem, alicePublishedItem]],
    );
    expect(mine.map((r) => r.id)).toEqual([aliceHiddenItem, alicePublishedItem]);
  });

  it('are not available to anonymous visitors', async () => {
    await expect(rowsAs(db, 'anon', `select public.reorder_items($1, $2)`, [aliceBiz, []])).rejects.toThrow(/permission denied/);
  });
});

describe('account deletion', () => {
  it('deletes only the caller and cascades to their data', async () => {
    const frank = await createUser(db, 'frank@example.com');
    const biz = (
      await rowsAs<{ id: string }>(db, frank, `insert into public.businesses (name, business_type) values ('Frank Fixes', 'services') returning id`)
    )[0]!.id;
    await affectedAs(db, frank, `insert into public.catalogue_items (business_id, item_type, title, price_mode) values ($1, 'service', 'Phone repair', 'quote')`, [biz]);

    const justNow = Math.floor(Date.now() / 1000) - 30;
    await as(db, frank, (tx) => tx.query(`select public.delete_my_account()`), { amr: [{ method: 'password', timestamp: justNow }] });

    const users = await db.query(`select id from auth.users where id = $1`, [frank.id]);
    expect(users.rows).toHaveLength(0);
    const businesses = await db.query(`select id from public.businesses where id = $1`, [biz]);
    expect(businesses.rows).toHaveLength(0);
    const items = await db.query(`select id from public.catalogue_items where business_id = $1`, [biz]);
    expect(items.rows).toHaveLength(0);
    // Everyone else is untouched.
    expect((await db.query(`select id from auth.users where id = $1`, [alice.id])).rows).toHaveLength(1);
  });

  it('cannot be called anonymously', async () => {
    await expect(rowsAs(db, 'anon', `select public.delete_my_account()`)).rejects.toThrow(/permission denied/);
  });

  it('requires a recent sign-in (password or Google), not just any session', async () => {
    const grace = await createUser(db, 'grace@example.com');
    const deleteWith = (claims: Record<string, unknown>) => as(db, grace, (tx) => tx.query(`select public.delete_my_account()`), claims);
    await expect(deleteWith({})).rejects.toThrow(/REAUTHENTICATION_REQUIRED/);
    const anHourAgo = Math.floor(Date.now() / 1000) - 3600;
    await expect(deleteWith({ amr: [{ method: 'oauth', timestamp: anHourAgo }] })).rejects.toThrow(/REAUTHENTICATION_REQUIRED/);
    expect((await db.query(`select id from auth.users where id = $1`, [grace.id])).rows).toHaveLength(1);
    await deleteWith({ amr: [{ method: 'oauth', timestamp: Math.floor(Date.now() / 1000) - 60 }] });
    expect((await db.query(`select id from auth.users where id = $1`, [grace.id])).rows).toHaveLength(0);
  });
});
