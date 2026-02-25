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
		if (callerWorker !== env.MCP_ALLOWED_CALLER) {
			throw new AppError("FORBIDDEN", "Caller worker is not allowed", 403);
		}
	}

	return {
		userId,
		requestId,
		callerWorker,
	};
}
