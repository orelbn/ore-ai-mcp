import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectInsightOverride } from "@/modules/github";
import {
	projectInsightOverrideSchema,
	projectOverrideKey,
} from "@/modules/github";

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

export type ProjectInsightSyncOperation =
	| {
			type: "upload";
			remoteKey: string;
			filePath: string;
	  }
	| {
			type: "delete";
			remoteKey: string;
	  };

export function resolveProjectInsightsRoot(repoRoot: string): string {
	return join(repoRoot, PROJECT_INSIGHTS_DIR);
}

export function loadLocalProjectOverrides(
	repoRoot: string,
): LocalProjectOverride[] {
	const root = resolveProjectInsightsRoot(repoRoot);
	if (!existsSync(root)) {
		return [];
	}

	return readdirSync(root)
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
			return {
				filePath,
				override: parsed.data,
				remoteKey: projectOverrideKey(parsed.data.repo),
			};
		});
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

export function buildProjectInsightSyncOperations(
	overrides: LocalProjectOverride[],
	keysToDelete: string[],
	indexFilePath: string,
	indexKey: string,
): ProjectInsightSyncOperation[] {
	return [
		...overrides.map((entry) => ({
			type: "upload" as const,
			remoteKey: entry.remoteKey,
			filePath: entry.filePath,
		})),
		...keysToDelete.map((remoteKey) => ({
			type: "delete" as const,
			remoteKey,
		})),
		{
			type: "upload" as const,
			remoteKey: indexKey,
			filePath: indexFilePath,
		},
	];
}
