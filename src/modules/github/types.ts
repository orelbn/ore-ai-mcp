import type { z } from "zod";
import type {
	googleArchitectureSchema,
	googleSummarySchema,
	latestProjectsResultSchema,
	projectArchitectureResultSchema,
	projectComponentSchema,
	projectDesignDecisionSchema,
	projectEvidenceSchema,
	projectInsightOverrideSchema,
	projectListItemSchema,
	projectSummaryResultSchema,
} from "./schema";

export type GitHubInsightsProvider = "heuristic" | "google";

export type ProjectEvidence = z.infer<typeof projectEvidenceSchema>;
export type ProjectComponent = z.infer<typeof projectComponentSchema>;
export type ProjectDesignDecision = z.infer<typeof projectDesignDecisionSchema>;
export type ProjectListItem = z.infer<typeof projectListItemSchema>;
export type LatestProjectsResult = z.infer<typeof latestProjectsResultSchema>;
export type ProjectSummaryResult = z.infer<typeof projectSummaryResultSchema>;
export type ProjectArchitectureResult = z.infer<
	typeof projectArchitectureResultSchema
>;
export type ProjectInsightOverride = z.infer<
	typeof projectInsightOverrideSchema
>;
export type GoogleSummaryResult = z.infer<typeof googleSummarySchema>;
export type GoogleArchitectureResult = z.infer<typeof googleArchitectureSchema>;

export type GitHubRepoApiItem = {
	name: string;
	full_name: string;
	html_url: string;
	description: string | null;
	homepage: string | null;
	language: string | null;
	topics?: string[];
	stargazers_count: number;
	fork: boolean;
	archived: boolean;
	disabled: boolean;
	pushed_at: string;
	updated_at: string;
	default_branch: string;
};

export type GitHubRepoApiFile = {
	name: string;
	path: string;
	type: "file" | "dir";
};

export type GitHubReadmeApiResponse = {
	content: string;
	encoding: string;
};

export type GitHubRepoSource = {
	repo: GitHubRepoApiItem;
	readme: string | null;
	languages: Record<string, number>;
	rootEntries: GitHubRepoApiFile[];
	manifestContents: Partial<Record<string, string>>;
};

export type GitHubInsightsConfig = {
	owner: string;
	cacheTtlSeconds: number;
	provider: GitHubInsightsProvider;
	model: string;
	githubToken: string | null;
	geminiApiKey: string | null;
	kv: KVNamespace;
};

export type ProjectSummaryDraft = Omit<
	ProjectSummaryResult,
	"cachedAt" | "sourceUpdatedAt" | "stale" | "overrideSignature"
>;

export type ProjectArchitectureDraft = Omit<
	ProjectArchitectureResult,
	"cachedAt" | "sourceUpdatedAt" | "stale" | "overrideSignature"
>;

export type RepoInsightPromptInput = {
	source: GitHubRepoSource;
	evidence: ProjectEvidence[];
	summaryDraft: ProjectSummaryDraft;
	architectureDraft: ProjectArchitectureDraft;
	override: ProjectInsightOverride | null;
};

export type RepoInsightEnricher = {
	provider: GitHubInsightsProvider;
	summarize(input: RepoInsightPromptInput): Promise<ProjectSummaryDraft>;
	describeArchitecture(
		input: RepoInsightPromptInput,
	): Promise<ProjectArchitectureDraft>;
};
