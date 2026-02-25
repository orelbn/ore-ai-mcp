import { describe, expect, it } from "bun:test";
import { authenticateRequest } from "../src/auth";
import {
	HEADER_INTERNAL_SECRET,
	HEADER_REQUEST_ID,
	HEADER_USER_ID,
} from "../src/constants";
import { AppError } from "../src/errors";
import type { Env } from "../src/types";
import { createMockR2Bucket } from "./r2-mock";

const baseEnv: Env = {
	MCP_INTERNAL_SHARED_SECRET: "top-secret",
	MCP_ALLOWED_CALLER: "ore-ai",
	MCP_ENFORCE_CF_WORKER: "true",
	PRIVATE_CONTEXT_BUCKET: createMockR2Bucket({}),
};

function makeRequest(headers: Record<string, string>): Request {
	return new Request("https://example.com/mcp", {
		headers,
	});
}

describe("authenticateRequest", () => {
	it("accepts valid caller", () => {
		const request = makeRequest({
			[HEADER_INTERNAL_SECRET]: "top-secret",
			[HEADER_USER_ID]: "user_123",
			[HEADER_REQUEST_ID]: "req_123",
			"cf-worker": "ore-ai",
		});

		const caller = authenticateRequest(request, baseEnv);
		expect(caller.userId).toBe("user_123");
		expect(caller.requestId).toBe("req_123");
	});

	it("rejects missing secret", () => {
		const request = makeRequest({
			[HEADER_USER_ID]: "user_123",
			[HEADER_REQUEST_ID]: "req_123",
			"cf-worker": "ore-ai",
		});

		try {
			authenticateRequest(request, baseEnv);
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(AppError);
			expect((error as AppError).code).toBe("UNAUTHENTICATED");
		}
	});

	it("rejects invalid secret", () => {
		const request = makeRequest({
			[HEADER_INTERNAL_SECRET]: "bad-secret",
			[HEADER_USER_ID]: "user_123",
			[HEADER_REQUEST_ID]: "req_123",
			"cf-worker": "ore-ai",
		});

		try {
			authenticateRequest(request, baseEnv);
			expect.unreachable();
		} catch (error) {
			expect((error as AppError).code).toBe("UNAUTHENTICATED");
		}
	});

	it("rejects missing user id", () => {
		const request = makeRequest({
			[HEADER_INTERNAL_SECRET]: "top-secret",
			[HEADER_REQUEST_ID]: "req_123",
			"cf-worker": "ore-ai",
		});

		try {
			authenticateRequest(request, baseEnv);
			expect.unreachable();
		} catch (error) {
			expect((error as AppError).code).toBe("UNAUTHENTICATED");
		}
	});

	it("rejects missing request id", () => {
		const request = makeRequest({
			[HEADER_INTERNAL_SECRET]: "top-secret",
			[HEADER_USER_ID]: "user_123",
			"cf-worker": "ore-ai",
		});

		try {
			authenticateRequest(request, baseEnv);
			expect.unreachable();
		} catch (error) {
			expect((error as AppError).code).toBe("INVALID_INPUT");
		}
	});

	it("rejects missing cf-worker when enforcement is on", () => {
		const request = makeRequest({
			[HEADER_INTERNAL_SECRET]: "top-secret",
			[HEADER_USER_ID]: "user_123",
			[HEADER_REQUEST_ID]: "req_123",
		});

		try {
			authenticateRequest(request, baseEnv);
			expect.unreachable();
		} catch (error) {
			expect((error as AppError).code).toBe("FORBIDDEN");
		}
	});

	it("rejects unexpected caller worker", () => {
		const request = makeRequest({
			[HEADER_INTERNAL_SECRET]: "top-secret",
			[HEADER_USER_ID]: "user_123",
			[HEADER_REQUEST_ID]: "req_123",
			"cf-worker": "some-other-worker",
		});

		try {
			authenticateRequest(request, baseEnv);
			expect.unreachable();
		} catch (error) {
			expect((error as AppError).code).toBe("FORBIDDEN");
		}
	});

	it("accepts callers from MCP_ALLOWED_CALLERS allowlist", () => {
		const request = makeRequest({
			[HEADER_INTERNAL_SECRET]: "top-secret",
			[HEADER_USER_ID]: "user_123",
			[HEADER_REQUEST_ID]: "req_123",
			"cf-worker": "ore-ai",
		});

		const caller = authenticateRequest(request, {
			...baseEnv,
			MCP_ALLOWED_CALLERS: "foo-worker, ore-ai, another-worker",
		});

		expect(caller.userId).toBe("user_123");
		expect(caller.requestId).toBe("req_123");
		expect(caller.callerWorker).toBe("ore-ai");
	});

	it("rejects callers not in MCP_ALLOWED_CALLERS allowlist", () => {
		const request = makeRequest({
			[HEADER_INTERNAL_SECRET]: "top-secret",
			[HEADER_USER_ID]: "user_123",
			[HEADER_REQUEST_ID]: "req_123",
			"cf-worker": "ore-ai",
		});

		try {
			authenticateRequest(request, {
				...baseEnv,
				MCP_ALLOWED_CALLERS: "foo-worker,bar-worker",
			});
			expect.unreachable();
		} catch (error) {
			expect((error as AppError).code).toBe("FORBIDDEN");
		}
	});

	it("falls back to MCP_ALLOWED_CALLER when MCP_ALLOWED_CALLERS is unset", () => {
		const request = makeRequest({
			[HEADER_INTERNAL_SECRET]: "top-secret",
			[HEADER_USER_ID]: "user_123",
			[HEADER_REQUEST_ID]: "req_123",
			"cf-worker": "ore-ai",
		});

		const caller = authenticateRequest(request, {
			...baseEnv,
			MCP_ALLOWED_CALLERS: undefined,
		});

		expect(caller.userId).toBe("user_123");
		expect(caller.requestId).toBe("req_123");
		expect(caller.callerWorker).toBe("ore-ai");
	});

	it("falls back to MCP_ALLOWED_CALLER when MCP_ALLOWED_CALLERS is empty", () => {
		const request = makeRequest({
			[HEADER_INTERNAL_SECRET]: "top-secret",
			[HEADER_USER_ID]: "user_123",
			[HEADER_REQUEST_ID]: "req_123",
			"cf-worker": "ore-ai",
		});

		const caller = authenticateRequest(request, {
			...baseEnv,
			MCP_ALLOWED_CALLERS: "   ",
		});

		expect(caller.userId).toBe("user_123");
		expect(caller.requestId).toBe("req_123");
		expect(caller.callerWorker).toBe("ore-ai");
	});

	it("returns FORBIDDEN when no caller allowlist value is configured", () => {
		const request = makeRequest({
			[HEADER_INTERNAL_SECRET]: "top-secret",
			[HEADER_USER_ID]: "user_123",
			[HEADER_REQUEST_ID]: "req_123",
			"cf-worker": "ore-ai",
		});

		try {
			authenticateRequest(request, {
				...baseEnv,
				MCP_ALLOWED_CALLERS: "",
				MCP_ALLOWED_CALLER: undefined as unknown as string,
			});
			expect.unreachable();
		} catch (error) {
			expect((error as AppError).code).toBe("FORBIDDEN");
		}
	});

	it("allows missing cf-worker when enforcement is disabled", () => {
		const request = makeRequest({
			[HEADER_INTERNAL_SECRET]: "top-secret",
			[HEADER_USER_ID]: "user_123",
			[HEADER_REQUEST_ID]: "req_123",
		});

		const caller = authenticateRequest(request, {
			...baseEnv,
			MCP_ENFORCE_CF_WORKER: "false",
		});

		expect(caller.userId).toBe("user_123");
		expect(caller.callerWorker).toBeNull();
	});
});
