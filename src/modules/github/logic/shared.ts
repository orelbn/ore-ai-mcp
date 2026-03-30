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

const DEPENDENCY_SECTIONS = ["dependencies", "devDependencies", "peerDependencies"] as const;

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

const FRONTEND_TECHNOLOGIES = new Set(["React", "Next.js", "Vue", "Astro", "Svelte"]);

const BACKEND_TECHNOLOGIES = new Set(["Hono", "Express", "Fastify"]);

const FALLBACK_COMPONENT: ProjectComponent = {
  name: "Application core",
  responsibility: "Contains the main project logic inferred from the repository structure.",
};

const FALLBACK_DECISION: ProjectDesignDecision = {
  title: "Convention-over-configuration structure",
  rationale:
    "The repository structure provides the main architectural clues, with limited explicit design documentation.",
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`;
}

export async function computeOverrideSignature(
  override: ProjectInsightOverride | null,
): Promise<string | null> {
  if (!override) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(stableJson(override)),
  );
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function readmeSynopsis(readme: string | null): string {
  if (!readme) return "";
  return readme
    .replaceAll(/```[\s\S]*?```/g, "")
    .split("\n")
    .map((line) =>
      line
        .replaceAll(/!\[[^\]]*]\([^)]*\)/g, "")
        .replaceAll(/\[[^\]]*]\([^)]*\)/g, "")
        .replaceAll(/^#+\s*/g, "")
        .trim(),
    )
    .filter((line) => line.length > 20 && !line.startsWith("!"))
    .slice(0, 3)
    .join(" ")
    .slice(0, 600);
}

function parsePackageJson(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(
      value.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/(^|\s)\/\/.*$/gm, "$1"),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function detectTechnologies(source: GitHubRepoSource): string[] {
  const technologies = new Set([...Object.keys(source.languages), ...(source.repo.topics ?? [])]);

  const packageJson = parsePackageJson(source.manifestContents["package.json"]);
  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies = packageJson?.[section];
    if (!dependencies || typeof dependencies !== "object") continue;
    for (const dependency of Object.keys(dependencies as Record<string, unknown>)) {
      const mapped = DEPENDENCY_TECH_MAP[dependency];
      if (mapped) technologies.add(mapped);
    }
  }

  if (source.manifestContents["wrangler.jsonc"] || source.manifestContents["wrangler.toml"]) {
    technologies.add("Cloudflare Workers");
  }
  if (source.manifestContents.Dockerfile) technologies.add("Docker");
  if (source.manifestContents["pnpm-workspace.yaml"] || source.manifestContents["turbo.json"]) {
    technologies.add("Monorepo");
  }

  return [...technologies].filter(Boolean).sort((left, right) => left.localeCompare(right));
}

function buildEvidence(
  source: GitHubRepoSource,
  synopsis = readmeSynopsis(source.readme),
): ProjectEvidence[] {
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
      detail: synopsis.slice(0, 280) || "README present",
    });
  }

  const topLanguages = Object.entries(source.languages)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([language]) => language)
    .join(", ");
  if (topLanguages) {
    evidence.push({
      type: "languages",
      label: "Languages",
      detail: topLanguages,
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

function summaryText(
  source: GitHubRepoSource,
  technologies: string[],
  synopsis = readmeSynopsis(source.readme),
): string {
  if (source.repo.description && synopsis) {
    return `${source.repo.description}. ${synopsis}`.slice(0, 700);
  }
  if (synopsis) return synopsis.slice(0, 700);
  if (source.repo.description) return source.repo.description;
  if (technologies.length) {
    return `Public project built with ${technologies.slice(0, 5).join(", ")}.`;
  }
  return "Public project with limited repository metadata available.";
}

function buildComponents(source: GitHubRepoSource, technologies: string[]): ProjectComponent[] {
  const rootDirs = new Set(
    source.rootEntries.filter((entry) => entry.type === "dir").map((entry) => entry.name),
  );

  const components: ProjectComponent[] = [
    ...(source.manifestContents["wrangler.jsonc"] || source.manifestContents["wrangler.toml"]
      ? [
          {
            name: "Cloudflare Worker",
            responsibility: "Handles the deployed edge runtime and request processing.",
          } satisfies ProjectComponent,
        ]
      : []),
    ...(rootDirs.has("apps") || rootDirs.has("packages")
      ? [
          {
            name: "Monorepo workspace",
            responsibility:
              "Organizes multiple apps or packages behind a shared repository structure.",
          } satisfies ProjectComponent,
        ]
      : []),
    ...(technologies.some((technology) => FRONTEND_TECHNOLOGIES.has(technology))
      ? [
          {
            name: "Frontend application",
            responsibility: "Provides the user-facing interface.",
          } satisfies ProjectComponent,
        ]
      : []),
    ...(technologies.some((technology) => BACKEND_TECHNOLOGIES.has(technology))
      ? [
          {
            name: "Backend API",
            responsibility: "Implements application logic and server-side endpoints.",
          } satisfies ProjectComponent,
        ]
      : []),
    ...(source.manifestContents.Dockerfile
      ? [
          {
            name: "Container runtime",
            responsibility: "Packages the application for repeatable deployment.",
          } satisfies ProjectComponent,
        ]
      : []),
  ];

  return (components.length ? components : [FALLBACK_COMPONENT]).slice(0, 5);
}

function buildDesignDecisions(
  source: GitHubRepoSource,
  technologies: string[],
): ProjectDesignDecision[] {
  const decisions: ProjectDesignDecision[] = [
    ...(technologies.includes("Cloudflare Workers")
      ? [
          {
            title: "Edge-first deployment",
            rationale:
              "Cloudflare configuration files indicate the project is designed to run at the edge.",
          } satisfies ProjectDesignDecision,
        ]
      : []),
    ...(technologies.includes("Monorepo")
      ? [
          {
            title: "Workspace-based organization",
            rationale:
              "Workspace manifests suggest the repository is structured to share code across multiple packages or apps.",
          } satisfies ProjectDesignDecision,
        ]
      : []),
    ...(source.readme
      ? [
          {
            title: "README-driven onboarding",
            rationale:
              "The repository includes project-facing documentation that shapes contributor or operator workflows.",
          } satisfies ProjectDesignDecision,
        ]
      : []),
  ];

  return (decisions.length ? decisions : [FALLBACK_DECISION]).slice(0, 5);
}

function escapeMermaidLabel(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll(/[\r\n]+/g, " ");
}

function buildMermaidDiagram(components: ProjectComponent[]): string {
  if (!components.length) return ["flowchart LR", '  Client["Client"]'].join("\n");
  return [
    "flowchart LR",
    ...components.map((component, index) =>
      index === 0
        ? `  Client["Client"] --> C1["${escapeMermaidLabel(component.name)}"]`
        : `  C${index}["${escapeMermaidLabel(components[index - 1].name)}"] --> C${index + 1}["${escapeMermaidLabel(component.name)}"]`,
    ),
  ].join("\n");
}

function addOverrideEvidence(
  evidence: ProjectEvidence[],
  override: ProjectInsightOverride | null,
): ProjectEvidence[] {
  if (!override) return evidence;
  return [
    ...evidence,
    {
      type: "override",
      label: "Manual override",
      detail: `Override data applied for ${override.repo}`,
    },
    ...(override.notes
      ? [
          {
            type: "override",
            label: "Override notes",
            detail: override.notes,
          } satisfies ProjectEvidence,
        ]
      : []),
  ];
}

function architectureOverview(source: GitHubRepoSource, synopsis: string): string {
  return source.repo.description
    ? `${source.repo.description}${synopsis ? ` ${synopsis}` : ""}`.slice(0, 700)
    : synopsis || "Architecture inferred from repository structure and manifests.";
}

function buildHeuristicInputs(source: GitHubRepoSource) {
  const synopsis = readmeSynopsis(source.readme);
  const technologies = detectTechnologies(source);
  return {
    synopsis,
    technologies,
    evidence: buildEvidence(source, synopsis),
  };
}

export function buildHeuristicSummaryDraft(
  source: GitHubRepoSource,
  override: ProjectInsightOverride | null,
): ProjectSummaryDraft {
  const { synopsis, technologies, evidence } = buildHeuristicInputs(source);
  return {
    repo: source.repo.name,
    name: source.repo.name,
    summary: override?.summary ?? summaryText(source, technologies, synopsis),
    technologies: override?.technologies ?? technologies,
    evidence,
    provider: "heuristic",
  };
}

export function buildHeuristicArchitectureDraft(
  source: GitHubRepoSource,
  override: ProjectInsightOverride | null,
): ProjectArchitectureDraft {
  const { synopsis, technologies, evidence } = buildHeuristicInputs(source);
  const components = override?.components ?? buildComponents(source, technologies);
  return {
    repo: source.repo.name,
    overview: override?.overview ?? architectureOverview(source, synopsis),
    components,
    designDecisions: override?.designDecisions ?? buildDesignDecisions(source, technologies),
    diagramMermaid: override?.diagramMermaid ?? buildMermaidDiagram(components),
    evidence,
    provider: "heuristic",
  };
}

export function applySummaryOverride(
  draft: ProjectSummaryDraft,
  override: ProjectInsightOverride | null,
): ProjectSummaryDraft {
  if (!override) return draft;
  return {
    ...draft,
    summary: override.summary ?? draft.summary,
    technologies: override.technologies ?? draft.technologies,
    evidence: addOverrideEvidence(draft.evidence, override),
  };
}

export function applyArchitectureOverride(
  draft: ProjectArchitectureDraft,
  override: ProjectInsightOverride | null,
): ProjectArchitectureDraft {
  if (!override) return draft;
  const components = override.components ?? draft.components;
  return {
    ...draft,
    overview: override.overview ?? draft.overview,
    components,
    designDecisions: override.designDecisions ?? draft.designDecisions,
    diagramMermaid:
      override.diagramMermaid ??
      (override.components ? buildMermaidDiagram(components) : draft.diagramMermaid),
    evidence: addOverrideEvidence(draft.evidence, override),
  };
}

export function sourceUpdatedAt(source: GitHubRepoSource): string {
  return source.repo.pushed_at || source.repo.updated_at;
}

export function requireRepoName(repo: string): string {
  const trimmed = repo.trim();
  if (!trimmed) throw new AppError("INVALID_INPUT", "repo is required", 400);
  if (!trimmed.includes("/")) return trimmed;

  const parts = trimmed.split("/");
  if (parts.length === 2 && parts[0] && parts[1]) return parts[1];

  throw new AppError("INVALID_INPUT", "repo must be a repository name or <owner>/<repo>", 400);
}
