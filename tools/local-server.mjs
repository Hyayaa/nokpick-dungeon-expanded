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
const durationFromEnvironment = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 50 ? value : fallback;
};
const initialHeartbeatTimeout = durationFromEnvironment(
  "SHATTERED_LOCAL_INITIAL_TIMEOUT_MS",
  120_000,
);
const idleHeartbeatTimeout = durationFromEnvironment(
  "SHATTERED_LOCAL_IDLE_TIMEOUT_MS",
  12 * 60 * 60 * 1_000,
);
const closeGracePeriod = durationFromEnvironment(
  "SHATTERED_LOCAL_CLOSE_GRACE_MS",
  4_000,
);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
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

const byteRangeFor = (header, size) => {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return false;
  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return false;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  ) return false;
  return { start, end: Math.min(end, size - 1) };
};

const sendFile = async (request, response, path) => {
  const fileStat = await stat(path);
  if (!fileStat.isFile()) return false;

  const range = byteRangeFor(request.headers.range, fileStat.size);
  if (range === false) {
    response.writeHead(416, {
      "Content-Range": `bytes */${fileStat.size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store, max-age=0",
    });
    response.end();
    return true;
  }
  const responseSize = range
    ? range.end - range.start + 1
    : fileStat.size;

  response.writeHead(range ? 206 : 200, {
    "Content-Type": contentTypes.get(extname(path).toLowerCase()) ??
      "application/octet-stream",
    "Content-Length": responseSize,
    "Accept-Ranges": "bytes",
    ...(range
      ? { "Content-Range": `bytes ${range.start}-${range.end}/${fileStat.size}` }
      : {}),
    // Local builds reuse stable asset names between releases. Never retain a
    // previous extraction's bytes under the same localhost URL.
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  });
  if (request.method === "HEAD") {
    response.end();
  } else {
    createReadStream(path, range ?? undefined).pipe(response);
  }
  return true;
};

let heartbeatSeen = false;
let lastHeartbeatAt = Date.now();
let closeRequestedAt = null;
let shuttingDown = false;

const markClientActive = () => {
  heartbeatSeen = true;
  lastHeartbeatAt = Date.now();
  closeRequestedAt = null;
};

const cancelPendingClose = () => {
  closeRequestedAt = null;
};

const requestClientClose = () => {
  closeRequestedAt = Date.now();
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url ?? "/", `http://${host}:${port}`).pathname,
    );
    if (
      pathname === "/__shattered_local_heartbeat" ||
      pathname === "/__shattered_local_close"
    ) {
      if (request.method !== "POST") {
        response.writeHead(405, { Allow: "POST" });
        response.end();
        return;
      }
      if (pathname === "/__shattered_local_heartbeat") {
        markClientActive();
      } else {
        requestClientClose();
      }
      response.writeHead(204, { "Cache-Control": "no-store, max-age=0" });
      response.end();
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }
    if (pathname === "/" || pathname === "/index.html") {
      // A fast reload follows pagehide with a new document request. Keep the
      // same local server alive until the replacement page resumes heartbeats.
      cancelPendingClose();
    }
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

const close = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(watchdog);
  server.close(() => process.exit(0));
  const forcedExit = setTimeout(() => process.exit(0), 2_000);
  forcedExit.unref();
};

const watchdog = setInterval(() => {
  const now = Date.now();
  if (
    closeRequestedAt !== null &&
    now - closeRequestedAt >= closeGracePeriod
  ) {
    close();
    return;
  }
  const timeout = heartbeatSeen
    ? idleHeartbeatTimeout
    : initialHeartbeatTimeout;
  if (now - lastHeartbeatAt >= timeout) close();
}, Math.max(50, Math.min(1_000, Math.floor(closeGracePeriod / 2))));

process.on("SIGINT", close);
process.on("SIGTERM", close);
