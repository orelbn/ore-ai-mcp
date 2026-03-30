import type { LocalDevClientConfig, StatusResponse } from "../types";
import { RefreshIcon } from "./RefreshIcon";

type MastheadProps = {
  config: LocalDevClientConfig;
  isReady: boolean;
  lastStatus: StatusResponse | null;
  onRefreshAll: () => void;
};

export function Masthead({ config, isReady, lastStatus, onRefreshAll }: MastheadProps) {
  const summary = lastStatus?.result?.structuredContent;
  const label = summary && lastStatus ? lastStatus.connection.label : "Waiting for server";
  const target = summary?.server?.version
    ? `${lastStatus?.connection.url ?? ""} · v${summary.server.version}`
    : config.setupMessage ||
      config.localUrl ||
      "Start wrangler dev to detect the local MCP server.";

  return (
    <header className="masthead">
      <div className="masthead-target">
        <div className="masthead-label">{label}</div>
        <div className="masthead-value">{target}</div>
        <div className="masthead-separator" aria-hidden="true">
          ·
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onRefreshAll}
          disabled={!isReady}
          aria-label="Refresh local server"
          title="Refresh local server"
        >
          <RefreshIcon />
        </button>
      </div>
    </header>
  );
}
