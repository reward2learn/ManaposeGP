'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import MicNoneIcon from '@mui/icons-material/MicNone';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import {
  chatApi,
  useSaveConversationMutation,
  useSynthesizeVoiceMutation,
} from '@/store/apis/chat-api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearMessages,
  clearPendingSessionActions,
  sendStreamingMessage,
  type ChatStreamMessage,
} from '@/store/chat-stream-slice';
import { isClientClearSessionAction, isExplicitSessionRequest } from '@/lib/chat/session-tools';
import { useTtsVoicePreference } from '@/hooks/use-tts-voice-preference';
import { useVoiceConversation } from '@/hooks/use-voice-conversation';
import { VoiceProfileMenu } from '@/components/chat/voice-profile-menu';
import { readFileAsAttachment } from '@/lib/chat/read-attachment';
import {
  attachmentDataUrl,
  formatFileSize,
  type ChatAttachment,
} from '@/lib/chat/attachments';

const ICON_BUTTON_SX = { width: 40, height: 40 };

function formatTranscript(messages: ChatStreamMessage[]): string {
  const lines = [
    'ManaposeGP — AI Chat Transcript',
    `Generated: ${new Date().toLocaleString()}`,
    '',
  ];
  for (const msg of messages) {
    const role = msg.role === 'user' ? 'You' : 'ManaposeGP AI';
    lines.push(`── ${role} ──`);
    lines.push(msg.content);
    lines.push('');
  }
  return lines.join('\n');
}

export function ChatPanel({ mode }: { mode?: string }) {
  const dispatch = useAppDispatch();
  const { messages, isStreaming, error, pendingSessionActions } = useAppSelector((s) => s.chatStream);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [saveConversation, { isLoading: isSaving }] = useSaveConversationMutation();
  const [synthesizeVoiceMutation] = useSynthesizeVoiceMutation();
  const [ttsVoice, setTtsVoice] = useTtsVoicePreference();

  const lastAssistant = [...messages].reverse().find((msg) => msg.role === 'assistant' && msg.content.trim());

  const sendMessage = useCallback(async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    const attachmentNote = attachments.length
      ? `\n\nAttached files: ${attachments.map((a) => a.name).join(', ')}`
      : '';
    await dispatch(sendStreamingMessage({
      message: `${trimmed}${attachmentNote}`,
      history: messages,
      ...(mode ? { mode } : {}),
      ...(attachments.length ? { attachments } : {}),
    }));
    setAttachments([]);
  }, [attachments, dispatch, messages]);

  const synthesizeVoice = useCallback(async (args: { text: string }) => {
    const payload = await synthesizeVoiceMutation({ ...args, voice: ttsVoice }).unwrap();
    return { data: payload.data };
  }, [synthesizeVoiceMutation, ttsVoice]);

  const {
    voiceMode,
    voicePhase,
    voicePaused,
    sttSupported,
    voiceStatus,
    isSpeaking,
    assistantMuted,
    assistantVolume,
    micUnavailableMessage,
    toggleVoiceMode,
    toggleVoicePause,
    toggleAssistantMuted,
    setAssistantVolume,
    dismissMicUnavailableDialog,
    speakText,
    resetVoiceTranscript,
  } = useVoiceConversation({
    isStreaming,
    lastAssistantText: lastAssistant?.content,
    onTranscriptChange: setInput,
    onSend: sendMessage,
    synthesizeVoice,
  });

  useEffect(() => {
    if (isStreaming || !pendingSessionActions.length) return;

    const actions = [...pendingSessionActions];
    dispatch(clearPendingSessionActions());

    let shouldClear = false;
    const lastUserMessage = [...messages].reverse().find((msg) => msg.role === 'user');
    const explicitSessionRequest = isExplicitSessionRequest(lastUserMessage?.content ?? '');

    for (const action of actions) {
      if (action === 'save_conversation') {
        dispatch(chatApi.util.invalidateTags(['Conversations']));
        setStatus('Conversation saved.');
      }
      if (isClientClearSessionAction(action) && explicitSessionRequest) {
        shouldClear = true;
      }
    }

    if (shouldClear) {
      dispatch(clearMessages());
      setInput('');
      if (voiceMode) resetVoiceTranscript();
    }
  }, [dispatch, isStreaming, pendingSessionActions, resetVoiceTranscript, voiceMode]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setStatus(null);
    setInput('');
    if (voiceMode) resetVoiceTranscript();
    await sendMessage(trimmed);
  };

  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;

    setAttachmentLoading(true);
    setStatus(null);
    const nextAttachments: ChatAttachment[] = [];
    const errors: string[] = [];
    for (const file of files) {
      const result = await readFileAsAttachment(file);
      if (result.attachment) nextAttachments.push(result.attachment);
      if (result.error) errors.push(result.error);
    }
    setAttachments((prev) => [...prev, ...nextAttachments]);
    setAttachmentLoading(false);
    if (errors.length) setStatus(errors.join(' '));
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!messages.length) return;
    const firstUser = messages.find((msg) => msg.role === 'user')?.content ?? 'Chat Conversation';
    await saveConversation({
      title: firstUser.slice(0, 80),
      messages,
    }).unwrap();
    setStatus('Conversation saved.');
  };

  const handleSpeakReply = async () => {
    if (!lastAssistant) return;
    setStatus(null);
    try {
      await speakText(lastAssistant.content);
    } catch {
      setStatus('Could not play the spoken reply.');
    }
  };

  const handleCopy = async () => {
    if (!messages.length) return;
    const text = messages.map((msg) => {
      const role = msg.role === 'user' ? 'You' : 'ManaposeGP AI';
      return `[${role}]\n${msg.content}`;
    }).join('\n\n');
    try {
      await globalThis.navigator.clipboard.writeText(text);
      setStatus('Conversation copied to clipboard.');
    } catch {
      setStatus('Could not copy to clipboard.');
    }
  };

  const handleDownload = () => {
    if (!messages.length) return;
    const blob = new Blob([formatTranscript(messages)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = globalThis.document.createElement('a');
    anchor.href = url;
    anchor.download = `manaposegp-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    globalThis.document.body.appendChild(anchor);
    anchor.click();
    globalThis.document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setStatus('Transcript downloaded.');
  };

  const displayStatus = voiceStatus ?? status;

  return (
    <>
      <Dialog
        open={Boolean(micUnavailableMessage)}
        onClose={dismissMicUnavailableDialog}
        aria-labelledby="mic-unavailable-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="mic-unavailable-title" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MicNoneIcon color="warning" />
          Microphone unavailable
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {micUnavailableMessage}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={dismissMicUnavailableDialog} variant="contained" autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        component="section"
        sx={{
          width: '100%',
          mx: 'auto',
          px: { xs: 0.5, sm: 2 },
          py: 1.5,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 2.5 },
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'rgba(255,255,255,0.03)',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0 }}>
            {/* Messages area */}
            <Box sx={{ flex: 1, overflow: 'auto', pr: 0.5, minHeight: 0 }}>
              {messages.length ? messages.map((msg, index) => (
                <Box
                  key={`${msg.role}-${index}`}
                  sx={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    mb: 1.5,
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      maxWidth: { xs: '92%', sm: '82%' },
                      p: 1.5,
                      bgcolor: msg.role === 'user' ? 'primary.main' : 'rgba(255,255,255,0.06)',
                      color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                    }}
                  >
                    <Typography variant="body2">{msg.content || (isStreaming ? '...' : '')}</Typography>
                    {msg.attachments?.length ? (
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1, gap: 1 }}>
                        {msg.attachments.map((attachment) => {
                          const dataUrl = attachment.kind === 'image' ? attachmentDataUrl(attachment) : null;
                          if (dataUrl) {
                            return (
                              <Box
                                key={`${attachment.name}-${attachment.size}`}
                                component="img"
                                src={dataUrl}
                                alt={attachment.name}
                                sx={{
                                  maxWidth: { xs: 120, sm: 160 },
                                  maxHeight: { xs: 120, sm: 160 },
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  objectFit: 'cover',
                                }}
                              />
                            );
                          }
                          return (
                            <Chip
                              key={`${attachment.name}-${attachment.size}`}
                              label={`${attachment.name} (${formatFileSize(attachment.size)})`}
                              size="small"
                              variant="outlined"
                            />
                          );
                        })}
                      </Stack>
                    ) : null}
                  </Paper>
                </Box>
              )) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
                  Start with "What can you tell me about managing menopause symptoms?"
                </Typography>
              )}
            </Box>

            {/* Processing indicator (non-animated, compact) */}
            {voiceMode && (voicePhase === 'listening' || voicePhase === 'processing' || voicePhase === 'speaking') ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, px: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                {voicePhase === 'listening' ? <MicIcon fontSize="small" color="success" /> : null}
                {voicePhase === 'processing' ? <CircularProgress size={12} /> : null}
                {voicePhase === 'speaking' ? <RecordVoiceOverIcon fontSize="small" color="info" /> : null}
                <Typography variant="caption">
                  {voicePhase === 'listening' ? 'Listening…' : voicePhase === 'processing' ? 'Processing…' : 'Speaking…'}
                </Typography>
              </Box>
            ) : null}

            {error ? <Typography role="alert" color="error.main" variant="body2">{error}</Typography> : null}
            {displayStatus ? (
              <Typography role="status" color={voiceStatus ? 'warning.main' : 'success.main'} variant="body2">
                {displayStatus}
              </Typography>
            ) : null}

            {/* Message input */}
            <TextField
              label="Message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  void handleSend();
                }
              }}
              multiline
              minRows={2}
              maxRows={4}
              fullWidth
              size="small"
            />

            {/* ── Primary toolbar (always visible) ── */}
            <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
              <Tooltip title={isStreaming ? 'Streaming…' : 'Send'}>
                <span>
                  <IconButton
                    color="primary"
                    onClick={() => void handleSend()}
                    disabled={isStreaming || !input.trim()}
                    aria-label="Send"
                    sx={ICON_BUTTON_SX}
                  >
                    <SendIcon />
                  </IconButton>
                </span>
              </Tooltip>
              {sttSupported ? (
                <Tooltip title={voiceMode ? 'Stop listening' : 'Start voice chat'}>
                  <IconButton
                    color={voiceMode ? 'error' : 'default'}
                    onClick={toggleVoiceMode}
                    aria-label={voiceMode ? 'Stop listening' : 'Start voice chat'}
                    aria-pressed={voiceMode}
                    sx={ICON_BUTTON_SX}
                  >
                    {voiceMode ? <MicOffIcon /> : <MicIcon />}
                  </IconButton>
                </Tooltip>
              ) : null}
              <Tooltip title="Clear">
                <span>
                  <IconButton
                    onClick={() => dispatch(clearMessages())}
                    disabled={isStreaming || !messages.length}
                    aria-label="Clear"
                    sx={ICON_BUTTON_SX}
                  >
                    <ClearAllIcon />
                  </IconButton>
                </span>
              </Tooltip>

              {/* Toggle for secondary tools */}
              <Tooltip title={toolsOpen ? 'Hide tools' : 'More tools'}>
                <IconButton
                  onClick={() => setToolsOpen((o) => !o)}
                  aria-label={toolsOpen ? 'Hide tools' : 'More tools'}
                  aria-expanded={toolsOpen}
                  sx={ICON_BUTTON_SX}
                >
                  {toolsOpen ? <ExpandLessIcon /> : <MoreHorizIcon />}
                </IconButton>
              </Tooltip>

              {isStreaming ? <CircularProgress size={18} sx={{ ml: 0.5 }} /> : null}
            </Stack>

            {/* ── Secondary toolbar (collapsible) ── */}
            <Collapse in={toolsOpen}>
              <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5, pt: 0.5 }}>
                <Tooltip title="Copy">
                  <span>
                    <IconButton
                      onClick={() => void handleCopy()}
                      disabled={!messages.length}
                      aria-label="Copy"
                      sx={ICON_BUTTON_SX}
                    >
                      <ContentCopyIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Download">
                  <span>
                    <IconButton
                      onClick={handleDownload}
                      disabled={!messages.length}
                      aria-label="Download"
                      sx={ICON_BUTTON_SX}
                    >
                      <DownloadIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Save">
                  <span>
                    <IconButton
                      onClick={() => void handleSave()}
                      disabled={isSaving || !messages.length}
                      aria-label="Save"
                      sx={ICON_BUTTON_SX}
                    >
                      <SaveIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Speak reply">
                  <span>
                    <IconButton
                      onClick={() => void handleSpeakReply()}
                      disabled={isSpeaking || !lastAssistant}
                      aria-label="Speak reply"
                      sx={ICON_BUTTON_SX}
                    >
                      <RecordVoiceOverIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={voicePaused ? 'Resume conversation' : 'Pause conversation'}>
                  <span>
                    <IconButton
                      onClick={toggleVoicePause}
                      disabled={!voiceMode && !isSpeaking}
                      aria-label={voicePaused ? 'Resume conversation' : 'Pause conversation'}
                      aria-pressed={voicePaused}
                      sx={ICON_BUTTON_SX}
                    >
                      {voicePaused ? <PlayCircleIcon /> : <PauseCircleIcon />}
                    </IconButton>
                  </span>
                </Tooltip>
                <VoiceProfileMenu voice={ttsVoice} onVoiceChange={setTtsVoice} />
                <Tooltip title={assistantMuted ? 'Unmute assistant voice' : 'Mute assistant voice'}>
                  <IconButton
                    onClick={toggleAssistantMuted}
                    aria-label={assistantMuted ? 'Unmute assistant voice' : 'Mute assistant voice'}
                    aria-pressed={assistantMuted}
                    sx={ICON_BUTTON_SX}
                  >
                    {assistantMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                  </IconButton>
                </Tooltip>
                <Box sx={{ width: { xs: 80, sm: 120 }, px: 0.5, display: 'flex', alignItems: 'center' }}>
                  <Slider
                    aria-label="Assistant voice volume"
                    value={Math.round(assistantVolume * 100)}
                    min={0}
                    max={100}
                    step={5}
                    size="small"
                    disabled={assistantMuted}
                    onChange={(_event, value) => {
                      const nextValue = Array.isArray(value) ? value[0] : value;
                      setAssistantVolume(nextValue / 100);
                    }}
                  />
                </Box>
                <Tooltip title={attachmentLoading ? 'Reading files…' : 'Add attachment'}>
                  <span>
                    <IconButton
                      component="label"
                      disabled={attachmentLoading || isStreaming}
                      aria-label="Add attachment"
                      sx={ICON_BUTTON_SX}
                    >
                      <AttachFileIcon />
                      <input
                        hidden
                        multiple
                        type="file"
                        accept="image/*,.csv,.xlsx,.xls,.pdf,.txt"
                        onChange={(event) => void handleAttachmentChange(event)}
                      />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Collapse>

            {/* Attachments preview */}
            {attachments.length ? (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {attachments.map((attachment, index) => {
                  const dataUrl = attachment.kind === 'image' ? attachmentDataUrl(attachment) : null;
                  return (
                    <Box
                      key={`${attachment.name}-${index}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 0.75,
                        pr: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'rgba(255,255,255,0.04)',
                      }}
                    >
                      {dataUrl ? (
                        <Box
                          component="img"
                          src={dataUrl}
                          alt={attachment.name}
                          sx={{ width: 40, height: 40, borderRadius: 0.5, objectFit: 'cover' }}
                        />
                      ) : null}
                      <Box>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                          {attachment.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(attachment.size)}
                          {attachment.extractedText ? ' · text extracted' : ''}
                          {attachment.truncated ? ' · too large to embed' : ''}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        color="inherit"
                        onClick={() => removeAttachment(index)}
                        sx={{ minWidth: 0, px: 1 }}
                        aria-label={`Remove ${attachment.name}`}
                      >
                        ×
                      </IconButton>
                    </Box>
                  );
                })}
              </Stack>
            ) : null}
          </Stack>
          <Typography variant="caption" color="text.disabled" sx={{ mt: 1.5, textAlign: 'center', display: 'block', fontSize: '0.7rem' }}>
            ManaposeGP AI provides educational health information. It does not provide medical advice, diagnosis, or treatment. Always consult a registered GP. In an emergency, call 000.
          </Typography>
        </Paper>
      </Box>
    </>
  );
}
