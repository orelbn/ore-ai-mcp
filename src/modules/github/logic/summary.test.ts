import { afterEach, describe, expect, it, mock } from "bun:test";
import { createMockKVNamespace } from "@mocks/kv-namespace";
import type { GitHubInsightsConfig } from "../types";
import { getProjectSummary } from "./summary";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function createConfig(
	overrides?: Partial<GitHubInsightsConfig>,
): GitHubInsightsConfig {
	return {
		owner: "example",
		cacheTtlSeconds: 43_200,
		provider: "heuristic",
		model: "gemini-3.1-flash-lite-preview",
		githubToken: null,
		geminiApiKey: null,
		kv: createMockKVNamespace(),
		...overrides,
	};
}

describe("getProjectSummary", () => {
	it("builds a heuristic summary from GitHub evidence", async () => {
		globalThis.fetch = mock(async (input) => {
			const url = String(input);
			if (url.endsWith("/repos/example/repo-one")) {
				return Response.json({
					name: "repo-one",
					full_name: "example/repo-one",
					html_url: "https://github.com/example/repo-one",
					description: "A Cloudflare Worker app",
					homepage: null,
					language: "TypeScript",
					topics: ["worker", "mcp"],
					stargazers_count: 12,
					fork: false,
					archived: false,
					disabled: false,
					pushed_at: "2026-03-10T00:00:00.000Z",
					updated_at: "2026-03-10T00:00:00.000Z",
					default_branch: "main",
				});
			}
			if (url.endsWith("/repos/example/repo-one/readme")) {
				return Response.json({
					encoding: "base64",
					content: Buffer.from(
						"# Repo One\n\nAn edge application built with Hono and Cloudflare Workers.",
					).toString("base64"),
				});
			}
			if (url.endsWith("/repos/example/repo-one/languages")) {
				return Response.json({ TypeScript: 1000, HTML: 100 });
			}
			if (url.endsWith("/repos/example/repo-one/contents")) {
				return Response.json([
					{ name: "package.json", path: "package.json", type: "file" },
					{ name: "wrangler.jsonc", path: "wrangler.jsonc", type: "file" },
					{ name: "src", path: "src", type: "dir" },
				]);
			}
			if (url.endsWith("/repos/example/repo-one/contents/package.json")) {
				return Response.json({
					encoding: "base64",
					content: Buffer.from(
						JSON.stringify({
							dependencies: {
								hono: "^4.0.0",
								zod: "^3.0.0",
							},
						}),
					).toString("base64"),
				});
			}
			if (url.endsWith("/repos/example/repo-one/contents/wrangler.jsonc")) {
				return Response.json({
					encoding: "base64",
					content: Buffer.from('{"name":"repo-one"}').toString("base64"),
				});
			}
			throw new Error(`Unexpected fetch URL: ${url}`);
		}) as unknown as typeof fetch;

		const result = await getProjectSummary(createConfig(), "repo-one");
		expect(result.provider).toBe("heuristic");
		expect(result.summary).toContain("Cloudflare Worker");
		expect(result.technologies).toContain("Cloudflare Workers");
		expect(result.technologies).toContain("Hono");
		expect(result.stale).toBeFalse();
	});

	it("applies manual overrides from KV", async () => {
		const config = createConfig({
			kv: createMockKVNamespace({
				"github-insights/v1/overrides/repo-one.json": JSON.stringify({
					repo: "repo-one",
					summary: "Hand-curated summary",
					technologies: ["TypeScript", "Cloudflare Workers"],
				}),
			}),
		});

		globalThis.fetch = mock(async (input) => {
			const url = String(input);
			if (url.endsWith("/repos/example/repo-one")) {
				return Response.json({
					name: "repo-one",
					full_name: "example/repo-one",
					html_url: "https://github.com/example/repo-one",
					description: "A project",
					homepage: null,
					language: "TypeScript",
					topics: [],
					stargazers_count: 0,
					fork: false,
					archived: false,
					disabled: false,
					pushed_at: "2026-03-10T00:00:00.000Z",
					updated_at: "2026-03-10T00:00:00.000Z",
					default_branch: "main",
				});
			}
			if (url.endsWith("/repos/example/repo-one/readme")) {
				return new Response(null, { status: 404 });
			}
			if (url.endsWith("/repos/example/repo-one/languages")) {
				return Response.json({ TypeScript: 1000 });
			}
			if (url.endsWith("/repos/example/repo-one/contents")) {
				return Response.json([]);
			}
			throw new Error(`Unexpected fetch URL: ${url}`);
		}) as unknown as typeof fetch;

		const result = await getProjectSummary(config, "repo-one");
		expect(result.summary).toBe("Hand-curated summary");
		expect(result.technologies).toEqual(["TypeScript", "Cloudflare Workers"]);
	});

	it("rebuilds a fresh cached summary when override state changes", async () => {
		const config = createConfig({
			kv: createMockKVNamespace({
				"github-insights/v1/owners/example/repos/repo-one/summary.json":
					JSON.stringify({
						repo: "repo-one",
						name: "repo-one",
						summary: "Old cached summary",
						technologies: ["TypeScript"],
						evidence: [],
						provider: "heuristic",
						overrideSignature: null,
						cachedAt: "2099-03-10T00:00:00.000Z",
						sourceUpdatedAt: "2026-03-10T00:00:00.000Z",
						stale: false,
					}),
				"github-insights/v1/overrides/repo-one.json": JSON.stringify({
					repo: "repo-one",
					summary: "Fresh override summary",
				}),
			}),
		});

		globalThis.fetch = mock(async (input) => {
			const url = String(input);
			if (url.endsWith("/repos/example/repo-one")) {
				return Response.json({
					name: "repo-one",
					full_name: "example/repo-one",
					html_url: "https://github.com/example/repo-one",
					description: "A project",
					homepage: null,
					language: "TypeScript",
					topics: [],
					stargazers_count: 0,
					fork: false,
					archived: false,
					disabled: false,
					pushed_at: "2026-03-10T00:00:00.000Z",
					updated_at: "2026-03-10T00:00:00.000Z",
					default_branch: "main",
				});
			}
			if (url.endsWith("/repos/example/repo-one/readme")) {
				return new Response(null, { status: 404 });
			}
			if (url.endsWith("/repos/example/repo-one/languages")) {
				return Response.json({ TypeScript: 1000 });
			}
			if (url.endsWith("/repos/example/repo-one/contents")) {
				return Response.json([]);
			}
			throw new Error(`Unexpected fetch URL: ${url}`);
		}) as unknown as typeof fetch;

		const result = await getProjectSummary(config, "repo-one");
		expect(result.summary).toBe("Fresh override summary");
		expect(result.overrideSignature).not.toBeNull();
	});

	it("does not crash when override clears architecture components", async () => {
		const config = createConfig({
			kv: createMockKVNamespace({
				"github-insights/v1/overrides/repo-one.json": JSON.stringify({
					repo: "repo-one",
					components: [],
				}),
			}),
		});

		globalThis.fetch = mock(async (input) => {
			const url = String(input);
			if (url.endsWith("/repos/example/repo-one")) {
				return Response.json({
					name: "repo-one",
					full_name: "example/repo-one",
					html_url: "https://github.com/example/repo-one",
					description: "A project",
					homepage: null,
					language: "TypeScript",
					topics: [],
					stargazers_count: 0,
					fork: false,
					archived: false,
					disabled: false,
					pushed_at: "2026-03-10T00:00:00.000Z",
					updated_at: "2026-03-10T00:00:00.000Z",
					default_branch: "main",
				});
			}
			if (url.endsWith("/repos/example/repo-one/readme")) {
				return new Response(null, { status: 404 });
			}
			if (url.endsWith("/repos/example/repo-one/languages")) {
				return Response.json({ TypeScript: 1000 });
			}
			if (url.endsWith("/repos/example/repo-one/contents")) {
				return Response.json([]);
			}
			throw new Error(`Unexpected fetch URL: ${url}`);
		}) as unknown as typeof fetch;

		const result = await getProjectSummary(config, "repo-one");
		expect(result.summary.length).toBeGreaterThan(0);
	});
});
