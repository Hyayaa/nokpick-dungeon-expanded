import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  applyBossMeleeIdentity,
  runBossTurnStartInPlace,
  syncBossPhaseInPlace,
} from "../app/game/boss-behaviors";
import {
  BOSS_DEFINITIONS,
  bossDefinition,
  isBossFloor,
  type BossId,
} from "../app/game/boss-definitions";
import {
  bossCompletionBlockReason,
  pointInBossRoom,
  syncBossEncounterInPlace,
} from "../app/game/boss-encounter";
import {
  DUNGEON_DEFINITIONS,
  generateDungeonOffers,
} from "../app/game/campaign";
import { resolveCombatSkillAffectedTiles } from "../app/game/combat-skills";
import { ITEM_DEFS } from "../app/game/data";
import { createDeveloperTestMap } from "../app/game/developer-test-map";
import { enemyDefinition } from "../app/game/enemy-definitions";
import { ENEMY_ROTATIONS } from "../app/game/enemy-spawn";
import { enemySkill } from "../app/game/enemy-skills";
import {
  advanceExpeditionFloor,
  createExpeditionGame,
  createNewGame,
  descendFloor,
  inventorySlotCount,
  pickupGroundItems,
  runEnemyTurn,
} from "../app/game/engine";
import { isWalkable } from "../app/game/map";
import { cloneGame } from "../app/game/state";
import type { ExpeditionRules } from "../app/game/engine";
import type { GameState, Point } from "../app/game/types";

const seed = 0xb055f100;
const bossRules = (
  maxFloor = 1,
  bossId: BossId | undefined = "goo",
): ExpeditionRules => ({
  dungeonId: "developer-boss-floor",
  dungeonName: "개발자 보스 플로어",
  maxFloor,
  difficultyScale: 1,
  difficulty: 1,
  bossId,
  mainDropIds: [],
  specialRoomPlan: [],
  lootPlan: [],
  goldPlan: [],
  quests: [],
});
const makeBossFloor = (bossId: BossId = "goo") => {
  const base = createNewGame(seed);
  return createExpeditionGame(seed, bossRules(1, bossId), base.player, []);
};
const roundTrip = (state: GameState) =>
  cloneGame(JSON.parse(JSON.stringify(state)) as GameState);

const training = bossDefinition("dev_training_boss");
const gooDefinition = bossDefinition("goo");
assert.deepEqual(Object.keys(BOSS_DEFINITIONS), ["dev_training_boss", "goo"]);
assert.equal(training.production, false);
assert.equal(training.enemyKind, "training_leaper");
assert.equal(gooDefinition.production, true);
assert.equal(gooDefinition.enemyKind, "goo_boss");
assert.equal(gooDefinition.region, "sewers");
assert.equal(gooDefinition.minionCount, 10);
assert.equal(gooDefinition.arena.profile, "goo");
assert.equal(gooDefinition.phaseThreshold, 0.5);
assert.equal(isBossFloor("goo", 2, 3), false);
assert.equal(isBossFloor("goo", 3, 3), true);

const gooEnemyDefinition = enemyDefinition("goo_boss");
assert.equal(gooEnemyDefinition.type, "boss");
assert.equal(gooEnemyDefinition.production, true);
assert.deepEqual(gooEnemyDefinition.baseStats, {
  hp: 100,
  attack: 8,
  defense: 2,
  accuracy: 10,
  evasion: 4,
});
assert.equal(gooEnemyDefinition.xp, 40);
assert.deepEqual(gooEnemyDefinition.properties, ["large", "demonic"]);
assert.equal(gooEnemyDefinition.spawnWeight, 0);
assert.equal(gooEnemyDefinition.dropProfile, "none");
assert.ok(
  Object.values(ENEMY_ROTATIONS).flat(2).every((kind) => kind !== "goo_boss"),
  "Goo must stay out of ordinary enemy rotations",
);
assert.deepEqual(gooEnemyDefinition.sprite.idle, [2, 1, 0, 0, 1]);
assert.deepEqual(gooEnemyDefinition.sprite.run, [3, 2, 1, 2]);
assert.deepEqual(gooEnemyDefinition.sprite.attackFrames, [8, 9, 10]);
assert.deepEqual(gooEnemyDefinition.sprite.chargeFrames, [4, 3, 2, 1, 0]);
assert.deepEqual(gooEnemyDefinition.sprite.specialFrames, [4, 3, 2, 1, 0, 7]);
const gooSpritePath = "public/assets/sprites/goo.png";
assert.equal(existsSync(gooSpritePath), true);
const gooSprite = readFileSync(gooSpritePath);
assert.equal(gooSprite.readUInt32BE(16), 256);
assert.equal(gooSprite.readUInt32BE(20), 16);

const gooSlam = enemySkill("gooSlam")!;
assert.ok(gooSlam);
assert.equal(gooSlam.areaAnchor, "caster");
assert.equal(gooSlam.scalars.radius, 2);
assert.equal(gooSlam.scalars.power, 3);
assert.equal(gooSlam.cooldown, 5);
assert.equal(gooEnemyDefinition.skillRules[0].windupTurns, 2);

const offers = generateDungeonOffers(seed);
const flooded = offers.find((dungeon) => dungeon.themeId === "flooded_sewers")!;
assert.equal(flooded.bossId, "goo");
assert.ok(
  offers.filter((dungeon) => dungeon.themeId !== "flooded_sewers")
    .every((dungeon) => dungeon.bossId === undefined),
);
assert.ok(
  DUNGEON_DEFINITIONS.every(
    (dungeon) => dungeon.themeId !== "flooded_sewers" || dungeon.bossId === "goo",
  ),
);

const productionBase = createNewGame(seed + 1);
let production = createExpeditionGame(
  seed + 1,
  {
    dungeonId: flooded.id,
    dungeonName: flooded.nameKo,
    maxFloor: flooded.floorCount,
    difficultyScale: flooded.difficultyScale,
    difficulty: flooded.difficulty,
    bossId: flooded.bossId,
    mainDropIds: flooded.mainDropIds,
    specialRoomPlan: flooded.specialRoomPlan,
    lootPlan: flooded.lootPlan,
    goldPlan: flooded.goldPlan,
    quests: [],
  },
  productionBase.player,
  [],
);
if (production.maxFloor > 1) {
  assert.equal(production.bossEncounter, undefined);
  assert.ok(production.enemies.length > 0);
}
while (production.floor < production.maxFloor) production = descendFloor(production);
assert.equal(production.bossEncounter?.bossId, "goo");

const ordinaryBase = createNewGame(seed + 2);
const ordinaryFinal = createExpeditionGame(
  seed + 2,
  { ...bossRules(), bossId: undefined },
  ordinaryBase.player,
  [],
);
assert.equal(ordinaryFinal.bossEncounter, undefined);
assert.ok(ordinaryFinal.enemies.length > 0);

const nonFinalBase = createNewGame(seed + 3);
const nonFinal = createExpeditionGame(
  seed + 3,
  bossRules(2),
  nonFinalBase.player,
  [],
);
assert.equal(nonFinal.floor, 1);
assert.equal(nonFinal.bossEncounter, undefined);
assert.ok(nonFinal.enemies.length > 0);

const first = makeBossFloor();
const repeated = makeBossFloor();
const encounter = first.bossEncounter!;
const room = encounter.room;
const boss = first.enemies.find((enemy) => enemy.id === encounter.bossEnemyId)!;
assert.deepEqual({ x: boss.x, y: boss.y }, room.center);
assert.equal(encounter.phase, 1);
assert.equal(encounter.minionIds.length, gooDefinition.minionCount);
assert.equal(first.enemies.length, gooDefinition.minionCount + 1);
assert.ok(first.enemies.every((enemy) => pointInBossRoom(enemy, room)));
assert.ok(
  first.enemies
    .filter((enemy) => enemy.id !== encounter.bossEnemyId)
    .every((enemy) => enemyDefinition(enemy.kind).region === "sewers"),
);
assert.deepEqual(
  first.enemies.map(({ id, kind, x, y }) => ({ id, kind, x, y })),
  repeated.enemies.map(({ id, kind, x, y }) => ({ id, kind, x, y })),
  "same seed must reproduce Goo/minion kinds and positions",
);
const waterTiles: Point[] = [];
for (let y = room.top + 1; y < room.bottom; y += 1) {
  for (let x = room.left + 1; x < room.right; x += 1) {
    if (first.tiles[y][x].terrain === "water") waterTiles.push({ x, y });
  }
}
assert.ok(waterTiles.length > 0 && waterTiles.length < (room.right - room.left - 1) * (room.bottom - room.top - 1));
for (let y = room.center.y - 2; y <= room.center.y + 2; y += 1) {
  for (let x = room.center.x - 2; x <= room.center.x + 2; x += 1) {
    assert.equal(first.tiles[y][x].terrain, "floor");
  }
}
for (let y = room.top + 1; y < room.bottom; y += 1) {
  assert.notEqual(first.tiles[y][room.center.x].terrain, "water");
}

const reachable = (state: GameState, target: Point) => {
  const queue: Point[] = [{ x: state.player.x, y: state.player.y }];
  const visited = new Set(queue.map(({ x, y }) => `${x},${y}`));
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    if (point.x === target.x && point.y === target.y) return true;
    for (const direction of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]) {
      const next = { x: point.x + direction.x, y: point.y + direction.y };
      const key = `${next.x},${next.y}`;
      if (visited.has(key) || !state.tiles[next.y]?.[next.x] || !isWalkable(state.tiles[next.y][next.x].terrain, true)) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
};
assert.equal(reachable(first, room.center), true);

const dormantPositions = first.enemies.map(({ id, x, y }) => ({ id, x, y }));
const dormantTurn = runEnemyTurn(first, { playerInvincible: true }).state;
assert.equal(dormantTurn.bossEncounter?.activated, false);
assert.deepEqual(
  dormantTurn.enemies.map(({ id, x, y }) => ({ id, x, y })),
  dormantPositions,
);
assert.ok(dormantTurn.enemies.every((enemy) => enemy.sleeping));

const activated = cloneGame(first);
activated.player.x = room.left + 1;
activated.player.y = room.top + 1;
syncBossEncounterInPlace(activated);
assert.equal(activated.bossEncounter?.activated, true);
assert.ok(activated.enemies.every((enemy) => !enemy.sleeping && enemy.alerted));
assert.equal(bossCompletionBlockReason(activated), "bossAlive");
assert.equal(advanceExpeditionFloor(cloneGame(activated)).kind, "blocked");

const skillState = cloneGame(activated);
skillState.companions = [];
const skillBoss = skillState.enemies.find((enemy) => enemy.id === encounter.bossEnemyId)!;
skillState.enemies = [skillBoss];
skillState.player.x = skillBoss.x + 1;
skillState.player.y = skillBoss.y;
skillState.player.hp = skillState.player.maxHp;
let skillTurn = runEnemyTurn(skillState, { playerInvincible: false });
const skillBossAfter = skillTurn.state.enemies[0];
assert.equal(skillBossAfter.pendingSkill?.skillId, "gooSlam");
assert.equal(skillBossAfter.pendingSkill?.remainingWindupTurns, 2);
const warnedTiles = skillBossAfter.pendingSkill!.affectedTiles.map((point) => ({ ...point }));
assert.equal(warnedTiles.length, 25);
assert.deepEqual(
  warnedTiles,
  resolveCombatSkillAffectedTiles(gooSlam, skillBossAfter, skillBossAfter),
);
skillTurn = runEnemyTurn(skillTurn.state, { playerInvincible: false });
assert.equal(skillTurn.state.enemies[0].pendingSkill?.remainingWindupTurns, 1);
const hpBeforeSlam = skillTurn.state.player.hp;
skillTurn = runEnemyTurn(skillTurn.state, { playerInvincible: false });
const slamVisual = skillTurn.magicVisuals?.find((visual) => visual.sourceId === skillBoss.id);
assert.deepEqual(slamVisual?.affectedTiles, warnedTiles);
assert.equal(skillTurn.state.enemies[0].pendingSkill, null);
assert.ok(skillTurn.state.player.hp < hpBeforeSlam);
assert.equal(skillTurn.motions.some((motion) => motion.id === skillBoss.id && motion.special), true);

const phaseState = cloneGame(activated);
const phaseBoss = phaseState.enemies.find((enemy) => enemy.id === encounter.bossEnemyId)!;
const freeWater = waterTiles.find((point) => !phaseState.enemies.some((enemy) => enemy.id !== phaseBoss.id && enemy.x === point.x && enemy.y === point.y))!;
phaseBoss.x = freeWater.x;
phaseBoss.y = freeWater.y;
phaseBoss.hp = Math.floor(phaseBoss.maxHp * 0.4);
phaseBoss.pendingSkill = {
  skillId: "gooSlam",
  casterId: phaseBoss.id,
  targetId: "player",
  targetPoint: { ...freeWater },
  affectedTiles: resolveCombatSkillAffectedTiles(gooSlam, freeWater, freeWater),
  remainingWindupTurns: 2,
  startedTurn: phaseState.turn,
  interruptible: true,
  targetLockMode: "fixed",
};
const baseAttack = Number(phaseBoss.behaviorState?.gooBaseAttack);
const baseAccuracy = Number(phaseBoss.behaviorState?.gooBaseAccuracy);
const baseDefense = Number(phaseBoss.behaviorState?.gooBaseDefense);
assert.equal(syncBossPhaseInPlace(phaseState, phaseBoss), true);
const enragedStats = { attack: phaseBoss.attack, accuracy: phaseBoss.accuracy, defense: phaseBoss.defense };
assert.deepEqual(enragedStats, {
  attack: Math.round(baseAttack * 1.35),
  accuracy: Math.round(baseAccuracy * 1.25),
  defense: Math.round(baseDefense * 1.25),
});
assert.equal(syncBossPhaseInPlace(phaseState, phaseBoss), false);
assert.deepEqual({ attack: phaseBoss.attack, accuracy: phaseBoss.accuracy, defense: phaseBoss.defense }, enragedStats);
assert.equal(phaseState.logs.filter((log) => log === "구가 격노했습니다!").length, 1);
const phaseReload = roundTrip(phaseState);
const phaseReloadBoss = phaseReload.enemies.find((enemy) => enemy.id === encounter.bossEnemyId)!;
assert.equal(phaseReload.bossEncounter?.phase, 2);
assert.equal(phaseReloadBoss.hp, phaseBoss.hp);
assert.deepEqual({ x: phaseReloadBoss.x, y: phaseReloadBoss.y }, freeWater);
assert.deepEqual(phaseReloadBoss.pendingSkill, phaseBoss.pendingSkill);
assert.deepEqual(
  { attack: phaseReloadBoss.attack, accuracy: phaseReloadBoss.accuracy, defense: phaseReloadBoss.defense },
  enragedStats,
);
assert.equal(
  phaseReload.enemies.find((enemy) => enemy.id === phaseReload.bossEncounter!.minionIds[0])?.hp,
  phaseState.enemies.find((enemy) => enemy.id === phaseState.bossEncounter!.minionIds[0])?.hp,
);

const healingState = cloneGame(phaseState);
const healingBoss = healingState.enemies.find((enemy) => enemy.id === encounter.bossEnemyId)!;
healingBoss.hp = healingBoss.maxHp - 1;
const healingEffects: Parameters<typeof runBossTurnStartInPlace>[2] = [];
assert.equal(runBossTurnStartInPlace(healingState, healingBoss, healingEffects), 1);
assert.equal(healingBoss.hp, healingBoss.maxHp);
assert.equal(healingEffects.at(-1)?.text, "+1");

const corrosionState = cloneGame(activated);
const corrosionBoss = corrosionState.enemies.find((enemy) => enemy.id === encounter.bossEnemyId)!;
corrosionState.player.statuses = [];
let corroded = false;
for (let attempt = 0; attempt < 24 && !corroded; attempt += 1) {
  corroded = applyBossMeleeIdentity(corrosionState, corrosionBoss, corrosionState.player);
}
assert.equal(corroded, true);
assert.deepEqual(corrosionState.player.statuses.find((status) => status.id === "corroded"), {
  id: "corroded",
  turns: 3,
  power: 1,
});

const aliveReload = roundTrip(activated);
assert.equal(aliveReload.bossEncounter?.defeated, false);
assert.equal(aliveReload.groundItems.some((item) => item.defId === "boss_exit_key"), false);

const deathState = cloneGame(phaseState);
const deathBoss = deathState.enemies.find((enemy) => enemy.id === encounter.bossEnemyId)!;
const deathPoint = { x: deathBoss.x, y: deathBoss.y };
deathBoss.hp = 0;
const deathPlayerHp = deathState.player.hp;
const deathTurn = runEnemyTurn(deathState, { playerInvincible: true });
const defeated = deathTurn.state;
assert.equal(deathTurn.magicVisuals?.some((visual) => visual.sourceId === deathBoss.id), false);
assert.equal(defeated.player.hp, deathPlayerHp);
assert.equal(defeated.bossEncounter?.defeated, true);
assert.deepEqual(defeated.bossEncounter?.bossDeathPoint, deathPoint);
assert.ok(defeated.enemies.some((enemy) => defeated.bossEncounter!.minionIds.includes(enemy.id)));
const droppedKeys = defeated.groundItems.filter((item) => item.defId === "boss_exit_key");
assert.equal(droppedKeys.length, 1);
assert.deepEqual({ x: droppedKeys[0].x, y: droppedKeys[0].y }, deathPoint);
assert.equal(defeated.logs.includes("구를 쓰러뜨렸습니다."), true);
assert.equal(defeated.logs.includes("탈출구 열쇠가 떨어졌습니다."), true);
assert.equal(bossCompletionBlockReason(defeated), "exitKeyMissing");
assert.equal(advanceExpeditionFloor(cloneGame(defeated)).kind, "blocked");

const groundKeyReload = roundTrip(defeated);
syncBossEncounterInPlace(groundKeyReload);
syncBossEncounterInPlace(groundKeyReload);
assert.equal(groundKeyReload.groundItems.filter((item) => item.defId === "boss_exit_key").length, 1);

const pickupState = cloneGame(groundKeyReload);
pickupState.player.x = deathPoint.x;
pickupState.player.y = deathPoint.y;
pickupState.player.inventoryInstances = [];
pickupState.player.autoSlots = [null, null, null, null];
pickupState.player.inventory = Object.fromEntries(
  Array.from({ length: 20 }, (_, index) => [`full-slot-${index}`, 1]),
);
assert.equal(inventorySlotCount(pickupState.player), 20);
const pickedUp = pickupGroundItems(pickupState).state;
assert.equal(pickedUp.player.inventory.boss_exit_key, 1);
assert.equal(pickedUp.bossEncounter?.exitKeyCollected, true);
assert.equal(pickedUp.groundItems.some((item) => item.defId === "boss_exit_key"), false);
assert.equal(pickedUp.logs.at(-1), "탈출구 열쇠를 획득했습니다.");
const collectedReload = roundTrip(pickedUp);
assert.equal(collectedReload.player.inventory.boss_exit_key, 1);
assert.equal(collectedReload.bossEncounter?.exitKeyCollected, true);
assert.equal(collectedReload.groundItems.some((item) => item.defId === "boss_exit_key"), false);
const completed = advanceExpeditionFloor(collectedReload);
assert.equal(completed.kind, "completed");
assert.equal(completed.state.player.inventory.boss_exit_key ?? 0, 0);
assert.ok(completed.state.enemies.some((enemy) => completed.state.bossEncounter!.minionIds.includes(enemy.id)));

assert.equal(ITEM_DEFS.boss_exit_key.category, "key");
const showcase = createDeveloperTestMap(createNewGame(seed + 4));
assert.equal(showcase.bossId, "goo");
assert.equal(showcase.bossEncounter?.bossId, "goo");
assert.equal(showcase.bossEncounter?.minionIds.length, 10);
const trainingFloor = makeBossFloor("dev_training_boss");
assert.equal(trainingFloor.bossEncounter?.bossId, "dev_training_boss");

const componentSource = readFileSync("app/components/DungeonGame.tsx", "utf8");
const rendererSource = readFileSync("app/presentation/dungeon-renderer.ts", "utf8");
const styleSource = readFileSync("app/globals.css", "utf8");
assert.match(componentSource, /bossId: "goo"/);
assert.match(componentSource, /boss-health-display--enraged/);
assert.match(componentSource, /game\.tiles\[activeBoss\.y\]\?\.\[activeBoss\.x\]\?\.visible/);
assert.match(rendererSource, /sprite\.chargeFrames \?\? sprite\.specialFrames/);
assert.match(styleSource, /\.boss-health-display--enraged/);

console.log(
  "Goo boss smoke passed (production floor, arena water, slam, phase, healing, corrosion, exit key, reload, Showcase, HUD)",
);
