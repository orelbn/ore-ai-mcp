import type {
  GitHubRepoSource,
  ProjectArchitectureDraft,
  ProjectEvidence,
  ProjectInsightDraftByKind,
  ProjectInsightOverride,
  ProjectSummaryDraft,
} from "../types";
import { buildMermaidDiagram } from "./diagram";
import { buildEvidence, detectTechnologies, readmeSynopsis } from "./source-analysis";
import {
  buildArchitectureOverview,
  buildComponents,
  buildDesignDecisions,
  buildSummaryText,
} from "./source-inference";

function buildHeuristicInputs(source: GitHubRepoSource): {
  synopsis: string;
  technologies: string[];
  evidence: ProjectEvidence[];
} {
  const synopsis = readmeSynopsis(source.readme);
  const technologies = detectTechnologies(source);

  return {
    synopsis,
    technologies,
    evidence: buildEvidence(source, synopsis),
  };
}

export function buildHeuristicDrafts(
  source: GitHubRepoSource,
  override: ProjectInsightOverride | null,
): ProjectInsightDraftByKind {
  const { synopsis, technologies, evidence } = buildHeuristicInputs(source);
  const components = override?.components ?? buildComponents(source, technologies);

  return {
    summary: {
      repo: source.repo.name,
      name: source.repo.name,
      summary: override?.summary ?? buildSummaryText(source, technologies, synopsis),
      technologies: override?.technologies ?? technologies,
      evidence,
      provider: "heuristic",
    } satisfies ProjectSummaryDraft,
    architecture: {
      repo: source.repo.name,
      overview: override?.overview ?? buildArchitectureOverview(source, synopsis),
      components,
      designDecisions: override?.designDecisions ?? buildDesignDecisions(source, technologies),
      diagramMermaid: override?.diagramMermaid ?? buildMermaidDiagram(components),
      evidence,
      provider: "heuristic",
    } satisfies ProjectArchitectureDraft,
  };
}

export function sourceUpdatedAt(source: GitHubRepoSource): string {
  return source.repo.pushed_at || source.repo.updated_at;
}
