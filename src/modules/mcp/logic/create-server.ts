import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { RequestContext } from "@/lib/worker";
import {
	getContextByToolEntry,
	getContextToolInventory,
} from "@/modules/context";
import {
	MCP_SERVER_ADMIN_TOOL,
	ORE_MCP_SERVER_NAME,
	ORE_MCP_SERVER_VERSION,
} from "../constants";
import { adminToolInputSchema, handleAdminTool } from "./admin-tool";
import { executeTool } from "./execute-tool";

function toSuccessResult(summary: string, payload: unknown): CallToolResult {
	return {
		content: [
			{
				type: "text",
				text: summary,
			},
		],
		structuredContent: {
			ok: true,
			...((payload as Record<string, unknown>) ?? {}),
		},
	};
}

export async function createOreMcpServer(
	context: RequestContext,
): Promise<McpServer> {
	const server = new McpServer({
		name: ORE_MCP_SERVER_NAME,
		version: ORE_MCP_SERVER_VERSION,
	});

	server.registerTool(
		MCP_SERVER_ADMIN_TOOL,
		{
			description:
				"Inspect the live MCP server and manage runtime disabled-tool overrides.",
			inputSchema: adminToolInputSchema,
		},
		async (args) =>
			executeTool(context, MCP_SERVER_ADMIN_TOOL, async () =>
				handleAdminTool(context, args),
			),
	);

	const toolInventory = await getContextToolInventory(context);
	for (const toolEntry of toolInventory.tools) {
		if (toolEntry.isDisabled) {
			continue;
		}

		server.registerTool(
			toolEntry.toolName,
			{
				description:
					toolEntry.description ??
					`Get context markdown for ${toolEntry.title}.`,
				inputSchema: z.object({}),
			},
			async () =>
				executeTool(context, toolEntry.toolName, async () => {
					const result = await getContextByToolEntry(context, toolEntry);
					return toSuccessResult(`Loaded context: ${toolEntry.title}`, result);
				}),
		);
	}

	return server;
}
