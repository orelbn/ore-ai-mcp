import { loadRepoSource } from "@/services/github/client";
import { createRepoInsightEnricher } from "../providers";
import {
	architectureFresh,
	readProjectArchitecture,
	readProjectOverride,
	writeProjectArchitecture,
} from "../repo/project-insights-kv";
import type { GitHubInsightsConfig, ProjectArchitectureResult } from "../types";
import {
	applyArchitectureOverride,
	buildHeuristicArchitectureDraft,
	buildHeuristicSummaryDraft,
	computeOverrideSignature,
	requireRepoName,
	sourceUpdatedAt,
} from "./shared";

/**
 * Retrieve the project architecture for a repository, preferring a fresh cached result and otherwise deriving, enriching, applying overrides, and persisting a new result.
 *
 * If an error occurs while deriving a fresh result and a cached document exists, returns the cached document with `stale: true`; otherwise the error is rethrown.
 *
 * @param config - Configuration and clients used to read/write cache, overrides, and to enrich the architecture
 * @param repoInput - Repository identifier (e.g., "owner/name" or a repository URL)
 * @returns The resolved ProjectArchitectureResult including architecture data, `overrideSignature`, `cachedAt` (ISO timestamp), `sourceUpdatedAt`, and a `stale` flag indicating whether the result is stale
 */
export async function getProjectArchitecture(
	config: GitHubInsightsConfig,
	repoInput: string,
): Promise<ProjectArchitectureResult> {
	const repo = requireRepoName(repoInput);
	const [cached, override] = await Promise.all([
		readProjectArchitecture(config, repo),
		readProjectOverride(config, repo),
	]);
	const overrideSignature = await computeOverrideSignature(override);
	if (
		cached &&
		architectureFresh(cached, config.cacheTtlSeconds) &&
		cached.overrideSignature === overrideSignature
	) {
		return cached;
	}

	try {
		const source = await loadRepoSource(config, repo);
		const summaryDraft = buildHeuristicSummaryDraft(source, override);
		const architectureDraft = buildHeuristicArchitectureDraft(source, override);
		const enricher = createRepoInsightEnricher(config);
		const enrichedDraft = applyArchitectureOverride(
			await enricher.describeArchitecture({
				source,
				evidence: architectureDraft.evidence,
				summaryDraft,
				architectureDraft,
				override,
			}),
			override,
		);
		const document: ProjectArchitectureResult = {
			...enrichedDraft,
			overrideSignature,
			cachedAt: new Date().toISOString(),
			sourceUpdatedAt: sourceUpdatedAt(source),
			stale: false,
		};
		await writeProjectArchitecture(config, document);
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
