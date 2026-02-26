import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTEXT_BUCKET_BINDING } from "../src/constants";
import type { SyncArgs } from "./context-types";

function stripComments(jsonc: string): string {
	return jsonc
		.replaceAll(/\/\*[\s\S]*?\*\//g, "")
		.replaceAll(/(^|\s)\/\/.*$/gm, "$1");
}

function parseWranglerConfig(raw: string): unknown {
	const stripped = stripComments(raw);
	return JSON.parse(stripped);
}

function buildWranglerEnvArgs(args: SyncArgs): string[] {
	const list: string[] = [];
	if (args.env && args.env.length > 0) {
		list.push("--env", args.env);
	}
	list.push(args.local ? "--local" : "--remote");
	return list;
}

export function resolveBucketName(
	repoRoot: string,
	envName?: string,
	binding = CONTEXT_BUCKET_BINDING,
): string {
	const configPath = join(repoRoot, "wrangler.jsonc");
	const raw = readFileSync(configPath, "utf8");
	const config = parseWranglerConfig(raw) as {
		r2_buckets?: Array<{ binding: string; bucket_name: string }>;
		env?: Record<
			string,
			{ r2_buckets?: Array<{ binding: string; bucket_name: string }> }
		>;
	};

	const buckets =
		envName && envName.length > 0
			? config.env?.[envName]?.r2_buckets
			: config.r2_buckets;

	if (!buckets || buckets.length === 0) {
		throw new Error(
			`No r2_buckets configured for ${envName ? `env ${envName}` : "top-level"}`,
		);
	}

	const match = buckets.find((bucket) => bucket.binding === binding);
	if (!match?.bucket_name) {
		throw new Error(
			`R2 bucket binding "${binding}" not found in wrangler config for ${envName ? `env ${envName}` : "top-level"}`,
		);
	}

	return match.bucket_name;
}

export function buildR2CommandForPut(
	bucketName: string,
	remoteKey: string,
	localFilePath: string,
	contentType: string,
	syncArgs: SyncArgs,
): string[] {
	return [
		"r2",
		"object",
		"put",
		`${bucketName}/${remoteKey}`,
		"--file",
		localFilePath,
		"--content-type",
		contentType,
		...buildWranglerEnvArgs(syncArgs),
	];
}

export function buildR2CommandForDelete(
	bucketName: string,
	remoteKey: string,
	syncArgs: SyncArgs,
): string[] {
	return [
		"r2",
		"object",
		"delete",
		`${bucketName}/${remoteKey}`,
		...buildWranglerEnvArgs(syncArgs),
	];
}

export function buildR2CommandForGet(
	bucketName: string,
	remoteKey: string,
	syncArgs: SyncArgs,
): string[] {
	return [
		"r2",
		"object",
		"get",
		`${bucketName}/${remoteKey}`,
		"--pipe",
		...buildWranglerEnvArgs(syncArgs),
	];
}

export function runWrangler(args: string[], cwd: string): string {
	const result = Bun.spawnSync({
		cmd: ["bunx", "wrangler", ...args],
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});

	const stdout = new TextDecoder().decode(result.stdout);
	const stderr = new TextDecoder().decode(result.stderr);

	if (result.exitCode === 0) {
		return stdout;
	}

	throw new Error(
		`Wrangler command failed: bunx wrangler ${args.join(" ")}\n${stderr || stdout}`,
	);
}
