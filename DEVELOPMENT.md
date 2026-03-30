# Development

## Setup

```bash
bun install
cp .dev.vars.example .dev.vars
cp wrangler.jsonc.example wrangler.jsonc
```

Edit `wrangler.jsonc` with your local bucket names before running the worker.

## Worker

```bash
wrangler dev
```

## Local MCP Dev UI

Run the local API helper:

```bash
bun run internal/local-mcp-dev/server.ts
```

Run the UI:

```bash
vp dev
```

To build the UI instead:

```bash
vp build
bun run internal/local-mcp-dev/server.ts
```

Useful env vars:

- `INTERNAL_MCP_LOCAL_URL`
- `INTERNAL_MCP_LOCAL_SECRET`

## Context commands

```bash
bun run scripts/context-validate.ts
bun run scripts/context-sync.ts --dry-run
bun run scripts/context-sync.ts
bun run scripts/context-sync.ts --env production --dry-run
bun run scripts/context-sync.ts --env production
```

## Checks

```bash
vp check
vp test
vp build
wrangler deploy --dry-run --env=""
```

Test note:

- Use `vp test` for the full suite.
- `vp run test` also works through the root `test` script when you want the package-script path.

## Deploy

```bash
wrangler secret put MCP_INTERNAL_SHARED_SECRET --env production
wrangler deploy --env production
```
