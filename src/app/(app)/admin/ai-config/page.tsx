'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { ChatSettingsForm } from '@/components/config/chat-settings-form';
import { OpenAiKeyForm } from '@/components/config/openai-key-form';

export default function AiConfigPage() {
  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 920, mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
          AI Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          OpenAI API key management and chat assistant settings.
        </Typography>
        <Stack spacing={3}>
          <OpenAiKeyForm />
          <ChatSettingsForm />
        </Stack>
      </Box>
    </AuthGate>
  );
}
