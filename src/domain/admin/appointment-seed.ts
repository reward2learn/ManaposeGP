import type { DbClient } from '@/lib/db';

const DEFAULT_APPOINTMENT_TYPES = [
  { name: 'New Patient', duration: 30, color: '#2196F3', description: 'Initial comprehensive consultation for new patients' },
  { name: 'Standard Consultation', duration: 15, color: '#4CAF50', description: 'Standard Level B consultation' },
  { name: 'Long Consultation', duration: 30, color: '#FF9800', description: 'Extended Level C consultation' },
  { name: 'Telehealth', duration: 15, color: '#9C27B0', description: 'Video/phone telehealth consultation' },
  { name: 'Procedure', duration: 30, color: '#F44336', description: 'Minor surgical procedure or treatment' },
  { name: 'Mental Health Care Plan', duration: 45, color: '#00BCD4', description: 'GP Mental Health Care Plan (MBS 2700/2701)' },
  { name: 'Health Assessment', duration: 45, color: '#795548', description: 'Comprehensive health assessment (MBS 701/703)' },
  { name: 'Review', duration: 15, color: '#607D8B', description: 'Follow-up review of results or progress' },
  { name: 'Chronic Disease Management', duration: 30, color: '#E91E63', description: 'GP Management Plan / Team Care Arrangement' },
  { name: 'Immunisation', duration: 15, color: '#8BC34A', description: 'Vaccination or immunisation appointment' },
];

export async function seedAppointmentTypes(db: DbClient): Promise<number> {
  let count = 0;
  for (const type of DEFAULT_APPOINTMENT_TYPES) {
    // Check if already exists to avoid duplicates
    const existing = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM appointment_types WHERE name = $1 LIMIT 1`,
      type.name,
    );
    if (existing.length > 0) continue;

    await db.$executeRawUnsafe(
      `INSERT INTO appointment_types (id, name, description, default_duration, color, is_active, sort_order, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, TRUE, $5, NOW(), NOW())`,
      type.name, type.description, type.duration, type.color, count,
    );
    count++;
  }
  return count;
}
