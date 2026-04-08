import type { ProjectArchitectureResult, ProjectSummaryResult } from "./schema";

export type {
  LatestProjectsResult,
  ProjectComponent,
  ProjectDesignDecision,
  ProjectEvidence,
  ProjectInsightOverride,
  ProjectListItem,
  ProjectArchitectureResult,
  ProjectSummaryResult,
} from "./schema";

export type GitHubInsightsProvider = "heuristic" | "google";
export type ProjectInsightKind = "summary" | "architecture";

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
export type ProjectInsightDraftByKind = {
  summary: ProjectSummaryDraft;
  architecture: ProjectArchitectureDraft;
};

export type ProjectInsightResultByKind = {
  summary: ProjectSummaryResult;
  architecture: ProjectArchitectureResult;
};
