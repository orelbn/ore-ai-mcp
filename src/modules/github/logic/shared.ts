import { AppError } from "@/lib/errors";
import type {
	GitHubRepoSource,
	ProjectArchitectureDraft,
	ProjectComponent,
	ProjectDesignDecision,
	ProjectEvidence,
	ProjectInsightOverride,
	ProjectSummaryDraft,
} from "../types";

/**
 * Produce a deterministic string representation of a value with stable object key ordering.
 *
 * @param value - The value to stringify (may be a primitive, array, or object)
 * @returns A stable, JSON-like string: primitives use `JSON.stringify` form; arrays are bracketed comma-separated entries; objects serialize as `{`key`:value}` with keys sorted lexicographically and values stringified recursively.
 */
function stableStringify(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
	}
	if (value && typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>).sort(
			([left], [right]) => left.localeCompare(right),
		);
		return `{${entries
			.map(
				([key, entryValue]) =>
					`${JSON.stringify(key)}:${stableStringify(entryValue)}`,
			)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

/**
 * Compute a deterministic SHA-256 hex signature for a ProjectInsightOverride.
 *
 * @param override - The override object to sign; may be null to indicate no override.
 * @returns A lowercase hex string of the SHA-256 digest for the stable stringification of `override`, or `null` if `override` is null.
 */
export async function computeOverrideSignature(
	override: ProjectInsightOverride | null,
): Promise<string | null> {
	if (!override) {
		return null;
	}

	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(stableStringify(override)),
	);
	return Array.from(new Uint8Array(digest))
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * Removes fenced code blocks from a Markdown string.
 *
 * @param markdown - The Markdown text to strip of fenced code blocks
 * @returns The input text with all triple-backtick code fences and their contents removed
 */
function stripCodeBlocks(markdown: string): string {
	return markdown.replaceAll(/```[\s\S]*?```/g, "");
}

/**
 * Normalizes a single markdown line by removing image embeds, inline links, leading heading markers, and trimming surrounding whitespace.
 *
 * @returns The input `line` with image links (e.g., `![alt](url)`), standard links (e.g., `[text](url)`), leading `#` heading markers removed, and whitespace trimmed.
 */
function normalizeLine(line: string): string {
	return line
		.replaceAll(/!\[[^\]]*]\([^)]*\)/g, "")
		.replaceAll(/\[[^\]]*]\([^)]*\)/g, "")
		.replaceAll(/^#+\s*/g, "")
		.trim();
}

/**
 * Extracts a concise synopsis from a README markdown string.
 *
 * @param readme - The README content (markdown). If `null` or empty, an empty string is returned.
 * @returns A synopsis string composed of up to three normalized, non-code, non-image lines from the README, truncated to 600 characters; returns an empty string when no suitable content is available.
 */
function extractReadmeSynopsis(readme: string | null): string {
	if (!readme) {
		return "";
	}
	const cleaned = stripCodeBlocks(readme)
		.split("\n")
		.map(normalizeLine)
		.filter((line) => line.length > 20 && !line.startsWith("!"));
	return cleaned.slice(0, 3).join(" ").slice(0, 600);
}

/**
 * Removes JavaScript-style comments from a JSON-like string.
 *
 * @param value - The input string that may contain block (`/* ... *\/`) or line (`// ...`) comments
 * @returns The input string with block (`/* ... *\/`) and line (`// ...`) comments removed
 */
function stripJsonComments(value: string): string {
	return value
		.replaceAll(/\/\*[\s\S]*?\*\//g, "")
		.replaceAll(/(^|\s)\/\/.*$/gm, "$1");
}

/**
 * Parses a package.json string into an object after removing JavaScript-style comments.
 *
 * @param value - The raw contents of a package.json file, or `undefined`.
 * @returns The parsed object, or `null` if `value` is `undefined` or not valid JSON after comment stripping.
 */
function parsePackageJson(
	value: string | undefined,
): Record<string, unknown> | null {
	if (!value) {
		return null;
	}
	try {
		return JSON.parse(stripJsonComments(value)) as Record<string, unknown>;
	} catch {
		return null;
	}
}

/**
 * Extracts dependency names from a parsed package.json object.
 *
 * @param packageJson - The parsed package.json object, or `null` if unavailable
 * @returns An array of unique package names found in `dependencies`, `devDependencies`, and `peerDependencies`
 */
function detectDependencyNames(
	packageJson: Record<string, unknown> | null,
): string[] {
	if (!packageJson) {
		return [];
	}
	const sections = ["dependencies", "devDependencies", "peerDependencies"];
	const names = new Set<string>();
	for (const section of sections) {
		const value = packageJson[section];
		if (!value || typeof value !== "object") {
			continue;
		}
		for (const name of Object.keys(value as Record<string, unknown>)) {
			names.add(name);
		}
	}
	return [...names];
}

const DEPENDENCY_TECH_MAP: Record<string, string> = {
	react: "React",
	next: "Next.js",
	vite: "Vite",
	astro: "Astro",
	vue: "Vue",
	svelte: "Svelte",
	hono: "Hono",
	express: "Express",
	fastify: "Fastify",
	"@modelcontextprotocol/sdk": "Model Context Protocol",
	wrangler: "Cloudflare Workers",
	zod: "Zod",
	biome: "Biome",
	tailwindcss: "Tailwind CSS",
};

/**
 * Detects technologies present in a GitHub repository source.
 *
 * Examines repository languages, topics, package.json dependencies (mapped via a dependency-to-technology map),
 * and specific manifest files (wrangler, Dockerfile, pnpm/turbo workspace indicators) to produce a consolidated list.
 *
 * @param source - The GitHub repository source object to analyze
 * @returns A sorted array of unique technology names inferred from the repository metadata and manifest files
 */
function detectTechnologies(source: GitHubRepoSource): string[] {
	const technologies = new Set<string>();
	for (const language of Object.keys(source.languages)) {
		technologies.add(language);
	}
	for (const topic of source.repo.topics ?? []) {
		technologies.add(topic);
	}
	const packageJson = parsePackageJson(source.manifestContents["package.json"]);
	for (const dependencyName of detectDependencyNames(packageJson)) {
		const mapped = DEPENDENCY_TECH_MAP[dependencyName];
		if (mapped) {
			technologies.add(mapped);
		}
	}
	if (
		source.manifestContents["wrangler.jsonc"] ||
		source.manifestContents["wrangler.toml"]
	) {
		technologies.add("Cloudflare Workers");
	}
	if (source.manifestContents.Dockerfile) {
		technologies.add("Docker");
	}
	if (
		source.manifestContents["pnpm-workspace.yaml"] ||
		source.manifestContents["turbo.json"]
	) {
		technologies.add("Monorepo");
	}
	return [...technologies]
		.filter(Boolean)
		.sort((left, right) => left.localeCompare(right));
}

/**
 * Constructs a list of evidence entries describing the repository.
 *
 * Produces evidence that may include repository metadata, a README synopsis (truncated to 280 characters), the top up to five languages by usage, and one entry per detected manifest file.
 *
 * @param source - GitHub repository source data used to derive evidence
 * @returns An array of ProjectEvidence items covering repository metadata, optional README synopsis, optional languages listing, and detected manifest files
 */
function buildEvidence(source: GitHubRepoSource): ProjectEvidence[] {
	const evidence: ProjectEvidence[] = [
		{
			type: "repo",
			label: "Repository metadata",
			detail: `Description: ${source.repo.description ?? "n/a"}; Topics: ${(source.repo.topics ?? []).join(", ") || "n/a"}`,
		},
	];

	if (source.readme) {
		evidence.push({
			type: "readme",
			label: "README",
			detail:
				extractReadmeSynopsis(source.readme).slice(0, 280) || "README present",
		});
	}

	if (Object.keys(source.languages).length > 0) {
		evidence.push({
			type: "languages",
			label: "Languages",
			detail: Object.entries(source.languages)
				.sort((left, right) => right[1] - left[1])
				.slice(0, 5)
				.map(([language]) => language)
				.join(", "),
		});
	}

	for (const manifestName of Object.keys(source.manifestContents)) {
		evidence.push({
			type: "manifest",
			label: manifestName,
			detail: `Detected manifest file ${manifestName}`,
		});
	}

	return evidence;
}

/**
 * Compose a concise human-readable summary for a repository using available metadata.
 *
 * Chooses the most informative content in this order: a combination of repository description and README synopsis, the README synopsis alone, the repository description alone, a technologies-based sentence (using up to five items), or a generic fallback.
 *
 * @param source - Repository source data (used for repo description and README synopsis)
 * @param technologies - Detected technology names (used to generate a technologies-based sentence when no description or synopsis exist)
 * @returns A summary string suitable for display (combined content is limited to 700 characters when both description and synopsis are used)
 */
function buildSummaryText(
	source: GitHubRepoSource,
	technologies: string[],
): string {
	const synopsis = extractReadmeSynopsis(source.readme);
	if (source.repo.description && synopsis) {
		return `${source.repo.description}. ${synopsis}`.slice(0, 700);
	}
	if (synopsis) {
		return synopsis.slice(0, 700);
	}
	if (source.repo.description) {
		return source.repo.description;
	}
	if (technologies.length > 0) {
		return `Public project built with ${technologies.slice(0, 5).join(", ")}.`;
	}
	return "Public project with limited repository metadata available.";
}

/**
 * Infers high-level project components from repository metadata and detected technologies.
 *
 * @param source - Repository metadata and manifest contents used to identify components (root entries, manifest files, etc.).
 * @param technologies - Detected technology names that influence which components are included.
 * @returns An array of up to five ProjectComponent objects describing inferred components (e.g., frontend, backend, monorepo, container, Cloudflare Worker).
function buildComponents(
	source: GitHubRepoSource,
	technologies: string[],
): ProjectComponent[] {
	const components: ProjectComponent[] = [];
	const rootDirs = source.rootEntries
		.filter((entry) => entry.type === "dir")
		.map((entry) => entry.name);

	if (
		source.manifestContents["wrangler.jsonc"] ||
		source.manifestContents["wrangler.toml"]
	) {
		components.push({
			name: "Cloudflare Worker",
			responsibility:
				"Handles the deployed edge runtime and request processing.",
		});
	}

	if (rootDirs.includes("apps") || rootDirs.includes("packages")) {
		components.push({
			name: "Monorepo workspace",
			responsibility:
				"Organizes multiple apps or packages behind a shared repository structure.",
		});
	}

	if (
		technologies.includes("React") ||
		technologies.includes("Next.js") ||
		technologies.includes("Vue")
	) {
		components.push({
			name: "Frontend application",
			responsibility: "Provides the user-facing interface.",
		});
	}

	if (
		technologies.includes("Hono") ||
		technologies.includes("Express") ||
		technologies.includes("Fastify")
	) {
		components.push({
			name: "Backend API",
			responsibility: "Implements application logic and server-side endpoints.",
		});
	}

	if (source.manifestContents.Dockerfile) {
		components.push({
			name: "Container runtime",
			responsibility: "Packages the application for repeatable deployment.",
		});
	}

	if (components.length === 0) {
		components.push({
			name: "Application core",
			responsibility:
				"Contains the main project logic inferred from the repository structure.",
		});
	}

	return components.slice(0, 5);
}

/**
 * Infers architectural design decisions from repository metadata and detected technologies.
 *
 * @param source - Repository metadata (README, manifests, etc.) used to infer decisions
 * @param technologies - Detected technology names that influence which decisions are included
 * @returns An array of up to five ProjectDesignDecision items describing inferred architectural choices
 */
function buildDesignDecisions(
	source: GitHubRepoSource,
	technologies: string[],
): ProjectDesignDecision[] {
	const decisions: ProjectDesignDecision[] = [];

	if (technologies.includes("Cloudflare Workers")) {
		decisions.push({
			title: "Edge-first deployment",
			rationale:
				"Cloudflare configuration files indicate the project is designed to run at the edge.",
		});
	}

	if (technologies.includes("Monorepo")) {
		decisions.push({
			title: "Workspace-based organization",
			rationale:
				"Workspace manifests suggest the repository is structured to share code across multiple packages or apps.",
		});
	}

	if (source.readme) {
		decisions.push({
			title: "README-driven onboarding",
			rationale:
				"The repository includes project-facing documentation that shapes contributor or operator workflows.",
		});
	}

	if (decisions.length === 0) {
		decisions.push({
			title: "Convention-over-configuration structure",
			rationale:
				"The repository structure provides the main architectural clues, with limited explicit design documentation.",
		});
	}

	return decisions.slice(0, 5);
}

/**
 * Generate a Mermaid flowchart that links the provided components in a left-to-right sequence starting from a Client node.
 *
 * @param components - Ordered list of project components to include in the diagram; their order defines the flow.
 * @returns A Mermaid flowchart string that contains a `Client` node and arrows from `Client` to the first component and between successive components; when `components` is empty, returns a minimal diagram with only the `Client` node.
 */
function buildMermaidDiagram(components: ProjectComponent[]): string {
	if (components.length === 0) {
		return ["flowchart LR", '  Client["Client"]'].join("\n");
	}

	const lines = [
		"flowchart LR",
		`  Client["Client"] --> C1["${components[0].name}"]`,
	];
	for (let index = 1; index < components.length; index++) {
		lines.push(
			`  C${index}["${components[index - 1].name}"] --> C${index + 1}["${components[index].name}"]`,
		);
	}
	return lines.join("\n");
}

/**
 * Augments an evidence list with entries describing a provided manual override.
 *
 * @param evidence - The existing array of project evidence to augment
 * @param override - The manual override data; when `null`, no changes are made
 * @returns The augmented evidence array with one or two override entries appended when `override` is provided, otherwise the original array
 */
function withOverrideEvidence(
	evidence: ProjectEvidence[],
	override: ProjectInsightOverride | null,
): ProjectEvidence[] {
	if (!override) {
		return evidence;
	}
	const next = [...evidence];
	next.push({
		type: "override",
		label: "Manual override",
		detail: `Override data applied for ${override.repo}`,
	});
	if (override.notes) {
		next.push({
			type: "override",
			label: "Override notes",
			detail: override.notes,
		});
	}
	return next;
}

/**
 * Builds a heuristic project summary draft from repository data, applying an optional override.
 *
 * @param source - GitHub repository source used to derive summary, technologies, and evidence
 * @param override - Optional manual override that can replace `summary` and `technologies` and will be merged into `evidence`
 * @returns A ProjectSummaryDraft with `repo` and `name` set to the repository name, `summary` taken from `override.summary` or generated from the repo, `technologies` taken from `override.technologies` or detected from the repo, `evidence` augmented with any override entries, and `provider` set to `"heuristic"`
 */
export function buildHeuristicSummaryDraft(
	source: GitHubRepoSource,
	override: ProjectInsightOverride | null,
): ProjectSummaryDraft {
	const technologies = detectTechnologies(source);
	return {
		repo: source.repo.name,
		name: source.repo.name,
		summary: override?.summary ?? buildSummaryText(source, technologies),
		technologies: override?.technologies ?? technologies,
		evidence: withOverrideEvidence(buildEvidence(source), override),
		provider: "heuristic",
	};
}

/**
 * Builds a heuristic architecture draft for a repository using detected technologies and optional overrides.
 *
 * @param source - Repository data used to infer technologies, components, evidence, and synopsis
 * @param override - Optional manual overrides for overview, components, design decisions, diagram, or evidence
 * @returns A ProjectArchitectureDraft containing repo, overview, components, designDecisions, diagramMermaid, evidence, and provider set to `"heuristic"`
 */
export function buildHeuristicArchitectureDraft(
	source: GitHubRepoSource,
	override: ProjectInsightOverride | null,
): ProjectArchitectureDraft {
	const technologies = detectTechnologies(source);
	const components =
		override?.components ?? buildComponents(source, technologies);
	const designDecisions =
		override?.designDecisions ?? buildDesignDecisions(source, technologies);
	const synopsis = extractReadmeSynopsis(source.readme);
	return {
		repo: source.repo.name,
		overview:
			override?.overview ??
			(source.repo.description
				? `${source.repo.description}${synopsis ? ` ${synopsis}` : ""}`.slice(
						0,
						700,
					)
				: synopsis ||
					"Architecture inferred from repository structure and manifests."),
		components,
		designDecisions,
		diagramMermaid: override?.diagramMermaid ?? buildMermaidDiagram(components),
		evidence: withOverrideEvidence(buildEvidence(source), override),
		provider: "heuristic",
	};
}

/**
 * Apply user-provided summary and technology overrides to a project summary draft.
 *
 * @param draft - The original ProjectSummaryDraft to update.
 * @param override - The ProjectInsightOverride to apply, or `null` to leave the draft unchanged.
 * @returns A ProjectSummaryDraft with `summary` and `technologies` replaced when provided and `evidence` augmented with any override entries.
 */
export function applySummaryOverride(
	draft: ProjectSummaryDraft,
	override: ProjectInsightOverride | null,
): ProjectSummaryDraft {
	if (!override) {
		return draft;
	}
	return {
		...draft,
		summary: override.summary ?? draft.summary,
		technologies: override.technologies ?? draft.technologies,
		evidence: withOverrideEvidence(draft.evidence, override),
	};
}

/**
 * Applies provided architecture override fields to a ProjectArchitectureDraft and returns the resulting draft.
 *
 * @param draft - The original architecture draft to update
 * @param override - Optional override whose present fields replace the corresponding fields in `draft`
 * @returns The updated ProjectArchitectureDraft with override values applied; returns the original `draft` if `override` is `null`
 */
export function applyArchitectureOverride(
	draft: ProjectArchitectureDraft,
	override: ProjectInsightOverride | null,
): ProjectArchitectureDraft {
	if (!override) {
		return draft;
	}
	return {
		...draft,
		overview: override.overview ?? draft.overview,
		components: override.components ?? draft.components,
		designDecisions: override.designDecisions ?? draft.designDecisions,
		diagramMermaid: override.diagramMermaid ?? draft.diagramMermaid,
		evidence: withOverrideEvidence(draft.evidence, override),
	};
}

/**
 * Get the repository's most recent update timestamp.
 *
 * @param source - The GitHub repository source containing `repo` metadata
 * @returns The `pushed_at` timestamp if present, otherwise the `updated_at` timestamp
 */
export function sourceUpdatedAt(source: GitHubRepoSource): string {
	return source.repo.pushed_at || source.repo.updated_at;
}

/**
 * Normalizes and validates a repository identifier, extracting the repository name.
 *
 * @param repo - A repository string in the form "owner/name" or "name"
 * @returns The repository name (the part after the `/` if present)
 * @throws AppError INVALID_INPUT if the input is empty or contains a slash with no repository name
 */
export function requireRepoName(repo: string): string {
	const trimmed = repo.trim();
	if (!trimmed) {
		throw new AppError("INVALID_INPUT", "repo is required", 400);
	}
	if (trimmed.includes("/")) {
		const [, repoName] = trimmed.split("/", 2);
		if (!repoName) {
			throw new AppError(
				"INVALID_INPUT",
				"repo must be a repository name",
				400,
			);
		}
		return repoName;
	}
	return trimmed;
}
