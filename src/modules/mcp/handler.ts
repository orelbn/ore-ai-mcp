import { createMcpHandler } from "agents/mcp";
import type { Env, RequestContext } from "@/lib/worker";
import { MCP_ROUTE } from "./constants";
import { createOreMcpServer } from "./logic/create-server";

export async function handleMcpRoute(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const context: RequestContext = { env };
  const server = await createOreMcpServer(context);
  return createMcpHandler(server, { route: MCP_ROUTE })(request, env, ctx);
}
