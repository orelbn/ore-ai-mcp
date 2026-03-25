import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const parsedApiPort = Number.parseInt(
	process.env.INTERNAL_MCP_ADMIN_PORT ?? "4317",
	10,
);
const apiPort = Number.isFinite(parsedApiPort) ? parsedApiPort : 4317;

export default defineConfig({
	root: new URL("./", import.meta.url).pathname,
	plugins: [react()],
	server: {
		host: "127.0.0.1",
		port: 4318,
		proxy: {
			"/api": {
				target: `http://127.0.0.1:${apiPort}`,
				changeOrigin: true,
			},
		},
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
});
