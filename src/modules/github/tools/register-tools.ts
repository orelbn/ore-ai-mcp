import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { RequestContext } from "@/lib/worker";
import { executeTool } from "@/modules/mcp/logic/execute-tool";
import {
	requireGitHubInsightsConfig,
	resolveGitHubInsightsConfig,
} from "../config";
import {
	GITHUB_PROJECT_ARCHITECTURE_TOOL,
	GITHUB_PROJECT_SUMMARY_TOOL,
	GITHUB_PROJECTS_LATEST_TOOL,
} from "../constants";
import { getProjectArchitecture } from "../logic/architecture";
import { getLatestProjects } from "../logic/list-projects";
import { getProjectSummary } from "../logic/summary";
import {
	projectArchitectureToolInputSchema,
	projectSummaryToolInputSchema,
} from "../schema";

/**
 * Create a standardized successful CallToolResult containing a text summary and associated structured payload.
 *
 * @param summary - Human-readable summary text included as the primary content entry
 * @param payload - Additional fields merged into `structuredContent` alongside `ok: true`
 * @returns A CallToolResult whose `content` contains the summary text and whose `structuredContent` is `{ ok: true, ...payload }`
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

/**
 * Checks whether a GitHub Insights configuration exists in the request context's environment.
 *
 * @param context - The request context whose environment is inspected for a GitHub Insights configuration
 * @returns `true` if a GitHub Insights configuration is present, `false` otherwise
 */
export function hasGitHubInsightsConfig(context: RequestContext): boolean {
	return resolveGitHubInsightsConfig(context.env) !== null;
}

/**
 * Register GitHub Insights tools on the MCP server when a GitHub Insights configuration is present and the caller permits each tool.
 *
 * Registers the latest-projects, project-summary, and project-architecture tools (with their descriptions and input schemas) and wires their handlers to fetch data using the configured GitHub Insights credentials.
 *
 * @param server - The MCP server instance to register tools on
 * @param context - Request context used to resolve environment and GitHub Insights configuration
 * @param shouldRegister - Predicate called with a tool name to determine whether that tool should be registered
 */
export function registerGitHubTools(
	server: McpServer,
	context: RequestContext,
	shouldRegister: (toolName: string) => boolean,
): void {
	if (!hasGitHubInsightsConfig(context)) {
		return;
	}

	if (shouldRegister(GITHUB_PROJECTS_LATEST_TOOL)) {
		server.registerTool(
			GITHUB_PROJECTS_LATEST_TOOL,
			{
				description:
					"List the latest 5 public projects for the configured GitHub owner.",
				inputSchema: z.object({}),
			},
			async () =>
				executeTool(context, GITHUB_PROJECTS_LATEST_TOOL, async () => {
					const result = await getLatestProjects(
						requireGitHubInsightsConfig(context.env),
					);
					return toSuccessResult(
						`Loaded latest GitHub projects for ${result.owner}`,
						result,
					);
				}),
		);
	}

	if (shouldRegister(GITHUB_PROJECT_SUMMARY_TOOL)) {
		server.registerTool(
			GITHUB_PROJECT_SUMMARY_TOOL,
			{
				description: "Summarize a public project and the technologies it uses.",
				inputSchema: projectSummaryToolInputSchema,
			},
			async ({ repo }) =>
				executeTool(context, GITHUB_PROJECT_SUMMARY_TOOL, async () => {
					const result = await getProjectSummary(
						requireGitHubInsightsConfig(context.env),
						repo,
					);
					return toSuccessResult(`Summarized GitHub project ${repo}`, result);
				}),
		);
	}

	if (shouldRegister(GITHUB_PROJECT_ARCHITECTURE_TOOL)) {
		server.registerTool(
			GITHUB_PROJECT_ARCHITECTURE_TOOL,
			{
				description:
					"Provide a high-level architecture overview and design decisions for a public project.",
				inputSchema: projectArchitectureToolInputSchema,
			},
			async ({ repo }) =>
				executeTool(context, GITHUB_PROJECT_ARCHITECTURE_TOOL, async () => {
					const result = await getProjectArchitecture(
						requireGitHubInsightsConfig(context.env),
						repo,
					);
					return toSuccessResult(
						`Built architecture overview for GitHub project ${repo}`,
						result,
					);
				}),
		);
	}
}
