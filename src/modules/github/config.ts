import { AppError } from "@/lib/errors";
import type { Env } from "@/lib/worker";
import { DEFAULT_GITHUB_CACHE_TTL_SECONDS, DEFAULT_GITHUB_INSIGHTS_MODEL } from "./constants";
import type { GitHubInsightsConfig } from "./types";

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function resolveGitHubInsightsConfig(env: Env): GitHubInsightsConfig | null {
  const owner = env.GITHUB_OWNER?.trim();
  if (!owner || !env.PROJECT_INSIGHTS_KV) {
    return null;
  }

  return {
    owner,
    cacheTtlSeconds: parsePositiveInt(
      env.GITHUB_CACHE_TTL_SECONDS,
      DEFAULT_GITHUB_CACHE_TTL_SECONDS,
    ),
    model: env.GITHUB_INSIGHTS_MODEL?.trim() || DEFAULT_GITHUB_INSIGHTS_MODEL,
    githubToken: env.GITHUB_TOKEN?.trim() || null,
    geminiApiKey: env.GEMINI_API_KEY?.trim() || null,
    kv: env.PROJECT_INSIGHTS_KV,
  };
}

export function requireGitHubInsightsConfig(env: Env): GitHubInsightsConfig {
  const config = resolveGitHubInsightsConfig(env);
  if (!config) {
    throw new AppError(
      "INTERNAL_ERROR",
      "GitHub insights are not configured for this deployment",
      500,
    );
  }
  return config;
}
