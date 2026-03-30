export const adminToolActions = [
  "status",
  "list-tools",
  "disable-tools",
  "enable-tools",
  "clear-overrides",
] as const;

export type AdminToolAction = (typeof adminToolActions)[number];

export type LocalDevRuntimeConfig = {
  port: number;
  localUrl: string | null;
  setupMessage: string | null;
  sharedSecret: string | undefined;
  defaultCallerWorker: string;
  defaultUserId: string;
};

export type LocalDevClientConfig = {
  port: number;
  localUrl: string | null;
  setupMessage: string | null;
};

export type ConnectionRequest = Record<string, never>;

export type ResolvedConnection = {
  label: string;
  url: string;
  secret: string;
  callerWorker: string;
  userId: string;
};

export type JsonRpcError = {
  code: number;
  message: string;
};

export type JsonRpcPayload = {
  id?: string | number | null;
  jsonrpc?: string;
  result?: unknown;
  error?: JsonRpcError;
};

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type BuildConfigOptions = {
  cwd?: string;
  fetchImpl?: FetchLike;
};
