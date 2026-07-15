/**
 * ManaposeGP Platform — Knowledge Base
 * Used by /api/chat as the AI's system prompt context.
 * Contains all key data and templates for business operations.
 */

export const BUSINESS_NAME = 'ManaposeGP';
export const LOCATION = 'Cloud Platform';

export const SITUATION_SUMMARY = `
ManaposeGP is an AI-powered business operations platform built with Next.js 16, ZenStack, MUI v7, and hybrid Redux state management. The platform provides:

1. AI Chat & Assistant: GPT-4 powered chatbot with session management, attachment handling, voice input, and text-to-speech capabilities.
2. Business Intelligence Dashboard: Real-time financial projections, KPI tracking, metric grids, and revenue driver analysis.
3. Operations Admin: Z-report entry, cost management, calendar import, and staff scheduling.
4. Review & Reporting: Business review parts (A-O), PDF export, analytics rollups, and performance tracking.
5. Auth & Security: JWT-based tier authentication (public, pin, google) with cookie session management.

The platform is designed as a template that can be white-labeled and customized for any business domain — from restaurants and retail to professional services and startups.
`;

export const CURRENT_METRICS = {
  may_2026: {
    revenue: 411_000_000, // IDR
    ebitda: 434_000,
    ebitda_margin_pct: 0.1,
    guests_per_day: 56,
    avg_spend: 220_000,
    staff_cost_pct: 40,
    staff_count: 22,
  },
};

export const TARGET_METRICS = {
  jun_2027_conservative: {
    monthly_revenue: 615_000_000,
    monthly_ebitda: 101_000_000,
    ebitda_margin_pct: 16.5,
    guests_per_day: 82,
    avg_spend: 250_000,
    staff_cost_pct: 22,
  },
  jun_2027_realistic: {
    monthly_revenue: 699_000_000,
    monthly_ebitda: 150_000_000,
    ebitda_margin_pct: 25,
    guests_per_day: 95,
    avg_spend: 265_000,
    staff_cost_pct: 22,
  },
  jun_2027_aspirational: {
    monthly_revenue: 819_000_000,
    monthly_ebitda: 298_000_000,
    ebitda_margin_pct: 32,
    guests_per_day: 100,
    avg_spend: 275_000,
    staff_cost_pct: 22,
  },
};

export const MONTHLY_TARGETS = [
  { month: '2026-06', revenue: 411_000_000, ebitda: 400_000, guests: 56, spend: 220_000, staffPct: 40 },
  { month: '2026-07', revenue: 430_000_000, ebitda: 5_000_000, guests: 60, spend: 225_000, staffPct: 38 },
  { month: '2026-08', revenue: 450_000_000, ebitda: 10_000_000, guests: 63, spend: 228_000, staffPct: 35 },
  { month: '2026-09', revenue: 480_000_000, ebitda: 20_000_000, guests: 65, spend: 230_000, staffPct: 32 },
  { month: '2026-10', revenue: 520_000_000, ebitda: 35_000_000, guests: 70, spend: 235_000, staffPct: 30 },
  { month: '2026-11', revenue: 550_000_000, ebitda: 50_000_000, guests: 73, spend: 238_000, staffPct: 28 },
  { month: '2026-12', revenue: 600_000_000, ebitda: 70_000_000, guests: 78, spend: 240_000, staffPct: 26 },
  { month: '2027-01', revenue: 620_000_000, ebitda: 85_000_000, guests: 80, spend: 245_000, staffPct: 25 },
  { month: '2027-02', revenue: 630_000_000, ebitda: 95_000_000, guests: 82, spend: 248_000, staffPct: 24 },
  { month: '2027-03', revenue: 650_000_000, ebitda: 110_000_000, guests: 85, spend: 250_000, staffPct: 23 },
  { month: '2027-04', revenue: 670_000_000, ebitda: 130_000_000, guests: 88, spend: 255_000, staffPct: 23 },
  { month: '2027-05', revenue: 685_000_000, ebitda: 155_000_000, guests: 92, spend: 260_000, staffPct: 22 },
  { month: '2027-06', revenue: 699_000_000, ebitda: 175_000_000, guests: 95, spend: 265_000, staffPct: 22 },
];

export const FIVE_LEVERS = [
  {
    num: 1,
    name: 'Staff Costs',
    impact: 'IDR 50-80M/month',
    target: '22%% of revenue (from 40-68%%)',
    actions: [
      'Reduce core FTE from 22 to 16',
      'Use part-time/casual for Fri-Sat peaks',
      'Implement 7shifts AI scheduling',
      'Cross-train staff for multi-role capability',
      'Track hours vs revenue daily, flag above 25%%'
    ],
  },
  {
    num: 2,
    name: 'Menu Consolidation',
    impact: 'IDR 10-20M/month',
    target: '48 items (from 60)',
    actions: [
      'Remove Asian Corner (6 items — brand mismatch)',
      'Remove duplicate Chicken Wings listings',
      'Merge Nachos & Mexi Fries into one line',
      'Fix Monday promo: 25%% off → bundle deal',
      'Fix Wednesday promo: 67%% off wings → wing+beer bundle',
      'Reduce taco/burrito fillings based on POS data',
      'Increase prices on underpriced items',
    ],
  },
  {
    num: 3,
    name: 'New Revenue Windows',
    impact: 'IDR 50-100M/month',
    target: 'Happy Hour, Brunch',
    actions: [
      'Daily Happy Hour 4-7PM: 20%% off cocktails, half-price apps',
      'Weekend brunch Sat-Sun 10AM-2PM: build-your-own taco bar',
      'Lunch combo deal 11AM-4PM: main + drink IDR 20K off',
      'Partner with 5 five-star hotels for concierge referrals',
    ],
  },
  {
    num: 4,
    name: 'AI Automation',
    impact: 'IDR 20-50M/month',
    target: 'ChatGPT, 7shifts, Winnow, Hostie',
    actions: [
      'ChatGPT (free): generate captions, respond to reviews',
      'Canva (free): design menu + social templates',
      '7shifts AI scheduling ($29/mo): auto-generate schedules',
      'Winnow food waste AI: camera tracks waste',
      'WhatsApp Business direct ordering (bypass 20-30%% GoFood)',
      'Hostie AI phone assistant ($200/mo): 24/7 reservations',
    ],
  },
  {
    num: 5,
    name: 'Partnerships & Ecosystem Hub',
    impact: 'IDR 34-115M/month',
    target: 'Red Ruby, Prestix.vip, StarPOINTS, industry events',
    actions: [
      'Red Ruby cross-promotion (dinner-to-club packages, shared events)',
      'Dinner + Red Ruby VIP cross-promotion package',
      'Prestix.vip profile for table booking',
      'StarPOINTS bonus program for loyalty',
      'Monthly sector-specific industry events (Massage & Spa, Villa, Tour, Wellness, F&B)',
    ],
  },
];

export const PRIORITY_ACTIONS = {
  P0_THIS_WEEK: [
    'Create ChatGPT + Canva accounts (free, 15min)',
    'Remove Asian Corner from GoFood, website, Instagram',
    'Fix Monday promo: 25%% off → bundle deal',
    'Fix Wednesday promo: 67%% off wings → wing+beer bundle',
    'Check 5AM alcohol licensing for Red Ruby partnership',
    'Set up ManaposeGP platform profile and configuration',
  ],
  P1_THIS_MONTH: [
    'Launch daily Happy Hour 4-7PM',
    'Document cocktail menu pricing',
    'Launch Dinner + Red Ruby VIP package',
    'Sign up for 7shifts AI scheduling',
  ],
  P2_THIS_QUARTER: [
    'Launch weekend brunch Sat-Sun 10AM-2PM',
    'Contact 5 five-star hotels for concierge partnerships',
    'Activate bonus StarPOINTS program',
    'Implement Winnow food waste tracking',
    'Pilot first ecosystem industry event',
  ],
};

export const KEY_RISKS = [
  'Staff costs must stay under 22%% — this is the #1 profit killer',
  'Cocktail menu not yet priced in menu.txt — highest-margin category',
  'No POS sales data by item/day/time — 4-week tracking not started',
  'GoFood takes 20-30%% commission — direct ordering is critical',
  'Asian Corner brand mismatch must be removed from all digital menus',
  'Tax loss carryforward pool of IDR 1.1-1.2B worth IDR 242-264M in savings — expires in 5 years',
];

export const STRATEGIC_PARTNERSHIPS = {
  openai: {
    name: 'OpenAI',
    type: 'GPT-4 / GPT-4o-mini API',
    opportunity: 'AI chat, voice, and TTS capabilities powering the platform',
    revenue_impact: 'Core technology dependency',
  },
  vercel: {
    name: 'Vercel',
    type: 'Serverless deployment & edge hosting',
    opportunity: 'Auto-scaling, global CDN, serverless functions',
    revenue_impact: 'Production deployment infrastructure',
  },
  neon: {
    name: 'Neon',
    type: 'Serverless Postgres database',
    opportunity: 'Branchable DB, auto-scaling, connection pooling',
    revenue_impact: 'Data persistence layer',
  },
};

export function buildSystemPrompt() {
  return `You are ManaposeGP AI — a women's health companion supporting patients through menopause with symptom tracking, health education, GP preparation, and evidence-based guidance.

## Your Role
Help women understand menopause symptoms, track their health journey, prepare for GP consultations, access evidence-based treatment information, and receive compassionate support throughout perimenopause and beyond.

## Platform Capabilities
${SITUATION_SUMMARY}

## Treatment Options
Menopause treatments include Menopausal Hormone Therapy (MHT), non-hormonal medications, lifestyle changes, and complementary approaches. MHT is the most effective treatment for hot flushes and night sweats. All treatment decisions should be discussed with a GP.

## Health Tracking
Regular symptom tracking helps identify patterns and provides valuable data for GP consultations. Track symptom type, severity (0-10), duration, triggers, and impact on daily activities.

## When to See Your GP
See your GP if symptoms interfere with daily life, you have postmenopausal bleeding, very heavy periods, or severe mood changes. For urgent symptoms, contact Lifeline 13 11 14 or 000.

## How You Answer
1. Be warm, educational, and empowering. Use plain language.
2. Never diagnose or prescribe — always encourage speaking with a GP.
3. Cite Australian sources: Jean Hailes, AMS, RACGP guidelines.
4. For urgent symptoms, direct to emergency services immediately.
5. Be specific and data-informed when discussing symptoms and treatments.

Keep responses conversational and supportive. When sharing information, always cite sources.`;
}

function formatIDR(n) {
  if (n >= 1_000_000_000) return `IDR ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `IDR ${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `IDR ${(n / 1_000).toFixed(0)}K`;
  return `IDR ${n}`;
}
