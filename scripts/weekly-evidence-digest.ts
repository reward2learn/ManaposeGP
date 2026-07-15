/**
 * Weekly Evidence Digest — cron-compatible script
 *
 * Fetches the latest menopause research from PubMed, summarizes articles
 * using GPT-4o, and saves them to the `medical_references` table.
 *
 * Usage:
 *   bun run scripts/weekly-evidence-digest.ts
 *
 * Requires: POSTGRES_URL, OPENAI_API_KEY (env or DB secrets)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '../src/lib/db.js';
import { generateWeeklyDigest } from '../src/domain/health/evidence-digest-service.js';

// ── Env loading ───────────────────────────────────────────────────────────────

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadEnvLocal();

  const dbUrl = process.env.POSTGRES_URL;
  if (!dbUrl) {
    throw new Error('POSTGRES_URL is not set');
  }
  console.log('[weekly-evidence-digest] POSTGRES_URL found');

  // Use ZenStack-enhanced client with pin tier for write access
  const db = createClient({ tier: 'pin' });

  try {
    console.log('[weekly-evidence-digest] Starting weekly evidence digest generation...');
    const { digest, savedCount } = await generateWeeklyDigest(db);

    console.log(`[weekly-evidence-digest] Found ${digest.length} articles from PubMed`);
    console.log(`[weekly-evidence-digest] Saved ${savedCount} new entries to medical_references`);

    if (digest.length > 0) {
      console.log('\n[weekly-evidence-digest] Digest entries:');
      for (const entry of digest) {
        console.log(`  • PMID ${entry.pmid}: ${entry.title.slice(0, 100)}`);
        console.log(`    Evidence: ${entry.evidenceStrength} | ${entry.pubDate}`);
        console.log(`    Key: ${entry.keyFindings.slice(0, 120)}...`);
        console.log('');
      }
    }

    console.log('[weekly-evidence-digest] Done.');
  } catch (err) {
    console.error('[weekly-evidence-digest] Fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[weekly-evidence-digest] Unhandled error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
