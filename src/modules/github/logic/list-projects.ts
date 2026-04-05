import { listLatestPublicRepos } from "@/services/github/client";
import { isFresh, readLatestProjects, writeLatestProjects } from "../repo/project-insights-kv";
import type { GitHubInsightsConfig, LatestProjectsResult } from "../types";

function sourceUpdatedAt(projects: LatestProjectsResult["projects"]): string {
  return projects[0]?.pushedAt ?? new Date().toISOString();
}

export async function getLatestProjects(
  config: GitHubInsightsConfig,
): Promise<LatestProjectsResult> {
  const cached = await readLatestProjects(config);
  if (cached && isFresh(cached.cachedAt, config.cacheTtlSeconds)) {
    return cached;
  }

  try {
    const projects = await listLatestPublicRepos(config);
    const document: LatestProjectsResult = {
      owner: config.owner,
      projects,
      cachedAt: new Date().toISOString(),
      sourceUpdatedAt: sourceUpdatedAt(projects),
      stale: false,
      provider: "github",
    };
    await writeLatestProjects(config, document);
    return document;
  } catch (error) {
    if (cached) {
      return {
        ...cached,
        stale: true,
      };
    }
    throw error;
  }
}
