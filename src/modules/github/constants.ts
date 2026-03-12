export const GITHUB_PROJECTS_LATEST_TOOL = "github.projects.latest";
export const GITHUB_PROJECT_SUMMARY_TOOL = "github.project.summary";
export const GITHUB_PROJECT_ARCHITECTURE_TOOL = "github.project.architecture";

export const PROJECT_INSIGHTS_KV_BINDING = "PROJECT_INSIGHTS_KV";
export const PROJECT_INSIGHTS_PREFIX = "github-insights/v1";
export const PROJECT_INSIGHTS_OVERRIDES_PREFIX = `${PROJECT_INSIGHTS_PREFIX}/overrides`;
export const PROJECT_INSIGHTS_OVERRIDES_INDEX_KEY = `${PROJECT_INSIGHTS_OVERRIDES_PREFIX}/_meta/index.json`;

export const DEFAULT_GITHUB_CACHE_TTL_SECONDS = 43_200;
export const DEFAULT_GITHUB_INSIGHTS_PROVIDER = "google";
export const DEFAULT_GITHUB_INSIGHTS_MODEL = "gemini-3.1-flash-lite-preview";
export const DEFAULT_GITHUB_LATEST_LIMIT = 5;
export const DEFAULT_GITHUB_MAX_PAGES = 3;

export const GITHUB_API_BASE_URL = "https://api.github.com";
export const GITHUB_API_VERSION = "2022-11-28";

export const ROOT_MANIFEST_FILES = [
	"package.json",
	"wrangler.jsonc",
	"wrangler.toml",
	"tsconfig.json",
	"pnpm-workspace.yaml",
	"turbo.json",
	"bunfig.toml",
	"Dockerfile",
	"docker-compose.yml",
	"docker-compose.yaml",
	"compose.yaml",
	"pyproject.toml",
	"go.mod",
	"Cargo.toml",
	"requirements.txt",
] as const;
