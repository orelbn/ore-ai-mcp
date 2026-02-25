# ore-ai-mcp

Private MCP server for Ore AI, deployed as a Cloudflare Worker and consumed by the Ore AI backend only.

## What this server does

- Exposes MCP over Streamable HTTP at `/mcp`
- Enforces internal auth headers and caller checks
- Loads private context from R2 (not from Git or env payloads)
- Supports dynamic runtime tool/schema discovery from consumers

## Dynamic tools

- Tools are generated from `.private-context/context-manifest.json` entries.
- Default tool naming is automatic:
  - `toolName = ore.context.<contextId_slug>`
- You can still override `toolName` per entry when needed.
  - Explicit names must match `[a-z0-9._-]`.

Each generated tool returns raw markdown + metadata/image asset keys so the backend AI can format the final output.

## Privacy model

- Public repo stores only code and safe templates.
- Real private context lives in `.private-context/` (gitignored) locally.
- Local context is synced to private R2 objects.
- Worker reads R2 index + markdown at runtime.

## Local private context layout

```text
.private-context/
  context-manifest.json
  notes/**/*.md
  images/**/*
```

Safe starter templates are provided in `.private-context.example/`.

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
# Validate local private context files
bun run context:validate

# Preview sync to staging
bun run context:sync --env staging --dry-run

# Apply sync to staging
bun run context:sync --env staging

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

## Deployment

Set secrets first:

```bash
wrangler secret put MCP_INTERNAL_SHARED_SECRET --env staging
wrangler secret put MCP_INTERNAL_SHARED_SECRET --env production
```

Deploy:

```bash
bun run deploy:staging
bun run deploy:prod
```

## Consumer integration (Ore AI app)

See [Dynamic Discovery Integration](./docs/integration.md).

## Operations

See [Operations Runbook](./docs/runbook.md).
