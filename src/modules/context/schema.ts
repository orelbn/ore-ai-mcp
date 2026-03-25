import { z } from "zod";

export const contextIndexToolEntrySchema = z.object({
	contextId: z.string().min(1),
	title: z.string().min(1),
	toolName: z.string().min(1),
	description: z.string().min(1).optional(),
	uiHint: z.string().min(1).optional(),
	markdownKey: z.string().min(1),
	imageAssetKeys: z.array(z.string()),
	sourceUpdatedAt: z.string().datetime({ offset: true }),
});

export const contextIndexSchema = z.object({
	version: z.literal(1),
	generatedAt: z.string().datetime({ offset: true }),
	managedKeys: z.array(z.string()),
	tools: z.record(z.string(), contextIndexToolEntrySchema),
});

export const contextServerConfigSchema = z.object({
	version: z.literal(1),
	updatedAt: z.string().datetime({ offset: true }),
	disabledTools: z.array(z.string().min(1)),
});
