import { createLocalMcpDevFetchHandler, logStartup } from "./handler";
import { buildDashboardRuntimeConfig } from "./index";

const runtimeConfig = await buildDashboardRuntimeConfig(process.env);

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: runtimeConfig.port,
  fetch: createLocalMcpDevFetchHandler(runtimeConfig),
});

logStartup(runtimeConfig);

export default server;
