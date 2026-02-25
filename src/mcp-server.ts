import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { executeTool } from "./tool-runner";
import {
	getContextByToolEntry,
	isToolDisabled,
	listContextToolEntries,
} from "./tool-services";
import type { RequestContext } from "./types";

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

function shouldRegister(context: RequestContext, toolName: string): boolean {
	return !isToolDisabled(context.env, toolName);
}

export async function createOreMcpServer(
	context: RequestContext,
): Promise<McpServer> {
	const server = new McpServer({
		name: "Ore AI MCP",
		version: "0.4.0",
	});

	const toolEntries = await listContextToolEntries(context);
	for (const toolEntry of toolEntries) {
		if (!shouldRegister(context, toolEntry.toolName)) {
			continue;
		}

		server.registerTool(
			toolEntry.toolName,
			{
				description:
					toolEntry.description ??
					`Get private context markdown for ${toolEntry.title}.`,
				inputSchema: z.object({}),
			},
			async () =>
				executeTool(context, toolEntry.toolName, async () => {
					const result = await getContextByToolEntry(context, toolEntry);
					return toSuccessResult(
						`Loaded private context: ${toolEntry.title}`,
						result,
					);
				}),
		);
	}

	return server;
}
