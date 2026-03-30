export type FlashTone = "neutral" | "error";

export type LocalDevClientConfig = {
  port: number;
  localUrl: string | null;
  setupMessage: string | null;
};

export type DisabledTools = {
  env: string[];
  config: string[];
};

export type ServerStatusSummary = {
  server: {
    version: string;
  };
  context: {
    toolCount: number;
  };
  disabledTools: DisabledTools;
};

export type ConnectionSummary = {
  label: string;
  url: string;
  callerWorker: string;
  userId: string;
};

export type StatusResponse = {
  ok: true;
  connection: ConnectionSummary;
  result: {
    structuredContent?: ServerStatusSummary;
  };
};

export type ToolKind = "internal" | "context";

export type ToolSummary = {
  kind: ToolKind;
  toolName: string;
  title?: string | null;
  description?: string | null;
  isDisabled: boolean;
  [key: string]: unknown;
};

export type ToolsResponse = {
  ok: true;
  connection: ConnectionSummary;
  result: {
    structuredContent?: {
      tools?: ToolSummary[];
    };
  };
};

export type ToolPreview = {
  markdown?: string;
  [key: string]: unknown;
};

export type ToolContentResponse = {
  structuredContent?: ToolPreview;
  [key: string]: unknown;
};
