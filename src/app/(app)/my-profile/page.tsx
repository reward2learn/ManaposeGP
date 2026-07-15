'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import type { Route } from 'next';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

export default function PatientProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);

  const [dateOfBirth, setDateOfBirth] = useState('');
  const [menopauseStatus, setMenopauseStatus] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [smokingStatus, setSmokingStatus] = useState('');
  const [allergies, setAllergies] = useState('');
  const [alcoholUnits, setAlcoholUnits] = useState('');
  const [exerciseMins, setExerciseMins] = useState('');

  // Health metrics displayed on dashboard — no need to fetch here
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health/profile', { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.profile) {
        setProfile(data.profile);
        setDateOfBirth(data.profile.dateOfBirth?.slice(0,10) || '');
        setMenopauseStatus(data.profile.menopauseStatus || '');
        setHeightCm(data.profile.heightCm || '');
        setWeightKg(data.profile.weightKg || '');
        setBloodType(data.profile.bloodType || '');
        setChronicConditions((data.profile.chronicConditions || []).join(', '));
        setCurrentMedications((data.profile.currentMedications || []).join(', '));
        setSmokingStatus(data.profile.smokingStatus || '');
        setAllergies((data.profile.allergies || []).join(', '));
        setAlcoholUnits(data.profile.alcoholUnitsPerWeek || '');
        setExerciseMins(data.profile.exerciseMinutesPerWeek || '');
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true); setResult(null);
    try {
      const res = await fetch('/api/health/profile', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateOfBirth: dateOfBirth || undefined,
          menopauseStatus: menopauseStatus || undefined,
          heightCm: heightCm ? Number(heightCm) : undefined,
          weightKg: weightKg ? Number(weightKg) : undefined,
          bloodType: bloodType || undefined,
          chronicConditions: chronicConditions ? chronicConditions.split(',').map(s => s.trim()).filter(Boolean) : undefined,
          currentMedications: currentMedications ? currentMedications.split(',').map(s => s.trim()).filter(Boolean) : undefined,
          smokingStatus: smokingStatus || undefined,
          allergies: allergies ? allergies.split(',').map(s => s.trim()).filter(Boolean) : undefined,
          alcoholUnitsPerWeek: alcoholUnits ? Number(alcoholUnits) : undefined,
          exerciseMinutesPerWeek: exerciseMins ? Number(exerciseMins) : undefined,
        }),
      });
      const data = await res.json();
      setResult(data.success ? 'Profile saved' : data.error);
    } catch { setResult('Network error'); }
    finally { setSaving(false); }
  };

  return (
    <AuthGate requiredTier="google" fallback={<SignInPanelGate requiredTier="google" />}>
      <Box sx={{ maxWidth: 'stretch', mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>My Profile</Typography>

        {/* ── Quick links ─────────────────────────────────────────────── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 2,
            mb: 3,
          }}
        >
          {[
            {
              label: 'Symptom Journal',
              href: '/symptom-journal' as Route,
              icon: <CalendarMonthIcon color="primary" sx={{ fontSize: 32 }} />,
            },
            {
              label: 'Health Dashboard',
              href: '/health-dashboard' as Route,
              icon: <DashboardIcon color="primary" sx={{ fontSize: 32 }} />,
            },
            {
              label: 'Health Library',
              href: '/health-education' as Route,
              icon: <MenuBookIcon color="primary" sx={{ fontSize: 32 }} />,
            },
          ].map((link) => (
            <Card key={link.href} variant="outlined">
              <CardActionArea component={Link} href={link.href} sx={{ p: 1 }}>
                <CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ mb: 0.5 }}>{link.icon}</Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {link.label}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>

        {result && <Alert severity={result.includes('saved') ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setResult(null)}>{result}</Alert>}
        {loading ? <CircularProgress /> : (
          <Stack spacing={3}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Personal Details</Typography>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label="Date of Birth" type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} />
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Menopause Status</InputLabel>
                    <Select value={menopauseStatus} label="Menopause Status" onChange={e => setMenopauseStatus(e.target.value)}>
                      <MenuItem value="">Unknown</MenuItem>
                      <MenuItem value="PREMENOPAUSAL">Premenopausal</MenuItem>
                      <MenuItem value="PERIMENOPAUSAL">Perimenopausal</MenuItem>
                      <MenuItem value="POSTMENOPAUSAL">Postmenopausal</MenuItem>
                      <MenuItem value="EARLY_MENOPAUSE">Early Menopause</MenuItem>
                      <MenuItem value="SURGICAL_MENOPAUSE">Surgical Menopause</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label="Height (cm)" type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} size="small" sx={{ flex: 1 }} />
                  <TextField label="Weight (kg)" type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} size="small" sx={{ flex: 1 }} />
                  <TextField label="Blood Type" value={bloodType} onChange={e => setBloodType(e.target.value)} size="small" sx={{ flex: 1 }} />
                </Stack>
              </Stack>
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Medical History</Typography>
              <Stack spacing={2}>
                <TextField label="Chronic Conditions" value={chronicConditions} onChange={e => setChronicConditions(e.target.value)} size="small" helperText="Comma-separated: osteoporosis, hypertension, diabetes" />
                <TextField label="Current Medications" value={currentMedications} onChange={e => setCurrentMedications(e.target.value)} size="small" helperText="Comma-separated: estradiol, venlafaxine, vitamin D" />
                <TextField label="Allergies" value={allergies} onChange={e => setAllergies(e.target.value)} size="small" helperText="Comma-separated: penicillin, latex" />
              </Stack>
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Lifestyle</Typography>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Smoking</InputLabel>
                    <Select value={smokingStatus} label="Smoking" onChange={e => setSmokingStatus(e.target.value)}>
                      <MenuItem value="">Not specified</MenuItem>
                      <MenuItem value="never">Never smoked</MenuItem>
                      <MenuItem value="former">Former smoker</MenuItem>
                      <MenuItem value="current">Current smoker</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField label="Alcohol (units/week)" type="number" value={alcoholUnits} onChange={e => setAlcoholUnits(e.target.value)} size="small" sx={{ flex: 1 }} />
                  <TextField label="Exercise (mins/week)" type="number" value={exerciseMins} onChange={e => setExerciseMins(e.target.value)} size="small" sx={{ flex: 1 }} />
                </Stack>
              </Stack>
            </Paper>

            <Button variant="contained" size="large" onClick={handleSave} disabled={saving}>
              {saving ? <CircularProgress size={20} /> : 'Save Profile'}
            </Button>
          </Stack>
        )}
      </Box>
    </AuthGate>
  );
}
