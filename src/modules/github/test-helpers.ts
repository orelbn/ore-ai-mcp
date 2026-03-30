import { vi } from "vite-plus/test";
import { createMockKVNamespace } from "@mocks/kv-namespace";
import type { GitHubInsightsConfig, GitHubRepoApiFile, GitHubRepoApiItem } from "./types";

type RepoFetchMockInput = {
  repo?: Partial<GitHubRepoApiItem>;
  readme?: string | null;
  languages?: Record<string, number>;
  rootEntries?: GitHubRepoApiFile[];
  manifestContents?: Partial<Record<string, string | Record<string, unknown>>>;
};

const BASE_REPO: GitHubRepoApiItem = {
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
};

function toBase64(value: string | Record<string, unknown>): string {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64");
}

export function createGitHubConfig(
  overrides: Partial<GitHubInsightsConfig> = {},
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

export function mockRepoSourceFetch({
  repo = {},
  readme = null,
  languages = { TypeScript: 1000 },
  rootEntries = [],
  manifestContents = {},
}: RepoFetchMockInput = {}): typeof fetch {
  const repoItem = { ...BASE_REPO, ...repo };
  const repoPath = `/repos/example/${repoItem.name}`;
  const fetchMock = vi.fn(async (input) => {
    const url = String(input);
    if (url.endsWith(repoPath)) {
      return Response.json(repoItem);
    }
    if (url.endsWith(`${repoPath}/readme`)) {
      return readme === null
        ? new Response(null, { status: 404 })
        : Response.json({ encoding: "base64", content: toBase64(readme) });
    }
    if (url.endsWith(`${repoPath}/languages`)) {
      return Response.json(languages);
    }
    if (url.endsWith(`${repoPath}/contents`)) {
      return Response.json(rootEntries);
    }
    for (const [filePath, content] of Object.entries(manifestContents)) {
      if (content === undefined) {
        continue;
      }
      if (url.endsWith(`${repoPath}/contents/${filePath}`)) {
        return Response.json({
          encoding: "base64",
          content: toBase64(content),
        });
      }
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as unknown as typeof fetch;
  globalThis.fetch = fetchMock;
  return fetchMock;
}
