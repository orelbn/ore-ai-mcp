import { describe, expect, it } from "bun:test";
import { PRIVATE_CONTEXT_INDEX_KEY } from "../src/constants";
import type { AppError } from "../src/errors";
import {
	getContextByToolName,
	isToolDisabled,
	listContextToolEntries,
} from "../src/tool-services";
import type { RequestContext } from "../src/types";
import { createMockR2Bucket } from "./r2-mock";

function makeContext(bucket: R2Bucket): RequestContext {
	return {
		env: {
			MCP_INTERNAL_SHARED_SECRET: "secret",
			MCP_ALLOWED_CALLER: "ore-ai",
			PRIVATE_CONTEXT_BUCKET: bucket,
		},
		userId: "user_123",
		requestId: "req_123",
		callerWorker: "ore-ai",
	};
}

describe("tool services", () => {
	it("returns markdown and metadata from R2", async () => {
		const coffeeTool = "ore.context.orel_top_coffee_shops";
		const index = {
			version: 1,
			generatedAt: "2026-02-24T00:00:00.000Z",
			managedKeys: [
				PRIVATE_CONTEXT_INDEX_KEY,
				"private-context/markdown/orel-top-coffee-shops.md",
			],
			tools: {
				[coffeeTool]: {
					contextId: "orel-top-coffee-shops",
					title: "Orel Top Coffee Shops",
					toolName: coffeeTool,
					uiHint: "coffee-shops-markdown",
					markdownKey: "private-context/markdown/orel-top-coffee-shops.md",
					imageAssetKeys: ["private-context/images/coffee-1.jpg"],
					sourceUpdatedAt: "2026-02-23T12:00:00.000Z",
				},
			},
		};

		const bucket = createMockR2Bucket({
			[PRIVATE_CONTEXT_INDEX_KEY]: JSON.stringify(index),
			"private-context/markdown/orel-top-coffee-shops.md": "# Coffee notes",
		});

		const payload = await getContextByToolName(makeContext(bucket), coffeeTool);
		expect(payload.uiHint).toBe("coffee-shops-markdown");
		expect(payload.toolName).toBe(coffeeTool);
		expect(payload.contextId).toBe("orel-top-coffee-shops");
		expect(payload.title).toBe("Orel Top Coffee Shops");
		expect(payload.markdown).toBe("# Coffee notes");
		expect(payload.imageAssetKeys).toEqual([
			"private-context/images/coffee-1.jpg",
		]);
		expect(payload.sourceUpdatedAt).toBe("2026-02-23T12:00:00.000Z");
	});

	it("fails when context index is missing", async () => {
		try {
			await getContextByToolName(
				makeContext(createMockR2Bucket({})),
				"ore.context.orel_top_coffee_shops",
			);
			expect.unreachable();
		} catch (error) {
			expect((error as AppError).code).toBe("INTERNAL_ERROR");
		}
	});

	it("fails when tool mapping is missing", async () => {
		const bucket = createMockR2Bucket({
			[PRIVATE_CONTEXT_INDEX_KEY]: JSON.stringify({
				version: 1,
				generatedAt: "2026-02-24T00:00:00.000Z",
				managedKeys: [PRIVATE_CONTEXT_INDEX_KEY],
				tools: {},
			}),
		});

		try {
			await getContextByToolName(makeContext(bucket), "ore.context.unknown");
			expect.unreachable();
		} catch (error) {
			expect((error as AppError).code).toBe("INTERNAL_ERROR");
		}
	});

	it("fails when markdown object is missing", async () => {
		const coffeeTool = "ore.context.orel_top_coffee_shops";
		const index = {
			version: 1,
			generatedAt: "2026-02-24T00:00:00.000Z",
			managedKeys: [PRIVATE_CONTEXT_INDEX_KEY],
			tools: {
				[coffeeTool]: {
					contextId: "orel-top-coffee-shops",
					title: "Orel Top Coffee Shops",
					toolName: coffeeTool,
					markdownKey: "private-context/markdown/orel-top-coffee-shops.md",
					imageAssetKeys: [],
					sourceUpdatedAt: "2026-02-23T12:00:00.000Z",
				},
			},
		};

		const bucket = createMockR2Bucket({
			[PRIVATE_CONTEXT_INDEX_KEY]: JSON.stringify(index),
		});

		try {
			await getContextByToolName(makeContext(bucket), coffeeTool);
			expect.unreachable();
		} catch (error) {
			expect((error as AppError).code).toBe("INTERNAL_ERROR");
		}
	});

	it("lists tools from index in stable name order", async () => {
		const bucket = createMockR2Bucket({
			[PRIVATE_CONTEXT_INDEX_KEY]: JSON.stringify({
				version: 1,
				generatedAt: "2026-02-24T00:00:00.000Z",
				managedKeys: [PRIVATE_CONTEXT_INDEX_KEY],
				tools: {
					"ore.context.b": {
						contextId: "b",
						title: "B",
						toolName: "ore.context.b",
						markdownKey: "private-context/markdown/b.md",
						imageAssetKeys: [],
						sourceUpdatedAt: "2026-02-23T12:00:00.000Z",
					},
					"ore.context.a": {
						contextId: "a",
						title: "A",
						toolName: "ore.context.a",
						markdownKey: "private-context/markdown/a.md",
						imageAssetKeys: [],
						sourceUpdatedAt: "2026-02-23T12:00:00.000Z",
					},
				},
			}),
			"private-context/markdown/a.md": "# A",
			"private-context/markdown/b.md": "# B",
		});

		const tools = await listContextToolEntries(makeContext(bucket));
		expect(tools.map((tool) => tool.toolName)).toEqual([
			"ore.context.a",
			"ore.context.b",
		]);
	});

	it("supports disabling specific tools by env var", () => {
		const bucket = createMockR2Bucket({});
		const context = makeContext(bucket);
		context.env.MCP_DISABLED_TOOLS = "ore.context.orel_top_coffee_shops";
		expect(
			isToolDisabled(context.env, "ore.context.orel_top_coffee_shops"),
		).toBeTrue();
		expect(isToolDisabled(context.env, "ore.some_other_tool")).toBeFalse();
	});
});
