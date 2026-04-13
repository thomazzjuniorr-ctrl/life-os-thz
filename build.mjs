import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = resolve(__dirname, "..");
const distRoot = resolve(projectRoot, "dist");

async function copyEntry(path) {
  const source = resolve(projectRoot, path);
  const target = resolve(distRoot, path);

  if (!existsSync(source)) {
    return;
  }

  await cp(source, target, {
    recursive: true,
    force: true,
  });
}

async function build() {
  await rm(distRoot, {
    recursive: true,
    force: true,
  });

  await mkdir(distRoot, {
    recursive: true,
  });

  await Promise.all([
    copyEntry("index.html"),
    copyEntry("styles.css"),
    copyEntry("favicon.svg"),
    copyEntry("runtime-config.js"),
    copyEntry("manifest.webmanifest"),
    copyEntry("public"),
    copyEntry("src"),
  ]);

  console.log(`Build gerado em ${distRoot}`);
}

build().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
