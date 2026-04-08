import type { GitHubRepoSource, ProjectEvidence } from "../types";

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

export function readmeSynopsis(readme: string | null): string {
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

export function detectTechnologies(source: GitHubRepoSource): string[] {
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

export function buildEvidence(source: GitHubRepoSource, synopsis: string): ProjectEvidence[] {
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
