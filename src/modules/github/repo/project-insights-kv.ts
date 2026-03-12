import { AppError } from "@/lib/errors";
import {
	PROJECT_INSIGHTS_OVERRIDES_PREFIX,
	PROJECT_INSIGHTS_PREFIX,
} from "../constants";
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
	ProjectInsightOverride,
	ProjectSummaryResult,
} from "../types";

function ownerKey(owner: string): string {
	return `${PROJECT_INSIGHTS_PREFIX}/owners/${owner}`;
}

export function latestProjectsKey(owner: string): string {
	return `${ownerKey(owner)}/latest.json`;
}

export function projectSummaryKey(owner: string, repo: string): string {
	return `${ownerKey(owner)}/repos/${repo}/summary.json`;
}

export function projectArchitectureKey(owner: string, repo: string): string {
	return `${ownerKey(owner)}/repos/${repo}/architecture.json`;
}

export function projectOverrideKey(repo: string): string {
	return `${PROJECT_INSIGHTS_OVERRIDES_PREFIX}/${repo}.json`;
}

async function readJson<T>(
	config: GitHubInsightsConfig,
	key: string,
	parser: {
		safeParse(value: unknown): { success: true; data: T } | { success: false };
	},
): Promise<T | null> {
	const raw = await config.kv.get(key);
	if (!raw) {
		return null;
	}

	let parsedJson: unknown;
	try {
		parsedJson = JSON.parse(raw);
	} catch {
		throw new AppError(
			"INTERNAL_ERROR",
			`Cached document is invalid JSON: ${key}`,
			500,
		);
	}

	const parsed = parser.safeParse(parsedJson);
	if (!parsed.success) {
		throw new AppError(
			"INTERNAL_ERROR",
			`Cached document has an invalid schema: ${key}`,
			500,
		);
	}

	return parsed.data;
}

async function writeJson(
	config: GitHubInsightsConfig,
	key: string,
	value: unknown,
): Promise<void> {
	await config.kv.put(key, JSON.stringify(value));
}

export function isFresh(
	cachedAt: string,
	cacheTtlSeconds: number,
	now = Date.now(),
): boolean {
	const cachedAtMs = Date.parse(cachedAt);
	if (Number.isNaN(cachedAtMs)) {
		return false;
	}
	return now - cachedAtMs <= cacheTtlSeconds * 1000;
}

export function latestProjectsFresh(
	document: LatestProjectsResult,
	cacheTtlSeconds: number,
): boolean {
	return isFresh(document.cachedAt, cacheTtlSeconds);
}

export function summaryFresh(
	document: ProjectSummaryResult,
	cacheTtlSeconds: number,
): boolean {
	return isFresh(document.cachedAt, cacheTtlSeconds);
}

export function architectureFresh(
	document: ProjectArchitectureResult,
	cacheTtlSeconds: number,
): boolean {
	return isFresh(document.cachedAt, cacheTtlSeconds);
}

export function readLatestProjects(
	config: GitHubInsightsConfig,
): Promise<LatestProjectsResult | null> {
	return readJson(
		config,
		latestProjectsKey(config.owner),
		latestProjectsResultSchema,
	);
}

export function writeLatestProjects(
	config: GitHubInsightsConfig,
	document: LatestProjectsResult,
): Promise<void> {
	return writeJson(config, latestProjectsKey(config.owner), document);
}

export function readProjectSummary(
	config: GitHubInsightsConfig,
	repo: string,
): Promise<ProjectSummaryResult | null> {
	return readJson(
		config,
		projectSummaryKey(config.owner, repo),
		projectSummaryResultSchema,
	);
}

export function writeProjectSummary(
	config: GitHubInsightsConfig,
	document: ProjectSummaryResult,
): Promise<void> {
	return writeJson(
		config,
		projectSummaryKey(config.owner, document.repo),
		document,
	);
}

export function readProjectArchitecture(
	config: GitHubInsightsConfig,
	repo: string,
): Promise<ProjectArchitectureResult | null> {
	return readJson(
		config,
		projectArchitectureKey(config.owner, repo),
		projectArchitectureResultSchema,
	);
}

export function writeProjectArchitecture(
	config: GitHubInsightsConfig,
	document: ProjectArchitectureResult,
): Promise<void> {
	return writeJson(
		config,
		projectArchitectureKey(config.owner, document.repo),
		document,
	);
}

export function readProjectOverride(
	config: GitHubInsightsConfig,
	repo: string,
): Promise<ProjectInsightOverride | null> {
	return readJson(
		config,
		projectOverrideKey(repo),
		projectInsightOverrideSchema,
	);
}
