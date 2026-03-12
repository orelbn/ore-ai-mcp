import { AppError } from "@/lib/errors";
import type { Env, RequestContext } from "@/lib/worker";
import { DEFAULT_CONTEXT_UI_HINT } from "../constants";
import { loadContextIndex, loadContextMarkdown } from "../repo/context-bucket";
import type { ContextIndexToolEntry, ContextToolResult } from "../types";

export function isToolDisabled(env: Env, toolName: string): boolean {
	const disabled = env.MCP_DISABLED_TOOLS ?? "";
	if (!disabled.trim()) {
		return false;
	}
	return disabled
		.split(",")
		.map((tool) => tool.trim())
		.filter(Boolean)
		.includes(toolName);
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
