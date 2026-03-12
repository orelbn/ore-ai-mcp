import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_INSIGHTS_KV_BINDING } from "@/modules/github";
import { runWrangler } from "./context-lib";
import type { SyncArgs } from "./context-types";

function stripComments(jsonc: string): string {
	return jsonc
		.replaceAll(/\/\*[\s\S]*?\*\//g, "")
		.replaceAll(/(^|\s)\/\/.*$/gm, "$1");
}

function parseWranglerConfig(raw: string): unknown {
	return JSON.parse(stripComments(raw));
}

function buildWranglerEnvArgs(args: SyncArgs): string[] {
	const list: string[] = [];
	if (args.env && args.env.length > 0) {
		list.push("--env", args.env);
	}
	list.push(args.local ? "--local" : "--remote");
	return list;
}

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
