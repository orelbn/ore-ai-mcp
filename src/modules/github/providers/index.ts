import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { googleArchitectureSchema, googleSummarySchema } from "../schema";
import type { GitHubInsightsConfig, RepoInsightEnricher, RepoInsightPromptInput } from "../types";

const HEURISTIC_ENRICHER: RepoInsightEnricher = {
  provider: "heuristic",
  async summarize(input) {
    return { ...input.summaryDraft, provider: "heuristic" };
  },
  async describeArchitecture(input) {
    return { ...input.architectureDraft, provider: "heuristic" };
  },
};

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

export function createRepoInsightEnricher(config: GitHubInsightsConfig): RepoInsightEnricher {
  if (!config.geminiApiKey || config.provider !== "google") {
    return HEURISTIC_ENRICHER;
  }

  const google = createGoogleGenerativeAI({ apiKey: config.geminiApiKey });
  const evidence = (detail: string) => ({
    type: "model" as const,
    label: "Gemini enrichment",
    detail,
  });

  return {
    provider: "google",
    async summarize(input) {
      const { object } = await generateObject({
        model: google(config.model),
        schema: googleSummarySchema,
        prompt: `${buildPrompt(input)}\n\nReturn a concise project summary and the main technologies used.`,
      });
      return {
        ...input.summaryDraft,
        summary: object.summary,
        technologies: object.technologies,
        evidence: [...input.summaryDraft.evidence, evidence(`Generated with ${config.model}`)],
        provider: "google",
      };
    },
    async describeArchitecture(input) {
      const { object } = await generateObject({
        model: google(config.model),
        schema: googleArchitectureSchema,
        prompt: `${buildPrompt(input)}\n\nReturn a high-level architecture overview, a few major components, key design decisions, and a valid Mermaid flowchart.`,
      });
      return {
        ...input.architectureDraft,
        overview: object.overview,
        components: object.components,
        designDecisions: object.designDecisions,
        diagramMermaid: object.diagramMermaid,
        evidence: [...input.architectureDraft.evidence, evidence(`Generated with ${config.model}`)],
        provider: "google",
      };
    },
  };
}
