import type { DbClient } from '@/lib/db';
import { ensureAppSettingsTable } from '@/domain/config/app-settings-service';

// ── Table DDL for tables that may be missing if migrations never ran ─────────

const ADMIN_TABLE_DDL = [
  `CREATE TABLE IF NOT EXISTS practice_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    practice_name TEXT,
    timezone TEXT NOT NULL DEFAULT 'Australia/Adelaide',
    opening_hours JSONB NOT NULL DEFAULT '{}',
    default_appointment_duration INT NOT NULL DEFAULT 15,
    bulk_bill_default BOOLEAN NOT NULL DEFAULT TRUE,
    default_fee_cents INT NOT NULL DEFAULT 8500,
    auto_verify_gps BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS appointment_types (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    default_duration INT NOT NULL DEFAULT 15,
    color TEXT NOT NULL DEFAULT '#2196F3',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS fee_schedule_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mbs_item_number TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'CONSULTATION',
    schedule_fee INT NOT NULL DEFAULT 0,
    practice_fee INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(mbs_item_number)
  )`,

  `CREATE TABLE IF NOT EXISTS provider_directory (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    provider_type TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    fax TEXT,
    email TEXT,
    website TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS notification_templates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    template_type TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_template TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'EMAIL',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

export async function ensureAdminTables(db: DbClient): Promise<void> {
  await ensureAppSettingsTable(db); // app_settings (also covers feature_flags)
  for (const ddl of ADMIN_TABLE_DDL) {
    await db.$executeRawUnsafe(ddl);
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface AppointmentTypeData {
  id?: string;
  name: string;
  description: string | null;
  defaultDuration: number;
  color: string;
  isActive: boolean;
}

export interface FeeScheduleItemData {
  id?: string;
  mbsItemNumber: string;
  description: string;
  category: string;
  scheduleFee: number;
  practiceFee: number;
  isActive: boolean;
}

export interface ProviderData {
  id?: string;
  providerType: string;
  name: string;
  address: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface NotificationTemplateData {
  id?: string;
  templateType: string;
  subject: string;
  bodyTemplate: string;
  channel: string;
  isActive: boolean;
}

// ── Appointment Types ──────────────────────────────────────────────────────

export async function getAppointmentTypes(db: DbClient): Promise<AppointmentTypeData[]> {
  const rows = await db.appointmentType.findMany({ orderBy: { sortOrder: 'asc' } });
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string, name: r.name as string,
    description: (r.description as string) ?? null,
    defaultDuration: (r.defaultDuration as number) ?? 15,
    color: (r.color as string) ?? '#2196F3',
    isActive: (r.isActive as boolean) ?? true,
  }));
}

export async function upsertAppointmentType(db: DbClient, data: AppointmentTypeData): Promise<AppointmentTypeData> {
  const rec = data.id
    ? await db.appointmentType.update({ where: { id: data.id }, data: { name: data.name, description: data.description, defaultDuration: data.defaultDuration, color: data.color, isActive: data.isActive } })
    : await db.appointmentType.create({ data: { name: data.name, description: data.description, defaultDuration: data.defaultDuration, color: data.color, isActive: data.isActive, sortOrder: 0 } });
  return { id: rec.id, name: rec.name, description: rec.description, defaultDuration: rec.defaultDuration, color: rec.color, isActive: rec.isActive };
}

export async function deleteAppointmentType(db: DbClient, id: string): Promise<void> {
  await db.appointmentType.delete({ where: { id } });
}

// ── Fee Schedule ───────────────────────────────────────────────────────────

export async function getFeeSchedule(db: DbClient): Promise<FeeScheduleItemData[]> {
  const rows = await db.feeScheduleItem.findMany({ orderBy: { category: 'asc' } });
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string, mbsItemNumber: r.mbsItemNumber as string,
    description: r.description as string, category: r.category as string,
    scheduleFee: (r.scheduleFee as number) ?? 0, practiceFee: (r.practiceFee as number) ?? 0,
    isActive: (r.isActive as boolean) ?? true,
  }));
}

export async function upsertFeeScheduleItem(db: DbClient, data: FeeScheduleItemData): Promise<FeeScheduleItemData> {
  const rec = data.id
    ? await db.feeScheduleItem.update({ where: { id: data.id }, data: { description: data.description, category: data.category, scheduleFee: data.scheduleFee, practiceFee: data.practiceFee, isActive: data.isActive } })
    : await db.feeScheduleItem.create({ data: { mbsItemNumber: data.mbsItemNumber, description: data.description, category: data.category, scheduleFee: data.scheduleFee, practiceFee: data.practiceFee, isActive: data.isActive } });
  return { id: rec.id, mbsItemNumber: rec.mbsItemNumber, description: rec.description, category: rec.category, scheduleFee: rec.scheduleFee, practiceFee: rec.practiceFee, isActive: rec.isActive };
}

export async function deleteFeeScheduleItem(db: DbClient, id: string): Promise<void> {
  await db.feeScheduleItem.delete({ where: { id } });
}

// ── Provider Directory ─────────────────────────────────────────────────────

export async function getProviders(db: DbClient, type?: string): Promise<ProviderData[]> {
  const where: Record<string, unknown> = {};
  if (type) where.providerType = type;
  const rows = await db.providerDirectory.findMany({ where, orderBy: { name: 'asc' } });
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string, providerType: r.providerType as string, name: r.name as string,
    address: (r.address as string) ?? null, phone: (r.phone as string) ?? null,
    fax: (r.fax as string) ?? null, email: (r.email as string) ?? null,
    website: (r.website as string) ?? null, isDefault: (r.isDefault as boolean) ?? false,
    isActive: (r.isActive as boolean) ?? true,
  }));
}

export async function upsertProvider(db: DbClient, data: ProviderData): Promise<ProviderData> {
  const rec = data.id
    ? await db.providerDirectory.update({ where: { id: data.id }, data: { name: data.name, providerType: data.providerType, address: data.address, phone: data.phone, fax: data.fax, email: data.email, website: data.website, isDefault: data.isDefault, isActive: data.isActive } })
    : await db.providerDirectory.create({ data: { providerType: data.providerType, name: data.name, address: data.address, phone: data.phone, fax: data.fax, email: data.email, website: data.website, isDefault: data.isDefault, isActive: data.isActive } });
  return { id: rec.id, providerType: rec.providerType, name: rec.name, address: rec.address, phone: rec.phone, fax: rec.fax, email: rec.email, website: rec.website, isDefault: rec.isDefault, isActive: rec.isActive };
}

export async function deleteProvider(db: DbClient, id: string): Promise<void> {
  await db.providerDirectory.delete({ where: { id } });
}

// ── Notification Templates ─────────────────────────────────────────────────

export async function getNotificationTemplates(db: DbClient): Promise<NotificationTemplateData[]> {
  const rows = await db.notificationTemplate.findMany({ orderBy: { templateType: 'asc' } });
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string, templateType: r.templateType as string,
    subject: r.subject as string, bodyTemplate: r.bodyTemplate as string,
    channel: r.channel as string, isActive: (r.isActive as boolean) ?? true,
  }));
}

export async function upsertNotificationTemplate(db: DbClient, data: NotificationTemplateData): Promise<NotificationTemplateData> {
  const rec = data.id
    ? await db.notificationTemplate.update({ where: { id: data.id }, data: { templateType: data.templateType, subject: data.subject, bodyTemplate: data.bodyTemplate, channel: data.channel, isActive: data.isActive } })
    : await db.notificationTemplate.create({ data: { templateType: data.templateType, subject: data.subject, bodyTemplate: data.bodyTemplate, channel: data.channel, isActive: data.isActive } });
  return { id: rec.id, templateType: rec.templateType, subject: rec.subject, bodyTemplate: rec.bodyTemplate, channel: rec.channel, isActive: rec.isActive };
}

// ── Platform Users ─────────────────────────────────────────────────────────

export async function getPlatformUsers(db: DbClient): Promise<Array<Record<string, unknown>>> {
  const rows = await db.platformUser.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id, email: r.email, name: r.name, tier: r.tier, isGp: r.isGp,
    role: r.role, status: r.status,
    lastLogin: r.lastLogin ? (r.lastLogin as Date).toISOString() : null,
    createdAt: (r.createdAt as Date).toISOString(),
  }));
}

export async function updateUser(db: DbClient, userId: string, data: { role?: string; tier?: string; status?: string }): Promise<Record<string, unknown>> {
  const rec = await db.platformUser.update({ where: { id: userId }, data });
  return { id: rec.id, email: rec.email, name: rec.name, tier: rec.tier, isGp: rec.isGp, role: rec.role, status: rec.status };
}

// ── Feature Flags ──────────────────────────────────────────────────────────

export async function getFeatureFlags(db: DbClient): Promise<Record<string, boolean>> {
  await ensureAppSettingsTable(db);
  const row = await db.appSetting.findUnique({ where: { id: 'default' } });
  return (row?.featureFlags as Record<string, boolean>) ?? {};
}

export async function updateFeatureFlags(db: DbClient, flags: Record<string, boolean>): Promise<Record<string, boolean>> {
  await ensureAppSettingsTable(db);
  await db.appSetting.upsert({
    where: { id: 'default' },
    create: { id: 'default', featureFlags: flags },
    update: { featureFlags: flags },
  });
  return flags;
}
