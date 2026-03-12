# Dynamic Discovery Integration

This MCP server is consumed over Streamable HTTP and supports AI SDK runtime discovery.

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
		url: "https://your-mcp.example.com/mcp",
		headers: {
			"x-mcp-internal-secret": process.env.MCP_INTERNAL_SHARED_SECRET!,
			"x-mcp-user-id": userId,
			"x-mcp-request-id": requestId,
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
  - `mcp.context.<contextId_slug>` by default.
- Consumers should filter the discovered tool set with an allowlist/prefix strategy.

GitHub project insight tools use fixed names:

- `github.projects.latest`
- `github.project.summary`
- `github.project.architecture`

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

GitHub tools return structured content fields:

- `ok`
- `provider`
- `cachedAt`
- `sourceUpdatedAt`
- `stale`

`github.projects.latest` returns:

- `owner`
- `projects`

`github.project.summary` returns:

- `repo`
- `name`
- `summary`
- `technologies`
- `evidence`

`github.project.architecture` returns:

- `repo`
- `overview`
- `components`
- `designDecisions`
- `diagramMermaid`
- `evidence`

## UI mapping

- `mcp.context.*` -> local context/image renderer(s).
- `github.projects.latest` -> project list renderer.
- `github.project.summary` -> summary + technologies renderer.
- `github.project.architecture` -> architecture/diagram renderer.
- Unknown tool names -> generic fallback renderer.
- `imageAssetKeys` are object keys; app proxy is responsible for secure streaming.
