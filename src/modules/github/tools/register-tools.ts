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

export function hasGitHubInsightsConfig(context: RequestContext): boolean {
	return resolveGitHubInsightsConfig(context.env) !== null;
}

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
