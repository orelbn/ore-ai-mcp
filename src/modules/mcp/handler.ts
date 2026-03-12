import { authenticateRequest, getRequestIdHeader } from "@/lib/auth";
import { toHttpErrorResponse } from "@/lib/errors";
import type { Env, RequestContext } from "@/lib/worker";
import { MCP_ROUTE } from "./constants";
import { createOreMcpServer } from "./logic/create-server";

/**
 * Handle an incoming MCP request and dispatch it to the MCP agent handler.
 *
 * Authenticates the caller, constructs a RequestContext, creates the MCP server and handler, and invokes the handler to produce a Response. If processing fails, returns an HTTP error response whose request ID is derived from the incoming request or a generated UUID.
 *
 * @param request - The incoming fetch Request to handle
 * @param env - Worker environment bindings required by handlers
 * @param ctx - ExecutionContext for the current invocation
 * @returns The Response produced by the MCP handler, or an HTTP error Response when an error occurs
 */
export async function handleMcpRequest(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const fallbackRequestId = getRequestIdHeader(request) ?? crypto.randomUUID();

	try {
		const caller = authenticateRequest(request, env);
		const context: RequestContext = {
			env,
			userId: caller.userId,
			requestId: caller.requestId,
			callerWorker: caller.callerWorker,
		};

		const { createMcpHandler } = await import("agents/mcp");
		const server = await createOreMcpServer(context);
		const mcpHandler = createMcpHandler(
			server as unknown as Parameters<typeof createMcpHandler>[0],
			{
				route: MCP_ROUTE,
			},
		);

		return await mcpHandler(request, env, ctx);
	} catch (error) {
		return toHttpErrorResponse(error, fallbackRequestId);
	}
}
