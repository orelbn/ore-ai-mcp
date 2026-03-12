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
