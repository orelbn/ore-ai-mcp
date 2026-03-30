import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requireRepoName } from "@/modules/github/logic/shared";
import { projectOverrideKey } from "@/modules/github/repo/project-insights-kv";
import { projectInsightOverrideSchema } from "@/modules/github/schema";
import type { ProjectInsightOverride } from "@/modules/github/types";

export const PROJECT_INSIGHTS_DIR = ".project-insights";

export type LocalProjectOverride = {
  filePath: string;
  override: ProjectInsightOverride;
  remoteKey: string;
};

export type ProjectInsightOverrideIndex = {
  version: 1;
  managedKeys: string[];
};

export function resolveProjectInsightsRoot(repoRoot: string): string {
  return join(repoRoot, PROJECT_INSIGHTS_DIR);
}

export function loadLocalProjectOverrides(repoRoot: string): LocalProjectOverride[] {
  const root = resolveProjectInsightsRoot(repoRoot);
  if (!existsSync(root)) {
    return [];
  }

  const overrides = readdirSync(root)
    .filter((entry) => entry.toLowerCase().endsWith(".json"))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => {
      const filePath = join(root, entry);
      const raw = readFileSync(filePath, "utf8");
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch (error) {
        throw new Error(`Override file is not valid JSON: ${filePath}`, {
          cause: error,
        });
      }
      const parsed = projectInsightOverrideSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error(
          `Override schema validation failed for ${filePath}: ${parsed.error.issues
            .map((issue) => issue.message)
            .join("; ")}`,
        );
      }
      const normalizedRepo = requireRepoName(parsed.data.repo);
      return {
        filePath,
        override: {
          ...parsed.data,
          repo: normalizedRepo,
        },
        remoteKey: projectOverrideKey(normalizedRepo),
      };
    });

  const duplicatePathsByRemoteKey = new Map<string, string[]>();
  for (const override of overrides) {
    const nextPaths = duplicatePathsByRemoteKey.get(override.remoteKey) ?? [];
    nextPaths.push(override.filePath);
    duplicatePathsByRemoteKey.set(override.remoteKey, nextPaths);
  }

  const duplicateTargets = [...duplicatePathsByRemoteKey.entries()]
    .filter(([, filePaths]) => filePaths.length > 1)
    .map(([remoteKey, filePaths]) => `${remoteKey} (${filePaths.join(", ")})`)
    .sort((left, right) => left.localeCompare(right));

  if (duplicateTargets.length > 0) {
    throw new Error(`Duplicate override targets: ${duplicateTargets.join("; ")}`);
  }

  return overrides;
}

export function buildProjectInsightOverrideIndex(
  overrides: LocalProjectOverride[],
): ProjectInsightOverrideIndex {
  return {
    version: 1,
    managedKeys: overrides
      .map((entry) => entry.remoteKey)
      .sort((left, right) => left.localeCompare(right)),
  };
}

export function planDeletedOverrideKeys(
  previousManagedKeys: string[],
  nextManagedKeys: string[],
): string[] {
  const nextKeySet = new Set(nextManagedKeys);
  return previousManagedKeys.filter((key) => !nextKeySet.has(key));
}
