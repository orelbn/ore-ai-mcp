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

type SyncProjectInsightsDeps = {
  loadOverrides: typeof loadLocalProjectOverrides;
  runWranglerCommand: typeof runWrangler;
  writeFile: (path: string, data: string) => Promise<unknown>;
  makeTempDir: typeof mkdtempSync;
  removeDir: typeof rmSync;
  log: (message: string) => void;
};

type SyncLogSummary = {
  environment: string;
  mode: "dry-run" | "apply";
  overrideCount: number;
  deleteCount: number;
};

async function writeFileWithBun(path: string, data: string) {
  if (!("Bun" in globalThis) || !globalThis.Bun?.write) {
    throw new Error("Bun runtime is required for github-insights-sync");
  }
  return globalThis.Bun.write(path, data);
}

const defaultDeps: SyncProjectInsightsDeps = {
  loadOverrides: loadLocalProjectOverrides,
  runWranglerCommand: runWrangler,
  writeFile: writeFileWithBun,
  makeTempDir: mkdtempSync,
  removeDir: rmSync,
  log: console.log,
};

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

function logSyncSummary(log: SyncProjectInsightsDeps["log"], summary: SyncLogSummary) {
  log(`Environment: ${summary.environment}`);
  log(`Mode: ${summary.mode}`);
  log(`Override count: ${summary.overrideCount}`);
  log(`Delete count: ${summary.deleteCount}`);
}

function logDryRun(
  log: SyncProjectInsightsDeps["log"],
  overrides: ReturnType<typeof loadLocalProjectOverrides>,
  keysToDelete: string[],
) {
  for (const override of overrides) {
    log(`UPLOAD ${override.remoteKey} <= ${override.filePath}`);
  }
  for (const key of keysToDelete) {
    log(`DELETE ${key}`);
  }
  log(`UPLOAD ${PROJECT_INSIGHTS_OVERRIDES_INDEX_KEY} <= <generated>`);
}

async function uploadOverrides(
  tempDir: string,
  repoRoot: string,
  args: SyncArgs,
  overrides: ReturnType<typeof loadLocalProjectOverrides>,
  deps: Pick<SyncProjectInsightsDeps, "runWranglerCommand" | "writeFile">,
) {
  for (const override of overrides) {
    const filePath = join(tempDir, `${override.override.repo}.json`);
    await deps.writeFile(filePath, JSON.stringify(override.override, null, 2));
    deps.runWranglerCommand(kvCommand("put", override.remoteKey, args, filePath), repoRoot);
  }
}

function deleteMissingOverrides(
  repoRoot: string,
  args: SyncArgs,
  keysToDelete: string[],
  runWranglerCommand: typeof runWrangler,
) {
  for (const key of keysToDelete) {
    runWranglerCommand(kvCommand("delete", key, args), repoRoot);
  }
}

async function uploadOverrideIndex(
  tempDir: string,
  repoRoot: string,
  args: SyncArgs,
  nextIndex: ProjectInsightOverrideIndex,
  deps: Pick<SyncProjectInsightsDeps, "runWranglerCommand" | "writeFile">,
) {
  const indexPath = join(tempDir, "override-index.json");
  await deps.writeFile(indexPath, JSON.stringify(nextIndex, null, 2));
  deps.runWranglerCommand(
    kvCommand("put", PROJECT_INSIGHTS_OVERRIDES_INDEX_KEY, args, indexPath),
    repoRoot,
  );
}

function readRemoteOverrideIndex(
  repoRoot: string,
  args: SyncArgs,
  runWranglerCommand: typeof runWrangler,
): ProjectInsightOverrideIndex | null {
  try {
    const output = runWranglerCommand(
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

export async function syncProjectInsights(
  repoRoot: string,
  args: SyncArgs,
  deps: Partial<SyncProjectInsightsDeps> = {},
) {
  const { loadOverrides, log, makeTempDir, removeDir, runWranglerCommand, writeFile } = {
    ...defaultDeps,
    ...deps,
  };
  const overrides = loadOverrides(repoRoot);
  const nextIndex = buildProjectInsightOverrideIndex(overrides);
  const previousIndex = readRemoteOverrideIndex(repoRoot, args, runWranglerCommand);
  const keysToDelete = planDeletedOverrideKeys(
    previousIndex?.managedKeys ?? [],
    nextIndex.managedKeys,
  );

  logSyncSummary(log, {
    environment: args.env ?? "<top-level>",
    mode: args.dryRun ? "dry-run" : "apply",
    overrideCount: overrides.length,
    deleteCount: keysToDelete.length,
  });

  if (args.dryRun) {
    logDryRun(log, overrides, keysToDelete);
    return;
  }

  const tempDir = makeTempDir(join(tmpdir(), "project-insights-sync-"));
  try {
    await uploadOverrides(tempDir, repoRoot, args, overrides, { runWranglerCommand, writeFile });
    deleteMissingOverrides(repoRoot, args, keysToDelete, runWranglerCommand);
    await uploadOverrideIndex(tempDir, repoRoot, args, nextIndex, {
      runWranglerCommand,
      writeFile,
    });
  } finally {
    removeDir(tempDir, { recursive: true, force: true });
  }

  log(
    `Sync complete. Uploaded ${overrides.length} override file(s) and deleted ${keysToDelete.length}.`,
  );
}

async function main() {
  await syncProjectInsights(process.cwd(), parseSyncArgs(process.argv.slice(2)));
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
