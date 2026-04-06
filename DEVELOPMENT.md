# Development

## Quick Start

1. Install dependencies:

```bash
vp install
```

2. Create local config:

```bash
cp wrangler.jsonc.example wrangler.jsonc
```

3. Edit `wrangler.jsonc` with the context bucket this repo should use by default.

4. Start the MCP server:

```bash
vpr dev
```

This starts the local Cloudflare worker and serves the MCP endpoint on `http://127.0.0.1:8787/mcp`.

## Local Inspector

If you want to inspect the running MCP server with the official MCP Inspector, run:

```bash
vpr tool:dev
```

`tool:dev` reuses an already-running local worker when possible. If no local MCP server is reachable, it starts `vpr dev` first and then launches Inspector against the detected `/mcp` endpoint.

## Local Config

Required local files:

- `wrangler.jsonc`

Important values:

- `wrangler.jsonc` should point to your local bucket names

Useful optional env vars:

- `INTERNAL_MCP_LOCAL_URL`
