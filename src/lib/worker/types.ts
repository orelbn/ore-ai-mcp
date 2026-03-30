export type ErrorCode = "INVALID_INPUT" | "INTERNAL_ERROR";

export type Env = {
  CONTEXT_BUCKET: R2Bucket;
  PROJECT_INSIGHTS_KV?: KVNamespace;
  GITHUB_OWNER?: string;
  GITHUB_CACHE_TTL_SECONDS?: string;
  GITHUB_TOKEN?: string;
  GITHUB_INSIGHTS_PROVIDER?: string;
  GITHUB_INSIGHTS_MODEL?: string;
  GEMINI_API_KEY?: string;
};

export type RequestContext = {
  env: Env;
};
