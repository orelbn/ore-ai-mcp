import type { ProjectComponent } from "../types";

function escapeMermaidLabel(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll(/[\r\n]+/g, " ");
}

export function buildMermaidDiagram(components: ProjectComponent[]): string {
  if (!components.length) {
    return ["flowchart LR", '  Client["Client"]'].join("\n");
  }

  return [
    "flowchart LR",
    ...components.map((component, index) =>
      index === 0
        ? `  Client["Client"] --> C1["${escapeMermaidLabel(component.name)}"]`
        : `  C${index}["${escapeMermaidLabel(components[index - 1].name)}"] --> C${index + 1}["${escapeMermaidLabel(component.name)}"]`,
    ),
  ].join("\n");
}
