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

/**
 * Resolve the filesystem path to the repository's project insights directory.
 *
 * @param repoRoot - The repository root directory path
 * @returns The path to the `.project-insights` directory inside `repoRoot`
 */
export function resolveProjectInsightsRoot(repoRoot: string): string {
	return join(repoRoot, PROJECT_INSIGHTS_DIR);
}

/**
 * Loads and validates local project insight override files from the repository's .project-insights directory.
 *
 * Reads all `.json` files in the directory, parses and validates each against the projectInsightOverrideSchema, and returns a sorted list of overrides with their file paths and computed remote keys.
 *
 * @param repoRoot - The repository root directory to resolve the `.project-insights` folder from.
 * @returns An array of LocalProjectOverride objects for each valid override file, sorted by file name.
 * @throws Error if a file contains invalid JSON or if schema validation fails for a file (error message includes the file path and cause).
 */
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

/**
 * Builds the versioned index of managed remote keys from local project overrides.
 *
 * @param overrides - Local project override entries to include in the index
 * @returns An object with `version: 1` and `managedKeys` containing the overrides' `remoteKey` values sorted lexicographically
 */
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

/**
 * Determine which managed remote keys were removed between two key sets.
 *
 * @param previousManagedKeys - The list of remote keys that were previously managed.
 * @param nextManagedKeys - The list of remote keys that should be managed after changes.
 * @returns The keys that appear in `previousManagedKeys` but not in `nextManagedKeys`.
 */
export function planDeletedOverrideKeys(
	previousManagedKeys: string[],
	nextManagedKeys: string[],
): string[] {
	const nextKeySet = new Set(nextManagedKeys);
	return previousManagedKeys.filter((key) => !nextKeySet.has(key));
}

/**
 * Builds a sequence of remote synchronization operations for project insight overrides and the index.
 *
 * @param overrides - Local override entries to be uploaded; each produces an upload operation using its `remoteKey` and `filePath`
 * @param keysToDelete - Remote keys that should be deleted; each produces a delete operation
 * @param indexFilePath - Local filesystem path of the generated index file to upload
 * @param indexKey - Remote key under which the index file should be uploaded
 * @returns An array of sync operations: upload operations for each override, delete operations for each key in `keysToDelete`, and a final upload operation for the index file
 */
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
