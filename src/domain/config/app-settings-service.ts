import type { DbClient } from '@/lib/db';

const APP_SETTINGS_ID = 'default';

const APP_SETTINGS_DDL = `
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  web_search_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  feature_flags JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;

const APP_SETTINGS_ALTER = `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}';`;

export interface AppSettingsDto {
  webSearchEnabled: boolean;
  updatedAt: Date;
}

export async function ensureAppSettingsTable(db: DbClient): Promise<void> {
  await db.$executeRawUnsafe(APP_SETTINGS_DDL);
  await db.$executeRawUnsafe(APP_SETTINGS_ALTER);
}

export async function getAppSettings(db: DbClient): Promise<AppSettingsDto> {
  try {
    const existing = await db.appSetting.findUnique({ where: { id: APP_SETTINGS_ID } });
    if (existing) {
      return {
        webSearchEnabled: existing.webSearchEnabled,
        updatedAt: existing.updatedAt,
      };
    }

    const created = await db.appSetting.create({
      data: { id: APP_SETTINGS_ID },
    });

    return {
      webSearchEnabled: created.webSearchEnabled,
      updatedAt: created.updatedAt,
    };
  } catch (err) {
    // Table might not exist — create it, then retry
    console.warn('[app-settings] Prisma query failed, creating table:', err instanceof Error ? err.message : err);
    try {
      await ensureAppSettingsTable(db);
      const created = await db.appSetting.create({
        data: { id: APP_SETTINGS_ID },
      });
      return {
        webSearchEnabled: created.webSearchEnabled,
        updatedAt: created.updatedAt,
      };
    } catch (err2) {
      // If even DDL fails, return safe defaults
      console.error('[app-settings] Fatal, returning defaults:', err2 instanceof Error ? err2.message : err2);
      return { webSearchEnabled: false, updatedAt: new Date() };
    }
  }
}

export async function updateAppSettings(
  db: DbClient,
  patch: { webSearchEnabled?: boolean },
): Promise<AppSettingsDto> {
  await ensureAppSettingsTable(db);

  const updated = await db.appSetting.upsert({
    where: { id: APP_SETTINGS_ID },
    create: {
      id: APP_SETTINGS_ID,
      webSearchEnabled: patch.webSearchEnabled ?? false,
    },
    update: {
      ...(patch.webSearchEnabled !== undefined ? { webSearchEnabled: patch.webSearchEnabled } : {}),
    },
  });

  return {
    webSearchEnabled: updated.webSearchEnabled,
    updatedAt: updated.updatedAt,
  };
}
