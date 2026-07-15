import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';
import type { SymptomType } from '@/generated/prisma';

// ── Request / Response types ───────────────────────────────────────────────

export interface LogSymptomRequest {
  date: string;
  symptomType: SymptomType;
  severity: number;
  duration?: number;
  frequency?: number;
  triggers?: string[];
  impactOnDaily?: number;
  notes?: string;
}

export interface SymptomJournalEntry {
  id: string;
  healthProfileId: string;
  date: string;
  symptomType: SymptomType;
  severity: number;
  duration: number | null;
  frequency: number | null;
  triggers: string[];
  reliefFactors: string[];
  impactOnDaily: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LogSymptomResponse = ApiEnvelope<{ entry: SymptomJournalEntry }>;

export interface ListSymptomsRequest {
  from?: string;
  to?: string;
}

export interface SymptomListResponse {
  success: boolean;
  entries: SymptomJournalEntry[];
}

// ── Metrics types ───────────────────────────────────────────────────────────

export interface DailyAverage {
  date: string;
  value: number;
}

export interface MetricData {
  current: number;
  unit: string;
  dailyAverages: DailyAverage[];
}

export interface MetricsResponse {
  success: boolean;
  metrics: Record<string, MetricData>;
}

export interface GetMetricsParams {
  types?: string;
  from?: string;
  to?: string;
  days?: number;
  profileId?: string;
}

// ── API slice ──────────────────────────────────────────────────────────────

export const healthApi = createApi({
  reducerPath: 'healthApi',
  baseQuery,
  tagTypes: ['Symptoms', 'Metrics'],
  endpoints: (builder) => ({
    logSymptom: builder.mutation<LogSymptomResponse, LogSymptomRequest>({
      query: (body) => ({
        url: 'health/symptoms',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Symptoms'],
    }),
    getSymptoms: builder.query<SymptomListResponse, ListSymptomsRequest | void>({
      query: (params) => ({
        url: 'health/symptoms',
        params: params ?? undefined,
      }),
      providesTags: ['Symptoms'],
    }),
    getMetrics: builder.query<MetricsResponse, GetMetricsParams | void>({
      query: (params) => ({
        url: '/health/metrics',
        params: params ?? undefined,
      }),
      providesTags: ['Metrics'],
    }),
  }),
});

export const {
  useLogSymptomMutation,
  useGetSymptomsQuery,
  useGetMetricsQuery,
} = healthApi;
