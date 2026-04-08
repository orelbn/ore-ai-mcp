import { loadRepoSource } from "@/services/github/client";
import {
  isFresh,
  readProjectDocument,
  readProjectOverride,
  writeProjectDocument,
} from "../repo/project-insights-kv";
import type {
  GitHubInsightsConfig,
  ProjectInsightDraftByKind,
  ProjectInsightKind,
  ProjectInsightResultByKind,
} from "../types";
import { enrichProjectInsight } from "./enrichment";
import { buildHeuristicDrafts, sourceUpdatedAt } from "./heuristics";
import {
  applyArchitectureOverride,
  applySummaryOverride,
  computeOverrideSignature,
} from "./overrides";
import { requireRepoName } from "./repo";

function applyInsightOverride<K extends ProjectInsightKind>(
  kind: K,
  draft: ProjectInsightDraftByKind[K],
  override: Awaited<ReturnType<typeof readProjectOverride>>,
): ProjectInsightDraftByKind[K] {
  if (kind === "summary") {
    return applySummaryOverride(
      draft as ProjectInsightDraftByKind["summary"],
      override,
    ) as ProjectInsightDraftByKind[K];
  }

  return applyArchitectureOverride(
    draft as ProjectInsightDraftByKind["architecture"],
    override,
  ) as ProjectInsightDraftByKind[K];
}

export async function getProjectInsight<K extends ProjectInsightKind>(
  config: GitHubInsightsConfig,
  repoInput: string,
  kind: K,
): Promise<ProjectInsightResultByKind[K]> {
  const repo = requireRepoName(repoInput);
  const [cached, override] = await Promise.all([
    readProjectDocument(config, repo, kind),
    readProjectOverride(config, repo),
  ]);
  const overrideSignature = await computeOverrideSignature(override);

  if (
    cached &&
    isFresh(cached.cachedAt, config.cacheTtlSeconds) &&
    cached.overrideSignature === overrideSignature
  ) {
    return cached;
  }

  try {
    const source = await loadRepoSource(config, repo);
    const { summary: summaryDraft, architecture: architectureDraft } = buildHeuristicDrafts(
      source,
      override,
    );
    const enrichedDraft = applyInsightOverride(
      kind,
      await enrichProjectInsight(config, kind, {
        source,
        summaryDraft,
        architectureDraft,
        override,
      }),
      override,
    );

    const document = {
      ...enrichedDraft,
      overrideSignature,
      cachedAt: new Date().toISOString(),
      sourceUpdatedAt: sourceUpdatedAt(source),
      stale: false,
    } as ProjectInsightResultByKind[K];

    await writeProjectDocument(config, kind, document);
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

export function getProjectSummary(config: GitHubInsightsConfig, repoInput: string) {
  return getProjectInsight(config, repoInput, "summary");
}

export function getProjectArchitecture(config: GitHubInsightsConfig, repoInput: string) {
  return getProjectInsight(config, repoInput, "architecture");
}
