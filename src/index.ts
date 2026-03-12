import type { Env } from "@/lib/worker";
import { handleMcpRoute } from "@/modules/mcp";

export type WorkerHandler = {
	fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
};

export function createWorker(): WorkerHandler {
	return {
		async fetch(request, env, ctx) {
			return handleMcpRoute(request, env, ctx);
		},
	};
}

export default createWorker();
