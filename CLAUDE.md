# Claude Code Configuration

## Agent Working Rules

- 默认使用中文回复，表达简洁、直接、可执行。
- 以高绩效资深工程师的标准工作：优先简单、稳定、适合生产环境的方案。
- 优先做小而可审阅的 diff；除非明确要求，不做大范围重构。
- 改代码前先确认要改的文件，并先给出 3-6 条执行计划。
- 不要臆造 API、配置、脚本或路径；拿不准先搜仓库。
- 保持与现有架构、命名、代码风格一致；小功能不要过度抽象。
- 输出代码变更时，默认给出「简短总结 + 改动文件列表」。
- 处理调试类任务时，默认给出「问题假设 + 验证动作 + 最小修复」。

## Change Workflow

- 改动前先判断影响范围，只修改与当前任务直接相关的 app/package。
- 写新工具、模块、公共方法前，先检查仓库里是否已有内部实现可复用。
- 同时检查 `package.json` 里是否已有合适依赖，再判断是否需要新增成熟 npm 包。
- 在决定自己实现前，必须先简要比较：
  - 现有内部模式
  - 当前已安装依赖
  - 可新增的成熟依赖
  - 自定义实现
- 如果最终选择自定义实现，必须用 3 条简短理由说明为什么没有复用已有方案。
- 行为变更优先补测试；如果仓库已有相关测试，尽量就近补 `*.test.ts` / `*.test.tsx`。

## Command And Verification

- 需要执行命令时，先说明「具体命令 + 目的」，再执行。
- 优先运行最快、最小范围的验证，再决定是否扩大到更重的检查。
- 能只校验单个包/单个测试文件时，不要默认跑全量构建。
- 如果改动可能影响构建、类型或 lint，至少补一条相关的快速验证命令。
- 除非用户明确要求，否则不要执行破坏性命令，不要回滚用户已有改动。

## Safety And Boundaries

- 不要输出、记录或提交任何密钥、token、私有证书、`.env` 实际值。
- 如果任务依赖密钥，要求用户通过环境变量提供。
- 未经明确要求，不新增埋点、遥测、外部网络请求或第三方上报。
- 优先类型安全、显式错误处理和可维护性；仅在意图不明显时添加简短注释。

## Project Structure & Monorepo Organization

This is a **pnpm + Turbo monorepo** named `interviewclaw` — an AI-powered mock interview platform with realtime voice sessions, LLM-driven interviewers, and Stripe subscriptions.

### Apps (`apps/`)
- `apps/web` — Next.js 15 frontend (main user-facing app)
- `apps/gateway` — API gateway service and realtime voice WebSocket proxy
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

- `pnpm dev` — start local services together (web + gateway + scheduler, via `scripts/dev-with-agent.mjs`)
- `pnpm dev:web` — start only the Next.js web app
- `pnpm dev:gateway` — start only the gateway
- `pnpm dev:realtime` — start web + gateway for realtime voice debugging
- `pnpm dev:scheduler` — start only the scheduler
- `pnpm dev:turbo` — run web + gateway in parallel via Turbopack
- `pnpm build` — production build for all packages (via turbo)
- `pnpm build:web` — build only the web app
- `pnpm start` — run the production web server
- `pnpm lint` — ESLint checks across all packages
- `pnpm format` — Prettier formatting across the repo
- `pnpm test` — run Vitest in CI mode
- `pnpm test:packages` — run tests under `packages/` only

## Coding Style & Naming Conventions

- TypeScript + Next.js 15; prefer functional React components.
- Use Prettier for formatting and ESLint for lint rules; run `pnpm format` before commits.
- Naming: `PascalCase` for components, `camelCase` for functions/vars, `use*` for hooks.
- Paths are aliased via `@/` to `src/` within each app/package.
- 新增 API、工具函数、hooks、store 前，先搜索对应目录是否已有同类实现。

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
- 优先执行最小范围验证，例如单测文件、相关 package 的 lint/typecheck，再视情况跑全量命令。

## Commit & Pull Request Guidelines

- Conventional commits enforced via commitlint/cz-git (use `pnpm commit`).
- Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`.
- PRs should include a clear description, linked issue (if any), and screenshots for UI changes.

## Configuration & Secrets

- Copy `.env.example` to `.env.local` and fill Supabase/Volcengine credentials before running locally.
- Do not commit secrets; prefer local environment overrides.

## gstack

Use the `/agent-browser` skill from gstack for all web browsing tasks. Never use `mcp__claude-in-chrome__*` tools directly.

### Available gstack skills

- `/office-hours` — YC-style product assumption challenges
- `/plan-ceo-review` — CEO/founder-mode plan review
- `/plan-eng-review` — Eng manager architecture review
- `/plan-design-review` — Designer's eye plan review
- `/design-consultation` — Full design system proposal
- `/review` — Pre-landing PR code review
- `/ship` — Ship workflow: tests, changelog, PR creation
- `/land-and-deploy` — Merge PR, wait for CI, verify prod
- `/canary` — Post-deploy canary monitoring
- `/benchmark` — Performance regression detection
- `/browse` — Fast headless browser for QA
- `/qa` — QA test and fix bugs
- `/qa-only` — QA report only, no fixes
- `/design-review` — Visual audit and fix UI issues
- `/setup-browser-cookies` — Import browser cookies for auth testing
- `/setup-deploy` — Configure deployment settings
- `/retro` — Weekly engineering retrospective
- `/investigate` — Systematic root cause debugging
- `/document-release` — Post-ship docs update
- `/codex` — OpenAI Codex independent code review
- `/cso` — Chief Security Officer security audit
- `/autoplan` — Auto-run CEO + design + eng reviews
- `/careful` — Warn before destructive commands
- `/freeze` — Restrict edits to a specific directory
- `/guard` — Full safety mode (careful + freeze)
- `/unfreeze` — Clear freeze boundary
- `/gstack-upgrade` — Upgrade gstack to latest version
