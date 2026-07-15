# ManaposeGP — Women's Health & GP Support Platform Analysis

## Executive Summary

This document maps the ManaposeGP platform architecture (Next.js 16, ZenStack, MUI v7, hybrid Redux, AI chatbot) to the domain of women's health — specifically menopause management — and general practitioner (GP) clinical support. The analysis covers Australian healthcare resources, Apple Health/Watch integration, dual-mode AI chatbot strategy, and a comprehensive knowledge base plan to make ManaposeGP the single source of truth for patients and GPs.

---

## 1. Domain Landscape — Australian Healthcare Context

### 1.1 Key Australian Resources to Onboard

| Organisation | Role | Content Type |
|-------------|------|-------------|
| **Jean Hailes for Women's Health** | National women's health authority | Patient fact sheets, symptom checklists, menopause education, 20-language resources, Her Health Check tool |
| **Australasian Menopause Society (AMS)** | Clinical specialist body | GP information sheets, MHT prescribing guides, practitioner directory, CPD resources |
| **RACGP** | GP professional college | Red Book (preventive activities), clinical guidelines, Choosing Wisely, AI scribe guidance, telehealth standards, health app recommendations |
| **HealthDirect Australia** | Government health service | Symptom checker, service finder, health topics, 24/7 nurse line |
| **Therapeutic Guidelines (eTG)** | Prescribing reference | Evidence-based treatment protocols, MHT dosing, contraindications |
| **NPS MedicineWise** | Quality use of medicines | Decision support tools, MedicineInsight data, deprescribing guides |

### 1.2 The GP Consultation Challenge

Australian GPs face time-constrained 15-minute consultations where menopause is often one of many issues. Studies show:

- **3 in 4 women** experience menopausal symptoms; **1 in 4** have severe symptoms
- Average age of natural menopause: **51 years** (range 45-55)
- **1 in 5** experience premature/early menopause (before age 45)
- GPs receive **limited menopause-specific training** — Jean Hailes offers a dedicated Menopause Education Program for CPD
- **Mental health impact**: 50%+ of symptomatic women report mental/emotional wellbeing affected
- **Average diagnosis delay**: 2-3 years for many women navigating symptoms without clear menopause attribution

### 1.3 Current Technology Gaps

| Gap | Problem | ManaposeGP Solution |
|-----|---------|-------------------|
| Symptom tracking fragmented | Women use notes, spreadsheets, or nothing | Structured daily symptom journal with Apple Health integration |
| No pre-consultation prep | 15-min consult spent on history-taking | AI-guided symptom checklist auto-generates a GP-ready summary |
| Post-consultation disconnect | Patients forget advice, don't track outcomes | Post-consult summary + treatment plan + reminders via chatbot |
| GP data overload | No unified view of patient trends over time | Longitudinal dashboard with cycle tracking, symptom trends, wearable data |
| Guideline access friction | GPs search multiple sources during consults | Single chatbot interface queries RACGP, AMS, eTG in real-time |
| No wearable integration | Health data siloed in Apple Health/Watch | Apple HealthKit integration pulls sleep, HR, activity into clinical view |

---

## 2. Apple Health / Watch Integration Architecture

### 2.1 Data Types to Integrate

HealthKit data types relevant to menopause management:

| Data Type | HealthKit Identifier | Clinical Value |
|-----------|---------------------|---------------|
| **Heart Rate** | `HKQuantityTypeIdentifierHeartRate` | HRV changes during perimenopause; hot flush correlation |
| **Resting Heart Rate** | `HKQuantityTypeIdentifierRestingHeartRate` | Baseline shifts with hormonal changes |
| **Sleep Analysis** | `HKCategoryTypeIdentifierSleepAnalysis` | Sleep disruption — #1 menopause complaint |
| **Body Temperature** | `HKQuantityTypeIdentifierBodyTemperature` | Basal body temp tracking; hot flush episodes via Apple Watch Series 8+ |
| **Wrist Temperature** | `HKQuantityTypeIdentifierAppleSleepingWristTemperature` | Nightly temp shifts correlate with hormonal cycles |
| **Step Count** | `HKQuantityTypeIdentifierStepCount` | Activity impact on symptom severity |
| **Menstruation** | `HKCategoryTypeIdentifierMenstrualFlow` | Cycle tracking → perimenopause detection |
| **Cervical Mucus Quality** | `HKCategoryTypeIdentifierCervicalMucusQuality` | Fertility/perimenopause indicators |
| **Ovulation Test Result** | `HKCategoryTypeIdentifierOvulationTestResult` | Perimenopause confirmation |
| **Sexual Activity** | `HKCategoryTypeIdentifierSexualActivity` | Libido/sexual health tracking |
| **Weight** | `HKQuantityTypeIdentifierBodyMass` | Weight changes common in menopause |

### 2.2 Integration Architecture

```
┌─────────────────────┐     HealthKit API      ┌──────────────────────┐
│  Apple Watch/iPhone │ ──────────────────────→ │  ManaposeGP Backend  │
│  - Heart Rate        │     (OAuth + native)    │  POST /api/health/   │
│  - Sleep Data        │                         │  sync                │
│  - Wrist Temp        │                         │                      │
│  - Activity Data     │                         │  ZenStack DB:        │
│  - Cycle Tracking    │                         │  health_metrics table│
└─────────────────────┘                         └──────────────────────┘
                                                          │
                                                          ▼
                                               ┌──────────────────────┐
                                               │  AI Analysis Engine   │
                                               │  - Symptom correlation│
                                               │  - Trend detection    │
                                               │  - Alert generation   │
                                               └──────────────────────┘
                                                          │
                                                          ▼
                                               ┌──────────────────────┐
                                               │  Dual Chatbot Output  │
                                               │  Patient: "Your sleep │
                                               │  quality dropped 30%   │
                                               │  this week..."        │
                                               │  GP: "Patient shows   │
                                               │  HRV decline + sleep  │
                                               │  disruption pattern   │
                                               │  consistent with..."  │
                                               └──────────────────────┘
```

### 2.3 Privacy & Consent Architecture

- **HealthKit data stays on-device** until explicit user consent for sharing
- ManaposeGP uses per-category authorization (ask only for relevant types)
- All health data encrypted at rest (AES-256-GCM) and in transit (TLS 1.3)
- GP access requires patient consent via the JWT tier system (auth tier: `google` / `pin`)
- Data retention: configurable by patient (default: 24 months rolling)
- Compliance: Australian Privacy Act 1988, My Health Record Act 2012, GDPR-equivalent standards

---

## 3. Dual-Mode AI Chatbot Design

### 3.1 Mode A: Patient Self-Service Assistant

**Tone**: Empathetic, educational, action-oriented. Never diagnoses — always directs to GP.

**Core capabilities**:

| Feature | Implementation | Example |
|---------|---------------|---------|
| **Symptom Checker** | GPT-4o-mini + knowledge base (Jean Hailes, AMS) | "I'm 47 and my periods are irregular — what should I track?" |
| **GP Prep Assistant** | Auto-generates structured summary from symptom journal | "Here's your pre-consultation summary: irregular cycles (3 months), hot flushes (4-6/day), sleep score 55/100 ↓" |
| **Treatment Explainer** | Explains MHT options, non-hormonal alternatives, lifestyle | "MHT comes in tablets, patches, gels, and sprays. Your GP will help choose based on..." |
| **Lifestyle Coach** | Sleep hygiene, exercise, nutrition, stress management | "Your sleep data shows 5.2hrs avg — here's a CBT-I based sleep plan" |
| **Mental Health Support** | Anxiety/depression screening (K10, PHQ-9), coping strategies | "Your K10 score is 28 — this is in the moderate-high range. Let's prepare to discuss with your GP" |
| **Medication Reminder** | Push notifications for MHT doses, follow-ups | "Time for your estradiol patch change" |
| **Community Connector** | Links to Jean Hailes, AMS, Beyond Blue resources | "Jean Hailes has a fantastic podcast on menopause at work" |

**Safety guardrails**:
- "I'm your health assistant, not a doctor. Always discuss treatment decisions with your GP."
- Red flag detection: "postmenopausal bleeding" → "This requires urgent GP review. Would you like me to help you book?"
- Never recommend specific medications or dosages

### 3.2 Mode B: GP Clinical Decision Support

**Tone**: Clinical, evidence-based, concise. Cites sources.

**Core capabilities**:

| Feature | Implementation | Example |
|---------|---------------|---------|
| **Guideline Query** | RAG over RACGP Red Book, AMS sheets, eTG | "What's the recommended MHT starting dose for a 52yo with intact uterus?" → cites AMS Info Sheet |
| **Risk Calculator** | Cardiovascular, osteoporosis (FRAX), breast cancer (Gail model) | "Patient: 55yo, BMI 28, smoker, family history — 10yr fracture risk: 18% (FRAX)" |
| **Drug Interaction Check** | MHT + existing medications cross-reference | "Patient on venlafaxine + starting estradiol — no significant interaction, monitor for..." |
| **Patient Summary** | AI-curated longitudinal view from HealthKit + symptom journal | "3-month trend: sleep ↓12%, HRV ↓8%, hot flushes ↑ from 2 to 6/day. Recommend MHT review." |
| **Consultation Scribe** | AI note-taking during consult (opt-in, consent-based) | Auto-generates clinical notes in SOAP format |
| **Referral Assistant** | Generates specialist referral letters with relevant data | "Referral to gynaecologist: 49yo, perimenopausal, severe VMS, failed non-hormonal..." |
| **Evidence Updates** | Weekly digest of new menopause research from PubMed, AJGP | "New RCT: fezolinetant shows 55% reduction in VMS frequency at 12 weeks" |

**Citation standards**:
- Every recommendation cites source (e.g., "AMS Information Sheet: Combined MHT, 2024")
- Confidence levels: "Strong evidence (RCT)" vs "Expert consensus" vs "Emerging evidence"
- Drug info cross-referenced with Australian Register of Therapeutic Goods (ARTG)

### 3.3 Chatbot Architecture

```
                    ┌──────────────────────────────┐
                    │       Chat Interface (MUI)     │
                    │   Patient Mode  │  GP Mode     │
                    └────────┬───────────────────────┘
                             │
                    ┌────────▼───────────────────────┐
                    │      Chat Orchestrator          │
                    │  - Mode detection (patient/GP)   │
                    │  - Tier enforcement (JWT auth)   │
                    │  - Context assembly              │
                    └────────┬───────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌─────────────────┐ ┌───────────────┐ ┌──────────────────┐
│ OpenAI GPT-4o   │ │  RAG Pipeline  │ │  Health Data      │
│ - Streaming     │ │  - Jean Hailes │ │  - Apple HealthKit│
│ - Session tools │ │  - AMS sheets  │ │  - Symptom journal│
│ - Function calls│ │  - RACGP Red   │ │  - Lab results    │
│                 │ │    Book        │ │  - Medications    │
└─────────────────┘ │  - eTG         │ └──────────────────┘
                    │  - PubMed      │
                    └───────────────┘
```

---

## 4. Database Schema Extensions

### 4.1 New ZenStack Models

```prisma
// ── Patient health data ──

model HealthProfile {
  id           String   @id @default(cuid())
  userId       String   @map("user_id")
  dateOfBirth  DateTime @map("date_of_birth") @db.Date
  sexAtBirth   String   @map("sex_at_birth")
  menopauseStatus MenopauseStatus? @map("menopause_status")

  @@map("health_profiles")
}

enum MenopauseStatus {
  PREMENOPAUSAL
  PERIMENOPAUSAL
  POSTMENOPAUSAL
  EARLY_MENOPAUSE
  SURGICAL_MENOPAUSE
  UNKNOWN
}

model SymptomJournal {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  date        DateTime @db.Date
  symptomType String   @map("symptom_type") // hot_flush, night_sweat, sleep, mood, brain_fog, joint_pain, vaginal_dryness, libido
  severity    Int      @default(0) // 0-10 scale
  duration    Int?     // minutes
  triggers    String[] @default([])
  notes       String?
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([userId, date])
  @@map("symptom_journals")
}

model HealthMetric {
  id            String   @id @default(cuid())
  userId        String   @map("user_id")
  metricType    String   @map("metric_type") // heart_rate, sleep, temperature, steps, weight, hrv, blood_pressure
  value         Json
  source        String   @default("apple_health") // apple_health, manual, device
  recordedAt    DateTime @map("recorded_at")
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([userId, metricType, recordedAt])
  @@map("health_metrics")
}

model GPConsultation {
  id           String   @id @default(cuid())
  patientId    String   @map("patient_id")
  gpId         String   @map("gp_id")
  date         DateTime @db.Date
  summary      String   @db.Text
  treatmentPlan String? @map("treatment_plan") @db.Text
  prescriptions String[] @default([])
  followUp     DateTime? @map("follow_up")
  notes        String?  @db.Text
  createdAt    DateTime @default(now()) @map("created_at")

  @@map("gp_consultations")
}

model ClinicalGuideline {
  id          String   @id @default(cuid())
  source      String   // "racgp", "ams", "jean_hailes", "etg", "pubmed"
  title       String
  category    String   // "menopause", "cardiovascular", "mental_health", "preventive"
  content     String   @db.Text
  version     String?
  lastUpdated DateTime @map("last_updated")
  url         String?

  @@index([source, category])
  @@map("clinical_guidelines")
}

model MedicalReference {
  id          String   @id @default(cuid())
  topic       String
  subtopic    String?
  content     String   @db.Text
  source      String   // "ams_info_sheet", "racgp_guideline", "jean_hailes_factsheet"
  url         String?
  keywords    String[] @default([])
  embedding   Unsupported("vector(1536)")?

  @@map("medical_references")
}
```

---

## 5. Knowledge Base Strategy

### 5.1 Sources to Inboard

Priority order for knowledge base population:

| Priority | Source | Format | Volume | Integration Method |
|----------|--------|--------|--------|-------------------|
| **P0** | AMS Information Sheets (25+) | PDF/HTML | ~500 pages | RAG pipeline with chunking |
| **P0** | Jean Hailes Fact Sheets | HTML/MD | ~200 pages | Scrape → markdown → seed `knowledge_snippets` |
| **P0** | RACGP Red Book (Preventive Activities) | PDF | ~400 pages | Structured extraction → `clinical_guidelines` |
| **P1** | Therapeutic Guidelines (eTG) — Menopause | API/licensed | ~100 pages | Licensed API integration |
| **P1** | Jean Hailes Menopause Education Program | Online course | ~20 modules | CPD-referenced content extraction |
| **P1** | NPS MedicineWise decision tools | API | Various | Decision algorithm encoding |
| **P2** | PubMed — menopause RCTs (last 5 years) | Search API | ~200 papers | Automated search → summarization |
| **P2** | Australian Medicines Handbook | Licensed | ~50 drug profiles | Drug interaction database |
| **P3** | Consumer forums (moderated) | Scraped | Ongoing | Sentiment analysis + FAQ extraction |

### 5.2 RAG Pipeline Design

```
┌────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Source Ingestion│ ──→ │ Chunk & Embed    │ ──→ │ Vector Store      │
│ - PDF parser    │     │ - 512-token      │     │ - pgvector (Neon)  │
│ - HTML scraper  │     │   chunks         │     │ - 1536-dim OpenAI  │
│ - API fetcher   │     │ - 128-token      │     │   embeddings       │
│                 │     │   overlap        │     │                    │
└────────────────┘     └─────────────────┘     └──────────────────┘
                                                          │
                                                          ▼
┌────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Query Processing│ ←── │ Hybrid Search    │ ←── │ Chat Interface    │
│ - Query rewriter│     │ - Vector (top-5) │     │ "What's the first- │
│ - Citation      │     │ - Keyword (top-3)│     │  line MHT for..."  │
│   formatter     │     │ - Re-rank        │     │                    │
└────────────────┘     └─────────────────┘     └──────────────────┘
```

---

## 6. Page Catalog — Healthcare Edition

### 6.1 New Pages

```typescript
// src/lib/page-catalog.ts additions

export const HEALTHCARE_PAGE_CATALOG: Record<string, PageDefinition> = {
  // Patient-facing pages
  'health-dashboard': {
    slug: 'health-dashboard',
    title: 'My Health Dashboard',
    navLabel: 'Health',
    showInNav: true,
    authTier: 'google',
    sections: [
      { blockType: 'health_metrics_cards', config: { variant: 'patient' } },
      { blockType: 'symptom_timeline', config: {} },
      { blockType: 'ai_insights_panel', config: { mode: 'patient' } },
    ],
  },
  'symptom-journal': {
    slug: 'symptom-journal',
    title: 'Symptom Journal',
    navLabel: 'Journal',
    showInNav: true,
    authTier: 'google',
    sections: [
      { blockType: 'daily_symptom_form', config: {} },
      { blockType: 'symptom_trends_chart', config: {} },
      { blockType: 'gp_summary_generator', config: {} },
    ],
  },
  'gp-prep': {
    slug: 'gp-prep',
    title: 'GP Consultation Prep',
    navLabel: 'GP Prep',
    showInNav: true,
    authTier: 'google',
    sections: [
      { blockType: 'consultation_checklist', config: {} },
      { blockType: 'symptom_summary_export', config: {} },
      { blockType: 'chat_panel', config: { mode: 'pre-consult' } },
    ],
  },

  // GP-facing pages
  'gp-dashboard': {
    slug: 'gp-dashboard',
    title: 'Clinical Dashboard',
    navLabel: 'Clinical',
    showInNav: true,
    authTier: 'pin',
    sections: [
      { blockType: 'patient_list', config: {} },
      { blockType: 'clinical_alerts', config: {} },
      { blockType: 'guideline_search', config: {} },
    ],
  },
  'clinical-reference': {
    slug: 'clinical-reference',
    title: 'Clinical Reference',
    navLabel: 'Reference',
    showInNav: true,
    authTier: 'pin',
    sections: [
      { blockType: 'guideline_browser', config: { sources: ['racgp', 'ams', 'jean_hailes', 'etg'] } },
      { blockType: 'drug_interaction_checker', config: {} },
      { blockType: 'risk_calculator', config: { models: ['frax', 'gail', 'qrisk3'] } },
    ],
  },
  'consultation-assist': {
    slug: 'consultation-assist',
    title: 'Consultation Assistant',
    navLabel: 'Consult',
    showInNav: true,
    authTier: 'pin',
    sections: [
      { blockType: 'chat_panel', config: { mode: 'gp-assist' } },
      { blockType: 'patient_context_panel', config: {} },
      { blockType: 'soap_note_generator', config: {} },
    ],
  },
};
```

### 6.2 New Block Types

```typescript
type HealthcareBlockType =
  | 'health_metrics_cards'
  | 'symptom_timeline'
  | 'ai_insights_panel'
  | 'daily_symptom_form'
  | 'symptom_trends_chart'
  | 'gp_summary_generator'
  | 'consultation_checklist'
  | 'symptom_summary_export'
  | 'patient_list'
  | 'clinical_alerts'
  | 'guideline_search'
  | 'guideline_browser'
  | 'drug_interaction_checker'
  | 'risk_calculator'
  | 'patient_context_panel'
  | 'soap_note_generator';
```

---

## 7. Day-to-Day Challenges & AI Solutions

### 7.1 Patient Challenges

| Challenge | AI Solution | Technical Implementation |
|-----------|------------|------------------------|
| **"Is this menopause or something else?"** | Symptom checker with differential analysis | RAG over Jean Hailes + AMS; AI flags red-flag symptoms for urgent GP review |
| **"I forget to track my symptoms"** | Passive Apple Watch data + evening push notification | HealthKit sync → auto-populate journal; 8PM reminder: "How were your hot flushes today?" |
| **"My GP doesn't specialise in menopause"** | GP finder + AMS practitioner directory integration | Geolocated search with AMS credential filtering |
| **"I can't remember what the doctor said"** | Post-consultation AI summary + treatment plan | SOAP note parser → patient-friendly summary → push to app |
| **"My symptoms are affecting my work"** | Workplace accommodation template generator | AI drafts reasonable adjustment letter citing Fair Work Act |
| **"I feel alone in this"** | Community + podcast/literature recommendations | Jean Hailes podcast links, AMS webinar calendar, moderated community feed |
| **"Will this treatment work for me?"** | Treatment response tracker | Before/after symptom severity visualization with timeline |

### 7.2 GP Challenges

| Challenge | AI Solution | Technical Implementation |
|-----------|------------|------------------------|
| **"15 minutes isn't enough for menopause"** | Pre-consult patient summary | Patient completes checklist → AI generates structured SOAP-format summary |
| **"Which MHT option is best for this patient?"** | Decision support with contraindication checking | Multi-source RAG (AMS, eTG) + patient comorbidity cross-reference |
| **"I'm not up to date on latest evidence"** | Weekly evidence digest | PubMed API → GPT-4o summarization → ranked by clinical relevance |
| **"Is this symptom menopause or something else?"** | Differential diagnosis assistant | Structured clinical reasoning with Red Book preventive screening integration |
| **"Medicare item numbers are confusing"** | MBS billing assistant | Rule-based + AI guidance on appropriate item numbers for menopause consults |
| **"I need to refer but don't know who"** | Referral letter auto-generator + AMS directory | Patient data → structured referral with relevant clinical history |
| **"Documentation takes half my consult time"** | AI scribe (opt-in, HIPAA-compliant) | Voice → SOAP note → auto-file to clinical record |

---

## 8. Implementation Phases

### Phase 1: Foundation (Weeks 1-4)
- [ ] Set up `health_profiles`, `symptom_journals`, `health_metrics` DB tables
- [ ] Apple HealthKit integration (read-only, per-category consent)
- [ ] Basic symptom journal UI (manual entry)
- [ ] Knowledge base ingestion: Jean Hailes fact sheets → `knowledge_snippets`
- [ ] Patient-mode chatbot with Jean Hailes + AMS content
- [ ] JWT tier: patient (`google`) vs GP (`pin`)

### Phase 2: Intelligence (Weeks 5-8)
- [ ] RAG pipeline with pgvector embeddings
- [ ] AMS Information Sheets + RACGP Red Book ingestion
- [ ] GP consultation summary generator (patient → structured summary)
- [ ] Symptom trend analysis with HealthKit data correlation
- [ ] Clinical alerts: sleep decline, HRV changes, symptom escalation
- [ ] GP-mode chatbot with guideline query capability

### Phase 3: Clinical Decision Support (Weeks 9-12)
- [ ] Drug interaction checker (MHT + common medications)
- [ ] Risk calculators: FRAX (osteoporosis), cardiovascular, breast cancer
- [ ] Therapeutic Guidelines (eTG) licensed integration
- [ ] AI scribe for GP consultations (opt-in)
- [ ] Referral letter auto-generator with AMS directory
- [ ] Weekly evidence digest from PubMed

### Phase 4: Ecosystem (Weeks 13-16)
- [ ] Patient community features (moderated forum, shared experiences)
- [ ] Multi-language support (20 languages per Jean Hailes)
- [ ] Aboriginal and Torres Strait Islander health content
- [ ] Workplace resources (Fair Work accommodations)
- [ ] Medicare billing assistant for GPs
- [ ] Analytics dashboard for practice-level population health

---

## 9. Architecture Advantages — Why ManaposeGP Fits

| Platform Feature | Healthcare Application |
|-----------------|----------------------|
| **JWT auth tiers** | public (browse), `google` (patient full access), `pin` (GP clinical access) |
| **RTK Query caching** | Efficient symptom journal sync, offline-capable entry |
| **SSE streaming chat** | Real-time AI responses during GP consult (no latency) |
| **ZenStack `@@allow` policies** | Granular data access: patients see own data, GPs see consented patients |
| **MUI v7 component library** | Accessible, responsive health dashboards; WCAG 2.1 AA compliance |
| **Dynamic page catalog** | Code-first health pages with block registry — rapid feature deployment |
| **PDF export (Puppeteer)** | GP referral letters, patient summaries, Medicare reports |
| **Neon Postgres + pgvector** | Vector search for clinical guidelines at production scale |
| **Vercel edge deployment** | Sub-50ms TTFB for health queries; global CDN for Australian clinics |

---

## 10. Risk & Compliance

| Risk | Mitigation |
|------|-----------|
| **Medical device regulation** | ManaposeGP is a *health information tool*, not a *medical device* — does not diagnose or prescribe. Clear disclaimers on every AI output. |
| **Privacy (Health data)** | Australian Privacy Act 1988 + APP guidelines. Health data encrypted at rest. Consent-based sharing. |
| **AI hallucination in clinical context** | Every AI response cites source. GP-mode shows confidence levels. Patient-mode never gives medical advice. |
| **Data sovereignty** | All data stored in Australian region (Neon/Sydney or Vercel/Sydney). |
| **GP liability** | AI is decision *support*, not decision *replacement*. Clinical responsibility remains with the GP. |
| **HealthKit compliance** | Apple's HealthKit guidelines: no HealthKit data used for advertising. Clear privacy policy. |

---

## 11. Key Australian Guidelines to Reference

The following should be embedded in the knowledge base:

1. **RACGP Red Book** — Guidelines for preventive activities in general practice (10th edition)
2. **AMS Guide to MHT** — Practical prescribing guide for menopausal hormone therapy
3. **Jean Hailes Menopause Symptom Checklist** — Validated assessment tool
4. **NHMRC Menopause Guidelines** — National evidence-based recommendations
5. **Therapeutic Guidelines: Endocrinology** — MHT dosing and management
6. **Choosing Wisely Australia** — Tests and treatments to question in menopause
7. **Cancer Australia** — Breast cancer risk and MHT decision-making
8. **Osteoporosis Australia / RACGP** — Bone health in postmenopausal women
9. **Beyond Blue** — Perimenopausal depression clinical practice guidelines

---

## Next Steps

1. **Immediate**: Copy this analysis into `docs/HEALTHCARE_PLATFORM_ANALYSIS.md` ✓
2. **This Week**: Create the ZenStack schema extensions (`health_profiles`, `symptom_journals`, `health_metrics`)
3. **This Week**: Begin Jean Hailes content ingestion into `knowledge_snippets` table
4. **Next Sprint**: Implement Apple HealthKit integration module
5. **Next Sprint**: Build patient-mode chatbot with menopause knowledge base
6. **Month 2**: GP-mode chatbot + clinical guideline RAG pipeline

---

*Analysis produced: July 2026. Sources: Jean Hailes for Women's Health, Australasian Menopause Society, RACGP, Apple HealthKit documentation.*
