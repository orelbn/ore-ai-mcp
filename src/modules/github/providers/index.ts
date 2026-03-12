import type { GitHubInsightsConfig, RepoInsightEnricher } from "../types";
import { createGoogleEnricher } from "./google";
import { createHeuristicEnricher } from "./heuristic";

/**
 * Selects and returns a RepoInsightEnricher implementation based on the provided configuration.
 *
 * If `config.provider` is `"google"` and a Google-based enricher can be created, that enricher is returned.
 * Otherwise a heuristic enricher is returned as a fallback.
 *
 * @param config - Configuration that determines which enricher to create (e.g., the `provider` field)
 * @returns A `RepoInsightEnricher`: a Google-based enricher when available for the given config, otherwise a heuristic enricher
 */
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
