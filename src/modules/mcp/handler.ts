import { authenticateRequest, HEADER_REQUEST_ID } from "@/lib/auth";
import { toHttpErrorResponse } from "@/lib/errors";
import type { Env, RequestContext } from "@/lib/worker";
import { MCP_ROUTE } from "./constants";
import { createOreMcpServer } from "./logic/create-server";

export async function handleMcpRequest(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const fallbackRequestId =
		request.headers.get(HEADER_REQUEST_ID) ?? crypto.randomUUID();

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
