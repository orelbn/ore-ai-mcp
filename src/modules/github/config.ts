import { AppError } from "@/lib/errors";
import type { Env } from "@/lib/worker";
import {
	DEFAULT_GITHUB_CACHE_TTL_SECONDS,
	DEFAULT_GITHUB_INSIGHTS_MODEL,
	DEFAULT_GITHUB_INSIGHTS_PROVIDER,
} from "./constants";
import type { GitHubInsightsConfig, GitHubInsightsProvider } from "./types";

/**
 * Parses a string as a positive base-10 integer and returns a fallback when missing or invalid.
 *
 * @param value - The string to parse; may be undefined or non-numeric.
 * @param fallback - The value to return when `value` is missing or does not represent an integer greater than zero.
 * @returns The parsed integer greater than zero, or `fallback` if parsing fails or yields a value less than or equal to zero.
 */
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

/**
 * Normalize a provider string to a valid GitHubInsightsProvider.
 *
 * @param value - Provider identifier; expected values are `"heuristic"` or `"google"`. Other values produce the default provider.
 * @returns The normalized provider: `"heuristic"`, `"google"`, or the configured default provider.
 */
function normalizeProvider(value: string | undefined): GitHubInsightsProvider {
	if (value === "heuristic") {
		return "heuristic";
	}
	if (value === "google") {
		return "google";
	}
	return DEFAULT_GITHUB_INSIGHTS_PROVIDER as GitHubInsightsProvider;
}

/**
 * Builds a GitHub insights configuration from environment variables.
 *
 * @param env - Environment containing GitHub and project settings used to construct the config
 * @returns A `GitHubInsightsConfig` assembled from the environment, or `null` if required variables (owner or KV namespace) are missing
 */
export function resolveGitHubInsightsConfig(
	env: Env,
): GitHubInsightsConfig | null {
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
		provider: normalizeProvider(env.GITHUB_INSIGHTS_PROVIDER),
		model: env.GITHUB_INSIGHTS_MODEL?.trim() || DEFAULT_GITHUB_INSIGHTS_MODEL,
		githubToken: env.GITHUB_TOKEN?.trim() || null,
		geminiApiKey: env.GEMINI_API_KEY?.trim() || null,
		kv: env.PROJECT_INSIGHTS_KV,
	};
}

/**
 * Obtain a validated GitHub Insights configuration or throw an error if it is not available.
 *
 * @returns The validated GitHub Insights configuration
 * @throws AppError when required environment variables for GitHub Insights are missing or incomplete (HTTP 500, code "INTERNAL_ERROR")
 */
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
