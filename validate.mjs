import { readFile } from "node:fs/promises";

async function readText(path) {
  return readFile(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`Validacao falhou: ${label}`);
  }
}

async function run() {
  const [html, js, css] = await Promise.all([
    readText("index.html"),
    readText("src/main.js"),
    readText("styles.css"),
  ]);

  assertIncludes(html, "Life OS Thz 2026", "HTML principal sem titulo esperado");
  assertIncludes(html, 'id="app"', "HTML principal sem container do app");
  assertIncludes(js, "LifeOSApp", "Bootstrap principal sem LifeOSApp");
  assertIncludes(css, ".app-shell", "CSS sem shell principal");

  console.log("Validacao estatica concluida com sucesso.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
