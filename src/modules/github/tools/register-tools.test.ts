import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createMockKVNamespace } from "@mocks/kv-namespace";
import { createMockR2Bucket } from "@mocks/r2-bucket";
import type { RequestContext } from "@/lib/worker";
import {
  GITHUB_PROJECT_ARCHITECTURE_TOOL,
  GITHUB_PROJECT_SUMMARY_TOOL,
  GITHUB_PROJECTS_LATEST_TOOL,
} from "../constants";
import { registerGitHubTools } from "./register-tools";

type ConnectedPair = {
  client: Client;
  server: McpServer;
};

const openPairs: ConnectedPair[] = [];

afterEach(async () => {
  await Promise.all(
    openPairs.splice(0).flatMap(({ client, server }) => [client.close(), server.close()]),
  );
});

function createContext(env: Partial<RequestContext["env"]> = {}): RequestContext {
  return {
    env: {
      CONTEXT_BUCKET: createMockR2Bucket({}),
      ...env,
    },
  };
}

async function connectToolServer(context: RequestContext): Promise<Client> {
  const server = new McpServer({ name: "test-server", version: "1.0.0" });
  registerGitHubTools(server, context);

  const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  openPairs.push({ client, server });
  return client;
}

describe("registerGitHubTools", () => {
  it("advertises the GitHub tools through MCP when configured", async () => {
    const client = await connectToolServer(
      createContext({
        PROJECT_INSIGHTS_KV: createMockKVNamespace(),
        GITHUB_OWNER: "example",
        GITHUB_INSIGHTS_PROVIDER: "heuristic",
      }),
    );

    const result = await client.listTools();

    expect(result.tools.map((tool) => tool.name)).toEqual([
      GITHUB_PROJECTS_LATEST_TOOL,
      GITHUB_PROJECT_SUMMARY_TOOL,
      GITHUB_PROJECT_ARCHITECTURE_TOOL,
    ]);
  });

  it("does not advertise GitHub tools when the feature is not configured", async () => {
    const client = await connectToolServer(createContext());

    await expect(client.listTools()).rejects.toMatchObject({
      code: -32601,
    });
  });
});
