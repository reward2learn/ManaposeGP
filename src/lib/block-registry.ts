import type { ComponentType } from 'react';
import type { BlockType } from '@/lib/page-catalog';
import { HeroBlock } from '@/components/blocks/hero-block';
import { DocMarkdownBlock } from '@/components/blocks/doc-markdown-block';
import { KpiCardsBlock } from '@/components/blocks/kpi-cards-block';
import { MetricGridBlock } from '@/components/blocks/metric-grid-block';
import { LeverAccordionBlock } from '@/components/blocks/lever-accordion-block';
import { ActionChecklistBlock } from '@/components/blocks/action-checklist-block';
import { ChartFinancialBlock } from '@/components/blocks/chart-financial-block';
import { PnlTableBlock } from '@/components/blocks/pnl-table-block';
import { ReportsRollupBlock } from '@/components/blocks/reports-rollup-block';
import {
  OpsAdminTabsBlock,
  ZReportFormBlock,
  CostsFormBlock,
  CalendarImportBlock,
  ChatPanelBlock,
  ReviewBlocksBlock,
} from '@/components/blocks/stub-blocks';

export type BlockComponent = ComponentType<{ config: Record<string, unknown> }>;

export const BLOCK_REGISTRY: Record<BlockType, BlockComponent> = {
  hero: HeroBlock,
  doc_markdown: DocMarkdownBlock,
  kpi_cards: KpiCardsBlock,
  metric_grid: MetricGridBlock,
  lever_accordion: LeverAccordionBlock,
  action_checklist: ActionChecklistBlock,
  chart_financial: ChartFinancialBlock,
  pnl_table: PnlTableBlock,
  ops_admin_tabs: OpsAdminTabsBlock,
  z_report_form: ZReportFormBlock,
  costs_form: CostsFormBlock,
  calendar_import: CalendarImportBlock,
  chat_panel: ChatPanelBlock,
  review_blocks: ReviewBlocksBlock,
  reports_rollup: ReportsRollupBlock,
  // Healthcare blocks — stub placeholder until components are built
  health_metrics_cards: () => null,
  symptom_timeline: () => null,
  ai_insights_panel: () => null,
  daily_symptom_form: () => null,
  symptom_trends_chart: () => null,
  gp_summary_generator: () => null,
  consultation_checklist: () => null,
  symptom_summary_export: () => null,
  patient_list: () => null,
  clinical_alerts: () => null,
  guideline_search: () => null,
  guideline_browser: () => null,
  drug_interaction_checker: () => null,
  risk_calculator: () => null,
  patient_context_panel: () => null,
  soap_note_generator: () => null,
  referral_letter_generator: () => null,
  health_education_library: () => null,
};

export function getBlockComponent(blockType: BlockType): BlockComponent {
  return BLOCK_REGISTRY[blockType];
}
