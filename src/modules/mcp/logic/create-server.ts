import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { RequestContext } from "@/lib/worker";
import {
	getContextByToolEntry,
	isToolDisabled,
	listContextToolEntries,
} from "@/modules/context";
import { registerGitHubTools } from "@/modules/github";
import { executeTool } from "./execute-tool";

const MCP_SERVER_NAME = "ore-ai-mcp";

/**
 * Build a CallToolResult representing a successful tool execution with a human-readable summary and merged structured payload.
 *
 * @param summary - Short text message to include in the result's content.
 * @param payload - Additional key/value data to merge into `structuredContent` (merged alongside `ok: true`).
 * @returns A `CallToolResult` whose `content` contains the provided `summary` and whose `structuredContent` contains `ok: true` plus the keys from `payload`.
 */
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

/**
 * Creates and configures an MCP server for the application, registering available context tools and GitHub integrations.
 *
 * @param context - Request-scoped context used to discover, filter, and execute tool entries
 * @returns An McpServer instance with discovered context tools (filtered by environment) and GitHub tools registered
 */
export async function createOreMcpServer(
	context: RequestContext,
): Promise<McpServer> {
	const server = new McpServer({
		name: MCP_SERVER_NAME,
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

	registerGitHubTools(server, context, (toolName) =>
		shouldRegister(context, toolName),
	);

	return server;
}
