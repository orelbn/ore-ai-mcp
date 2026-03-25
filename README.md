# ore-ai-mcp

MCP server for Ore AI, deployed as a Cloudflare Worker and consumed by the Ore AI backend only.

## What this server does

- Exposes MCP over Streamable HTTP at `/mcp`
- Enforces internal auth headers and caller checks
- Loads context from R2 (not from Git or env payloads)
- Supports dynamic runtime tool/schema discovery from consumers

## Dynamic tools

- Tools are generated from `.context/context-manifest.json` entries.
- Default tool naming is automatic:
  - `toolName = ore.context.<contextId_slug>`
- You can still override `toolName` per entry when needed.
  - Explicit names must match `[a-z0-9._-]`.
- The server also exposes one built-in internal tool:
  - `ore.server.manage` for inspecting the live registry and managing runtime disabled-tool overrides stored in R2.

Each generated tool returns raw markdown + metadata/image asset keys so the backend AI can format the final output.

## Privacy model

- Public repo stores only code and safe templates.
- Real context lives in `.context/` (gitignored) locally.
- Local context is synced to R2 objects.
- Worker reads R2 index + markdown at runtime.

## Local context layout

```text
.context/
  context-manifest.json
  notes/**/*.md
  images/**/*
```

Safe starter templates are provided in `.context.example/`.

## Required request headers

- `x-ore-internal-secret`
- `x-ore-user-id`
- `x-ore-request-id`

## Local development

```bash
bun install
cp .dev.vars.example .dev.vars
cp wrangler.jsonc.example wrangler.jsonc
# edit wrangler.jsonc bucket names for your account
bun run dev
```

Husky installs the repo's Git hooks from the `prepare` script during `bun install`.

## Local MCP Dev UI

Run the local-only dashboard:

```bash
bun run tool:dev
```

Then open `http://127.0.0.1:4317`.

The UI is local-dev only:

- it reads `MCP_INTERNAL_SHARED_SECRET` from `.dev.vars`
- it auto-detects the local MCP URL when possible
- secrets never need to be typed into the browser
- the frontend is built with React + Vite before the local Bun server starts

If you are iterating on the UI itself, run these in separate terminals:

```bash
bun run tool:api
bun run tool:ui
```

Then open the Vite URL it prints, which proxies `/api/*` back to the local Bun server.

Useful env vars:

- `INTERNAL_MCP_LOCAL_URL` defaults to `http://127.0.0.1:8787/mcp`
- `INTERNAL_MCP_LOCAL_SECRET` to override `.dev.vars` if needed
- `INTERNAL_MCP_ADMIN_PORT` defaults to `4317`

## Wrangler config convention

- `wrangler.jsonc.example` is tracked as the safe template.
- `wrangler.jsonc` is local and gitignored.
- CI copies `wrangler.jsonc.example` to `wrangler.jsonc` before build.

## Context commands

```bash
# Validate local context files
bun run context:validate

# Preview sync to dev (top-level r2_buckets)
bun run context:sync --dry-run

# Apply sync to dev
bun run context:sync

# Preview sync to production (env.production.r2_buckets)
bun run context:sync --env production --dry-run

# Apply sync to production
bun run context:sync --env production
```

## Quality checks

```bash
bun run typecheck
bun run lint
bun run test
bun run build
```

`bun run typecheck` uses TSGo via `@typescript/native-preview` (`tsgo --noEmit`).

## Deployment

Set secrets first:

```bash
wrangler secret put MCP_INTERNAL_SHARED_SECRET --env production
```

Deploy:

```bash
bun run deploy:prod
```

## Consumer integration (Ore AI app)

See [Dynamic Discovery Integration](./docs/integration.md).

## Operations

See [Operations Runbook](./docs/runbook.md).
