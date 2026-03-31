export type ErrorCode = "INVALID_INPUT" | "INTERNAL_ERROR";

export type Env = {
  CONTEXT_BUCKET: R2Bucket;
};

export type RequestContext = {
  env: Env;
};
