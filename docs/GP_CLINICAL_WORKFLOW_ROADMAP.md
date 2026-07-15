# GP Clinical Workflow — Implementation Roadmap

> **Status:** Phase 1 commencing  
> **Created:** 2026-07-14  
> **Related:** `/zenstack/schema.zmodel`, `/src/domain/health/consultation-service.ts`

## Context

The ManaposeGP platform already has a strong foundation for health data tracking (profiles, symptoms, metrics, medications, screenings), GP profile management, patient consent, and AI-powered clinical support (SOAP notes, referral letters, drug interactions, MBS suggestions). However, the **day-to-day GP clinical workflow** — the core loop of patient booking → consultation → notes → prescriptions → pathology/radiology orders → billing — is largely incomplete.

This roadmap fills those gaps, focusing on **delivering functional clinical workflows** within the existing Next.js + ZenStack architecture, with **AI optimizations** at every step that can benefit from them.

---

## Architecture Decision

### Unified GP Consultation Page

Rather than fragmenting the workflow across multiple pages, we build a **single unified GP consultation page** (`/gp-consult`) that serves as the GP's workstation. This page:

1. **Selects a patient** from the consented patient list
2. **Displays patient context** (profile, history, medications, recent symptoms, metrics, prior consultations)
3. **Provides an AI-assisted SOAP note editor** — the GP writes or dictates notes, AI generates structured SOAP
4. **Prescription writer** — search/select medications, set dosage/frequency/repeats, AI drug interaction check
5. **Pathology/radiology orders** — structured forms for common tests with AI-suggested relevant tests
6. **Billing summary** — AI-suggested MBS items, bulk-bill toggle, consultation type
7. **Save & finalize** — persists the full consultation with all linked records

### Why one page?

- Reduces context-switching during consultations
- Real-time AI assistance across all sub-components
- Single save action persists everything atomically
- Matches how GPs actually work (everything happens within a single consultation)

---

## Schema Gap Analysis

### What EXISTS (reusable):

| Model | Relevance |
|-------|-----------|
| `GPConsultation` | Stores SOAP notes, prescriptions (String[]), referrals (String[]), MBS items (String[]), treatment plan |
| `HealthProfile` | Patient demographics, medical history, lifestyle |
| `Medication` | Patient medication tracking (adherence, status) |
| `LabResult` | Passive lab result storage |
| `SymptomJournal` | Symptom tracking with trends |
| `PatientConsent` | GP-patient data sharing consent |
| `GPProfile` | GP registration, AHPRA, practice details |

### What's MISSING (needs new models):

| Model | Purpose | Priority |
|-------|---------|----------|
| `Appointment` | Patient booking + GP calendar | P5 |
| `PathologyOrder` | Lab test requests with status tracking | P1 |
| `RadiologyOrder` | Imaging requests with status tracking | P1 |
| `Prescription` | Formal e-prescriptions (status, repeats, authority, dispense tracking) | P1 |
| `Invoice` | Consultation billing records | P1 |
| `Payment` | Payment tracking against invoices | P1 |

---

## AI Optimization Opportunities

| Workflow Step | AI Capability | Existing? | Implementation |
|---------------|--------------|-----------|----------------|
| **SOAP notes** | GPT-4o generates structured SOAP from GP's raw notes + patient context (profile, symptoms, metrics, medications) | ✅ EXISTS (`generateSOAPNote`) | Wire into consultation page |
| **Drug interactions** | GPT-4o checks interactions between new prescription and existing medications | ✅ EXISTS (`checkInteractions`) | Auto-trigger when prescription is added |
| **MBS suggestions** | GPT-4o suggests Medicare item numbers based on consultation context | ✅ EXISTS (`suggestMBSItems`) | Wire into billing section |
| **Referral letters** | GPT-4o generates specialist referral letters | ✅ EXISTS (`generateReferralLetter`) | Wire into consultation page |
| **Test recommendations** | GPT-4o suggests relevant pathology/radiology based on presenting complaint, symptoms, and guidelines | ❌ NEW | Create `suggestInvestigations()` service |
| **Prescription suggestions** | GPT-4o suggests common medications/dosages for diagnosed conditions based on Australian guidelines | ❌ NEW | Create `suggestPrescriptions()` service |
| **Consultation summary** | GPT-4o generates a patient-friendly summary of the consultation | ❌ NEW | Create `generatePatientSummary()` service |
| **Pre-consultation prep** | GPT-4o generates a structured summary before the GP sees the patient | ⚠️ STUB (`generateGpSummary` returns hardcoded data) | Implement the actual AI call |
| **Risk scoring** | FRAX, CVD, Gail breast cancer risk | ✅ EXISTS | Display in patient context panel |

---

## Implementation Phases

### Phase 1: Schema (Database Models)
**Files:** `zenstack/schema.zmodel`

Add 6 new models with `@@map` to production table names:
- `Appointment` → `appointments`
- `PathologyOrder` → `pathology_orders`
- `RadiologyOrder` → `radiology_orders`
- `Prescription` → `prescriptions`
- `Invoice` → `invoices`
- `Payment` → `payments`

Run `bun run zen:generate` to regenerate Prisma client.

### Phase 2: Domain Services
**Files:** `src/domain/health/`

- `appointment-service.ts`
- `pathology-order-service.ts`
- `radiology-order-service.ts`
- `prescription-service.ts`
- `billing-service.ts`

### Phase 3: API Routes
**Files:** `src/app/api/gp/`

All routes use `requirePin` auth guard (GP tier).
- `POST/GET /api/gp/appointments`
- `POST/GET /api/gp/pathology-orders`
- `POST/GET /api/gp/radiology-orders`
- `POST/GET /api/gp/prescriptions`
- `POST/GET /api/gp/invoices`
- `POST/GET /api/gp/payments`

### Phase 4: Unified GP Consultation Page
**Files:** `src/app/(app)/gp-consult/page.tsx`, `src/components/gp/`

Build the single-page consultation workstation:
1. Patient selector (from consented patients)
2. Patient context sidebar
3. AI-assisted SOAP note editor
4. Prescription writer widget
5. Pathology/radiology order forms
6. Billing summary widget
7. Save & finalize action

### Phase 5: Patient Booking
**Files:** Patient-facing booking widget + GP calendar

- Patient books appointment (date/time selection, reason)
- GP sees appointment calendar on dashboard
- Appointment → consultation flow (start consult from appointment)

### Phase 6: AI Optimizations
**Files:** `src/domain/health/`

- `suggestInvestigations()` — AI-suggested pathology/radiology tests
- `suggestPrescriptions()` — AI-suggested medications based on diagnosis
- `generatePatientSummary()` — Patient-friendly post-consultation summary
- Implement the `generateGpSummary()` stub

---

## Step-by-Step Implementation (Current Session)

We will implement **Phases 1–4** now, delivering a functional GP consultation workflow with AI assistance:

1. ✅ Add 6 new schema models to `zenstack/schema.zmodel`
2. ✅ Run `bun run zen:generate`
3. ✅ Create domain services for new models
4. ✅ Create API routes
5. ✅ Build the unified GP consultation page
6. ✅ Update page catalog
7. ✅ Run type-check
