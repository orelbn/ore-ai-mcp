import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { CONTEXT_TOOL_PREFIX } from "../src/constants";

export const PRIVATE_CONTEXT_DIR = ".private-context";
export const PRIVATE_CONTEXT_MANIFEST = "context-manifest.json";

const manifestEntrySchema = z.object({
	contextId: z.string().min(1),
	title: z.string().min(1),
	toolName: z
		.string()
		.min(1)
		.regex(/^[a-z0-9._-]+$/, "toolName must use [a-z0-9._-] only")
		.optional(),
	description: z.string().min(1).optional(),
	uiHint: z.string().min(1).optional(),
	markdownPath: z.string().min(1),
	imagePaths: z.array(z.string().min(1)).optional(),
});

const manifestSchema = z.object({
	version: z.literal(1),
	entries: z.array(manifestEntrySchema).min(1),
});

export type ContextManifest = z.infer<typeof manifestSchema>;
export type ContextManifestEntry = z.infer<typeof manifestEntrySchema>;

export interface ValidationIssue {
	path: string;
	message: string;
}

function toPosixPath(pathValue: string): string {
	return pathValue.replaceAll("\\", "/");
}

function toToolSlug(contextId: string): string {
	return contextId
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "_")
		.replaceAll(/^_+|_+$/g, "");
}

export function buildContextToolName(contextId: string): string {
	const slug = toToolSlug(contextId);
	if (!slug) {
		throw new Error(`Cannot derive tool name from contextId: ${contextId}`);
	}
	return `${CONTEXT_TOOL_PREFIX}.${slug}`;
}

export function resolveManifestToolName(entry: ContextManifestEntry): string {
	return entry.toolName ?? buildContextToolName(entry.contextId);
}

function validateRelativePath(pathValue: string): boolean {
	if (!pathValue.trim()) {
		return false;
	}
	if (pathValue.startsWith("/") || pathValue.startsWith("./")) {
		return false;
	}
	const normalized = toPosixPath(pathValue);
	return !normalized.split("/").includes("..");
}

function ensurePathInside(baseDir: string, pathValue: string): boolean {
	const absoluteBase = resolve(baseDir);
	const absoluteTarget = resolve(baseDir, pathValue);
	return (
		absoluteTarget === absoluteBase ||
		absoluteTarget.startsWith(`${absoluteBase}/`)
	);
}

function getManifestPath(repoRoot: string): string {
	return join(repoRoot, PRIVATE_CONTEXT_DIR, PRIVATE_CONTEXT_MANIFEST);
}

export function loadManifest(repoRoot: string): ContextManifest {
	const manifestPath = getManifestPath(repoRoot);
	if (!existsSync(manifestPath)) {
		throw new Error(`Manifest file not found: ${manifestPath}`);
	}

	let json: unknown;
	try {
		json = JSON.parse(readFileSync(manifestPath, "utf8"));
	} catch (error) {
		throw new Error(`Manifest is not valid JSON: ${manifestPath}`, {
			cause: error,
		});
	}

	const parsed = manifestSchema.safeParse(json);
	if (!parsed.success) {
		throw new Error(
			`Manifest schema validation failed: ${parsed.error.issues
				.map((issue) => issue.message)
				.join("; ")}`,
		);
	}

	return parsed.data;
}

export function validateManifest(
	repoRoot: string,
	manifest: ContextManifest,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const contextIds = new Set<string>();
	const toolNames = new Set<string>();
	const privateContextRoot = join(repoRoot, PRIVATE_CONTEXT_DIR);

	for (const entry of manifest.entries) {
		if (contextIds.has(entry.contextId)) {
			issues.push({
				path: entry.contextId,
				message: `Duplicate contextId: ${entry.contextId}`,
			});
		} else {
			contextIds.add(entry.contextId);
		}

		const resolvedToolName = resolveManifestToolName(entry);
		if (toolNames.has(resolvedToolName)) {
			issues.push({
				path: resolvedToolName,
				message: `Duplicate toolName mapping: ${resolvedToolName}`,
			});
		} else {
			toolNames.add(resolvedToolName);
		}

		if (!validateRelativePath(entry.markdownPath)) {
			issues.push({
				path: entry.markdownPath,
				message: "markdownPath must be a safe relative path",
			});
			continue;
		}

		if (!entry.markdownPath.startsWith("notes/")) {
			issues.push({
				path: entry.markdownPath,
				message: "markdownPath must be under notes/",
			});
		}

		if (!entry.markdownPath.toLowerCase().endsWith(".md")) {
			issues.push({
				path: entry.markdownPath,
				message: "markdownPath must point to a .md file",
			});
		}

		if (!ensurePathInside(privateContextRoot, entry.markdownPath)) {
			issues.push({
				path: entry.markdownPath,
				message: "markdownPath escapes private context directory",
			});
		}

		const markdownAbsolutePath = join(privateContextRoot, entry.markdownPath);
		if (!existsSync(markdownAbsolutePath)) {
			issues.push({
				path: entry.markdownPath,
				message: "markdown file does not exist",
			});
		}

		for (const imagePath of entry.imagePaths ?? []) {
			if (!validateRelativePath(imagePath)) {
				issues.push({
					path: imagePath,
					message: "image path must be a safe relative path",
				});
				continue;
			}

			if (!imagePath.startsWith("images/")) {
				issues.push({
					path: imagePath,
					message: "image path must be under images/",
				});
			}

			if (!ensurePathInside(privateContextRoot, imagePath)) {
				issues.push({
					path: imagePath,
					message: "image path escapes private context directory",
				});
			}

			const imageAbsolutePath = join(privateContextRoot, imagePath);
			if (!existsSync(imageAbsolutePath)) {
				issues.push({
					path: imagePath,
					message: "image file does not exist",
				});
			}
		}
	}

	return issues;
}
