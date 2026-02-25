import type { SyncArgs } from "./context-types";

export function parseSyncArgs(argv: string[]): SyncArgs {
	let env: string | undefined;
	let dryRun = false;
	let local = false;

	for (let index = 0; index < argv.length; index++) {
		const token = argv[index];
		if (token === "--env") {
			const value = argv[index + 1];
			if (!value) {
				throw new Error("--env requires a value");
			}
			env = value;
			index++;
			continue;
		}
		if (token.startsWith("--env=")) {
			env = token.slice("--env=".length);
			continue;
		}
		if (token === "--dry-run") {
			dryRun = true;
			continue;
		}
		if (token === "--local") {
			local = true;
			continue;
		}
		if (token === "--remote") {
			local = false;
			continue;
		}
		throw new Error(`Unknown argument: ${token}`);
	}

	return {
		env,
		dryRun,
		local,
	};
}
