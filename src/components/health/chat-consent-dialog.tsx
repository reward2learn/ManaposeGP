'use client';

import { useState, useEffect } from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';

const CONSENT_KEY = 'manaposegp_chat_consent_accepted_v1';

/**
 * Returns true if the user has previously accepted the chat disclaimer.
 * Runs only client-side (uses localStorage).
 */
export function hasAcceptedChatConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(CONSENT_KEY) === 'true';
}

/**
 * Records that the user has accepted the chat disclaimer.
 */
function recordConsentAccepted(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONSENT_KEY, 'true');
}

export interface ChatConsentDialogProps {
  open: boolean;
  onAccept: () => void;
}

/**
 * Displays a one-time disclaimer dialog before first use of the AI chat.
 * Covers: educational purpose only, not medical advice, data privacy, emergency redirect.
 *
 * Required by Australian healthcare compliance (Privacy Act APPs, Medical Board standards).
 */
export function ChatConsentDialog({ open, onAccept }: ChatConsentDialogProps) {
  const [checked, setChecked] = useState(false);

  const handleAccept = () => {
    recordConsentAccepted();
    onAccept();
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth aria-labelledby="chat-consent-title">
      <DialogTitle id="chat-consent-title" sx={{ fontWeight: 700 }}>
        Before you chat with ManaposeGP AI
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Please read and accept the following before using the AI assistant.
        </Alert>

        <Typography variant="body2" sx={{ mb: 1.5 }}>
          <strong>1. Educational purpose only.</strong> ManaposeGP AI provides general health information and education. It does <em>not</em> provide medical advice, diagnosis, or treatment recommendations. Always consult a registered GP for health concerns.
        </Typography>

        <Typography variant="body2" sx={{ mb: 1.5 }}>
          <strong>2. Not a substitute for professional care.</strong> The AI assistant cannot replace a doctor-patient relationship. In a medical emergency, call <strong>000</strong> immediately. For crisis support, call <strong>Lifeline (13 11 14)</strong>.
        </Typography>

        <Typography variant="body2" sx={{ mb: 1.5 }}>
          <strong>3. Data use &amp; privacy.</strong> Your conversations are processed to provide responses and may be stored for quality improvement and legal compliance (7-year medical record retention). Your data is encrypted and handled in accordance with our{' '}
          <Link href="/privacy-policy" target="_blank" underline="hover">Privacy Policy</Link>.
        </Typography>

        <Typography variant="body2" sx={{ mb: 1.5 }}>
          <strong>4. AI limitations.</strong> AI-generated responses may contain inaccuracies. ManaposeGP AI cites Australian clinical sources (RACGP, Jean Hailes, AMS) where possible, but you should verify critical information with your GP.
        </Typography>

        <Typography variant="body2" sx={{ mb: 2 }}>
          <strong>5. Crisis detection.</strong> If you mention self-harm, suicidal ideation, or medical emergencies, the AI will redirect you to emergency services and crisis support lines.
        </Typography>

        <FormControlLabel
          control={
            <Checkbox
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              color="primary"
            />
          }
          label={
            <Typography variant="body2">
              I understand and accept the above. I acknowledge that ManaposeGP AI provides educational health information only, not medical advice.
            </Typography>
          }
        />
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          component="a"
          href="/privacy-policy"
          target="_blank"
          variant="text"
          size="small"
          color="inherit"
        >
          View Privacy Policy
        </Button>
        <Button
          variant="contained"
          onClick={handleAccept}
          disabled={!checked}
          size="medium"
        >
          Accept &amp; Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
}
