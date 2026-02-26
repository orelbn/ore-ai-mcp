import { describe, expect, it } from "bun:test";
import { executeTool } from "../src/tool-runner";
import type { RequestContext } from "../src/types";
import { createMockR2Bucket } from "./r2-mock";

const context: RequestContext = {
	env: {
		MCP_INTERNAL_SHARED_SECRET: "secret",
		MCP_ALLOWED_CALLER: "ore-ai",
		CONTEXT_BUCKET: createMockR2Bucket({}),
	},
	userId: "user_123",
	requestId: "req_123",
	callerWorker: "ore-ai",
};

describe("executeTool", () => {
	it("returns INTERNAL_ERROR envelope when handler throws", async () => {
		const result = await executeTool(
			context,
			"ore.context.sample_context",
			async () => {
				throw new Error("context unavailable");
			},
		);

		expect(result.isError).toBeTrue();
		expect(result.structuredContent).toMatchObject({
			ok: false,
			error: {
				code: "INTERNAL_ERROR",
			},
		});
	});
});
