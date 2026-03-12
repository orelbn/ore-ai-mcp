import { listLatestPublicRepos } from "@/services/github/client";
import {
	latestProjectsFresh,
	readLatestProjects,
	writeLatestProjects,
} from "../repo/project-insights-kv";
import type { GitHubInsightsConfig, LatestProjectsResult } from "../types";

/**
 * Determine the source update timestamp from a list of projects.
 *
 * @param projects - Array of project entries; uses the first item's `pushedAt` as the source update time.
 * @returns The ISO 8601 timestamp from the first project's `pushedAt`, or the current time if unavailable.
 */
function sourceUpdatedAt(projects: LatestProjectsResult["projects"]): string {
	return projects[0]?.pushedAt ?? new Date().toISOString();
}

/**
 * Retrieve the latest public GitHub repositories for the configured owner, using cached data when fresh.
 *
 * @param config - Configuration including the target owner and cache TTL
 * @returns A LatestProjectsResult document containing the owner, projects, cache timestamp, source update timestamp, stale flag, and provider
 * @throws If fetching fresh data fails and no cached document is available, the error is rethrown
 */
export async function getLatestProjects(
	config: GitHubInsightsConfig,
): Promise<LatestProjectsResult> {
	const cached = await readLatestProjects(config);
	if (cached && latestProjectsFresh(cached, config.cacheTtlSeconds)) {
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
