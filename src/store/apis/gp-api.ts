import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AppointmentItem {
  id: string;
  healthProfileId: string;
  gpId: string;
  date: string;
  timeSlot: string;
  durationMinutes: number;
  type: string;
  status: string;
  reason: string | null;
  notes: string | null;
  consultationId: string | null;
}

export interface PatientListItem {
  profileId: string;
  consentType: string;
  grantedAt: string;
  expiresAt?: string;
  menopauseStatus: string | null;
  age: number | null;
}

export interface ConsultationItem {
  id: string;
  patientId: string;
  gpId: string;
  date: string;
  consultationType: string;
  duration: number | null;
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

// ── Params types ───────────────────────────────────────────────────────────

export interface AppointmentParams {
  gpId?: string;
  healthProfileId?: string;
  from?: string;
  to?: string;
  status?: string;
}

export interface ConsultationParams {
  patientId: string;
}

// ── API slice ──────────────────────────────────────────────────────────────

export const gpApi = createApi({
  reducerPath: 'gpApi',
  baseQuery,
  tagTypes: ['Appointments', 'Patients', 'Consultations'],
  endpoints: (builder) => ({
    // ── Appointments ──────────────────────────────────────────────────
    getAppointments: builder.query<ApiEnvelope<{ appointments: AppointmentItem[] }>, AppointmentParams>({
      query: (params) => ({
        url: 'gp/appointments',
        params,
      }),
      providesTags: ['Appointments'],
    }),
    createAppointment: builder.mutation<ApiEnvelope<{ appointment: AppointmentItem }>, Record<string, unknown>>({
      query: (body) => ({
        url: 'gp/appointments',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Appointments'],
    }),

    // ── Patients ──────────────────────────────────────────────────────
    getPatients: builder.query<ApiEnvelope<{ patients: PatientListItem[] }>, void>({
      query: () => 'gp/patients',
      providesTags: ['Patients'],
    }),

    // ── Consultations ─────────────────────────────────────────────────
    getConsultations: builder.query<ApiEnvelope<{ consultations: ConsultationItem[] }>, ConsultationParams>({
      query: ({ patientId }) => ({
        url: 'gp/consultations',
        params: { patientId },
      }),
      providesTags: ['Consultations'],
    }),
    createConsultation: builder.mutation<ApiEnvelope<{ consultation: ConsultationItem }>, Record<string, unknown>>({
      query: (body) => ({
        url: 'gp/consultations',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Consultations', 'Appointments'],
    }),
  }),
});

export const {
  useGetAppointmentsQuery,
  useCreateAppointmentMutation,
  useGetPatientsQuery,
  useGetConsultationsQuery,
  useCreateConsultationMutation,
} = gpApi;
