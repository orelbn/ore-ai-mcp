# Development

## Quick Start

1. Install dependencies:

```bash
bun install
```

2. Create local config:

```bash
cp wrangler.jsonc.example wrangler.jsonc
```

3. Edit `wrangler.jsonc` with your local bucket names.

4. Start the MCP server:

```bash
vp run dev
```

This starts the local Cloudflare worker and serves the MCP endpoint on `http://127.0.0.1:8787/mcp`.

## Local Inspector

If you want to inspect the running MCP server with the official MCP Inspector, run:

```bash
vp run tool:dev
```

`tool:dev` reuses an already-running local worker when possible. If no local MCP server is reachable, it starts `vp run dev` first and then launches Inspector against the detected `/mcp` endpoint.

## Local Config

Required local files:

- `wrangler.jsonc`

Important values:

- `wrangler.jsonc` should point to your local bucket names

Useful optional env vars:

- `INTERNAL_MCP_LOCAL_URL`

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
wrangler deploy --env production
```
