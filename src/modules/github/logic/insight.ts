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

type InsightOverrideApplier = {
  [K in ProjectInsightKind]: (
    draft: ProjectInsightDraftByKind[K],
    override: Awaited<ReturnType<typeof readProjectOverride>>,
  ) => ProjectInsightDraftByKind[K];
};

const applyInsightOverride: InsightOverrideApplier = {
  summary: applySummaryOverride,
  architecture: applyArchitectureOverride,
};

async function loadCachedInsightState<K extends ProjectInsightKind>(
  config: GitHubInsightsConfig,
  repo: string,
  kind: K,
) {
  const [cached, override] = await Promise.all([
    readProjectDocument(config, repo, kind),
    readProjectOverride(config, repo),
  ]);

  return {
    cached,
    override,
    overrideSignature: await computeOverrideSignature(override),
  };
}

function readStaleFallback<K extends ProjectInsightKind>(
  cached: ProjectInsightResultByKind[K] | null,
  error: unknown,
) {
  if (!cached) {
    throw error;
  }

  return {
    ...cached,
    stale: true,
  };
}

async function buildInsightDrafts(
  config: GitHubInsightsConfig,
  kind: ProjectInsightKind,
  source: Awaited<ReturnType<typeof loadRepoSource>>,
  override: Awaited<ReturnType<typeof readProjectOverride>>,
) {
  const drafts = buildHeuristicDrafts(source, override);
  const draft = await enrichProjectInsight(config, kind, {
    source,
    summaryDraft: drafts.summary,
    architectureDraft: drafts.architecture,
    override,
  });

  return {
    summary: kind === "summary" ? draft : drafts.summary,
    architecture: kind === "architecture" ? draft : drafts.architecture,
  } as ProjectInsightDraftByKind;
}

function buildProjectDocument<K extends ProjectInsightKind>(
  kind: K,
  drafts: ProjectInsightDraftByKind,
  override: Awaited<ReturnType<typeof readProjectOverride>>,
  sourceUpdatedAtValue: string,
  overrideSignature: string | null,
): ProjectInsightResultByKind[K] {
  return {
    ...applyInsightOverride[kind](drafts[kind], override),
    overrideSignature,
    cachedAt: new Date().toISOString(),
    sourceUpdatedAt: sourceUpdatedAtValue,
    stale: false,
  } as ProjectInsightResultByKind[K];
}

export async function getProjectInsight<K extends ProjectInsightKind>(
  config: GitHubInsightsConfig,
  repoInput: string,
  kind: K,
): Promise<ProjectInsightResultByKind[K]> {
  const repo = requireRepoName(repoInput);
  const { cached, override, overrideSignature } = await loadCachedInsightState(config, repo, kind);

  if (
    cached &&
    isFresh(cached.cachedAt, config.cacheTtlSeconds) &&
    cached.overrideSignature === overrideSignature
  ) {
    return cached;
  }

  try {
    const source = await loadRepoSource(config, repo);
    const drafts = await buildInsightDrafts(config, kind, source, override);
    const document = buildProjectDocument(
      kind,
      drafts,
      override,
      sourceUpdatedAt(source),
      overrideSignature,
    );
    await writeProjectDocument(config, kind, document);
    return document;
  } catch (error) {
    return readStaleFallback(cached, error);
  }
}

export function getProjectSummary(config: GitHubInsightsConfig, repoInput: string) {
  return getProjectInsight(config, repoInput, "summary");
}

export function getProjectArchitecture(config: GitHubInsightsConfig, repoInput: string) {
  return getProjectInsight(config, repoInput, "architecture");
}
