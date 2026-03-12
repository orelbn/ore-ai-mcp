import {
	findDuplicateOverrideTargets,
	loadLocalProjectOverrides,
} from "./github-insights-lib";

function main() {
	const repoRoot = process.cwd();
	const overrides = loadLocalProjectOverrides(repoRoot);
	const duplicateTargets = findDuplicateOverrideTargets(overrides);
	if (duplicateTargets.length > 0) {
		throw new Error(
			`Duplicate project insight override target(s): ${duplicateTargets.join(", ")}`,
		);
	}
	console.log(
		`Validated ${overrides.length} local project insight override(s).`,
	);
}

main();
