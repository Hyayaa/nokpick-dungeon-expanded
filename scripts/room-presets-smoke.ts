import assert from "node:assert/strict";
import { createExpeditionGame, createNewGame } from "../app/game/engine";
import { findPath, generateFloor, isWalkable } from "../app/game/map";
import {
  P0_ROOM_PRESETS,
  type P0RoomPreset,
} from "../app/game/room-presets";
import type { Point } from "../app/game/types";

const seed = 0x6d2f41b7;
const generated = generateFloor(seed, 0, "none", P0_ROOM_PRESETS);
const repeated = generateFloor(seed, 0, "none", P0_ROOM_PRESETS);

assert.deepEqual(generated.tiles, repeated.tiles, "fixed seeds must reproduce P0 room terrain");
assert.deepEqual(
  generated.roomRegions,
  repeated.roomRegions,
  "fixed seeds must reproduce P0 room selection and size",
);
P0_ROOM_PRESETS.forEach((preset) => {
  assert.ok(generated.roomPresets.includes(preset), `${preset} must be forced into the test floor`);
});
assert.ok(
  generated.roomPresets.some(
    (preset) =>
      preset !== "entrance" &&
      preset !== "exit" &&
      !(P0_ROOM_PRESETS as readonly string[]).includes(preset),
  ),
  "ordinary rooms must remain in the pool beside P0 rooms",
);
assert.ok(
  findPath(generated.tiles, generated.start, generated.exit, new Set(), true).length > 0,
  "the entrance-to-exit route must stay pathable",
);

const pointKey = ({ x, y }: Point) => `${x},${y}`;
const p0Regions = generated.roomRegions.filter((room) =>
  (P0_ROOM_PRESETS as readonly string[]).includes(room.preset),
);

p0Regions.forEach((room) => {
  const points: Point[] = [];
  for (let y = room.top + 1; y < room.bottom; y += 1) {
    for (let x = room.left + 1; x < room.right; x += 1) points.push({ x, y });
  }
  const terrains = points.map(({ x, y }) => generated.tiles[y][x].terrain);
  assert.ok(terrains.includes("chasm"), `${room.preset} must paint real CHASM cells`);
  if (["chasmBridge", "platform", "cavesFissure"].includes(room.preset)) {
    assert.ok(
      terrains.includes("specialFloor"),
      `${room.preset} must paint special-floor bridges or platforms`,
    );
  }

  const walkable = points.filter(({ x, y }) =>
    isWalkable(generated.tiles[y][x].terrain, true),
  );
  const reached = new Set<string>();
  const queue = walkable.slice(0, 1);
  if (queue[0]) reached.add(pointKey(queue[0]));
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ].forEach(({ x: dx, y: dy }) => {
      const next = { x: point.x + dx, y: point.y + dy };
      const key = pointKey(next);
      if (
        next.x <= room.left ||
        next.x >= room.right ||
        next.y <= room.top ||
        next.y >= room.bottom ||
        reached.has(key) ||
        !isWalkable(generated.tiles[next.y][next.x].terrain, true)
      ) {
        return;
      }
      reached.add(key);
      queue.push(next);
    });
  }
  assert.ok(
    walkable.every((point) => reached.has(pointKey(point))),
    `${room.preset} must keep every non-CHASM area cardinally connected`,
  );
});

assert.equal(generated.tiles[generated.start.y][generated.start.x].terrain, "entrance");
assert.equal(generated.tiles[generated.exit.y][generated.exit.x].terrain, "exit");
assert.notEqual(generated.tiles[generated.keyPoint.y][generated.keyPoint.x].terrain, "chasm");
assert.notEqual(generated.tiles[generated.alchemyPoint.y][generated.alchemyPoint.x].terrain, "chasm");

const seen = new Set<P0RoomPreset>();
for (let index = 1; index <= 96 && seen.size < P0_ROOM_PRESETS.length; index += 1) {
  generateFloor((index * 104729) >>> 0).roomPresets.forEach((preset) => {
    if ((P0_ROOM_PRESETS as readonly string[]).includes(preset)) {
      seen.add(preset as P0RoomPreset);
    }
  });
}
assert.deepEqual(
  [...seen].sort(),
  [...P0_ROOM_PRESETS].sort(),
  "all P0 presets must be reachable through the random standard-room pool",
);

const base = createNewGame(seed);
const expedition = createExpeditionGame(
  seed,
  {
    dungeonId: base.dungeonId,
    dungeonName: base.dungeonName,
    maxFloor: base.maxFloor,
    difficultyScale: base.difficultyScale,
    difficulty: base.difficulty,
    mainDropIds: [...base.mainDropIds],
    lootPlan: base.lootPlan,
    goldPlan: base.goldPlan,
  },
  base.player,
  [],
  P0_ROOM_PRESETS,
);
assert.ok(
  expedition.enemies.every(
    ({ x, y }) => expedition.tiles[y][x].terrain !== "chasm",
  ),
  "ordinary enemies must never spawn on CHASM",
);
assert.ok(
  expedition.groundItems.every(
    ({ x, y }) => expedition.tiles[y][x].terrain !== "chasm",
  ),
  "ground loot must never spawn on CHASM",
);

console.log("P0 room presets, connectivity, spawn safety, and determinism checks passed");
