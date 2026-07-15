import type { DbClient } from '@/lib/db';
import { sanitizeConversationMessages, type ConversationMessageInput } from '@/lib/chat/conversation-messages';
import { searchKnowledgeBase } from '@/domain/knowledge/rag-service';

export type ChatSessionAction =
  | 'new_chat_session'
  | 'clear_conversation'
  | 'close_conversation'
  | 'save_conversation';

export const CHAT_SESSION_ACTIONS: ChatSessionAction[] = [
  'new_chat_session',
  'clear_conversation',
  'close_conversation',
  'save_conversation',
];

export function isChatSessionAction(value: unknown): value is ChatSessionAction {
  return typeof value === 'string' && (CHAT_SESSION_ACTIONS as readonly string[]).includes(value);
}

export function isClientClearSessionAction(action: ChatSessionAction): boolean {
  return action === 'new_chat_session'
    || action === 'clear_conversation'
    || action === 'close_conversation';
}

const EXPLICIT_SESSION_REQUEST_PATTERN = /\b(new chat|fresh chat|start over|start fresh|clear(?: the)?(?: chat| conversation)|close(?: the)? conversation|save(?: this)?(?: chat| conversation)|save conversation)\b/i;

/** Only attach session tools when the user is clearly asking to manage the chat UI. */
export function isExplicitSessionRequest(message: string): boolean {
  return EXPLICIT_SESSION_REQUEST_PATTERN.test(message.trim());
}

export const CHAT_SESSION_TOOL_INSTRUCTIONS = `You can manage the active chat session with tools that mirror the chat UI buttons.
Only call a session tool when the user explicitly asks to start a new chat, clear the chat, close the conversation, or save the conversation.
Never call session tools for business questions, metrics, revenue, operations, or general knowledge requests.
When a session tool is appropriate, call the matching tool before confirming the action in your reply.`;

export const CHAT_SESSION_OPENAI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'new_chat_session',
      description: 'Start a fresh chat session and clear the current conversation from the UI.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'clear_conversation',
      description: 'Clear all messages in the current chat without saving.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'close_conversation',
      description: 'Close the current conversation session and clear the chat.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'save_conversation',
      description: 'Save the current conversation to saved conversations.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Optional short title for the saved conversation',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_blog_knowledge',
      description: 'Search the ManaposeGP blog knowledge base for health articles, menopause information, GP guidance, and women\'s health topics. Use this when the user asks about health conditions, treatments, medical advice, or wellness topics covered in the blog.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find relevant blog articles (e.g., "menopause symptoms", "hormone therapy", "bone health")',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
];

export interface SessionToolContext {
  db: DbClient;
  userName: string;
  messages: ConversationMessageInput[];
}

export interface SessionToolResult {
  toolMessage: string;
  clientAction?: ChatSessionAction;
}

export async function executeSessionTool(
  toolName: string,
  rawArgs: string,
  ctx: SessionToolContext,
): Promise<SessionToolResult> {
  let args: Record<string, unknown> = {};
  if (rawArgs.trim()) {
    try {
      args = JSON.parse(rawArgs) as Record<string, unknown>;
    } catch {
      return { toolMessage: 'Tool arguments were invalid JSON.' };
    }
  }

  switch (toolName) {
    case 'new_chat_session':
      return {
        toolMessage: 'Started a new chat session.',
        clientAction: 'new_chat_session',
      };
    case 'clear_conversation':
      return {
        toolMessage: 'Cleared the current conversation.',
        clientAction: 'clear_conversation',
      };
    case 'close_conversation':
      return {
        toolMessage: 'Closed the current conversation.',
        clientAction: 'close_conversation',
      };
    case 'save_conversation': {
      if (!ctx.messages.length) {
        return { toolMessage: 'There is nothing to save yet.' };
      }

      const messages = sanitizeConversationMessages(ctx.messages);
      const firstUser = messages.find((msg) => msg.role === 'user')?.content ?? 'Chat Conversation';
      const title = typeof args.title === 'string' && args.title.trim()
        ? args.title.trim().slice(0, 200)
        : firstUser.slice(0, 80);

      const saved = await ctx.db.conversation.create({
        data: {
          userName: ctx.userName,
          title,
          messages: messages as object[],
          messageCount: messages.length,
        },
      });

      return {
        toolMessage: `Conversation saved (id ${saved.id}).`,
        clientAction: 'save_conversation',
      };
    }
    case 'search_blog_knowledge': {
      const query = typeof args.query === 'string' ? args.query.trim() : '';
      if (!query) return { toolMessage: 'Please provide a search query.' };

      try {
        const results = await searchKnowledgeBase(query, 5);
        if (!results.length) {
          return { toolMessage: 'No relevant blog articles found for that query. Try rephrasing your search.' };
        }

        const formatted = results.map((r, i) =>
          `${i + 1}. [${r.source}] ${r.text.slice(0, 300)}`
        ).join('\n\n');

        return { toolMessage: `Found ${results.length} relevant article(s):\n\n${formatted}` };
      } catch (err) {
        return { toolMessage: 'Search failed: ' + (err instanceof Error ? err.message : 'Unknown error') };
      }
    }
    default:
      return { toolMessage: `Unknown session tool: ${toolName}` };
  }
}
