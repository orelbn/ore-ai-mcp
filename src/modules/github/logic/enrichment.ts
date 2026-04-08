import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { googleArchitectureSchema, googleSummarySchema } from "../schema";
import type {
  GitHubInsightsConfig,
  GitHubRepoSource,
  ProjectArchitectureDraft,
  ProjectInsightKind,
  ProjectInsightOverride,
  ProjectSummaryDraft,
} from "../types";

export type InsightPromptInput = {
  source: GitHubRepoSource;
  summaryDraft: ProjectSummaryDraft;
  architectureDraft: ProjectArchitectureDraft;
  override: ProjectInsightOverride | null;
};

function buildPrompt(input: InsightPromptInput): string {
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

function modelEvidence(model: string) {
  return {
    type: "model" as const,
    label: "Gemini enrichment",
    detail: `Generated with ${model}`,
  };
}

function fallbackDraft<K extends ProjectInsightKind>(
  kind: K,
  input: InsightPromptInput,
): ProjectSummaryDraft | ProjectArchitectureDraft {
  return kind === "summary" ? input.summaryDraft : input.architectureDraft;
}

async function enrichSummary(config: GitHubInsightsConfig, input: InsightPromptInput) {
  const google = createGoogleGenerativeAI({ apiKey: config.geminiApiKey! });
  const { object } = await generateObject({
    model: google(config.model),
    schema: googleSummarySchema,
    prompt: `${buildPrompt(input)}\n\nReturn a concise project summary and the main technologies used.`,
  });

  return {
    ...input.summaryDraft,
    summary: object.summary,
    technologies: object.technologies,
    evidence: [...input.summaryDraft.evidence, modelEvidence(config.model)],
    provider: "google" as const,
  };
}

async function enrichArchitecture(config: GitHubInsightsConfig, input: InsightPromptInput) {
  const google = createGoogleGenerativeAI({ apiKey: config.geminiApiKey! });
  const { object } = await generateObject({
    model: google(config.model),
    schema: googleArchitectureSchema,
    prompt:
      `${buildPrompt(input)}\n\nReturn a high-level architecture overview, a few major components, ` +
      "key design decisions, and a valid Mermaid flowchart.",
  });

  return {
    ...input.architectureDraft,
    overview: object.overview,
    components: object.components,
    designDecisions: object.designDecisions,
    diagramMermaid: object.diagramMermaid,
    evidence: [...input.architectureDraft.evidence, modelEvidence(config.model)],
    provider: "google" as const,
  };
}

export async function enrichProjectInsight<K extends ProjectInsightKind>(
  config: GitHubInsightsConfig,
  kind: K,
  input: InsightPromptInput,
): Promise<ProjectSummaryDraft | ProjectArchitectureDraft> {
  if (!config.geminiApiKey) {
    return fallbackDraft(kind, input);
  }

  if (kind === "summary") {
    return enrichSummary(config, input);
  }

  return enrichArchitecture(config, input);
}
