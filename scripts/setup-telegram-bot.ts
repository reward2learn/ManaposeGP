/**
 * Telegram Bot Setup — configures webhook for the ManaposeGP blog bot.
 *
 * Prerequisites:
 * 1. Create a bot via @BotFather on Telegram → get TELEGRAM_BOT_TOKEN
 * 2. Set NEXT_PUBLIC_APP_URL in .env.local (or use Vercel deployment URL)
 *
 * Usage:
 *   bun run scripts/setup-telegram-bot.ts
 *
 * This script:
 * - Stores TELEGRAM_BOT_TOKEN in the secrets table
 * - Sets the Telegram webhook to point to /api/telegram/webhook
 */
import { createClient } from '../src/lib/db.js';
import { setSecret } from '../src/lib/secrets.js';

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN not set in environment.');
    console.error('Create a bot at @BotFather on Telegram and set the token:');
    console.error('  export TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
    process.exit(1);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://manaposegp.vercel.app';
  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  // Step 1: Store token in secrets table
  try {
    await setSecret('TELEGRAM_BOT_TOKEN', token);
    console.log('[telegram-setup] Token stored in secrets table.');
  } catch (err) {
    console.warn('[telegram-setup] Could not store token in DB (DB might not be accessible):', err instanceof Error ? err.message : err);
    console.log('[telegram-setup] Using TELEGRAM_BOT_TOKEN from environment instead.');
  }

  // Step 2: Set webhook
  console.log(`[telegram-setup] Setting webhook to: ${webhookUrl}`);
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  });
  const result = await response.json() as { ok: boolean; description?: string };
  console.log('[telegram-setup] Webhook result:', JSON.stringify(result, null, 2));

  if (result.ok) {
    console.log('[telegram-setup] ✅ Bot is ready! Send a URL to your bot on Telegram.');
  } else {
    console.error('[telegram-setup] ❌ Webhook setup failed:', result.description);
  }

  // Step 3: Verify
  const infoResp = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = await infoResp.json() as { result: { url: string } };
  console.log('[telegram-setup] Current webhook:', info.result?.url || 'none');
}

main().catch((err) => {
  console.error('[telegram-setup] Fatal error:', err.message);
  process.exit(1);
});
