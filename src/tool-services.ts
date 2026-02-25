import {
	DEFAULT_CONTEXT_UI_HINT,
	PRIVATE_CONTEXT_INDEX_KEY,
} from "./constants";
import type { ContextIndexToolEntry } from "./context-index";
import { contextIndexSchema } from "./context-index";
import { AppError } from "./errors";
import type { Env, PrivateContextToolResult, RequestContext } from "./types";

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

async function loadContextIndex(bucket: R2Bucket) {
	const indexObject = await bucket.get(PRIVATE_CONTEXT_INDEX_KEY);
	if (!indexObject) {
		throw new AppError(
			"INTERNAL_ERROR",
			"Private context index not found in R2. Run `bun run context:sync`.",
			500,
		);
	}

	let rawIndex: unknown;
	try {
		rawIndex = JSON.parse(await indexObject.text());
	} catch {
		throw new AppError(
			"INTERNAL_ERROR",
			"Private context index is invalid JSON.",
			500,
		);
	}

	const parsed = contextIndexSchema.safeParse(rawIndex);
	if (!parsed.success) {
		throw new AppError(
			"INTERNAL_ERROR",
			"Private context index does not match expected schema.",
			500,
		);
	}

	return parsed.data;
}

export async function listContextToolEntries(
	context: RequestContext,
): Promise<ContextIndexToolEntry[]> {
	const contextIndex = await loadContextIndex(
		context.env.PRIVATE_CONTEXT_BUCKET,
	);
	return Object.values(contextIndex.tools).sort((left, right) =>
		left.toolName.localeCompare(right.toolName),
	);
}

export async function getContextByToolName(
	context: RequestContext,
	toolName: string,
): Promise<PrivateContextToolResult> {
	const contextIndex = await loadContextIndex(
		context.env.PRIVATE_CONTEXT_BUCKET,
	);
	const toolEntry = contextIndex.tools[toolName];
	if (!toolEntry) {
		throw new AppError(
			"INTERNAL_ERROR",
			`Tool mapping not found in private context index: ${toolName}`,
			500,
		);
	}

	return getContextByToolEntry(context, toolEntry);
}

export async function getContextByToolEntry(
	context: RequestContext,
	toolEntry: ContextIndexToolEntry,
): Promise<PrivateContextToolResult> {
	const markdownObject = await context.env.PRIVATE_CONTEXT_BUCKET.get(
		toolEntry.markdownKey,
	);
	if (!markdownObject) {
		throw new AppError(
			"INTERNAL_ERROR",
			`Markdown object not found in private context bucket: ${toolEntry.markdownKey}`,
			500,
		);
	}

	const markdown = await markdownObject.text();
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
