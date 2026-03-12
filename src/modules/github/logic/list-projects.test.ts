import { afterEach, describe, expect, it, mock } from "bun:test";
import { createMockKVNamespace } from "@mocks/kv-namespace";
import type { GitHubInsightsConfig } from "../types";
import { getLatestProjects } from "./list-projects";

const config: GitHubInsightsConfig = {
	owner: "example",
	cacheTtlSeconds: 43_200,
	provider: "heuristic",
	model: "gemini-3.1-flash-lite-preview",
	githubToken: null,
	geminiApiKey: null,
	kv: createMockKVNamespace(),
};

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("getLatestProjects", () => {
	it("filters public repos and returns the latest 5", async () => {
		globalThis.fetch = mock(async () => {
			return new Response(
				JSON.stringify([
					{
						name: "zeta",
						full_name: "example/zeta",
						html_url: "https://github.com/example/zeta",
						description: "zeta",
						homepage: null,
						language: "TypeScript",
						topics: ["worker"],
						stargazers_count: 4,
						fork: false,
						archived: false,
						disabled: false,
						pushed_at: "2026-03-10T00:00:00.000Z",
						updated_at: "2026-03-10T00:00:00.000Z",
						default_branch: "main",
					},
					{
						name: "forked",
						full_name: "example/forked",
						html_url: "https://github.com/example/forked",
						description: "fork",
						homepage: null,
						language: "TypeScript",
						topics: [],
						stargazers_count: 1,
						fork: true,
						archived: false,
						disabled: false,
						pushed_at: "2026-03-11T00:00:00.000Z",
						updated_at: "2026-03-11T00:00:00.000Z",
						default_branch: "main",
					},
					...Array.from({ length: 5 }, (_, index) => ({
						name: `repo-${index}`,
						full_name: `example/repo-${index}`,
						html_url: `https://github.com/example/repo-${index}`,
						description: `repo-${index}`,
						homepage: null,
						language: "TypeScript",
						topics: [],
						stargazers_count: index,
						fork: false,
						archived: false,
						disabled: false,
						pushed_at: `2026-03-0${index + 1}T00:00:00.000Z`,
						updated_at: `2026-03-0${index + 1}T00:00:00.000Z`,
						default_branch: "main",
					})),
				]),
			);
		}) as unknown as typeof fetch;

		const result = await getLatestProjects(config);
		expect(result.projects).toHaveLength(5);
		expect(result.projects.map((project) => project.name)).not.toContain(
			"forked",
		);
		expect(result.projects[0]?.name).toBe("zeta");
		expect(result.stale).toBeFalse();
	});

	it("returns stale cached data when GitHub fails", async () => {
		const staleConfig: GitHubInsightsConfig = {
			...config,
			kv: createMockKVNamespace({
				"github-insights/v1/owners/example/latest.json": JSON.stringify({
					owner: "example",
					projects: [
						{
							name: "cached-repo",
							fullName: "example/cached-repo",
							url: "https://github.com/example/cached-repo",
							description: "cached",
							homepageUrl: "",
							primaryLanguage: "TypeScript",
							topics: [],
							stars: 3,
							pushedAt: "2026-03-01T00:00:00.000Z",
							updatedAt: "2026-03-01T00:00:00.000Z",
						},
					],
					cachedAt: "2026-03-01T00:00:00.000Z",
					sourceUpdatedAt: "2026-03-01T00:00:00.000Z",
					stale: false,
					provider: "github",
				}),
			}),
		};

		globalThis.fetch = mock(async () => {
			return new Response("fail", { status: 500 });
		}) as unknown as typeof fetch;

		const result = await getLatestProjects(staleConfig);
		expect(result.owner).toBe("example");
		expect(result.projects).toEqual([
			expect.objectContaining({
				name: "cached-repo",
				fullName: "example/cached-repo",
			}),
		]);
		expect(result.stale).toBeTrue();
	});
});
