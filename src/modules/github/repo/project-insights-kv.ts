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
  ProjectArchitectureResult,
  ProjectSummaryResult,
} from "../types";

type ProjectDocumentKind = "summary" | "architecture";

function ownerKey(owner: string) {
  return `${PROJECT_INSIGHTS_PREFIX}/owners/${owner}`;
}

export function latestProjectsKey(owner: string) {
  return `${ownerKey(owner)}/latest.json`;
}

function projectKey(owner: string, repo: string, kind: ProjectDocumentKind) {
  return `${ownerKey(owner)}/repos/${repo}/${kind}.json`;
}

export function projectOverrideKey(repo: string) {
  return `${PROJECT_INSIGHTS_OVERRIDES_PREFIX}/${repo}.json`;
}

async function readJson<T>(
  config: GitHubInsightsConfig,
  key: string,
  schema: {
    safeParse(value: unknown): { success: true; data: T } | { success: false };
  },
) {
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

function readProjectDocument<T>(
  config: GitHubInsightsConfig,
  repo: string,
  kind: ProjectDocumentKind,
  schema: {
    safeParse(value: unknown): { success: true; data: T } | { success: false };
  },
) {
  return readJson(config, projectKey(config.owner, repo, kind), schema);
}

function writeProjectDocument(
  config: GitHubInsightsConfig,
  repo: string,
  kind: ProjectDocumentKind,
  document: unknown,
) {
  return writeJson(config, projectKey(config.owner, repo, kind), document);
}

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

export function readProjectSummary(config: GitHubInsightsConfig, repo: string) {
  return readProjectDocument(config, repo, "summary", projectSummaryResultSchema);
}

export function writeProjectSummary(config: GitHubInsightsConfig, document: ProjectSummaryResult) {
  return writeProjectDocument(config, document.repo, "summary", document);
}

export function readProjectArchitecture(config: GitHubInsightsConfig, repo: string) {
  return readProjectDocument(config, repo, "architecture", projectArchitectureResultSchema);
}

export function writeProjectArchitecture(
  config: GitHubInsightsConfig,
  document: ProjectArchitectureResult,
) {
  return writeProjectDocument(config, document.repo, "architecture", document);
}

export function readProjectOverride(config: GitHubInsightsConfig, repo: string) {
  return readJson(config, projectOverrideKey(repo), projectInsightOverrideSchema);
}
