import {
	loadManifest,
	resolveManifestToolName,
	validateManifest,
} from "./context-lib";

async function main() {
	const repoRoot = process.cwd();
	const manifest = loadManifest(repoRoot);
	const issues = validateManifest(repoRoot, manifest);

	if (issues.length > 0) {
		console.error("Context validation failed:");
		for (const issue of issues) {
			console.error(`- ${issue.path}: ${issue.message}`);
		}
		process.exit(1);
	}

	console.log(
		`Context validation passed. Entries: ${manifest.entries.length}. Tool mappings: ${manifest.entries
			.map((entry) => resolveManifestToolName(entry))
			.join(", ")}`,
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
