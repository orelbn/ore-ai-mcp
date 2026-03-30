import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import type {
  BuildConfigOptions,
  FetchLike,
  LocalDevClientConfig,
  LocalDevRuntimeConfig,
} from "../types";
import { sendJsonRpcRequest } from "./rpc";

export const defaultLocalMcpUrl = "http://127.0.0.1:8787/mcp";

function parseDevVarsFile(rawText: string): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const line of rawText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

function loadDevVars(cwd: string): Record<string, string> {
  const devVarsPath = resolvePath(cwd, ".dev.vars");
  if (!existsSync(devVarsPath)) {
    return {};
  }

  return parseDevVarsFile(readFileSync(devVarsPath, "utf8"));
}

function resolveSharedSecret(
  env: NodeJS.ProcessEnv,
  devVars: Record<string, string>,
): string | undefined {
  const candidates = [
    env.INTERNAL_MCP_LOCAL_SECRET,
    env.INTERNAL_MCP_SHARED_SECRET,
    env.MCP_INTERNAL_SHARED_SECRET,
    devVars.MCP_INTERNAL_SHARED_SECRET,
  ];

  return candidates.find((candidate) => candidate?.trim())?.trim();
}

async function probeLocalMcpUrl(
  url: string,
  secret: string,
  callerWorker: string,
  userId: string,
  fetchImpl: FetchLike,
): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 500);

  try {
    await sendJsonRpcRequest(
      {
        label: "Local Probe",
        url,
        secret,
        callerWorker,
        userId,
      },
      "tools/list",
      {},
      (input, init) =>
        fetchImpl(input, {
          ...init,
          signal: controller.signal,
        }),
    );
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function detectLocalMcpUrl(
  env: NodeJS.ProcessEnv,
  secret: string,
  callerWorker: string,
  userId: string,
  fetchImpl: FetchLike,
): Promise<string> {
  const explicitUrl = env.INTERNAL_MCP_LOCAL_URL?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const candidates = [
    defaultLocalMcpUrl,
    "http://localhost:8787/mcp",
    "http://127.0.0.1:8788/mcp",
    "http://localhost:8788/mcp",
    "http://127.0.0.1:8789/mcp",
    "http://localhost:8789/mcp",
  ];

  for (const candidate of candidates) {
    if (await probeLocalMcpUrl(candidate, secret, callerWorker, userId, fetchImpl)) {
      return candidate;
    }
  }

  return defaultLocalMcpUrl;
}

export async function buildDashboardRuntimeConfig(
  env: NodeJS.ProcessEnv,
  options: BuildConfigOptions = {},
): Promise<LocalDevRuntimeConfig> {
  const cwd = options.cwd ?? process.cwd();
  const fetchImpl = options.fetchImpl ?? fetch;
  const devVars = loadDevVars(cwd);
  const defaultCallerWorker = env.INTERNAL_MCP_CALLER_WORKER?.trim() || "ore-ai";
  const defaultUserId = env.INTERNAL_MCP_USER_ID?.trim() || "local-mcp-dev";
  const sharedSecret = resolveSharedSecret(env, devVars);

  if (!sharedSecret) {
    return {
      port: 4317,
      localUrl: null,
      setupMessage:
        "No local shared secret found. Add `MCP_INTERNAL_SHARED_SECRET` to `.dev.vars` and start `wrangler dev`.",
      sharedSecret: undefined,
      defaultCallerWorker,
      defaultUserId,
    };
  }

  const localUrl = await detectLocalMcpUrl(
    env,
    sharedSecret,
    defaultCallerWorker,
    defaultUserId,
    fetchImpl,
  );

  return {
    port: 4317,
    localUrl,
    setupMessage: null,
    sharedSecret,
    defaultCallerWorker,
    defaultUserId,
  };
}

export function toClientConfig(config: LocalDevRuntimeConfig): LocalDevClientConfig {
  return {
    port: config.port,
    localUrl: config.localUrl,
    setupMessage: config.setupMessage,
  };
}
