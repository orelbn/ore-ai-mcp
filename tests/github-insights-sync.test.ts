import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildProjectInsightOverrideIndex,
	buildProjectInsightSyncOperations,
	findDuplicateOverrideTargets,
	loadLocalProjectOverrides,
	planDeletedOverrideKeys,
} from "../scripts/github-insights-lib";

describe("github insights sync planning", () => {
	it("builds a stable override index", () => {
		expect(
			buildProjectInsightOverrideIndex([
				{
					filePath: "/tmp/b.json",
					override: { repo: "b" },
					remoteKey: "github-insights/v1/overrides/b.json",
				},
				{
					filePath: "/tmp/a.json",
					override: { repo: "a" },
					remoteKey: "github-insights/v1/overrides/a.json",
				},
			]),
		).toEqual({
			version: 1,
			managedKeys: [
				"github-insights/v1/overrides/a.json",
				"github-insights/v1/overrides/b.json",
			],
		});
	});

	it("plans deletes for keys removed locally", () => {
		expect(
			planDeletedOverrideKeys(
				[
					"github-insights/v1/overrides/a.json",
					"github-insights/v1/overrides/b.json",
				],
				["github-insights/v1/overrides/b.json"],
			),
		).toEqual(["github-insights/v1/overrides/a.json"]);
	});

	it("detects duplicate override targets", () => {
		expect(
			findDuplicateOverrideTargets([
				{
					filePath: "/tmp/a.json",
					override: { repo: "repo-a" },
					remoteKey: "github-insights/v1/overrides/repo-a.json",
				},
				{
					filePath: "/tmp/b.json",
					override: { repo: "repo-a" },
					remoteKey: "github-insights/v1/overrides/repo-a.json",
				},
			]),
		).toEqual(["github-insights/v1/overrides/repo-a.json"]);
	});

	it("rejects duplicate override targets while loading local files", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "github-insights-"));
		const overridesRoot = join(repoRoot, ".project-insights");
		mkdirSync(overridesRoot);
		writeFileSync(
			join(overridesRoot, "a.json"),
			JSON.stringify({ repo: "repo-a", summary: "one" }),
		);
		writeFileSync(
			join(overridesRoot, "b.json"),
			JSON.stringify({ repo: "repo-a", summary: "two" }),
		);

		try {
			expect(() => loadLocalProjectOverrides(repoRoot)).toThrow(
				"Duplicate override targets: github-insights/v1/overrides/repo-a.json",
			);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("places the override index upload after deletions", () => {
		expect(
			buildProjectInsightSyncOperations(
				[
					{
						filePath: "/tmp/b.json",
						override: { repo: "b" },
						remoteKey: "github-insights/v1/overrides/b.json",
					},
				],
				["github-insights/v1/overrides/a.json"],
				"/tmp/index.json",
				"github-insights/v1/overrides/_meta/index.json",
			),
		).toEqual([
			{
				type: "upload",
				remoteKey: "github-insights/v1/overrides/b.json",
				filePath: "/tmp/b.json",
			},
			{
				type: "delete",
				remoteKey: "github-insights/v1/overrides/a.json",
			},
			{
				type: "upload",
				remoteKey: "github-insights/v1/overrides/_meta/index.json",
				filePath: "/tmp/index.json",
			},
		]);
	});
});
