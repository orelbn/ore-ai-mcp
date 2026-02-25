import { authenticateRequest } from "./auth";
import { HEADER_REQUEST_ID, MCP_ROUTE } from "./constants";
import { toHttpErrorResponse } from "./errors";
import { createOreMcpServer } from "./mcp-server";
import type { Env, RequestContext } from "./types";

export interface WorkerHandler {
	fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
}

export function createWorker(): WorkerHandler {
	return {
		async fetch(request, env, ctx) {
			const requestUrl = new URL(request.url);
			if (requestUrl.pathname !== MCP_ROUTE) {
				return new Response("Not Found", { status: 404 });
			}

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
		},
	};
}

export default createWorker();
