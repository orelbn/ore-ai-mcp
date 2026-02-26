import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import {
	CONTEXT_IMAGE_PREFIX,
	CONTEXT_INDEX_KEY,
	CONTEXT_MARKDOWN_PREFIX,
	CONTEXT_PREFIX,
} from "../src/constants";
import type { ContextIndex } from "../src/context-index";
import {
	type ContextManifest,
	resolveContextRoot,
	resolveManifestToolName,
} from "./context-manifest";

export interface ContextUpload {
	localPath: string;
	remoteKey: string;
	contentType: string;
}

export interface BuiltArtifacts {
	manifest: ContextManifest;
	uploads: ContextUpload[];
	index: ContextIndex;
}

function toPosixPath(pathValue: string): string {
	return pathValue.replaceAll("\\", "/");
}

function computeFileHash(filePath: string): string {
	const data = readFileSync(filePath);
	return createHash("sha256").update(data).digest("hex");
}

function inferContentType(filePath: string): string {
	const lower = filePath.toLowerCase();
	if (lower.endsWith(".md")) return "text/markdown";
	if (lower.endsWith(".json")) return "application/json";
	if (lower.endsWith(".png")) return "image/png";
	if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
	if (lower.endsWith(".webp")) return "image/webp";
	if (lower.endsWith(".gif")) return "image/gif";
	if (lower.endsWith(".svg")) return "image/svg+xml";
	return "application/octet-stream";
}

function normalizeImageAssetKey(
	relativeImagePath: string,
	absoluteImagePath: string,
): string {
	const extension = posix.extname(toPosixPath(relativeImagePath));
	const digest = computeFileHash(absoluteImagePath).slice(0, 16);
	const basename = posix.basename(toPosixPath(relativeImagePath), extension);
	const safeBase = basename
		.toLowerCase()
		.replaceAll(/[^a-z0-9-_]/g, "-")
		.replaceAll(/--+/g, "-")
		.replaceAll(/^-+|-+$/g, "");
	const filename = `${safeBase || "image"}-${digest}${extension.toLowerCase()}`;
	return `${CONTEXT_IMAGE_PREFIX}/${filename}`;
}

export function buildArtifacts(
	repoRoot: string,
	manifest: ContextManifest,
	generatedAt = new Date().toISOString(),
): BuiltArtifacts {
	const uploads: ContextUpload[] = [];
	const tools: ContextIndex["tools"] = {};
	const contextRoot = resolveContextRoot(repoRoot);

	for (const entry of manifest.entries) {
		const toolName = resolveManifestToolName(entry);
		const markdownAbsolute = join(contextRoot, entry.markdownPath);
		const markdownKey = `${CONTEXT_MARKDOWN_PREFIX}/${entry.contextId}.md`;

		uploads.push({
			localPath: markdownAbsolute,
			remoteKey: markdownKey,
			contentType: inferContentType(markdownAbsolute),
		});

		const imageAssetKeys: string[] = [];
		for (const imagePath of entry.imagePaths ?? []) {
			const imageAbsolute = join(contextRoot, imagePath);
			const remoteKey = normalizeImageAssetKey(imagePath, imageAbsolute);
			uploads.push({
				localPath: imageAbsolute,
				remoteKey,
				contentType: inferContentType(imageAbsolute),
			});
			imageAssetKeys.push(remoteKey);
		}

		const markdownStats = statSync(markdownAbsolute);
		tools[toolName] = {
			contextId: entry.contextId,
			title: entry.title,
			toolName,
			description: entry.description,
			uiHint: entry.uiHint,
			markdownKey,
			imageAssetKeys,
			sourceUpdatedAt: markdownStats.mtime.toISOString(),
		};
	}

	const uniqueManagedKeys = Array.from(
		new Set([...uploads.map((upload) => upload.remoteKey), CONTEXT_INDEX_KEY]),
	).sort((left, right) => left.localeCompare(right));

	const index: ContextIndex = {
		version: 1,
		generatedAt,
		managedKeys: uniqueManagedKeys,
		tools,
	};

	return {
		manifest,
		uploads,
		index,
	};
}

export function planMirrorDeletes(
	previousManagedKeys: string[],
	nextManagedKeys: string[],
): string[] {
	const nextSet = new Set(nextManagedKeys);
	return previousManagedKeys
		.filter((key) => key.startsWith(`${CONTEXT_PREFIX}/`))
		.filter((key) => !nextSet.has(key))
		.sort((left, right) => left.localeCompare(right));
}
