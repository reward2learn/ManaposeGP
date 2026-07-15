/**
 * Seed 10 patients for GP User ID: 104869851603605724566
 * Uses batch inserts for performance.
 * Run: bun run scripts/seed-gp-patients.ts
 */
import { createClient } from '../src/lib/db.js';

const GP_USER_ID = '104869851603605724566';
const GP_NAME = 'Dr. Sarah Mitchell';

const PATIENTS = [
  { fn: 'Sarah', ln: 'Johnson_seed', age: 52, meno: 'PERIMENOPAUSAL', h: 165, w: 72, bt: 'O+', smoke: 'never', alc: 3, ex: 120, ch: '{Hypertension}', al: '{Penicillin}', cm: '{Lisinopril 10mg,Vitamin D 1000IU}' },
  { fn: 'Emma', ln: 'Williams_seed', age: 47, meno: 'PERIMENOPAUSAL', h: 158, w: 65, bt: 'A+', smoke: 'never', alc: 1, ex: 180, ch: '{}', al: '{}', cm: '{Estradiol patch 50mcg}' },
  { fn: 'Olivia', ln: 'Brown_seed', age: 58, meno: 'POSTMENOPAUSAL', h: 170, w: 78, bt: 'B+', smoke: 'ex', alc: 5, ex: 90, ch: '{Type 2 Diabetes,Hyperlipidaemia}', al: '{Sulfa}', cm: '{Metformin 500mg,Atorvastatin 20mg,MHT oral 1mg}' },
  { fn: 'Charlotte', ln: 'Jones_seed', age: 43, meno: 'EARLY_MENOPAUSE', h: 163, w: 58, bt: 'AB+', smoke: 'never', alc: 2, ex: 240, ch: '{}', al: '{}', cm: '{Estradiol gel,Progesterone 100mg}' },
  { fn: 'Amelia', ln: 'Smith_seed', age: 61, meno: 'POSTMENOPAUSAL', h: 168, w: 85, bt: 'O-', smoke: 'never', alc: 0, ex: 60, ch: '{Osteoarthritis,Hypothyroidism}', al: '{Iodine}', cm: '{Levothyroxine 50mcg,Calcium + Vit D}' },
  { fn: 'Isabella', ln: 'Wilson_seed', age: 49, meno: 'PERIMENOPAUSAL', h: 160, w: 68, bt: 'A-', smoke: 'current', alc: 8, ex: 45, ch: '{Anxiety,Migraine}', al: '{}', cm: '{Sertraline 50mg,Sumatriptan PRN}' },
  { fn: 'Mia', ln: 'Taylor_seed', age: 55, meno: 'POSTMENOPAUSAL', h: 172, w: 70, bt: 'B-', smoke: 'never', alc: 4, ex: 150, ch: '{}', al: '{Latex}', cm: '{MHT transdermal,Magnesium supplement}' },
  { fn: 'Harper', ln: 'Anderson_seed', age: 46, meno: 'PERIMENOPAUSAL', h: 155, w: 62, bt: 'O+', smoke: 'never', alc: 1, ex: 200, ch: '{IBS}', al: '{Dairy}', cm: '{Probiotic,MHT oral low dose}' },
  { fn: 'Evelyn', ln: 'Thomas_seed', age: 64, meno: 'POSTMENOPAUSAL', h: 166, w: 75, bt: 'A+', smoke: 'ex', alc: 6, ex: 100, ch: '{Osteoporosis,GERD}', al: '{}', cm: '{Alendronate 70mg weekly,Omeprazole 20mg,Calcium + Vit D}' },
  { fn: 'Abigail', ln: 'Martin_seed', age: 39, meno: 'EARLY_MENOPAUSE', h: 162, w: 56, bt: 'AB-', smoke: 'never', alc: 2, ex: 300, ch: '{}', al: '{}', cm: '{Estradiol + Progesterone combo patch}' },
];

const SYMPTOMS = ['hot_flush','night_sweat','sleep_disturbance','mood_change','brain_fog','joint_pain','fatigue','headache','vaginal_dryness'];

function rand(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rfv(base: number, v: number): number { return Math.round((base + (Math.random() - 0.5) * v * 2) * 10) / 10; }
function dAgo(d: number): string { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString().slice(0,10); }

async function main() {
  if (!process.env.POSTGRES_URL) throw new Error('POSTGRES_URL not set');
  const db = createClient();

  try {
    // ── 1. GP profile ──────────────────────────────────────────────────
    console.log('[seed] GP profile...');
    const eg = await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT id FROM gp_profiles WHERE user_id=$1`, GP_USER_ID);
    let gpid = eg[0]?.id;
    if (!gpid) {
      const r = await db.$queryRawUnsafe<Array<{id:string}>>(
        `INSERT INTO gp_profiles(id,user_id,name,practice_name,ahpra_number,email,verified) VALUES(gen_random_uuid()::text,$1,$2,'ManaposeGP Clinic','MED0001234567','dr.mitchell@manaposegp.id',true) RETURNING id`,
        GP_USER_ID, GP_NAME);
      gpid = r[0].id;
    }
    console.log(`[seed] GP: ${gpid}`);

    // ── 2. Build batch SQL ─────────────────────────────────────────────
    const profileValues: string[] = [];
    const symptomValues: string[] = [];
    const metricValues: string[] = [];
    const consentValues: string[] = [];
    let pi = 0;

    for (const p of PATIENTS) {
      const pid = crypto.randomUUID();
      const uid = `seed-${p.fn.toLowerCase()}-${p.ln.toLowerCase().replace('_seed','')}`;
      const dob = `${new Date().getFullYear() - p.age}-06-15`;

      // Profile
      profileValues.push(`('${pid}','${uid}','${dob}','female','${p.meno}',${p.h},${p.w},'${p.bt}','${p.al}','${p.ch}','${p.cm}','${p.smoke}',${p.alc},${p.ex})`);

      // Consent
      consentValues.push(`(gen_random_uuid()::text,'${pid}','${gpid}','full_access','ACTIVE',NOW())`);

      // Symptoms: 20-40 entries over 30 days
      for (let day = 0; day < 30; day++) {
        const n = rand(0, 2);
        for (let e = 0; e < n; e++) {
          const st = SYMPTOMS[rand(0, SYMPTOMS.length-1)];
          const sev = rand(1,10);
          const dur = sev > 5 ? rand(10,60) : 'NULL';
          const freq = sev > 4 ? rand(1,5) : 'NULL';
          const trig = Math.random() > 0.6 ? `'{${['stress','heat','caffeine'].slice(0,rand(1,3)).join(',')}}'` : `'{}'`;
          const rel = Math.random() > 0.7 ? `'{${['cooling','meditation'].slice(0,rand(1,2)).join(',')}}'` : `'{}'`;
          const imp = sev > 6 ? rand(5,9) : rand(1,4);
          const notes = sev > 7 ? `'Significant impact on daily activities'` : 'NULL';
          const dt = `'${dAgo(day)}'`;
          symptomValues.push(`(gen_random_uuid()::text,'${pid}',${dt},'${st}',${sev},${dur},${freq},${trig},${rel},${imp},${notes})`);
        }
      }

      // Metrics: 5 types × 30 days
      const metrics = [
        {t:'heart_rate',u:'bpm',b:72,v:8},
        {t:'sleep_duration',u:'hours',b:6.5,v:1.8},
        {t:'steps',u:'steps',b:6500,v:3000},
        {t:'body_temperature',u:'C',b:36.6,v:0.5},
        {t:'resting_heart_rate',u:'bpm',b:68,v:6},
      ];
      for (const m of metrics) {
        for (let day = 0; day < 30; day++) {
          const val = rfv(m.b, m.v);
          const dt = `'${dAgo(day)}T08:00:00Z'`;
          metricValues.push(`(gen_random_uuid()::text,'${pid}','${m.t}','{"value":${val},"trend":"stable"}'::jsonb,'${m.u}','manual','seed-script',${dt})`);
        }
      }

      pi++;
    }

    // ── 3. Execute batches ──────────────────────────────────────────────
    console.log(`[seed] Inserting ${PATIENTS.length} profiles...`);
    await db.$executeRawUnsafe(
      `INSERT INTO health_profiles(id,user_id,date_of_birth,sex_at_birth,menopause_status,height_cm,weight_kg,blood_type,allergies,chronic_conditions,current_medications,smoking_status,alcohol_units_per_week,exercise_minutes_per_week)
       VALUES ${profileValues.join(',')} ON CONFLICT DO NOTHING`);
    console.log('[seed] Profiles done.');

    console.log(`[seed] Inserting ${symptomValues.length} symptoms...`);
    // Symptoms in batches of 500
    for (let i = 0; i < symptomValues.length; i += 500) {
      const batch = symptomValues.slice(i, i + 500);
      await db.$executeRawUnsafe(
        `INSERT INTO symptom_journals(id,health_profile_id,date,symptom_type,severity,duration,frequency,triggers,relief_factors,impact_on_daily,notes)
         VALUES ${batch.join(',')}`);
      process.stdout.write('.');
    }
    console.log(`\n[seed] Symptoms done (${symptomValues.length}).`);

    console.log(`[seed] Inserting ${metricValues.length} metrics...`);
    for (let i = 0; i < metricValues.length; i += 500) {
      const batch = metricValues.slice(i, i + 500);
      await db.$executeRawUnsafe(
        `INSERT INTO health_metrics(id,health_profile_id,metric_type,value,unit,source,source_device,recorded_at)
         VALUES ${batch.join(',')}`);
      process.stdout.write('.');
    }
    console.log(`\n[seed] Metrics done (${metricValues.length}).`);

    console.log(`[seed] Inserting ${consentValues.length} consents...`);
    await db.$executeRawUnsafe(
      `INSERT INTO patient_consents(id,health_profile_id,gp_id,consent_type,status,granted_at)
       VALUES ${consentValues.join(',')} ON CONFLICT(health_profile_id,gp_id) DO NOTHING`);
    console.log('[seed] Consents done.');

    console.log(`\n[seed] ===== Summary =====`);
    console.log(`[seed] GP: ${gpid}`);
    console.log(`[seed] Profiles: ${profileValues.length}`);
    console.log(`[seed] Symptoms: ${symptomValues.length}`);
    console.log(`[seed] Metrics: ${metricValues.length}`);
    console.log(`[seed] Consents: ${consentValues.length}`);
    console.log('[seed] Done.');

  } catch (err) {
    console.error('[seed] Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
