'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Chip from '@mui/material/Chip';
import { useState, useEffect, useCallback } from 'react';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { ChatPanel } from '@/components/chat/chat-panel';
import { useAppSelector } from '@/store/hooks';
import { getAssistantsForTier, getAssistantById } from '@/lib/health/assistant-registry';
import { ChatConsentDialog, hasAcceptedChatConsent } from '@/components/health/chat-consent-dialog';

export default function ConsultationAssistPage() {
  const { tier } = useAppSelector((s) => s.auth);
  const assistants = getAssistantsForTier(tier);
  const [selectedId, setSelectedId] = useState<string>(assistants[0]?.id ?? '');
  const assistant = getAssistantById(selectedId);
  const [consentOpen, setConsentOpen] = useState(false);

  useEffect(() => {
    if (!assistant && assistants.length > 0) {
      setSelectedId(assistants[0].id);
    }
  }, [assistant, assistants]);

  // Show consent dialog if not yet accepted (runs once on mount)
  useEffect(() => {
    if (!hasAcceptedChatConsent()) {
      setConsentOpen(true);
    }
  }, []);

  const handleConsentAccept = useCallback(() => {
    setConsentOpen(false);
  }, []);

  if (!assistant) return null;

  return (
    <AuthGate requiredTier="google" fallback={<SignInPanelGate requiredTier="google" />}>
      <ChatConsentDialog open={consentOpen} onAccept={handleConsentAccept} />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 56px)', maxWidth: 900, mx: 'auto', width: '100%', overflow: 'hidden' }}>
        {/* Top bar — assistant selector */}
        <Box sx={{
          px: { xs: 1.5, sm: 2 },
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexShrink: 0,
        }}>
          {/* <Typography variant="h6" sx={{ lineHeight: 1, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
            {assistant.icon}
          </Typography> */}
          <FormControl size="small" sx={{ minWidth: 180, flex: { xs: 1, sm: 'none' } }}>
            <Select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              renderValue={(id) => {
                const a = getAssistantById(id);
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" noWrap>{a?.icon} {a?.name}</Typography>
                  </Box>
                );
              }}
            >
              {assistants.map((a) => (
                <MenuItem key={a.id} value={a.id} sx={{ py: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
                    <Typography sx={{ lineHeight: 1.5, fontSize: '1.1rem' }}>{a.icon}</Typography>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {a.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'normal' }}>
                        {a.description}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {assistant.tier === 'pin' && (
            <Chip label="GP" size="small" color="warning" variant="outlined" sx={{ flexShrink: 0 }} />
          )}
        </Box>

        {/* Full chat experience */}
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ChatPanel mode={assistant.mode} />
        </Box>
      </Box>
    </AuthGate>
  );
}
