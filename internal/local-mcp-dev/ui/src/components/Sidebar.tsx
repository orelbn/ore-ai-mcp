import type { FlashTone, LocalDevClientConfig, StatusResponse } from "../types";

type OverviewMetricsProps = {
  lastStatus: StatusResponse | null;
};

type LocalServerStatusProps = {
  config: LocalDevClientConfig;
};

type SidebarProps = {
  config: LocalDevClientConfig;
  lastStatus: StatusResponse | null;
  flashMessage: string;
  flashTone: FlashTone;
  isReady: boolean;
  onRefreshAll: () => void;
};

function OverviewMetrics({ lastStatus }: OverviewMetricsProps) {
  const status = lastStatus?.result?.structuredContent;
  if (!status) {
    return (
      <dl className="metric-list">
        <div className="metric-row">
          <dt>Server</dt>
          <dd>No data</dd>
        </div>
      </dl>
    );
  }

  return (
    <dl className="metric-list">
      <div className="metric-row">
        <dt>Server</dt>
        <dd>{status.server.version}</dd>
      </div>
      <div className="metric-row">
        <dt>Visible tools</dt>
        <dd>{status.context.toolCount}</dd>
      </div>
    </dl>
  );
}

function LocalServerStatus({ config }: LocalServerStatusProps) {
  if (config.setupMessage) {
    return <p className="empty-state inline">{config.setupMessage}</p>;
  }

  return (
    <dl className="server-meta">
      <div className="server-meta-row">
        <dt>Detected MCP URL</dt>
        <dd className="target-endpoint">{config.localUrl || "Unavailable"}</dd>
      </div>
      <div className="server-meta-row">
        <dt>Auth</dt>
        <dd>Shared secret is read from local config.</dd>
      </div>
    </dl>
  );
}

export function Sidebar({
  config,
  lastStatus,
  flashMessage,
  flashTone,
  isReady,
  onRefreshAll,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <section className="sidebar-section">
        <h2>Local Server</h2>
        <LocalServerStatus config={config} />
        <div className="action-row">
          <button
            type="button"
            className="button primary"
            onClick={onRefreshAll}
            disabled={!isReady}
          >
            Refresh Local Server
          </button>
        </div>
      </section>

      <section className="sidebar-section">
        <h2>Overview</h2>
        <OverviewMetrics lastStatus={lastStatus} />
      </section>

      <section className="sidebar-section">
        <h2>Session</h2>
        <pre className="flash-message" data-tone={flashTone}>
          {flashMessage}
        </pre>
      </section>
    </aside>
  );
}
