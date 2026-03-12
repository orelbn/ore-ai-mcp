import { afterEach, describe, expect, it, mock } from "bun:test";
import { createMockKVNamespace } from "@mocks/kv-namespace";
import type { GitHubInsightsConfig } from "../types";
import { getProjectArchitecture } from "./architecture";

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

describe("getProjectArchitecture", () => {
	it("builds a heuristic architecture with a mermaid diagram", async () => {
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
					topics: ["worker"],
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
				return Response.json({ TypeScript: 1000 });
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

		const result = await getProjectArchitecture(createConfig(), "repo-one");
		expect(result.provider).toBe("heuristic");
		expect(result.components).toEqual([
			{
				name: "Cloudflare Worker",
				responsibility:
					"Handles the deployed edge runtime and request processing.",
			},
			{
				name: "Backend API",
				responsibility:
					"Implements application logic and server-side endpoints.",
			},
		]);
		expect(result.designDecisions).toEqual([
			{
				title: "Edge-first deployment",
				rationale:
					"Cloudflare configuration files indicate the project is designed to run at the edge.",
			},
			{
				title: "README-driven onboarding",
				rationale:
					"The repository includes project-facing documentation that shapes contributor or operator workflows.",
			},
		]);
		expect(result.diagramMermaid).toBe(
			[
				"flowchart LR",
				'  Client["Client"] --> C1["Cloudflare Worker"]',
				'  C1["Cloudflare Worker"] --> C2["Backend API"]',
			].join("\n"),
		);
	});

	it("supports overrides with an empty component list", async () => {
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
					description: "A Cloudflare Worker app",
					homepage: null,
					language: "TypeScript",
					topics: ["worker"],
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

		const result = await getProjectArchitecture(config, "repo-one");
		expect(result.components).toEqual([]);
		expect(result.diagramMermaid).toBe('flowchart LR\n  Client["Client"]');
	});

	it("regenerates a valid mermaid diagram for overridden components", async () => {
		const config = createConfig({
			kv: createMockKVNamespace({
				"github-insights/v1/overrides/repo-one.json": JSON.stringify({
					repo: "repo-one",
					components: [
						{
							name: 'API "Gateway"\nLayer',
							responsibility: "Routes inbound requests.",
						},
						{
							name: "Worker \\ Runtime",
							responsibility: "Executes edge handlers.",
						},
					],
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
					description: "A Cloudflare Worker app",
					homepage: null,
					language: "TypeScript",
					topics: ["worker"],
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

		const result = await getProjectArchitecture(config, "repo-one");
		expect(result.components).toEqual([
			{
				name: 'API "Gateway"\nLayer',
				responsibility: "Routes inbound requests.",
			},
			{
				name: "Worker \\ Runtime",
				responsibility: "Executes edge handlers.",
			},
		]);
		expect(result.diagramMermaid).toBe(
			[
				"flowchart LR",
				'  Client["Client"] --> C1["API \\"Gateway\\" Layer"]',
				'  C1["API \\"Gateway\\" Layer"] --> C2["Worker \\\\ Runtime"]',
			].join("\n"),
		);
	});

	it("rejects malformed owner repo paths", async () => {
		await expect(
			getProjectArchitecture(createConfig(), "example/repo-one/extra"),
		).rejects.toEqual(
			expect.objectContaining({
				code: "INVALID_INPUT",
				message: "repo must be a repository name or <owner>/<repo>",
			}),
		);
	});
});
