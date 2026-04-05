import type {
  GitHubRepoSource,
  ProjectArchitectureDraft,
  ProjectComponent,
  ProjectDesignDecision,
  ProjectEvidence,
  ProjectInsightOverride,
  ProjectSummaryDraft,
} from "../types";
import { buildMermaidDiagram } from "./diagram";

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

function readmeSynopsis(readme: string | null): string {
  if (!readme) {
    return "";
  }

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
  if (!value) {
    return null;
  }

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
    if (!dependencies || typeof dependencies !== "object") {
      continue;
    }

    for (const dependency of Object.keys(dependencies as Record<string, unknown>)) {
      const mappedTechnology = DEPENDENCY_TECH_MAP[dependency];
      if (mappedTechnology) {
        technologies.add(mappedTechnology);
      }
    }
  }

  if (source.manifestContents["wrangler.jsonc"] || source.manifestContents["wrangler.toml"]) {
    technologies.add("Cloudflare Workers");
  }
  if (source.manifestContents.Dockerfile) {
    technologies.add("Docker");
  }
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
  if (synopsis) {
    return synopsis.slice(0, 700);
  }
  if (source.repo.description) {
    return source.repo.description;
  }
  if (technologies.length) {
    return `Public project built with ${technologies.slice(0, 5).join(", ")}.`;
  }
  return "Public project with limited repository metadata available.";
}

function buildComponents(source: GitHubRepoSource, technologies: string[]): ProjectComponent[] {
  const rootDirs = new Set(
    source.rootEntries.filter((entry) => entry.type === "dir").map((entry) => entry.name),
  );

  const components: ProjectComponent[] = [];

  if (source.manifestContents["wrangler.jsonc"] || source.manifestContents["wrangler.toml"]) {
    components.push({
      name: "Cloudflare Worker",
      responsibility: "Handles the deployed edge runtime and request processing.",
    });
  }

  if (rootDirs.has("apps") || rootDirs.has("packages")) {
    components.push({
      name: "Monorepo workspace",
      responsibility: "Organizes multiple apps or packages behind a shared repository structure.",
    });
  }

  if (technologies.some((technology) => FRONTEND_TECHNOLOGIES.has(technology))) {
    components.push({
      name: "Frontend application",
      responsibility: "Provides the user-facing interface.",
    });
  }

  if (technologies.some((technology) => BACKEND_TECHNOLOGIES.has(technology))) {
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

  return (components.length ? components : [FALLBACK_COMPONENT]).slice(0, 5);
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

  return (decisions.length ? decisions : [FALLBACK_DECISION]).slice(0, 5);
}

function architectureOverview(source: GitHubRepoSource, synopsis: string): string {
  if (source.repo.description) {
    return `${source.repo.description}${synopsis ? ` ${synopsis}` : ""}`.slice(0, 700);
  }

  return synopsis || "Architecture inferred from repository structure and manifests.";
}

function buildHeuristicInputs(source: GitHubRepoSource): {
  synopsis: string;
  technologies: string[];
  evidence: ProjectEvidence[];
} {
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

export function sourceUpdatedAt(source: GitHubRepoSource): string {
  return source.repo.pushed_at || source.repo.updated_at;
}
