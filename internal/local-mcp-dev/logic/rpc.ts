import type { FetchLike, JsonRpcPayload, ResolvedConnection } from "../types";

export function parseMcpResponsePayload(rawBody: string): JsonRpcPayload {
	const trimmedBody = rawBody.trim();
	if (!trimmedBody) {
		throw new Error("Empty response from MCP server.");
	}

	if (trimmedBody.startsWith("{")) {
		return JSON.parse(trimmedBody) as JsonRpcPayload;
	}

	const payloadLine = trimmedBody
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.startsWith("data: "))
		.at(-1);
	if (!payloadLine) {
		throw new Error("Could not find JSON-RPC payload in MCP response.");
	}

	return JSON.parse(payloadLine.slice("data: ".length)) as JsonRpcPayload;
}

export async function sendJsonRpcRequest(
	connection: ResolvedConnection,
	method: string,
	params: Record<string, unknown>,
	fetchImpl: FetchLike = fetch,
): Promise<JsonRpcPayload> {
	const response = await fetchImpl(connection.url, {
		method: "POST",
		headers: {
			accept: "application/json, text/event-stream",
			"cf-worker": connection.callerWorker,
			"content-type": "application/json",
			"x-ore-internal-secret": connection.secret,
			"x-ore-request-id": crypto.randomUUID(),
			"x-ore-user-id": connection.userId,
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: crypto.randomUUID(),
			method,
			params,
		}),
	});

	const rawBody = await response.text();
	const payload = parseMcpResponsePayload(rawBody);

	if (!response.ok) {
		const message =
			payload.error?.message ||
			`MCP request failed with status ${response.status}.`;
		throw new Error(message);
	}

	if (payload.error) {
		throw new Error(payload.error.message);
	}

	return payload;
}

export async function callTool(
	connection: ResolvedConnection,
	name: string,
	args: Record<string, unknown>,
	fetchImpl: FetchLike = fetch,
): Promise<unknown> {
	const payload = await sendJsonRpcRequest(
		connection,
		"tools/call",
		{
			name,
			arguments: args,
		},
		fetchImpl,
	);
	return payload.result;
}
