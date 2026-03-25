import { describe, expect, it } from "bun:test";
import { createMockR2Bucket } from "@mocks/r2-bucket";
import { createWorker } from "@/index";
import {
	HEADER_INTERNAL_SECRET,
	HEADER_REQUEST_ID,
	HEADER_USER_ID,
} from "@/lib/auth";
import type { Env } from "@/lib/worker";

const worker = createWorker();

const env: Env = {
	MCP_INTERNAL_SHARED_SECRET: "secret",
	MCP_ALLOWED_CALLER: "ore-ai",
	CONTEXT_BUCKET: createMockR2Bucket({}),
};

describe("worker entrypoint", () => {
	it("returns 404 for non-mcp route", async () => {
		const response = await worker.fetch(
			new Request("https://example.com/not-mcp"),
			env,
			{} as ExecutionContext,
		);
		expect(response.status).toBe(404);
	});

	it("returns structured auth error for missing headers", async () => {
		const response = await worker.fetch(
			new Request("https://example.com/mcp", {
				method: "POST",
				headers: {
					[HEADER_REQUEST_ID]: "req_123",
				},
			}),
			env,
			{} as ExecutionContext,
		);

		expect(response.status).toBe(401);
		const body = (await response.json()) as {
			error?: { code?: string };
			ok?: boolean;
		};
		expect(body.ok).toBeFalse();
		expect(body.error?.code).toBe("UNAUTHENTICATED");
	});

	it("accepts GET stream negotiation in stateless mode", async () => {
		const response = await worker.fetch(
			new Request("https://example.com/mcp", {
				method: "GET",
				headers: {
					accept: "text/event-stream",
					"cf-worker": "ore-ai",
					[HEADER_INTERNAL_SECRET]: "secret",
					[HEADER_USER_ID]: "user_123",
					[HEADER_REQUEST_ID]: "req_get_1",
				},
			}),
			env,
			{} as ExecutionContext,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/event-stream");
	});

	it("handles stateless tools/list requests without initialize", async () => {
		const response = await worker.fetch(
			new Request("https://example.com/mcp", {
				method: "POST",
				headers: {
					accept: "application/json, text/event-stream",
					"cf-worker": "ore-ai",
					"content-type": "application/json",
					[HEADER_INTERNAL_SECRET]: "secret",
					[HEADER_USER_ID]: "user_123",
					[HEADER_REQUEST_ID]: "req_post_invalid_session",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 2,
					method: "tools/list",
					params: {},
				}),
			}),
			env,
			{} as ExecutionContext,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/event-stream");

		const bodyText = await response.text();
		const payloadLine = bodyText
			.split("\n")
			.find((line) => line.startsWith("data: "));
		expect(payloadLine).toBeDefined();
		if (!payloadLine) {
			throw new Error("Expected MCP tools/list response payload line");
		}

		const body = JSON.parse(payloadLine.slice("data: ".length)) as {
			id?: number;
			result?: {
				tools?: Array<{ name?: string }>;
			};
		};

		expect(body.id).toBe(2);
		expect(
			body.result?.tools?.some((tool) => tool.name === "ore.server.manage"),
		).toBeTrue();
	});

	it("handles authenticated MCP initialize requests", async () => {
		const response = await worker.fetch(
			new Request("https://example.com/mcp", {
				method: "POST",
				headers: {
					accept: "application/json, text/event-stream",
					"cf-worker": "ore-ai",
					"content-type": "application/json",
					[HEADER_INTERNAL_SECRET]: "secret",
					[HEADER_USER_ID]: "user_123",
					[HEADER_REQUEST_ID]: "req_456",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "initialize",
					params: {
						protocolVersion: "2025-03-26",
						capabilities: {},
						clientInfo: {
							name: "bun-test",
							version: "1.0.0",
						},
					},
				}),
			}),
			env,
			{} as ExecutionContext,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/event-stream");

		const bodyText = await response.text();
		const payloadLine = bodyText
			.split("\n")
			.find((line) => line.startsWith("data: "));
		expect(payloadLine).toBeDefined();
		if (!payloadLine) {
			throw new Error("Expected MCP initialize response payload line");
		}

		const body = JSON.parse(payloadLine.slice("data: ".length)) as {
			id?: number;
			jsonrpc?: string;
			result?: {
				protocolVersion?: string;
				serverInfo?: { name?: string };
				capabilities?: Record<string, unknown>;
			};
		};

		expect(body.id).toBe(1);
		expect(body.jsonrpc).toBe("2.0");
		expect(body.result?.protocolVersion).toBe("2025-03-26");
		expect(body.result?.serverInfo?.name).toBe("Ore AI MCP");
		expect(body.result?.capabilities).toEqual({
			tools: {
				listChanged: true,
			},
		});
	});
});
