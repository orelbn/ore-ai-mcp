import { describe, expect, it } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildProjectInsightOverrideIndex,
  loadLocalProjectOverrides,
  planDeletedOverrideKeys,
} from "../scripts/github-insights-lib";

function withOverrides(
  files: Record<string, unknown>,
  run: (repoRoot: string, overridesRoot: string) => void,
) {
  const repoRoot = mkdtempSync(join(tmpdir(), "github-insights-"));
  const overridesRoot = join(repoRoot, ".project-insights");
  mkdirSync(overridesRoot);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(overridesRoot, name), JSON.stringify(content));
  }
  try {
    run(repoRoot, overridesRoot);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

describe("github insights sync planning", () => {
  it("builds a stable override index and mirror delete plan", () => {
    expect(
      buildProjectInsightOverrideIndex([
        {
          filePath: "/tmp/b.json",
          override: { repo: "b" },
          remoteKey: "github-insights/v1/overrides/b.json",
        },
        {
          filePath: "/tmp/a.json",
          override: { repo: "a" },
          remoteKey: "github-insights/v1/overrides/a.json",
        },
      ]),
    ).toEqual({
      version: 1,
      managedKeys: ["github-insights/v1/overrides/a.json", "github-insights/v1/overrides/b.json"],
    });
    expect(
      planDeletedOverrideKeys(
        ["github-insights/v1/overrides/a.json", "github-insights/v1/overrides/b.json"],
        ["github-insights/v1/overrides/b.json"],
      ),
    ).toEqual(["github-insights/v1/overrides/a.json"]);
  });

  it("rejects duplicate override targets while loading local files", () => {
    withOverrides(
      {
        "a.json": { repo: "repo-a", summary: "one" },
        "b.json": { repo: "repo-a", summary: "two" },
      },
      (repoRoot) => {
        expect(() => loadLocalProjectOverrides(repoRoot)).toThrow(
          "Duplicate override targets: github-insights/v1/overrides/repo-a.json",
        );
      },
    );
  });

  it("normalizes owner repo overrides to the runtime repo key", () => {
    withOverrides(
      {
        "repo-a.json": { repo: "example/repo-a", summary: "normalized" },
      },
      (repoRoot, overridesRoot) => {
        expect(loadLocalProjectOverrides(repoRoot)).toEqual([
          {
            filePath: join(overridesRoot, "repo-a.json"),
            override: { repo: "repo-a", summary: "normalized" },
            remoteKey: "github-insights/v1/overrides/repo-a.json",
          },
        ]);
      },
    );
  });
});
