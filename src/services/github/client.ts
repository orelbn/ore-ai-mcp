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

function normalizeText(content: string): string {
	return content.replaceAll("\r\n", "\n").trim();
}

function decodeBase64Content(content: string): string {
	return Buffer.from(content.replaceAll("\n", ""), "base64").toString("utf8");
}

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

async function fetchRepo(
	config: GitHubInsightsConfig,
	repo: string,
): Promise<GitHubRepoApiItem> {
	return fetchGitHubJson<GitHubRepoApiItem>(
		config,
		`/repos/${config.owner}/${repo}`,
	);
}

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

async function fetchLanguages(
	config: GitHubInsightsConfig,
	repo: string,
): Promise<Record<string, number>> {
	return fetchGitHubJson<Record<string, number>>(
		config,
		`/repos/${config.owner}/${repo}/languages`,
	);
}

async function fetchRootEntries(
	config: GitHubInsightsConfig,
	repo: string,
): Promise<GitHubRepoApiFile[]> {
	return fetchGitHubJson<GitHubRepoApiFile[]>(
		config,
		`/repos/${config.owner}/${repo}/contents`,
	);
}

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
