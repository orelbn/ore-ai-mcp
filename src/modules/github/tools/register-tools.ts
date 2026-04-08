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
import { getProjectArchitecture, getProjectSummary } from "../logic/insight";
import { getLatestProjects } from "../logic/list-projects";
import { projectArchitectureToolInputSchema, projectSummaryToolInputSchema } from "../schema";

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

function registerTool(
  server: McpServer,
  context: RequestContext,
  options: {
    name: string;
    description: string;
    inputSchema: z.ZodTypeAny;
    summary: (repo: string) => string;
    run: (input: Record<string, unknown>) => Promise<unknown>;
  },
): void {
  server.registerTool(
    options.name,
    { description: options.description, inputSchema: options.inputSchema },
    async (input) => {
      const args = (input ?? {}) as Record<string, unknown>;
      return executeTool(context, options.name, async () =>
        toSuccessResult(options.summary(readRepoInput(args)), await options.run(args)),
      );
    },
  );
}

export function registerGitHubTools(server: McpServer, context: RequestContext): void {
  if (resolveGitHubInsightsConfig(context.env) === null) {
    return;
  }

  const config = requireGitHubInsightsConfig(context.env);

  registerTool(server, context, {
    name: GITHUB_PROJECTS_LATEST_TOOL,
    description: "List the latest 5 public projects for the configured GitHub owner.",
    inputSchema: z.object({}),
    summary: () => `Loaded latest GitHub projects for ${config.owner}`,
    run: async () => getLatestProjects(config),
  });

  registerTool(server, context, {
    name: GITHUB_PROJECT_SUMMARY_TOOL,
    description: "Summarize a public project and the technologies it uses.",
    inputSchema: projectSummaryToolInputSchema,
    summary: (repo) => `Summarized GitHub project ${repo}`,
    run: async (input) => getProjectSummary(config, readRepoInput(input)),
  });

  registerTool(server, context, {
    name: GITHUB_PROJECT_ARCHITECTURE_TOOL,
    description:
      "Provide a high-level architecture overview and design decisions for a public project.",
    inputSchema: projectArchitectureToolInputSchema,
    summary: (repo) => `Built architecture overview for GitHub project ${repo}`,
    run: async (input) => getProjectArchitecture(config, readRepoInput(input)),
  });
}
