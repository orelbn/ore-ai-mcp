import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildR2CommandForDelete,
	buildR2CommandForGet,
	buildR2CommandForPut,
	resolveBucketName,
} from "../scripts/context-wrangler";

function makeTempRepoWithWrangler(config: string): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "ore-ai-wrangler-test-"));
	writeFileSync(join(repoRoot, "wrangler.jsonc"), config);
	return repoRoot;
}

describe("context wrangler helpers", () => {
	it("resolves top-level and production env bucket names from jsonc", () => {
		const repoRoot = makeTempRepoWithWrangler(`{
			// top-level bucket
			"r2_buckets": [
				{ "binding": "PRIVATE_CONTEXT_BUCKET", "bucket_name": "ore-context" }
			],
			"env": {
				"production": {
					"r2_buckets": [
						{ "binding": "PRIVATE_CONTEXT_BUCKET", "bucket_name": "ore-context-production" }
					]
				}
			}
		}`);

		expect(resolveBucketName(repoRoot)).toBe("ore-context");
		expect(resolveBucketName(repoRoot, "production")).toBe(
			"ore-context-production",
		);

		rmSync(repoRoot, { recursive: true, force: true });
	});

	it("fails when binding is missing", () => {
		const repoRoot = makeTempRepoWithWrangler(`{
			"r2_buckets": [
				{ "binding": "DIFFERENT_BINDING", "bucket_name": "ore-context" }
			]
		}`);

		expect(() => resolveBucketName(repoRoot)).toThrow("binding");

		rmSync(repoRoot, { recursive: true, force: true });
	});

	it("builds put/delete/get commands with env and mode flags", () => {
		const syncArgs = { env: "production", dryRun: false, local: true };
		expect(
			buildR2CommandForPut(
				"ore-context",
				"private-context/markdown/doc.md",
				"/tmp/doc.md",
				"text/markdown",
				syncArgs,
			),
		).toEqual([
			"r2",
			"object",
			"put",
			"ore-context/private-context/markdown/doc.md",
			"--file",
			"/tmp/doc.md",
			"--content-type",
			"text/markdown",
			"--env",
			"production",
			"--local",
		]);

		expect(
			buildR2CommandForDelete(
				"ore-context",
				"private-context/images/photo.jpg",
				{
					env: "production",
					dryRun: false,
					local: false,
				},
			),
		).toEqual([
			"r2",
			"object",
			"delete",
			"ore-context/private-context/images/photo.jpg",
			"--env",
			"production",
			"--remote",
		]);

		expect(
			buildR2CommandForGet(
				"ore-context",
				"private-context/_meta/context-index.json",
				{
					env: undefined,
					dryRun: true,
					local: false,
				},
			),
		).toEqual([
			"r2",
			"object",
			"get",
			"ore-context/private-context/_meta/context-index.json",
			"--pipe",
			"--remote",
		]);
	});
});
