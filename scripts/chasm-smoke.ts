import assert from "node:assert/strict";
import {
  findPath,
  floorFeelingFor,
  generateFloor,
  isWalkable,
} from "../app/game/map";
import type { GameState, Terrain, Tile } from "../app/game/types";
import { SEWER_TILE_FRAMES, terrainVisual } from "../app/presentation/render";

const seed = 0x43a5c7e1;
const first = generateFloor(seed, 0, "chasm");
const repeated = generateFloor(seed, 0, "chasm");

assert.equal(first.feeling, "chasm");
assert.ok(first.tiles.flat().some((tile) => tile.terrain === "chasm"));
assert.ok(first.tiles.flat().some((tile) => tile.terrain === "specialFloor"));
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

const chasmFeelings = Array.from({ length: 280 }, (_, index) =>
  floorFeelingFor(seed + index, 2),
).filter((feeling) => feeling === "chasm").length;
assert.ok(
  chasmFeelings > 8 && chasmFeelings < 32,
  "chasm feeling must remain a low-probability variation",
);
assert.equal(
  floorFeelingFor(seed, 1),
  "none",
  "the first floor cannot roll a chasm feeling",
);
assert.equal(
  floorFeelingFor(0x00000002, 2),
  "chasm",
  "the developer test seed must force a chasm on floor two",
);

console.log("chasm terrain, generation, pathfinding, and rendering checks passed");
