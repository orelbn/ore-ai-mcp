import { describe, expect, it } from "bun:test";
import {
	buildProjectInsightOverrideIndex,
	buildProjectInsightSyncOperations,
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
