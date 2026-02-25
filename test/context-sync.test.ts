import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildArtifacts,
	loadManifest,
	planMirrorDeletes,
	resolveManifestToolName,
	validateManifest,
} from "../scripts/context-lib";
import { PRIVATE_CONTEXT_INDEX_KEY } from "../src/constants";

function makeTempRepo(): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "ore-ai-context-test-"));
	mkdirSync(join(repoRoot, ".private-context", "notes", "coffee"), {
		recursive: true,
	});
	mkdirSync(join(repoRoot, ".private-context", "images"), { recursive: true });
	return repoRoot;
}

describe("context sync planning", () => {
	it("derives tool names from context ids when toolName is omitted", () => {
		expect(
			resolveManifestToolName({
				contextId: "Orel Favorite Hot Chocolates",
				title: "Hot Chocolates",
				markdownPath: "notes/drinks/hot-chocolate.md",
			}),
		).toBe("ore.context.orel_favorite_hot_chocolates");
	});

	it("fails validation when markdown file is missing", () => {
		const repoRoot = makeTempRepo();
		writeFileSync(
			join(repoRoot, ".private-context", "context-manifest.json"),
			JSON.stringify(
				{
					version: 1,
					entries: [
						{
							contextId: "orel-top-coffee-shops",
							title: "Orel Top Coffee Shops",
							markdownPath: "notes/coffee/missing.md",
							imagePaths: [],
						},
					],
				},
				null,
				2,
			),
		);

		const manifest = loadManifest(repoRoot);
		const issues = validateManifest(repoRoot, manifest);
		expect(
			issues.some((issue) => issue.message.includes("does not exist")),
		).toBeTrue();

		rmSync(repoRoot, { recursive: true, force: true });
	});

	it("fails to load manifest when explicit toolName has invalid characters", () => {
		const repoRoot = makeTempRepo();
		writeFileSync(
			join(repoRoot, ".private-context", "notes", "coffee", "top.md"),
			"# Coffee",
		);
		writeFileSync(
			join(repoRoot, ".private-context", "context-manifest.json"),
			JSON.stringify(
				{
					version: 1,
					entries: [
						{
							contextId: "orel-top-coffee-shops",
							title: "Orel Top Coffee Shops",
							toolName: "ore.context.bad tool",
							markdownPath: "notes/coffee/top.md",
						},
					],
				},
				null,
				2,
			),
		);

		expect(() => loadManifest(repoRoot)).toThrow(
			"toolName must use [a-z0-9._-]",
		);

		rmSync(repoRoot, { recursive: true, force: true });
	});

	it("fails validation when image file is missing", () => {
		const repoRoot = makeTempRepo();
		writeFileSync(
			join(repoRoot, ".private-context", "notes", "coffee", "top.md"),
			"# Coffee",
		);
		writeFileSync(
			join(repoRoot, ".private-context", "context-manifest.json"),
			JSON.stringify(
				{
					version: 1,
					entries: [
						{
							contextId: "orel-top-coffee-shops",
							title: "Orel Top Coffee Shops",
							markdownPath: "notes/coffee/top.md",
							imagePaths: ["images/missing.jpg"],
						},
					],
				},
				null,
				2,
			),
		);

		const manifest = loadManifest(repoRoot);
		const issues = validateManifest(repoRoot, manifest);
		expect(
			issues.some((issue) => issue.path === "images/missing.jpg"),
		).toBeTrue();

		rmSync(repoRoot, { recursive: true, force: true });
	});

	it("fails validation for duplicate ids and unsafe paths", () => {
		const repoRoot = makeTempRepo();
		writeFileSync(
			join(repoRoot, ".private-context", "notes", "coffee", "top.md"),
			"# Coffee",
		);
		writeFileSync(
			join(repoRoot, ".private-context", "context-manifest.json"),
			JSON.stringify(
				{
					version: 1,
					entries: [
						{
							contextId: "duplicate-id",
							title: "Entry One",
							markdownPath: "notes/coffee/top.md",
						},
						{
							contextId: "duplicate-id",
							title: "Entry Two",
							markdownPath: "../escape.md",
						},
					],
				},
				null,
				2,
			),
		);

		const manifest = loadManifest(repoRoot);
		const issues = validateManifest(repoRoot, manifest);
		expect(
			issues.some((issue) => issue.message.includes("Duplicate contextId")),
		).toBeTrue();
		expect(
			issues.some((issue) =>
				issue.message.includes("Duplicate toolName mapping"),
			),
		).toBeTrue();
		expect(
			issues.some((issue) => issue.message.includes("safe relative path")),
		).toBeTrue();

		rmSync(repoRoot, { recursive: true, force: true });
	});

	it("builds index and managed keys", () => {
		const repoRoot = makeTempRepo();
		writeFileSync(
			join(repoRoot, ".private-context", "notes", "coffee", "top.md"),
			"# Coffee",
		);
		writeFileSync(
			join(repoRoot, ".private-context", "images", "latte.jpg"),
			"image-bytes",
		);
		writeFileSync(
			join(repoRoot, ".private-context", "context-manifest.json"),
			JSON.stringify(
				{
					version: 1,
					entries: [
						{
							contextId: "orel-top-coffee-shops",
							title: "Orel Top Coffee Shops",
							markdownPath: "notes/coffee/top.md",
							imagePaths: ["images/latte.jpg"],
						},
					],
				},
				null,
				2,
			),
		);

		const manifest = loadManifest(repoRoot);
		const artifacts = buildArtifacts(
			repoRoot,
			manifest,
			"2026-02-24T00:00:00.000Z",
		);

		expect(
			artifacts.index.tools["ore.context.orel_top_coffee_shops"]?.markdownKey,
		).toBe("private-context/markdown/orel-top-coffee-shops.md");
		expect(
			artifacts.index.managedKeys.includes(PRIVATE_CONTEXT_INDEX_KEY),
		).toBeTrue();
		expect(artifacts.uploads.length).toBe(2);

		rmSync(repoRoot, { recursive: true, force: true });
	});

	it("uses explicit toolName override when provided", () => {
		const repoRoot = makeTempRepo();
		writeFileSync(
			join(repoRoot, ".private-context", "notes", "coffee", "top.md"),
			"# Coffee",
		);
		writeFileSync(
			join(repoRoot, ".private-context", "context-manifest.json"),
			JSON.stringify(
				{
					version: 1,
					entries: [
						{
							contextId: "orel-top-coffee-shops",
							title: "Orel Top Coffee Shops",
							toolName: "ore.context.custom_coffee",
							markdownPath: "notes/coffee/top.md",
						},
					],
				},
				null,
				2,
			),
		);

		const manifest = loadManifest(repoRoot);
		const artifacts = buildArtifacts(
			repoRoot,
			manifest,
			"2026-02-24T00:00:00.000Z",
		);

		expect(artifacts.index.tools["ore.context.custom_coffee"]?.contextId).toBe(
			"orel-top-coffee-shops",
		);

		rmSync(repoRoot, { recursive: true, force: true });
	});

	it("plans mirror deletes for removed objects", () => {
		const previous = [
			"private-context/markdown/old.md",
			"private-context/images/old.jpg",
			PRIVATE_CONTEXT_INDEX_KEY,
		];
		const next = ["private-context/markdown/new.md", PRIVATE_CONTEXT_INDEX_KEY];

		const deletions = planMirrorDeletes(previous, next);
		expect(deletions).toEqual([
			"private-context/images/old.jpg",
			"private-context/markdown/old.md",
		]);
	});
});
