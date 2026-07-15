# Rosalita Chatbot System Analysis & New Application Implementation Plan

## Executive Summary

This document provides a comprehensive analysis of the existing chatbot system in the Rosalita website and outlines a complete implementation plan for a new application in `/Users/iliashapiro/Manapose` that will replicate and extend the chatbot capabilities with a modern architecture based on Next.js 16, ZenStack, MUI v7, and hybrid Redux state management.

## Current Chatbot System Analysis

### Core Capabilities in Rosalita Website

#### 1. Chat Model & OpenAI Integration
- **File**: `src/lib/chat/chat-model.ts`
- **Functionality**: Resolves chat completion models with web search support
- **Features**:
  - Dynamic model selection based on environment variables
  - Web search model fallback
  - Realtime model detection and handling

#### 2. Session Management
- **File**: `src/lib/chat/session-tools.ts`
- **Functionality**: Manages chat sessions with explicit user requests
- **Features**:
  - Session actions: new_chat_session, clear_conversation, close_conversation, save_conversation
  - Pattern-based detection of session management requests
  - Integration with OpenAI function calls

#### 3. Message Processing & Sanitization
- **File**: `src/lib/chat/conversation-messages.ts`
- **Functionality**: Sanitizes and processes conversation messages
- **Features**:
  - NUL byte stripping for PostgreSQL compatibility
  - Attachment size limits and validation
  - Base64 payload management for images

#### 4. SSE Streaming
- **File**: `src/lib/chat/sse-parser.ts`
- **Functionality**: Parses Server-Sent Events for streaming responses
- **Features**:
  - Token, action, and error event handling
  - Buffer management for partial streams
  - Error recovery and fallback mechanisms

#### 5. Attachment Handling
- **File**: `src/lib/chat/attachments.ts`
- **Functionality**: Manages file attachments for chat
- **Features**:
  - Image, spreadsheet, and document classification
  - Size limits (MAX_FILE_BYTES: 15MB)
  - Base64 encoding with truncation for oversized files
  - Spreadsheet text extraction

#### 6. Voice & Audio Processing
- **Files**: `src/lib/chat/voice-transcript.ts`, `src/lib/chat/speech-recognition.ts`, `src/lib/chat/check-microphone.ts`
- **Functionality**: Voice input and speech recognition
- **Features**:
  - Speech-to-text conversion
  - Microphone access validation
  - Error handling for various audio scenarios

#### 7. Text-to-Speech
- **File**: `src/lib/chat/tts-voices.ts`
- **Functionality**: Manages TTS voice options
- **Features**:
  - Multiple voice profiles (alloy, echo, fable, onyx, nova, shimmer)
  - Voice persistence via local storage
  - Default voice selection

#### 8. Advanced Chat Integration
- **File**: `src/lib/chat/chat-with-session-tools.ts`
- **Functionality**: Combines streaming with session tools
- **Features**:
  - Tool call processing for session management
  - Streaming response handling
  - Tool round limiting (MAX_TOOL_ROUNDS: 4)

### Architecture Overview

#### State Management
- **Hybrid Redux**: RTK Query + uiSlice + chatStreamSlice + React Hook Form
- **No Zustand**: Explicitly avoided in favor of hybrid approach
- **Chat Stream Slice**: Manages SSE streaming state

#### Authentication
- **JWT Cookie**: `rosalita.session` with tier-based access control
- **Tiers**: public, pin, google
- **Write Auth**: JWT-based, no x-admin-key in client

#### Database
- **ZenStack**: Introspection-first schema with @@map to production tables
- **Generated Client**: `src/generated/prisma`
- **Session-Aware**: `createClient(session)` for policy-aware queries

## New Application Implementation Plan

### Target Directory: `/Users/iliashapiro/Manapose`

#### Project Structure
```
/Users/iliashapiro/Manapose/
├── .codenomad/
│   ├── nomadworks.yaml
│   └── agents/
├── .opencode/
├── docs/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # Route handlers
│   │   ├── components/       # React components
│   │   └── lib/              # Application libraries
│   ├── components/           # UI components
│   ├── lib/                 # Core libraries
│   ├── store/              # Redux state management
│   ├── theme/              # MUI theme
│   └── generated/          # ZenStack generated code
├── scripts/                 # Build and migration scripts
├── tests/                  # Test suite
└── package.json           # Project configuration
```

### Phase-Based Implementation

#### Phase 0: Discovery & Analysis
**Duration**: 1-2 days
**Agents**: website-use-case-analyst, website-legacy-api-analyst, website-migration-planner

**Tasks**:
1. Analyze Rosalita chatbot requirements
2. Identify use cases for new application
3. Map legacy functionality to new architecture
4. Create initial schema draft

#### Phase 1: Scaffold
**Duration**: 3-4 days
**Agents**: website-nextjs-migration, website-typescript-migration, website-zenstack-migration, website-vitest-migration, website-deployment-migration

**Tasks**:
1. Set up Next.js 16 App Router
2. Configure TypeScript strict mode
3. Generate ZenStack client
4. Set up Vitest testing framework
5. Configure Vercel deployment

#### Phase 2: Domain & Database
**Duration**: 2-3 days
**Agents**: website-oop-domain-migration, website-db-migration

**Tasks**:
1. Create domain services layer
2. Implement database migration scripts
3. Ensure legacy table compatibility
4. Set up seed data from Excel/MD sources

#### Phase 3: API & Auth
**Duration**: 3-4 days
**Agents**: website-auth-migration, website-api-migration

**Tasks**:
1. Implement JWT authentication
2. Create write API guards
3. Migrate legacy API endpoints
4. Set up OAuth integration

#### Phase 4: State Management (Hard Gate)
**Duration**: 3-5 days
**Agent**: website-redux-migration

**Tasks**:
1. Implement RTK Query slices
2. Create uiSlice and chatStreamSlice
3. Set up React Hook Form integration
4. Pass enforce:redux validation

#### Phase 5: Dynamic UI
**Duration**: 2-3 days
**Agents**: website-dynamic-ui-migration, website-mui-migration

**Tasks**:
1. Implement page catalog system
2. Create block registry
3. Set up DynamicPage component
4. Configure MUI v7 theme

#### Phase 6: Seed & Content
**Duration**: 2-3 days
**Agents**: website-db-migration, website-dynamic-ui-migration

**Tasks**:
1. Seed financial projections from Excel
2. Load business review content
3. Populate knowledge base
4. Set up page catalog

#### Phase 7-8: Pages & Features
**Duration**: 3-5 days
**Agents**: CoderAgent, BatchExecutor

**Tasks**:
1. Implement dashboard and key pages
2. Add chat interface
3. Create ops-admin and tracking pages
4. Set up review system

#### Phase 9: Deploy & Validate
**Duration**: 2-3 days
**Agents**: website-deployment-migration, website-vitest-migration

**Tasks**:
1. Configure Vercel deployment
2. Run full test suite
3. Validate JWT authentication
4. Deploy to production

## ZenStack Database Schema

### Core Models for Chatbot System

#### 1. Conversation Model
```prisma
model Conversation {
  id           Int      @id @default(autoincrement())
  userName     String   @default("Anonymous") @map("user_name")
  title        String   @default("Chat Conversation")
  messages     Json     @default("[]")
  messageCount Int      @default(0) @map("message_count")
  createdAt    DateTime @default(now()) @map("created_at")

  // Server-side only (/api/chat?resource=conversations)
  @@allow('all', true)
  @@map("conversations")
}
```

#### 2. PdfJob Model
```prisma
model PdfJob {
  jobId              String    @id @default(uuid()) @map("job_id") @db.Uuid
  requestedBySession String?   @map("requested_by_session")
  payload            Json
  status             JobStatus @default(PENDING)
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")
  completedData      Json?     @map("completed_data")

  // Server-side only (/api/auth?action=pdf, /api/vjobs)
  @@allow('all', true)
  @@index([status])
  @@map("job_queue")
}
```

#### 3. ChatAttachment Model (if needed)
```prisma
model ChatAttachment {
  id          String   @id @default(cuid())
  conversationId Int     @map("conversation_id")
  conversation  Conversation @relation(fields: [conversationId], references: [id])
  name         String
  mimeType     String   @map("mime_type")
  size         Int
  kind         String   // 'image' | 'spreadsheet' | 'document'
  dataBase64   String?  @map("data_base64")
  extractedText String? @map("extracted_text")
  truncated    Boolean  @default(false)
  createdAt    DateTime @default(now()) @map("created_at")

  @@map("chat_attachments")
}
```

#### 4. Session Model (for tracking)
```prisma
model ChatSession {
  id            String   @id @default(cuid())
  conversationId Int     @map("conversation_id")
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  sessionType    String   // 'new', 'clear', 'close', 'save'
  toolName       String   // 'new_chat_session', 'clear_conversation', etc.
  toolArgs       Json?    // Arguments passed to tool
  createdAt      DateTime @default(now()) @map("created_at")

  @@map("chat_sessions")
}
```

### Access Policies

#### Financial Projections
```prisma
model FinancialProjection {
  // ... existing fields ...
  @@allow('read', true)
}
```

#### Business Review Parts
```prisma
model BusinessReviewPart {
  // ... existing fields ...
  @@allow('read', user.tier == 'google')
}
```

#### Secrets (Server-side only)
```prisma
model Secret {
  // ... existing fields ...
  @@allow('all', true)
}
```

## Dynamic Routes Implementation

### Route Structure

#### 1. Main Application Routes
```typescript
// src/app/(app)/[slug]/page.tsx
export default function DynamicPage({ params }: { params: { slug: string } }) {
  // Resolve page from catalog
  const page = resolvePage(params.slug);
  if (!page) return notFound();

  // Check auth tier
  if (!tierAllowsAccess(currentTier, page.authTier)) {
    redirect('/login');
  }

  return <DynamicPageComponent page={page} />;
}
```

#### 2. Chat Interface Route
```typescript
// src/app/(app)/ops-chat/page.tsx
export default function ChatPage() {
  const { data: session } = useSession();
  const userTier = session?.tier || 'public';

  if (!tierAllowsAccess(userTier, 'google')) {
    redirect('/login');
  }

  return <ChatInterface />;
}
```

#### 3. Review Parts Route
```typescript
// src/app/(app)/review/[partSlug]/page.tsx
export default function ReviewPartPage({ params }: { params: { partSlug: string } }) {
  const part = resolveReviewPart(params.partSlug);
  if (!part) return notFound();

  if (!tierAllowsAccess(currentTier, part.authTier)) {
    redirect('/login');
  }

  return <ReviewPartContent part={part} />;
}
```

### Middleware Configuration

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';

export default async function middleware(request: Request) {
  const { pathname } = new URL(request.url);

  // Skip auth for public routes
  if (pathname.startsWith('/api/auth') || 
      pathname.startsWith('/_next') ||
      pathname.includes('.')) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check tier-based access for protected routes
  if (pathname.startsWith('/ops-') && session.tier !== 'pin' && session.tier !== 'google') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|.*\.).*)'],
};
```

## MUI GUI Components

### Core Component Structure

#### 1. AppShell Layout
```typescript
// src/components/layout/app-shell.tsx
import { AppBar, Drawer, Toolbar, Typography, Box } from '@mui/material';
import { ReactNode } from 'react';
import { NavigationMenu } from './navigation-menu';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            Rosalita Business Review
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: 240,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: 240, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <NavigationMenu />
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, ml: 30 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
```

#### 2. Chat Interface Component
```typescript
// src/components/chat/chat-interface.tsx
import { useState, useRef, useEffect } from 'react';
import { Box, Paper, TextField, Button, List, ListItem } from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import { useChatStream } from '@/store/chat-stream-slice';

export default function ChatInterface() {
  const [message, setMessage] = useState('');
  const { messages, sendMessage, isStreaming } = useChatStream();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!message.trim()) return;
    await sendMessage(message);
    setMessage('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <Paper sx={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <List>
          {messages.map((msg, index) => (
            <ListItem key={index} sx={{ justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <Paper 
                sx={{ 
                  p: 2, 
                  maxWidth: '70%',
                  bgcolor: msg.role === 'user' ? 'primary.light' : 'grey.100'
                }}
              >
                {msg.content}
              </Paper>
            </ListItem>
          ))}
          <div ref={messagesEndRef} />
        </List>
      </Box>
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          />
          <Button
            variant="contained"
            endIcon={<SendIcon />}
            onClick={handleSend}
            disabled={!message.trim() || isStreaming}
          >
            Send
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
```

#### 3. Session Controls Component
```typescript
// src/components/chat/session-controls.tsx
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import { 
  Add as NewChatIcon,
  Delete as ClearIcon,
  Close as CloseIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { useChatSession } from '@/store/chat-stream-slice';

export default function SessionControls() {
  const { 
    createNewSession, 
    clearCurrentConversation, 
    closeConversation, 
    saveConversation,
    isSessionActive 
  } = useChatSession();

  return (
    <Box sx={{ display: 'flex', gap: 1, p: 1 }}>
      <Tooltip title="New Chat">
        <IconButton onClick={createNewSession} color="primary">
          <NewChatIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Clear Conversation">
        <IconButton onClick={clearCurrentConversation} color="warning">
          <ClearIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Close Conversation">
        <IconButton onClick={closeConversation} color="error">
          <CloseIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Save Conversation">
        <IconButton onClick={saveConversation} color="success">
          <SaveIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
```

#### 4. Attachment Upload Component
```typescript
// src/components/chat/attachment-uploader.tsx
import { useState } from 'react';
import { Box, Button, IconButton, Input, Tooltip } from '@mui/material';
import { AttachFile as AttachIcon } from '@mui/icons-material';
import { readFileAsAttachment } from '@/lib/chat/attachments';
import { useChatSession } from '@/store/chat-stream-slice';

export default function AttachmentUploader() {
  const [isUploading, setIsUploading] = useState(false);
  const { addAttachment } = useChatSession();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await readFileAsAttachment(file);
      if (result.attachment) {
        addAttachment(result.attachment);
      }
    } catch (error) {
      console.error('Failed to upload attachment:', error);
    } finally {
      setIsUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  return (
    <Box>
      <input
        type="file"
        id="attachment-upload"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
        accept="image/*,.csv,.xlsx,.xls,.pdf"
      />
      <label htmlFor="attachment-upload">
        <Tooltip title="Attach File">
          <IconButton component="span" disabled={isUploading}>
            <AttachIcon />
          </IconButton>
        </Tooltip>
      </label>
    </Box>
  );
}
```

## Chatbot Implementation Details

### 1. Chat API Integration

#### Chat Route Handler
```typescript
// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import { resolveChatCompletionModel } from '@/lib/chat/chat-model';
import { getSessionFromRequest } from '@/lib/auth/session';
import { completeChatWithSessionTools } from '@/lib/chat/chat-with-session-tools';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    const db = createClient({ tier: session?.tier || 'public' });
    
    const { messages, stream = false, webSearchEnabled = false } = await request.json();
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const model = resolveChatCompletionModel(webSearchEnabled);
    
    const toolContext = {
      db,
      userName: session?.email || session?.sub || 'Anonymous',
      messages,
    };

    if (stream) {
      return completeChatWithSessionTools({
        apiKey,
        model,
        messages,
        toolContext,
        stream: true,
        webSearchEnabled,
        sessionToolsEnabled: true,
      });
    } else {
      return completeChatWithSessionTools({
        apiKey,
        model,
        messages,
        toolContext,
        stream: false,
        webSearchEnabled,
        sessionToolsEnabled: true,
      });
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 2. Session Management API

#### Session Tools API
```typescript
// src/app/api/auth/session-tools/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { createClient } from '@/lib/db';
import { executeSessionTool } from '@/lib/chat/session-tools';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { toolName, args } = await request.json();
    
    const db = createClient({ tier: session.tier, sub: session.sub });
    const toolContext = {
      db,
      userName: session.email || session.sub || 'Anonymous',
      messages: [], // Would need to fetch current conversation
    };

    const result = await executeSessionTool(toolName, JSON.stringify(args), toolContext);
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Session tool error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Test Scripts & Workflows

### 1. Chatbot Integration Tests

#### Test Suite Structure
```typescript
// tests/chatbot/
├── chat-model.test.ts
├── session-tools.test.ts
├── conversation-messages.test.ts
├── sse-parser.test.ts
├── attachments.test.ts
├── chat-with-session-tools.test.ts
└── integration.test.ts
```

#### Integration Test Example
```typescript
// tests/chatbot/integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@/lib/db';
import { createSession, verifySession } from '@/lib/auth/jwt';
import { resolveChatCompletionModel } from '@/lib/chat/chat-model';

describe('Chatbot Integration', () => {
  let db: ReturnType<typeof createClient>;

  beforeEach(async () => {
    // Setup test database
    db = createClient({ tier: 'google' });
    await db.conversation.deleteMany();
  });

  afterEach(async () => {
    await db.$disconnect();
  });

  it('should handle complete chat flow with session tools', async () => {
    // Create a test session
    const session = await createSession({
      sub: 'test-user',
      tier: 'google',
      email: 'test@example.com',
    });

    // Verify session
    const verified = await verifySession(session);
    expect(verified).not.toBeNull();
    expect(verified?.tier).toBe('google');

    // Test model resolution
    const model = resolveChatCompletionModel(false);
    expect(model).toBeDefined();

    // Test database operations
    const conversation = await db.conversation.create({
      data: {
        userName: 'Test User',
        title: 'Integration Test',
        messages: [],
        messageCount: 0,
      },
    });

    expect(conversation.id).toBeDefined();
  });
});
```

### 2. User Acceptance Test Scripts

#### Manual Testing Workflow
```markdown
# Chatbot User Acceptance Test Workflow

## Prerequisites
1. Deployed application with JWT authentication
2. OpenAI API key configured
3. Database with seed data

## Test Scenarios

### Scenario 1: Basic Chat Functionality
1. Navigate to `/ops-chat`
2. Verify user can send messages
3. Verify AI responses are received
4. Verify message history is maintained

### Scenario 2: Session Management
1. Start a new conversation
2. Send multiple messages
3. Clear conversation
4. Save conversation
5. Verify saved conversations appear in history

### Scenario 3: Attachment Handling
1. Upload an image file
2. Verify image preview appears
3. Upload a spreadsheet
4. Verify extracted text is displayed
5. Test oversized file handling

### Scenario 4: Voice Input
1. Click microphone button
2. Speak a command
3. Verify transcription appears
4. Test voice-to-text accuracy

### Scenario 5: Authentication Tiers
1. Login as public user
2. Attempt to access ops-admin (should be denied)
3. Login as pin user
4. Access ops-admin (should be allowed)
5. Login as google user
6. Access all premium features

## Test Automation

### Automated Test Script
```bash
#!/bin/bash
# tests/chatbot/automated-test.sh

# Set up test environment
export NODE_ENV=test
export DATABASE_URL="postgresql://test:test@localhost:5432/test_chatbot"

# Run tests
npm run test:chatbot

# Generate report
npm run test:chatbot -- --reporter=html --output=reports/chatbot-test-report.html

# Cleanup
npm run test:chatbot -- --clear-cache
```

### Performance Test
```typescript
// tests/chatbot/performance.test.ts
import { performance } from 'perf_hooks';
import { createClient } from '@/lib/db';

describe('Chatbot Performance', () => {
  it('should handle 100 messages within 5 seconds', async () => {
    const db = createClient({ tier: 'google' });
    const startTime = performance.now();

    // Create test messages
    const messages = Array.from({ length: 100 }, (_, i) => ({
      role: 'user',
      content: `Test message ${i + 1}`,
    }));n
    // Process messages
    for (const message of messages) {
      await db.conversation.create({
        data: {
          userName: 'Performance Test',
          title: 'Performance Test',
          messages: [message],
          messageCount: 1,
        },
      });
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(5000); // 5 seconds
  });
});
```

## Monitoring & Logging

### Chat Activity Monitoring
```typescript
// src/lib/chat/analytics.ts
import { createClient } from '@/lib/db';

export interface ChatAnalytics {
  totalConversations: number;
  activeUsers: number;
  averageSessionLength: number;
  popularTopics: string[];
  errorRate: number;
}

export async function getChatAnalytics(timeframe: 'day' | 'week' | 'month'): Promise<ChatAnalytics> {
  const db = createClient({ tier: 'public' });
  const now = new Date();
  const startDate = new Date();

  switch (timeframe) {
    case 'day':
      startDate.setDate(now.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
  }

  const conversations = await db.conversation.findMany({
    where: {
      createdAt: { gte: startDate },
    },
  });

  return {
    totalConversations: conversations.length,
    activeUsers: new Set(conversations.map(c => c.userName)).size,
    averageSessionLength: conversations.reduce((sum, c) => sum + c.messageCount, 0) / conversations.length,
    popularTopics: [], // Would need NLP analysis
    errorRate: 0, // Would need error tracking
  };
}
```

## Deployment Configuration

### Environment Variables
```bash
# .env.local
POSTGRES_URL=postgresql://username:password@localhost:5432/chatbot_db
ENCRYPTION_KEY=64_hex_characters_here
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_WEB_SEARCH_MODEL=gpt-4o-mini-search-preview
SETUP_TOKEN=your-setup-token-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Vercel Configuration
```javascript
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/src/app/api/$1/route.ts"
    },
    {
      "src": "/(.*)",
      "dest": "/src/app/(app)/$1/page.tsx"
    }
  ],
  "env": {
    "POSTGRES_URL": "@postgres",
    "ENCRYPTION_KEY": "@encryption",
    "OPENAI_API_KEY": "@openai"
  }
}
```

## Maintenance & Support

### Troubleshooting Guide

#### Common Issues & Solutions

1. **Chat API Timeout**
   - Check OpenAI API key validity
   - Verify network connectivity
   - Increase timeout settings

2. **Session Management Issues**
   - Check JWT token expiration
   - Verify database connectivity
   - Clear browser cache

3. **Attachment Upload Failures**
   - Check file size limits
   - Verify MIME type support
   - Check browser compatibility

4. **Voice Recognition Problems**
   - Check microphone permissions
   - Verify browser support
   - Test with different languages

### Backup & Recovery

#### Database Backup Script
```bash
#!/bin/bash
# scripts/backup-chatbot-db.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/chatbot"
DB_URL="postgresql://username:password@localhost:5432/chatbot_db"

mkdir -p "$BACKUP_DIR"

# Backup database
pg_dump "$DB_URL" > "$BACKUP_DIR/chatbot_backup_$TIMESTAMP.sql"

# Backup attachments
find /app/public/attachments -type f -name "*.png" -o -name "*.jpg" -o -name "*.pdf" > "$BACKUP_DIR/attachments_$TIMESTAMP.txt"

# Compress backups
tar -czf "$BACKUP_DIR/chatbot_full_backup_$TIMESTAMP.tar.gz" -C "$BACKUP_DIR" chatbot_backup_$TIMESTAMP.sql attachments_$TIMESTAMP.txt

# Clean up old backups
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/chatbot_full_backup_$TIMESTAMP.tar.gz"
```

## Conclusion

This comprehensive implementation plan provides a complete roadmap for building a sophisticated chatbot system in the new `/Users/iliashapiro/Manapose` application. The plan leverages the proven architecture from the Rosalita website while incorporating modern best practices and ensuring full compatibility with the existing requirements.

The implementation will deliver:

1. **Enterprise-grade chatbot** with session management, attachment handling, and voice integration
2. **Robust authentication** with JWT-based tier access control
3. **Scalable database** with ZenStack and comprehensive access policies
4. **Modern UI** with MUI v7 and dynamic routing
5. **Comprehensive testing** with automated and manual test suites
6. **Production-ready deployment** with Vercel integration

The phased approach ensures each component is built with proper validation and integration points, resulting in a reliable and maintainable chatbot system that meets all specified requirements.
