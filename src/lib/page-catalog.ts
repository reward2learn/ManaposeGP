/**
 * Code-first page catalog — runtime SSoT at MVP.
 * DB AppPage/PageSection seeded in P6; catalog wins at runtime.
 */
export type AuthTier = 'public' | 'pin' | 'google';

export type BlockType =
  | 'hero'
  | 'metric_grid'
  | 'chart_financial'
  | 'lever_accordion'
  | 'action_checklist'
  | 'doc_markdown'
  | 'pnl_table'
  | 'ops_admin_tabs'
  | 'z_report_form'
  | 'costs_form'
  | 'calendar_import'
  | 'chat_panel'
  | 'review_blocks'
  | 'kpi_cards'
  | 'reports_rollup'
  // Healthcare block types
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
  | 'soap_note_generator'
  | 'referral_letter_generator'
  | 'health_education_library';

export interface PageSectionDefinition {
  blockType: BlockType;
  config: Record<string, unknown>;
}

export interface PageDefinition {
  slug: string;
  title: string;
  authTier: AuthTier;
  navLabel?: string;
  showInNav?: boolean;
  pdfExport?: boolean;
  sections: PageSectionDefinition[];
}

export interface ReviewPartDefinition {
  partSlug: string;
  partKey: string;
  title: string;
  authTier: AuthTier;
}

/** Parts A–O from Business Review MD (Part O also on /tax-structure). */
export const REVIEW_PART_CATALOG: Record<string, ReviewPartDefinition> = {
  'part-a': {
    partSlug: 'part-a',
    partKey: 'A',
    title: 'Part A: Current Situation — The Numbers That Matter',
    authTier: 'google',
  },
  'part-b': {
    partSlug: 'part-b',
    partKey: 'B',
    title: 'Part B: Step-by-Step Action Plan',
    authTier: 'google',
  },
  'part-c': {
    partSlug: 'part-c',
    partKey: 'C',
    title: 'Part C: Financial Projection — The 12-Month Target',
    authTier: 'google',
  },
  'part-d': {
    partSlug: 'part-d',
    partKey: 'D',
    title: 'Part D: Risk Register',
    authTier: 'google',
  },
  'part-e': {
    partSlug: 'part-e',
    partKey: 'E',
    title: 'Part E: Menu Consolidation Decision Matrix',
    authTier: 'google',
  },
  'part-f': {
    partSlug: 'part-f',
    partKey: 'F',
    title: 'Part F: Timeline at a Glance',
    authTier: 'google',
  },
  'part-g': {
    partSlug: 'part-g',
    partKey: 'G',
    title: 'Part G: Immediate Actions — Next 7 Days',
    authTier: 'google',
  },
  'part-h': {
    partSlug: 'part-h',
    partKey: 'H',
    title: 'Part H: Website Review — manaposegp.com',
    authTier: 'google',
  },
  'part-i': {
    partSlug: 'part-i',
    partKey: 'I',
    title: 'Part I: Revenue Driver Analysis',
    authTier: 'google',
  },
  'part-j': {
    partSlug: 'part-j',
    partKey: 'J',
    title: 'Part J: Area & Competitive Analysis',
    authTier: 'google',
  },
  'part-k': {
    partSlug: 'part-k',
    partKey: 'K',
    title: 'Part K: AI & Automation Strategy',
    authTier: 'google',
  },
  'part-l': {
    partSlug: 'part-l',
    partKey: 'L',
    title: 'Part L: Revised & Final Assessment',
    authTier: 'google',
  },
  'part-m': {
    partSlug: 'part-m',
    partKey: 'M',
    title: 'Part M: Strategic Partnership Analysis',
    authTier: 'google',
  },
  'part-n': {
    partSlug: 'part-n',
    partKey: 'N',
    title: 'Part N: Ecosystem Hub Strategy',
    authTier: 'google',
  },
  'part-o': {
    partSlug: 'part-o',
    partKey: 'O',
    title: 'Part O: Tax Structure Notes',
    authTier: 'public',
  },
};

export const PAGE_CATALOG: Record<string, PageDefinition> = {
  // Legal pages
  'terms-of-service': {
    slug: 'terms-of-service',
    title: 'Terms of Service',
    showInNav: false,
    authTier: 'public',
    sections: [{ blockType: 'doc_markdown', config: { source: 'terms-of-service.html' } }],
  },
  'privacy-policy': {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    showInNav: false,
    authTier: 'public',
    sections: [{ blockType: 'doc_markdown', config: { source: 'privacy-policy.html' } }],
  },

  // ── Healthcare: Patient-facing pages ──
  'health-dashboard': {
    slug: 'health-dashboard',
    title: 'My Health',
    navLabel: 'Health',
    showInNav: true,
    authTier: 'google',
    sections: [
      { blockType: 'health_metrics_cards', config: { variant: 'patient' } },
      { blockType: 'symptom_timeline', config: { period: '3m' } },
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
      { blockType: 'symptom_trends_chart', config: { period: '1m' } },
      { blockType: 'gp_summary_generator', config: { format: 'soap' } },
    ],
  },
  'health-education': {
    slug: 'health-education',
    title: 'Health Library',
    navLabel: 'Learn',
    showInNav: true,
    authTier: 'public',
    sections: [{ blockType: 'health_education_library', config: { topics: ['menopause', 'bone_health', 'mental_health'] } }],
  },
  'blog': {
    slug: 'blog',
    title: 'Blog',
    navLabel: 'Blog',
    showInNav: true,
    authTier: 'public',
    sections: [],
  },
  'gp-onboard': {
    slug: 'gp-onboard',
    title: 'GP Management',
    navLabel: 'GP Mgmt',
    showInNav: true,
    authTier: 'pin',
    sections: [],
  },
  'gp-management': {
    slug: 'gp-onboard',
    title: 'GP Management',
    showInNav: false, // Deduplicated: use /gp-onboard
    authTier: 'pin',
    sections: [],
  },
  'gp-patients': {
    slug: 'gp-patients',
    title: 'My Patients',
    navLabel: 'Patients',
    showInNav: true,
    authTier: 'pin',
    sections: [],
  },
  'my-profile': {
    slug: 'my-profile',
    title: 'My Profile',
    navLabel: 'Profile',
    showInNav: true,
    authTier: 'google',
    sections: [],
  },

  // ── Healthcare: GP-facing pages ──
  'gp-dashboard': {
    slug: 'gp-dashboard',
    title: 'Clinical Dashboard',
    navLabel: 'Clinical',
    showInNav: true,
    authTier: 'pin',
    sections: [
      { blockType: 'patient_list', config: {} },
      { blockType: 'clinical_alerts', config: {} },
      { blockType: 'guideline_search', config: { sources: ['racgp', 'ams', 'jean_hailes', 'etg'] } },
    ],
  },
  'clinical-reference': {
    slug: 'clinical-reference',
    title: 'Clinical Tools',
    navLabel: 'Tools',
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
    navLabel: 'AI Assist',
    showInNav: true,
    authTier: 'google', // Both pin and google tiers via AuthGate
    sections: [
      { blockType: 'chat_panel', config: { mode: 'gp-assist' } },
      { blockType: 'patient_context_panel', config: {} },
      { blockType: 'soap_note_generator', config: {} },
      { blockType: 'referral_letter_generator', config: { directory: 'ams' } },
    ],
  },
  'gp-consult': {
    slug: 'gp-consult',
    title: 'GP Consultation',
    navLabel: 'GP Consultation',
    showInNav: true,
    authTier: 'pin',
    sections: [
      { blockType: 'consultation_checklist', config: { minTier: 'pin' } },
      { blockType: 'patient_list', config: {} },
      { blockType: 'soap_note_generator', config: {} },
    ],
  },
  // ── Admin pages ──
  'admin': {
    slug: 'admin',
    title: 'Administration',
    navLabel: 'Admin',
    showInNav: true,
    authTier: 'pin',
    sections: [],
  },
  'admin/gp-verification': {
    slug: 'admin/gp-verification',
    title: 'GP Verification',
    navLabel: 'GP Verify',
    showInNav: false,
    authTier: 'pin',
    sections: [],
  },
  'admin/practice-settings': {
    slug: 'admin/practice-settings',
    title: 'Practice Settings',
    navLabel: 'Settings',
    showInNav: false,
    authTier: 'pin',
    sections: [],
  },
  'admin/appointment-types': {
    slug: 'admin/appointment-types',
    title: 'Appointment Types',
    showInNav: false,
    authTier: 'pin',
    sections: [],
  },
  'admin/fee-schedule': {
    slug: 'admin/fee-schedule',
    title: 'Fee Schedule',
    showInNav: false,
    authTier: 'pin',
    sections: [],
  },
  'admin/providers': {
    slug: 'admin/providers',
    title: 'Provider Directory',
    showInNav: false,
    authTier: 'pin',
    sections: [],
  },
  'admin/activity-log': {
    slug: 'admin/activity-log',
    title: 'Activity Log',
    showInNav: false,
    authTier: 'pin',
    sections: [],
  },
  'admin/feature-flags': {
    slug: 'admin/feature-flags',
    title: 'Feature Flags',
    showInNav: false,
    authTier: 'pin',
    sections: [],
  },
  'admin/notification-templates': {
    slug: 'admin/notification-templates',
    title: 'Notification Templates',
    showInNav: false,
    authTier: 'pin',
    sections: [],
  },
  'admin/users': {
    slug: 'admin/users',
    title: 'User Management',
    showInNav: false,
    authTier: 'pin',
    sections: [],
  },
};

/**
 * Role-based access: `public` pages are visible to everyone.
 * `pin` and `google` pages are role-isolated — one tier does NOT see the other's pages.
 *
 * Exception: Google-signed-in users who are verified GPs (isGp=true) may also see pin pages.
 */
export function tierAllowsAccess(current: AuthTier, required: AuthTier): boolean {
  if (required === 'public') return true; // Everyone can see public pages
  return current === required; // pin ↔ google are separate roles
}

export function listNavPages(tier: AuthTier, isGp = false): PageDefinition[] {
  return Object.values(PAGE_CATALOG)
    .filter((p) => p.showInNav !== false)
    .filter((p) => {
      if (isGp && tier === 'google' && p.authTier === 'pin') return true;
      return tierAllowsAccess(tier, p.authTier);
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function resolvePage(slug: string): PageDefinition | null {
  return PAGE_CATALOG[slug] ?? null;
}

export function resolveReviewPart(partSlug: string): ReviewPartDefinition | null {
  return REVIEW_PART_CATALOG[partSlug] ?? null;
}

export function listReviewParts(): ReviewPartDefinition[] {
  return Object.values(REVIEW_PART_CATALOG).sort((a, b) =>
    a.partKey.localeCompare(b.partKey),
  );
}

/** Descriptive title without the "Part X: " catalog prefix. */
export function getReviewPartDisplayTitle(title: string): string {
  return title.replace(/^Part [A-O]: /, '');
}
