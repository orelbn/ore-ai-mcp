import { z } from "zod";
import { adminToolActions } from "./types";

export const dashboardRequestSchema = z.object({
	connection: z.object({}).default({}),
});

export const adminActionSchema = z.enum(adminToolActions);

export const adminRequestSchema = dashboardRequestSchema.extend({
	action: adminActionSchema,
	toolNames: z.array(z.string().min(1)).optional(),
});

export const contextToolRequestSchema = dashboardRequestSchema.extend({
	toolName: z.string().min(1),
});

export function parseDashboardConnection(body: unknown) {
	return dashboardRequestSchema.parse(body).connection;
}
