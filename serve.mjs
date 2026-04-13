import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = resolve(__dirname, "..");
const rootArgIndex = process.argv.indexOf("--root");
const rootDir =
  rootArgIndex >= 0 && process.argv[rootArgIndex + 1]
    ? process.argv[rootArgIndex + 1]
    : process.env.ROOT_DIR || ".";
const root = resolve(projectRoot, rootDir);
const port = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function send(response, status, headers, body) {
  response.writeHead(status, headers);
  response.end(body);
}

async function resolveFile(urlPath) {
  const cleanPath = urlPath === "/" ? "/index.html" : urlPath;
  const safePath = normalize(cleanPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root)) {
    return null;
  }

  if (!existsSync(filePath)) {
    return null;
  }

  const fileStat = await stat(filePath);

  if (fileStat.isDirectory()) {
    const indexPath = join(filePath, "index.html");
    if (existsSync(indexPath)) {
      return indexPath;
    }
    return null;
  }

  return filePath;
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host}`);
    const filePath = await resolveFile(requestUrl.pathname);

    if (!filePath) {
      send(response, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not found");
      return;
    }

    const extension = extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Cache-Control": "no-store",
    });

    createReadStream(filePath).pipe(response);
  } catch (error) {
    send(
      response,
      500,
      { "Content-Type": "text/plain; charset=utf-8" },
      error instanceof Error ? error.message : "Server error",
    );
  }
});

server.listen(port, () => {
  console.log(`Life OS Thz 2026 disponível em http://127.0.0.1:${port}`);
});
