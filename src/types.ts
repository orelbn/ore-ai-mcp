export type ErrorCode =
	| "UNAUTHENTICATED"
	| "FORBIDDEN"
	| "INVALID_INPUT"
	| "INTERNAL_ERROR";

export interface Env {
	MCP_INTERNAL_SHARED_SECRET: string;
	MCP_ALLOWED_CALLER: string;
	MCP_ALLOWED_CALLERS?: string;
	MCP_ENFORCE_CF_WORKER?: string;
	MCP_DISABLED_TOOLS?: string;
	PRIVATE_CONTEXT_BUCKET: R2Bucket;
}

export interface AuthenticatedCaller {
	userId: string;
	requestId: string;
	callerWorker: string | null;
}

export interface RequestContext extends AuthenticatedCaller {
	env: Env;
}

export interface PrivateContextToolResult {
	uiHint: string;
	toolName: string;
	contextId: string;
	title: string;
	markdown: string;
	imageAssetKeys: string[];
	sourceUpdatedAt: string;
}
