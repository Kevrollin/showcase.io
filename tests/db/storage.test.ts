import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { affectedAs, createTestDatabase, createUser, rowsAs, type TestUser } from './harness';

let db: PGlite;
let alice: TestUser;
let bob: TestUser;
let aliceBiz: string;
let aliceItem: string;
let bobBiz: string;

const IMAGE_ID = '33333333-3333-4333-8333-333333333333';

const upload = (actor: TestUser | 'anon', name: string) =>
  affectedAs(db, actor, `insert into storage.objects (bucket_id, name) values ('catalog-media', $1)`, [name]);

beforeAll(async () => {
  db = await createTestDatabase();
  alice = await createUser(db, 'alice@example.com');
  bob = await createUser(db, 'bob@example.com');
  aliceBiz = (await rowsAs<{ id: string }>(db, alice, `insert into public.businesses (name, business_type) values ('Alice Studio', 'portfolio') returning id`))[0]!.id;
  bobBiz = (await rowsAs<{ id: string }>(db, bob, `insert into public.businesses (name, business_type) values ('Bob Studio', 'portfolio') returning id`))[0]!.id;
  aliceItem = (
    await rowsAs<{ id: string }>(
      db, alice,
      `insert into public.catalogue_items (business_id, item_type, title, price_mode) values ($1, 'portfolio', 'Wedding shoot', 'none') returning id`,
      [aliceBiz],
    )
  )[0]!.id;
});

afterAll(async () => {
  await db.close();
});

describe('bucket', () => {
  it('is configured with a MIME allow-list and size limit', async () => {
    const rows = await db.query<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'catalog-media'`,
    );
    expect(rows.rows[0]).toEqual({
      public: true,
      file_size_limit: 2097152,
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
    });
  });
});

describe('uploads', () => {
  it('owners can upload brand images and item images into their own folders', async () => {
    expect(await upload(alice, `${alice.id}/${aliceBiz}/brand/logo-${IMAGE_ID}.webp`)).toBe(1);
    expect(await upload(alice, `${alice.id}/${aliceBiz}/${aliceItem}/${IMAGE_ID}.webp`)).toBe(1);
    expect(await upload(alice, `${alice.id}/${aliceBiz}/${aliceItem}/${IMAGE_ID}-thumb.webp`)).toBe(1);
  });

  it('rejects uploads into another user’s folder', async () => {
    await expect(upload(alice, `${bob.id}/${bobBiz}/brand/logo-${IMAGE_ID}.webp`)).rejects.toThrow(/row-level security/);
  });

  it('rejects uploads for a business the caller does not own, even inside their own folder', async () => {
    await expect(upload(alice, `${alice.id}/${bobBiz}/brand/logo-${IMAGE_ID}.webp`)).rejects.toThrow(/row-level security/);
  });

  it('rejects uploads for items that do not belong to the business', async () => {
    const randomItem = '44444444-4444-4444-8444-444444444444';
    await expect(upload(alice, `${alice.id}/${aliceBiz}/${randomItem}/${IMAGE_ID}.webp`)).rejects.toThrow(/row-level security/);
  });

  it('rejects unexpected paths and file types', async () => {
    const bad = [
      `${alice.id}/${aliceBiz}/brand/../../${bob.id}/x.webp`,
      `${alice.id}/${aliceBiz}/brand/logo.svg`,
      `${alice.id}/${aliceBiz}/brand/run.exe`,
      `${alice.id}/${aliceBiz}/brand/LOGO.WEBP`,
      `${alice.id}/${aliceBiz}/other/logo.webp`,
      `${alice.id}/logo.webp`,
      `not-a-uuid/${aliceBiz}/brand/logo.webp`,
    ];
    for (const name of bad) {
      await expect(upload(alice, name), name).rejects.toThrow(/row-level security/);
    }
  });

  it('rejects anonymous uploads', async () => {
    await expect(upload('anon', `${alice.id}/${aliceBiz}/brand/anon.webp`)).rejects.toThrow(/row-level security/);
  });
});

describe('reads and deletes', () => {
  it('other users cannot list or delete someone else’s objects', async () => {
    expect(await rowsAs(db, bob, `select name from storage.objects where name like $1`, [`${alice.id}/%`])).toHaveLength(0);
    expect(await affectedAs(db, bob, `delete from storage.objects where name like $1`, [`${alice.id}/%`])).toBe(0);
    expect(await affectedAs(db, bob, `update storage.objects set name = $1 where name like $2`, [`${bob.id}/stolen.webp`, `${alice.id}/%`])).toBe(0);
  });

  it('owners can still clean up files after the business row is gone', async () => {
    await affectedAs(db, alice, `delete from public.businesses where id = $1`, [aliceBiz]);
    expect(await rowsAs(db, alice, `select name from storage.objects where name like $1`, [`${alice.id}/%`])).toHaveLength(3);
    expect(await affectedAs(db, alice, `delete from storage.objects where name like $1`, [`${alice.id}/%`])).toBe(3);
  });
});
