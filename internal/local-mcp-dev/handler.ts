import { extname } from "node:path";
import { z } from "zod";
import {
  adminRequestSchema,
  callTool,
  contextToolRequestSchema,
  parseDashboardConnection,
  resolveConnection,
  toClientConfig,
} from "./index";
import type { LocalDevRuntimeConfig, ResolvedConnection } from "./types";

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function formatZodError(error: z.ZodError): Error {
  return new Error(
    error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
        return `${path}: ${issue.message}`;
      })
      .join("; "),
  );
}

function toErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return json(
    {
      ok: false,
      error: message,
    },
    { status: 400 },
  );
}

function toConnectionSummary(connection: ResolvedConnection) {
  return {
    label: connection.label,
    url: connection.url,
    callerWorker: connection.callerWorker,
    userId: connection.userId,
  };
}

async function handleStatic(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  if (pathname.includes("..")) {
    return null;
  }

  const file = Bun.file(new URL(`./ui/dist${pathname}`, import.meta.url));
  if (!(await file.exists())) {
    return null;
  }

  return new Response(file, {
    headers: {
      "content-type": contentTypes[extname(pathname)] ?? "application/octet-stream",
    },
  });
}

async function readResolvedConnection(request: Request, runtimeConfig: LocalDevRuntimeConfig) {
  const body = await readJsonBody(request);
  return resolveConnection(runtimeConfig, parseDashboardConnection(body));
}

async function handleStatus(
  request: Request,
  runtimeConfig: LocalDevRuntimeConfig,
): Promise<Response> {
  const connection = await readResolvedConnection(request, runtimeConfig);
  const result = await callTool(connection, "ore.server.manage", {
    action: "status",
  });

  return json({
    ok: true,
    connection: toConnectionSummary(connection),
    result,
  });
}

async function handleTools(
  request: Request,
  runtimeConfig: LocalDevRuntimeConfig,
): Promise<Response> {
  const connection = await readResolvedConnection(request, runtimeConfig);
  const result = await callTool(connection, "ore.server.manage", {
    action: "list-tools",
  });

  return json({
    ok: true,
    connection: toConnectionSummary(connection),
    result,
  });
}

async function handleToolContent(
  request: Request,
  runtimeConfig: LocalDevRuntimeConfig,
): Promise<Response> {
  const body = contextToolRequestSchema.parse(await readJsonBody(request));
  const connection = resolveConnection(runtimeConfig, body.connection);
  const result = await callTool(connection, body.toolName, {});

  return json({
    ok: true,
    result,
  });
}

async function handleAdminAction(
  request: Request,
  runtimeConfig: LocalDevRuntimeConfig,
): Promise<Response> {
  const body = adminRequestSchema.parse(await readJsonBody(request));
  const connection = resolveConnection(runtimeConfig, body.connection);
  const result = await callTool(connection, "ore.server.manage", {
    action: body.action,
    ...(body.toolNames ? { toolNames: body.toolNames } : {}),
  });

  return json({
    ok: true,
    result,
  });
}

export function createLocalMcpDevFetchHandler(runtimeConfig: LocalDevRuntimeConfig) {
  return async function fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/api/config") {
        return json({
          ok: true,
          config: toClientConfig(runtimeConfig),
        });
      }

      if (request.method === "POST" && url.pathname === "/api/status") {
        return await handleStatus(request, runtimeConfig);
      }

      if (request.method === "POST" && url.pathname === "/api/tools") {
        return await handleTools(request, runtimeConfig);
      }

      if (request.method === "POST" && url.pathname === "/api/tool-content") {
        return await handleToolContent(request, runtimeConfig);
      }

      if (request.method === "POST" && url.pathname === "/api/admin") {
        return await handleAdminAction(request, runtimeConfig);
      }

      if (request.method === "GET") {
        const staticResponse = await handleStatic(request);
        if (staticResponse) {
          return staticResponse;
        }
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return toErrorResponse(formatZodError(error));
      }
      return toErrorResponse(error);
    }
  };
}

export function logStartup(runtimeConfig: LocalDevRuntimeConfig): void {
  const targetSummary = runtimeConfig.localUrl ?? "local MCP url not detected";
  console.log(`Local MCP Dev running at http://127.0.0.1:${runtimeConfig.port} (${targetSummary})`);
}
