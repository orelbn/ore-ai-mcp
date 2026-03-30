import type { Env } from "@/lib/worker";
import { MCP_ROUTE } from "./constants";
import { handleMcpRequest } from "./handler";

export async function handleMcpRoute(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname !== MCP_ROUTE) {
    return new Response("Not Found", { status: 404 });
  }

  return handleMcpRequest(request, env, ctx);
}
