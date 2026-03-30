import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { RequestContext } from "@/lib/worker";
import { executeTool } from "@/modules/mcp/logic/execute-tool";
import { requireGitHubInsightsConfig, resolveGitHubInsightsConfig } from "../config";
import {
  GITHUB_PROJECT_ARCHITECTURE_TOOL,
  GITHUB_PROJECT_SUMMARY_TOOL,
  GITHUB_PROJECTS_LATEST_TOOL,
} from "../constants";
import { getProjectArchitecture } from "../logic/architecture";
import { getLatestProjects } from "../logic/list-projects";
import { getProjectSummary } from "../logic/summary";
import { projectArchitectureToolInputSchema, projectSummaryToolInputSchema } from "../schema";

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  run: (context: RequestContext, input: Record<string, unknown>) => Promise<unknown>;
  summary: (context: RequestContext, input: Record<string, unknown>) => string;
};

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: GITHUB_PROJECTS_LATEST_TOOL,
    description: "List the latest 5 public projects for the configured GitHub owner.",
    inputSchema: z.object({}),
    run: (context) => getLatestProjects(requireGitHubInsightsConfig(context.env)),
    summary: (context) => `Loaded latest GitHub projects for ${context.env.GITHUB_OWNER}`,
  },
  {
    name: GITHUB_PROJECT_SUMMARY_TOOL,
    description: "Summarize a public project and the technologies it uses.",
    inputSchema: projectSummaryToolInputSchema,
    run: (context, input) =>
      getProjectSummary(requireGitHubInsightsConfig(context.env), readRepoInput(input)),
    summary: (_context, input) => `Summarized GitHub project ${readRepoInput(input)}`,
  },
  {
    name: GITHUB_PROJECT_ARCHITECTURE_TOOL,
    description:
      "Provide a high-level architecture overview and design decisions for a public project.",
    inputSchema: projectArchitectureToolInputSchema,
    run: (context, input) =>
      getProjectArchitecture(requireGitHubInsightsConfig(context.env), readRepoInput(input)),
    summary: (_context, input) =>
      `Built architecture overview for GitHub project ${readRepoInput(input)}`,
  },
];

function toSuccessResult(summary: string, payload: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: summary }],
    structuredContent: {
      ok: true,
      ...(payload as Record<string, unknown>),
    },
  };
}

function readRepoInput(input: Record<string, unknown>): string {
  return typeof input.repo === "string" ? input.repo : "";
}

export function hasGitHubInsightsConfig(context: RequestContext): boolean {
  return resolveGitHubInsightsConfig(context.env) !== null;
}

export function registerGitHubTools(
  server: McpServer,
  context: RequestContext,
): void {
  if (!hasGitHubInsightsConfig(context)) {
    return;
  }

  for (const tool of TOOL_DEFINITIONS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (input) => {
        const args = (input ?? {}) as Record<string, unknown>;
        return executeTool(context, tool.name, async () =>
          toSuccessResult(tool.summary(context, args), await tool.run(context, args)),
        );
      },
    );
  }
}
