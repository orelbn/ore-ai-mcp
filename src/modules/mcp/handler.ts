import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateRequest, HEADER_REQUEST_ID } from "@/lib/auth";
import { toHttpErrorResponse } from "@/lib/errors";
import type { Env, RequestContext } from "@/lib/worker";
import { createOreMcpServer } from "./logic/create-server";

async function createRequestTransport(
  context: RequestContext,
): Promise<WebStandardStreamableHTTPServerTransport> {
  const server = await createOreMcpServer(context);
  const transport = new WebStandardStreamableHTTPServerTransport({
    // This worker is used as a simple per-request tool server behind a
    // Cloudflare service binding, so stateless mode avoids unnecessary
    // session bookkeeping and transport conflicts.
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  return transport;
}

export async function handleMcpRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
): Promise<Response> {
  const fallbackRequestId = request.headers.get(HEADER_REQUEST_ID) ?? crypto.randomUUID();

  try {
    const caller = authenticateRequest(request, env);
    const context: RequestContext = {
      env,
      userId: caller.userId,
      requestId: caller.requestId,
      callerWorker: caller.callerWorker,
    };
    const transport = await createRequestTransport(context);
    return await transport.handleRequest(request);
  } catch (error) {
    return toHttpErrorResponse(error, fallbackRequestId);
  }
}
