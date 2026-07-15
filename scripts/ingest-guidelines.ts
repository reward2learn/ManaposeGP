/**
 * Seed clinical guidelines into the `clinical_guidelines` table.
 *
 * Ingests 8 evidence-based guideline entries covering menopause, cardiovascular,
 * mental health, and bone health from authoritative Australian sources.
 *
 * Usage:
 *   bun run scripts/ingest-guidelines.ts
 *
 * Requires: POSTGRES_URL
 *
 * Uses raw PrismaClient (not ZenStack-enhanced) because the ClinicalGuideline
 * model has no @@allow policy yet — raw Prisma bypasses ZenStack access control.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient, GuidelineSource } from '../src/generated/prisma/index.js';

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

// ── Guideline entries ────────────────────────────────────────────────────────

interface GuidelineEntry {
  source: GuidelineSource;
  title: string;
  category: string;
  summary: string;
  content: string;
  version: string;
  url: string;
  keywords: string[];
}

const GUIDELINES: GuidelineEntry[] = [
  // 1. AMS: Combined MHT
  {
    source: GuidelineSource.ams,
    title: 'Combined MHT — Practical Prescribing Guide',
    category: 'menopause',
    summary:
      'Evidence-based guidance on combined menopausal hormone therapy prescribing, including oestrogen and progestogen regimens, dosing, routes of administration, and risk-benefit assessment.',
    version: '2025.1',
    url: 'https://www.menopause.org.au/hp/management/combined-mht',
    keywords: [
      'MHT',
      'oestrogen',
      'progestogen',
      'prescribing',
      'HRT',
      'hormone therapy',
      'transdermal',
      'oral',
      'vasomotor',
      'dosing',
    ],
    content: `Combined menopausal hormone therapy (MHT) is indicated for women with an intact uterus who require relief from moderate-to-severe vasomotor symptoms. The addition of a progestogen is essential to prevent endometrial hyperplasia and reduce the risk of endometrial cancer associated with unopposed oestrogen.

First-line oestrogen options include transdermal estradiol (patches or gel) at starting doses of 25–50 mcg/day, or oral estradiol at 1–2 mg daily. Transdermal routes are preferred in women with cardiovascular risk factors, hypertriglyceridaemia, or a history of venous thromboembolism, as they avoid first-pass hepatic metabolism.

Progestogen regimens should be individualised. Continuous combined regimens (daily progestogen) are generally preferred for postmenopausal women to avoid withdrawal bleeding. Cyclical regimens (progestogen for 12–14 days per cycle) may be used in perimenopausal women or those within 12 months of their last menstrual period. Micronised progesterone 100–200 mg daily is the preferred progestogen due to its neutral metabolic profile. Alternative options include dydrogesterone 5–10 mg or the levonorgestrel-releasing intrauterine system (LNG-IUS), which provides endometrial protection with minimal systemic absorption.

Treatment should be initiated at the lowest effective dose, with regular review at 3–6 months. Duration of therapy should be individualised, with no arbitrary limits, provided the woman is well-informed and undergoes annual risk-benefit reassessment. Contraindications include current or past breast cancer, oestrogen-sensitive malignancies, undiagnosed vaginal bleeding, and active liver disease.

Tibolone, a synthetic steroid with oestrogenic, progestogenic, and androgenic properties, may be considered as an alternative for postmenopausal women who prefer an oral option without bleeding. However, it carries an increased risk of breast cancer recurrence and stroke in older women, and is not recommended for women over 60.`,
  },

  // 2. AMS: Non-Hormonal Treatments
  {
    source: GuidelineSource.ams,
    title: 'Non-Hormonal Treatments for Menopausal Symptoms',
    category: 'menopause',
    summary:
      'Evidence-based review of non-hormonal pharmacological and non-pharmacological options for managing vasomotor symptoms, including lifestyle modifications, complementary therapies, and prescription medications.',
    version: '2025.1',
    url: 'https://www.menopause.org.au/hp/management/non-hormonal',
    keywords: [
      'non-hormonal',
      'vasomotor',
      'hot flushes',
      'night sweats',
      'SSRI',
      'SNRI',
      'gabapentin',
      'clonidine',
      'CBT',
      'complementary',
    ],
    content: `For women who cannot or choose not to use menopausal hormone therapy, a range of non-hormonal strategies are available for managing vasomotor symptoms. Approximately 80% of women experience hot flushes and night sweats during the menopausal transition, with symptoms lasting a median of 7.4 years.

First-line non-pharmacological interventions include layered clothing, maintaining a cool environment, avoiding triggers such as spicy foods, caffeine, and alcohol, and regular physical activity. Cognitive behavioural therapy (CBT) has Level I evidence for reducing the bother and interference associated with hot flushes and night sweats, though it does not reduce their frequency. Clinical hypnosis has emerging evidence for reducing both frequency and severity — two randomised controlled trials demonstrated a 74% reduction in hot flush frequency compared to 17% with structured attention controls.

Among pharmacological options, selective serotonin reuptake inhibitors (SSRIs) and serotonin-noradrenaline reuptake inhibitors (SNRIs) have the strongest evidence base. Paroxetine (mesylate salt) 7.5 mg daily is TGA-approved specifically for vasomotor symptoms, with trials showing a 33–67% reduction in hot flush frequency. Venlafaxine 37.5–75 mg daily and desvenlafaxine 100 mg daily are effective alternatives. Escitalopram 10–20 mg may also be used but has less specific evidence in this context.

Gabapentin at doses of 300–900 mg daily has demonstrated efficacy in reducing hot flush frequency by approximately 45% in placebo-controlled trials and is particularly useful for women with concurrent sleep disturbance or neuropathic pain. Clonidine 25–50 mcg twice daily provides modest benefit (approximately 1 hot flush per day reduction) but is limited by side effects including dry mouth, dizziness, and hypotension.

Complementary therapies including black cohosh, evening primrose oil, and phytoestrogens (soy isoflavones) have been extensively studied but show inconsistent results. The AMS does not recommend these as first-line therapies due to lack of standardisation and variable quality of evidence. Stellate ganglion blockade has shown promising results in small studies but requires further research before routine clinical use.`,
  },

  // 3. RACGP: Preventive Activities — Menopause
  {
    source: GuidelineSource.racgp,
    title: 'Guidelines for preventive activities in general practice — Menopause',
    category: 'preventive',
    summary:
      'RACGP Red Book guidance on preventive health assessments and screening recommendations for women during the menopausal transition, including cardiovascular risk, bone health, cancer screening, and mental health.',
    version: '10th Edition',
    url: 'https://www.racgp.org.au/clinical-resources/clinical-guidelines/key-racgp-guidelines/preventive-activities/menopause',
    keywords: [
      'prevention',
      'screening',
      'cardiovascular',
      'bone density',
      'mammogram',
      'cervical',
      'bowel',
      'mental health',
      'lifestyle',
      'vaccination',
    ],
    content: `The menopausal transition represents a critical window for preventive health intervention in general practice. The RACGP Red Book recommends a structured approach to health assessment that addresses the unique risk profile of women during and after menopause.

Cardiovascular disease risk assessment should be performed at least every two years from age 45 using the Australian absolute cardiovascular disease risk calculator (AusCVDRisk). Menopause is associated with adverse changes in lipid profile — increased total cholesterol, LDL, and triglycerides with decreased HDL — and the loss of endogenous oestrogen is an independent risk factor for cardiovascular disease. Lipid profiles and fasting blood glucose should be checked at least every five years. Blood pressure should be measured at every opportunity.

Bone health assessment is essential. A fracture risk assessment using the Garvan Fracture Risk Calculator or FRAX tool should be performed for all postmenopausal women. Bone mineral density (BMD) testing via DXA scan is recommended for women with risk factors including early menopause (<45 years), prolonged amenorrhoea, family history of hip fracture, low body weight, smoking, and corticosteroid use. Adequate calcium intake (1000–1300 mg daily) and vitamin D levels (>50 nmol/L) should be ensured, with supplementation offered where dietary intake is insufficient.

Cancer screening should continue according to national guidelines. BreastScreen Australia recommends biennial mammography for women aged 50–74. The National Cervical Screening Program recommends HPV testing every 5 years for women aged 25–74. The National Bowel Cancer Screening Program offers biennial faecal occult blood testing from age 50.

Mental health screening is particularly important during the menopausal transition. The Edinburgh Postnatal Depression Scale or PHQ-9 can be used to screen for depressive symptoms. Women with past history of depression, PMS, or postpartum depression are at increased risk of perimenopausal mood disturbance. Suicide rates in Australian women peak in the 45–54 age group, making this screening priority. Opportunistic assessment of alcohol intake, smoking status, physical activity, and relationship health rounds out the recommended preventive health check.`,
  },

  // 4. Jean Hailes: Symptom Checklist
  {
    source: GuidelineSource.jean_hailes,
    title: 'Perimenopause and Menopause Symptom Checklist',
    category: 'menopause',
    summary:
      'Comprehensive clinical symptom assessment tool for identifying and tracking menopausal symptoms across multiple domains including vasomotor, psychological, urogenital, and somatic domains.',
    version: '2024',
    url: 'https://www.jeanhailes.org.au/health-a-z/menopause/menopause-symptom-checklist',
    keywords: [
      'symptom checklist',
      'perimenopause',
      'vasomotor',
      'mood',
      'sleep',
      'vaginal',
      'libido',
      'joint pain',
      'brain fog',
      'assessment',
    ],
    content: `The Jean Hailes Menopause Symptom Checklist provides a structured clinical tool for identifying and monitoring the broad spectrum of symptoms experienced during the perimenopausal and postmenopausal transition. Research indicates that up to 85% of women experience symptoms, with approximately 20% describing them as severe.

The checklist addresses four key domains. The vasomotor domain includes hot flushes, night sweats, and daytime sweating, which are the most commonly reported symptoms and the primary reason women seek medical attention. Assessment should capture frequency, duration, and interference with daily activities and sleep quality.

The psychological domain encompasses mood swings, irritability, anxiety, depressed mood, difficulty concentrating ('brain fog'), and memory complaints. These symptoms often precede the onset of vasomotor symptoms during perimenopause and may be misattributed to life stressors. Clinicians should specifically enquire about past history of depression, PMS, or postpartum depression, as these increase risk.

The urogenital domain covers vaginal dryness, dyspareunia, urinary frequency, urgency, and recurrent urinary tract infections. These symptoms are progressive and unlikely to improve without treatment. The genitourinary syndrome of menopause (GSM) affects up to 50% of postmenopausal women but is often under-reported due to embarrassment. Direct questioning using simple, non-judgemental language is recommended.

The somatic domain includes joint and muscle pain, fatigue, sleep disturbance, breast tenderness, weight gain (particularly central adiposity), headaches, skin changes, and palpitations. Joint pain is reported by up to 40% of menopausal women and is often the most bothersome somatic symptom. Sleep disturbance frequently compounds other symptoms and should be specifically addressed.

Clinicians should consider using a validated tool such as the Menopause Rating Scale (MRS) or Greene Climacteric Scale for baseline assessment and monitoring treatment response. The checklist should be reviewed at 3-monthly intervals during active symptom management. A symptom diary completed by the patient between consultations can provide valuable longitudinal data to guide treatment decisions.`,
  },

  // 5. RACGP: Cardiovascular Risk Assessment
  {
    source: GuidelineSource.racgp,
    title: 'Cardiovascular Risk Assessment in Postmenopausal Women',
    category: 'cardiovascular',
    summary:
      'Evidence-based guidance on cardiovascular risk assessment and management in postmenopausal women, addressing the impact of oestrogen loss on cardiovascular health and the role of MHT in primary prevention.',
    version: '2024',
    url: 'https://www.racgp.org.au/clinical-resources/clinical-guidelines/cardiovascular-risk-postmenopausal',
    keywords: [
      'cardiovascular',
      'CVD',
      'risk assessment',
      'lipid profile',
      'hypertension',
      'oestrogen',
      'MHT',
      'statins',
      'primary prevention',
      'timing hypothesis',
    ],
    content: `Cardiovascular disease (CVD) is the leading cause of death in Australian women, accounting for approximately 22,000 deaths annually. The menopausal transition marks a critical inflection point in cardiovascular risk, driven by the loss of endogenous oestrogen-mediated cardioprotective effects.

The RACGP recommends comprehensive cardiovascular risk assessment for all women from age 45, with reassessment every two years unless risk status dictates more frequent monitoring. The AusCVDRisk calculator or the updated Australian absolute CVD risk algorithm should be used to estimate 5-year absolute risk. Traditional Framingham risk factors including age, systolic blood pressure, smoking status, total cholesterol, and HDL cholesterol remain the foundation of risk stratification.

Menopause-specific risk factors should be incorporated into the clinical assessment. These include age at menopause (early menopause before 45 years is associated with elevated CVD risk), surgical menopause without oestrogen replacement, history of pre-eclampsia or gestational hypertension, and presence of vasomotor symptoms. Emerging evidence suggests that the frequency and severity of hot flushes may independently predict future cardiovascular events.

The 'timing hypothesis' regarding MHT and cardiovascular risk is clinically important. Initiation of MHT in women under 60 years or within 10 years of menopause is associated with reduced coronary heart disease and all-cause mortality. However, initiation in women over 60 or more than 10 years post-menopause may increase cardiovascular risk. This window of opportunity should guide prescribing decisions.

Lipid profiles typically worsen during the menopausal transition, with increases in total cholesterol (6-10%), LDL cholesterol (10-14%), and triglycerides (11-15%), alongside decreases in HDL. These changes should be managed according to standard guidelines, with statins as first-line pharmacotherapy when indicated. Lifestyle interventions remain fundamental: 150-300 minutes of moderate-intensity exercise weekly, Mediterranean-style diet, smoking cessation, weight management (target BMI 18.5-24.9 kg/m²), and limiting alcohol to ≤10 standard drinks per week.`,
  },

  // 6. AMS: Early and Premature Menopause
  {
    source: GuidelineSource.ams,
    title: 'Managing Early and Premature Menopause',
    category: 'menopause',
    summary:
      'Clinical guidance on diagnosis, investigation, and management of premature ovarian insufficiency and early menopause, emphasising the importance of hormone replacement until the average age of natural menopause.',
    version: '2025.1',
    url: 'https://www.menopause.org.au/hp/management/early-menopause',
    keywords: [
      'POI',
      'premature ovarian insufficiency',
      'early menopause',
      'FSH',
      'AMH',
      'fertility',
      'bone health',
      'cardiovascular',
      'HRT',
      'Karyotype',
    ],
    content: `Premature ovarian insufficiency (POI) is defined as menopause occurring before age 40, affecting approximately 1% of women. Early menopause occurs between ages 40–45 and affects approximately 5% of women. Both conditions carry significant long-term health consequences due to prolonged oestrogen deficiency.

Diagnosis of POI requires two serum FSH measurements in the menopausal range (>40 IU/L) taken at least 4–6 weeks apart, in a woman under 40 years presenting with oligomenorrhoea or amenorrhoea for at least 4 months. In perimenopausal women, FSH may fluctuate, so results should be interpreted with clinical context. Anti-Müllerian hormone (AMH) levels can provide additional diagnostic information — very low or undetectable AMH is consistent with diminished ovarian reserve.

Initial investigations should include: serum FSH, LH, oestradiol, TSH, prolactin (to exclude other causes of amenorrhoea), and transvaginal ultrasound to assess ovarian morphology and endometrial thickness. For women under 35 years, karyotype analysis is indicated to exclude Turner syndrome or other chromosomal abnormalities. Fragile X premutation carrier testing (FMR1 gene) should be offered, as 13–26% of premutation carriers develop POI. Adrenal autoantibodies (21-hydroxylase) should be checked to screen for autoimmune oophoritis, which accounts for 4–30% of POI cases.

Hormone replacement therapy (HRT) is essential in POI and early menopause unless contraindicated. The goal is to replace physiological oestrogen levels until at least the average age of natural menopause (51 years). Combined oestrogen-progestogen therapy should be offered to all women with an intact uterus. Compared with women taking HRT for menopause at the usual age, women with POI require higher oestrogen doses to achieve physiological replacement — typically 100 mcg transdermal estradiol or 2–4 mg oral estradiol.

Women with POI have significantly increased risks of osteoporosis, cardiovascular disease, cognitive decline, and premature mortality without adequate hormone replacement. Bone mineral density monitoring is recommended at diagnosis and every 2–3 years thereafter. Psychological support and referral to a fertility specialist should be offered, as spontaneous pregnancy occurs in 5–10% of POI cases and egg donation remains the most successful fertility option.`,
  },

  // 7. Beyond Blue: Perimenopausal Depression
  {
    source: GuidelineSource.beyond_blue,
    title: 'Perimenopausal Depression — Clinical Practice Guidelines',
    category: 'mental_health',
    summary:
      'Evidence-based guidelines for the identification, assessment, and management of depression during the perimenopausal transition, including both psychological and pharmacological treatment approaches.',
    version: '2024',
    url: 'https://www.beyondblue.org.au/mental-health/menopause/perimenopausal-depression',
    keywords: [
      'depression',
      'perimenopausal',
      'mood',
      'PHQ-9',
      'CBT',
      'SSRI',
      'MHT',
      'oestrogen',
      'anxiety',
      'suicide',
    ],
    content: `The perimenopausal transition represents a period of increased vulnerability to major depressive disorder. Epidemiological data indicate that the risk of depressive symptoms is 2–4 times higher during perimenopause compared to the premenopausal period, independent of past history of depression. Australian data show that suicide rates are highest among women aged 45–54, underscoring the critical importance of routine mental health screening during this life stage.

Risk factors for perimenopausal depression include: past history of depression (including postpartum depression), premenstrual dysphoric disorder (PMDD), severe vasomotor symptoms, stressful life events, poor social support, surgical menopause, and prolonged perimenopause (>27 months). The presence of hot flushes and night sweats, particularly when they disrupt sleep, is independently associated with depressive symptoms. Sleep disturbance may mediate the relationship between vasomotor symptoms and mood — addressing sleep quality is therefore a key therapeutic target.

Screening should be systematic using validated tools. The PHQ-9 is recommended for its brevity and sensitivity. The Edinburgh Postnatal Depression Scale can be used if the clinician is familiar with it, though it is not specifically validated for perimenopausal populations. Clinicians should ask specifically about anhedonia, irritability (often more prominent than sadness in this group), cognitive complaints, and suicidal ideation.

Treatment should be multimodal. Cognitive behavioural therapy (CBT) and interpersonal therapy (IPT) have the strongest evidence base among psychological interventions. Where MHT is indicated for vasomotor symptoms, evidence suggests that transdermal estradiol may have an adjunctive antidepressant effect in perimenopausal women, particularly those with fluctuating hormone levels. Data on MHT as a standalone antidepressant treatment are mixed — it is most effective in perimenopausal (not postmenopausal) women and those with concurrent vasomotor symptoms.

Antidepressant selection follows general adult depression guidelines. SSRIs (escitalopram, sertraline) and SNRIs (desvenlafaxine, venlafaxine) are first-line. When combined with tamoxifen for breast cancer, SSRIs that inhibit CYP2D6 (paroxetine, fluoxetine) should be avoided and alternatives such as escitalopram or venlafaxine preferred. Treatment response should be monitored at 2–4 weeks initially, with a planned review of the comprehensive management plan including lifestyle, sleep hygiene, exercise, and social connection.`,
  },

  // 8. Osteoporosis Australia: Bone Health
  {
    source: GuidelineSource.osteoporosis_australia,
    title: 'Bone Health in Postmenopausal Women',
    category: 'bone_health',
    summary:
      'Comprehensive guidance on bone health assessment, fracture risk stratification, and evidence-based management strategies for maintaining bone density in postmenopausal women.',
    version: '2025',
    url: 'https://www.osteoporosis.org.au/clinical-guidelines/bone-health-postmenopausal',
    keywords: [
      'bone health',
      'osteoporosis',
      'BMD',
      'DXA',
      'fracture risk',
      'calcium',
      'vitamin D',
      'bisphosphonate',
      'denosumab',
      'FRAX',
    ],
    content: `Osteoporosis affects approximately 25% of Australian women over 50 years and contributes to over 183,000 fractures annually. The accelerated bone loss during the menopausal transition — up to 5% per year in the first 5 years post-menopause — makes this a critical period for bone health intervention.

Fracture risk assessment should be performed for all postmenopausal women. The Garvan Fracture Risk Calculator or FRAX tool (calibrated for Australia) should be used, incorporating age, BMD (if available), prior fracture history, parental hip fracture, smoking, glucocorticoid use, rheumatoid arthritis, secondary osteoporosis, and alcohol intake. BMD testing via DXA scan is recommended for women with risk factors including early menopause (<45 years), prolonged amenorrhoea, family history of hip fracture, low body weight (BMI <19), smoking, and corticosteroid use (≥5 mg prednisolone daily for ≥3 months).

Optimal calcium intake is 1000–1300 mg daily, preferably from dietary sources. Three servings of dairy (or calcium-fortified alternatives) typically provide 900–1000 mg. Supplementation should be considered when dietary intake is insufficient, though doses above 500–600 mg at a time are poorly absorbed. Vitamin D status should be maintained above 50 nmol/L year-round; supplementation with 800–1000 IU daily is recommended for those with limited sun exposure, dark skin, or who wear concealing clothing.

First-line pharmacological therapy for established osteoporosis (T-score ≤-2.5 at lumbar spine or hip, or prevalent fragility fracture) includes oral bisphosphonates (alendronate 70 mg weekly or risedronate 35 mg weekly) or intravenous zoledronic acid 5 mg annually. Denosumab 60 mg six-monthly is an alternative for women who cannot tolerate or have contraindications to bisphosphonates. Treatment should be reviewed after 3–5 years for bisphosphonates, with consideration of a drug holiday in low-risk patients who have maintained BMD without incident fractures.

Non-pharmacological strategies are essential at all risk levels. Weight-bearing exercise (brisk walking, jogging, dancing) for 30–40 minutes, 3–4 sessions per week, combined with progressive resistance training 2–3 times weekly, improves BMD and reduces falls risk. Balance training (tai chi, specific balance exercises) should be incorporated for women at elevated falls risk. Smoking cessation and limiting alcohol to ≤2 standard drinks per day with at least two alcohol-free days per week round out the lifestyle recommendations for lifelong bone health.`,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadEnvLocal();

  const dbUrl = process.env.POSTGRES_URL;
  if (!dbUrl) {
    throw new Error('POSTGRES_URL is not set');
  }

  console.log('[ingest-guidelines] POSTGRES_URL found');
  console.log(`[ingest-guidelines] Ingesting ${GUIDELINES.length} clinical guidelines...`);

  const prisma = new PrismaClient();

  try {
    let created = 0;
    let updated = 0;

    for (const entry of GUIDELINES) {
      const existing = await prisma.clinicalGuideline.findFirst({
        where: {
          title: entry.title,
          source: entry.source,
        },
        select: { id: true },
      });

      if (existing) {
        await prisma.clinicalGuideline.update({
          where: { id: existing.id },
          data: {
            category: entry.category,
            summary: entry.summary,
            content: entry.content,
            version: entry.version,
            url: entry.url,
            keywords: entry.keywords,
            lastUpdated: new Date(),
          },
        });
        updated++;
        console.log(`  [updated]  ${entry.source}: "${entry.title}"`);
      } else {
        await prisma.clinicalGuideline.create({
          data: {
            source: entry.source,
            title: entry.title,
            category: entry.category,
            summary: entry.summary,
            content: entry.content,
            version: entry.version,
            url: entry.url,
            keywords: entry.keywords,
            lastUpdated: new Date(),
          },
        });
        created++;
        console.log(`  [created]  ${entry.source}: "${entry.title}"`);
      }
    }

    console.log(`[ingest-guidelines] Done — ${created} created, ${updated} updated.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[ingest-guidelines] Fatal:', err);
  process.exit(1);
});
