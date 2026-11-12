import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createTestDatabase } from './harness';

/**
 * Executes supabase/tests/database/rls.test.sql on PGlite using minimal
 * stand-ins for the pgTAP functions it calls, so the pgTAP suite is known to be
 * correct before it is run against a real stack with `supabase test db`.
 */
const PGTAP_SHIM = /* sql */ `
  create schema if not exists extensions;
  create table public._tap (n serial, ok boolean, description text, detail text);
  grant all on public._tap to anon, authenticated;
  grant usage, select on sequence public._tap_n_seq to anon, authenticated;

  create function public._tap_record(ok boolean, description text, detail text default null) returns text
  language plpgsql security definer as $$
  begin
    insert into public._tap (ok, description, detail) values (ok, description, detail);
    return case when ok then 'ok - ' else 'not ok - ' end || description;
  end $$;

  create function public.plan(n int) returns text language sql as $$ select '1..' || n $$;
  create function public.finish() returns setof text language sql as $$ select 'done'::text $$;

  create function public.is(have anyelement, want anyelement, description text) returns text
  language sql as $$ select public._tap_record(have is not distinct from want, description, format('have %s, want %s', have, want)) $$;

  create function public.results_eq(have_sql text, want_sql text, description text) returns text
  language plpgsql as $$
  declare have text[]; want text[];
  begin
    execute format('select coalesce(array_agg(t::text order by t::text), ''{}'') from (%s) t', have_sql) into have;
    execute format('select coalesce(array_agg(t::text order by t::text), ''{}'') from (%s) t', want_sql) into want;
    return public._tap_record(have = want, description, format('have %s, want %s', have, want));
  end $$;

  create function public.throws_ok(sql text, errcode text, errmsg text, description text) returns text
  language plpgsql as $$
  begin
    execute sql;
    return public._tap_record(false, description, 'no exception');
  exception when others then
    return public._tap_record(sqlstate = errcode and (errmsg is null or sqlerrm = errmsg), description, sqlstate || ': ' || sqlerrm);
  end $$;

  create function public.lives_ok(sql text, description text) returns text
  language plpgsql as $$
  begin
    execute sql;
    return public._tap_record(true, description);
  exception when others then
    return public._tap_record(false, description, sqlstate || ': ' || sqlerrm);
  end $$;

  grant execute on function public._tap_record(boolean, text, text), public.plan(int), public.finish(),
    public.is(anyelement, anyelement, text), public.results_eq(text, text, text),
    public.throws_ok(text, text, text, text), public.lives_ok(text, text)
    to anon, authenticated;
`;

describe('supabase/tests/database/rls.test.sql', () => {
  it('passes every assertion', async () => {
    const db = await createTestDatabase();
    await db.exec(PGTAP_SHIM);
    const sql = readFileSync('supabase/tests/database/rls.test.sql', 'utf8')
      .replace(/create extension if not exists pgtap[^;]*;/, '')
      // Keep the recorded results instead of rolling them back.
      .replace(/rollback;\s*$/, 'commit;');
    await db.exec(sql);

    const results = await db.query<{ ok: boolean; description: string; detail: string | null }>('select ok, description, detail from public._tap order by n');
    const planned = Number(/select plan\((\d+)\)/.exec(sql)?.[1]);
    expect(results.rows).toHaveLength(planned);
    expect(results.rows.filter((r) => !r.ok)).toEqual([]);
    await db.close();
  });
});
