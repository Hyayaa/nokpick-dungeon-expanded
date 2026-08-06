import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const directoryBytes = (path: string): number =>
  readdirSync(path, { withFileTypes: true }).reduce(
    (total, entry) => {
      const childPath = join(path, entry.name);
      return total + (
        entry.isDirectory()
          ? directoryBytes(childPath)
          : statSync(childPath).size
      );
    },
    0,
  );

const windowsLauncher = readFileSync("ShatteredWebDungeon-Local.exe");
assert.equal(
  windowsLauncher.subarray(0, 2).toString("ascii"),
  "MZ",
  "the local Windows launcher must have a DOS/PE executable header",
);
const peHeaderOffset = windowsLauncher.readUInt32LE(0x3c);
assert.equal(
  windowsLauncher.subarray(peHeaderOffset, peHeaderOffset + 4).toString("binary"),
  "PE\u0000\u0000",
  "the local Windows launcher must contain a valid PE signature",
);
assert.equal(
  windowsLauncher.readUInt16LE(peHeaderOffset + 4),
  0x8664,
  "the local Windows launcher must target 64-bit Windows",
);
const optionalHeaderOffset = peHeaderOffset + 24;
assert.equal(
  windowsLauncher.readUInt16LE(optionalHeaderOffset + 68),
  2,
  "the local Windows launcher must use the GUI subsystem and never open a terminal",
);
assert.match(
  windowsLauncher.toString("utf16le"),
  /audio=2/,
  "the packaged launcher must contain the audio-server lifecycle fix",
);
const launcherSource = readFileSync(
  "tools/windows-launcher/launcher.c",
  "utf8",
);
const localServerSource = readFileSync("tools/local-server.mjs", "utf8");
const runtimeAssetsSource = readFileSync(
  "app/presentation/runtime-assets.ts",
  "utf8",
);
assert.doesNotMatch(
  launcherSource,
  /npm ci|npm run dev:local|node_modules/,
  "the Windows launcher must never install the development dependency tree",
);
assert.match(
  launcherSource,
  /local-dist\\\\index\.html/,
  "the Windows launcher must start from the prebuilt local game bundle",
);
assert.match(
  launcherSource,
  /tools\\\\local-server\.mjs/,
  "the Windows launcher must use the dependency-free local server",
);
assert.match(
  launcherSource,
  /find_available_local_port[\s\S]*--port %u/,
  "every Windows launch must select a free dedicated port for its own server",
);
assert.doesNotMatch(
  launcherSource,
  /로컬 게임 서버가 이미 실행 중이어서/,
  "the launcher must never mistake an unrelated or older fixed-port server for this build",
);
assert.doesNotMatch(
  launcherSource,
  /브라우저에서 게임이 실행 중입니다/,
  "dismissing a modal must never terminate the running audio server",
);
assert.match(
  launcherSource,
  /page now owns server lifetime through heartbeat\/close/,
  "the launcher must hand local-server lifetime to the game page",
);
assert.match(
  localServerSource,
  /process\.argv\.indexOf\("--port"\)/,
  "the local server must accept the launcher's dedicated port",
);
assert.match(
  localServerSource,
  /__shattered_local_heartbeat[\s\S]*__shattered_local_close/,
  "the local server must remain alive while the game page is heartbeating",
);
assert.match(
  localServerSource,
  /Content-Range[\s\S]*Accept-Ranges/,
  "local MP3 and Ogg responses must support browser media byte ranges",
);
assert.match(
  localServerSource,
  /Cache-Control": "no-store, max-age=0"/,
  "stable local asset names must never reuse bytes from an earlier extraction",
);
assert.match(
  localServerSource,
  /\["\.ogg", "audio\/ogg"\]/,
  "the local launcher must serve original Ogg background music with the correct MIME type",
);
assert.equal(
  (runtimeAssetsSource.match(/\?inline/g) ?? []).length,
  16,
  "all map, item, enemy, and companion images needed to enter a floor must be embedded",
);
assert.equal(
  statSync("local-dist/index.html").size > 0,
  true,
  "the distributable must contain a prebuilt local entry page",
);
assert.equal(
  readdirSync("local-dist/assets/music").filter((name) => name.endsWith(".ogg"))
    .length,
  15,
  "the local bundle must contain all regular original-region music tracks",
);
for (const sound of [
  "click.mp3",
  "blast.mp3",
  "dewdrop.mp3",
  "gas.mp3",
  "hit_arrow.mp3",
  "hit_strong.mp3",
  "lightning.mp3",
  "plant.mp3",
  "zap.mp3",
  "cursed.mp3",
]) {
  assert.equal(
    statSync(join("local-dist/assets/sounds", sound)).size > 0,
    true,
    `${sound} must ship in the local interface/skill audio bundle`,
  );
}
assert.equal(
  directoryBytes("local-dist") < 10 * 1024 * 1024,
  true,
  "the complete prebuilt local bundle, including original music, must stay below ten megabytes",
);

console.log("artifact smoke checks passed");
