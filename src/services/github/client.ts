import { Buffer } from "node:buffer";
import { AppError } from "@/lib/errors";
import {
	DEFAULT_GITHUB_LATEST_LIMIT,
	DEFAULT_GITHUB_MAX_PAGES,
	GITHUB_API_BASE_URL,
	GITHUB_API_VERSION,
	ROOT_MANIFEST_FILES,
} from "@/modules/github/constants";
import type {
	GitHubInsightsConfig,
	GitHubReadmeApiResponse,
	GitHubRepoApiFile,
	GitHubRepoApiItem,
	GitHubRepoSource,
	ProjectListItem,
} from "@/modules/github/types";

/**
 * Build HTTP headers required for GitHub API requests, adding an Authorization header when a token is provided.
 *
 * @param config - Configuration that may include `githubToken`; when present an `Authorization: Bearer <token>` header is added.
 * @returns An object with `Accept`, `User-Agent`, `X-GitHub-Api-Version` headers and `Authorization` if a token was supplied.
 */
function githubHeaders(config: GitHubInsightsConfig): HeadersInit {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"User-Agent": "ore-ai-mcp",
		"X-GitHub-Api-Version": GITHUB_API_VERSION,
	};
	if (config.githubToken) {
		headers.Authorization = `Bearer ${config.githubToken}`;
	}
	return headers;
}

/**
 * Fetches JSON from the GitHub REST API at the given path and returns the parsed payload.
 *
 * @param config - GitHub client configuration used to build request headers (may include token and owner)
 * @param path - API path appended to the GitHub API base URL (e.g., "/repos/{owner}/{repo}")
 * @returns The parsed JSON response typed as `T`
 * @throws AppError with code `INVALID_INPUT` and HTTP 404 when the resource is not found
 * @throws AppError with code `INTERNAL_ERROR` and HTTP 500 when rate-limited (HTTP 403/429)
 * @throws AppError with code `INTERNAL_ERROR` and HTTP 500 for other non-OK responses
 */
async function fetchGitHubJson<T>(
	config: GitHubInsightsConfig,
	path: string,
): Promise<T> {
	const response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
		headers: githubHeaders(config),
	});

	if (response.status === 404) {
		throw new AppError(
			"INVALID_INPUT",
			`GitHub resource not found: ${path}`,
			404,
		);
	}

	if (response.status === 403 || response.status === 429) {
		throw new AppError(
			"INTERNAL_ERROR",
			"GitHub API rate limit reached. Configure GITHUB_TOKEN to raise the limit.",
			500,
		);
	}

	if (!response.ok) {
		throw new AppError(
			"INTERNAL_ERROR",
			`GitHub API request failed with status ${response.status}`,
			500,
		);
	}

	return (await response.json()) as T;
}

/**
 * Fetches JSON from the GitHub API at the given path and returns the parsed payload or `null` if the resource is not found.
 *
 * @param path - GitHub API path (appended to the base API URL), e.g. `/repos/owner/name`
 * @returns The parsed JSON payload typed as `T`, or `null` if the response status is 404
 */
async function fetchOptionalGitHubJson<T>(
	config: GitHubInsightsConfig,
	path: string,
): Promise<T | null> {
	const response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
		headers: githubHeaders(config),
	});
	if (response.status === 404) {
		return null;
	}
	if (!response.ok) {
		throw new AppError(
			"INTERNAL_ERROR",
			`GitHub API request failed with status ${response.status}`,
			500,
		);
	}
	return (await response.json()) as T;
}

/**
 * Normalize line endings and remove surrounding whitespace from a string.
 *
 * @returns The input string with Windows `\r\n` sequences converted to `\n` and leading/trailing whitespace removed.
 */
function normalizeText(content: string): string {
	return content.replaceAll("\r\n", "\n").trim();
}

/**
 * Decode a base64-encoded string into UTF-8 text.
 *
 * @param content - Base64-encoded input; newline characters will be ignored before decoding
 * @returns The decoded UTF-8 string
 */
function decodeBase64Content(content: string): string {
	return Buffer.from(content.replaceAll("\n", ""), "base64").toString("utf8");
}

/**
 * Convert a GitHub repository API item into the application's ProjectListItem shape.
 *
 * @param repo - The repository object returned by the GitHub API
 * @returns A ProjectListItem with repository fields copied; text fields default to an empty string when missing and `topics` defaults to an empty array
 */
export function toProjectListItem(repo: GitHubRepoApiItem): ProjectListItem {
	return {
		name: repo.name,
		fullName: repo.full_name,
		url: repo.html_url,
		description: repo.description ?? "",
		homepageUrl: repo.homepage ?? "",
		primaryLanguage: repo.language ?? "",
		topics: repo.topics ?? [],
		stars: repo.stargazers_count,
		pushedAt: repo.pushed_at,
		updatedAt: repo.updated_at,
	};
}

/**
 * Retrieves the owner's public repositories, filters and returns the most recently pushed projects.
 *
 * @param config - GitHubInsights configuration containing the repository owner and optional token
 * @param limit - Maximum number of projects to return
 * @returns An array of `ProjectListItem` for the owner's repositories that are not forks, archived, or disabled, sorted by most recent push date (newest first) and limited to `limit`
 */
export async function listLatestPublicRepos(
	config: GitHubInsightsConfig,
	limit = DEFAULT_GITHUB_LATEST_LIMIT,
): Promise<ProjectListItem[]> {
	const repos: GitHubRepoApiItem[] = [];

	for (let page = 1; page <= DEFAULT_GITHUB_MAX_PAGES; page++) {
		const chunk = await fetchGitHubJson<GitHubRepoApiItem[]>(
			config,
			`/users/${config.owner}/repos?sort=pushed&direction=desc&per_page=100&type=owner&page=${page}`,
		);
		if (chunk.length === 0) {
			break;
		}
		repos.push(...chunk);
		const eligible = repos.filter(
			(repo) => !repo.fork && !repo.archived && !repo.disabled,
		);
		if (eligible.length >= limit) {
			break;
		}
	}

	return repos
		.filter((repo) => !repo.fork && !repo.archived && !repo.disabled)
		.sort((left, right) => right.pushed_at.localeCompare(left.pushed_at))
		.slice(0, limit)
		.map(toProjectListItem);
}

/**
 * Fetches metadata for a repository belonging to the configured owner.
 *
 * @param repo - The repository name (without owner)
 * @returns Repository metadata as a `GitHubRepoApiItem`
 */
async function fetchRepo(
	config: GitHubInsightsConfig,
	repo: string,
): Promise<GitHubRepoApiItem> {
	return fetchGitHubJson<GitHubRepoApiItem>(
		config,
		`/repos/${config.owner}/${repo}`,
	);
}

/**
 * Fetches and returns the repository README content if present and base64-encoded.
 *
 * @param repo - The repository name (owner is taken from `config`)
 * @returns The normalized README text, or `null` if the README is missing or not base64-encoded
 */
async function fetchReadme(
	config: GitHubInsightsConfig,
	repo: string,
): Promise<string | null> {
	const payload = await fetchOptionalGitHubJson<GitHubReadmeApiResponse>(
		config,
		`/repos/${config.owner}/${repo}/readme`,
	);
	if (!payload) {
		return null;
	}
	if (payload.encoding !== "base64") {
		return null;
	}
	return normalizeText(decodeBase64Content(payload.content));
}

/**
 * Fetches the language size breakdown for the given repository.
 *
 * @returns A record mapping programming language names to the number of bytes of code detected for each language.
 */
async function fetchLanguages(
	config: GitHubInsightsConfig,
	repo: string,
): Promise<Record<string, number>> {
	return fetchGitHubJson<Record<string, number>>(
		config,
		`/repos/${config.owner}/${repo}/languages`,
	);
}

/**
 * Fetches the listing of files and directories at the repository root.
 *
 * @param config - Configuration containing the repository owner and optional authentication token
 * @param repo - Repository name under the configured owner
 * @returns An array of `GitHubRepoApiFile` objects describing the entries at the repository root
 */
async function fetchRootEntries(
	config: GitHubInsightsConfig,
	repo: string,
): Promise<GitHubRepoApiFile[]> {
	return fetchGitHubJson<GitHubRepoApiFile[]>(
		config,
		`/repos/${config.owner}/${repo}/contents`,
	);
}

/**
 * Retrieves the file at the given path from the repository, decodes base64 content, and normalizes line endings.
 *
 * @param config - Configuration containing the repository owner and optional authentication token
 * @param repo - Repository name
 * @param filePath - Path to the file within the repository
 * @returns The file content as a UTF-8 string with normalized line endings, or `null` if the file is missing or not base64-encoded
 */
async function fetchFileContent(
	config: GitHubInsightsConfig,
	repo: string,
	filePath: string,
): Promise<string | null> {
	const payload = await fetchOptionalGitHubJson<GitHubReadmeApiResponse>(
		config,
		`/repos/${config.owner}/${repo}/contents/${filePath}`,
	);
	if (!payload || payload.encoding !== "base64") {
		return null;
	}
	return normalizeText(decodeBase64Content(payload.content));
}

/**
 * Loads repository source data: metadata, decoded README, languages, root entries, and any recognized root manifest files.
 *
 * @param config - Service configuration containing the repository owner and optional authentication token
 * @param repo - The repository name (repository slug) to load from the configured owner
 * @returns A `GitHubRepoSource` with `repo` metadata, `readme` (decoded string or `null`), `languages`, `rootEntries`, and `manifestContents` keyed by manifest filename
 */
export async function loadRepoSource(
	config: GitHubInsightsConfig,
	repo: string,
): Promise<GitHubRepoSource> {
	const [repoInfo, readme, languages, rootEntries] = await Promise.all([
		fetchRepo(config, repo),
		fetchReadme(config, repo),
		fetchLanguages(config, repo),
		fetchRootEntries(config, repo),
	]);

	const manifestNames = new Set(ROOT_MANIFEST_FILES);
	const manifestContents: Partial<Record<string, string>> = {};
	for (const entry of rootEntries) {
		if (entry.type !== "file" || !manifestNames.has(entry.name as never)) {
			continue;
		}
		const content = await fetchFileContent(config, repo, entry.path);
		if (content) {
			manifestContents[entry.name] = content;
		}
	}

	return {
		repo: repoInfo,
		readme,
		languages,
		rootEntries,
		manifestContents,
	};
}
