/**
 * Runs the pgTAP security suite (supabase/tests/database/*.test.sql) against
 * the LINKED Supabase project without Docker, through `supabase db query`.
 *
 * Each file already runs inside BEGIN … ROLLBACK, so nothing is persisted
 * (test users, rows and the pgtap extension are all rolled back). Instead of
 * pgTAP's TAP output (the query endpoint returns only the last result set),
 * the script reads pgTAP's counters before the rollback.
 *
 * Usage:  npm run db:test:remote
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_DIR = 'supabase/tests/database';
const FINISH = /select \* from finish\(\);\s*rollback;\s*$/;
const SUMMARY = `select (xpath('//last_value/text()', query_to_xml('select last_value from __tresults___numb_seq', false, false, '')))[1]::text as tests_run,
       extensions.num_failed() as failed,
       (regexp_match(current_setting('server_version'), '^\\d+'))[1] as pg;
rollback;`;

const dir = mkdtempSync(join(tmpdir(), 'showcase-pgtap-'));
let failures = 0;
try {
  for (const name of readdirSync(TEST_DIR).filter((f) => f.endsWith('.test.sql')).sort()) {
    const source = readFileSync(join(TEST_DIR, name), 'utf8');
    if (!FINISH.test(source)) throw new Error(`${name} must end with "select * from finish(); rollback;"`);
    const planned = Number(/select plan\((\d+)\)/.exec(source)?.[1] ?? NaN);
    const file = join(dir, name);
    writeFileSync(file, source.replace(FINISH, SUMMARY));

    const result = spawnSync('npx', ['supabase', 'db', 'query', '--remote', '--yes', '--output-format', 'json', '-f', file], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    const json = result.stdout.slice(result.stdout.indexOf('{'));
    let row: { tests_run?: string; failed?: number | string } | undefined;
    try {
      row = (JSON.parse(json) as { rows?: Array<{ tests_run?: string; failed?: number | string }> }).rows?.[0];
    } catch {
      row = undefined;
    }
    const run = Number(row?.tests_run ?? NaN);
    const failed = Number(row?.failed ?? NaN);
    if (result.status !== 0 || Number.isNaN(run) || Number.isNaN(failed)) {
      failures++;
      console.log(`✗ ${name}: could not run\n${(result.stderr || result.stdout).slice(0, 800)}`);
    } else if (failed > 0 || run !== planned) {
      failures++;
      console.log(`✗ ${name}: ${failed} of ${run} assertions failed (planned ${planned})`);
    } else {
      console.log(`✓ ${name}: ${run}/${planned} assertions passed`);
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failures === 0 ? 0 : 1);
