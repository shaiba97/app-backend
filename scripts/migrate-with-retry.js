/**
 * Runs `prisma migrate deploy` with retries.
 *
 * Multiple Render services share ONE Neon database, so two booting instances
 * can race for the same migration advisory lock. Prisma gives up after ~10s;
 * this wrapper keeps trying well past that so deploys survive lock contention
 * and slow pooler connections instead of failing the whole deploy.
 *
 * Additionally, migrations are ALWAYS pointed at the DIRECT (non-pooled)
 * Neon host: session-level advisory locks hang over PgBouncer transaction
 * pooling (see prisma.config.ts resolveDirectUrl for the same rule).
 *
 * Neon's serverless compute also suspends when idle; the first connection is
 * warm-up-pinged so Prisma's 10s advisory-lock timeout never hits a cold
 * start.
 */
const { spawnSync } = require('child_process');
const { Client } = require('pg');

const SCHEMA = 'libs/prisma/schema.prisma';
const MAX_ATTEMPTS = 5;
const BACKOFF_MS = 15000;
const WARMUP_MAX_ATTEMPTS = 10;
const WARMUP_INTERVAL_MS = 3000;

function stripWrappingQuotes(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function deriveDirectUrl(url) {
  if (!url) return url;
  const explicitRaw =
    process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DIRECT_URL'];
  if (explicitRaw) return stripWrappingQuotes(explicitRaw);
  return stripWrappingQuotes(url).replace(/-pooler\./, '.');
}

function mask(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username}:***@${u.hostname}${u.pathname}`;
  } catch {
    return '(unparseable db url)';
  }
}

async function warmUpNeon(url) {
  console.log('[migrate] waking Neon compute…');
  for (let i = 1; i <= WARMUP_MAX_ATTEMPTS; i++) {
    const client = new Client({
      connectionString: url,
      connectionTimeoutMillis: 15000,
      query_timeout: 10000,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log(`[migrate] DB ready after ${i} warm-up attempt(s)`);
      return;
    } catch (e) {
      await client.end().catch(() => {});
      if (i < WARMUP_MAX_ATTEMPTS) {
        console.log(
          `[migrate] warm-up attempt ${i}/${WARMUP_MAX_ATTEMPTS} failed: ${e.message} — retrying…`
        );
        await new Promise((r) => setTimeout(r, WARMUP_INTERVAL_MS));
      }
    }
  }
  console.warn('[migrate] Neon warm-up exhausted; proceeding anyway');
}

(async () => {
  const rawUrl = stripWrappingQuotes(process.env['DATABASE_URL']);
  if (!rawUrl) {
    console.error('[migrate] DATABASE_URL is not set');
    process.exit(1);
  }
  const directUrl = deriveDirectUrl(rawUrl);
  console.log(`[migrate] migrating against: ${mask(directUrl)}`);

  await warmUpNeon(directUrl);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[migrate] prisma migrate deploy — attempt ${attempt}/${MAX_ATTEMPTS}`);
    const r = spawnSync(
      'npx',
      ['prisma', 'migrate', 'deploy', `--schema=${SCHEMA}`],
      {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: directUrl },
      },
    );

    if (r.status === 0) {
      console.log('[migrate] deploy completed successfully');
      process.exit(0);
    }

    console.error(`[migrate] attempt ${attempt} failed (exit ${r.status})`);
    if (attempt < MAX_ATTEMPTS) {
      console.log(`[migrate] retrying in ${BACKOFF_MS / 1000}s…`);
      // Synchronous sleep — safe everywhere, blocks only this bootstrap step.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, BACKOFF_MS);
    }
  }

  console.error('[migrate] all attempts failed — deploy aborted');
  process.exit(1);
})();
