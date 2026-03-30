import type { ChangeEvent } from "react";
import type { ToolContentResponse, ToolSummary } from "../types";

type ToolListProps = {
  tools: ToolSummary[];
  selectedToolName: string | null;
  onSelectTool: (toolName: string) => void;
};

type ToolDetailProps = {
  tool: ToolSummary | null;
  selectedToolContent: ToolContentResponse | null;
  onPreviewTool: () => void;
};

type ToolBrowserProps = {
  toolFilter: string;
  filteredTools: ToolSummary[];
  selectedTool: ToolSummary | null;
  selectedToolContent: ToolContentResponse | null;
  isReady: boolean;
  onFilterChange: (value: string) => void;
  onRefreshTools: () => void;
  onSelectTool: (toolName: string) => void;
  onPreviewTool: () => void;
};

function ToolList({ tools, selectedToolName, onSelectTool }: ToolListProps) {
  if (tools.length === 0) {
    return <p className="empty-state">No tools match this filter.</p>;
  }

  return (
    <nav className="tool-list">
      {tools.map((tool) => (
        <button
          key={tool.toolName}
          type="button"
          className={[
            "tool-row",
            tool.toolName === selectedToolName ? "active" : "",
            tool.isDisabled ? "disabled" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onSelectTool(tool.toolName)}
        >
          <div className="tool-row-main">
            <div className="tool-row-title">{tool.title || tool.toolName}</div>
            <div className="tool-name">{tool.toolName}</div>
          </div>
          <div className="tool-row-meta">
            <span className="tool-kind">{tool.kind}</span>
            {tool.isDisabled ? <span className="tool-flag">unavailable</span> : null}
          </div>
        </button>
      ))}
    </nav>
  );
}

function ToolDetail({ tool, selectedToolContent, onPreviewTool }: ToolDetailProps) {
  if (!tool) {
    return <p className="empty-state">Select a tool to inspect it.</p>;
  }

  const preview = selectedToolContent?.structuredContent ?? null;
  const canPreview = tool.kind === "context" && !tool.isDisabled;

  return (
    <>
      <header className="detail-header">
        <div>
          <h2>{tool.title || tool.toolName}</h2>
          <p className="tool-name">{tool.toolName}</p>
          <p className="detail-copy">{tool.description || "No description provided."}</p>
        </div>
        <div className="detail-flags">
          <span className="tool-kind">{tool.kind}</span>
          <span className={`tool-flag ${tool.isDisabled ? "" : "success"}`}>
            {tool.isDisabled ? "unavailable" : "active"}
          </span>
        </div>
      </header>

      <div className="detail-actions">
        {canPreview ? (
          <button type="button" className="button primary" onClick={onPreviewTool}>
            Preview Context
          </button>
        ) : null}
      </div>

      <section className="detail-section">
        <h3>Metadata</h3>
        <pre className="code-block">{JSON.stringify(tool, null, 2)}</pre>
      </section>

      <section className="detail-section">
        <h3>Payload Preview</h3>
        {tool.isDisabled ? (
          <p className="empty-state inline">
            This tool is currently unavailable in the running MCP server.
          </p>
        ) : typeof preview?.markdown === "string" ? (
          <pre className="markdown-preview">{preview.markdown}</pre>
        ) : (
          <p className="empty-state inline">No context preview loaded yet.</p>
        )}
      </section>

      <section className="detail-section">
        <h3>Structured Result</h3>
        {preview ? (
          <pre className="code-block">{JSON.stringify(preview, null, 2)}</pre>
        ) : (
          <p className="empty-state inline">Run a preview to see the structured MCP result.</p>
        )}
      </section>
    </>
  );
}

export function ToolBrowser({
  toolFilter,
  filteredTools,
  selectedTool,
  selectedToolContent,
  isReady,
  onFilterChange,
  onRefreshTools,
  onSelectTool,
  onPreviewTool,
}: ToolBrowserProps) {
  return (
    <section className="browser">
      <header className="browser-header">
        <div>
          <h2>Tools</h2>
          <p className="section-copy">Search the current registry and preview tool payloads.</p>
        </div>
      </header>

      <div className="browser-toolbar">
        <input
          type="search"
          placeholder="Filter by tool name or title"
          value={toolFilter}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onFilterChange(event.target.value)}
          disabled={!isReady}
        />
        <button type="button" className="button ghost" onClick={onRefreshTools} disabled={!isReady}>
          Refresh Tools
        </button>
      </div>

      <div className="browser-body">
        <ToolList
          tools={filteredTools}
          selectedToolName={selectedTool?.toolName ?? null}
          onSelectTool={onSelectTool}
        />
        <article className="tool-detail">
          <ToolDetail
            tool={selectedTool}
            selectedToolContent={selectedToolContent}
            onPreviewTool={onPreviewTool}
          />
        </article>
      </div>
    </section>
  );
}
