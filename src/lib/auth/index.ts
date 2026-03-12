import { AppError } from "@/lib/errors";
import type { AuthenticatedCaller, Env } from "@/lib/worker";
import {
	HEADER_CF_WORKER,
	HEADER_INTERNAL_SECRET,
	HEADER_REQUEST_ID,
	HEADER_USER_ID,
} from "./constants";

/**
 * Compares two strings in a way that resists timing-based side-channel analysis.
 *
 * This function encodes both inputs as UTF-8 bytes and performs a constant-time
 * byte-wise comparison to determine equality.
 *
 * @param left - The first string to compare (encoded as UTF-8)
 * @param right - The second string to compare (encoded as UTF-8)
 * @returns `true` if the UTF-8 byte sequences are identical, `false` otherwise.
 */
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

/**
 * Finds the first non-empty header value from a list of header names, checking them in order.
 *
 * @param request - The incoming Request whose headers will be checked
 * @param headerNames - Header names to check, in priority order
 * @returns The first non-empty, trimmed header value found for any of `headerNames`, or `null` if none are present
 */
function firstHeaderValue(
	request: Request,
	headerNames: readonly string[],
): string | null {
	for (const headerName of headerNames) {
		const value = request.headers.get(headerName)?.trim();
		if (value) {
			return value;
		}
	}
	return null;
}

/**
 * Retrieve the first non-empty header value from a list of candidate header names, throwing if none is present.
 *
 * @param headerNames - Array of header names to check in order for a non-empty value
 * @param primaryHeaderName - The primary header name used in the error message when no header is found
 * @returns The first non-empty, trimmed header value from `headerNames`
 * @throws AppError with code `UNAUTHENTICATED` and status `401` when no header from `headerNames` is present
 */
function requiredHeader(
	request: Request,
	headerNames: readonly string[],
	primaryHeaderName: string,
): string {
	const value = firstHeaderValue(request, headerNames);
	if (!value) {
		throw new AppError(
			"UNAUTHENTICATED",
			`Missing required header: ${primaryHeaderName}`,
			401,
		);
	}
	return value;
}

/**
 * Retrieves the first non-empty request ID header value from the request.
 *
 * @param request - Incoming HTTP request to read headers from
 * @returns The request ID string if present, `null` otherwise.
 */
export function getRequestIdHeader(request: Request): string | null {
	return firstHeaderValue(request, [HEADER_REQUEST_ID]);
}

/**
 * Validate request headers and environment to authenticate an internal caller.
 *
 * @param request - The incoming Request whose headers are validated (internal secret, user id, request id, and optional cf-worker identity).
 * @param env - Environment variables used for validation: `MCP_INTERNAL_SHARED_SECRET`, `MCP_ENFORCE_CF_WORKER`, and `MCP_ALLOWED_CALLER`.
 * @returns An object containing the authenticated `userId`, the `requestId`, and `callerWorker` (the caller worker identity or `null` if not present).
 * @throws `AppError` with code `UNAUTHENTICATED` (401) when the supplied internal secret is missing or invalid, or when a required user id header is missing.
 * @throws `AppError` with code `INVALID_INPUT` (400) when the request is missing a request id header.
 * @throws `AppError` with code `FORBIDDEN` (403) when `MCP_ENFORCE_CF_WORKER` requires a caller identity but it is missing or does not match `MCP_ALLOWED_CALLER`.
 */
export function authenticateRequest(
	request: Request,
	env: Env,
): AuthenticatedCaller {
	const suppliedSecret = requiredHeader(
		request,
		[HEADER_INTERNAL_SECRET],
		HEADER_INTERNAL_SECRET,
	);
	if (!timingSafeEqual(suppliedSecret, env.MCP_INTERNAL_SHARED_SECRET)) {
		throw new AppError("UNAUTHENTICATED", "Invalid internal secret", 401);
	}

	const userId = requiredHeader(request, [HEADER_USER_ID], HEADER_USER_ID);
	const requestId = getRequestIdHeader(request);
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

export {
	HEADER_CF_WORKER,
	HEADER_INTERNAL_SECRET,
	HEADER_REQUEST_ID,
	HEADER_USER_ID,
} from "./constants";
