# ore-ai-mcp

Internal MCP server for Ore AI, deployed as a Cloudflare Worker.

## What it does

- serves MCP over Streamable HTTP at `/mcp`
- authenticates internal callers
- loads context entries from R2
- generates `ore.context.*` tools from `.context/context-manifest.json`
- exposes `ore.server.manage` for internal server inspection

## Local context

Real context content is local-only and gitignored. Safe starter files live in `.context.example/`.

```text
.context/
  context-manifest.json
  notes/**/*.md
  images/**/*
```

## Headers

- `x-ore-internal-secret`
- `x-ore-user-id`
- `x-ore-request-id`

## Development

The normal local workflow is:

```bash
vp install
cp .dev.vars.example .dev.vars
cp wrangler.jsonc.example wrangler.jsonc
vp run dev
```

That starts the MCP server only.

If you want the local dashboard tool, run:

```bash
vp run tool:dev
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for setup details.
