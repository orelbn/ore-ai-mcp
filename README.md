# ore-ai-mcp

MCP server deployed as a Cloudflare Worker. It serves two tool families:

- dynamic context tools backed by R2
- GitHub project insight tools backed by GitHub REST, KV cache, and optional Gemini enrichment

## What this server does

- Exposes MCP over Streamable HTTP at `/mcp`
- Enforces internal auth headers and caller checks
- Loads context from R2 (not from Git or env payloads)
- Loads GitHub project data from public GitHub APIs with KV-backed caching
- Supports dynamic runtime tool/schema discovery from consumers

## Dynamic tools

- Tools are generated from `.context/context-manifest.json` entries.
- Default tool naming is automatic:
  - `toolName = mcp.context.<contextId_slug>`
- You can still override `toolName` per entry when needed.
  - Explicit names must match `[a-z0-9._-]`.

Each generated tool returns raw markdown + metadata/image asset keys so the backend AI can format the final output.

## GitHub project insight tools

When `GITHUB_OWNER` and `PROJECT_INSIGHTS_KV` are configured, the Worker also registers:

- `github.projects.latest`
- `github.project.summary`
- `github.project.architecture`

These tools:

- read public repository metadata from GitHub REST
- cache repo and insight documents in KV for 12 hours by default
- apply optional manual overrides from `.project-insights/` after sync
- use heuristic summaries by default and Gemini when `GEMINI_API_KEY` is configured

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

## Local project insight overrides

```text
.project-insights/
  <repo>.json
```

Tracked starter templates are provided in `.project-insights.example/`.

## Required request headers

- `x-mcp-internal-secret`
- `x-mcp-user-id`
- `x-mcp-request-id`

## Local development

```bash
bun install
cp .dev.vars.example .dev.vars
cp wrangler.jsonc.example wrangler.jsonc
# edit wrangler.jsonc bucket names, KV ids, and vars for your account
bun run dev
```

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

## GitHub project insight commands

```bash
# Validate local override files
bun run github-insights:validate

# Preview sync to production KV
bun run github-insights:sync --env production --dry-run

# Apply sync to production KV
bun run github-insights:sync --env production
```

## Quality checks

```bash
bun run typecheck
bun run lint
bun run test
bun run build
```

`bun run typecheck` uses TSGo via `@typescript/native-preview` (`tsgo --noEmit`).
`bun run build` runs `wrangler deploy --dry-run --env ""` using your local `wrangler.jsonc`, so it validates the actual Worker bundle without deploying.

## Deployment

Set secrets first:

```bash
wrangler secret put MCP_INTERNAL_SHARED_SECRET --env production
wrangler secret put GEMINI_API_KEY --env production
# optional, raises GitHub API rate limits
wrangler secret put GITHUB_TOKEN --env production
```

Deploy:

```bash
bun run deploy:prod
```

## Consumer integration

See [Dynamic Discovery Integration](./docs/integration.md).

## Operations

See [Operations Runbook](./docs/runbook.md).
