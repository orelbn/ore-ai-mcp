import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	PROJECT_INSIGHTS_KV_BINDING,
	PROJECT_INSIGHTS_OVERRIDES_INDEX_KEY,
} from "@/modules/github";
import { parseSyncArgs } from "./context-lib";
import {
	buildProjectInsightOverrideIndex,
	buildProjectInsightSyncOperations,
	loadLocalProjectOverrides,
	type ProjectInsightOverrideIndex,
	planDeletedOverrideKeys,
} from "./github-insights-lib";
import {
	assertKvBindingConfigured,
	buildKvDeleteCommandForBinding,
	buildKvGetCommandForBinding,
	buildKvPutCommandForBinding,
	runWrangler,
} from "./github-insights-wrangler";

function tryReadRemoteOverrideIndex(
	repoRoot: string,
	syncArgs: ReturnType<typeof parseSyncArgs>,
): ProjectInsightOverrideIndex | null {
	try {
		const output = runWrangler(
			buildKvGetCommandForBinding(
				PROJECT_INSIGHTS_KV_BINDING,
				PROJECT_INSIGHTS_OVERRIDES_INDEX_KEY,
				syncArgs,
			),
			repoRoot,
		);
		if (!output.trim()) {
			return null;
		}
		const parsed = JSON.parse(output) as ProjectInsightOverrideIndex;
		if (
			parsed.version !== 1 ||
			!Array.isArray(parsed.managedKeys) ||
			parsed.managedKeys.some((key) => typeof key !== "string")
		) {
			throw new Error("Remote override index schema is invalid.");
		}
		return parsed;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (
			message.includes("NotFound") ||
			message.includes("No such key") ||
			message.includes("No value found") ||
			message.includes("No KV value found")
		) {
			return null;
		}
		throw error;
	}
}

async function main() {
	const repoRoot = process.cwd();
	const syncArgs = parseSyncArgs(process.argv.slice(2));
	const overrides = loadLocalProjectOverrides(repoRoot);
	const nextIndex = buildProjectInsightOverrideIndex(overrides);

	assertKvBindingConfigured(
		repoRoot,
		syncArgs.env,
		PROJECT_INSIGHTS_KV_BINDING,
	);
	const previousIndex = tryReadRemoteOverrideIndex(repoRoot, syncArgs);
	const keysToDelete = planDeletedOverrideKeys(
		previousIndex?.managedKeys ?? [],
		nextIndex.managedKeys,
	);

	console.log(`Environment: ${syncArgs.env ?? "<top-level>"}`);
	console.log(`Mode: ${syncArgs.dryRun ? "dry-run" : "apply"}`);
	console.log(`Override count: ${overrides.length}`);
	console.log(`Delete count: ${keysToDelete.length}`);

	if (syncArgs.dryRun) {
		for (const entry of overrides) {
			console.log(`UPLOAD ${entry.remoteKey} <= ${entry.filePath}`);
		}
		console.log(
			`UPLOAD ${PROJECT_INSIGHTS_OVERRIDES_INDEX_KEY} <= <generated>`,
		);
		for (const key of keysToDelete) {
			console.log(`DELETE ${key}`);
		}
		return;
	}

	const tempDir = mkdtempSync(join(tmpdir(), "project-insights-sync-"));
	try {
		const indexPath = join(tempDir, "override-index.json");
		await Bun.write(indexPath, JSON.stringify(nextIndex, null, 2));
		const operations = buildProjectInsightSyncOperations(
			overrides,
			keysToDelete,
			indexPath,
			PROJECT_INSIGHTS_OVERRIDES_INDEX_KEY,
		);

		for (const operation of operations) {
			if (operation.type === "upload") {
				runWrangler(
					buildKvPutCommandForBinding(
						PROJECT_INSIGHTS_KV_BINDING,
						operation.remoteKey,
						operation.filePath,
						syncArgs,
					),
					repoRoot,
				);
				continue;
			}

			runWrangler(
				buildKvDeleteCommandForBinding(
					PROJECT_INSIGHTS_KV_BINDING,
					operation.remoteKey,
					syncArgs,
				),
				repoRoot,
			);
		}
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}

	console.log(
		`Sync complete. Uploaded ${overrides.length} override file(s) and deleted ${keysToDelete.length}.`,
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
