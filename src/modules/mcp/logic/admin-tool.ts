import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { RequestContext } from "@/lib/worker";
import {
	getContextToolInventory,
	saveDisabledToolOverrides,
} from "@/modules/context";
import {
	MCP_ROUTE,
	MCP_SERVER_ADMIN_TOOL,
	ORE_MCP_SERVER_NAME,
	ORE_MCP_SERVER_VERSION,
} from "../constants";

const adminToolActionSchema = z.enum([
	"status",
	"list-tools",
	"disable-tools",
	"enable-tools",
	"clear-overrides",
]);

export const adminToolInputSchema = z.object({
	action: adminToolActionSchema,
	toolNames: z.array(z.string().min(1)).optional(),
});

type AdminToolArgs = z.infer<typeof adminToolInputSchema>;

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

function toSortedUniqueToolNames(toolNames: string[] | undefined): string[] {
	return Array.from(
		new Set(
			(toolNames ?? []).map((toolName) => toolName.trim()).filter(Boolean),
		),
	).sort((left, right) => left.localeCompare(right));
}

function requireToolNames(
	action: "disable-tools" | "enable-tools",
	toolNames?: string[],
): string[] {
	const normalizedToolNames = toSortedUniqueToolNames(toolNames);
	if (normalizedToolNames.length === 0) {
		throw new AppError(
			"INVALID_INPUT",
			`toolNames is required for action "${action}"`,
			400,
		);
	}

	return normalizedToolNames;
}

function validateKnownContextTools(
	knownToolNames: Set<string>,
	requestedToolNames: string[],
): void {
	const unknownToolNames = requestedToolNames.filter(
		(toolName) => !knownToolNames.has(toolName),
	);
	if (unknownToolNames.length > 0) {
		throw new AppError(
			"INVALID_INPUT",
			`Unknown tool names: ${unknownToolNames.join(", ")}`,
			400,
		);
	}
}

async function getInventoryPayload(context: RequestContext) {
	const inventory = await getContextToolInventory(context);
	return {
		server: {
			name: ORE_MCP_SERVER_NAME,
			version: ORE_MCP_SERVER_VERSION,
			route: MCP_ROUTE,
			adminToolName: MCP_SERVER_ADMIN_TOOL,
		},
		context: {
			generatedAt: inventory.generatedAt,
			configUpdatedAt: inventory.configUpdatedAt,
			managedKeyCount: inventory.managedKeys.length,
			toolCount: inventory.tools.length,
		},
		disabledTools: inventory.disabledTools,
		tools: [
			{
				kind: "internal",
				toolName: MCP_SERVER_ADMIN_TOOL,
				title: "MCP Server Manager",
				description:
					"Inspect the live MCP server and manage runtime disabled-tool overrides.",
				isDisabled: false,
				disabledSources: [],
			},
			...inventory.tools.map((tool) => ({
				kind: "context",
				toolName: tool.toolName,
				title: tool.title,
				description: tool.description ?? null,
				contextId: tool.contextId,
				markdownKey: tool.markdownKey,
				imageAssetKeys: tool.imageAssetKeys,
				sourceUpdatedAt: tool.sourceUpdatedAt,
				isDisabled: tool.isDisabled,
				disabledSources: tool.disabledSources,
			})),
		],
	};
}

export async function handleAdminTool(
	context: RequestContext,
	args: AdminToolArgs,
): Promise<CallToolResult> {
	if (args.action === "status") {
		const payload = await getInventoryPayload(context);
		return toSuccessResult(
			`Loaded MCP server status for ${ORE_MCP_SERVER_NAME}.`,
			{
				action: "status",
				server: payload.server,
				context: payload.context,
				disabledTools: payload.disabledTools,
			},
		);
	}

	if (args.action === "list-tools") {
		const payload = await getInventoryPayload(context);
		return toSuccessResult(
			`Listed ${payload.tools.length} MCP tools for ${ORE_MCP_SERVER_NAME}.`,
			{
				action: "list-tools",
				server: payload.server,
				context: payload.context,
				disabledTools: payload.disabledTools,
				tools: payload.tools,
			},
		);
	}

	if (args.action === "clear-overrides") {
		const previousInventory = await getContextToolInventory(context);
		const previousConfigDisabledTools = previousInventory.disabledTools.config;
		const savedConfig = await saveDisabledToolOverrides(context, []);
		const nextInventory = await getContextToolInventory(context);
		return toSuccessResult(
			`Cleared ${previousConfigDisabledTools.length} runtime MCP tool override(s).`,
			{
				action: "clear-overrides",
				clearedToolNames: previousConfigDisabledTools,
				server: {
					name: ORE_MCP_SERVER_NAME,
					version: ORE_MCP_SERVER_VERSION,
				},
				config: savedConfig,
				disabledTools: nextInventory.disabledTools,
			},
		);
	}

	const inventory = await getContextToolInventory(context);
	const knownToolNames = new Set(inventory.tools.map((tool) => tool.toolName));

	if (args.action === "disable-tools") {
		const requestedToolNames = requireToolNames(args.action, args.toolNames);
		validateKnownContextTools(knownToolNames, requestedToolNames);

		const changedToolNames = requestedToolNames.filter(
			(toolName) => !inventory.disabledTools.config.includes(toolName),
		);
		const alreadyDisabledToolNames = requestedToolNames.filter((toolName) =>
			inventory.disabledTools.config.includes(toolName),
		);
		const savedConfig = await saveDisabledToolOverrides(context, [
			...inventory.disabledTools.config,
			...requestedToolNames,
		]);
		const nextInventory = await getContextToolInventory(context);

		return toSuccessResult(
			`Disabled ${requestedToolNames.length} MCP tool(s) via runtime overrides.`,
			{
				action: "disable-tools",
				requestedToolNames,
				changedToolNames,
				alreadyDisabledToolNames,
				config: savedConfig,
				disabledTools: nextInventory.disabledTools,
			},
		);
	}

	const requestedToolNames = requireToolNames(args.action, args.toolNames);
	validateKnownContextTools(knownToolNames, requestedToolNames);
	const savedConfig = await saveDisabledToolOverrides(
		context,
		inventory.disabledTools.config.filter(
			(toolName) => !requestedToolNames.includes(toolName),
		),
	);
	const nextInventory = await getContextToolInventory(context);

	return toSuccessResult(
		`Enabled ${requestedToolNames.length} MCP tool(s) in runtime overrides.`,
		{
			action: "enable-tools",
			requestedToolNames,
			config: savedConfig,
			disabledTools: nextInventory.disabledTools,
			stillDisabledByEnv: requestedToolNames.filter((toolName) =>
				nextInventory.disabledTools.env.includes(toolName),
			),
		},
	);
}
