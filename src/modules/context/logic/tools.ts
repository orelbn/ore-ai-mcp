import { AppError } from "@/lib/errors";
import type { RequestContext } from "@/lib/worker";
import { DEFAULT_CONTEXT_UI_HINT } from "../constants";
import {
  loadContextIndex,
  loadContextMarkdown,
  loadContextServerConfig,
} from "../repo/context-bucket";
import type { ContextIndexToolEntry, ContextToolInventory, ContextToolResult } from "../types";

function toSortedUniqueToolNames(toolNames: string[]): string[] {
  return Array.from(new Set(toolNames.map((toolName) => toolName.trim()).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right),
  );
}

export async function listContextToolEntries(
  context: RequestContext,
): Promise<ContextIndexToolEntry[]> {
  const contextIndex = await loadContextIndex(context);
  return Object.values(contextIndex.tools).sort((left, right) =>
    left.toolName.localeCompare(right.toolName),
  );
}

export async function getContextByToolName(
  context: RequestContext,
  toolName: string,
): Promise<ContextToolResult> {
  const contextIndex = await loadContextIndex(context);
  const toolEntry = contextIndex.tools[toolName];
  if (!toolEntry) {
    throw new AppError(
      "INTERNAL_ERROR",
      `Tool mapping not found in context index: ${toolName}`,
      500,
    );
  }

  return getContextByToolEntry(context, toolEntry);
}

export async function getContextByToolEntry(
  context: RequestContext,
  toolEntry: ContextIndexToolEntry,
): Promise<ContextToolResult> {
  const markdown = await loadContextMarkdown(context, toolEntry.markdownKey);
  return {
    uiHint: toolEntry.uiHint ?? DEFAULT_CONTEXT_UI_HINT,
    toolName: toolEntry.toolName,
    contextId: toolEntry.contextId,
    title: toolEntry.title,
    markdown,
    imageAssetKeys: toolEntry.imageAssetKeys,
    sourceUpdatedAt: toolEntry.sourceUpdatedAt,
  };
}

export async function getContextToolInventory(
  context: RequestContext,
): Promise<ContextToolInventory> {
  const [contextIndex, serverConfig] = await Promise.all([
    loadContextIndex(context),
    loadContextServerConfig(context),
  ]);

  const disabledTools = toSortedUniqueToolNames(serverConfig.disabledTools);
  const disabledToolSet = new Set(disabledTools);

  return {
    generatedAt: contextIndex.generatedAt,
    managedKeys: contextIndex.managedKeys,
    configUpdatedAt: serverConfig.updatedAt,
    disabledTools,
    tools: Object.values(contextIndex.tools)
      .sort((left, right) => left.toolName.localeCompare(right.toolName))
      .map((toolEntry) => ({
        ...toolEntry,
        isDisabled: disabledToolSet.has(toolEntry.toolName),
      })),
  };
}
