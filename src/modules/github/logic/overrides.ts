import type {
  ProjectArchitectureDraft,
  ProjectEvidence,
  ProjectInsightOverride,
  ProjectSummaryDraft,
} from "../types";
import { buildMermaidDiagram } from "./diagram";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (!value || typeof value !== "object") {
    return JSON.stringify(value);
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`;
}

export async function computeOverrideSignature(
  override: ProjectInsightOverride | null,
): Promise<string | null> {
  if (!override) {
    return null;
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(stableJson(override)),
  );

  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function addOverrideEvidence(
  evidence: ProjectEvidence[],
  override: ProjectInsightOverride | null,
): ProjectEvidence[] {
  if (!override) {
    return evidence;
  }

  return [
    ...evidence,
    {
      type: "override",
      label: "Manual override",
      detail: `Override data applied for ${override.repo}`,
    },
    ...(override.notes
      ? [
          {
            type: "override",
            label: "Override notes",
            detail: override.notes,
          } satisfies ProjectEvidence,
        ]
      : []),
  ];
}

export function applySummaryOverride(
  draft: ProjectSummaryDraft,
  override: ProjectInsightOverride | null,
): ProjectSummaryDraft {
  if (!override) {
    return draft;
  }

  return {
    ...draft,
    summary: override.summary ?? draft.summary,
    technologies: override.technologies ?? draft.technologies,
    evidence: addOverrideEvidence(draft.evidence, override),
  };
}

export function applyArchitectureOverride(
  draft: ProjectArchitectureDraft,
  override: ProjectInsightOverride | null,
): ProjectArchitectureDraft {
  if (!override) {
    return draft;
  }

  const components = override.components ?? draft.components;

  return {
    ...draft,
    overview: override.overview ?? draft.overview,
    components,
    designDecisions: override.designDecisions ?? draft.designDecisions,
    diagramMermaid:
      override.diagramMermaid ??
      (override.components ? buildMermaidDiagram(components) : draft.diagramMermaid),
    evidence: addOverrideEvidence(draft.evidence, override),
  };
}
