import { CONTEXT_INDEX_KEY, DEFAULT_CONTEXT_UI_HINT } from "./constants";
import type { ContextIndex, ContextIndexToolEntry } from "./context-index";
import { contextIndexSchema } from "./context-index";
import { AppError } from "./errors";
import type { ContextToolResult, Env, RequestContext } from "./types";

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

function createEmptyContextIndex(): ContextIndex {
	return {
		version: 1,
		generatedAt: new Date().toISOString(),
		managedKeys: [],
		tools: {},
	};
}

function warnContextIndexFallback(
	context: RequestContext,
	reason: string,
	error?: string,
) {
	console.warn(
		JSON.stringify({
			scope: "tool_services",
			level: "warn",
			message: "context index unavailable, no tools registered",
			requestId: context.requestId,
			reason,
			error,
		}),
	);
}

async function loadContextIndex(
	context: RequestContext,
): Promise<ContextIndex> {
	const indexObject = await context.env.CONTEXT_BUCKET.get(CONTEXT_INDEX_KEY);
	if (!indexObject) {
		warnContextIndexFallback(
			context,
			"missing_context_index",
			`R2 object not found: ${CONTEXT_INDEX_KEY}`,
		);
		return createEmptyContextIndex();
	}

	let rawIndex: unknown;
	try {
		rawIndex = JSON.parse(await indexObject.text());
	} catch {
		warnContextIndexFallback(
			context,
			"invalid_context_index_json",
			`R2 object has invalid JSON: ${CONTEXT_INDEX_KEY}`,
		);
		return createEmptyContextIndex();
	}

	const parsed = contextIndexSchema.safeParse(rawIndex);
	if (!parsed.success) {
		warnContextIndexFallback(
			context,
			"invalid_context_index_schema",
			parsed.error.issues
				.map((issue) => {
					const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
					return `${path}: ${issue.message}`;
				})
				.join("; "),
		);
		return createEmptyContextIndex();
	}

	return parsed.data;
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
	const markdownObject = await context.env.CONTEXT_BUCKET.get(
		toolEntry.markdownKey,
	);
	if (!markdownObject) {
		throw new AppError(
			"INTERNAL_ERROR",
			`Markdown object not found in context bucket: ${toolEntry.markdownKey}`,
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
