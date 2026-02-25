import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { normalizeError, toToolErrorResult } from "./errors";
import { logToolEvent } from "./logging";
import type { RequestContext } from "./types";

export async function executeTool(
	context: RequestContext,
	toolName: string,
	handler: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
	const startedAt = Date.now();
	try {
		const result = await handler();
		await logToolEvent(context, {
			toolName,
			status: "success",
			latencyMs: Date.now() - startedAt,
		});
		return result;
	} catch (error) {
		const appError = normalizeError(error);
		await logToolEvent(context, {
			toolName,
			status: "error",
			latencyMs: Date.now() - startedAt,
			errorCode: appError.code,
		});
		return toToolErrorResult(appError);
	}
}
