import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staticRoot = resolve(projectRoot, "local-dist");
const host = "127.0.0.1";
const portFlagIndex = process.argv.indexOf("--port");
const requestedPort = portFlagIndex >= 0
  ? Number(process.argv[portFlagIndex + 1])
  : 5173;
const port = Number.isInteger(requestedPort) && requestedPort >= 1024 && requestedPort <= 65535
  ? requestedPort
  : 5173;

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".txt", "text/plain; charset=utf-8"],
  [".zip", "application/zip"],
]);

const projectFiles = new Map([
  ["/LICENSE.txt", resolve(projectRoot, "public", "LICENSE.txt")],
  [
    "/source/shattered-web-dungeon-source.zip",
    resolve(
      projectRoot,
      "public",
      "source",
      "shattered-web-dungeon-source.zip",
    ),
  ],
]);

const safeStaticPath = (pathname) => {
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const candidate = resolve(staticRoot, relativePath);
  return candidate === staticRoot || candidate.startsWith(`${staticRoot}${sep}`)
    ? candidate
    : null;
};

const sendFile = async (request, response, path) => {
  const fileStat = await stat(path);
  if (!fileStat.isFile()) return false;

  response.writeHead(200, {
    "Content-Type": contentTypes.get(extname(path).toLowerCase()) ??
      "application/octet-stream",
    "Content-Length": fileStat.size,
    // Local builds reuse stable asset names between releases. Never retain a
    // previous extraction's bytes under the same localhost URL.
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  });
  if (request.method === "HEAD") {
    response.end();
  } else {
    createReadStream(path).pipe(response);
  }
  return true;
};

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  try {
    const pathname = decodeURIComponent(
      new URL(request.url ?? "/", `http://${host}:${port}`).pathname,
    );
    if (pathname === "/__shattered_local_health") {
      const body = "shattered-web-dungeon-local\n";
      response.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : body);
      return;
    }
    const projectFile = projectFiles.get(pathname);
    if (projectFile && await sendFile(request, response, projectFile)) return;

    const staticPath = safeStaticPath(pathname);
    if (!staticPath) {
      response.writeHead(403);
      response.end();
      return;
    }
    try {
      if (await sendFile(request, response, staticPath)) return;
    } catch {
      if (extname(pathname)) throw new Error("not found");
    }

    await sendFile(request, response, resolve(staticRoot, "index.html"));
  } catch {
    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    response.end("파일을 찾을 수 없습니다.");
  }
});

server.listen(port, host, () => {
  process.stdout.write(`Local game ready at http://${host}:${port}/\n`);
});

const close = () => server.close(() => process.exit(0));
process.on("SIGINT", close);
process.on("SIGTERM", close);
