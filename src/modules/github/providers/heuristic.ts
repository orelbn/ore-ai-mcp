import type { RepoInsightEnricher, RepoInsightPromptInput } from "../types";

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
