'use client';

import { useState, useCallback, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Favorite as HeartIcon,
  WarningAmber as ModerateRiskIcon,
  CheckCircle as LowRiskIcon,
  GppBad as SevereRiskIcon,
  Calculate as CalcIcon,
} from '@mui/icons-material';

// ── Types ────────────────────────────────────────────────────────────────────

interface FraxResult {
  model: string;
  tenYearMajorOsteoporotic: number;
  tenYearHipFracture: number;
  riskCategory: string;
  inputs: Record<string, unknown>;
}

interface CvResult {
  model: string;
  tenYearRisk: number;
  riskCategory: string;
  heartAge?: number;
  inputs: Record<string, unknown>;
}

interface GailResult {
  model: string;
  fiveYearRisk: number;
  lifetimeRisk: number;
  riskCategory: string;
  inputs: Record<string, unknown>;
}

type RiskResult = FraxResult | CvResult | GailResult;

type RiskModel = 'frax' | 'cardiovascular' | 'gail';

// ── Risk colour helpers ──────────────────────────────────────────────────────

const RISK_COLORS: Record<string, { bg: string; fg: string; icon: React.ReactNode; label: string }> = {
  low: {
    bg: '#e8f5e9',
    fg: '#2e7d32',
    icon: <LowRiskIcon sx={{ fontSize: 48 }} />,
    label: 'Low Risk',
  },
  moderate: {
    bg: '#fff3e0',
    fg: '#e65100',
    icon: <ModerateRiskIcon sx={{ fontSize: 48 }} />,
    label: 'Moderate Risk',
  },
  high: {
    bg: '#fce4ec',
    fg: '#c62828',
    icon: <SevereRiskIcon sx={{ fontSize: 48 }} />,
    label: 'High Risk',
  },
};

function riskColor(category: string) {
  return RISK_COLORS[category] ?? RISK_COLORS.low;
}

function riskProgress(category: string, percent: number): number {
  // Scale to 0-100 range: low=0-33, moderate=34-66, high=67-100
  if (category === 'low') return Math.min(percent * 3, 33);
  if (category === 'moderate') return 34 + Math.min((percent - 10) * 3, 33);
  return 67 + Math.min(percent * 2, 33);
}

// ── Risk Score Circle ────────────────────────────────────────────────────────

function RiskScoreCircle({ value, unit, category }: { value: number; unit: string; category: string }) {
  const colors = riskColor(category);
  return (
    <Box sx={{ textAlign: 'center', mb: 2 }}>
      <Typography variant="h2" sx={{ fontWeight: 800, color: colors.fg, lineHeight: 1.1 }}>
        {value}<Typography component="span" variant="h4" sx={{ color: colors.fg }}>%</Typography>
      </Typography>
      <Typography variant="body2" color="text.secondary">{unit}</Typography>
    </Box>
  );
}

// ── Disclaimer ───────────────────────────────────────────────────────────────

function Disclaimer() {
  return (
    <Alert severity="info" sx={{ mt: 2, fontSize: '0.8rem' }}>
      This is a simplified clinical approximation. Always use validated tools (official FRAX, QRISK3, BCSC)
      for clinical decision-making. Results should be interpreted by a qualified healthcare professional.
    </Alert>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function RiskCalculator() {
  const [model, setModel] = useState<RiskModel>('frax');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── FRAX state ───────────────────────────────────────────────────────
  const [ageFrax, setAgeFrax] = useState(55);
  const [sexFrax, setSexFrax] = useState('female');
  const [weight, setWeight] = useState(70);
  const [height, setHeight] = useState(165);
  const [previousFracture, setPreviousFracture] = useState(false);
  const [parentHipFracture, setParentHipFracture] = useState(false);
  const [currentSmoking, setCurrentSmoking] = useState(false);
  const [glucocorticoids, setGlucocorticoids] = useState(false);
  const [rheumatoidArthritis, setRheumatoidArthritis] = useState(false);
  const [secondaryOsteoporosis, setSecondaryOsteoporosis] = useState(false);
  const [alcohol3PerDay, setAlcohol3PerDay] = useState(false);

  // ── Cardiovascular state ─────────────────────────────────────────────
  const [ageCv, setAgeCv] = useState(55);
  const [sexCv, setSexCv] = useState('female');
  const [smoking, setSmoking] = useState('non');
  const [diabetes, setDiabetes] = useState(false);
  const [familyHistoryCVD, setFamilyHistoryCVD] = useState(false);
  const [chronicKidneyDisease, setChronicKidneyDisease] = useState(false);
  const [atrialFibrillation, setAtrialFibrillation] = useState(false);
  const [bloodPressureTreatment, setBloodPressureTreatment] = useState(false);
  const [systolicBP, setSystolicBP] = useState(120);
  const [totalCholesterol, setTotalCholesterol] = useState(5);
  const [hdlCholesterol, setHdlCholesterol] = useState(1.5);
  const [bmi, setBmi] = useState(25);

  // ── Gail state ───────────────────────────────────────────────────────
  const [ageGail, setAgeGail] = useState(55);
  const [ageAtMenarche, setAgeAtMenarche] = useState(13);
  const [ageAtFirstBirth, setAgeAtFirstBirth] = useState<number | ''>('');
  const [firstDegreeRelatives, setFirstDegreeRelatives] = useState(0);
  const [previousBiopsies, setPreviousBiopsies] = useState(0);
  const [atypicalHyperplasia, setAtypicalHyperplasia] = useState(false);

  const calculate = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let patientData: Record<string, unknown>;
      switch (model) {
        case 'frax':
          patientData = { age: ageFrax, sex: sexFrax, weight, height, previousFracture, parentHipFracture, currentSmoking, glucocorticoids, rheumatoidArthritis, secondaryOsteoporosis, alcohol3PerDay };
          break;
        case 'cardiovascular':
          patientData = { age: ageCv, sex: sexCv, smoking, diabetes, familyHistoryCVD, chronicKidneyDisease, atrialFibrillation, bloodPressureTreatment, systolicBP, totalCholesterol, hdlCholesterol, bmi };
          break;
        case 'gail':
          patientData = { age: ageGail, ageAtMenarche, ageAtFirstBirth: ageAtFirstBirth === '' ? null : ageAtFirstBirth, firstDegreeRelatives, previousBiopsies, atypicalHyperplasia };
          break;
      }
      const res = await fetch('/api/gp/risk-calculator', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, patientData }),
      });
      const data = await res.json();
      if (data.success) setResult(data.result as RiskResult);
      else setError(data.error ?? 'Calculation failed');
    } catch { setError('Calculation failed'); }
    finally { setLoading(false); }
  }, [model, ageFrax, sexFrax, weight, height, previousFracture, parentHipFracture, currentSmoking, glucocorticoids, rheumatoidArthritis, secondaryOsteoporosis, alcohol3PerDay, ageCv, sexCv, smoking, diabetes, familyHistoryCVD, chronicKidneyDisease, atrialFibrillation, bloodPressureTreatment, systolicBP, totalCholesterol, hdlCholesterol, bmi, ageGail, ageAtMenarche, ageAtFirstBirth, firstDegreeRelatives, previousBiopsies, atypicalHyperplasia]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  // ── Render helpers per model ─────────────────────────────────────────

  function renderFraxForm() {
    return (
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField label="Age" type="number" size="small" fullWidth value={ageFrax} onChange={e => setAgeFrax(Number(e.target.value))} slotProps={{ htmlInput: { min: 40, max: 90 } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <FormControl size="small" fullWidth><InputLabel>Sex</InputLabel><Select value={sexFrax} label="Sex" onChange={e => setSexFrax(e.target.value)}><MenuItem value="female">Female</MenuItem><MenuItem value="male">Male</MenuItem></Select></FormControl>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField label="Weight (kg)" type="number" size="small" fullWidth value={weight} onChange={e => setWeight(Number(e.target.value))} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField label="Height (cm)" type="number" size="small" fullWidth value={height} onChange={e => setHeight(Number(e.target.value))} />
        </Grid>
      </Grid>
    );
  }

  function renderFraxRiskFactors() {
    const factors: [string, boolean, (v: boolean) => void][] = [
      ['Previous fracture', previousFracture, setPreviousFracture],
      ['Parent hip fracture', parentHipFracture, setParentHipFracture],
      ['Current smoker', currentSmoking, setCurrentSmoking],
      ['Glucocorticoids', glucocorticoids, setGlucocorticoids],
      ['Rheumatoid arthritis', rheumatoidArthritis, setRheumatoidArthritis],
      ['Secondary osteoporosis', secondaryOsteoporosis, setSecondaryOsteoporosis],
      ['Alcohol ≥3 units/day', alcohol3PerDay, setAlcohol3PerDay],
    ];
    return (
      <Grid container spacing={1}>
        {factors.map(([label, value, setter]) => (
          <Grid key={label} size={{ xs: 6, sm: 4, md: 3 }}>
            <FormControlLabel control={<Switch size="small" checked={value} onChange={e => setter(e.target.checked)} />} label={label} sx={{ '& .MuiTypography-root': { fontSize: '0.85rem' } }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  function renderCvForm() {
    return (
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField label="Age" type="number" size="small" fullWidth value={ageCv} onChange={e => setAgeCv(Number(e.target.value))} slotProps={{ htmlInput: { min: 35, max: 84 } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <FormControl size="small" fullWidth><InputLabel>Sex</InputLabel><Select value={sexCv} label="Sex" onChange={e => setSexCv(e.target.value)}><MenuItem value="female">Female</MenuItem><MenuItem value="male">Male</MenuItem></Select></FormControl>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <FormControl size="small" fullWidth><InputLabel>Smoking</InputLabel><Select value={smoking} label="Smoking" onChange={e => setSmoking(e.target.value)}><MenuItem value="non">Non-smoker</MenuItem><MenuItem value="ex">Ex-smoker</MenuItem><MenuItem value="current">Current</MenuItem></Select></FormControl>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField label="Systolic BP" type="number" size="small" fullWidth value={systolicBP} onChange={e => setSystolicBP(Number(e.target.value))} slotProps={{ input: { endAdornment: <InputAdornment position="end">mmHg</InputAdornment> } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField label="Total Chol" type="number" size="small" fullWidth value={totalCholesterol} onChange={e => setTotalCholesterol(Number(e.target.value))} slotProps={{ input: { endAdornment: <InputAdornment position="end">mmol/L</InputAdornment> }, htmlInput: { step: 0.1 } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField label="HDL Chol" type="number" size="small" fullWidth value={hdlCholesterol} onChange={e => setHdlCholesterol(Number(e.target.value))} slotProps={{ input: { endAdornment: <InputAdornment position="end">mmol/L</InputAdornment> }, htmlInput: { step: 0.1 } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField label="BMI" type="number" size="small" fullWidth value={bmi} onChange={e => setBmi(Number(e.target.value))} slotProps={{ htmlInput: { step: 0.1 } }} />
        </Grid>
      </Grid>
    );
  }

  function renderCvRiskFactors() {
    const factors: [string, boolean, (v: boolean) => void][] = [
      ['Diabetes', diabetes, setDiabetes],
      ['Family history CVD', familyHistoryCVD, setFamilyHistoryCVD],
      ['Chronic kidney disease', chronicKidneyDisease, setChronicKidneyDisease],
      ['Atrial fibrillation', atrialFibrillation, setAtrialFibrillation],
      ['On BP treatment', bloodPressureTreatment, setBloodPressureTreatment],
    ];
    return (
      <Grid container spacing={1}>
        {factors.map(([label, value, setter]) => (
          <Grid key={label} size={{ xs: 6, sm: 4 }}>
            <FormControlLabel control={<Switch size="small" checked={value} onChange={e => setter(e.target.checked)} />} label={label} sx={{ '& .MuiTypography-root': { fontSize: '0.85rem' } }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  function renderGailForm() {
    return (
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField label="Age" type="number" size="small" fullWidth value={ageGail} onChange={e => setAgeGail(Number(e.target.value))} slotProps={{ htmlInput: { min: 35, max: 85 } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField label="Age at Menarche" type="number" size="small" fullWidth value={ageAtMenarche} onChange={e => setAgeAtMenarche(Number(e.target.value))} slotProps={{ htmlInput: { min: 8, max: 18 } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField label="Age at First Birth" type="number" size="small" fullWidth value={ageAtFirstBirth} onChange={e => setAgeAtFirstBirth(e.target.value === '' ? '' : Number(e.target.value))} slotProps={{ htmlInput: { min: 12, max: 50 } }} helperText="Leave blank if nulliparous" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField label="1st-Degree Relatives" type="number" size="small" fullWidth value={firstDegreeRelatives} onChange={e => setFirstDegreeRelatives(Number(e.target.value))} slotProps={{ htmlInput: { min: 0, max: 10 } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField label="Previous Biopsies" type="number" size="small" fullWidth value={previousBiopsies} onChange={e => setPreviousBiopsies(Number(e.target.value))} slotProps={{ htmlInput: { min: 0, max: 10 } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <FormControlLabel control={<Switch size="small" checked={atypicalHyperplasia} onChange={e => setAtypicalHyperplasia(e.target.checked)} />} label="Atypical Hyperplasia" sx={{ mt: 1 }} />
        </Grid>
      </Grid>
    );
  }

  function renderFraxResult(r: FraxResult) {
    const colors = riskColor(r.riskCategory);
    return (
      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{r.model}</Typography>
              <Chip label={colors.label} size="small" sx={{ bgcolor: colors.bg, color: colors.fg, fontWeight: 600, mt: 0.5 }} />
            </Box>
            {colors.icon}
          </Stack>

          <Grid container spacing={3} sx={{ mb: 2 }}>
            <Grid size={{ xs: 6 }}>
              <RiskScoreCircle value={r.tenYearMajorOsteoporotic} unit="10-year major osteoporotic fracture risk" category={r.riskCategory} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <RiskScoreCircle value={r.tenYearHipFracture} unit="10-year hip fracture risk" category={r.riskCategory} />
            </Grid>
          </Grid>

          <LinearProgress
            variant="determinate"
            value={riskProgress(r.riskCategory, r.tenYearMajorOsteoporotic)}
            sx={{ height: 8, borderRadius: 4, mb: 2, bgcolor: '#e0e0e0', '& .MuiLinearProgress-bar': { bgcolor: colors.fg, borderRadius: 4 } }}
          />

          <Typography variant="body2" color="text.secondary">
            {r.riskCategory === 'high'
              ? 'High fracture risk — consider DXA scan if not already performed, calcium/vitamin D supplementation, falls risk assessment, and osteoporosis pharmacotherapy evaluation.'
              : r.riskCategory === 'moderate'
              ? 'Moderate fracture risk — consider DXA scan, lifestyle modifications (smoking cessation, alcohol reduction), calcium and vitamin D intake optimisation.'
              : 'Low fracture risk — maintain adequate calcium intake, weight-bearing exercise, and vitamin D levels. Reassess if risk factors change.'}
          </Typography>

          <Disclaimer />
        </CardContent>
      </Card>
    );
  }

  function renderCvResult(r: CvResult) {
    const colors = riskColor(r.riskCategory);
    return (
      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{r.model}</Typography>
              <Chip label={colors.label} size="small" sx={{ bgcolor: colors.bg, color: colors.fg, fontWeight: 600, mt: 0.5 }} />
            </Box>
            {colors.icon}
          </Stack>

          <Grid container spacing={3} sx={{ mb: 2 }}>
            <Grid size={{ xs: 6 }}>
              <RiskScoreCircle value={r.tenYearRisk} unit="10-year CVD risk" category={r.riskCategory} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <HeartIcon sx={{ fontSize: 40, color: colors.fg, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 700, color: colors.fg }}>
                  {r.heartAge ?? '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {r.heartAge ? `Estimated heart age` : 'Heart age not elevated'}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <LinearProgress
            variant="determinate"
            value={riskProgress(r.riskCategory, r.tenYearRisk)}
            sx={{ height: 8, borderRadius: 4, mb: 2, bgcolor: '#e0e0e0', '& .MuiLinearProgress-bar': { bgcolor: colors.fg, borderRadius: 4 } }}
          />

          <Typography variant="body2" color="text.secondary">
            {r.riskCategory === 'high'
              ? 'High cardiovascular risk — statin therapy is strongly indicated. Address modifiable risk factors: smoking cessation, blood pressure control, lipid management, diabetes optimisation. Consider cardiology referral.'
              : r.riskCategory === 'moderate'
              ? 'Moderate cardiovascular risk — lifestyle interventions first-line: Mediterranean diet, regular exercise (150 min/week), smoking cessation. Consider statin if QRISK3 ≥10% or other risk factors present. Annual review.'
              : 'Low cardiovascular risk — encourage healthy lifestyle: regular exercise, balanced diet, maintain healthy weight, avoid smoking. Routine cardiovascular risk reassessment every 5 years.'}
          </Typography>

          <Disclaimer />
        </CardContent>
      </Card>
    );
  }

  function renderGailResult(r: GailResult) {
    const colors = riskColor(r.riskCategory);
    return (
      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{r.model}</Typography>
              <Chip label={colors.label} size="small" sx={{ bgcolor: colors.bg, color: colors.fg, fontWeight: 600, mt: 0.5 }} />
            </Box>
            {colors.icon}
          </Stack>

          <Grid container spacing={3} sx={{ mb: 2 }}>
            <Grid size={{ xs: 6 }}>
              <RiskScoreCircle value={r.fiveYearRisk} unit="5-year breast cancer risk" category={r.riskCategory} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <RiskScoreCircle value={r.lifetimeRisk} unit="Lifetime breast cancer risk" category={r.lifetimeRisk >= 20 ? 'high' : r.riskCategory} />
            </Grid>
          </Grid>

          <LinearProgress
            variant="determinate"
            value={riskProgress(r.riskCategory, r.fiveYearRisk * 20)}
            sx={{ height: 8, borderRadius: 4, mb: 2, bgcolor: '#e0e0e0', '& .MuiLinearProgress-bar': { bgcolor: colors.fg, borderRadius: 4 } }}
          />

          <Typography variant="body2" color="text.secondary">
            {r.riskCategory === 'high'
              ? 'Elevated breast cancer risk — refer for genetic counselling and consider enhanced screening (annual mammogram ± breast MRI from age 40). Discuss risk-reducing medications (tamoxifen, raloxifene) with specialist.'
              : r.riskCategory === 'moderate'
              ? 'Moderate breast cancer risk — ensure regular biennial mammograms from age 50 (BreastScreen Australia). Maintain healthy weight, limit alcohol, regular physical activity. Discuss family history implications.'
              : 'Low breast cancer risk — routine BreastScreen Australia mammograms every 2 years from age 50. Maintain healthy lifestyle: limit alcohol, regular exercise, healthy weight.'}
          </Typography>

          <Disclaimer />
        </CardContent>
      </Card>
    );
  }

  function renderResult() {
    if (!result) return null;
    switch (model) {
      case 'frax': return renderFraxResult(result as FraxResult);
      case 'cardiovascular': return renderCvResult(result as CvResult);
      case 'gail': return renderGailResult(result as GailResult);
    }
  }

  return (
    <Paper sx={{ p: 3 }} component="form" onSubmit={calculate}>
      <Typography variant="h6" sx={{ mb: 2 }}>Risk Calculator</Typography>

      {/* Model tabs */}
      <Tabs value={model} onChange={(_, v) => { setModel(v); reset(); }} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="FRAX (Fracture)" value="frax" />
        <Tab label="Cardiovascular" value="cardiovascular" />
        <Tab label="Gail (Breast Cancer)" value="gail" />
      </Tabs>

      {/* Model-specific input */}
      <Stack spacing={2.5}>
        {model === 'frax' && (
          <>
            {renderFraxForm()}
            <Divider />
            <Typography variant="subtitle2" color="text.secondary">Clinical Risk Factors</Typography>
            {renderFraxRiskFactors()}
          </>
        )}
        {model === 'cardiovascular' && (
          <>
            {renderCvForm()}
            <Divider />
            <Typography variant="subtitle2" color="text.secondary">Comorbidities</Typography>
            {renderCvRiskFactors()}
          </>
        )}
        {model === 'gail' && renderGailForm()}
      </Stack>

      {/* Actions */}
      <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
        <Button type="submit" variant="contained" disabled={loading} startIcon={loading ? <CircularProgress size={18} /> : <CalcIcon />}>
          {loading ? 'Calculating…' : 'Calculate Risk'}
        </Button>
        {result && <Button variant="outlined" onClick={reset}>Reset</Button>}
      </Stack>

      {/* Error */}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      {/* Result */}
      {renderResult()}
    </Paper>
  );
}
