import { AppError } from "@/lib/errors";
import type { Env, RequestContext } from "@/lib/worker";
import { DEFAULT_CONTEXT_UI_HINT } from "../constants";
import {
	loadContextIndex,
	loadContextMarkdown,
	loadContextServerConfig,
	saveContextServerConfig,
} from "../repo/context-bucket";
import type {
	ContextIndexToolEntry,
	ContextServerConfig,
	ContextToolInventory,
	ContextToolResult,
	ToolDisableSource,
} from "../types";

function toSortedUniqueToolNames(toolNames: string[]): string[] {
	return Array.from(
		new Set(toolNames.map((toolName) => toolName.trim()).filter(Boolean)),
	).sort((left, right) => left.localeCompare(right));
}

export function listEnvDisabledTools(env: Env): string[] {
	return toSortedUniqueToolNames((env.MCP_DISABLED_TOOLS ?? "").split(","));
}

export function isToolDisabled(env: Env, toolName: string): boolean {
	return listEnvDisabledTools(env).includes(toolName);
}

export async function listContextToolEntries(
	context: RequestContext,
): Promise<ContextIndexToolEntry[]> {
	const contextIndex = await loadContextIndex(context);
	return Object.values(contextIndex.tools).sort((left, right) =>
		left.toolName.localeCompare(right.toolName),
	);
}

export async function getContextByToolName(
	context: RequestContext,
	toolName: string,
): Promise<ContextToolResult> {
	const contextIndex = await loadContextIndex(context);
	const toolEntry = contextIndex.tools[toolName];
	if (!toolEntry) {
		throw new AppError(
			"INTERNAL_ERROR",
			`Tool mapping not found in context index: ${toolName}`,
			500,
		);
	}

	return getContextByToolEntry(context, toolEntry);
}

export async function getContextByToolEntry(
	context: RequestContext,
	toolEntry: ContextIndexToolEntry,
): Promise<ContextToolResult> {
	const markdown = await loadContextMarkdown(context, toolEntry.markdownKey);
	return {
		uiHint: toolEntry.uiHint ?? DEFAULT_CONTEXT_UI_HINT,
		toolName: toolEntry.toolName,
		contextId: toolEntry.contextId,
		title: toolEntry.title,
		markdown,
		imageAssetKeys: toolEntry.imageAssetKeys,
		sourceUpdatedAt: toolEntry.sourceUpdatedAt,
	};
}

export async function getContextToolInventory(
	context: RequestContext,
): Promise<ContextToolInventory> {
	const [contextIndex, serverConfig] = await Promise.all([
		loadContextIndex(context),
		loadContextServerConfig(context),
	]);

	const envDisabledTools = listEnvDisabledTools(context.env);
	const configDisabledTools = toSortedUniqueToolNames(
		serverConfig.disabledTools,
	);
	const combinedDisabledToolSet = new Set([
		...envDisabledTools,
		...configDisabledTools,
	]);
	const envDisabledToolSet = new Set(envDisabledTools);
	const configDisabledToolSet = new Set(configDisabledTools);

	return {
		generatedAt: contextIndex.generatedAt,
		managedKeys: contextIndex.managedKeys,
		configUpdatedAt: serverConfig.updatedAt,
		disabledTools: {
			env: envDisabledTools,
			config: configDisabledTools,
			combined: Array.from(combinedDisabledToolSet).sort((left, right) =>
				left.localeCompare(right),
			),
		},
		tools: Object.values(contextIndex.tools)
			.sort((left, right) => left.toolName.localeCompare(right.toolName))
			.map((toolEntry) => {
				const disabledSources: ToolDisableSource[] = [];
				if (envDisabledToolSet.has(toolEntry.toolName)) {
					disabledSources.push("env");
				}
				if (configDisabledToolSet.has(toolEntry.toolName)) {
					disabledSources.push("config");
				}

				return {
					...toolEntry,
					isDisabled: combinedDisabledToolSet.has(toolEntry.toolName),
					disabledSources,
				};
			}),
	};
}

export async function saveDisabledToolOverrides(
	context: RequestContext,
	disabledTools: string[],
): Promise<ContextServerConfig> {
	const nextConfig: ContextServerConfig = {
		version: 1,
		updatedAt: new Date().toISOString(),
		disabledTools: toSortedUniqueToolNames(disabledTools),
	};

	await saveContextServerConfig(context, nextConfig);
	return nextConfig;
}
