export type ErrorCode =
	| "UNAUTHENTICATED"
	| "FORBIDDEN"
	| "INVALID_INPUT"
	| "INTERNAL_ERROR";

export type Env = {
	MCP_INTERNAL_SHARED_SECRET: string;
	MCP_ALLOWED_CALLER: string;
	MCP_ENFORCE_CF_WORKER?: string;
	MCP_DISABLED_TOOLS?: string;
	MCP_CONTEXT_TOOL_PREFIX?: string;
	CONTEXT_BUCKET: R2Bucket;
	PROJECT_INSIGHTS_KV?: KVNamespace;
	GITHUB_OWNER?: string;
	GITHUB_CACHE_TTL_SECONDS?: string;
	GITHUB_TOKEN?: string;
	GITHUB_INSIGHTS_PROVIDER?: string;
	GITHUB_INSIGHTS_MODEL?: string;
	GEMINI_API_KEY?: string;
};

export type AuthenticatedCaller = {
	userId: string;
	requestId: string;
	callerWorker: string | null;
};

export type RequestContext = AuthenticatedCaller & {
	env: Env;
};
