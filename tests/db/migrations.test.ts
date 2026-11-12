import { describe, expect, it } from 'vitest';
import { createTestDatabase, migrationFiles } from './harness';

describe('migrations', () => {
  it('apply cleanly to an empty database', async () => {
    const db = await createTestDatabase();
    const tables = await db.query<{ tablename: string; rowsecurity: boolean }>(
      `select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename`,
    );
    expect(tables.rows.map((t) => t.tablename)).toEqual([
      'businesses', 'catalogue_images', 'catalogue_items', 'categories', 'plans', 'profiles',
    ]);
    // RLS must be enabled on every exposed table.
    expect(tables.rows.every((t) => t.rowsecurity)).toBe(true);
    expect(migrationFiles().length).toBeGreaterThanOrEqual(5);
    await db.close();
  });
});

describe('advisor fixes', () => {
  it('removes API access to Supabase’s rls_auto_enable() when present', async () => {
    // Recreate what new Supabase projects ship: a SECURITY DEFINER event-trigger
    // function executable by the API roles.
    const db = await createTestDatabase({
      beforeMigrations: `
        create function public.rls_auto_enable() returns event_trigger language plpgsql security definer as $$ begin end $$;
        grant execute on function public.rls_auto_enable() to anon, authenticated;`,
    });
    const rows = await db.query<{ anon: boolean; authenticated: boolean }>(
      `select has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE') as anon,
              has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE') as authenticated`,
    );
    expect(rows.rows[0]).toEqual({ anon: false, authenticated: false });
    // The composite foreign key on catalogue_images is covered by an index.
    const idx = await db.query(`select 1 from pg_indexes where indexname = 'catalogue_images_business_item_idx'`);
    expect(idx.rows).toHaveLength(1);
    await db.close();
  });
});
