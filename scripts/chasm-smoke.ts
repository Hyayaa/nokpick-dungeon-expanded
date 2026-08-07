import assert from "node:assert/strict";
import {
  findPath,
  generateFloor,
  isWalkable,
} from "../app/game/map";
import type { GameState, Terrain, Tile } from "../app/game/types";
import { SEWER_TILE_FRAMES, terrainVisual } from "../app/presentation/render";

const seed = 0x43a5c7e1;
const first = generateFloor(seed);
const repeated = generateFloor(seed);

assert.ok(first.tiles.flat().some((tile) => tile.terrain === "chasm"));
assert.ok(first.tiles.flat().some((tile) => tile.terrain === "specialFloor"));
assert.ok(first.corridorKinds.includes("normal"));
assert.ok(first.corridorKinds.includes("chasm"));
assert.deepEqual(
  first.tiles,
  repeated.tiles,
  "a fixed seed must reproduce terrain and variants",
);
assert.ok(
  findPath(first.tiles, first.start, first.exit, new Set(), true).length > 0,
  "the entrance-to-exit route must remain walkable after unlocking",
);
assert.equal(isWalkable("chasm"), false);
assert.equal(isWalkable("specialFloor"), true);

const tile = (terrain: Terrain, variant = 0): Tile => ({
  terrain,
  variant,
  discovered: true,
  visible: true,
  discoveredMask: 15,
  visibleMask: 15,
});
const boundaryState = {
  width: 5,
  height: 2,
  tiles: [
    [
      tile("floor"),
      tile("specialFloor"),
      tile("wall"),
      tile("water"),
      tile("chasm"),
    ],
    Array.from({ length: 5 }, () => tile("chasm")),
  ],
} as GameState;

assert.deepEqual(
  [0, 1, 2, 3, 4].map((x) => terrainVisual(boundaryState, x, 1)),
  [
    SEWER_TILE_FRAMES.chasmFloor,
    SEWER_TILE_FRAMES.chasmSpecialFloor,
    SEWER_TILE_FRAMES.chasmWall,
    SEWER_TILE_FRAMES.chasmWater,
    SEWER_TILE_FRAMES.chasm,
  ],
  "chasm edges must use Shattered's five source frames",
);
assert.equal(
  terrainVisual(
    { ...boundaryState, width: 1, height: 1, tiles: [[tile("specialFloor", 50)]] } as GameState,
    0,
    0,
  ),
  SEWER_TILE_FRAMES.specialFloorAlt,
  "special floor variation must use the seeded tile variant",
);

const corridorKinds = Array.from({ length: 48 }, (_, index) =>
  generateFloor((seed + index * 7919) >>> 0).corridorKinds,
).flat();
const chasmCorridors = corridorKinds.filter((kind) => kind === "chasm").length;
const chasmRatio = chasmCorridors / corridorKinds.length;
assert.ok(
  chasmRatio >= 0.14 && chasmRatio <= 0.26,
  `corridor-level chasm allocation must stay near twenty percent, got ${chasmRatio}`,
);

console.log("chasm terrain, generation, pathfinding, and rendering checks passed");
