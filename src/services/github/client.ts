import { Buffer } from "node:buffer";
import { AppError } from "@/lib/errors";
import {
  DEFAULT_GITHUB_LATEST_LIMIT,
  DEFAULT_GITHUB_MAX_PAGES,
  GITHUB_API_BASE_URL,
  GITHUB_API_VERSION,
  ROOT_MANIFEST_FILES,
} from "@/modules/github/constants";
import type {
  GitHubInsightsConfig,
  GitHubReadmeApiResponse,
  GitHubRepoApiFile,
  GitHubRepoApiItem,
  GitHubRepoSource,
  ProjectListItem,
} from "@/modules/github/types";

function githubHeaders(config: GitHubInsightsConfig): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "ore-ai-mcp",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    ...(config.githubToken ? { Authorization: `Bearer ${config.githubToken}` } : {}),
  };
}

function repoPath(owner: string, repo: string, suffix = ""): string {
  return `/repos/${owner}/${repo}${suffix}`;
}

async function fetchGitHubJson<T>(
  config: GitHubInsightsConfig,
  path: string,
  optional = false,
): Promise<T | null> {
  const response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
    headers: githubHeaders(config),
  });

  if (response.status === 404 && optional) {
    return null;
  }
  if (response.status === 404) {
    throw new AppError("INVALID_INPUT", `GitHub resource not found: ${path}`, 404);
  }
  if (response.status === 403 || response.status === 429) {
    throw new AppError(
      "INTERNAL_ERROR",
      "GitHub API rate limit reached. Configure GITHUB_TOKEN to raise the limit.",
      500,
    );
  }
  if (!response.ok) {
    throw new AppError(
      "INTERNAL_ERROR",
      `GitHub API request failed with status ${response.status}`,
      500,
    );
  }

  return (await response.json()) as T;
}

function decodeContent(payload: GitHubReadmeApiResponse | null): string | null {
  if (!payload || payload.encoding !== "base64") {
    return null;
  }
  return Buffer.from(payload.content.replaceAll("\n", ""), "base64")
    .toString("utf8")
    .replaceAll("\r\n", "\n")
    .trim();
}

export function toProjectListItem(repo: GitHubRepoApiItem): ProjectListItem {
  return {
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    description: repo.description ?? "",
    homepageUrl: repo.homepage ?? "",
    primaryLanguage: repo.language ?? "",
    topics: repo.topics ?? [],
    stars: repo.stargazers_count,
    pushedAt: repo.pushed_at,
    updatedAt: repo.updated_at,
  };
}

export async function listLatestPublicRepos(
  config: GitHubInsightsConfig,
  limit = DEFAULT_GITHUB_LATEST_LIMIT,
): Promise<ProjectListItem[]> {
  const repos: GitHubRepoApiItem[] = [];

  for (let page = 1; page <= DEFAULT_GITHUB_MAX_PAGES; page++) {
    const chunk = await fetchGitHubJson<GitHubRepoApiItem[]>(
      config,
      `/users/${config.owner}/repos?sort=pushed&direction=desc&per_page=100&type=owner&page=${page}`,
    );
    if (!chunk?.length) {
      break;
    }
    repos.push(...chunk);
    if (repos.filter((repo) => !repo.fork && !repo.archived && !repo.disabled).length >= limit) {
      break;
    }
  }

  return repos
    .filter((repo) => !repo.fork && !repo.archived && !repo.disabled)
    .sort((left, right) => right.pushed_at.localeCompare(left.pushed_at))
    .slice(0, limit)
    .map(toProjectListItem);
}

export async function loadRepoSource(
  config: GitHubInsightsConfig,
  repo: string,
): Promise<GitHubRepoSource> {
  const basePath = repoPath(config.owner, repo);
  const [repoInfo, readme, languages, rootEntries] = await Promise.all([
    fetchGitHubJson<GitHubRepoApiItem>(config, basePath),
    fetchGitHubJson<GitHubReadmeApiResponse>(config, `${basePath}/readme`, true),
    fetchGitHubJson<Record<string, number>>(config, `${basePath}/languages`),
    fetchGitHubJson<GitHubRepoApiFile[]>(config, `${basePath}/contents`),
  ]);

  const manifestEntries =
    rootEntries?.filter(
      (entry) => entry.type === "file" && ROOT_MANIFEST_FILES.includes(entry.name as never),
    ) ?? [];
  const manifestPairs = await Promise.all(
    manifestEntries.map(async (entry) => {
      const content = decodeContent(
        await fetchGitHubJson<GitHubReadmeApiResponse>(
          config,
          `${basePath}/contents/${entry.path}`,
          true,
        ),
      );
      return content ? ([entry.name, content] as const) : null;
    }),
  );

  return {
    repo: repoInfo as GitHubRepoApiItem,
    readme: decodeContent(readme),
    languages: (languages ?? {}) as Record<string, number>,
    rootEntries: (rootEntries ?? []) as GitHubRepoApiFile[],
    manifestContents: Object.fromEntries(
      manifestPairs.filter((pair): pair is readonly [string, string] => pair !== null),
    ),
  };
}
