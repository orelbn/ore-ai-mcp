import { AppError } from "@/lib/errors";
import { PROJECT_INSIGHTS_OVERRIDES_PREFIX, PROJECT_INSIGHTS_PREFIX } from "../constants";
import {
  latestProjectsResultSchema,
  projectArchitectureResultSchema,
  projectInsightOverrideSchema,
  projectSummaryResultSchema,
} from "../schema";
import type {
  GitHubInsightsConfig,
  LatestProjectsResult,
  ProjectInsightKind,
  ProjectInsightResultByKind,
} from "../types";

type JsonSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

function ownerKey(owner: string) {
  return `${PROJECT_INSIGHTS_PREFIX}/owners/${owner}`;
}

export function latestProjectsKey(owner: string) {
  return `${ownerKey(owner)}/latest.json`;
}

function projectKey(owner: string, repo: string, kind: ProjectInsightKind) {
  return `${ownerKey(owner)}/repos/${repo}/${kind}.json`;
}

export function projectOverrideKey(repo: string) {
  return `${PROJECT_INSIGHTS_OVERRIDES_PREFIX}/${repo}.json`;
}

async function readJson<T>(config: GitHubInsightsConfig, key: string, schema: JsonSchema<T>) {
  const raw = await config.kv.get(key);
  if (!raw) return null;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new AppError("INTERNAL_ERROR", `Cached document is invalid JSON: ${key}`, 500);
  }

  const parsed = schema.safeParse(parsedJson);
  if (parsed.success) return parsed.data;
  throw new AppError("INTERNAL_ERROR", `Cached document has an invalid schema: ${key}`, 500);
}

function writeJson(config: GitHubInsightsConfig, key: string, value: unknown) {
  return config.kv.put(key, JSON.stringify(value));
}

const projectDocumentSchemaByKind: {
  [K in ProjectInsightKind]: JsonSchema<ProjectInsightResultByKind[K]>;
} = {
  summary: projectSummaryResultSchema,
  architecture: projectArchitectureResultSchema,
};

export function isFresh(cachedAt: string, cacheTtlSeconds: number, now = Date.now()) {
  const cachedAtMs = Date.parse(cachedAt);
  return Number.isFinite(cachedAtMs) && now - cachedAtMs <= cacheTtlSeconds * 1000;
}

export function readLatestProjects(config: GitHubInsightsConfig) {
  return readJson(config, latestProjectsKey(config.owner), latestProjectsResultSchema);
}

export function writeLatestProjects(config: GitHubInsightsConfig, document: LatestProjectsResult) {
  return writeJson(config, latestProjectsKey(config.owner), document);
}

export function readProjectDocument<K extends ProjectInsightKind>(
  config: GitHubInsightsConfig,
  repo: string,
  kind: K,
) {
  return readJson(
    config,
    projectKey(config.owner, repo, kind),
    projectDocumentSchemaByKind[kind],
  ) as Promise<ProjectInsightResultByKind[K] | null>;
}

export function writeProjectDocument<K extends ProjectInsightKind>(
  config: GitHubInsightsConfig,
  kind: K,
  document: ProjectInsightResultByKind[K],
) {
  return writeJson(config, projectKey(config.owner, document.repo, kind), document);
}

export function readProjectOverride(config: GitHubInsightsConfig, repo: string) {
  return readJson(config, projectOverrideKey(repo), projectInsightOverrideSchema);
}
