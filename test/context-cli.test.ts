import { describe, expect, it } from "bun:test";
import { parseSyncArgs } from "../scripts/context-cli";

describe("context cli argument parsing", () => {
	it("uses defaults with no args", () => {
		expect(parseSyncArgs([])).toEqual({
			env: undefined,
			dryRun: false,
			local: false,
		});
	});

	it("parses split env arg with dry-run and local", () => {
		expect(parseSyncArgs(["--env", "staging", "--dry-run", "--local"])).toEqual(
			{
				env: "staging",
				dryRun: true,
				local: true,
			},
		);
	});

	it("parses inline env arg and remote mode", () => {
		expect(parseSyncArgs(["--env=production", "--remote"])).toEqual({
			env: "production",
			dryRun: false,
			local: false,
		});
	});

	it("fails on unknown args", () => {
		expect(() => parseSyncArgs(["--mystery"])).toThrow("Unknown argument");
	});

	it("fails when --env has no value", () => {
		expect(() => parseSyncArgs(["--env"])).toThrow("--env requires a value");
	});
});
