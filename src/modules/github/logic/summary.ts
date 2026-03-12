import { loadRepoSource } from "@/services/github/client";
import { createRepoInsightEnricher } from "../providers";
import {
	readProjectOverride,
	readProjectSummary,
	summaryFresh,
	writeProjectSummary,
} from "../repo/project-insights-kv";
import type { GitHubInsightsConfig, ProjectSummaryResult } from "../types";
import {
	applySummaryOverride,
	buildHeuristicArchitectureDraft,
	buildHeuristicSummaryDraft,
	computeOverrideSignature,
	requireRepoName,
	sourceUpdatedAt,
} from "./shared";

/**
 * Produces a project summary for the given repository, using a cached result when valid or generating and persisting an updated summary otherwise.
 *
 * Attempts to return a fresh cached summary that matches current overrides; if none is available, builds, enriches, applies overrides to, and stores a new summary document and returns it. The returned document includes metadata such as `overrideSignature`, `cachedAt`, `sourceUpdatedAt`, and a `stale` flag.
 *
 * @param config - Configuration for GitHub insights and storage access
 * @param repoInput - Repository identifier (name or URL) to summarize
 * @returns The project summary document for the repository
 * @throws Rethrows errors encountered while loading or enriching repository data when no cached summary is available
 */
export async function getProjectSummary(
	config: GitHubInsightsConfig,
	repoInput: string,
): Promise<ProjectSummaryResult> {
	const repo = requireRepoName(repoInput);
	const [cached, override] = await Promise.all([
		readProjectSummary(config, repo),
		readProjectOverride(config, repo),
	]);
	const overrideSignature = await computeOverrideSignature(override);
	if (
		cached &&
		summaryFresh(cached, config.cacheTtlSeconds) &&
		cached.overrideSignature === overrideSignature
	) {
		return cached;
	}

	try {
		const source = await loadRepoSource(config, repo);
		const summaryDraft = buildHeuristicSummaryDraft(source, override);
		const architectureDraft = buildHeuristicArchitectureDraft(source, override);
		const enricher = createRepoInsightEnricher(config);
		const enrichedDraft = applySummaryOverride(
			await enricher.summarize({
				source,
				evidence: summaryDraft.evidence,
				summaryDraft,
				architectureDraft,
				override,
			}),
			override,
		);
		const document: ProjectSummaryResult = {
			...enrichedDraft,
			overrideSignature,
			cachedAt: new Date().toISOString(),
			sourceUpdatedAt: sourceUpdatedAt(source),
			stale: false,
		};
		await writeProjectSummary(config, document);
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
