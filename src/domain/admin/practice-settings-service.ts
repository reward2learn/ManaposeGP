import type { DbClient } from '@/lib/db';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PracticeSettingsData {
  practiceName: string | null;
  timezone: string;
  openingHours: Record<string, { open: string; close: string }>;
  defaultAppointmentDuration: number;
  bulkBillDefault: boolean;
  defaultFeeCents: number;
  autoVerifyGps: boolean;
}

// ── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_PRACTICE_SETTINGS: PracticeSettingsData = {
  practiceName: null,
  timezone: 'Australia/Adelaide',
  openingHours: {
    monday: { open: '08:00', close: '17:00' },
    tuesday: { open: '08:00', close: '17:00' },
    wednesday: { open: '08:00', close: '17:00' },
    thursday: { open: '08:00', close: '17:00' },
    friday: { open: '08:00', close: '17:00' },
  },
  defaultAppointmentDuration: 15,
  bulkBillDefault: true,
  defaultFeeCents: 8500,
  autoVerifyGps: false,
};

// ── Public API ─────────────────────────────────────────────────────────────

export async function getPracticeSettings(db: DbClient): Promise<PracticeSettingsData> {
  const row = await db.practiceSettings.findUnique({ where: { id: 'default' } });
  if (!row) {
    // Auto-create with defaults
    await db.practiceSettings.create({
      data: {
        id: 'default',
        practiceName: null,
        timezone: DEFAULT_PRACTICE_SETTINGS.timezone,
        openingHours: DEFAULT_PRACTICE_SETTINGS.openingHours as unknown as Parameters<typeof db.practiceSettings.create>[0]['data']['openingHours'],
        defaultAppointmentDuration: DEFAULT_PRACTICE_SETTINGS.defaultAppointmentDuration,
        bulkBillDefault: DEFAULT_PRACTICE_SETTINGS.bulkBillDefault,
        defaultFeeCents: DEFAULT_PRACTICE_SETTINGS.defaultFeeCents,
        autoVerifyGps: DEFAULT_PRACTICE_SETTINGS.autoVerifyGps,
      },
    });
    return DEFAULT_PRACTICE_SETTINGS;
  }

  return {
    practiceName: row.practiceName,
    timezone: row.timezone,
    openingHours: (row.openingHours as Record<string, { open: string; close: string }>) ?? DEFAULT_PRACTICE_SETTINGS.openingHours,
    defaultAppointmentDuration: row.defaultAppointmentDuration,
    bulkBillDefault: row.bulkBillDefault,
    defaultFeeCents: row.defaultFeeCents,
    autoVerifyGps: row.autoVerifyGps,
  };
}

export async function updatePracticeSettings(
  db: DbClient,
  data: Partial<PracticeSettingsData>,
): Promise<PracticeSettingsData> {
  const updateData: Record<string, unknown> = {};
  if (data.practiceName !== undefined) updateData.practiceName = data.practiceName;
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.openingHours !== undefined) updateData.openingHours = data.openingHours;
  if (data.defaultAppointmentDuration !== undefined) updateData.defaultAppointmentDuration = data.defaultAppointmentDuration;
  if (data.bulkBillDefault !== undefined) updateData.bulkBillDefault = data.bulkBillDefault;
  if (data.defaultFeeCents !== undefined) updateData.defaultFeeCents = data.defaultFeeCents;
  if (data.autoVerifyGps !== undefined) updateData.autoVerifyGps = data.autoVerifyGps;

  await db.practiceSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...updateData },
    update: updateData,
  });

  return getPracticeSettings(db);
}
