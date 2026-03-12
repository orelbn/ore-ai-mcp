import type { RepoInsightEnricher, RepoInsightPromptInput } from "../types";

/**
 * Creates a RepoInsightEnricher that marks outputs as coming from the "heuristic" provider.
 *
 * The enricher's summarize and describeArchitecture methods produce results by using the
 * provided draft objects and setting their `provider` field to `"heuristic"`.
 *
 * @returns A RepoInsightEnricher whose `provider` is `"heuristic"` and whose methods return
 * the corresponding draft objects augmented with `provider: "heuristic"`.
 */
export function createHeuristicEnricher(): RepoInsightEnricher {
	return {
		provider: "heuristic",
		async summarize(input: RepoInsightPromptInput) {
			return {
				...input.summaryDraft,
				provider: "heuristic",
			};
		},
		async describeArchitecture(input: RepoInsightPromptInput) {
			return {
				...input.architectureDraft,
				provider: "heuristic",
			};
		},
	};
}
