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
  // agents currently vendors its own MCP SDK instance, so the class identity here differs
  // from the app's direct SDK dependency even though the runtime server is compatible.
  // @ts-expect-error duplicated MCP SDK type identity between agents and the app dependency
  return createMcpHandler(server, { route: MCP_ROUTE })(request, env, ctx);
}
