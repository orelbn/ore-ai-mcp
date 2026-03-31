import type { ErrorCode, RequestContext } from "@/lib/worker";

type ToolLogEvent = {
  toolName: string;
  status: "success" | "error";
  latencyMs: number;
  errorCode?: ErrorCode;
};

export async function logToolEvent(_context: RequestContext, event: ToolLogEvent): Promise<void> {
  const payload = {
    timestamp: new Date().toISOString(),
    toolName: event.toolName,
    status: event.status,
    latencyMs: event.latencyMs,
    errorCode: event.errorCode,
  };

  console.log(JSON.stringify(payload));
}
