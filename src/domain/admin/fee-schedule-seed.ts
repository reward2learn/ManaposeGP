import type { DbClient } from '@/lib/db';

interface FeeItemSeed {
  mbsItemNumber: string;
  description: string;
  category: string;
  scheduleFee: number; // cents
  practiceFee: number; // cents (private fee)
}

/**
 * Standard Australian GP MBS items with 2024/2025 schedule fees (in cents).
 * Practice fees are set at the schedule rate by default (bulk bill).
 * Categories: CONSULTATION, MENTAL_HEALTH, HEALTH_ASSESSMENT, CHRONIC_DISEASE, PROCEDURE, TELEHEALTH, OTHER
 */
const DEFAULT_FEE_SCHEDULE: FeeItemSeed[] = [
  // ── Standard Consultations ───────────────────────────────────────────
  { mbsItemNumber: '3',  description: 'Level A — Brief consultation (≤5 min)', category: 'CONSULTATION', scheduleFee: 1960,  practiceFee: 1960 },
  { mbsItemNumber: '23', description: 'Level B — Standard consultation (5–20 min)', category: 'CONSULTATION', scheduleFee: 4285,  practiceFee: 4285 },
  { mbsItemNumber: '36', description: 'Level C — Long consultation (20–40 min)', category: 'CONSULTATION', scheduleFee: 8395,  practiceFee: 8395 },
  { mbsItemNumber: '44', description: 'Level D — Prolonged consultation (>40 min)', category: 'CONSULTATION', scheduleFee: 12350, practiceFee: 12350 },

  // ── Mental Health ────────────────────────────────────────────────────
  { mbsItemNumber: '2700', description: 'GP Mental Health Treatment Plan (preparation)', category: 'MENTAL_HEALTH', scheduleFee: 10070, practiceFee: 10070 },
  { mbsItemNumber: '2701', description: 'GP Mental Health Treatment Plan (review)', category: 'MENTAL_HEALTH', scheduleFee: 7585,  practiceFee: 7585 },
  { mbsItemNumber: '2713', description: 'Focused Psychological Strategies (20+ min)', category: 'MENTAL_HEALTH', scheduleFee: 7585,  practiceFee: 7585 },
  { mbsItemNumber: '2721', description: 'FPS — GP Mental Health Consultation (30+ min)', category: 'MENTAL_HEALTH', scheduleFee: 10530, practiceFee: 10530 },
  { mbsItemNumber: '2725', description: 'FPS — GP Mental Health Consultation (40+ min)', category: 'MENTAL_HEALTH', scheduleFee: 13505, practiceFee: 13505 },

  // ── Health Assessments ───────────────────────────────────────────────
  { mbsItemNumber: '701', description: 'Brief Health Assessment (<30 min)', category: 'HEALTH_ASSESSMENT', scheduleFee: 6700,  practiceFee: 6700 },
  { mbsItemNumber: '703', description: 'Standard Health Assessment (30–45 min)', category: 'HEALTH_ASSESSMENT', scheduleFee: 13420, practiceFee: 13420 },
  { mbsItemNumber: '705', description: 'Long Health Assessment (45–60 min)', category: 'HEALTH_ASSESSMENT', scheduleFee: 19760, practiceFee: 19760 },
  { mbsItemNumber: '707', description: 'Prolonged Health Assessment (>60 min)', category: 'HEALTH_ASSESSMENT', scheduleFee: 26100, practiceFee: 26100 },
  { mbsItemNumber: '715', description: 'Health Assessment — Aboriginal/Torres Strait Islander', category: 'HEALTH_ASSESSMENT', scheduleFee: 19760, practiceFee: 19760 },

  // ── Chronic Disease Management ───────────────────────────────────────
  { mbsItemNumber: '721', description: 'GP Management Plan (GPMP)', category: 'CHRONIC_DISEASE', scheduleFee: 15610, practiceFee: 15610 },
  { mbsItemNumber: '723', description: 'Team Care Arrangements (TCA)', category: 'CHRONIC_DISEASE', scheduleFee: 13420, practiceFee: 13420 },
  { mbsItemNumber: '732', description: 'GPMP / TCA Review', category: 'CHRONIC_DISEASE', scheduleFee: 7805,  practiceFee: 7805 },
  { mbsItemNumber: '10997', description: 'Multidisciplinary Case Conference (15–20 min)', category: 'CHRONIC_DISEASE', scheduleFee: 7700,  practiceFee: 7700 },

  // ── Procedures ───────────────────────────────────────────────────────
  { mbsItemNumber: '30071', description: 'Therapeutic procedure — minor', category: 'PROCEDURE', scheduleFee: 4200,  practiceFee: 6500 },
  { mbsItemNumber: '30062', description: 'Excision of skin lesion (≤10mm)', category: 'PROCEDURE', scheduleFee: 5800,  practiceFee: 7500 },
  { mbsItemNumber: '30202', description: 'Iron infusion (IV)', category: 'PROCEDURE', scheduleFee: 6250,  practiceFee: 12000 },
  { mbsItemNumber: '12000', description: 'Electrocardiogram (ECG) — trace only', category: 'PROCEDURE', scheduleFee: 1660,  practiceFee: 3500 },
  { mbsItemNumber: '11700', description: 'Spirometry (before & after bronchodilator)', category: 'PROCEDURE', scheduleFee: 3250,  practiceFee: 4500 },

  // ── Telehealth ───────────────────────────────────────────────────────
  { mbsItemNumber: '91890', description: 'Telehealth — Level A (brief, ≤5 min)', category: 'TELEHEALTH', scheduleFee: 1960,  practiceFee: 1960 },
  { mbsItemNumber: '91891', description: 'Telehealth — Level B (standard)', category: 'TELEHEALTH', scheduleFee: 4285,  practiceFee: 4285 },
  { mbsItemNumber: '91892', description: 'Telehealth — Level C (long)', category: 'TELEHEALTH', scheduleFee: 8395,  practiceFee: 8395 },

  // ── Antenatal & Women's Health ───────────────────────────────────────
  { mbsItemNumber: '16500', description: 'Antenatal visit — routine', category: 'CONSULTATION', scheduleFee: 5250,  practiceFee: 5250 },
  { mbsItemNumber: '16590', description: 'Cervical Screening Test (Pap smear)', category: 'PROCEDURE', scheduleFee: 3955,  practiceFee: 5500 },
  { mbsItemNumber: '2501', description: 'Mirena/Implanon insertion', category: 'PROCEDURE', scheduleFee: 6900,  practiceFee: 11000 },
  { mbsItemNumber: '14206', description: 'Menopause management plan', category: 'CHRONIC_DISEASE', scheduleFee: 8395,  practiceFee: 8395 },

  // ── Other ─────────────────────────────────────────────────────────────
  { mbsItemNumber: '5020', description: 'After-hours urgent consultation', category: 'OTHER', scheduleFee: 15560, practiceFee: 18000 },
  { mbsItemNumber: '10990', description: 'Home visit — Level B', category: 'OTHER', scheduleFee: 7000,  practiceFee: 9500 },
  { mbsItemNumber: '900', description: 'Immunisation — standard (GP-initiated)', category: 'OTHER', scheduleFee: 2540,  practiceFee: 3500 },
  { mbsItemNumber: '11500', description: 'Care plan — medication review (DMMR)', category: 'CHRONIC_DISEASE', scheduleFee: 11385, practiceFee: 11385 },
];

export async function seedFeeSchedule(db: DbClient): Promise<number> {
  let count = 0;
  for (const item of DEFAULT_FEE_SCHEDULE) {
    const existing = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM fee_schedule_items WHERE mbs_item_number = $1 LIMIT 1`,
      item.mbsItemNumber,
    );
    if (existing.length > 0) continue;

    await db.$executeRawUnsafe(
      `INSERT INTO fee_schedule_items (id, mbs_item_number, description, category, schedule_fee, practice_fee, is_active, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, TRUE, NOW(), NOW())`,
      item.mbsItemNumber, item.description, item.category, item.scheduleFee, item.practiceFee,
    );
    count++;
  }
  return count;
}
