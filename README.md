# ManaposeGP

Business operations dashboard and AI chatbot built on the Rosalita website stack: Next.js 16, ZenStack, MUI v7, Redux (RTK Query), and JWT auth.

## Rosalita isolation

The existing **Rosalita** application at `/Users/iliashapiro/Rosalita/` is **read-only reference only**. All ManaposeGP development happens in this repo. Never modify, write to, or deploy from the Rosalita tree.

## Repository layout

| Path | Purpose |
|------|---------|
| `src/` | **ManaposeGP application** — Next.js App Router, API routes, Redux store |
| `.codenomad/nomadworks.yaml` | Agent orchestration |
| `IMPLEMENTATION_PLAN.md` | Full migration plan and architecture reference |

## Quick start

```bash
cp .env.local.example .env.local   # fill in POSTGRES_URL, ENCRYPTION_KEY, etc.
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Verify scaffold

```bash
bun run type-check
bun run lint
bun run test
bun run enforce:redux
bun run build
```

## Stack

- **Framework:** Next.js 16 App Router (`src/app/`)
- **Database:** ZenStack + PostgreSQL (`zenstack/schema.zmodel`)
- **UI:** MUI v7, dynamic page catalog (`src/lib/page-catalog.ts`)
- **State:** RTK Query + `uiSlice` + `chatStreamSlice`
- **Auth:** JWT cookie `manaposegp.session` (public / pin / google tiers)
- **Chat:** OpenAI streaming, session tools, attachments, voice/TTS
- **Tests:** Vitest; deploy via Vercel (`vercel.json`)

See `AGENTS.md` for development constraints and phase order.

## Environment

Copy `.env.local.example` to `.env.local`. Required for full functionality:

- `POSTGRES_URL` — Neon or local PostgreSQL
- `ENCRYPTION_KEY` — 64 hex chars for JWT signing and secrets encryption
- `OPENAI_API_KEY` — chat and TTS (optional for scaffold-only dev)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth tier
- `SETUP_TOKEN` — one-time config API bearer token

## Deployment

ManaposeGP deploys from this repository root with Vercel using `vercel.json`.

- v0 design chat: https://v0.app/reward2learn/chat/manaposegp-2BwAgPjIbuN
- Vercel team/project: link locally with `vercel link` to the `reward2learn` team and `manaposegp` project.
- Local Vercel link metadata lives in `.vercel/project.json`, which is intentionally ignored and should not be committed.

See `docs/DEPLOYMENT.md` for deployment setup notes.

## License

See [LICENSE](LICENSE).
