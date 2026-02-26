# Operations Runbook

## Rotate internal secret

1. Set production secret:
   - `wrangler secret put MCP_INTERNAL_SHARED_SECRET --env production`
2. Rotate backend caller secret.
3. Deploy production and verify MCP smoke tests.

## Update private context

1. Edit local files in `.private-context/`.
2. Validate:
   - `bun run context:validate`
3. Dry-run production sync:
   - `bun run context:sync --env production --dry-run`
4. Apply production sync:
   - `bun run context:sync --env production`

## Mirror-delete behavior

Sync runs in mirror mode:

- If a local private markdown/image file is removed and sync is applied,
- corresponding managed remote objects are deleted from R2.

## Emergency takedown

1. Remove sensitive local file from `.private-context/`.
2. Run sync to target environment.
3. Confirm object key is no longer present through tool output behavior.
4. If needed, disable tool quickly via env var:
   - `MCP_DISABLED_TOOLS="ore.context.orel_top_coffee_shops"`

## Rollback

1. Redeploy previous code version if needed.
2. Re-sync desired private context version from local backup.
3. Re-run smoke tests:
   - initialize handshake
   - list tools
   - call one `ore.context.*` tool
