import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createMockKVNamespace } from "@mocks/kv-namespace";
import type { GitHubInsightsConfig } from "../types";
import { getLatestProjects } from "./list-projects";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createConfig(overrides: Partial<GitHubInsightsConfig> = {}): GitHubInsightsConfig {
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

function repo(name: string, pushedAt: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name,
    full_name: `example/${name}`,
    html_url: `https://github.com/example/${name}`,
    description: name,
    homepage: null,
    language: "TypeScript",
    topics: [],
    stargazers_count: 1,
    fork: false,
    archived: false,
    disabled: false,
    pushed_at: pushedAt,
    updated_at: pushedAt,
    default_branch: "main",
    ...overrides,
  };
}

describe("getLatestProjects", () => {
  it("filters public repos and returns the latest 5", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            repo("zeta", "2026-03-10T00:00:00.000Z", {
              topics: ["worker"],
              stargazers_count: 4,
            }),
            repo("forked", "2026-03-11T00:00:00.000Z", { fork: true }),
            ...Array.from({ length: 5 }, (_, index) =>
              repo(`repo-${index}`, `2026-03-0${index + 1}T00:00:00.000Z`, {
                stargazers_count: index,
              }),
            ),
          ]),
        ),
    ) as unknown as typeof fetch;

    const result = await getLatestProjects(createConfig());
    expect(result.projects).toHaveLength(5);
    expect(result.projects.map((project) => project.name)).not.toContain("forked");
    expect(result.projects[0]?.name).toBe("zeta");
    expect(result.stale).toBe(false);
  });

  it("returns stale cached data when GitHub fails", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("fail", { status: 500 }),
    ) as unknown as typeof fetch;

    const result = await getLatestProjects(
      createConfig({
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
      }),
    );

    expect(result.projects).toEqual([
      expect.objectContaining({
        name: "cached-repo",
        fullName: "example/cached-repo",
      }),
    ]);
    expect(result.stale).toBe(true);
  });
});
