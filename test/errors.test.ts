import { describe, expect, it } from "bun:test";
import {
	AppError,
	normalizeError,
	toHttpErrorResponse,
	toToolErrorResult,
} from "../src/errors";

describe("error handling", () => {
	it("sanitizes INTERNAL_ERROR in tool responses", () => {
		const result = toToolErrorResult(
			new AppError("INTERNAL_ERROR", "sensitive stack detail", 500),
		);
		expect(result.structuredContent).toMatchObject({
			ok: false,
			error: {
				code: "INTERNAL_ERROR",
				message: "Internal server error",
			},
		});
	});

	it("keeps non-internal messages in tool responses", () => {
		const result = toToolErrorResult(
			new AppError("INVALID_INPUT", "Missing required field", 400),
		);
		expect(result.structuredContent).toMatchObject({
			ok: false,
			error: {
				code: "INVALID_INPUT",
				message: "Missing required field",
			},
		});
	});

	it("returns sanitized INTERNAL_ERROR for unknown thrown errors", async () => {
		const response = toHttpErrorResponse(
			new Error("database connection refused at host ..."),
			"req_123",
		);
		expect(response.status).toBe(500);
		const payload = (await response.json()) as {
			ok: boolean;
			requestId: string;
			error: { code: string; message: string };
		};
		expect(payload.ok).toBeFalse();
		expect(payload.requestId).toBe("req_123");
		expect(payload.error).toEqual({
			code: "INTERNAL_ERROR",
			message: "Internal server error",
		});
	});

	it("normalizes unknown values to INTERNAL_ERROR", () => {
		const error = normalizeError("failure");
		expect(error.code).toBe("INTERNAL_ERROR");
		expect(error.status).toBe(500);
	});
});
