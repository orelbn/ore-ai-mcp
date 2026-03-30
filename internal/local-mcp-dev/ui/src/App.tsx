import { useEffect, useState } from "react";
import { fetchConfig, fetchStatus, fetchToolContent, fetchTools } from "./api";
import { Masthead } from "./components/Masthead";
import { ToolBrowser } from "./components/ToolBrowser";
import type {
  LocalDevClientConfig,
  StatusResponse,
  ToolContentResponse,
  ToolSummary,
  ToolsResponse,
} from "./types";

function getFilteredTools(tools: ToolSummary[], filter: string): ToolSummary[] {
  const normalized = filter.trim().toLowerCase();
  if (!normalized) {
    return tools;
  }

  return tools.filter((tool) => {
    const haystack = `${tool.toolName} ${tool.title ?? ""}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

function getSelectedTool(
  tools: ToolSummary[],
  selectedToolName: string | null,
): ToolSummary | null {
  return tools.find((tool) => tool.toolName === selectedToolName) ?? null;
}

async function ignoreErrors(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch {}
}

export function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [config, setConfig] = useState<LocalDevClientConfig | null>(null);
  const [toolFilter, setToolFilter] = useState("");
  const [tools, setTools] = useState<ToolSummary[]>([]);
  const [selectedToolName, setSelectedToolName] = useState<string | null>(null);
  const [selectedToolContent, setSelectedToolContent] = useState<ToolContentResponse | null>(null);
  const [lastStatus, setLastStatus] = useState<StatusResponse | null>(null);

  const isReady = config !== null && !config.setupMessage;
  const filteredTools = getFilteredTools(tools, toolFilter);
  const selectedTool = getSelectedTool(tools, selectedToolName);

  async function refreshStatusOnly() {
    const payload = await fetchStatus();
    setLastStatus(payload);
  }

  async function refreshToolsOnly() {
    const payload: ToolsResponse = await fetchTools();
    const nextTools = payload.result?.structuredContent?.tools ?? [];

    setTools(nextTools);
    setSelectedToolName((currentName) => {
      if (!currentName) {
        return currentName;
      }

      const stillExists = nextTools.some((tool) => tool.toolName === currentName);
      if (stillExists) {
        return currentName;
      }

      setSelectedToolContent(null);
      return null;
    });
  }

  async function refreshAll() {
    await Promise.all([refreshStatusOnly(), refreshToolsOnly()]);
  }

  async function handleRefreshAll() {
    await ignoreErrors(refreshAll);
  }

  async function handleRefreshTools() {
    await ignoreErrors(refreshToolsOnly);
  }

  async function handlePreviewTool() {
    if (!selectedTool || selectedTool.kind !== "context" || selectedTool.isDisabled) {
      return;
    }

    await ignoreErrors(async () => {
      const payload = await fetchToolContent(selectedTool.toolName);
      setSelectedToolContent(payload);
    });
  }

  useEffect(() => {
    let isActive = true;

    async function bootstrap() {
      await ignoreErrors(async () => {
        const nextConfig = await fetchConfig();
        if (!isActive) {
          return;
        }

        setConfig(nextConfig);

        if (nextConfig.setupMessage) {
          return;
        }

        const [statusPayload, toolsPayload] = await Promise.all([fetchStatus(), fetchTools()]);
        if (!isActive) {
          return;
        }

        setLastStatus(statusPayload);
        setTools(toolsPayload.result?.structuredContent?.tools ?? []);
      });

      if (isActive) {
        setIsBootstrapping(false);
      }
    }

    void bootstrap();

    return () => {
      isActive = false;
    };
  }, []);

  if (isBootstrapping || !config) {
    return <div className="app-booting" aria-hidden="true" />;
  }

  return (
    <>
      <Masthead
        config={config}
        lastStatus={lastStatus}
        isReady={isReady}
        onRefreshAll={handleRefreshAll}
      />
      <main className="workspace">
        <ToolBrowser
          toolFilter={toolFilter}
          filteredTools={filteredTools}
          selectedTool={selectedTool}
          selectedToolContent={selectedToolContent}
          isReady={isReady}
          onFilterChange={setToolFilter}
          onRefreshTools={handleRefreshTools}
          onSelectTool={(toolName) => {
            setSelectedToolName(toolName);
            setSelectedToolContent(null);
          }}
          onPreviewTool={handlePreviewTool}
        />
      </main>
    </>
  );
}
