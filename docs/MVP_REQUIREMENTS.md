# ManaposeGP — Women's Health MVP Requirements & Implementation Roadmap

## Document Purpose

Defines the Minimum Viable Product (MVP) for ManaposeGP as a dual-purpose platform serving women navigating menopause AND the general practitioners (GPs) who support them. This document bridges the healthcare domain analysis with the existing platform architecture to produce a concrete, implementable plan.

---

## 1. Use Case Matrix

### 1.1 Patient Use Cases

| UC-ID | Actor | Use Case | Priority | Auth Tier |
|-------|-------|----------|----------|-----------|
| **UC-P01** | Patient | Create health profile (DOB, menopause status, health history) | P0 | google |
| **UC-P02** | Patient | Log daily symptoms with severity, duration, triggers | P0 | google |
| **UC-P03** | Patient | Sync Apple Health/Watch data (sleep, HR, temperature, cycles) | P0 | google |
| **UC-P04** | Patient | View symptom trends over time (charts, calendar heatmap) | P0 | google |
| **UC-P05** | Patient | Generate GP consultation preparation summary | P0 | google |
| **UC-P06** | Patient | Export symptom data as PDF for GP appointment | P0 | google |
| **UC-P07** | Patient | Chat with AI assistant about symptoms (educational, not diagnostic) | P0 | google |
| **UC-P08** | Patient | Receive AI-generated insights (sleep-heat correlation, HRV trends) | P1 | google |
| **UC-P09** | Patient | Set medication reminders (MHT, supplements) | P1 | google |
| **UC-P10** | Patient | Access health education library (Jean Hailes, AMS content) | P1 | public |
| **UC-P11** | Patient | Track treatment response (symptoms before/after starting MHT) | P1 | google |
| **UC-P12** | Patient | Complete mental health screening (K10, PHQ-9, GAD-7) | P2 | google |
| **UC-P13** | Patient | Book GP appointment (integration with practice booking system) | P2 | google |
| **UC-P14** | Patient | Share health data with GP via consent-based access | P2 | google |

### 1.2 GP Use Cases

| UC-ID | Actor | Use Case | Priority | Auth Tier |
|-------|-------|----------|----------|-----------|
| **UC-G01** | GP | View patient health dashboard (symptoms, metrics, trends) | P0 | pin |
| **UC-G02** | GP | Receive AI-generated patient summary before consultation | P0 | pin |
| **UC-G03** | GP | Query clinical guidelines (AMS, RACGP, eTG) via chat | P0 | pin |
| **UC-G04** | GP | Access drug interaction checker for MHT + existing medications | P0 | pin |
| **UC-G05** | GP | Use risk calculators (FRAX, cardiovascular, breast cancer) | P1 | pin |
| **UC-G06** | GP | Generate SOAP-format consultation notes with AI scribe | P1 | pin |
| **UC-G07** | GP | Generate specialist referral letters with patient data | P1 | pin |
| **UC-G08** | GP | Receive weekly evidence digest (new menopause research) | P2 | pin |
| **UC-G09** | GP | View population health analytics across patient panel | P2 | pin |
| **UC-G10** | GP | Document treatment plan and track patient adherence | P2 | pin |

### 1.3 System Use Cases

| UC-ID | Actor | Use Case | Priority |
|-------|-------|----------|----------|
| **UC-S01** | Admin | Seed clinical knowledge base (guidelines, fact sheets) | P0 |
| **UC-S02** | Admin | Manage user auth tiers and GP credential verification | P0 |
| **UC-S03** | System | Generate AI insights from patient health data correlation | P1 |
| **UC-S04** | System | Dispatch clinical alerts (sleep decline, symptom escalation) | P1 |
| **UC-S05** | Admin | Ingest and index new clinical guidelines (weekly cron) | P2 |

---

## 2. Updated ZenStack Schema

### 2.1 Complete Healthcare Models

```prisma
// ── Enums ────────────────────────────────────────────

enum MenopauseStatus {
  PREMENOPAUSAL
  PERIMENOPAUSAL
  POSTMENOPAUSAL
  EARLY_MENOPAUSE
  SURGICAL_MENOPAUSE
  UNKNOWN
}

enum SymptomType {
  hot_flush
  night_sweat
  sleep_disturbance
  mood_change
  brain_fog
  joint_pain
  vaginal_dryness
  libido_change
  fatigue
  weight_change
  headache
  palpitations
  urinary_symptoms
  skin_changes
  other
}

enum MetricSource {
  apple_health
  manual
  device
  lab_result
}

enum GuidelineSource {
  racgp
  ams
  jean_hailes
  etg
  healthdirect
  pubmed
  nps
  beyond_blue
}

enum ConsultationType {
  INITIAL
  FOLLOW_UP
  REVIEW
  EMERGENCY
}

enum MedicationStatus {
  ACTIVE
  DISCONTINUED
  PAUSED
  COMPLETED
}

enum ConsentStatus {
  PENDING
  ACTIVE
  REVOKED
  EXPIRED
}

// ── Patient & Health Models ──────────────────────────

model HealthProfile {
  id              String           @id @default(cuid())
  userId          String           @map("user_id")
  dateOfBirth     DateTime?        @map("date_of_birth") @db.Date
  sexAtBirth      String?          @map("sex_at_birth")
  menopauseStatus MenopauseStatus? @map("menopause_status")
  heightCm        Float?           @map("height_cm")
  weightKg        Float?           @map("weight_kg")
  bloodType       String?          @map("blood_type")
  allergies       String[]         @default([])
  chronicConditions String[]       @default([])  @map("chronic_conditions")
  currentMedications String[]      @default([])  @map("current_medications")
  smokingStatus   String?          @map("smoking_status")
  alcoholUnitsPerWeek Int?         @map("alcohol_units_per_week")
  exerciseMinutesPerWeek Int?      @map("exercise_minutes_per_week")
  familyHistory   Json?            @map("family_history")
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")

  symptomJournals SymptomJournal[]
  healthMetrics   HealthMetric[]
  medications     Medication[]
  labResults      LabResult[]
  consents        PatientConsent[]

  @@map("health_profiles")
}

model SymptomJournal {
  id               String       @id @default(cuid())
  healthProfileId  String       @map("health_profile_id")
  healthProfile    HealthProfile @relation(fields: [healthProfileId], references: [id], onDelete: Cascade)
  date             DateTime     @db.Date
  symptomType      SymptomType  @map("symptom_type")
  severity         Int          @default(0) // 0-10 scale
  duration         Int?         // minutes (for hot flushes)
  frequency        Int?         // count per day
  triggers         String[]     @default([])
  reliefFactors    String[]     @default([]) @map("relief_factors")
  impactOnDaily    Int?         @map("impact_on_daily") // 0-10 impact on daily activities
  notes            String?
  createdAt        DateTime     @default(now()) @map("created_at")

  @@index([healthProfileId, date])
  @@index([healthProfileId, symptomType])
  @@map("symptom_journals")
}

model HealthMetric {
  id               String        @id @default(cuid())
  healthProfileId  String        @map("health_profile_id")
  healthProfile    HealthProfile @relation(fields: [healthProfileId], references: [id], onDelete: Cascade)
  metricType       String        @map("metric_type")
  // heart_rate, resting_heart_rate, hrv, sleep_duration, sleep_quality,
  // wrist_temperature, body_temperature, steps, active_energy,
  // blood_pressure_systolic, blood_pressure_diastolic, weight, bmi,
  // blood_glucose, oxygen_saturation, respiratory_rate,
  // menstrual_flow, ovulation_test
  value            Json
  unit             String?
  source           MetricSource  @default(apple_health)
  sourceDevice     String?       @map("source_device")
  recordedAt       DateTime      @map("recorded_at")
  createdAt        DateTime      @default(now()) @map("created_at")

  @@index([healthProfileId, metricType, recordedAt])
  @@map("health_metrics")
}

// ── Medication & Treatment Models ─────────────────────

model Medication {
  id               String           @id @default(cuid())
  healthProfileId  String           @map("health_profile_id")
  healthProfile    HealthProfile    @relation(fields: [healthProfileId], references: [id], onDelete: Cascade)
  name             String
  type             String           // mht, supplement, prescription, otc
  dosage           String
  frequency        String
  route            String?          // oral, transdermal, vaginal, injection, implant
  startDate        DateTime         @map("start_date") @db.Date
  endDate          DateTime?        @map("end_date") @db.Date
  status           MedicationStatus @default(ACTIVE)
  prescribedBy     String?          @map("prescribed_by")
  notes            String?
  adherenceLog     Json             @default("[]") @map("adherence_log")
  createdAt        DateTime         @default(now()) @map("created_at")
  updatedAt        DateTime         @updatedAt @map("updated_at")

  @@index([healthProfileId, status])
  @@map("medications")
}

model LabResult {
  id               String        @id @default(cuid())
  healthProfileId  String        @map("health_profile_id")
  healthProfile    HealthProfile @relation(fields: [healthProfileId], references: [id], onDelete: Cascade)
  testName         String        @map("test_name")
  testCategory     String        @map("test_category")
  // hormone_panel, lipid_panel, thyroid, vitamin_d, iron_studies, bone_markers, general
  resultValue      String        @map("result_value")
  unit             String?
  referenceRange   String?       @map("reference_range")
  isAbnormal       Boolean       @default(false) @map("is_abnormal")
  testDate         DateTime      @map("test_date") @db.Date
  laboratory       String?
  notes            String?
  createdAt        DateTime      @default(now()) @map("created_at")

  @@index([healthProfileId, testCategory, testDate])
  @@map("lab_results")
}

// ── Clinical Models ─────────────────────────────────

model GPConsultation {
  id              String            @id @default(cuid())
  patientId       String            @map("patient_id")
  gpId            String            @map("gp_id")
  date            DateTime          @db.Date
  consultationType ConsultationType @map("consultation_type") @default(INITIAL)
  duration        Int?              // minutes
  summary         String            @db.Text
  subjectiveNote  String?           @map("subjective_note") @db.Text
  objectiveNote   String?           @map("objective_note") @db.Text
  assessmentNote  String?           @map("assessment_note") @db.Text
  planNote        String?           @map("plan_note") @db.Text
  treatmentPlan   String?           @map("treatment_plan") @db.Text
  prescriptions   String[]          @default([])
  referrals       String[]          @default([])
  followUp        DateTime?         @map("follow_up")
  mbsItems        String[]          @default([]) @map("mbs_items")
  notes           String?           @db.Text
  aiGenerated     Boolean           @default(false) @map("ai_generated")
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  @@index([patientId, date])
  @@index([gpId, date])
  @@map("gp_consultations")
}

model PatientConsent {
  id               String        @id @default(cuid())
  healthProfileId  String        @map("health_profile_id")
  healthProfile    HealthProfile @relation(fields: [healthProfileId], references: [id], onDelete: Cascade)
  gpId             String        @map("gp_id")
  consentType      String        @map("consent_type") // full_access, summary_only, symptom_data, metrics_data, medication_data
  status           ConsentStatus @default(PENDING)
  grantedAt        DateTime?     @map("granted_at")
  expiresAt        DateTime?     @map("expires_at")
  revokedAt        DateTime?     @map("revoked_at")
  createdAt        DateTime      @default(now()) @map("created_at")
  updatedAt        DateTime      @updatedAt @map("updated_at")

  @@unique([healthProfileId, gpId])
  @@map("patient_consents")
}

model ClinicalGuideline {
  id          String          @id @default(cuid())
  source      GuidelineSource
  title       String
  category    String
  content     String          @db.Text
  summary     String?         @db.Text
  version     String?
  lastUpdated DateTime        @map("last_updated")
  url         String?
  keywords    String[]        @default([])
  embedding   Unsupported("vector(1536)")?

  @@index([source, category])
  @@map("clinical_guidelines")
}

model MedicalReference {
  id       String   @id @default(cuid())
  topic    String
  subtopic String?
  content  String   @db.Text
  source   String
  url      String?
  keywords String[] @default([])

  @@index([topic])
  @@map("medical_references")
}

model HealthEducation {
  id            String   @id @default(cuid())
  title         String
  category      String   // menopause, bone_health, mental_health, cardiovascular, sexual_health, nutrition, exercise, sleep
  content       String   @db.Text
  summary       String   @db.Text
  source        String   // jean_hailes, ams, healthdirect, beyond_blue
  language      String   @default("en")
  readingLevel  String?  @map("reading_level") // easy_read, standard, clinical
  publishedAt   DateTime @map("published_at")
  reviewedAt    DateTime @map("reviewed_at")
  tags          String[] @default([])
  url           String?

  @@index([category, language])
  @@map("health_education")
}

model ScreeningResult {
  id               String        @id @default(cuid())
  healthProfileId  String        @map("health_profile_id")
  healthProfile    HealthProfile @relation(fields: [healthProfileId], references: [id], onDelete: Cascade)
  screeningType    String        @map("screening_type") // k10, phq9, gad7, menopause_rating_scale, greene_climacteric
  score            Int
  interpretation   String
  severity         String?       // low, moderate, high, severe
  completedAt      DateTime      @map("completed_at") @default(now())
  notes            String?

  @@index([healthProfileId, screeningType])
  @@map("screening_results")
}
```

### 2.2 Access Policies

```prisma
// Patient owns their data
@@allow('read', auth().tier == 'google' && future().healthProfile.userId == auth().sub)
@@allow('create,update,delete', auth().tier == 'google' && future().healthProfile.userId == auth().sub)

// GP access via active consent
@@allow('read', auth().tier == 'pin' && patientHasActiveConsent(future().healthProfileId, auth().sub))

// Public can read education and guidelines
@@allow('read', auth().tier == 'public' && (model == 'HealthEducation' || model == 'ClinicalGuideline'))
```

---

## 3. Required Services & Integrations

### 3.1 Core Services (P0)

| Service | Purpose | Integration Method | Package/API |
|---------|---------|-------------------|-------------|
| **Apple HealthKit** | Wearable data sync (sleep, HR, temp, cycles) | Native iOS → REST API bridge via `react-native-health` or HealthKit JS bridge | `react-native-health` (if React Native) or custom HealthKit→API connector |
| **OpenAI GPT-4o** | Dual-mode chatbot (patient education + GP clinical support) | SSE streaming + function calling | `openai` SDK (already in project) |
| **pgvector** | Vector embeddings for clinical guideline search | Neon Postgres pgvector extension | `@neondatabase/serverless` (already in project) |
| **ZenStack Enhanced Client** | Policy-aware DB queries with `@@allow` rules | Already configured | `@zenstackhq/runtime` (already in project) |
| **JWT Auth (jose)** | Session management, tier enforcement | Already configured | `jose` (already in project) |

### 3.2 Clinical Services (P1)

| Service | Purpose | Integration Method | Package/API |
|---------|---------|-------------------|-------------|
| **PubMed E-utilities API** | Research paper search & metadata retrieval | REST API (free, rate-limited) | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/` |
| **TGA ARTG Search** | Verify Australian-registered medicines | REST API | `https://www.tga.gov.au/api` |
| **NPS MedicineWise** | Drug interaction checking | API (may require license) | `https://api.nps.org.au` |
| **HealthDirect Symptom Checker** | Triage guidance integration | REST API | `https://developer.healthdirect.gov.au` |
| **MBS Online** | Medicare Benefits Schedule item lookup | REST/CSV | `http://www.mbsonline.gov.au/` |

### 3.3 Integrations (P2)

| Service | Purpose | Integration Method |
|---------|---------|-------------------|
| **Apple Health Sharing** | Patient→GP data sharing via Health app | HealthKit `HKHealthStore` sharing API |
| **My Health Record** | Australian national e-health record | HI Service + My Health Record APIs |
| **HealthEngine / HotDoc** | GP appointment booking | API partnership |
| **Twilio / SendGrid** | SMS/email medication reminders | REST API |
| **Stripe** | GP subscription/practice billing (if monetized) | Stripe Connect |

### 3.4 New npm Dependencies

```json
{
  "dependencies": {
    "openai": "^4.80.0",
    "pgvector": "^0.2.0",
    "date-fns": "^4.1.0",
    "recharts": "^2.15.0",
    "@react-native-health/core": "^1.0.0"
  },
  "devDependencies": {
    "@types/pgvector": "^0.2.0"
  }
}
```

---

## 4. API Route Architecture

### 4.1 Patient Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `POST /api/health/profile` | POST | Create/update health profile | google |
| `GET /api/health/profile` | GET | Get own health profile | google |
| `POST /api/health/symptoms` | POST | Log symptom entry | google |
| `GET /api/health/symptoms?from={date}&to={date}` | GET | Get symptom journal entries | google |
| `POST /api/health/metrics/sync` | POST | Sync Apple Health data batch | google |
| `GET /api/health/metrics?type={type}&from={date}&to={date}` | GET | Get health metrics | google |
| `GET /api/health/insights` | GET | AI-generated health insights | google |
| `POST /api/health/screening` | POST | Submit mental health screening | google |
| `GET /api/health/screening?type={k10\|phq9\|gad7}` | GET | Get screening results | google |
| `POST /api/health/medications` | POST | Add medication | google |
| `GET /api/health/medications` | GET | Get medication list | google |
| `POST /api/health/consent` | POST | Grant GP data access consent | google |
| `GET /api/health/export/summary` | GET | Generate GP prep PDF | google |
| `POST /api/health/lab-results` | POST | Add lab result (manual entry) | google |

### 4.2 GP Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `GET /api/gp/patients?consented=true` | GET | List consented patients | pin |
| `GET /api/gp/patients/{id}/dashboard` | GET | Patient health dashboard | pin |
| `GET /api/gp/patients/{id}/summary` | GET | AI-generated pre-consult summary | pin |
| `POST /api/gp/consultations` | POST | Create consultation record | pin |
| `GET /api/gp/consultations?patientId={id}` | GET | Get consultation history | pin |
| `POST /api/gp/chat` | POST | GP clinical support chat (SSE) | pin |
| `POST /api/gp/referral-letter` | POST | Generate specialist referral letter | pin |
| `GET /api/gp/guidelines?query={text}` | GET | Semantic search clinical guidelines | pin |
| `POST /api/gp/risk-calculator` | POST | Calculate clinical risk scores | pin |
| `POST /api/gp/drug-interactions` | POST | Check drug interactions | pin |
| `GET /api/gp/evidence-digest` | GET | Weekly research digest | pin |

### 4.3 Public Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `GET /api/health/education?category={cat}&lang={lang}` | GET | Health education content | public |
| `GET /api/health/symptom-checker?query={text}` | GET | Basic symptom information | public |

---

## 5. Knowledge Base Ingestion Pipeline

### 5.1 Sources & Prioritization

```
Phase 1 (Week 1-2): Foundation Knowledge
├── Jean Hailes Menopause Fact Sheets → HealthEducation + KnowledgeSnippet
├── AMS Information Sheets (Top 10) → ClinicalGuideline
└── Jean Hailes Symptom Checklist → ScreeningResult template

Phase 2 (Week 3-4): Clinical Depth
├── RACGP Red Book (Preventive Activities) → ClinicalGuideline
├── AMS Information Sheets (Remaining 15+) → ClinicalGuideline
└── Beyond Blue Perimenopausal Depression Guide → ClinicalGuideline

Phase 3 (Week 5-6): Advanced
├── Therapeutic Guidelines (eTG) Menopause → ClinicalGuideline
├── PubMed — Menopause RCTs (last 3 years) → MedicalReference
└── Osteoporosis Australia Guidelines → ClinicalGuideline

Phase 4 (Week 7-8): Ongoing
├── NPS MedicineWise Decision Tools → MedicalReference
├── HealthDirect Symptom Checker Logic → KnowledgeSnippet
└── Weekly PubMed cron → MedicalReference
```

### 5.2 RAG Pipeline Architecture

```
Source Documents (PDF/HTML/MD)
        │
        ▼
┌───────────────────┐
│  Ingestion Service  │ ← scripts/ingest-guidelines.ts
│  - PDF parser       │
│  - HTML scraper     │
│  - MD loader        │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  Chunking Pipeline  │
│  - 512-token chunks │
│  - 128-token overlap│
│  - Metadata tagging │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  Embedding Service  │
│  - text-embedding   │
│    -3-small (1536d) │
│  - Batch processing │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  Vector Store       │
│  - pgvector (Neon)  │
│  - IVFflat index    │
│  - Cosine similarity│
└───────────────────┘
```

---

## 6. New Source Files Required

### 6.1 Directory Structure

```
src/
├── app/api/
│   ├── health/
│   │   ├── profile/route.ts
│   │   ├── symptoms/route.ts
│   │   ├── metrics/
│   │   │   ├── route.ts
│   │   │   └── sync/route.ts
│   │   ├── insights/route.ts
│   │   ├── screening/route.ts
│   │   ├── medications/route.ts
│   │   ├── consent/route.ts
│   │   ├── export/summary/route.ts
│   │   ├── education/route.ts
│   │   └── lab-results/route.ts
│   └── gp/
│       ├── patients/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── dashboard/route.ts
│       │       └── summary/route.ts
│       ├── consultations/route.ts
│       ├── chat/route.ts
│       ├── guidelines/route.ts
│       ├── risk-calculator/route.ts
│       ├── drug-interactions/route.ts
│       ├── referral-letter/route.ts
│       └── evidence-digest/route.ts
├── domain/
│   └── health/
│       ├── health-profile-service.ts        // CRUD for HealthProfile
│       ├── symptom-service.ts                // SymptomJournal CRUD + analytics
│       ├── health-metrics-service.ts         // Apple Health sync + query
│       ├── medication-service.ts             // Medication CRUD
│       ├── lab-result-service.ts             // Lab result management
│       ├── consent-service.ts                // Patient→GP consent management
│       ├── screening-service.ts              // Mental health screenings
│       ├── clinical-guideline-service.ts     // Guideline ingestion + search
│       ├── health-insight-engine.ts          // AI correlation analysis
│       ├── risk-calculator.ts                // FRAX, cardiovascular, breast cancer
│       ├── drug-interaction-checker.ts       // MHT + medication interactions
│       ├── consultation-service.ts           // GP consultation records
│       ├── referral-generator.ts             // Specialist referral letters
│       └── evidence-digest-service.ts        // PubMed digest generation
├── components/
│   └── health/
│       ├── health-metrics-cards.tsx
│       ├── symptom-timeline.tsx
│       ├── daily-symptom-form.tsx
│       ├── symptom-trends-chart.tsx
│       ├── ai-insights-panel.tsx
│       ├── gp-summary-generator.tsx
│       ├── consultation-checklist.tsx
│       ├── patient-list.tsx
│       ├── clinical-alerts.tsx
│       ├── guideline-browser.tsx
│       ├── drug-interaction-checker.tsx
│       ├── risk-calculator.tsx
│       ├── soap-note-generator.tsx
│       ├── referral-letter-generator.tsx
│       └── health-education-library.tsx
├── store/
│   └── health/
│       ├── healthApi.ts                      // RTK Query for health endpoints
│       ├── symptomSlice.ts                   // Patient symptom state
│       ├── healthMetricsSlice.ts             // Apple Health metrics state
│       └── clinicalSlice.ts                  // GP clinical tools state
└── lib/
    └── health/
        ├── healthkit.ts                      // Apple HealthKit integration
        ├── screening-tools.ts                // K10, PHQ-9, GAD-7 scoring
        ├── clinical-scoring.ts               // FRAX, cardiovascular risk
        └── embedding.ts                      // pgvector helpers

scripts/
├── ingest-guidelines.ts                      // Clinical guideline ingestion
├── seed-health-education.ts                  // Health education content seeder
└── weekly-evidence-digest.ts                 // PubMed digest cron job
```

---

## 7. MVP Implementation Roadmap

### Phase 0: Foundation (Week 1-2) — GOAL: Core data models + basic UI

| Day | Task | Deliverable |
|-----|------|------------|
| 1-2 | Create `healthcare-schema.zmodel` extensions | ZenStack schema with all 10 healthcare models |
| 2-3 | Run `zen:generate` + `db:migrate` to create new tables | Tables exist in Neon |
| 3-4 | Implement `health-profile-service.ts` + `POST/GET /api/health/profile` | Health profile CRUD |
| 4-5 | Implement `symptom-service.ts` + `POST/GET /api/health/symptoms` | Symptom journal API |
| 5-6 | Build `daily-symptom-form.tsx` + `symptom-timeline.tsx` MUI components | UI for logging and viewing symptoms |
| 6-7 | Build `health-dashboard` page with `health-metrics-cards.tsx` | Patient health dashboard |
| 7-8 | Implement basic patient-mode chatbot (`POST /api/health/chat` → OpenAI with knowledge base) | AI can answer menopause questions |
| 8-9 | Seed Jean Hailes fact sheets into `health_education` + `knowledge_snippets` | 30+ education articles available |
| 9-10 | Wire JWT auth tiers to healthcare routes | `google` (patient), `pin` (GP), `public` (education) |

**Phase 0 Gate**: Patient can create profile, log symptoms, view dashboard, and chat with AI about menopause.

### Phase 1: Intelligence (Week 3-5) — GOAL: AI insights + Apple Health

| Day | Task | Deliverable |
|-----|------|------------|
| 11-12 | Implement `POST /api/health/metrics/sync` for Apple Health batch upload | Backend accepts HealthKit data |
| 12-13 | Build `healthkit.ts` integration layer (HealthKit → REST API bridge) | Apple Watch data flows into ManaposeGP |
| 13-14 | Implement `health-insight-engine.ts` (GPT-4o correlation analysis) | AI detects sleep↔hot flush patterns |
| 14-15 | Build `ai-insights-panel.tsx` component | Patient sees AI-generated insights |
| 15-16 | Implement `symptom-trends-chart.tsx` with recharts | Interactive symptom trend visualization |
| 16-17 | Implement `gp-summary-generator.tsx` + `GET /api/health/export/summary` | Patient generates GP prep PDF |
| 17-18 | Seed AMS Information Sheets into `clinical_guidelines` | 25 clinical guidelines available |
| 18-19 | Implement `GET /api/gp/guidelines?query=` with pgvector semantic search | GP can search guidelines |
| 19-20 | Build GP-mode chatbot (`POST /api/gp/chat` with AMS/RACGP context) | GP gets evidence-based responses |

**Phase 1 Gate**: Patient gets AI insights from wearable data + can generate GP prep summary. GP can query clinical guidelines.

### Phase 2: Clinical Tools (Week 6-8) — GOAL: GP clinical decision support

| Day | Task | Deliverable |
|-----|------|------------|
| 21-22 | Implement `patient-consent` model + `POST /api/health/consent` | Patient grants GP data access |
| 23-24 | Build `GET /api/gp/patients/{id}/dashboard` + `patient-list.tsx` | GP views consented patient data |
| 25-26 | Implement `POST /api/gp/consultations` + SOAP note template | Consultation record with AI-generated notes |
| 27-28 | Build `soap-note-generator.tsx` component | GP gets AI scribe support |
| 29-30 | Implement `risk-calculator.ts` (FRAX, cardiovascular, breast cancer) | Clinical risk scores |
| 30-31 | Build `risk-calculator.tsx` + `drug-interaction-checker.tsx` components | GP tools in UI |
| 32-33 | Implement `medication-service.ts` + `POST/GET /api/health/medications` | Patient medication tracking |
| 34-35 | Implement `screening-service.ts` (K10, PHQ-9, GAD-7) | Mental health screening |
| 35-36 | Seed RACGP Red Book + Beyond Blue content | Comprehensive clinical knowledge base |

**Phase 2 Gate**: Full GP workflow — view patient, get AI summary, query guidelines, calculate risk, document consultation.

### Phase 3: Ecosystem (Week 9-12) — GOAL: Full platform

| Day | Task | Deliverable |
|-----|------|------------|
| 37-40 | Implement `referral-generator.ts` + `POST /api/gp/referral-letter` | Specialist referral letters |
| 41-44 | Implement `evidence-digest-service.ts` (PubMed cron + GPT summarization) | Weekly research digest |
| 44-47 | Build `health-education-library.tsx` + multi-language support | Patient education hub |
| 48-50 | Implement treatment response tracking (`symptom_trends_chart` before/after MHT) | Before/after comparison |
| 51-53 | Build `clinical-alerts.tsx` (sleep decline, HRV changes, symptom escalation) | Proactive clinical alerts |
| 53-55 | Add Apple Health Sharing (patient→GP via Health app) | Direct HealthKit sharing |
| 56-57 | Implement MBS billing assistant for GP consults | Medicare item number guidance |
| 58-59 | Build population health analytics (GP dashboard with panel metrics) | Practice-level insights |
| 59-60 | Full integration testing, security review, deployment | Production-ready MVP |

**Phase 3 Gate**: Complete dual-platform — patient self-management + GP clinical decision support, with research digest and analytics.

---

## 8. Success Metrics (MVP)

| Metric | Target | Measurement |
|--------|--------|------------|
| Patient onboarding | 80% complete health profile within first session | DB completion rate |
| Symptom journaling | 60% daily logging rate over 4 weeks | Retention metric |
| GP prep usage | 70% of patients export summary before appointments | Export event count |
| GP guideline queries | Average 2+ queries per menopause consult | Chat log analytics |
| AI response accuracy | 95%+ responses cite valid clinical sources | Citation validation |
| Consultation time saving | 3-5 minutes saved per menopause consult (from 15 min) | GP survey |
| Patient satisfaction | NPS > 40 on "helpfulness for managing menopause" | In-app survey |

---

## 9. Tech Stack Summary

| Layer | Technology | Status |
|-------|-----------|--------|
| Framework | Next.js 16 App Router (Turbopack) | Already configured |
| Language | TypeScript strict | Already configured |
| ORM/Schema | ZenStack v3 + Prisma 6.12.0 | Already configured |
| Database | Neon Postgres + pgvector | Already configured (pgvector to enable) |
| UI | MUI v7 + Recharts | Already configured (+ add recharts) |
| State | RTK Query + uiSlice + chatStreamSlice | Already configured |
| Auth | JWT `manaposegp.session` (jose) | Already configured |
| AI | OpenAI GPT-4o + text-embedding-3-small | Already configured |
| Health Data | Apple HealthKit (native → REST bridge) | New integration |
| Clinical Data | PubMed, AMS, RACGP, Jean Hailes, eTG | New ingestion pipeline |
| Charts | Recharts (symptom trends, health metrics) | New dependency |
| PDF Export | Puppeteer (already in stack) | Already configured |
| Deploy | Vercel | Already configured |
| Testing | Vitest + RTL | Already configured |

---

*Document version: 1.0 | Date: July 2026 | Next review: End of Phase 0 (Week 2)*
