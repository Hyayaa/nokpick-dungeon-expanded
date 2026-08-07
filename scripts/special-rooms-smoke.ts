import assert from "node:assert/strict";
import {
  createExpeditionGame,
  createNewGame,
  playerStep,
  throwItem,
  useItem as consumeItem,
} from "../app/game/engine";
import { findPath, generateFloor } from "../app/game/map";
import {
  P0_SPECIAL_ROOM_PRESETS,
  SPECIAL_ROOM_REGISTRY,
  type SpecialRoomPreset,
} from "../app/game/special-rooms";
import type { GameState, Point } from "../app/game/types";

const seed = 0x51ec1a17;
const base = createNewGame(seed);
const rules = {
  dungeonId: base.dungeonId,
  dungeonName: base.dungeonName,
  maxFloor: base.maxFloor,
  difficultyScale: base.difficultyScale,
  difficulty: base.difficulty,
  mainDropIds: [...base.mainDropIds],
  lootPlan: [],
  goldPlan: [],
};
const gameFor = (preset: SpecialRoomPreset, gameSeed = seed) =>
  createExpeditionGame(
    gameSeed,
    rules,
    base.player,
    [],
    [],
    preset,
  );
const pointsWithTerrain = (game: GameState, terrain: string) =>
  game.tiles.flatMap((row, y) =>
    row.flatMap((tile, x) => tile.terrain === terrain ? [{ x, y }] : []),
  );
const roomContains = (
  room: NonNullable<GameState["specialRooms"]>[number],
  point: Point,
) =>
  point.x >= room.left && point.x <= room.right &&
  point.y >= room.top && point.y <= room.bottom;
const stageNextTo = (game: GameState, target: Point) => {
  const approach = [
    { x: target.x - 1, y: target.y },
    { x: target.x + 1, y: target.y },
    { x: target.x, y: target.y - 1 },
    { x: target.x, y: target.y + 1 },
  ].find((point) => game.tiles[point.y]?.[point.x]);
  assert.ok(approach, "an adjacent staging point must exist");
  game.player.x = approach.x;
  game.player.y = approach.y;
  return { dx: target.x - approach.x, dy: target.y - approach.y };
};

assert.equal(
  new Set(SPECIAL_ROOM_REGISTRY.map((entry) => entry.compatibilityGroup)).size,
  2,
  "potion-solution and crystal-key compatibility groups must be registry data",
);

for (const preset of P0_SPECIAL_ROOM_PRESETS) {
  const game = gameFor(preset);
  const repeated = gameFor(preset);
  assert.deepEqual(game.tiles, repeated.tiles, `${preset} terrain must be seeded`);
  assert.deepEqual(game.traps, repeated.traps, `${preset} traps must be seeded`);
  assert.deepEqual(
    game.groundItems.filter((item) => item.id.includes("required")),
    repeated.groundItems.filter((item) => item.id.includes("required")),
    `${preset} required loot location must be seeded`,
  );
  const room = game.specialRooms?.find((candidate) => candidate.kind === preset);
  assert.ok(room, `${preset} must generate through the shared room preset path`);
  for (const requirement of game.requiredFloorSpawns ?? []) {
    const item = game.groundItems.find((candidate) => candidate.id === requirement.id);
    assert.ok(item, `${preset} must place ${requirement.defId}`);
    assert.ok(!roomContains(room, item), `${requirement.defId} must be outside its puzzle room`);
    assert.notEqual(game.tiles[item.y][item.x].terrain, "chasm");
    assert.ok(
      findPath(game.tiles, game.player, item, new Set(), false).length > 0,
      `${requirement.defId} must be reachable without unlocking a reward room`,
    );
  }
  assert.ok(
    (game.traps ?? []).every((trap) =>
      !game.groundItems.some((item) => item.x === trap.x && item.y === trap.y) &&
      !game.enemies.some((enemy) => enemy.x === trap.x && enemy.y === trap.y),
    ),
    `${preset} traps must not overlap ordinary spawns`,
  );
}

{
  const game = gameFor("storage");
  game.enemies = [];
  const barricade = pointsWithTerrain(game, "barricade")[0];
  assert.ok(barricade);
  const step = stageNextTo(game, barricade);
  game.player.inventory.potion_liquid_flame = 1;
  const burned = throwItem(game, "potion_liquid_flame", barricade).state;
  assert.equal(burned.tiles[barricade.y][barricade.x].terrain, "floor");
  const entered = playerStep(burned, step.dx, step.dy);
  assert.equal(entered.state.player.x, barricade.x);
  assert.equal(entered.state.player.y, barricade.y);
}

{
  const game = gameFor("magicalFire");
  game.enemies = [];
  const fire = pointsWithTerrain(game, "magicalFire")[0];
  assert.ok(fire);
  const step = stageNextTo(game, fire);
  const blocked = playerStep(game, step.dx, step.dy);
  assert.equal(blocked.consumedTurn, false);
  game.player.inventory.potion_frost = 1;
  const cooled = throwItem(game, "potion_frost", fire).state;
  assert.equal(pointsWithTerrain(cooled, "magicalFire").length, 0);
  const entered = playerStep(cooled, step.dx, step.dy);
  assert.equal(entered.state.player.x, fire.x);
}

{
  const game = gameFor("toxicGas");
  const room = game.specialRooms?.find((candidate) => candidate.kind === "toxicGas");
  assert.ok(room);
  game.player.x = Math.floor((room.left + room.right) / 2);
  game.player.y = Math.floor((room.top + room.bottom) / 2);
  game.player.inventory.potion_purity = 1;
  const purified = consumeItem(game, "potion_purity").state;
  assert.ok(purified.player.statuses.some((status) => status.id === "purified"));
  assert.ok(purified.clouds.every((cloud) => cloud.kind !== "toxic"));
}

{
  let trapGame: GameState | null = null;
  for (let candidateSeed = 1; candidateSeed <= 24; candidateSeed += 1) {
    const candidate = gameFor("traps", candidateSeed);
    if ((candidate.traps ?? []).some((trap) => trap.active)) {
      trapGame = candidate;
      break;
    }
  }
  assert.ok(trapGame, "a supported deterministic trap variant must generate");
  trapGame.enemies = [];
  const trap = trapGame.traps?.find((candidate) => candidate.active);
  assert.ok(trap);
  const step = stageNextTo(trapGame, trap);
  const triggered = playerStep(trapGame, step.dx, step.dy).state;
  assert.equal(triggered.traps?.find((candidate) => candidate.id === trap.id)?.triggered, true);

  let chasmGame: GameState | null = null;
  for (let candidateSeed = 1; candidateSeed <= 24; candidateSeed += 1) {
    const candidate = gameFor("traps", candidateSeed);
    if (pointsWithTerrain(candidate, "chasm").some((point) =>
      candidate.specialRooms?.some((room) => room.kind === "traps" && roomContains(room, point)))) {
      chasmGame = candidate;
      break;
    }
  }
  assert.ok(chasmGame, "a deterministic CHASM trap variant must generate");
  const chasm = pointsWithTerrain(chasmGame, "chasm").find((point) =>
    chasmGame?.specialRooms?.some((room) => room.kind === "traps" && roomContains(room, point)));
  assert.ok(chasm);
  const chasmStep = stageNextTo(chasmGame, chasm);
  assert.equal(playerStep(chasmGame, chasmStep.dx, chasmStep.dy).consumedTurn, false);
  chasmGame.player.statuses.push({ id: "levitating", turns: 10, power: 1 });
  assert.equal(playerStep(chasmGame, chasmStep.dx, chasmStep.dy).consumedTurn, true);
}

const consumeCrystalDoors = (preset: "crystalChoice" | "crystalPath", keyCount: number) => {
  let game = gameFor(preset);
  game.enemies = [];
  game.groundItems = game.groundItems.filter((item) => item.defId !== "crystal_key");
  game.player.inventory.crystal_key = keyCount;
  const doors = pointsWithTerrain(game, "crystalDoor");
  assert.ok(doors.length > keyCount);
  for (const door of doors.slice(0, keyCount)) {
    const step = stageNextTo(game, door);
    game = playerStep(game, step.dx, step.dy).state;
    assert.equal(game.tiles[door.y][door.x].terrain, "openDoor");
  }
  assert.equal(game.player.inventory.crystal_key ?? 0, 0);
  const blockedDoor = doors[keyCount];
  const blockedStep = stageNextTo(game, blockedDoor);
  const blocked = playerStep(game, blockedStep.dx, blockedStep.dy);
  assert.equal(blocked.state.tiles[blockedDoor.y][blockedDoor.x].terrain, "crystalDoor");
  assert.equal(blocked.consumedTurn, false);
  return { game: blocked.state, opened: doors.slice(0, keyCount), blockedDoor };
};

const choice = consumeCrystalDoors("crystalChoice", 1);
const path = consumeCrystalDoors("crystalPath", 3);
assert.equal(path.opened.length, 3);
const reloaded = JSON.parse(JSON.stringify(choice.game)) as GameState;
assert.equal(reloaded.player.inventory.crystal_key ?? 0, 0);
assert.equal(reloaded.tiles[choice.opened[0].y][choice.opened[0].x].terrain, "openDoor");
assert.equal(reloaded.tiles[choice.blockedDoor.y][choice.blockedDoor.x].terrain, "crystalDoor");

const randomSpecials = new Set<string>();
for (let index = 1; index <= 48; index += 1) {
  generateFloor(index * 7919).specialRooms.forEach((room) => randomSpecials.add(room.kind));
}
assert.ok(randomSpecials.size > 0, "the random special-room pool must be active");

console.log("special rooms, guaranteed loot, traps, crystal choices, determinism, and reload checks passed");
