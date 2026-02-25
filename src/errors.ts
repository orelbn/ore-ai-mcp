import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ErrorCode } from "./types";

export class AppError extends Error {
	code: ErrorCode;
	status: number;

	constructor(code: ErrorCode, message: string, status: number) {
		super(message);
		this.name = "AppError";
		this.code = code;
		this.status = status;
	}
}

export function normalizeError(error: unknown): AppError {
	if (error instanceof AppError) {
		return error;
	}

	return new AppError("INTERNAL_ERROR", "Unexpected internal error", 500);
}

function toPublicMessage(error: AppError): string {
	if (error.code === "INTERNAL_ERROR") {
		return "Internal server error";
	}
	return error.message;
}

export function toToolErrorResult(error: AppError): CallToolResult {
	const message = toPublicMessage(error);
	return {
		isError: true,
		content: [
			{
				type: "text",
				text: `${error.code}: ${message}`,
			},
		],
		structuredContent: {
			ok: false,
			error: {
				code: error.code,
				message,
			},
		},
	};
}

export function toHttpErrorResponse(
	error: unknown,
	fallbackRequestId?: string,
): Response {
	const appError = normalizeError(error);
	const message = toPublicMessage(appError);
	return Response.json(
		{
			ok: false,
			requestId: fallbackRequestId ?? crypto.randomUUID(),
			error: {
				code: appError.code,
				message,
			},
		},
		{ status: appError.status },
	);
}
