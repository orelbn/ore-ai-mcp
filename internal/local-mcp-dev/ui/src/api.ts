import type {
  LocalDevClientConfig,
  StatusResponse,
  ToolContentResponse,
  ToolsResponse,
} from "./types";

type ApiErrorPayload = {
  ok?: false;
  error?: string;
};

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return typeof value === "object" && value !== null;
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json();
  if (!response.ok) {
    if (isApiErrorPayload(payload) && typeof payload.error === "string") {
      throw new Error(payload.error);
    }
    throw new Error("Request failed");
  }

  if (isApiErrorPayload(payload) && payload.ok === false) {
    throw new Error(payload.error || "Request failed");
  }

  return payload as T;
}

function createRequestBody(body: Record<string, unknown>): RequestInit {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      connection: {},
      ...body,
    }),
  };
}

export async function fetchConfig(): Promise<LocalDevClientConfig> {
  const response = await fetch("/api/config");
  const payload = await parseJson<{ ok: true; config: LocalDevClientConfig }>(response);
  return payload.config;
}

export async function fetchStatus(): Promise<StatusResponse> {
  const response = await fetch("/api/status", createRequestBody({}));
  return parseJson<StatusResponse>(response);
}

export async function fetchTools(): Promise<ToolsResponse> {
  const response = await fetch("/api/tools", createRequestBody({}));
  return parseJson<ToolsResponse>(response);
}

export async function fetchToolContent(toolName: string): Promise<ToolContentResponse> {
  const response = await fetch("/api/tool-content", createRequestBody({ toolName }));
  const payload = await parseJson<{ ok: true; result: ToolContentResponse }>(response);
  return payload.result;
}
