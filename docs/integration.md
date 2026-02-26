# Dynamic Discovery Integration (Ore AI Backend)

This MCP server is consumed from the Ore AI backend using AI SDK runtime discovery.

## Consumer pattern

1. Create MCP client with endpoint and auth headers.
2. Discover tools with `await mcpClient.tools()`.
3. Refresh tools every 5 minutes with stale-cache fallback.
4. Render by `toolName` registry in app code.

## AI SDK sketch

```ts
import { createMCPClient } from "@ai-sdk/mcp";

const mcpClient = await createMCPClient({
	transport: {
		type: "http",
		url: "https://ore-ai-mcp.example.com/mcp",
		headers: {
			"x-ore-internal-secret": process.env.MCP_INTERNAL_SHARED_SECRET!,
			"x-ore-user-id": userId,
			"x-ore-request-id": requestId,
		},
	},
});

try {
	const tools = await mcpClient.tools();
	// pass tools to generateText/streamText
} finally {
	await mcpClient.close();
}
```

## Tool discovery contract

- Tools are discovered dynamically from MCP at runtime.
- Tool names are generated from manifest entries:
  - `ore.context.<contextId_slug>` by default.
- Consumers should filter the discovered tool set with an allowlist/prefix strategy.

## Tool output contract

Each generated context tool returns structured content fields:

- `ok`
- `uiHint`
- `toolName`
- `contextId`
- `title`
- `markdown`
- `imageAssetKeys`
- `sourceUpdatedAt`

## UI mapping

- `ore.context.*` -> local context/image renderer(s).
- Unknown tool names -> generic fallback renderer.
- `imageAssetKeys` are object keys; app proxy is responsible for secure streaming.
