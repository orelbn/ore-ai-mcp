import { afterEach, describe, expect, it } from "vite-plus/test";
import { createMockKVNamespace } from "@mocks/kv-namespace";
import { createGitHubConfig, mockRepoSourceFetch } from "../test-helpers";
import { getProjectArchitecture } from "./architecture";

const originalFetch = globalThis.fetch;
const repo = "repo-one";

const workerSource = {
  repo: {
    description: "A Cloudflare Worker app",
    topics: ["worker"],
    stargazers_count: 12,
  },
  readme: "# Repo One\n\nAn edge application built with Hono and Cloudflare Workers.",
  rootEntries: [
    { name: "package.json", path: "package.json", type: "file" as const },
    { name: "wrangler.jsonc", path: "wrangler.jsonc", type: "file" as const },
    { name: "src", path: "src", type: "dir" as const },
  ],
  manifestContents: {
    "package.json": { dependencies: { hono: "^4.0.0" } },
    "wrangler.jsonc": '{"name":"repo-one"}',
  },
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function configWithOverride(override?: Record<string, unknown>) {
  return createGitHubConfig({
    kv: createMockKVNamespace(
      override
        ? {
            [`github-insights/v1/overrides/${repo}.json`]: JSON.stringify({
              repo,
              ...override,
            }),
          }
        : {},
    ),
  });
}

async function loadArchitecture(options?: {
  source?: Parameters<typeof mockRepoSourceFetch>[0];
  override?: Record<string, unknown>;
}) {
  mockRepoSourceFetch(options?.source ?? workerSource);
  return getProjectArchitecture(configWithOverride(options?.override), repo);
}

describe("getProjectArchitecture", () => {
  it("builds a heuristic architecture with a mermaid diagram", async () => {
    const result = await loadArchitecture();
    expect(result.provider).toBe("heuristic");
    expect(result.components).toEqual([
      {
        name: "Cloudflare Worker",
        responsibility: "Handles the deployed edge runtime and request processing.",
      },
      {
        name: "Backend API",
        responsibility: "Implements application logic and server-side endpoints.",
      },
    ]);
    expect(result.designDecisions.map((decision) => decision.title)).toEqual([
      "Edge-first deployment",
      "README-driven onboarding",
    ]);
    expect(result.diagramMermaid).toBe(
      [
        "flowchart LR",
        '  Client["Client"] --> C1["Cloudflare Worker"]',
        '  C1["Cloudflare Worker"] --> C2["Backend API"]',
      ].join("\n"),
    );
  });

  it("supports empty and regenerated override diagrams", async () => {
    const empty = await loadArchitecture({ override: { components: [] } });
    expect(empty.components).toEqual([]);
    expect(empty.diagramMermaid).toBe('flowchart LR\n  Client["Client"]');

    const custom = await loadArchitecture({
      override: {
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
      },
    });
    expect(custom.diagramMermaid).toBe(
      [
        "flowchart LR",
        '  Client["Client"] --> C1["API \\"Gateway\\" Layer"]',
        '  C1["API \\"Gateway\\" Layer"] --> C2["Worker \\\\ Runtime"]',
      ].join("\n"),
    );
  });

  it("classifies Astro apps as frontend applications", async () => {
    const result = await loadArchitecture({
      source: {
        repo: {
          description: "An Astro site",
          topics: ["astro"],
          stargazers_count: 12,
        },
        languages: { TypeScript: 1000, HTML: 400 },
        rootEntries: [
          { name: "package.json", path: "package.json", type: "file" as const },
          { name: "src", path: "src", type: "dir" as const },
        ],
        manifestContents: {
          "package.json": {
            dependencies: { astro: "^5.0.0" },
          },
        },
      },
    });
    expect(result.components).toEqual([
      {
        name: "Frontend application",
        responsibility: "Provides the user-facing interface.",
      },
    ]);
  });

  it("rejects malformed owner repo paths", async () => {
    await expect(
      getProjectArchitecture(createGitHubConfig(), "example/repo-one/extra"),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "INVALID_INPUT",
        message: "repo must be a repository name or <owner>/<repo>",
      }),
    );
  });
});
