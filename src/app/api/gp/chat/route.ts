/**
 * GP Clinical Support Chat API
 *
 * POST handler for GP clinical decision support chat with:
 * - PIN-tier auth only (GP level — not accessible to patient `google` tier)
 * - Clinical guidelines context from the database
 * - OpenAI GPT-4o with tool calls for guidelines search, drug interactions, risk scoring
 * - SSE streaming support
 * - Source citation in responses
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import { resolveOpenAiKey } from '@/lib/openai';
import { requirePin } from '@/lib/auth/guards';
import { searchKnowledgeBase, formatKnowledgeContext } from '@/domain/knowledge/rag-service';
import {
  searchGuidelines,
  type GuidelineResult,
} from '@/domain/health/clinical-guideline-service';
import {
  checkInteractions,
  type DrugInteractionResult,
} from '@/domain/health/drug-interaction-checker';
import {
  calculateRisk,
  type RiskOutput,
} from '@/lib/health/clinical-scoring';
import { consumeOpenAiStream } from '@/lib/chat/chat-with-session-tools';
import type { OpenAiChatMessage } from '@/lib/chat/chat-with-session-tools';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── Zod schemas ────────────────────────────────────────────────────────────────

const gpChatBodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    }),
  ).min(1, 'At least one message is required'),
  stream: z.boolean().optional(),
});

// ── System prompt ──────────────────────────────────────────────────────────────

const GP_CLINICAL_SYSTEM_PROMPT = [
  "You are ManaposeGP Clinical Assistant — an evidence-based decision support tool for Australian GPs specialising in women's health and menopause management.",
  '',
  'SOURCES: You reference the RACGP Red Book, Australasian Menopause Society (AMS) information sheets, Therapeutic Guidelines (eTG), Jean Hailes for Women\'s Health, and Australian Medicines Handbook (AMH).',
  '',
  'CAPABILITIES:',
  '- Provide evidence-based information on menopause management, MHT prescribing, and treatment options',
  '- Cite specific guidelines and their recommendations',
  '- Note drug interactions with MHT — always recommend checking the TGA ARTG',
  '- Reference appropriate MBS item numbers for billing',
  '- Help with differential diagnoses for common perimenopausal presentations',
  '- Suggest screening and preventive health activities per RACGP Red Book',
  '',
  'LIMITATIONS:',
  '- You do NOT make the final clinical decision — that remains the GP\'s responsibility',
  '- You do NOT prescribe medications — you provide evidence-based options for the GP to consider',
  '- For complex cases, recommend specialist referral',
  '- Always note when evidence is strong (RCT/meta-analysis) vs moderate (cohort studies) vs emerging (expert consensus)',
  '',
  'FORMAT: Be concise. Cite sources inline. When presenting treatment options, include confidence levels. Use Australian terminology and MBS item numbers where relevant.',
].join('\n');

// ── OpenAI tool definitions ────────────────────────────────────────────────────

interface GpClinicalToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

const GP_CLINICAL_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'searchGuidelines',
      description:
        'Search clinical guidelines and medical references by query text. Returns relevant guideline excerpts from sources such as RACGP Red Book, AMS, eTG, Jean Hailes, and AMH.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Clinical search query, e.g. "MHT breast cancer risk"',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'checkDrugInteractions',
      description:
        'Check for potential drug interactions between a list of medications. Pays special attention to MHT interactions (CYP450, thrombosis risk, efficacy effects).',
      parameters: {
        type: 'object',
        properties: {
          medications: {
            type: 'array',
            items: { type: 'string' },
            description:
              'List of medication names to check, e.g. ["estradiol", "venlafaxine", "warfarin"]',
          },
        },
        required: ['medications'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculateRiskScore',
      description:
        'Calculate clinical risk scores using validated risk models. Available models: FRAX (fracture risk), cardiovascular (QRISK3-inspired), Gail (breast cancer risk). These are clinical approximations for screening — use validated tools for final decisions.',
      parameters: {
        type: 'object',
        properties: {
          model: {
            type: 'string',
            enum: ['frax', 'cardiovascular', 'gail'],
            description: 'Risk model to use',
          },
          data: {
            type: 'object',
            description: 'Patient data for the selected risk model',
          },
        },
        required: ['model', 'data'],
        additionalProperties: false,
      },
    },
  },
];

// ── Constants ──────────────────────────────────────────────────────────────────

const GP_CHAT_MODEL = process.env.OPENAI_GP_CHAT_MODEL || 'gpt-4o';
const MAX_TOOL_ROUNDS = 3;
const MAX_MESSAGES = 20;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function encodeSseLine(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function isGpClinicalToolCall(toolCall: GpClinicalToolCall): boolean {
  return GP_CLINICAL_TOOLS.some(
    (tool) => tool.function.name === toolCall.function.name,
  );
}

/** Build a compact citation from a guideline result. */
function formatGuidelineCitation(g: GuidelineResult): string {
  const header = `[${g.source}] ${g.title}`;
  const urlSuffix = g.url ? ` (${g.url})` : '';
  return `${header}${urlSuffix}\n${g.content}`;
}

/** Build the clinical context block appended to the system prompt. */
function buildClinicalContextBlock(guidelines: GuidelineResult[]): string {
  if (!guidelines.length) return '';
  const excerpts = guidelines.map(formatGuidelineCitation).join('\n\n---\n\n');
  return `\n\n=== RELEVANT CLINICAL GUIDELINES (attached for context) ===\n${excerpts}`;
}

// ── Source tracking ────────────────────────────────────────────────────────────

interface CitedSource {
  id: string;
  title: string;
  source: string;
  url?: string;
  excerpt: string;
}

// ── Tool execution ─────────────────────────────────────────────────────────────

interface ToolExecutionResult {
  toolMessage: string;
  sources: CitedSource[];
}

async function executeSearchGuidelines(
  db: ReturnType<typeof createClient>,
  rawArgs: string,
): Promise<ToolExecutionResult> {
  let args: { query?: string };
  try {
    args = JSON.parse(rawArgs) as { query?: string };
  } catch {
    return {
      toolMessage: 'Error: Invalid JSON arguments for searchGuidelines.',
      sources: [],
    };
  }

  const query = typeof args.query === 'string' ? args.query.trim() : '';
  if (!query) {
    return {
      toolMessage: 'Error: A search query is required for searchGuidelines.',
      sources: [],
    };
  }

  try {
    const { results } = await searchGuidelines(db, query, { topK: 3 });
    if (!results.length) {
      return {
        toolMessage: `No clinical guidelines found matching "${query}".`,
        sources: [],
      };
    }

    const formatted = results.map(formatGuidelineCitation).join('\n\n');
    const sources: CitedSource[] = results.map((r) => ({
      id: r.id,
      title: r.title,
      source: r.source,
      url: r.url,
      excerpt: r.summary ?? r.content.slice(0, 200),
    }));

    return {
      toolMessage: `Found ${results.length} guideline(s):\n\n${formatted}`,
      sources,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      toolMessage: `Error searching guidelines: ${message}`,
      sources: [],
    };
  }
}

async function executeCheckDrugInteractions(
  db: ReturnType<typeof createClient>,
  rawArgs: string,
): Promise<ToolExecutionResult> {
  let args: { medications?: string[] };
  try {
    args = JSON.parse(rawArgs) as { medications?: string[] };
  } catch {
    return {
      toolMessage: 'Error: Invalid JSON arguments for checkDrugInteractions.',
      sources: [],
    };
  }

  const medications = Array.isArray(args.medications)
    ? args.medications.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    : [];

  if (medications.length === 0) {
    return {
      toolMessage: 'Error: At least one medication name is required for checkDrugInteractions.',
      sources: [],
    };
  }

  try {
    const result: DrugInteractionResult = await checkInteractions(db, medications);

    if (result.noInteractionsFound) {
      return {
        toolMessage: `No clinically significant interactions identified between: ${medications.join(', ')}. ${result.disclaimer}`,
        sources: [],
      };
    }

    const lines = result.interactions.map(
      (ix) =>
        `- ${ix.pair.join(' + ')} [${ix.severity}]: ${ix.mechanism}. ${ix.consequences} Recommendation: ${ix.recommendation} (Source: ${ix.source})`,
    );

    return {
      toolMessage: `Drug interaction analysis for: ${medications.join(', ')}\n\n${lines.join('\n\n')}\n\n${result.disclaimer}`,
      sources: [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      toolMessage: `Error checking drug interactions: ${message}`,
      sources: [],
    };
  }
}

async function executeCalculateRiskScore(
  rawArgs: string,
): Promise<ToolExecutionResult> {
  let args: { model?: string; data?: Record<string, unknown> };
  try {
    args = JSON.parse(rawArgs) as { model?: string; data?: Record<string, unknown> };
  } catch {
    return {
      toolMessage: 'Error: Invalid JSON arguments for calculateRiskScore.',
      sources: [],
    };
  }

  const model = typeof args.model === 'string' ? args.model.trim().toLowerCase() : '';
  const data = args.data && typeof args.data === 'object' ? args.data : {};

  if (!model) {
    return {
      toolMessage: 'Error: A risk model name is required (frax, cardiovascular, or gail).',
      sources: [],
    };
  }

  try {
    const result: RiskOutput = calculateRisk(model, data);
    return {
      toolMessage: `Risk score calculated:\n\n${JSON.stringify(result, null, 2)}`,
      sources: [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      toolMessage: `Error calculating risk score: ${message}`,
      sources: [],
    };
  }
}

async function executeGpClinicalTool(
  db: ReturnType<typeof createClient>,
  toolCall: GpClinicalToolCall,
): Promise<ToolExecutionResult> {
  switch (toolCall.function.name) {
    case 'searchGuidelines':
      return executeSearchGuidelines(db, toolCall.function.arguments);
    case 'checkDrugInteractions':
      return executeCheckDrugInteractions(db, toolCall.function.arguments);
    case 'calculateRiskScore':
      return executeCalculateRiskScore(toolCall.function.arguments);
    default:
      return {
        toolMessage: `Unknown tool: ${toolCall.function.name}`,
        sources: [],
      };
  }
}

// ── OpenAI API call ────────────────────────────────────────────────────────────

async function requestOpenAiGpCompletion(
  apiKey: string,
  messages: OpenAiChatMessage[],
  stream: boolean,
): Promise<Response> {
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GP_CHAT_MODEL,
      messages,
      tools: GP_CLINICAL_TOOLS,
      tool_choice: 'auto',
      temperature: 0.5,
      max_tokens: 2000,
      stream,
    }),
  });
}

function openAiErrorMessage(status: number, detail?: string): string {
  if (detail?.trim()) return detail.trim();
  if (status === 401) return 'The OpenAI API key appears to be invalid.';
  if (status === 429) return 'The AI service is currently rate-limited.';
  return 'The AI service returned an error.';
}

async function readOpenAiError(response: Response): Promise<string> {
  try {
    const data = await response.json() as { error?: string | { message?: string } };
    if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
    if (
      data.error &&
      typeof data.error === 'object' &&
      typeof data.error.message === 'string' &&
      data.error.message.trim()
    ) {
      return data.error.message.trim();
    }
  } catch {
    // ignore parse errors
  }
  return openAiErrorMessage(response.status);
}

// ── Non-streaming handler ──────────────────────────────────────────────────────

async function completeGpClinicalNonStreaming(options: {
  apiKey: string;
  messages: OpenAiChatMessage[];
  db: ReturnType<typeof createClient>;
  initialSources: CitedSource[];
}): Promise<Response> {
  const { apiKey, messages, db, initialSources } = options;
  const allSources: CitedSource[] = [...initialSources];
  let currentMessages = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const chatResp = await requestOpenAiGpCompletion(apiKey, currentMessages, false);

    if (!chatResp.ok) {
      const errMessage = await readOpenAiError(chatResp);
      return NextResponse.json(
        { success: true, data: { reply: errMessage, sources: allSources } },
      );
    }

    const data = await chatResp.json() as {
      choices?: {
        finish_reason?: string;
        message?: {
          content?: string | null;
          tool_calls?: GpClinicalToolCall[];
        };
      }[];
    };

    const choice = data.choices?.[0];
    if (!choice?.message) {
      return NextResponse.json({
        success: true,
        data: {
          reply: 'I could not generate a response. Please try again.',
          sources: allSources,
        },
      });
    }

    const message = choice.message;
    const toolCalls = message.tool_calls?.filter(isGpClinicalToolCall) ?? [];

    // If no tool calls, return the assistant response
    if (!toolCalls.length) {
      const reply =
        typeof message.content === 'string' && message.content.trim()
          ? message.content.trim()
          : 'I could not generate a response. Please try rephrasing your question.';

      return NextResponse.json({
        success: true,
        data: { reply, sources: allSources },
      });
    }

    // Handle tool calls
    currentMessages.push({
      role: 'assistant',
      content: message.content ?? null,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const result = await executeGpClinicalTool(db, toolCall);
      allSources.push(...result.sources);
      currentMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result.toolMessage,
      });
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      reply: 'I could not complete the requested clinical analysis. Please try rephrasing your question.',
      sources: allSources,
    },
  });
}

// ── Streaming handler ──────────────────────────────────────────────────────────

async function completeGpClinicalStreaming(options: {
  apiKey: string;
  messages: OpenAiChatMessage[];
  db: ReturnType<typeof createClient>;
  initialSources: CitedSource[];
}): Promise<Response> {
  const { apiKey, messages, db, initialSources } = options;
  const allSources: CitedSource[] = [...initialSources];
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();

  const writeLine = async (payload: unknown): Promise<void> => {
    await writer.write(encoder.encode(encodeSseLine(payload)));
  };

  void (async () => {
    let currentMessages = [...messages];
    let streamedChars = 0;
    let emittedError = false;

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
        const chatResp = await requestOpenAiGpCompletion(apiKey, currentMessages, true);

        if (!chatResp.ok || !chatResp.body) {
          const errMessage = chatResp.ok
            ? 'The AI service returned an empty stream.'
            : await readOpenAiError(chatResp);
          await writeLine({ error: errMessage });
          emittedError = true;
          break;
        }

        const { finishReason, content, toolCalls } = await consumeOpenAiStream(
          chatResp.body,
          async (chunk: string) => {
            streamedChars += chunk.length;
            await writeLine({ choices: [{ delta: { content: chunk } }] });
          },
        );

        // Filter to only GP clinical tool calls
        const gpToolCalls = toolCalls.filter(isGpClinicalToolCall);

        if (finishReason === 'tool_calls' && gpToolCalls.length > 0) {
          currentMessages.push({
            role: 'assistant',
            content: content || null,
            tool_calls: gpToolCalls,
          });

          for (const toolCall of gpToolCalls) {
            const result = await executeGpClinicalTool(db, toolCall);
            allSources.push(...result.sources);

            // Notify client that a tool was used (without streaming tool output to avoid noise)
            await writeLine({
              type: 'tool_call',
              function: toolCall.function.name,
            });

            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result.toolMessage,
            });
          }
          continue;
        }

        // No more tool calls — final response
        break;
      }

      if (streamedChars === 0 && !emittedError) {
        await writeLine({
          error: 'The assistant returned an empty response. Please try again.',
        });
      }

      // Emit sources before done
      if (allSources.length > 0) {
        const deduped = allSources.filter(
          (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i,
        );
        await writeLine({ type: 'sources', sources: deduped });
      }

      await writer.write(encoder.encode('data: [DONE]\n\n'));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Chat stream failed';
      await writeLine({ error: message });
      await writer.write(encoder.encode('data: [DONE]\n\n'));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
}

// ── Main dispatcher ────────────────────────────────────────────────────────────

async function handleGpChat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  stream: boolean,
  db: ReturnType<typeof createClient>,
): Promise<Response> {
  // Get the latest user message for guideline context
  const latestUserMessage =
    [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

  // Resolve API key
  const apiKey = await resolveOpenAiKey();
  if (!apiKey) {
    const reply =
      'The clinical assistant is not fully configured. The administrator needs to add an OpenAI API key.';

    if (stream) {
      const encoder = new TextEncoder();
      const sseBody = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\n`,
            ),
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return new Response(sseBody, { headers: SSE_HEADERS });
    }

    return NextResponse.json({
      success: true,
      data: { reply, sources: [] },
    });
  }

  // ── Build initial clinical context ─────────────────────────────────────
  let clinicalContext = '';
  const initialSources: CitedSource[] = [];

  if (latestUserMessage) {
    try {
      const { results } = await searchGuidelines(db, latestUserMessage, { topK: 3 });
      if (results.length > 0) {
        clinicalContext = buildClinicalContextBlock(results);
        for (const r of results) {
          initialSources.push({
            id: r.id,
            title: r.title,
            source: r.source,
            url: r.url,
            excerpt: r.summary ?? r.content.slice(0, 200),
          });
        }
      }
    } catch {
      // Non-fatal — clinical context is supplementary
    }
  }

  // ── Build OpenAI messages array ─────────────────────────────────────────
  const ragContext = await (async () => {
    try {
      const snippets = await searchKnowledgeBase(latestUserMessage, 3);
      return formatKnowledgeContext(snippets);
    } catch { return ''; }
  })();

  const systemContent = [
    GP_CLINICAL_SYSTEM_PROMPT,
    clinicalContext,
    ragContext,
  ].filter(Boolean).join('\n');

  const openAiMessages: OpenAiChatMessage[] = [
    { role: 'system', content: systemContent },
  ];

  // Trim to last N messages to stay within context limits
  const recentMessages = messages.slice(-MAX_MESSAGES);

  for (const msg of recentMessages) {
    openAiMessages.push({ role: msg.role, content: msg.content });
  }

  // ── Dispatch to streaming or non-streaming ──────────────────────────────
  if (stream) {
    return completeGpClinicalStreaming({
      apiKey,
      messages: openAiMessages,
      db,
      initialSources,
    });
  }
  return completeGpClinicalNonStreaming({
    apiKey,
    messages: openAiMessages,
    db,
    initialSources,
  });
}

// ── POST handler ───────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // Auth guard — PIN tier only (GP level, NOT patient/google)
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({
    tier: guard.session.tier,
    sub: guard.session.sub,
  });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const parsed = gpChatBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      },
      { status: 400 },
    );
  }

  const { messages, stream = false } = parsed.data;

  try {
    return await handleGpChat(messages, stream, db);
  } catch (err) {
    console.error('[gp/chat] Error:', err);
    return NextResponse.json({
      success: true,
      data: {
        reply:
          'I encountered an error processing your request. Please try again in a moment.',
        sources: [],
      },
    });
  }
}
