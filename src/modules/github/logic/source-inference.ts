import type { GitHubRepoSource, ProjectComponent, ProjectDesignDecision } from "../types";

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

export function buildSummaryText(
  source: GitHubRepoSource,
  technologies: string[],
  synopsis: string,
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

export function buildComponents(
  source: GitHubRepoSource,
  technologies: string[],
): ProjectComponent[] {
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

export function buildDesignDecisions(
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

export function buildArchitectureOverview(source: GitHubRepoSource, synopsis: string): string {
  if (source.repo.description) {
    return `${source.repo.description}${synopsis ? ` ${synopsis}` : ""}`.slice(0, 700);
  }

  return synopsis || "Architecture inferred from repository structure and manifests.";
}
