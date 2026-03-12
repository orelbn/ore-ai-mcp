import type { GitHubInsightsConfig, RepoInsightEnricher } from "../types";
import { createGoogleEnricher } from "./google";
import { createHeuristicEnricher } from "./heuristic";

export function createRepoInsightEnricher(
	config: GitHubInsightsConfig,
): RepoInsightEnricher {
	if (config.provider === "google") {
		const google = createGoogleEnricher(config);
		if (google) {
			return google;
		}
	}
	return createHeuristicEnricher();
}
