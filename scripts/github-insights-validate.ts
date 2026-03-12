import { loadLocalProjectOverrides } from "./github-insights-lib";

/**
 * Validates local project insight overrides found in the current working directory and logs the result.
 *
 * This function locates local project insight overrides for the repository rooted at the process's current
 * working directory and prints a one-line summary to the console indicating how many overrides were validated.
 */
function main() {
	const repoRoot = process.cwd();
	const overrides = loadLocalProjectOverrides(repoRoot);
	console.log(
		`Validated ${overrides.length} local project insight override(s).`,
	);
}

main();
