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

See [DEVELOPMENT.md](./DEVELOPMENT.md).
