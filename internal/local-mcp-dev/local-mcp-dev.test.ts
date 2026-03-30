import { describe, expect, it } from "vite-plus/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildDashboardRuntimeConfig,
  defaultLocalMcpUrl,
  parseMcpResponsePayload,
  resolveConnection,
  sendJsonRpcRequest,
} from "./index";

describe("local mcp dev client helpers", () => {
  it("loads the shared secret from .dev.vars and auto-detects the local url", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "local-mcp-dev-"));
    try {
      writeFileSync(`${cwd}/.dev.vars`, "MCP_INTERNAL_SHARED_SECRET=from-dev-vars\n");

      const config = await buildDashboardRuntimeConfig(
        {
          INTERNAL_MCP_USER_ID: "orel",
        },
        {
          cwd,
          fetchImpl: async (input) => {
            expect(input).toBe(defaultLocalMcpUrl);
            return new Response("ok", { status: 200 });
          },
        },
      );

      expect(config.defaultUserId).toBe("orel");
      expect(config.sharedSecret).toBe("from-dev-vars");
      expect(config.localUrl).toBe(defaultLocalMcpUrl);
      expect(config.setupMessage).toBeNull();
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });

  it("returns a setup message when .dev.vars does not provide a secret", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "local-mcp-dev-"));
    try {
      const config = await buildDashboardRuntimeConfig({}, { cwd });

      expect(config.localUrl).toBeNull();
      expect(config.sharedSecret).toBeUndefined();
      expect(config.setupMessage).toContain(".dev.vars");
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });

  it("resolves a local connection from runtime config", () => {
    const connection = resolveConnection(
      {
        port: 4317,
        localUrl: defaultLocalMcpUrl,
        setupMessage: null,
        sharedSecret: "local-secret",
        defaultCallerWorker: "ore-ai",
        defaultUserId: "internal-mcp-dev",
      },
      {},
    );

    expect(connection).toMatchObject({
      label: "Local",
      url: defaultLocalMcpUrl,
      secret: "local-secret",
      callerWorker: "ore-ai",
      userId: "internal-mcp-dev",
    });
  });

  it("parses streamable HTTP responses", () => {
    const payload = parseMcpResponsePayload(`
event: message
data: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}
`);

    expect(payload).toMatchObject({
      result: {
        ok: true,
      },
    });
  });

  it("sends JSON-RPC requests with MCP auth headers", async () => {
    const connection = {
      label: "Local",
      url: "https://example.com/mcp",
      secret: "secret",
      callerWorker: "ore-ai",
      userId: "orel",
    };

    const payload = await sendJsonRpcRequest(connection, "tools/list", {}, async (input, init) => {
      expect(input).toBe("https://example.com/mcp");
      expect(init?.headers).toMatchObject({
        "cf-worker": "ore-ai",
        "x-ore-internal-secret": "secret",
        "x-ore-user-id": "orel",
      });
      expect(typeof init?.body).toBe("string");
      return new Response(
        'event: message\ndata: {"jsonrpc":"2.0","id":"1","result":{"tools":[]}}\n\n',
        {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
          },
        },
      );
    });

    expect(payload).toMatchObject({
      result: {
        tools: [],
      },
    });
  });
});
