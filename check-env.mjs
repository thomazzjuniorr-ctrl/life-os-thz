import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function tryBinary(command, args = []) {
  try {
    const result = spawnSync(command, args, {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    });

    if (result.status !== 0) {
      return null;
    }

    return result.stdout.trim();
  } catch {
    return null;
  }
}

function readNpmVersionFromInstall() {
  try {
    const packageJsonPath = "C:\\Program Files\\nodejs\\node_modules\\npm\\package.json";

    if (!existsSync(packageJsonPath)) {
      return null;
    }

    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return parsed.version || null;
  } catch {
    return null;
  }
}

const result = {
  stack: "HTML + CSS + JavaScript ES Modules + IndexedDB + Node.js + Playwright",
  node: process.version,
  npm: tryBinary("npm", ["-v"]) || readNpmVersionFromInstall(),
  playwrightConfigured: existsSync("playwright.config.mjs"),
  edgeInstalled:
    existsSync("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe") ||
    existsSync("C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"),
  chromeInstalled:
    existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe") ||
    existsSync("C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"),
};

console.log(JSON.stringify(result, null, 2));
