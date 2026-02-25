import {
	HEADER_CF_WORKER,
	HEADER_INTERNAL_SECRET,
	HEADER_REQUEST_ID,
	HEADER_USER_ID,
} from "./constants";
import { AppError } from "./errors";
import type { AuthenticatedCaller, Env } from "./types";

function timingSafeEqual(left: string, right: string): boolean {
	const leftBytes = new TextEncoder().encode(left);
	const rightBytes = new TextEncoder().encode(right);

	if (leftBytes.length !== rightBytes.length) {
		return false;
	}

	let diff = 0;
	for (let index = 0; index < leftBytes.length; index++) {
		diff |= leftBytes[index] ^ rightBytes[index];
	}

	return diff === 0;
}

function requiredHeader(request: Request, headerName: string): string {
	const value = request.headers.get(headerName)?.trim();
	if (!value) {
		throw new AppError(
			"UNAUTHENTICATED",
			`Missing required header: ${headerName}`,
			401,
		);
	}
	return value;
}

function resolveAllowedCallers(env: Env): string[] {
	const allowlist = (env.MCP_ALLOWED_CALLERS ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

	if (allowlist.length > 0) {
		return allowlist;
	}

	const fallback = env.MCP_ALLOWED_CALLER.trim();
	return fallback ? [fallback] : [];
}

export function authenticateRequest(
	request: Request,
	env: Env,
): AuthenticatedCaller {
	const suppliedSecret = requiredHeader(request, HEADER_INTERNAL_SECRET);
	if (!timingSafeEqual(suppliedSecret, env.MCP_INTERNAL_SHARED_SECRET)) {
		throw new AppError("UNAUTHENTICATED", "Invalid internal secret", 401);
	}

	const userId = requiredHeader(request, HEADER_USER_ID);
	const requestId = request.headers.get(HEADER_REQUEST_ID)?.trim();
	if (!requestId) {
		throw new AppError(
			"INVALID_INPUT",
			`Missing required header: ${HEADER_REQUEST_ID}`,
			400,
		);
	}

	const enforceCaller = env.MCP_ENFORCE_CF_WORKER !== "false";
	const callerWorker = request.headers.get(HEADER_CF_WORKER)?.trim() ?? null;
	if (enforceCaller) {
		if (!callerWorker) {
			throw new AppError("FORBIDDEN", "Missing cf-worker caller identity", 403);
		}
		const allowedCallers = resolveAllowedCallers(env);
		if (allowedCallers.length === 0 || !allowedCallers.includes(callerWorker)) {
			throw new AppError("FORBIDDEN", "Caller worker is not allowed", 403);
		}
	}

	return {
		userId,
		requestId,
		callerWorker,
	};
}
