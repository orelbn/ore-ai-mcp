import { loadLocalProjectOverrides } from "./github-insights-lib";

function main() {
	const repoRoot = process.cwd();
	const overrides = loadLocalProjectOverrides(repoRoot);
	console.log(
		`Validated ${overrides.length} local project insight override(s).`,
	);
}

main();
