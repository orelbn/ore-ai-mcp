import type { ErrorCode, RequestContext } from "./types";

interface ToolLogEvent {
	toolName: string;
	status: "success" | "error";
	latencyMs: number;
	errorCode?: ErrorCode;
}

async function hashUserId(userId: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(userId),
	);
	const bytes = new Uint8Array(digest);
	const hex = Array.from(bytes)
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("");
	return hex.slice(0, 16);
}

export async function logToolEvent(
	context: RequestContext,
	event: ToolLogEvent,
): Promise<void> {
	const payload = {
		timestamp: new Date().toISOString(),
		requestId: context.requestId,
		callerWorker: context.callerWorker,
		userHash: await hashUserId(context.userId),
		toolName: event.toolName,
		status: event.status,
		latencyMs: event.latencyMs,
		errorCode: event.errorCode,
	};

	console.log(JSON.stringify(payload));
}
