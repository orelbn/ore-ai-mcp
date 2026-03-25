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

export type ContextServerConfig = {
	version: 1;
	updatedAt: string;
	disabledTools: string[];
};

export type ToolDisableSource = "env" | "config";

export type ContextToolInventoryEntry = ContextIndexToolEntry & {
	isDisabled: boolean;
	disabledSources: ToolDisableSource[];
};

export type ContextToolInventory = {
	generatedAt: string;
	managedKeys: string[];
	configUpdatedAt: string;
	disabledTools: {
		env: string[];
		config: string[];
		combined: string[];
	};
	tools: ContextToolInventoryEntry[];
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
