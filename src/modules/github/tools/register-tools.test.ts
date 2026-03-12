import { afterEach, describe, expect, it } from "bun:test";
import { createMockKVNamespace } from "@mocks/kv-namespace";
import { createMockR2Bucket } from "@mocks/r2-bucket";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestContext } from "@/lib/worker";
import {
	GITHUB_PROJECT_ARCHITECTURE_TOOL,
	GITHUB_PROJECT_SUMMARY_TOOL,
	GITHUB_PROJECTS_LATEST_TOOL,
} from "../constants";
import { registerGitHubTools } from "./register-tools";

const createdServers: McpServer[] = [];
const createdClients: Client[] = [];

afterEach(async () => {
	await Promise.all([
		...createdClients.splice(0).map((client) => client.close()),
		...createdServers.splice(0).map((server) => server.close()),
	]);
});

async function listToolNames(server: McpServer): Promise<string[]> {
	const client = await connectClient(server);
	const { tools } = await client.listTools();
	return tools.map((tool) => tool.name);
}

async function connectClient(server: McpServer): Promise<Client> {
	const client = new Client({
		name: "test-client",
		version: "0.0.0",
	});
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	createdClients.push(client);
	createdServers.push(server);

	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);

	return client;
}

function createContext(): RequestContext {
	return {
		env: {
			MCP_INTERNAL_SHARED_SECRET: "secret",
			MCP_ALLOWED_CALLER: "ore-ai",
			CONTEXT_BUCKET: createMockR2Bucket({}),
			PROJECT_INSIGHTS_KV: createMockKVNamespace(),
			GITHUB_OWNER: "example",
		},
		userId: "user_123",
		requestId: "req_123",
		callerWorker: "caller",
	};
}

describe("registerGitHubTools", () => {
	it("registers all GitHub tools when configured", async () => {
		const server = new McpServer({ name: "test", version: "0.0.0" });
		registerGitHubTools(server, createContext(), () => true);
		expect(await listToolNames(server)).toEqual([
			GITHUB_PROJECTS_LATEST_TOOL,
			GITHUB_PROJECT_SUMMARY_TOOL,
			GITHUB_PROJECT_ARCHITECTURE_TOOL,
		]);
	});

	it("skips registration when GitHub config is missing", async () => {
		const server = new McpServer({ name: "test", version: "0.0.0" });
		const context = createContext();
		delete context.env.GITHUB_OWNER;
		registerGitHubTools(server, context, () => true);
		const client = await connectClient(server);
		expect(client.getServerCapabilities()?.tools).toBeUndefined();
	});
});
