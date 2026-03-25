import type { LocalDevClientConfig, StatusResponse } from "../types";

type MastheadProps = {
	config: LocalDevClientConfig;
	lastStatus: StatusResponse | null;
};

export function Masthead({ config, lastStatus }: MastheadProps) {
	const summary = lastStatus?.result?.structuredContent;
	const label = summary && lastStatus ? lastStatus.connection.label : "Waiting";
	const target = summary?.server?.version
		? `${lastStatus?.connection.url ?? ""} · v${summary.server.version}`
		: config.setupMessage ||
			config.localUrl ||
			"Start bun run dev to detect the local MCP server.";

	return (
		<header className="masthead">
			<div className="masthead-copy">
				<p className="eyebrow">Local Only</p>
				<h1>Local MCP Dev</h1>
				<p className="hero-copy">
					Inspect the local MCP server and preview context tools while
					developing locally.
				</p>
			</div>
			<div className="masthead-target">
				<span className="hero-label">{label}</span>
				<div className="hero-target">{target}</div>
			</div>
		</header>
	);
}
