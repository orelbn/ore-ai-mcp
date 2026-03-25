import { useEffect, useState } from "react";
import { fetchConfig, fetchStatus, fetchToolContent, fetchTools } from "./api";
import { Masthead } from "./components/Masthead";
import { Sidebar } from "./components/Sidebar";
import { ToolBrowser } from "./components/ToolBrowser";
import type {
	FlashTone,
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

function toMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unexpected error";
}

export function App() {
	const [config, setConfig] = useState<LocalDevClientConfig | null>(null);
	const [toolFilter, setToolFilter] = useState("");
	const [tools, setTools] = useState<ToolSummary[]>([]);
	const [selectedToolName, setSelectedToolName] = useState<string | null>(null);
	const [selectedToolContent, setSelectedToolContent] =
		useState<ToolContentResponse | null>(null);
	const [lastStatus, setLastStatus] = useState<StatusResponse | null>(null);
	const [flashMessage, setFlashMessage] = useState("");
	const [flashTone, setFlashTone] = useState<FlashTone>("neutral");

	const isReady = config !== null && !config.setupMessage;
	const filteredTools = getFilteredTools(tools, toolFilter);
	const selectedTool = getSelectedTool(tools, selectedToolName);

	function showMessage(message: string, tone: FlashTone = "neutral") {
		setFlashMessage(message);
		setFlashTone(tone);
	}

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

			const stillExists = nextTools.some(
				(tool) => tool.toolName === currentName,
			);
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
		showMessage("Loading live MCP state...");
		try {
			await refreshAll();
			showMessage("Loaded live MCP state.");
		} catch (error) {
			showMessage(toMessage(error), "error");
		}
	}

	async function handleRefreshTools() {
		showMessage("Refreshing tools...");
		try {
			await refreshToolsOnly();
			showMessage("Tool list refreshed.");
		} catch (error) {
			showMessage(toMessage(error), "error");
		}
	}

	async function handlePreviewTool() {
		if (
			!selectedTool ||
			selectedTool.kind !== "context" ||
			selectedTool.isDisabled
		) {
			return;
		}

		showMessage(`Loading ${selectedTool.toolName}...`);
		try {
			const payload = await fetchToolContent(selectedTool.toolName);
			setSelectedToolContent(payload);
			showMessage(`Loaded ${selectedTool.toolName}.`);
		} catch (error) {
			showMessage(toMessage(error), "error");
		}
	}

	useEffect(() => {
		let isActive = true;

		async function bootstrap() {
			try {
				const nextConfig = await fetchConfig();
				if (!isActive) {
					return;
				}

				setConfig(nextConfig);

				if (nextConfig.setupMessage) {
					setFlashMessage(nextConfig.setupMessage);
					setFlashTone("error");
					return;
				}

				const [statusPayload, toolsPayload] = await Promise.all([
					fetchStatus(),
					fetchTools(),
				]);
				if (!isActive) {
					return;
				}

				setLastStatus(statusPayload);
				setTools(toolsPayload.result?.structuredContent?.tools ?? []);
				setFlashMessage("Loaded live MCP state.");
				setFlashTone("neutral");
			} catch (error) {
				if (!isActive) {
					return;
				}

				setFlashMessage(toMessage(error));
				setFlashTone("error");
			}
		}

		void bootstrap();

		return () => {
			isActive = false;
		};
	}, []);

	if (!config) {
		return (
			<div className="page-shell">
				<header className="masthead">
					<div className="masthead-copy">
						<p className="eyebrow">Local Only</p>
						<h1>Local MCP Dev</h1>
						<p className="hero-copy">Loading local MCP configuration...</p>
					</div>
				</header>
			</div>
		);
	}

	return (
		<div className="page-shell">
			<Masthead config={config} lastStatus={lastStatus} />
			<main className="workspace">
				<Sidebar
					config={config}
					lastStatus={lastStatus}
					flashMessage={flashMessage}
					flashTone={flashTone}
					isReady={isReady}
					onRefreshAll={handleRefreshAll}
				/>
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
		</div>
	);
}
