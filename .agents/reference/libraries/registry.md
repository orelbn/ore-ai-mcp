# Library llms.txt Registry

A curated list of known `llms.txt` URLs for libraries used in this project.

Both humans and agents should update this file when a new library's `llms.txt` is confirmed.
**Agents must not guess or infer URLs** — only use entries listed here.

## Registry

| Library | llms.txt URL | Notes |
|---------|-------------|-------|
| Cloudflare Workers | https://developers.cloudflare.com/workers/llms.txt | Primary docs for Worker runtime and Wrangler usage. |
| Cloudflare Developer Platform | https://developers.cloudflare.com/llms.txt | Broad product index (R2, Queues, D1, Workflows, etc.). |
| Model Context Protocol | https://modelcontextprotocol.io/llms.txt | Canonical protocol/spec docs for `@modelcontextprotocol/sdk`. |
| Zod | https://zod.dev/llms.txt | Schema library used directly and by the MCP SDK. |
| Bun | https://bun.sh/llms.txt | Runtime and test runner used in this repository. |

## How to add an entry

1. Find the confirmed `llms.txt` URL (via context7, the library's official docs, or the library's GitHub repo)
2. Verify the URL returns a valid `llms.txt` response
3. Add a row to the table above
