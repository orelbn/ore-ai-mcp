import { describe, expect, it } from "bun:test";
import { HEADER_REQUEST_ID } from "@/lib/auth";
import { createWorker } from "@/index";
import type { Env } from "@/lib/worker";
import { createMockR2Bucket } from "@mocks/r2-bucket";

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
});
