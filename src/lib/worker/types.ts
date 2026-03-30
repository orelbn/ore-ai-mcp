export type ErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_INPUT" | "INTERNAL_ERROR";

export type Env = {
  MCP_INTERNAL_SHARED_SECRET: string;
  MCP_ALLOWED_CALLER: string;
  MCP_ENFORCE_CF_WORKER?: string;
  MCP_DISABLED_TOOLS?: string;
  CONTEXT_BUCKET: R2Bucket;
};

export type AuthenticatedCaller = {
  userId: string;
  requestId: string;
  callerWorker: string | null;
};

export type RequestContext = AuthenticatedCaller & {
  env: Env;
};
