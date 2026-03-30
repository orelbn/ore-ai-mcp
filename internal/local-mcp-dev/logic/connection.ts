import type { ConnectionRequest, LocalDevRuntimeConfig } from "../types";

export function resolveConnection(config: LocalDevRuntimeConfig, _request: ConnectionRequest) {
  if (!config.sharedSecret) {
    throw new Error("No local shared secret is configured.");
  }

  if (!config.localUrl) {
    throw new Error("No local MCP URL is available.");
  }

  return {
    label: "Local",
    url: config.localUrl,
    secret: config.sharedSecret,
    callerWorker: config.defaultCallerWorker,
    userId: config.defaultUserId,
  };
}
