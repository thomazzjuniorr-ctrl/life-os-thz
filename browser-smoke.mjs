import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = 4173;
const debugPort = 9223;
const baseUrl = `http://127.0.0.1:${port}`;
const browserPath =
  process.env.BROWSER_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

function startProcess(command, args, options = {}) {
  return spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

async function waitForHttp(url, attempts = 30) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
    } catch {
      // retry
    }

    await delay(500);
  }

  throw new Error(`Endpoint não respondeu: ${url}`);
}

async function getPageWebSocketUrl() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => String(target.url).includes(baseUrl));

      if (page?.webSocketDebuggerUrl) {
        return page.webSocketDebuggerUrl;
      }
    } catch {
      // retry
    }

    await delay(500);
  }

  throw new Error("Não encontrei a página alvo no DevTools Protocol.");
}

async function evaluate(ws, expression) {
  const id = evaluate.nextId++;
  const payload = {
    id,
    method: "Runtime.evaluate",
    params: {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
  };

  return new Promise((resolve, reject) => {
    function onMessage(event) {
      const message = JSON.parse(event.data);

      if (message.id !== id) {
        return;
      }

      ws.removeEventListener("message", onMessage);

      if (message.error) {
        reject(new Error(message.error.message || "Falha ao avaliar expressão."));
        return;
      }

      if (message.result?.exceptionDetails) {
        reject(
          new Error(
            message.result.exceptionDetails.text ||
              "Exceção ao avaliar expressão.",
          ),
        );
        return;
      }

      resolve(message.result?.result?.value);
    }

    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify(payload));
  });
}

evaluate.nextId = 1;

async function send(ws, method, params = {}) {
  const id = evaluate.nextId++;
  const payload = { id, method, params };

  return new Promise((resolve, reject) => {
    function onMessage(event) {
      const message = JSON.parse(event.data);

      if (message.id !== id) {
        return;
      }

      ws.removeEventListener("message", onMessage);

      if (message.error) {
        reject(new Error(message.error.message || `Falha em ${method}`));
        return;
      }

      resolve(message.result || {});
    }

    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify(payload));
  });
}

async function run() {
  const profileDir = await mkdtemp(join(tmpdir(), "life-os-edge-"));
  const server = startProcess(process.execPath, ["tools/serve.mjs"], {
    env: { ...process.env, PORT: String(port) },
  });
  const browser = startProcess(browserPath, [
    "--headless=new",
    "--disable-gpu",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    baseUrl,
  ]);

  let serverLogs = "";
  let browserLogs = "";
  const runtimeEvents = [];

  server.stdout.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });
  browser.stdout.on("data", (chunk) => {
    browserLogs += chunk.toString();
  });
  browser.stderr.on("data", (chunk) => {
    browserLogs += chunk.toString();
  });

  try {
    await waitForHttp(baseUrl);
    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`);

    const wsUrl = await getPageWebSocketUrl();
    const ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });

    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

      if (
        message.method === "Runtime.exceptionThrown" ||
        message.method === "Runtime.consoleAPICalled" ||
        message.method === "Log.entryAdded"
      ) {
        runtimeEvents.push(message);
      }
    });

    await send(ws, "Runtime.enable");
    await send(ws, "Page.enable");
    await send(ws, "Log.enable");
    await delay(5000);

    const appHtml = await evaluate(
      ws,
      "document.getElementById('app')?.innerHTML || ''",
    );
    const readyState = await evaluate(ws, "document.readyState");

    console.log(`document.readyState=${readyState}`);
    console.log(`app-has-shell=${String(appHtml).includes('class=\"app-shell\"')}`);
    console.log("app-html-preview:");
    console.log(String(appHtml).slice(0, 1500));

    if (runtimeEvents.length) {
      console.log("runtime-events:");
      for (const event of runtimeEvents) {
        console.log(JSON.stringify(event));
      }
    }

    if (browserLogs.trim()) {
      console.log("browser-logs:");
      console.log(browserLogs.trim());
    }

    ws.close();
  } finally {
    server.kill();
    browser.kill();
    try {
      await delay(1000);
      await rm(profileDir, { recursive: true, force: true });
    } catch {
      // Edge pode segurar lock por alguns instantes no perfil temporário.
    }

    if (serverLogs.trim()) {
      console.log("server-logs:");
      console.log(serverLogs.trim());
    }
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
