import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

const reservePort = () =>
  new Promise((resolve, reject) => {
    const reservation = createServer();
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", () => {
      const address = reservation.address();
      const port = typeof address === "object" && address ? address.port : 0;
      reservation.close((error) => error ? reject(error) : resolve(port));
    });
  });

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitFor = async (predicate, timeout, failureMessage) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (await predicate()) return;
    await wait(40);
  }
  throw new Error(failureMessage);
};

const port = await reservePort();
const baseUrl = `http://127.0.0.1:${port}`;
let serverOutput = "";
const child = spawn(
  process.execPath,
  ["tools/local-server.mjs", "--port", String(port)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHATTERED_LOCAL_CLOSE_GRACE_MS: "180",
      SHATTERED_LOCAL_INITIAL_TIMEOUT_MS: "5000",
      SHATTERED_LOCAL_IDLE_TIMEOUT_MS: "5000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
child.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitFor(
    async () => {
      try {
        return (await fetch(`${baseUrl}/__shattered_local_health`)).ok;
      } catch {
        return false;
      }
    },
    4_000,
    `local server did not start\n${serverOutput}`,
  );

  assert.equal((await fetch(`${baseUrl}/`)).status, 200);
  assert.equal(
    (await fetch(`${baseUrl}/__shattered_local_heartbeat`, { method: "POST" }))
      .status,
    204,
    "the local page heartbeat must keep the asset server alive",
  );

  for (const [path, mime] of [
    ["/assets/sounds/step.mp3", "audio/mpeg"],
    ["/assets/music/sewers_1.ogg", "audio/ogg"],
  ]) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Range: "bytes=0-63" },
    });
    assert.equal(response.status, 206, `${path} must support media byte ranges`);
    assert.equal(response.headers.get("content-type"), mime);
    assert.match(response.headers.get("content-range") ?? "", /^bytes 0-63\//);
    assert.equal((await response.arrayBuffer()).byteLength, 64);
  }

  await wait(300);
  assert.equal(
    (await fetch(`${baseUrl}/__shattered_local_health`)).status,
    200,
    "dismissing the launcher must not terminate a heartbeating game server",
  );

  assert.equal(
    (await fetch(`${baseUrl}/__shattered_local_close`, { method: "POST" }))
      .status,
    204,
  );
  await waitFor(
    () => Promise.resolve(child.exitCode !== null),
    3_000,
    "the local server did not stop after the game tab closed",
  );
  assert.equal(child.exitCode, 0);
} finally {
  if (child.exitCode === null) child.kill("SIGTERM");
}

console.log("local server audio lifecycle checks passed");
