# Development

## Quick Start

1. Install dependencies:

```bash
bun install
```

2. Create local config:

```bash
cp .dev.vars.example .dev.vars
cp wrangler.jsonc.example wrangler.jsonc
```

3. Edit `wrangler.jsonc` with your local bucket names.

4. Start the MCP server:

```bash
vp run dev
```

This starts the local Cloudflare worker and serves the MCP endpoint on `http://127.0.0.1:8787/mcp`.

## Local Dashboard Tool

If you want the local dashboard for browsing tools and previewing payloads, run:

```bash
vp run tool:dev
```

That starts:

- the local Cloudflare worker on `http://127.0.0.1:8787`
- the local MCP dashboard on `http://127.0.0.1:4317`

## Local Config

Required local files:

- `.dev.vars`
- `wrangler.jsonc`

Important values:

- `.dev.vars` should include `MCP_INTERNAL_SHARED_SECRET`
- `wrangler.jsonc` should point to your local bucket names

Useful optional env vars:

- `INTERNAL_MCP_LOCAL_URL`
- `INTERNAL_MCP_LOCAL_SECRET`

## Context Commands

```bash
vp run context:validate
vp run context:sync -- --dry-run
vp run context:sync
vp run context:sync -- --env production --dry-run
vp run context:sync -- --env production
```

## Checks

```bash
vp check
vp test
vp build
wrangler deploy --dry-run --env=""
```

## Deploy

```bash
wrangler secret put MCP_INTERNAL_SHARED_SECRET --env production
wrangler deploy --env production
```
