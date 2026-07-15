'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Snackbar,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HistoryIcon from '@mui/icons-material/History';
import ScienceIcon from '@mui/icons-material/Science';
import DescriptionIcon from '@mui/icons-material/Description';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

// ── Types ─────────────────────────────────────────────────────────────────

interface Patient {
  profileId: string;
  consentType: string;
  grantedAt: string;
  menopauseStatus: string | null;
  age: number | null;
}

interface PatientProfile {
  id: string;
  age: number | null;
  sexAtBirth: string | null;
  menopauseStatus: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bloodType: string | null;
  allergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
  smokingStatus: string | null;
  alcoholUnitsPerWeek: number | null;
  exerciseMinutesPerWeek: number | null;
}

interface ConsultationRecord {
  id: string;
  date: string;
  consultationType: string;
  summary: string;
  subjectiveNote: string | null;
  objectiveNote: string | null;
  assessmentNote: string | null;
  planNote: string | null;
  treatmentPlan: string | null;
  prescriptions: string[];
  referrals: string[];
  followUp: string | null;
  mbsItems: string[];
  notes: string | null;
  aiGenerated: boolean;
}

interface DashboardData {
  success: boolean;
  profile: PatientProfile;
  consultations: ConsultationRecord[];
}

interface PrescriptionDraft {
  key: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  quantity: string;
  repeats: number;
  instructions: string;
  clinicalNotes: string;
}

interface PathologyDraft {
  key: string;
  testName: string;
  testCategory: string;
  clinicalNotes: string;
  urgency: string;
  fastingRequired: boolean;
}

interface RadiologyDraft {
  key: string;
  imagingType: string;
  bodyRegion: string;
  clinicalNotes: string;
  urgency: string;
  contrastRequired: boolean;
}

interface InvoiceItemDraft {
  description: string;
  mbsItem: string;
  feeCents: number;
}

interface DrugInteraction {
  medications: string[];
  severity: string;
  description: string;
  recommendation: string;
}

interface DrugInteractionResult {
  success: boolean;
  interactions: DrugInteraction[];
}

// ── Constants ─────────────────────────────────────────────────────────────

const todayISO = new Date().toISOString().slice(0, 10);

const PATHOLOGY_CATEGORIES = [
  'HAEMATOLOGY', 'BIOCHEMISTRY', 'MICROBIOLOGY', 'HISTOPATHOLOGY',
  'IMMUNOLOGY', 'HORMONES', 'GENETICS', 'SEROLOGY',
] as const;

const IMAGING_TYPES = [
  'XRAY', 'ULTRASOUND', 'CT', 'MRI', 'MAMMOGRAM', 'DEXA', 'NUCLEAR_MEDICINE',
] as const;

const BODY_REGIONS = [
  'HEAD', 'CHEST', 'ABDOMEN', 'SPINE', 'PELVIS', 'UPPER_LIMB', 'LOWER_LIMB', 'BREAST', 'WHOLE_BODY',
] as const;

const CONSULTATION_TYPES = ['INITIAL', 'FOLLOW_UP', 'REVIEW', 'EMERGENCY'] as const;

const PAYMENT_METHODS = ['CASH', 'EFTPOS', 'CREDIT_CARD', 'MEDICARE', 'PRIVATE_HEALTH', 'BULK_BILL'] as const;

let localKey = 0;
function nextKey(): string { localKey += 1; return `k-${localKey}`; }

// ── Grid layout helpers (Box-based CSS grid) ──────────────────────────────

const grid2Col = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 };
const gridRx = { display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '2fr 1fr 1fr 1fr 1fr 1fr 1fr' }, gap: 1.5 };
const gridBilling = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '5fr 3fr 2fr auto' }, gap: 1.5 };
const gridInvestCols = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1fr' }, gap: 1.5 };

// ── Component ─────────────────────────────────────────────────────────────

function GpConsultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentPatientId = searchParams.get('patientId');

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(appointmentPatientId ?? '');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const [consultType, setConsultType] = useState<string>('FOLLOW_UP');
  const [duration, setDuration] = useState<number>(15);
  const [gpNotes, setGpNotes] = useState('');
  const [subjectiveNote, setSubjectiveNote] = useState('');
  const [objectiveNote, setObjectiveNote] = useState('');
  const [assessmentNote, setAssessmentNote] = useState('');
  const [planNote, setPlanNote] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [generatingSOAP, setGeneratingSOAP] = useState(false);
  const [soapDisclaimer, setSoapDisclaimer] = useState('');

  const [prescriptions, setPrescriptions] = useState<PrescriptionDraft[]>([]);
  const [prescExpanded, setPrescExpanded] = useState(true);
  const [pathologyOrders, setPathologyOrders] = useState<PathologyDraft[]>([]);
  const [radiologyOrders, setRadiologyOrders] = useState<RadiologyDraft[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemDraft[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('');

  // Drug interactions
  const [drugInteractions, setDrugInteractions] = useState<DrugInteraction[]>([]);
  const [checkingInteractions, setCheckingInteractions] = useState(false);
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI suggestions
  const [loadingRxSuggest, setLoadingRxSuggest] = useState(false);
  const [loadingInvSuggest, setLoadingInvSuggest] = useState(false);
  const [loadingMbsSuggest, setLoadingMbsSuggest] = useState(false);
  const [loadingReferral, setLoadingReferral] = useState(false);
  const [loadingPatientSummary, setLoadingPatientSummary] = useState(false);
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [referralLetter, setReferralLetter] = useState<{ subject: string; body: string } | null>(null);
  const [patientSummaryText, setPatientSummaryText] = useState<Record<string, unknown> | null>(null);

  // Loaded consultation history record
  const [loadedConsultId, setLoadedConsultId] = useState<string | null>(null);

  // ── Fetch patients ────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/gp/patients', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) setPatients(d.patients as Patient[]); })
      .finally(() => setLoadingPatients(false));
  }, []);

  useEffect(() => {
    if (!selectedPatientId) return;
    setLoadingDashboard(true);
    fetch(`/api/gp/patients/${selectedPatientId}/dashboard`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) setDashboard(d as DashboardData); })
      .finally(() => setLoadingDashboard(false));
  }, [selectedPatientId]);

  // ── SOAP generation (NEW: separate endpoint, no DB write) ──────────────
  const handleGenerateSOAP = useCallback(async () => {
    if (!selectedPatientId || !gpNotes.trim()) return;
    setGeneratingSOAP(true);
    try {
      const res = await fetch('/api/gp/consultations/generate-soap', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: selectedPatientId, notes: gpNotes.trim() }),
      });
      const data = await res.json() as {
        success: boolean;
        soap?: { subjective: string; objective: string; assessment: string; plan: string; disclaimer: string };
        error?: string;
      };
      if (data.success && data.soap) {
        setSubjectiveNote(data.soap.subjective);
        setObjectiveNote(data.soap.objective);
        setAssessmentNote(data.soap.assessment);
        setPlanNote(data.soap.plan);
        setSoapDisclaimer(data.soap.disclaimer);
      } else {
        setSnackbar({ message: data.error ?? 'SOAP generation failed', severity: 'error' });
      }
    } catch {
      setSnackbar({ message: 'Network error during SOAP generation', severity: 'error' });
    } finally { setGeneratingSOAP(false); }
  }, [selectedPatientId, gpNotes]);

  // ── Load a past consultation ──────────────────────────────────────────
  const handleLoadConsultation = useCallback((record: ConsultationRecord) => {
    setConsultType(record.consultationType);
    setGpNotes(record.notes ?? '');
    setSubjectiveNote(record.subjectiveNote ?? '');
    setObjectiveNote(record.objectiveNote ?? '');
    setAssessmentNote(record.assessmentNote ?? '');
    setPlanNote(record.planNote ?? '');
    setTreatmentPlan(record.treatmentPlan ?? '');
    setLoadedConsultId(record.id);
    setSnackbar({ message: `Loaded consultation from ${record.date.slice(0, 10)}`, severity: 'success' });
  }, []);

  // ── Drug interaction check (debounced) ─────────────────────────────────
  const checkDrugInteractions = useCallback(async () => {
    const newMeds = prescriptions.filter((p) => p.medicationName.trim()).map((p) => p.medicationName.trim());
    if (newMeds.length === 0) { setDrugInteractions([]); return; }

    setCheckingInteractions(true);
    try {
      const res = await fetch('/api/gp/drug-interactions', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medications: newMeds,
          profileId: selectedPatientId || undefined,
        }),
      });
      const data = await res.json() as DrugInteractionResult;
      if (data.success) {
        setDrugInteractions(data.interactions ?? []);
      }
    } catch { /* silently fail */ }
    finally { setCheckingInteractions(false); }
  }, [prescriptions, selectedPatientId]);

  // Debounced auto-check when prescriptions change
  useEffect(() => {
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    const hasMeds = prescriptions.some((p) => p.medicationName.trim());
    if (!hasMeds) { setDrugInteractions([]); return; }
    interactionTimeoutRef.current = setTimeout(() => { checkDrugInteractions(); }, 1500);
    return () => { if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current); };
  }, [prescriptions, checkDrugInteractions]);

  // ── AI: Suggest prescriptions ──────────────────────────────────────
  const handleSuggestPrescriptions = useCallback(async () => {
    if (!selectedPatientId) return;
    setLoadingRxSuggest(true);
    try {
      const res = await fetch('/api/gp/prescriptions-suggest', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: selectedPatientId, notes: gpNotes || undefined }),
      });
      const data = await res.json() as {
        success: boolean;
        suggestions?: Array<{ medicationName: string; typicalDosage: string; typicalFrequency: string; clinicalRationale: string }>;
      };
      if (data.success && data.suggestions?.length) {
        const newScripts = data.suggestions.map((s) => ({
          key: nextKey(),
          medicationName: s.medicationName,
          dosage: s.typicalDosage,
          frequency: s.typicalFrequency,
          quantity: '', repeats: 0,
          instructions: '', clinicalNotes: s.clinicalRationale,
        }));
        setPrescriptions((prev) => [...prev, ...newScripts]);
        setPrescExpanded(true);
        setSnackbar({ message: `Added ${newScripts.length} AI-suggested prescriptions`, severity: 'success' });
      } else {
        setSnackbar({ message: 'No prescription suggestions generated', severity: 'error' });
      }
    } catch { setSnackbar({ message: 'Network error', severity: 'error' }); }
    finally { setLoadingRxSuggest(false); }
  }, [selectedPatientId, gpNotes]);

  // ── AI: Suggest investigations ──────────────────────────────────────
  const handleSuggestInvestigations = useCallback(async () => {
    if (!selectedPatientId) return;
    setLoadingInvSuggest(true);
    try {
      const res = await fetch('/api/gp/investigations', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: selectedPatientId, notes: gpNotes || undefined }),
      });
      const data = await res.json() as {
        success: boolean;
        suggestions?: Array<{ type: string; testName: string; category?: string; imagingType?: string; bodyRegion?: string; clinicalRationale: string; urgency: string }>;
      };
      if (data.success && data.suggestions?.length) {
        let pathCount = 0; let radCount = 0;
        for (const s of data.suggestions) {
          if (s.type === 'pathology') {
            setPathologyOrders((prev) => [...prev, { key: nextKey(), testName: s.testName, testCategory: s.category ?? 'BIOCHEMISTRY', clinicalNotes: s.clinicalRationale, urgency: s.urgency, fastingRequired: false }]);
            pathCount++;
          } else if (s.type === 'radiology') {
            setRadiologyOrders((prev) => [...prev, { key: nextKey(), imagingType: s.imagingType ?? 'XRAY', bodyRegion: s.bodyRegion ?? 'CHEST', clinicalNotes: s.clinicalRationale, urgency: s.urgency, contrastRequired: false }]);
            radCount++;
          }
        }
        setSnackbar({ message: `Added ${pathCount} pathology + ${radCount} radiology orders`, severity: 'success' });
      } else {
        setSnackbar({ message: 'No investigation suggestions generated', severity: 'error' });
      }
    } catch { setSnackbar({ message: 'Network error', severity: 'error' }); }
    finally { setLoadingInvSuggest(false); }
  }, [selectedPatientId, gpNotes]);

  // ── AI: Suggest MBS codes ────────────────────────────────────────────
  const handleSuggestMBS = useCallback(async () => {
    if (!selectedPatientId) return;
    setLoadingMbsSuggest(true);
    try {
      const profile = dashboard?.profile;
      const res = await fetch('/api/gp/mbs-suggestions', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationType: consultType,
          duration,
          patientAge: profile?.age ?? undefined,
          menopauseStatus: profile?.menopauseStatus ?? undefined,
          chronicConditions: profile?.chronicConditions,
          newMedicationPrescribed: prescriptions.some((p) => p.medicationName.trim()),
          carePlanCreated: !!treatmentPlan.trim(),
        }),
      });
      const data = await res.json() as { success: boolean; suggestedItems?: Array<{ itemNumber: string; description: string; fee: string; rationale: string }> };
      if (data.success && data.suggestedItems?.length) {
        const items = data.suggestedItems.map((m) => ({
          description: `${m.description} (MBS ${m.itemNumber})`,
          mbsItem: m.itemNumber,
          feeCents: parseFloat(m.fee.replace(/[^0-9.]/g, '')) * 100 || 0,
        }));
        setInvoiceItems((prev) => [...prev, ...items]);
        setSnackbar({ message: `Added ${items.length} MBS items`, severity: 'success' });
      } else {
        setSnackbar({ message: 'No MBS suggestions generated', severity: 'error' });
      }
    } catch { setSnackbar({ message: 'Network error', severity: 'error' }); }
    finally { setLoadingMbsSuggest(false); }
  }, [selectedPatientId, consultType, duration, dashboard, prescriptions, treatmentPlan]);

  // ── AI: Generate referral letter ──────────────────────────────────────
  const handleGenerateReferral = useCallback(async () => {
    if (!selectedPatientId) return;
    setLoadingReferral(true);
    try {
      const res = await fetch('/api/gp/referral-letter', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          healthProfileId: selectedPatientId,
          specialistType: 'gynaecologist',
          urgency: 'routine',
          reasonForReferral: gpNotes.trim().slice(0, 500) || 'Specialist review requested',
          additionalNotes: assessmentNote || undefined,
        }),
      });
      const data = await res.json() as { success: boolean; letter?: { subject: string; body: string }; error?: string };
      if (data.success && data.letter) {
        setReferralLetter(data.letter);
        setShowReferralDialog(true);
      } else {
        setSnackbar({ message: data.error ?? 'Failed to generate referral', severity: 'error' });
      }
    } catch { setSnackbar({ message: 'Network error', severity: 'error' }); }
    finally { setLoadingReferral(false); }
  }, [selectedPatientId, gpNotes, assessmentNote]);

  // ── AI: Generate patient summary ───────────────────────────────────────
  const handleGeneratePatientSummary = useCallback(async () => {
    setLoadingPatientSummary(true);
    try {
      const res = await fetch('/api/gp/patient-summary', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectiveNote: subjectiveNote || undefined,
          objectiveNote: objectiveNote || undefined,
          assessmentNote: assessmentNote || undefined,
          planNote: planNote || undefined,
          treatmentPlan: treatmentPlan || undefined,
          prescriptions: prescriptions.filter((p) => p.medicationName.trim()).map((p) => ({
            medicationName: p.medicationName, dosage: p.dosage, frequency: p.frequency, instructions: p.instructions || undefined,
          })),
          pathologyOrders: pathologyOrders.filter((o) => o.testName.trim()).map((o) => ({ testName: o.testName })),
          radiologyOrders: radiologyOrders.filter((o) => o.imagingType).map((o) => ({ imagingType: o.imagingType, bodyRegion: o.bodyRegion })),
          followUpInstructions: treatmentPlan || undefined,
        }),
      });
      const data = await res.json() as { success: boolean; summary?: Record<string, unknown>; error?: string };
      if (data.success && data.summary) {
        setPatientSummaryText(data.summary);
        setShowSummaryDialog(true);
      } else {
        setSnackbar({ message: data.error ?? 'Failed to generate summary', severity: 'error' });
      }
    } catch { setSnackbar({ message: 'Network error', severity: 'error' }); }
    finally { setLoadingPatientSummary(false); }
  }, [subjectiveNote, objectiveNote, assessmentNote, planNote, treatmentPlan, prescriptions, pathologyOrders, radiologyOrders]);

  // ── Save consultation (SINGLE create, includes SOAP fields) ────────────
  const handleSave = useCallback(async () => {
    if (!selectedPatientId || !gpNotes.trim()) {
      setSnackbar({ message: 'Patient and notes are required', severity: 'error' }); return;
    }
    setSaving(true);
    try {
      // 1. Create the consultation (single record)
      const consRes = await fetch('/api/gp/consultations', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatientId, gpId: '', date: todayISO,
          consultationType: consultType, duration,
          summary: gpNotes.trim().slice(0, 200),
          treatmentPlan: treatmentPlan || undefined,
          notes: gpNotes.trim(),
          // ── SOAP fields included directly ─────────────────────────────
          subjectiveNote: subjectiveNote || undefined,
          objectiveNote: objectiveNote || undefined,
          assessmentNote: assessmentNote || undefined,
          planNote: planNote || undefined,
          aiGenerated: !!(subjectiveNote || assessmentNote),
        }),
      });
      const consData = await consRes.json() as { success: boolean; consultation?: { id: string }; error?: string };
      if (!consData.success || !consData.consultation) throw new Error(consData.error ?? 'Failed to create consultation');
      const consultationId = consData.consultation.id;

      // 2. Save prescriptions
      await Promise.all(prescriptions.filter((p) => p.medicationName.trim()).map((p) =>
        fetch('/api/gp/prescriptions', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            healthProfileId: selectedPatientId, gpId: '', consultationId,
            medicationName: p.medicationName, dosage: p.dosage, frequency: p.frequency,
            quantity: p.quantity || undefined, repeats: p.repeats,
            instructions: p.instructions || undefined, clinicalNotes: p.clinicalNotes || undefined,
            startDate: todayISO,
          }),
        }),
      ));

      // 3. Save pathology orders
      await Promise.all(pathologyOrders.filter((o) => o.testName.trim()).map((o) =>
        fetch('/api/gp/pathology-orders', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            healthProfileId: selectedPatientId, gpId: '', consultationId,
            testName: o.testName, testCategory: o.testCategory || 'BIOCHEMISTRY',
            clinicalNotes: o.clinicalNotes || undefined, urgency: o.urgency || 'ROUTINE',
            fastingRequired: o.fastingRequired,
          }),
        }),
      ));

      // 4. Save radiology orders
      await Promise.all(radiologyOrders.filter((o) => o.imagingType).map((o) =>
        fetch('/api/gp/radiology-orders', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            healthProfileId: selectedPatientId, gpId: '', consultationId,
            imagingType: o.imagingType, bodyRegion: o.bodyRegion,
            clinicalNotes: o.clinicalNotes || undefined, urgency: o.urgency || 'ROUTINE',
            contrastRequired: o.contrastRequired,
          }),
        }),
      ));

      // 5. Create invoice if items exist
      if (invoiceItems.length > 0) {
        const invRes = await fetch('/api/gp/invoices', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ healthProfileId: selectedPatientId, gpId: '', consultationId, items: invoiceItems }),
        });
        const invData = await invRes.json() as { success: boolean; invoice?: { id: string } };
        if (invData.success && invData.invoice && paymentMethod) {
          const totalCents = invoiceItems.reduce((s, i) => s + i.feeCents + Math.round(i.feeCents * 0.1), 0);
          await fetch('/api/gp/invoices', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId: invData.invoice.id, amountCents: totalCents, method: paymentMethod }),
          });
        }
      }

      setSnackbar({ message: 'Consultation saved successfully', severity: 'success' });
      setGpNotes(''); setSubjectiveNote(''); setObjectiveNote(''); setAssessmentNote(''); setPlanNote('');
      setTreatmentPlan(''); setPrescriptions([]); setPathologyOrders([]); setRadiologyOrders([]);
      setInvoiceItems([]); setPaymentMethod(''); setLoadedConsultId(null); setDrugInteractions([]);
      setSoapDisclaimer('');
    } catch (err) {
      setSnackbar({ message: err instanceof Error ? err.message : 'Failed to save consultation', severity: 'error' });
    } finally { setSaving(false); }
  }, [
    selectedPatientId, gpNotes, consultType, duration, treatmentPlan,
    subjectiveNote, objectiveNote, assessmentNote, planNote,
    prescriptions, pathologyOrders, radiologyOrders, invoiceItems, paymentMethod,
  ]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const addPrescription = () => setPrescriptions((prev) => [...prev, { key: nextKey(), medicationName: '', dosage: '', frequency: '', quantity: '', repeats: 0, instructions: '', clinicalNotes: '' }]);
  const removePrescription = (key: string) => setPrescriptions((prev) => prev.filter((p) => p.key !== key));
  const updatePrescription = (key: string, field: keyof PrescriptionDraft, value: string | number) => setPrescriptions((prev) => prev.map((p) => (p.key === key ? { ...p, [field]: value } : p)));

  const addPathology = () => setPathologyOrders((prev) => [...prev, { key: nextKey(), testName: '', testCategory: 'BIOCHEMISTRY', clinicalNotes: '', urgency: 'ROUTINE', fastingRequired: false }]);
  const removePathology = (key: string) => setPathologyOrders((prev) => prev.filter((o) => o.key !== key));
  const updatePathology = (key: string, field: keyof PathologyDraft, value: string | number | boolean) => setPathologyOrders((prev) => prev.map((o) => (o.key === key ? { ...o, [field]: value } : o)));

  const addRadiology = () => setRadiologyOrders((prev) => [...prev, { key: nextKey(), imagingType: 'XRAY', bodyRegion: 'CHEST', clinicalNotes: '', urgency: 'ROUTINE', contrastRequired: false }]);
  const removeRadiology = (key: string) => setRadiologyOrders((prev) => prev.filter((o) => o.key !== key));
  const updateRadiology = (key: string, field: keyof RadiologyDraft, value: string | number | boolean) => setRadiologyOrders((prev) => prev.map((o) => (o.key === key ? { ...o, [field]: value } : o)));

  const addInvoiceItem = () => setInvoiceItems((prev) => [...prev, { description: '', mbsItem: '', feeCents: 0 }]);
  const removeInvoiceItem = (idx: number) => setInvoiceItems((prev) => prev.filter((_, i) => i !== idx));
  const updateInvoiceItem = (idx: number, field: keyof InvoiceItemDraft, value: string | number) => setInvoiceItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  const totalCents = invoiceItems.reduce((s, i) => s + i.feeCents, 0);

  const getInteractionSeverityColor = (s: string): 'error' | 'warning' | 'info' => {
    if (s === 'CONTRAINDICATED' || s === 'MAJOR') return 'error';
    if (s === 'MODERATE') return 'warning';
    return 'info';
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>GP Consultation</Typography>

        {/* ── Patient selector ──────────────────────────────────────── */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
            <FormControl size="small" sx={{ minWidth: 280, flex: 1 }}>
              <InputLabel>Select Patient</InputLabel>
              <Select value={selectedPatientId} label="Select Patient" onChange={(e) => setSelectedPatientId(e.target.value)} disabled={loadingPatients}>
                <MenuItem value=""><em>— Select a consented patient —</em></MenuItem>
                {patients.map((p) => (
                  <MenuItem key={p.profileId} value={p.profileId}>
                    Patient {p.profileId.slice(0, 8)}…{p.age !== null && ` (${p.age}yo)`}{p.menopauseStatus && ` — ${p.menopauseStatus}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Type</InputLabel>
                <Select value={consultType} label="Type" onChange={(e) => setConsultType(e.target.value)}>
                  {CONSULTATION_TYPES.map((t) => <MenuItem key={t} value={t}>{t.replace('_', ' ')}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField type="number" label="Duration (min)" value={duration} onChange={(e) => setDuration(Number(e.target.value) || 15)} size="small" sx={{ width: 120 }} slotProps={{ htmlInput: { min: 5, max: 120 } }} />
            </Stack>
          </Stack>
        </Paper>

        {selectedPatientId && dashboard && (
          <>
            {/* ── Patient context ──────────────────────────────────── */}
            <Accordion defaultExpanded={false} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Patient Context</Typography>
                <Box sx={{ ml: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {dashboard.profile.age !== null && <Chip label={`${dashboard.profile.age}yo`} size="small" variant="outlined" />}
                  {dashboard.profile.menopauseStatus && <Chip label={dashboard.profile.menopauseStatus} size="small" color="warning" variant="outlined" />}
                  {dashboard.profile.allergies.map((a) => <Chip key={a} label={`Allergy: ${a}`} size="small" color="error" variant="outlined" />)}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={grid2Col}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Demographics</Typography>
                    <Typography variant="body2">Age: {dashboard.profile.age ?? 'N/A'} | Sex: {dashboard.profile.sexAtBirth ?? 'N/A'}</Typography>
                    <Typography variant="body2">Menopause: {dashboard.profile.menopauseStatus ?? 'N/A'}</Typography>
                    <Typography variant="body2">Height: {dashboard.profile.heightCm ?? 'N/A'} cm | Weight: {dashboard.profile.weightKg ?? 'N/A'} kg</Typography>
                    <Typography variant="body2">Blood Type: {dashboard.profile.bloodType ?? 'N/A'} | Smoking: {dashboard.profile.smokingStatus ?? 'N/A'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Medical History</Typography>
                    <Typography variant="body2">Chronic: {dashboard.profile.chronicConditions.join(', ') || 'None'}</Typography>
                    <Typography variant="body2">Allergies: {dashboard.profile.allergies.join(', ') || 'None'}</Typography>
                    <Typography variant="body2">Current Meds: {dashboard.profile.currentMedications.join(', ') || 'None'}</Typography>
                    <Typography variant="body2">Alcohol: {dashboard.profile.alcoholUnitsPerWeek ?? 'N/A'} u/wk | Exercise: {dashboard.profile.exerciseMinutesPerWeek ?? 'N/A'} min/wk</Typography>
                  </Box>
                </Box>

                {/* ── Consultation history (click-to-load) ──────────── */}
                {dashboard.consultations.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Stack direction="row" sx={{ alignItems: 'center', mb: 1, gap: 0.5 }}>
                      <HistoryIcon fontSize="small" color="action" />
                      <Typography variant="subtitle2">Consultation History ({dashboard.consultations.length})</Typography>
                      <Typography variant="caption" color="text.secondary">— click to load</Typography>
                    </Stack>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Type</TableCell><TableCell>Summary</TableCell><TableCell width={60} /></TableRow></TableHead>
                        <TableBody>
                          {dashboard.consultations.slice(0, 10).map((c) => (
                            <TableRow
                              key={c.id}
                              hover
                              sx={{
                                cursor: 'pointer',
                                bgcolor: loadedConsultId === c.id ? 'primary.50' : undefined,
                                '&:hover': { bgcolor: 'action.hover' },
                              }}
                              onClick={() => handleLoadConsultation(c)}
                            >
                              <TableCell>{c.date.slice(0, 10)}</TableCell>
                              <TableCell><Chip label={c.consultationType.replace('_', ' ')} size="small" variant="outlined" /></TableCell>
                              <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.summary}</TableCell>
                              <TableCell>
                                {c.aiGenerated && <Chip label="AI" size="small" color="info" />}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>

            {/* ── SOAP Notes ────────────────────────────────────────── */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Stack direction="row" sx={{ alignItems: 'center', mb: 2, gap: 1 }}>
                <MedicalServicesIcon color="primary" />
                <Typography variant="h6">SOAP Notes</Typography>
                <Box sx={{ flex: 1 }} />
                <Button variant="outlined" startIcon={<DescriptionIcon />} onClick={handleGenerateReferral} disabled={loadingReferral || !gpNotes.trim()} size="small">
                  {loadingReferral ? '...' : 'Referral'}
                </Button>
                <Button variant="outlined" startIcon={<AutoAwesomeIcon />} onClick={handleGenerateSOAP} disabled={!gpNotes.trim() || generatingSOAP} size="small">
                  {generatingSOAP ? 'Generating...' : 'Generate SOAP'}
                </Button>
              </Stack>
              <Stack spacing={2}>
                <TextField
                  label="GP Consultation Notes"
                  multiline rows={4} value={gpNotes}
                  onChange={(e) => setGpNotes(e.target.value)}
                  placeholder="Enter your consultation notes here... The AI will structure these into SOAP format."
                  helperText="Write freely — AI structures into SOAP. No database record is created until you click Save."
                />
                {(subjectiveNote || objectiveNote || assessmentNote || planNote) && (
                  <Box sx={{ bgcolor: 'primary.50', p: 2, borderRadius: 1, border: 1, borderColor: 'primary.200' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      AI-generated SOAP — review and edit as needed
                    </Typography>
                    <TextField label="Subjective (S)" multiline rows={2} value={subjectiveNote} onChange={(e) => setSubjectiveNote(e.target.value)} fullWidth sx={{ mb: 1.5 }} />
                    <TextField label="Objective (O)" multiline rows={2} value={objectiveNote} onChange={(e) => setObjectiveNote(e.target.value)} fullWidth sx={{ mb: 1.5 }} />
                    <TextField label="Assessment (A)" multiline rows={3} value={assessmentNote} onChange={(e) => setAssessmentNote(e.target.value)} fullWidth sx={{ mb: 1.5 }} />
                    <TextField label="Plan (P)" multiline rows={2} value={planNote} onChange={(e) => setPlanNote(e.target.value)} fullWidth />
                    {soapDisclaimer && (
                      <Alert severity="info" sx={{ mt: 1.5 }} icon={false}>
                        <Typography variant="caption">{soapDisclaimer}</Typography>
                      </Alert>
                    )}
                  </Box>
                )}
                <TextField label="Treatment Plan" multiline rows={2} value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} placeholder="e.g. Start MHT, review in 3 months, refer to physio" />
              </Stack>
            </Paper>

            {/* ── Prescriptions ─────────────────────────────────────── */}
            <Accordion expanded={prescExpanded} onChange={() => setPrescExpanded(!prescExpanded)} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="h6">Prescriptions ({prescriptions.length})</Typography>
                  {drugInteractions.length > 0 && (
                    <Badge badgeContent={drugInteractions.length} color="error">
                      <WarningAmberIcon color="warning" fontSize="small" />
                    </Badge>
                  )}
                  {checkingInteractions && <CircularProgress size={18} />}
                  <Button
                    size="small" variant="outlined"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={(e) => { e.stopPropagation(); handleSuggestPrescriptions(); }}
                    disabled={loadingRxSuggest || !selectedPatientId}
                  >
                    {loadingRxSuggest ? '...' : 'AI Suggest'}
                  </Button>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                {/* ── Drug interaction alerts ──────────────────────── */}
                {drugInteractions.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    {drugInteractions.map((di, idx) => (
                      <Alert key={idx} severity={getInteractionSeverityColor(di.severity)} sx={{ mb: 1 }} icon={<WarningAmberIcon />}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{di.medications.join(' + ')} — {di.severity}</Typography>
                        <Typography variant="body2">{di.description}</Typography>
                        <Typography variant="caption">{di.recommendation}</Typography>
                      </Alert>
                    ))}
                  </Box>
                )}
                <Stack spacing={2}>
                  {prescriptions.map((p) => (
                    <Paper key={p.key} variant="outlined" sx={{ p: 2 }}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2">Prescription</Typography>
                        <IconButton size="small" color="error" onClick={() => removePrescription(p.key)}><DeleteIcon fontSize="small" /></IconButton>
                      </Stack>
                      <Box sx={gridRx}>
                        <TextField label="Medication Name" size="small" fullWidth value={p.medicationName} onChange={(e) => updatePrescription(p.key, 'medicationName', e.target.value)} placeholder="e.g. Estradiol patch" />
                        <TextField label="Dosage" size="small" fullWidth value={p.dosage} onChange={(e) => updatePrescription(p.key, 'dosage', e.target.value)} placeholder="e.g. 50mcg" />
                        <TextField label="Frequency" size="small" fullWidth value={p.frequency} onChange={(e) => updatePrescription(p.key, 'frequency', e.target.value)} placeholder="e.g. twice weekly" />
                        <TextField label="Quantity" size="small" fullWidth value={p.quantity} onChange={(e) => updatePrescription(p.key, 'quantity', e.target.value)} placeholder="e.g. 8 patches" />
                        <TextField label="Repeats" type="number" size="small" fullWidth value={p.repeats} onChange={(e) => updatePrescription(p.key, 'repeats', Number(e.target.value))} slotProps={{ htmlInput: { min: 0, max: 12 } }} />
                        <TextField label="Instructions" size="small" fullWidth value={p.instructions} onChange={(e) => updatePrescription(p.key, 'instructions', e.target.value)} placeholder="e.g. Apply to clean dry skin" />
                        <TextField label="Clinical Notes" size="small" fullWidth value={p.clinicalNotes} onChange={(e) => updatePrescription(p.key, 'clinicalNotes', e.target.value)} placeholder="e.g. PBS authority required" />
                      </Box>
                    </Paper>
                  ))}
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={addPrescription}>Add Prescription</Button>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* ── Pathology Orders ──────────────────────────────────── */}
            <Accordion defaultExpanded={false} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="h6">Pathology Orders ({pathologyOrders.length})</Typography>
                  <Button
                    size="small" variant="outlined"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={(e) => { e.stopPropagation(); handleSuggestInvestigations(); }}
                    disabled={loadingInvSuggest || !selectedPatientId}
                  >
                    {loadingInvSuggest ? '...' : 'AI Suggest Tests'}
                  </Button>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {pathologyOrders.map((o) => (
                    <Paper key={o.key} variant="outlined" sx={{ p: 2 }}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2">Pathology Request</Typography>
                        <IconButton size="small" color="error" onClick={() => removePathology(o.key)}><DeleteIcon fontSize="small" /></IconButton>
                      </Stack>
                      <Box sx={gridInvestCols}>
                        <TextField label="Test Name" size="small" fullWidth value={o.testName} onChange={(e) => updatePathology(o.key, 'testName', e.target.value)} placeholder="e.g. FBE, EUC, LFT" />
                        <FormControl size="small" fullWidth>
                          <InputLabel>Category</InputLabel>
                          <Select value={o.testCategory} label="Category" onChange={(e) => updatePathology(o.key, 'testCategory', e.target.value)}>
                            {PATHOLOGY_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                          </Select>
                        </FormControl>
                        <FormControl size="small" fullWidth>
                          <InputLabel>Urgency</InputLabel>
                          <Select value={o.urgency} label="Urgency" onChange={(e) => updatePathology(o.key, 'urgency', e.target.value)}>
                            <MenuItem value="ROUTINE">Routine</MenuItem><MenuItem value="URGENT">Urgent</MenuItem><MenuItem value="STAT">STAT</MenuItem>
                          </Select>
                        </FormControl>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <label><input type="checkbox" checked={o.fastingRequired} onChange={(e) => updatePathology(o.key, 'fastingRequired', e.target.checked)} /> <Typography variant="body2" component="span">Fasting</Typography></label>
                        </Box>
                      </Box>
                      <Box sx={{ mt: 1.5 }}>
                        <TextField label="Clinical Notes" size="small" fullWidth value={o.clinicalNotes} onChange={(e) => updatePathology(o.key, 'clinicalNotes', e.target.value)} placeholder="Reason for test, clinical indication" />
                      </Box>
                    </Paper>
                  ))}
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={addPathology}>Add Pathology Order</Button>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* ── Radiology Orders ──────────────────────────────────── */}
            <Accordion defaultExpanded={false} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Radiology Orders ({radiologyOrders.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {radiologyOrders.map((o) => (
                    <Paper key={o.key} variant="outlined" sx={{ p: 2 }}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2">Radiology Request</Typography>
                        <IconButton size="small" color="error" onClick={() => removeRadiology(o.key)}><DeleteIcon fontSize="small" /></IconButton>
                      </Stack>
                      <Box sx={gridInvestCols}>
                        <FormControl size="small" fullWidth>
                          <InputLabel>Imaging</InputLabel>
                          <Select value={o.imagingType} label="Imaging" onChange={(e) => updateRadiology(o.key, 'imagingType', e.target.value)}>
                            {IMAGING_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                          </Select>
                        </FormControl>
                        <FormControl size="small" fullWidth>
                          <InputLabel>Body Region</InputLabel>
                          <Select value={o.bodyRegion} label="Body Region" onChange={(e) => updateRadiology(o.key, 'bodyRegion', e.target.value)}>
                            {BODY_REGIONS.map((r) => <MenuItem key={r} value={r}>{r.replace('_', ' ')}</MenuItem>)}
                          </Select>
                        </FormControl>
                        <FormControl size="small" fullWidth>
                          <InputLabel>Urgency</InputLabel>
                          <Select value={o.urgency} label="Urgency" onChange={(e) => updateRadiology(o.key, 'urgency', e.target.value)}>
                            <MenuItem value="ROUTINE">Routine</MenuItem><MenuItem value="URGENT">Urgent</MenuItem><MenuItem value="STAT">STAT</MenuItem>
                          </Select>
                        </FormControl>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <label><input type="checkbox" checked={o.contrastRequired} onChange={(e) => updateRadiology(o.key, 'contrastRequired', e.target.checked)} /> <Typography variant="body2" component="span">Contrast</Typography></label>
                        </Box>
                      </Box>
                      <Box sx={{ mt: 1.5 }}>
                        <TextField label="Clinical Notes" size="small" fullWidth value={o.clinicalNotes} onChange={(e) => updateRadiology(o.key, 'clinicalNotes', e.target.value)} placeholder="Reason for imaging, clinical question" />
                      </Box>
                    </Paper>
                  ))}
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={addRadiology}>Add Radiology Order</Button>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* ── Billing ───────────────────────────────────────────── */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Stack direction="row" sx={{ alignItems: 'center', mb: 2, gap: 1 }}>
                <ReceiptIcon color="primary" /><Typography variant="h6">Billing</Typography>
                <Box sx={{ flex: 1 }} />
                <Button
                  size="small" variant="outlined" startIcon={<AutoAwesomeIcon />}
                  onClick={handleSuggestMBS} disabled={loadingMbsSuggest || !selectedPatientId}
                >
                  {loadingMbsSuggest ? '...' : 'AI MBS Codes'}
                </Button>
              </Stack>
              {invoiceItems.map((item, idx) => (
                <Box key={idx} sx={{ ...gridBilling, ...{ mb: 1.5 } }}>
                  <TextField label="Description" size="small" fullWidth value={item.description} onChange={(e) => updateInvoiceItem(idx, 'description', e.target.value)} placeholder="e.g. Level B consultation" />
                  <TextField label="MBS Item" size="small" fullWidth value={item.mbsItem} onChange={(e) => updateInvoiceItem(idx, 'mbsItem', e.target.value)} placeholder="e.g. 23" />
                  <TextField label="Fee ($)" type="number" size="small" fullWidth value={item.feeCents / 100} onChange={(e) => updateInvoiceItem(idx, 'feeCents', Math.round(Number(e.target.value) * 100))} slotProps={{ htmlInput: { min: 0, step: 0.01 } }} />
                  <Box sx={{ display: 'flex', alignItems: 'center' }}><IconButton size="small" color="error" onClick={() => removeInvoiceItem(idx)}><DeleteIcon fontSize="small" /></IconButton></Box>
                </Box>
              ))}
              <Button variant="outlined" startIcon={<AddIcon />} onClick={addInvoiceItem} size="small" sx={{ mb: 2 }}>Add Invoice Item</Button>
              {invoiceItems.length > 0 && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                  <TextField label="Total" value={`$${(totalCents / 100).toFixed(2)}`} size="small" sx={{ width: 120 }} slotProps={{ input: { readOnly: true } }} />
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Payment Method</InputLabel>
                    <Select value={paymentMethod} label="Payment Method" onChange={(e) => setPaymentMethod(e.target.value)}>
                      <MenuItem value="">— Not recorded —</MenuItem>
                      {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m.replace('_', ' ')}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Stack>
              )}
            </Paper>

            {/* ── Save / Cancel ─────────────────────────────────────── */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined" startIcon={<AutoAwesomeIcon />}
                onClick={handleGeneratePatientSummary}
                disabled={loadingPatientSummary || !gpNotes.trim()}
              >
                {loadingPatientSummary ? '...' : 'Patient Summary'}
              </Button>
              <Button variant="outlined" onClick={() => router.push('/gp-dashboard')}>Cancel</Button>
              <Button
                variant="contained" size="large" onClick={handleSave}
                disabled={saving || !gpNotes.trim()}
                startIcon={saving ? <CircularProgress size={20} /> : undefined}
              >
                {saving ? 'Saving...' : 'Save Consultation'}
              </Button>
            </Box>
          </>
        )}

        {selectedPatientId && loadingDashboard && (
          <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Loading patient data...</Typography></Box>
        )}

        {!selectedPatientId && !loadingPatients && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Select a consented patient to begin the consultation.
            </Typography>
          </Paper>
        )}

        {/* ── Referral Letter Dialog ──────────────────────────────── */}
        <Dialog open={showReferralDialog} onClose={() => setShowReferralDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Referral Letter</DialogTitle>
          <DialogContent>
            {referralLetter && (
              <Stack spacing={2}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{referralLetter.subject}</Typography>
                <Paper variant="outlined" sx={{ p: 2, maxHeight: 400, overflow: 'auto', bgcolor: 'grey.50' }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {referralLetter.body}
                  </Typography>
                </Paper>
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowReferralDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* ── Patient Summary Dialog ────────────────────────────────── */}
        <Dialog open={showSummaryDialog} onClose={() => setShowSummaryDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>{patientSummaryText?.title as string ?? 'Patient Summary'}</DialogTitle>
          <DialogContent>
            {patientSummaryText && (
              <Stack spacing={2}>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.50' }}>
                  <Typography variant="subtitle2" gutterBottom>What We Discussed</Typography>
                  <Typography variant="body2">{patientSummaryText.whatWeDiscussed as string}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>What We Found</Typography>
                  <Typography variant="body2">{patientSummaryText.whatWeFound as string}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>What We Decided</Typography>
                  <Typography variant="body2">{patientSummaryText.whatWeDecided as string}</Typography>
                </Paper>
                {(patientSummaryText.medicationsExplained as string[])?.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Medications</Typography>
                    <Stack spacing={0.5}>
                      {(patientSummaryText.medicationsExplained as string[]).map((m, i) => (
                        <Typography key={i} variant="body2">• {m}</Typography>
                      ))}
                    </Stack>
                  </Box>
                )}
                {(patientSummaryText.testsOrdered as string[])?.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Tests Ordered</Typography>
                    <Stack spacing={0.5}>
                      {(patientSummaryText.testsOrdered as string[]).map((t, i) => (
                        <Typography key={i} variant="body2">• {t}</Typography>
                      ))}
                    </Stack>
                  </Box>
                )}
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.50' }}>
                  <Typography variant="subtitle2" gutterBottom>Next Steps</Typography>
                  <Typography variant="body2">{patientSummaryText.nextSteps as string}</Typography>
                </Paper>
                <Alert severity="info" icon={false}>
                  <Typography variant="caption">{patientSummaryText.disclaimer as string}</Typography>
                </Alert>
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSummaryDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={!!snackbar} autoHideDuration={5000} onClose={() => setSnackbar(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity={snackbar?.severity ?? 'info'} onClose={() => setSnackbar(null)} variant="filled">{snackbar?.message}</Alert>
        </Snackbar>
      </Box>
    </AuthGate>
  );
}

export default function GpConsultPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60dvh' }}>
        <CircularProgress />
      </Box>
    }>
      <GpConsultContent />
    </Suspense>
  );
}
