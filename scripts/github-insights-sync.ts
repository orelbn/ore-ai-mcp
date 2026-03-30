import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PROJECT_INSIGHTS_KV_BINDING,
  PROJECT_INSIGHTS_OVERRIDES_INDEX_KEY,
} from "@/modules/github/constants";
import { parseSyncArgs, runWrangler, type SyncArgs } from "./context-lib";
import {
  buildProjectInsightOverrideIndex,
  loadLocalProjectOverrides,
  type ProjectInsightOverrideIndex,
  planDeletedOverrideKeys,
} from "./github-insights-lib";

function kvCommand(
  action: "get" | "put" | "delete",
  key: string,
  args: SyncArgs,
  filePath?: string,
): string[] {
  return [
    "kv",
    "key",
    action,
    key,
    "--binding",
    PROJECT_INSIGHTS_KV_BINDING,
    ...(action === "get" ? ["--text"] : []),
    ...(action === "put" && filePath ? ["--path", filePath] : []),
    ...(args.env ? ["--env", args.env] : []),
    args.local ? "--local" : "--remote",
  ];
}

function readRemoteOverrideIndex(
  repoRoot: string,
  args: SyncArgs,
): ProjectInsightOverrideIndex | null {
  try {
    const output = runWrangler(
      kvCommand("get", PROJECT_INSIGHTS_OVERRIDES_INDEX_KEY, args),
      repoRoot,
    ).trim();
    if (!output) return null;
    const parsed = JSON.parse(output) as ProjectInsightOverrideIndex;
    if (
      parsed.version === 1 &&
      Array.isArray(parsed.managedKeys) &&
      parsed.managedKeys.every((key) => typeof key === "string")
    ) {
      return parsed;
    }
    throw new Error("Remote override index schema is invalid.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/NotFound|No such key|No value found|No KV value found/.test(message)) {
      return null;
    }
    throw error;
  }
}

async function main() {
  const repoRoot = process.cwd();
  const args = parseSyncArgs(process.argv.slice(2));
  const overrides = loadLocalProjectOverrides(repoRoot);
  const nextIndex = buildProjectInsightOverrideIndex(overrides);
  const previousIndex = readRemoteOverrideIndex(repoRoot, args);
  const keysToDelete = planDeletedOverrideKeys(
    previousIndex?.managedKeys ?? [],
    nextIndex.managedKeys,
  );

  console.log(`Environment: ${args.env ?? "<top-level>"}`);
  console.log(`Mode: ${args.dryRun ? "dry-run" : "apply"}`);
  console.log(`Override count: ${overrides.length}`);
  console.log(`Delete count: ${keysToDelete.length}`);

  if (args.dryRun) {
    for (const override of overrides) {
      console.log(`UPLOAD ${override.remoteKey} <= ${override.filePath}`);
    }
    for (const key of keysToDelete) console.log(`DELETE ${key}`);
    console.log(`UPLOAD ${PROJECT_INSIGHTS_OVERRIDES_INDEX_KEY} <= <generated>`);
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), "project-insights-sync-"));
  try {
    for (const override of overrides) {
      const filePath = join(tempDir, `${override.override.repo}.json`);
      await Bun.write(filePath, JSON.stringify(override.override, null, 2));
      runWrangler(kvCommand("put", override.remoteKey, args, filePath), repoRoot);
    }
    for (const key of keysToDelete) {
      runWrangler(kvCommand("delete", key, args), repoRoot);
    }

    const indexPath = join(tempDir, "override-index.json");
    await Bun.write(indexPath, JSON.stringify(nextIndex, null, 2));
    runWrangler(kvCommand("put", PROJECT_INSIGHTS_OVERRIDES_INDEX_KEY, args, indexPath), repoRoot);
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
