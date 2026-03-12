export type ContextIndexToolEntry = {
	contextId: string;
	title: string;
	toolName: string;
	description?: string;
	uiHint?: string;
	markdownKey: string;
	imageAssetKeys: string[];
	sourceUpdatedAt: string;
};

export type ContextIndex = {
	version: 1;
	generatedAt: string;
	managedKeys: string[];
	tools: Record<string, ContextIndexToolEntry>;
};

export type ContextToolResult = {
	uiHint: string;
	toolName: string;
	contextId: string;
	title: string;
	markdown: string;
	imageAssetKeys: string[];
	sourceUpdatedAt: string;
};
