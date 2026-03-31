import { describe, expect, it } from "vite-plus/test";
import { createMockR2Bucket } from "@mocks/r2-bucket";
import type { RequestContext } from "@/lib/worker";
import { executeTool } from "./execute-tool";

const context: RequestContext = {
  env: {
    CONTEXT_BUCKET: createMockR2Bucket({}),
  },
};

describe("executeTool", () => {
  it("returns INTERNAL_ERROR envelope when handler throws", async () => {
    const result = await executeTool(context, "ore.context.sample_context", async () => {
      throw new Error("context unavailable");
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
      },
    });
  });
});
