# Admin App Configuration Skill

OpenAI API key management and chat assistant settings. Consolidated under `/admin/ai-config`.

## Routes

| Route | Methods | Guard | Purpose |
|-------|---------|-------|---------|
| `/api/config/openai-key` | GET, POST, DELETE | `requireWriteAuth` | OpenAI key CRUD (encrypted in DB) |
| `/api/config/settings` | GET, PATCH | `requireWriteAuth` | Chat settings (webSearchEnabled) |
| `/admin/ai-config` | page | `AuthGate pin` | UI with OpenAiKeyForm + ChatSettingsForm |

## OpenAI Key Storage

- Stored in `secrets` table, encrypted via AES-256-GCM
- Key name: `OPENAI_API_KEY`
- `getOpenAiKeyStatus()` checks DB first, then `process.env.OPENAI_API_KEY` env var fallback
- File: `src/lib/secrets.ts`

```typescript
export async function getOpenAiKeyStatus(): Promise<{
  configured: boolean; source: 'db' | 'env' | null;
}> {
  const dbRow = await getSecret('OPENAI_API_KEY');
  if (dbRow) return { configured: true, source: 'db' };
  if (process.env.OPENAI_API_KEY) return { configured: true, source: 'env' };
  return { configured: false, source: null };
}
```

## Chat Settings

- Stored in `app_settings` table (singleton, id = 'default')
- Field: `web_search_enabled` → controls OpenAI web search in chat
- RTK Query: `useGetChatSettingsQuery`, `useUpdateChatSettingsMutation`
- File: `src/domain/config/app-settings-service.ts`

## Feature Flags

- Route: `GET/PATCH /api/admin/feature-flags`
- Guard: `requirePin`
- Stored in `app_settings.feature_flags` (JSONB)
- Must call `ensureAdminTables(db)` before queries
- `getFeatureFlags(db)` / `updateFeatureFlags(db)` in `admin-config-service.ts`
- Both call `ensureAppSettingsTable(db)` internally with try/catch fallbacks

## RTK Query API

- File: `src/store/apis/config-api.ts`
- Tags: `OpenAiKey`, `ChatSettings`
- Hooks: `useGetOpenAiKeyStatusQuery`, `useSaveOpenAiKeyMutation`, `useClearOpenAiKeyMutation`, `useGetChatSettingsQuery`, `useUpdateChatSettingsMutation`
- Base query: `fetchBaseQuery({ baseUrl: '/api', credentials: 'include' })`

## Components

- `OpenAiKeyForm` — shows status, password input for new key, save/remove buttons
- `ChatSettingsForm` — toggle switch for web search with improved error extraction
- Both in `src/components/config/`

## Error Handling

- Settings PATCH route has try/catch with descriptive error messages
- ChatSettingsForm extracts `err.data.error` from RTK Query errors for better diagnostics
- `ensureAppSettingsTable` wraps each DDL call in individual try/catch
