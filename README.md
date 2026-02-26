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
bun run dev
```

## Context commands

```bash
# Validate local context files
bun run context:validate

# Preview sync to production
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
