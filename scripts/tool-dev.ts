const defaultWorkerPort = 8787;
const defaultWorkerUrl = `http://127.0.0.1:${defaultWorkerPort}/mcp`;
const fallbackWorkerUrl = `http://localhost:${defaultWorkerPort}/mcp`;

type ManagedProcess = ReturnType<typeof Bun.spawn>;

function log(message: string): void {
  console.log(`[tool:dev] ${message}`);
}

function buildCandidateUrls(explicitUrl?: string): string[] {
  return Array.from(
    new Set(
      [explicitUrl?.trim(), defaultWorkerUrl, fallbackWorkerUrl].filter((value): value is string =>
        Boolean(value),
      ),
    ),
  );
}

async function probeWorker(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "tool-dev-probe",
        method: "tools/list",
        params: {},
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function detectRunningWorker(candidateUrls: string[]): Promise<string | null> {
  for (const candidateUrl of candidateUrls) {
    if (await probeWorker(candidateUrl)) {
      return candidateUrl;
    }
  }

  return null;
}

async function waitForWorker(candidateUrls: string[], timeoutMs: number): Promise<string> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const detectedUrl = await detectRunningWorker(candidateUrls);
    if (detectedUrl) {
      return detectedUrl;
    }

    await Bun.sleep(250);
  }

  throw new Error(`Timed out waiting for a local MCP worker at ${candidateUrls.join(", ")}.`);
}

function spawnManagedProcess(cmd: string[], cwd: string): ManagedProcess {
  return Bun.spawn(cmd, {
    cwd,
    env: process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
}

async function stopProcess(
  processRef: ManagedProcess | null,
  signal: NodeJS.Signals,
): Promise<void> {
  if (!processRef || processRef.killed) {
    return;
  }

  processRef.kill(signal);
  await processRef.exited.catch(() => undefined);
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const candidateUrls = buildCandidateUrls(process.env.INTERNAL_MCP_LOCAL_URL);
  let worker: ManagedProcess | null = null;
  let inspector: ManagedProcess | null = null;
  let startedWorker = false;
  let shuttingDown = false;

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    log(`Shutting down after ${signal}...`);
    await stopProcess(inspector, signal);
    if (startedWorker) {
      await stopProcess(worker, signal);
    }
    process.exit(0);
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  try {
    let workerUrl = await detectRunningWorker(candidateUrls);
    if (workerUrl) {
      log(`Reusing running local MCP server at ${workerUrl}.`);
    } else {
      log(`Starting local Cloudflare worker on port ${defaultWorkerPort}...`);
      startedWorker = true;
      worker = spawnManagedProcess(["vp", "run", "dev"], cwd);

      log("Waiting for the local MCP endpoint...");
      workerUrl = await waitForWorker(candidateUrls, 20_000);
    }

    if (!workerUrl) {
      throw new Error("Unable to resolve a local MCP server URL.");
    }

    log(`Starting MCP Inspector for ${workerUrl}...`);
    inspector = spawnManagedProcess(
      ["bunx", "@modelcontextprotocol/inspector", "--transport", "http", "--server-url", workerUrl],
      cwd,
    );

    const firstExit = await Promise.race([
      inspector.exited.then((exitCode) => ({
        name: "inspector" as const,
        exitCode,
      })),
      ...(worker
        ? [
            worker.exited.then((exitCode) => ({
              name: "worker" as const,
              exitCode,
            })),
          ]
        : []),
    ]);

    if (!shuttingDown) {
      await stopProcess(inspector, "SIGTERM");
      if (startedWorker) {
        await stopProcess(worker, "SIGTERM");
      }
      if (firstExit.exitCode === 0) {
        process.exit(0);
      }
      throw new Error(`${firstExit.name} exited unexpectedly with code ${firstExit.exitCode}.`);
    }
  } finally {
    if (!shuttingDown) {
      await stopProcess(inspector, "SIGTERM");
      if (startedWorker) {
        await stopProcess(worker, "SIGTERM");
      }
    }
  }
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unexpected tool:dev error.";
  console.error(`[tool:dev] ${message}`);
  process.exit(1);
});

export {};
