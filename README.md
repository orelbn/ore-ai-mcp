# ore-ai-mcp

Internal MCP server for Ore AI, deployed as a Cloudflare Worker.

## What it does

- serves MCP over Streamable HTTP at `/mcp`
- loads context entries from R2
- generates `ore.context.*` tools from `.context/context-manifest.json`

## Local context

Real context content is local-only and gitignored. Safe starter files live in `.context.example/`.

```text
.context/
  context-manifest.json
  notes/**/*.md
  images/**/*
```

## Development

The normal local workflow is:

```bash
vp install
cp wrangler.jsonc.example wrangler.jsonc
vpr dev
```

That starts the MCP server only.

If you want to inspect the local server with the official MCP Inspector, run:

```bash
vpr tool:dev
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for setup details.
