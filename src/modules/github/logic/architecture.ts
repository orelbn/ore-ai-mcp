import { loadRepoSource } from "@/services/github/client";
import { createRepoInsightEnricher } from "../providers";
import {
  isFresh,
  readProjectArchitecture,
  readProjectOverride,
  writeProjectArchitecture,
} from "../repo/project-insights-kv";
import type { GitHubInsightsConfig, ProjectArchitectureResult } from "../types";
import {
  buildHeuristicArchitectureDraft,
  buildHeuristicSummaryDraft,
  sourceUpdatedAt,
} from "./heuristics";
import { applyArchitectureOverride, computeOverrideSignature } from "./overrides";
import { requireRepoName } from "./repo";

export async function getProjectArchitecture(
  config: GitHubInsightsConfig,
  repoInput: string,
): Promise<ProjectArchitectureResult> {
  const repo = requireRepoName(repoInput);
  const [cached, override] = await Promise.all([
    readProjectArchitecture(config, repo),
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
    const summaryDraft = buildHeuristicSummaryDraft(source, override);
    const architectureDraft = buildHeuristicArchitectureDraft(source, override);
    const enricher = createRepoInsightEnricher(config);
    const enrichedDraft = applyArchitectureOverride(
      await enricher.describeArchitecture({
        source,
        evidence: architectureDraft.evidence,
        summaryDraft,
        architectureDraft,
        override,
      }),
      override,
    );
    const document: ProjectArchitectureResult = {
      ...enrichedDraft,
      overrideSignature,
      cachedAt: new Date().toISOString(),
      sourceUpdatedAt: sourceUpdatedAt(source),
      stale: false,
    };
    await writeProjectArchitecture(config, document);
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
