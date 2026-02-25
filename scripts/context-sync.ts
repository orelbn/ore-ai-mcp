import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRIVATE_CONTEXT_INDEX_KEY } from "../src/constants";
import { contextIndexSchema } from "../src/context-index";
import {
	buildArtifacts,
	buildR2CommandForDelete,
	buildR2CommandForGet,
	buildR2CommandForPut,
	loadManifest,
	parseSyncArgs,
	planMirrorDeletes,
	resolveBucketName,
	runWrangler,
	type SyncArgs,
	validateManifest,
} from "./context-lib";

function tryReadRemoteIndex(
	repoRoot: string,
	bucketName: string,
	syncArgs: SyncArgs,
) {
	try {
		const output = runWrangler(
			buildR2CommandForGet(bucketName, PRIVATE_CONTEXT_INDEX_KEY, syncArgs),
			repoRoot,
		);
		if (!output.trim()) {
			return null;
		}
		const parsed = contextIndexSchema.safeParse(JSON.parse(output));
		if (!parsed.success) {
			throw new Error("Remote context index schema is invalid.");
		}
		return parsed.data;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (
			message.includes("NoSuchKey") ||
			message.includes("404") ||
			message.includes("not found")
		) {
			return null;
		}
		throw error;
	}
}

async function main() {
	const repoRoot = process.cwd();
	const parsedArgs = parseSyncArgs(process.argv.slice(2));

	const manifest = loadManifest(repoRoot);
	const issues = validateManifest(repoRoot, manifest);
	if (issues.length > 0) {
		throw new Error(
			`Context validation failed:\n${issues
				.map((issue) => `- ${issue.path}: ${issue.message}`)
				.join("\n")}`,
		);
	}

	const artifacts = buildArtifacts(repoRoot, manifest);
	const bucketName = resolveBucketName(repoRoot, parsedArgs.env);
	const previousIndex = tryReadRemoteIndex(repoRoot, bucketName, parsedArgs);
	const keysToDelete = planMirrorDeletes(
		previousIndex?.managedKeys ?? [],
		artifacts.index.managedKeys,
	);

	const tempDir = mkdtempSync(join(tmpdir(), "ore-ai-context-sync-"));
	try {
		const indexPath = join(tempDir, "context-index.json");
		await Bun.write(indexPath, JSON.stringify(artifacts.index, null, 2));

		console.log(`Target bucket: ${bucketName}`);
		console.log(`Environment: ${parsedArgs.env ?? "<top-level>"}`);
		console.log(`Mode: ${parsedArgs.dryRun ? "dry-run" : "apply"}`);
		console.log(`Upload count: ${artifacts.uploads.length + 1}`);
		console.log(`Delete count: ${keysToDelete.length}`);

		if (parsedArgs.dryRun) {
			for (const upload of artifacts.uploads) {
				console.log(`UPLOAD ${upload.remoteKey} <= ${upload.localPath}`);
			}
			console.log(`UPLOAD ${PRIVATE_CONTEXT_INDEX_KEY} <= ${indexPath}`);
			for (const key of keysToDelete) {
				console.log(`DELETE ${key}`);
			}
			return;
		}

		for (const upload of artifacts.uploads) {
			runWrangler(
				buildR2CommandForPut(
					bucketName,
					upload.remoteKey,
					upload.localPath,
					upload.contentType,
					parsedArgs,
				),
				repoRoot,
			);
		}

		runWrangler(
			buildR2CommandForPut(
				bucketName,
				PRIVATE_CONTEXT_INDEX_KEY,
				indexPath,
				"application/json",
				parsedArgs,
			),
			repoRoot,
		);

		for (const key of keysToDelete) {
			runWrangler(
				buildR2CommandForDelete(bucketName, key, parsedArgs),
				repoRoot,
			);
		}

		console.log(
			`Sync complete. Context index version ${artifacts.index.version} generated at ${artifacts.index.generatedAt}.`,
		);
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
