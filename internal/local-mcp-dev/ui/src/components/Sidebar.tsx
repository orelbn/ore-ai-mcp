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
			<div className="metric-strip">
				<div className="metric">
					<span className="metric-label">Server</span>
					<strong className="metric-value">No data</strong>
				</div>
			</div>
		);
	}

	return (
		<div className="metric-strip">
			<div className="metric">
				<span className="metric-label">Server</span>
				<strong className="metric-value">{status.server.version}</strong>
			</div>
			<div className="metric">
				<span className="metric-label">Visible Tools</span>
				<strong className="metric-value">{status.context.toolCount}</strong>
			</div>
		</div>
	);
}

function LocalServerStatus({ config }: LocalServerStatusProps) {
	if (config.setupMessage) {
		return <p className="empty-state inline">{config.setupMessage}</p>;
	}

	return (
		<div className="target-rail">
			<div className="target-label">Detected MCP URL</div>
			<div className="target-endpoint">{config.localUrl || "Unavailable"}</div>
			<p className="preset-caution">
				Shared secret loaded locally. Nothing is entered in the browser.
			</p>
		</div>
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
				<p className="section-copy">
					The local helper reads the shared secret from `.dev.vars` and
					auto-detects the MCP URL when possible.
				</p>
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

			<pre className="flash-message" data-tone={flashTone}>
				{flashMessage}
			</pre>
		</aside>
	);
}
