import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_INSIGHTS_KV_BINDING } from "@/modules/github";
import { runWrangler } from "./context-lib";
import type { SyncArgs } from "./context-types";

/**
 * Removes JavaScript-style block (/* ... *\/) and line (// ...) comments from a JSONC string.
 *
 * @param jsonc - The input string containing JSON with comments
 * @returns The input string with block and line comments removed
 */
function stripComments(jsonc: string): string {
	return jsonc
		.replaceAll(/\/\*[\s\S]*?\*\//g, "")
		.replaceAll(/(^|\s)\/\/.*$/gm, "$1");
}

/**
 * Parses a Wrangler JSONC configuration string into an object.
 *
 * Comments (line `//` and block `/* ... *\/`) are removed before parsing.
 *
 * @param raw - The contents of a wrangler.jsonc file, may include comments
 * @returns The parsed configuration object
 */
function parseWranglerConfig(raw: string): unknown {
	return JSON.parse(stripComments(raw));
}

/**
 * Constructs Wrangler CLI environment-related arguments from the given sync options.
 *
 * @param args - Sync options where `env` is the Wrangler environment name (optional) and `local` selects local mode when true
 * @returns An array of Wrangler CLI arguments; includes `--env` and the environment name when provided, and either `--local` or `--remote`
 */
function buildWranglerEnvArgs(args: SyncArgs): string[] {
	const list: string[] = [];
	if (args.env && args.env.length > 0) {
		list.push("--env", args.env);
	}
	list.push(args.local ? "--local" : "--remote");
	return list;
}

/**
 * Verifies that a Cloudflare Worker KV binding is declared in the repository's wrangler.jsonc.
 *
 * Checks either the top-level `kv_namespaces` or the `kv_namespaces` for the specified environment and throws an error if the file is missing, no namespaces are configured for the chosen scope, or the specified binding is not present.
 *
 * @param repoRoot - Path to the repository root containing `wrangler.jsonc`
 * @param envName - Optional environment name to validate (if omitted, top-level namespaces are checked)
 * @param binding - The KV binding name to look for
 * @throws Error if `wrangler.jsonc` does not exist
 * @throws Error if no `kv_namespaces` are configured for the chosen scope (top-level or the specified env)
 * @throws Error if the given KV binding is not found in the configured namespaces for the chosen scope
 */
export function assertKvBindingConfigured(
	repoRoot: string,
	envName?: string,
	binding = PROJECT_INSIGHTS_KV_BINDING,
): void {
	const configPath = join(repoRoot, "wrangler.jsonc");
	if (!existsSync(configPath)) {
		throw new Error(
			"Missing wrangler.jsonc. Copy wrangler.jsonc.example to wrangler.jsonc and configure your bindings first.",
		);
	}

	const config = parseWranglerConfig(readFileSync(configPath, "utf8")) as {
		kv_namespaces?: Array<{ binding: string }>;
		env?: Record<string, { kv_namespaces?: Array<{ binding: string }> }>;
	};

	const namespaces =
		envName && envName.length > 0
			? config.env?.[envName]?.kv_namespaces
			: config.kv_namespaces;
	if (!namespaces || namespaces.length === 0) {
		throw new Error(
			`No kv_namespaces configured for ${envName ? `env ${envName}` : "top-level"}`,
		);
	}

	const match = namespaces.find((namespace) => namespace.binding === binding);
	if (!match) {
		throw new Error(
			`KV binding "${binding}" not found in wrangler config for ${envName ? `env ${envName}` : "top-level"}`,
		);
	}
}

/**
 * Constructs the Wrangler CLI argument array to put a local file into a KV namespace binding.
 *
 * @param binding - The KV namespace binding name to target
 * @param key - The KV key under which the file will be stored
 * @param localFilePath - Path to the local file to upload as the value
 * @param syncArgs - Sync options that may add environment or local/remote flags
 * @returns The CLI arguments for `wrangler kv key put` targeting the specified binding and key
 */
export function buildKvPutCommandForBinding(
	binding: string,
	key: string,
	localFilePath: string,
	syncArgs: SyncArgs,
): string[] {
	return [
		"kv",
		"key",
		"put",
		key,
		"--path",
		localFilePath,
		"--binding",
		binding,
		...buildWranglerEnvArgs(syncArgs),
	];
}

/**
 * Builds a Wrangler CLI argument array to retrieve a KV entry as text from a specific binding.
 *
 * @param binding - The Wrangler KV binding name to target
 * @param key - The key of the KV entry to retrieve
 * @param syncArgs - Options that determine environment and local/remote flags
 * @returns An array of command-line arguments for `wrangler kv key get` that requests text output for the specified key and binding, including environment-related flags
 */
export function buildKvGetCommandForBinding(
	binding: string,
	key: string,
	syncArgs: SyncArgs,
): string[] {
	return [
		"kv",
		"key",
		"get",
		key,
		"--text",
		"--binding",
		binding,
		...buildWranglerEnvArgs(syncArgs),
	];
}

/**
 * Constructs Wrangler CLI arguments to delete a KV entry from the specified binding.
 *
 * @param binding - The name of the KV binding to target
 * @param key - The key of the KV entry to delete
 * @param syncArgs - Synchronization options that control environment and local/remote flags
 * @returns An array of Wrangler CLI arguments that delete the given key from the specified binding, including environment flags from `syncArgs`
 */
export function buildKvDeleteCommandForBinding(
	binding: string,
	key: string,
	syncArgs: SyncArgs,
): string[] {
	return [
		"kv",
		"key",
		"delete",
		key,
		"--binding",
		binding,
		...buildWranglerEnvArgs(syncArgs),
	];
}

export { runWrangler };
