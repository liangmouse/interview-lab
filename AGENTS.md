# Repository Guidelines

## Project Structure & Monorepo Organization

This is a **pnpm + Turbo monorepo** named `interviewclaw`.

### Apps (`apps/`)
- `apps/web` — Next.js 15 frontend (main user-facing app)
- `apps/gateway` — API gateway service
- `apps/livekit-agent` — LiveKit-based interviewer agent runtime
- `apps/scheduler` — background job scheduler

### Packages (`packages/`)
- `packages/agent-core` — core agent logic shared across services
- `packages/ai-runtime` — AI provider abstraction and runtime
- `packages/channel-sdk` — channel communication SDK
- `packages/data-access` — database access layer (Supabase)
- `packages/domain` — shared domain types and business logic
- `packages/workflows` — orchestration workflows

### Other directories
- `database/` — DB schema assets and migrations
- `docs/` — project documentation
- `scripts/` — dev orchestration scripts (e.g. `dev-with-agent.mjs`)
- `public/` — static assets (under `apps/web/public/`)
- `messages/` — i18n message files (under `apps/web/messages/`)

### Web app layout (`apps/web/src/`)
- `app/` — Next.js routes, layouts, and page-level UI (uses `[locale]` routing)
- `action/` — Next.js Server Actions
- `components/` — shared UI components
- `hooks/` — custom React hooks
- `lib/` — helpers and utilities
- `store/` — Zustand state stores
- `types/` — TypeScript types

## Build, Test, and Development Commands

Run from the **repo root** unless noted:

- `pnpm dev` — start all services together (web + agent, via `scripts/dev-with-agent.mjs`)
- `pnpm dev:web` — start only the Next.js web app
- `pnpm dev:gateway` — start only the gateway
- `pnpm dev:agent` — start only the LiveKit agent (`@interviewclaw/livekit-agent`)
- `pnpm dev:scheduler` — start only the scheduler
- `pnpm dev:turbo` — run web + agent in parallel via Turbopack
- `pnpm build` — production build for all packages (via turbo)
- `pnpm build:web` — build only the web app
- `pnpm build:agent` — build only the agent
- `pnpm start` — run the production web server
- `pnpm lint` — ESLint checks across all packages
- `pnpm format` — Prettier formatting across the repo
- `pnpm test` — run Vitest in CI mode
- `pnpm test:packages` — run tests under `packages/` only
- `pnpm agent:dev` — alias for `dev:agent`
- `pnpm agent:kill` — stop the agent process

## Coding Style & Naming Conventions

- TypeScript + Next.js 15; prefer functional React components.
- Use Prettier for formatting and ESLint for lint rules; run `pnpm format` before commits.
- Typical naming: `PascalCase` for components, `camelCase` for functions/vars, `use*` for hooks.
- Paths are aliased via `@/` to `src/` within each app/package.

## i18n Policy

**新代码直接用中文写 HTML 模版，不走 i18n 流程。**

- 新增页面、组件、文案一律直接在 JSX/HTML 中写中文字符串，不使用 `useTranslations` / `t()` 等 next-intl API。
- 不需要在 `messages/zh.json` 或 `messages/en.json` 中添加新 key。
- 已有的 i18n 文案保持不动，不做迁移。
- 只有明确要求支持多语言时，才走 i18n 流程。

## Testing Guidelines

- Framework: Vitest (`pnpm test`).
- Test files are `*.test.ts` / `*.test.tsx`. Place tests next to the code they cover.
- Integration tests should use real dependencies where possible; avoid mocking the database.

## Commit & Pull Request Guidelines

- Conventional commits enforced via commitlint/cz-git (use `pnpm commit`).
- Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`.
- PRs should include a clear description, linked issue (if any), and screenshots for UI changes.

## Configuration & Secrets

- Copy `.env.example` to `.env.local` and fill Supabase/LiveKit credentials before running locally.
- Do not commit secrets; prefer local environment overrides.
