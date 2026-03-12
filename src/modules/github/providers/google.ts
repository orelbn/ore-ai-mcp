import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { googleArchitectureSchema, googleSummarySchema } from "../schema";
import type {
	GitHubInsightsConfig,
	GoogleArchitectureResult,
	GoogleSummaryResult,
	RepoInsightEnricher,
	RepoInsightPromptInput,
} from "../types";

/**
 * Builds a grounded multi-line prompt for a generative model using the repository evidence and draft data.
 *
 * @param input - RepoInsightPromptInput containing repository metadata, README excerpt, language/manifest/root-entry lists, heuristic drafts, and any manual overrides used to populate the prompt
 * @returns A single string with newline-separated lines describing the repository (name, description, topics, languages, root entries, manifest files), a README excerpt, heuristic summary and architecture drafts, and manual override data
 */
function buildPrompt(input: RepoInsightPromptInput): string {
	return [
		"You are generating repository insights from public GitHub evidence.",
		"Stay grounded in the provided evidence only.",
		"Do not invent private systems or unsupported technologies.",
		"",
		`Repository: ${input.source.repo.full_name}`,
		`Description: ${input.source.repo.description ?? "n/a"}`,
		`Topics: ${(input.source.repo.topics ?? []).join(", ") || "n/a"}`,
		`Languages: ${Object.keys(input.source.languages).join(", ") || "n/a"}`,
		`Root entries: ${input.source.rootEntries.map((entry) => `${entry.type}:${entry.name}`).join(", ") || "n/a"}`,
		`Manifest files: ${Object.keys(input.source.manifestContents).join(", ") || "n/a"}`,
		`README excerpt: ${(input.source.readme ?? "").slice(0, 4000) || "n/a"}`,
		`Heuristic summary draft: ${JSON.stringify(input.summaryDraft)}`,
		`Heuristic architecture draft: ${JSON.stringify(input.architectureDraft)}`,
		`Manual override: ${JSON.stringify(input.override)}`,
	].join("\n");
}

/**
 * Creates a repository insight enricher that uses Google Gemini to generate summaries and architecture descriptions, or returns `null` if no Gemini API key is provided.
 *
 * @param config - Configuration including `geminiApiKey` and model identifier used for generation
 * @returns A `RepoInsightEnricher` that enriches repo summaries and architecture drafts with Gemini-generated content, or `null` when `config.geminiApiKey` is not present
 */
export function createGoogleEnricher(
	config: GitHubInsightsConfig,
): RepoInsightEnricher | null {
	if (!config.geminiApiKey) {
		return null;
	}

	const google = createGoogleGenerativeAI({
		apiKey: config.geminiApiKey,
	});

	async function summarize(
		input: RepoInsightPromptInput,
	): Promise<GoogleSummaryResult> {
		const { object } = await generateObject({
			model: google(config.model),
			schema: googleSummarySchema,
			prompt: `${buildPrompt(input)}\n\nReturn a concise project summary and the main technologies used.`,
		});
		return object;
	}

	async function describeArchitecture(
		input: RepoInsightPromptInput,
	): Promise<GoogleArchitectureResult> {
		const { object } = await generateObject({
			model: google(config.model),
			schema: googleArchitectureSchema,
			prompt: `${buildPrompt(input)}\n\nReturn a high-level architecture overview, a few major components, key design decisions, and a valid Mermaid flowchart.`,
		});
		return object;
	}

	return {
		provider: "google",
		async summarize(input) {
			const result = await summarize(input);
			return {
				...input.summaryDraft,
				summary: result.summary,
				technologies: result.technologies,
				evidence: [
					...input.summaryDraft.evidence,
					{
						type: "model",
						label: "Gemini enrichment",
						detail: `Generated with ${config.model}`,
					},
				],
				provider: "google",
			};
		},
		async describeArchitecture(input) {
			const result = await describeArchitecture(input);
			return {
				...input.architectureDraft,
				overview: result.overview,
				components: result.components,
				designDecisions: result.designDecisions,
				diagramMermaid: result.diagramMermaid,
				evidence: [
					...input.architectureDraft.evidence,
					{
						type: "model",
						label: "Gemini enrichment",
						detail: `Generated with ${config.model}`,
					},
				],
				provider: "google",
			};
		},
	};
}
