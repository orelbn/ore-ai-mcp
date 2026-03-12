import { AppError } from "@/lib/errors";
import type { RequestContext } from "@/lib/worker";
import { CONTEXT_INDEX_KEY } from "../constants";
import { contextIndexSchema } from "../schema";
import type { ContextIndex } from "../types";

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
			scope: "context_repo",
			level: "warn",
			message: "context index unavailable, no tools registered",
			requestId: context.requestId,
			reason,
			error,
		}),
	);
}

export async function loadContextIndex(
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

export async function loadContextMarkdown(
	context: RequestContext,
	markdownKey: string,
): Promise<string> {
	const markdownObject = await context.env.CONTEXT_BUCKET.get(markdownKey);
	if (!markdownObject) {
		throw new AppError(
			"INTERNAL_ERROR",
			`Markdown object not found in context bucket: ${markdownKey}`,
			500,
		);
	}

	return markdownObject.text();
}
