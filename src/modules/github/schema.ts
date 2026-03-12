import { z } from "zod";

export const projectEvidenceSchema = z.object({
	type: z.enum([
		"repo",
		"readme",
		"languages",
		"manifest",
		"override",
		"model",
	]),
	label: z.string().min(1),
	detail: z.string().min(1),
});

export const projectComponentSchema = z.object({
	name: z.string().min(1),
	responsibility: z.string().min(1),
});

export const projectDesignDecisionSchema = z.object({
	title: z.string().min(1),
	rationale: z.string().min(1),
});

export const projectListItemSchema = z.object({
	name: z.string().min(1),
	fullName: z.string().min(1),
	url: z.url(),
	description: z.string(),
	homepageUrl: z.string(),
	primaryLanguage: z.string(),
	topics: z.array(z.string()),
	stars: z.number().int().nonnegative(),
	pushedAt: z.iso.datetime({ offset: true }),
	updatedAt: z.iso.datetime({ offset: true }),
});

export const latestProjectsResultSchema = z.object({
	owner: z.string().min(1),
	projects: z.array(projectListItemSchema),
	cachedAt: z.iso.datetime({ offset: true }),
	sourceUpdatedAt: z.iso.datetime({ offset: true }),
	stale: z.boolean(),
	provider: z.literal("github"),
});

export const projectSummaryResultSchema = z.object({
	repo: z.string().min(1),
	name: z.string().min(1),
	summary: z.string().min(1),
	technologies: z.array(z.string().min(1)),
	evidence: z.array(projectEvidenceSchema),
	provider: z.enum(["heuristic", "google"]),
	overrideSignature: z.string().nullable(),
	cachedAt: z.iso.datetime({ offset: true }),
	sourceUpdatedAt: z.iso.datetime({ offset: true }),
	stale: z.boolean(),
});

export const projectArchitectureResultSchema = z.object({
	repo: z.string().min(1),
	overview: z.string().min(1),
	components: z.array(projectComponentSchema),
	designDecisions: z.array(projectDesignDecisionSchema),
	diagramMermaid: z.string().min(1),
	evidence: z.array(projectEvidenceSchema),
	provider: z.enum(["heuristic", "google"]),
	overrideSignature: z.string().nullable(),
	cachedAt: z.iso.datetime({ offset: true }),
	sourceUpdatedAt: z.iso.datetime({ offset: true }),
	stale: z.boolean(),
});

export const projectInsightOverrideSchema = z.object({
	repo: z.string().min(1),
	summary: z.string().min(1).optional(),
	technologies: z.array(z.string().min(1)).optional(),
	overview: z.string().min(1).optional(),
	components: z.array(projectComponentSchema).optional(),
	designDecisions: z.array(projectDesignDecisionSchema).optional(),
	diagramMermaid: z.string().min(1).optional(),
	notes: z.string().min(1).optional(),
	links: z.array(z.url()).optional(),
	updatedAt: z.iso.datetime({ offset: true }).optional(),
});

export const projectSummaryToolInputSchema = z.object({
	repo: z.string().min(1),
});

export const projectArchitectureToolInputSchema = z.object({
	repo: z.string().min(1),
});

export const googleSummarySchema = z.object({
	summary: z.string().min(1),
	technologies: z.array(z.string().min(1)).min(1),
});

export const googleArchitectureSchema = z.object({
	overview: z.string().min(1),
	components: z.array(projectComponentSchema).min(1),
	designDecisions: z.array(projectDesignDecisionSchema).min(1),
	diagramMermaid: z.string().min(1),
});
