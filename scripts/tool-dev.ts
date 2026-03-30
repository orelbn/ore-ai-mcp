const workerPort = 8787;
const workerUrl = `http://127.0.0.1:${workerPort}/mcp`;

type ManagedProcess = ReturnType<typeof Bun.spawn>;

function log(message: string): void {
  console.log(`[tool:dev] ${message}`);
}

async function resolveSharedSecret(cwd: string): Promise<string> {
  const explicitSecret = process.env.MCP_INTERNAL_SHARED_SECRET?.trim();
  if (explicitSecret) {
    return explicitSecret;
  }

  const devVarsPath = `${cwd}/.dev.vars`;
  let rawText: string;

  try {
    rawText = await Bun.file(devVarsPath).text();
  } catch {
    throw new Error("Missing .dev.vars. Add MCP_INTERNAL_SHARED_SECRET before running tool:dev.");
  }

  for (const line of rawText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (key === "MCP_INTERNAL_SHARED_SECRET" && value) {
      return value;
    }
  }

  throw new Error("Missing MCP_INTERNAL_SHARED_SECRET in .dev.vars.");
}

async function waitForWorker(url: string, sharedSecret: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          "cf-worker": "ore-ai",
          "x-ore-internal-secret": sharedSecret,
          "x-ore-request-id": "tool-dev-probe",
          "x-ore-user-id": "tool-dev",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "tool-dev-probe",
          method: "tools/list",
          params: {},
        }),
      });

      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the worker is ready or the timeout elapses.
    }

    await Bun.sleep(250);
  }

  throw new Error(`Timed out waiting for local MCP worker at ${url}.`);
}

function spawnManagedProcess(
  cmd: string[],
  cwd: string,
  env?: Record<string, string>,
): ManagedProcess {
  return Bun.spawn(cmd, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
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
  const sharedSecret = await resolveSharedSecret(cwd);
  let localServer: ManagedProcess | null = null;
  let worker: ManagedProcess | null = null;
  let shuttingDown = false;

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    log(`Shutting down after ${signal}...`);
    await stopProcess(localServer, signal);
    await stopProcess(worker, signal);
    process.exit(0);
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  try {
    log(`Starting local Cloudflare worker on port ${workerPort}...`);
    worker = spawnManagedProcess(["bunx", "wrangler", "dev", "--port", `${workerPort}`], cwd);

    const workerExit = worker.exited.then((exitCode) => {
      if (!shuttingDown) {
        throw new Error(`Local Cloudflare worker exited early with code ${exitCode}.`);
      }
    });

    log("Waiting for the local MCP endpoint...");
    await Promise.race([waitForWorker(workerUrl, sharedSecret, 20_000), workerExit]);

    log("Building local MCP dashboard...");
    const buildResult = Bun.spawnSync({
      cmd: ["vp", "build", "internal/local-mcp-dev/ui"],
      cwd,
      stdout: "inherit",
      stderr: "inherit",
    });

    if (buildResult.exitCode !== 0) {
      throw new Error(`Dashboard build failed with code ${buildResult.exitCode}.`);
    }

    log("Starting local MCP dashboard server...");
    localServer = spawnManagedProcess(["bun", "run", "internal/local-mcp-dev/server.ts"], cwd, {
      INTERNAL_MCP_LOCAL_URL: workerUrl,
    });

    const firstExit = await Promise.race([
      localServer.exited.then((exitCode) => ({
        name: "dashboard" as const,
        exitCode,
      })),
      worker.exited.then((exitCode) => ({
        name: "worker" as const,
        exitCode,
      })),
    ]);

    if (!shuttingDown) {
      await stopProcess(localServer, "SIGTERM");
      await stopProcess(worker, "SIGTERM");
      if (firstExit.exitCode === 0) {
        process.exit(0);
      }
      throw new Error(`${firstExit.name} exited unexpectedly with code ${firstExit.exitCode}.`);
    }
  } finally {
    if (!shuttingDown) {
      await stopProcess(localServer, "SIGTERM");
      await stopProcess(worker, "SIGTERM");
    }
  }
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unexpected tool:dev error.";
  console.error(`[tool:dev] ${message}`);
  process.exit(1);
});

export {};
