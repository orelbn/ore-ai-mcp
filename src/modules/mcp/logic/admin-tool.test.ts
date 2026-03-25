import { describe, expect, it } from "bun:test";
import { createMockR2Bucket } from "@mocks/r2-bucket";
import { AppError } from "@/lib/errors";
import type { RequestContext } from "@/lib/worker";
import {
	CONTEXT_INDEX_KEY,
	CONTEXT_SERVER_CONFIG_KEY,
	getContextToolInventory,
} from "@/modules/context";
import { MCP_SERVER_ADMIN_TOOL } from "../constants";
import { handleAdminTool } from "./admin-tool";
import { createOreMcpServer } from "./create-server";

function makeContext(bucket: R2Bucket, disabledTools?: string): RequestContext {
	return {
		env: {
			MCP_INTERNAL_SHARED_SECRET: "secret",
			MCP_ALLOWED_CALLER: "ore-ai",
			MCP_DISABLED_TOOLS: disabledTools,
			CONTEXT_BUCKET: bucket,
		},
		userId: "user_123",
		requestId: "req_123",
		callerWorker: "ore-ai",
	};
}

function createBucketWithTools(): R2Bucket {
	return createMockR2Bucket({
		[CONTEXT_INDEX_KEY]: JSON.stringify({
			version: 1,
			generatedAt: "2026-03-24T00:00:00.000Z",
			managedKeys: [
				CONTEXT_INDEX_KEY,
				"context/markdown/design-doc.md",
				"context/markdown/triage.md",
			],
			tools: {
				"ore.context.design_doc_to_issues": {
					contextId: "design-doc-to-issues",
					title: "Design Doc To Issues",
					toolName: "ore.context.design_doc_to_issues",
					description:
						"Break approved design docs into execution-ready issues.",
					markdownKey: "context/markdown/design-doc.md",
					imageAssetKeys: [],
					sourceUpdatedAt: "2026-03-24T00:00:00.000Z",
				},
				"ore.context.issue_triage": {
					contextId: "issue-triage",
					title: "Issue Triage",
					toolName: "ore.context.issue_triage",
					markdownKey: "context/markdown/triage.md",
					imageAssetKeys: ["context/images/triage.png"],
					sourceUpdatedAt: "2026-03-23T12:00:00.000Z",
				},
			},
		}),
		[CONTEXT_SERVER_CONFIG_KEY]: JSON.stringify({
			version: 1,
			updatedAt: "2026-03-24T00:30:00.000Z",
			disabledTools: ["ore.context.issue_triage"],
		}),
		"context/markdown/design-doc.md": "# Design doc",
		"context/markdown/triage.md": "# Triage",
	});
}

describe("admin tool", () => {
	it("returns server status and merged disabled-tool state", async () => {
		const result = await handleAdminTool(
			makeContext(
				createBucketWithTools(),
				"ore.context.design_doc_to_issues, ore.context.issue_triage",
			),
			{ action: "status" },
		);

		expect(result.isError).toBeUndefined();
		expect(result.structuredContent).toMatchObject({
			ok: true,
			action: "status",
			server: {
				adminToolName: MCP_SERVER_ADMIN_TOOL,
			},
			context: {
				toolCount: 2,
				managedKeyCount: 3,
			},
			disabledTools: {
				env: ["ore.context.design_doc_to_issues", "ore.context.issue_triage"],
				config: ["ore.context.issue_triage"],
				combined: [
					"ore.context.design_doc_to_issues",
					"ore.context.issue_triage",
				],
			},
		});
	});

	it("lists both the internal admin tool and context tools", async () => {
		const result = await handleAdminTool(makeContext(createBucketWithTools()), {
			action: "list-tools",
		});

		const structuredContent = result.structuredContent as {
			tools: Array<{ toolName: string; kind: string; isDisabled: boolean }>;
		};

		expect(structuredContent.tools).toHaveLength(3);
		expect(structuredContent.tools[0]).toMatchObject({
			toolName: MCP_SERVER_ADMIN_TOOL,
			kind: "internal",
			isDisabled: false,
		});
		expect(structuredContent.tools[2]).toMatchObject({
			toolName: "ore.context.issue_triage",
			kind: "context",
			isDisabled: true,
		});
	});

	it("persists runtime disable overrides and can clear them", async () => {
		const bucket = createBucketWithTools();
		const context = makeContext(bucket);

		const disableResult = await handleAdminTool(context, {
			action: "disable-tools",
			toolNames: ["ore.context.design_doc_to_issues"],
		});
		expect(disableResult.structuredContent).toMatchObject({
			ok: true,
			action: "disable-tools",
			changedToolNames: ["ore.context.design_doc_to_issues"],
			disabledTools: {
				config: [
					"ore.context.design_doc_to_issues",
					"ore.context.issue_triage",
				],
			},
		});

		const inventoryAfterDisable = await getContextToolInventory(context);
		expect(inventoryAfterDisable.disabledTools.config).toEqual([
			"ore.context.design_doc_to_issues",
			"ore.context.issue_triage",
		]);

		const clearResult = await handleAdminTool(context, {
			action: "clear-overrides",
		});
		expect(clearResult.structuredContent).toMatchObject({
			ok: true,
			action: "clear-overrides",
			clearedToolNames: [
				"ore.context.design_doc_to_issues",
				"ore.context.issue_triage",
			],
			disabledTools: {
				config: [],
			},
		});

		const savedConfigObject = await bucket.get(CONTEXT_SERVER_CONFIG_KEY);
		expect(savedConfigObject).not.toBeNull();
		if (!savedConfigObject) {
			throw new Error("Expected saved config object to exist");
		}
		expect(JSON.parse(await savedConfigObject.text())).toMatchObject({
			disabledTools: [],
		});
	});

	it("rejects unknown tool names when mutating overrides", async () => {
		try {
			await handleAdminTool(makeContext(createBucketWithTools()), {
				action: "disable-tools",
				toolNames: ["ore.context.unknown"],
			});
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(AppError);
			expect((error as AppError).code).toBe("INVALID_INPUT");
		}
	});

	it("registers the admin tool and excludes disabled context tools from the live server", async () => {
		const server = await createOreMcpServer(
			makeContext(createBucketWithTools()),
		);
		const registeredTools = (
			server as unknown as {
				_registeredTools: Record<string, unknown>;
			}
		)._registeredTools;

		expect(Object.keys(registeredTools).sort()).toEqual([
			"ore.context.design_doc_to_issues",
			MCP_SERVER_ADMIN_TOOL,
		]);
	});
});
