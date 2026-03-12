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

/**
 * Build the namespaced KV key for storing an owner's project insights.
 *
 * @param owner - GitHub owner (user or organization) identifier
 * @returns The KV key string namespaced under the project-insights prefix for the given owner
 */
function ownerKey(owner: string): string {
	return `${PROJECT_INSIGHTS_PREFIX}/owners/${owner}`;
}

/**
 * Build the namespaced KV key for an owner's latest projects JSON.
 *
 * @param owner - The GitHub owner (user or organization) namespace
 * @returns The KV key under the owner's namespace for the latest projects JSON (e.g. `<owner>/latest.json`)
 */
export function latestProjectsKey(owner: string): string {
	return `${ownerKey(owner)}/latest.json`;
}

/**
 * Builds the namespaced KV key for a repository's summary JSON under the given owner.
 *
 * @returns The KV key string for the repository summary JSON, e.g. `"<owner>/repos/<repo>/summary.json"`.
 */
export function projectSummaryKey(owner: string, repo: string): string {
	return `${ownerKey(owner)}/repos/${repo}/summary.json`;
}

/**
 * Builds the KV storage key for a repository's architecture JSON under the given owner.
 *
 * @param owner - GitHub owner (user or organization) that owns the repository
 * @param repo - Repository name
 * @returns The namespaced KV key for the repository's `architecture.json`
 */
export function projectArchitectureKey(owner: string, repo: string): string {
	return `${ownerKey(owner)}/repos/${repo}/architecture.json`;
}

/**
 * Builds the KV key for a repository's project-insight override JSON.
 *
 * @param repo - Repository identifier (e.g., "owner/repo")
 * @returns The namespaced KV key for the repository's override JSON (e.g., `.../repo.json`)
 */
export function projectOverrideKey(repo: string): string {
	return `${PROJECT_INSIGHTS_OVERRIDES_PREFIX}/${repo}.json`;
}

/**
 * Reads a JSON document from the KV store for the given key and validates it against the provided parser.
 *
 * @param key - The KV key to read.
 * @param parser - A parser with a `safeParse` method that validates the parsed JSON and returns typed data on success.
 * @returns The parsed and validated value for `key`, or `null` if the key is not present.
 * @throws AppError if the stored value is not valid JSON or if schema validation fails.
 */
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

/**
 * Stores a value in the configured KV store as JSON under the given key.
 *
 * @param key - The KV entry key to write
 * @param value - The value to serialize to JSON and persist
 */
async function writeJson(
	config: GitHubInsightsConfig,
	key: string,
	value: unknown,
): Promise<void> {
	await config.kv.put(key, JSON.stringify(value));
}

/**
 * Checks whether a cached timestamp is still within the provided TTL.
 *
 * @param cachedAt - The cached timestamp as a string (expected in a parseable format such as ISO 8601)
 * @param cacheTtlSeconds - Time-to-live in seconds
 * @param now - Optional current time in milliseconds since epoch to compare against (useful for testing)
 * @returns `true` if `cachedAt` parses and its age is less than or equal to `cacheTtlSeconds`, `false` otherwise
 */
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

/**
 * Checks if a latest-projects cache document is still within its time-to-live.
 *
 * @param document - The cached latest-projects result whose `cachedAt` timestamp will be evaluated
 * @param cacheTtlSeconds - Time-to-live in seconds used to determine freshness
 * @returns `true` if the document's `cachedAt` is within `cacheTtlSeconds` of now, `false` otherwise
 */
export function latestProjectsFresh(
	document: LatestProjectsResult,
	cacheTtlSeconds: number,
): boolean {
	return isFresh(document.cachedAt, cacheTtlSeconds);
}

/**
 * Checks whether a project summary document is still within its cache TTL.
 *
 * @param document - The cached project summary document to evaluate
 * @param cacheTtlSeconds - Maximum allowed age of the cache in seconds
 * @returns `true` if the document's `cachedAt` timestamp is within `cacheTtlSeconds` of the current time, `false` otherwise
 */
export function summaryFresh(
	document: ProjectSummaryResult,
	cacheTtlSeconds: number,
): boolean {
	return isFresh(document.cachedAt, cacheTtlSeconds);
}

/**
 * Determine whether the cached project architecture document is still within the given TTL.
 *
 * @param document - The cached project architecture result whose `cachedAt` timestamp is checked
 * @param cacheTtlSeconds - Time-to-live in seconds used to judge freshness
 * @returns `true` if the document's `cachedAt` is within `cacheTtlSeconds` of now, `false` otherwise
 */
export function architectureFresh(
	document: ProjectArchitectureResult,
	cacheTtlSeconds: number,
): boolean {
	return isFresh(document.cachedAt, cacheTtlSeconds);
}

/**
 * Read the cached latest projects document for the configured owner from the KV store.
 *
 * @param config - Configuration containing the KV namespace and the `owner` used to build the storage key
 * @returns The parsed `LatestProjectsResult` if present in KV, or `null` if no entry exists
 */
export function readLatestProjects(
	config: GitHubInsightsConfig,
): Promise<LatestProjectsResult | null> {
	return readJson(
		config,
		latestProjectsKey(config.owner),
		latestProjectsResultSchema,
	);
}

/**
 * Persist the latest projects document to the owner's latest-projects KV key.
 *
 * @param config - Configuration providing the KV namespace and owner context
 * @param document - The LatestProjectsResult to store
 * @returns Nothing.
 */
export function writeLatestProjects(
	config: GitHubInsightsConfig,
	document: LatestProjectsResult,
): Promise<void> {
	return writeJson(config, latestProjectsKey(config.owner), document);
}

/**
 * Reads the cached project summary for a repository from the configured KV store.
 *
 * @param repo - The repository name (slug) under the configured owner
 * @returns The cached `ProjectSummaryResult`, or `null` if no entry exists
 */
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

/**
 * Persist a repository's project summary document to the configured KV store.
 *
 * @param config - Configuration providing the KV namespace and owner used to derive the storage key
 * @param document - The ProjectSummaryResult to persist; `document.repo` is used when building the storage key
 */
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

/**
 * Retrieves the cached architecture document for the given repository from the KV store.
 *
 * @param repo - Repository name; the owner is taken from `config.owner`
 * @returns The cached ProjectArchitectureResult if present and valid, `null` if missing
 */
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

/**
 * Persists a project's architecture result for the repository identified in `document.repo`.
 *
 * @param document - The ProjectArchitectureResult to persist (must include `repo` and cached data)
 */
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

/**
 * Retrieve the stored insight override for a repository from the configured KV store.
 *
 * @param repo - Repository identifier used to build the KV key (for example, `owner/repo`)
 * @returns `ProjectInsightOverride` if an override exists and passes schema validation, `null` if no entry is present
 */
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
