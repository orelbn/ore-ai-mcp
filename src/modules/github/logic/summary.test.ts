import { afterEach, describe, expect, it } from "vite-plus/test";
import { createMockKVNamespace } from "@mocks/kv-namespace";
import { createGitHubConfig, mockRepoSourceFetch } from "../test-helpers";
import { getProjectSummary } from "./summary";

const originalFetch = globalThis.fetch;
const repo = "repo-one";

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function configWithKv(entries: Record<string, unknown> = {}) {
  return createGitHubConfig({
    kv: createMockKVNamespace(
      Object.fromEntries(
        Object.entries(entries).map(([key, value]) => [key, JSON.stringify(value)]),
      ),
    ),
  });
}

async function loadSummary(entries?: Record<string, unknown>) {
  mockRepoSourceFetch({
    repo: {
      description: "A Cloudflare Worker app",
      topics: ["worker", "mcp"],
      stargazers_count: 12,
    },
    readme: "# Repo One\n\nAn edge application built with Hono and Cloudflare Workers.",
    languages: { TypeScript: 1000, HTML: 100 },
    rootEntries: [
      { name: "package.json", path: "package.json", type: "file" as const },
      { name: "wrangler.jsonc", path: "wrangler.jsonc", type: "file" as const },
      { name: "src", path: "src", type: "dir" as const },
    ],
    manifestContents: {
      "package.json": {
        dependencies: { hono: "^4.0.0", zod: "^3.0.0" },
      },
      "wrangler.jsonc": '{"name":"repo-one"}',
    },
  });
  return getProjectSummary(configWithKv(entries), repo);
}

describe("getProjectSummary", () => {
  it("builds a heuristic summary from GitHub evidence", async () => {
    const result = await loadSummary();
    expect(result).toEqual(
      expect.objectContaining({
        provider: "heuristic",
        stale: false,
      }),
    );
    expect(result.summary).toContain("Cloudflare Worker");
    expect(result.technologies).toEqual(expect.arrayContaining(["Cloudflare Workers", "Hono"]));
  });

  it("applies manual overrides and invalidates stale cache state", async () => {
    const result = await loadSummary({
      [`github-insights/v1/owners/example/repos/${repo}/summary.json`]: {
        repo,
        name: repo,
        summary: "Old cached summary",
        technologies: ["TypeScript"],
        evidence: [],
        provider: "heuristic",
        overrideSignature: null,
        cachedAt: "2099-03-10T00:00:00.000Z",
        sourceUpdatedAt: "2026-03-10T00:00:00.000Z",
        stale: false,
      },
      [`github-insights/v1/overrides/${repo}.json`]: {
        repo,
        components: [],
        summary: "Fresh override summary",
        technologies: ["TypeScript", "Cloudflare Workers"],
      },
    });
    expect(result.summary).toBe("Fresh override summary");
    expect(result.technologies).toEqual(["TypeScript", "Cloudflare Workers"]);
    expect(result.overrideSignature).not.toBeNull();
  });
});
