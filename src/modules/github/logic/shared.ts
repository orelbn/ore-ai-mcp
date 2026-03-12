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

function stripCodeBlocks(markdown: string): string {
	return markdown.replaceAll(/```[\s\S]*?```/g, "");
}

function normalizeLine(line: string): string {
	return line
		.replaceAll(/!\[[^\]]*]\([^)]*\)/g, "")
		.replaceAll(/\[[^\]]*]\([^)]*\)/g, "")
		.replaceAll(/^#+\s*/g, "")
		.trim();
}

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

function stripJsonComments(value: string): string {
	return value
		.replaceAll(/\/\*[\s\S]*?\*\//g, "")
		.replaceAll(/(^|\s)\/\/.*$/gm, "$1");
}

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

export function sourceUpdatedAt(source: GitHubRepoSource): string {
	return source.repo.pushed_at || source.repo.updated_at;
}

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
