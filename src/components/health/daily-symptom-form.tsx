'use client';

import { useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSession } from '@/hooks/use-session';
import { useLogSymptomMutation } from '@/store/apis/health-api';
import type { SymptomType } from '@/generated/prisma';

// ── Constants ──────────────────────────────────────────────────────────────

type SymptomTypeValue = SymptomType;

const SYMPTOM_TYPE_OPTIONS: { value: SymptomTypeValue; label: string }[] = [
  { value: 'hot_flush', label: 'Hot Flush 🔥' },
  { value: 'night_sweat', label: 'Night Sweat 💧' },
  { value: 'sleep_disturbance', label: 'Sleep Disturbance 😴' },
  { value: 'mood_change', label: 'Mood Change 🎭' },
  { value: 'brain_fog', label: 'Brain Fog ☁️' },
  { value: 'joint_pain', label: 'Joint Pain 🦴' },
  { value: 'vaginal_dryness', label: 'Vaginal Dryness' },
  { value: 'libido_change', label: 'Libido Change 💕' },
  { value: 'fatigue', label: 'Fatigue 😩' },
  { value: 'weight_change', label: 'Weight Change ⚖️' },
  { value: 'headache', label: 'Headache 🤕' },
  { value: 'palpitations', label: 'Heart Palpitations 💓' },
  { value: 'urinary_symptoms', label: 'Urinary Issues 🚽' },
  { value: 'skin_changes', label: 'Skin Changes' },
  { value: 'other', label: 'Other' },
] as const;

const TRIGGER_SUGGESTIONS = [
  'Stress',
  'Spicy food',
  'Alcohol',
  'Caffeine',
  'Heat',
  'Exercise',
  'None',
] as const;

const todayISO = new Date().toISOString().slice(0, 10);

// ── Form types ─────────────────────────────────────────────────────────────

interface DailySymptomFormValues {
  date: string;
  symptomType: SymptomTypeValue | '';
  severity: number;
  duration: number | undefined;
  frequency: number | undefined;
  triggers: string[];
  impactOnDaily: number;
  notes: string;
}

const DEFAULT_VALUES: DailySymptomFormValues = {
  date: todayISO,
  symptomType: '',
  severity: 5,
  duration: undefined,
  frequency: undefined,
  triggers: [],
  impactOnDaily: 5,
  notes: '',
};

// ── Severity slider marks ──────────────────────────────────────────────────

const SEVERITY_MARKS = [
  { value: 0, label: '😊 0' },
  { value: 10, label: '😰 10' },
];

const IMPACT_MARKS = [
  { value: 0, label: 'None' },
  { value: 10, label: 'Severe' },
];

// ── Component ──────────────────────────────────────────────────────────────

export function DailySymptomForm() {
  const { isAuthenticated } = useSession();
  const [logSymptom, { isLoading, isError, error }] = useLogSymptomMutation();

  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DailySymptomFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  // ── Submit handler ────────────────────────────────────────────────────

  const onSubmit = useCallback(
    async (values: DailySymptomFormValues) => {
      try {
        await logSymptom({
          date: values.date,
          symptomType: values.symptomType as SymptomTypeValue,
          severity: values.severity,
          duration: values.duration,
          frequency: values.frequency,
          triggers: values.triggers.length > 0 ? values.triggers : undefined,
          impactOnDaily: values.impactOnDaily,
          notes: values.notes || undefined,
        }).unwrap();

        setSnackbarOpen(true);
        reset(DEFAULT_VALUES);
      } catch {
        // error state handled via isError / error from the mutation hook
      }
    },
    [logSymptom, reset],
  );

  // ── Error message extraction ──────────────────────────────────────────

  const apiErrorMessage: string | null =
    isError && error && 'data' in error
      ? String(
          (error.data as { error?: string })?.error ?? 'Failed to log symptom',
        )
      : isError
        ? 'Network error — please try again.'
        : null;

  // ── Unauthenticated state ─────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <Paper sx={{ maxWidth: 'stretch', mx: 'auto', p: 3 }}>
        <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center' }}>
          Please sign in to log your symptoms.
        </Typography>
      </Paper>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────

  return (
    <>
      <Paper
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        sx={{ maxWidth: 600, mx: 'auto', p: 3 }}
        data-testid="daily-symptom-form"
      >
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
          Daily Symptom Log
        </Typography>

        <Stack spacing={2.5}>
          {/* ── Date picker ────────────────────────────────────────── */}
          <TextField
            type="date"
            label="Date"
            slotProps={{ inputLabel: { shrink: true } }}
            error={!!errors.date}
            helperText={errors.date?.message}
            {...register('date', { required: 'Date is required' })}
          />

          {/* ── Symptom type selector ──────────────────────────────── */}
          <Controller
            name="symptomType"
            control={control}
            rules={{ required: 'Please select a symptom type' }}
            render={({ field, fieldState }) => (
              <FormControl fullWidth error={!!fieldState.error}>
                <InputLabel id="symptom-type-label">Symptom Type</InputLabel>
                <Select
                  {...field}
                  labelId="symptom-type-label"
                  label="Symptom Type"
                >
                  {SYMPTOM_TYPE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
                {fieldState.error && (
                  <FormHelperText>{fieldState.error.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />

          {/* ── Severity slider ────────────────────────────────────── */}
          <Controller
            name="severity"
            control={control}
            render={({ field }) => (
              <Box>
                <Typography id="severity-label" variant="body2" gutterBottom>
                  Severity: <strong>{field.value}</strong>
                </Typography>
                <Slider
                  aria-labelledby="severity-label"
                  value={field.value}
                  onChange={(_, val) => field.onChange(val as number)}
                  min={0}
                  max={10}
                  step={1}
                  marks={SEVERITY_MARKS}
                  valueLabelDisplay="auto"
                />
              </Box>
            )}
          />

          {/* ── Duration input ─────────────────────────────────────── */}
          <TextField
            type="number"
            label="Duration (minutes)"
            helperText="For hot flushes — how long did it last?"
            slotProps={{ htmlInput: { min: 0 } }}
            {...register('duration', {
              setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
              min: { value: 0, message: 'Must be 0 or more' },
            })}
          />

          {/* ── Frequency input ────────────────────────────────────── */}
          <TextField
            type="number"
            label="How many times today?"
            slotProps={{ htmlInput: { min: 0 } }}
            {...register('frequency', {
              setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
              min: { value: 0, message: 'Must be 0 or more' },
            })}
          />

          {/* ── Triggers multi-select ──────────────────────────────── */}
          <Controller
            name="triggers"
            control={control}
            render={({ field }) => (
              <Autocomplete
                multiple
                freeSolo
                options={[...TRIGGER_SUGGESTIONS]}
                value={field.value}
                onChange={(_, newValue) => field.onChange(newValue)}
                onBlur={field.onBlur}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Triggers"
                    placeholder="Type or select..."
                  />
                )}
              />
            )}
          />

          {/* ── Impact slider ──────────────────────────────────────── */}
          <Controller
            name="impactOnDaily"
            control={control}
            render={({ field }) => (
              <Box>
                <Typography id="impact-label" variant="body2" gutterBottom>
                  Impact on your day: <strong>{field.value}</strong>
                </Typography>
                <Slider
                  aria-labelledby="impact-label"
                  value={field.value}
                  onChange={(_, val) => field.onChange(val as number)}
                  min={0}
                  max={10}
                  step={1}
                  marks={IMPACT_MARKS}
                  valueLabelDisplay="auto"
                />
              </Box>
            )}
          />

          {/* ── Notes ──────────────────────────────────────────────── */}
          <TextField
            label="Notes (optional)"
            multiline
            rows={3}
            {...register('notes')}
          />

          {/* ── API error ──────────────────────────────────────────── */}
          {apiErrorMessage && (
            <Alert severity="error" role="alert">
              {apiErrorMessage}
            </Alert>
          )}

          {/* ── Submit ─────────────────────────────────────────────── */}
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={isLoading}
            sx={{ py: 1.5 }}
          >
            {isLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Log Symptom'
            )}
          </Button>
        </Stack>
      </Paper>

      {/* ── Success snackbar ───────────────────────────────────────────── */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
        >
          Symptom logged successfully!
        </Alert>
      </Snackbar>
    </>
  );
}
