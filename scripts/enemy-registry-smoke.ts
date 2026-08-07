import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ENEMY_DEFINITIONS, PRODUCTION_ENEMY_KINDS } from "../app/game/enemy-definitions";
import { ENEMY_SKILLS } from "../app/game/enemy-skills";
import { chooseEnemyForSpawn, enemyRotation, ENEMY_ROTATIONS } from "../app/game/enemy-spawn";
import { createExpeditionGame, createNewGame } from "../app/game/engine";
import type { EnemyKind, EnemyRegion } from "../app/game/types";

const root = fileURLToPath(new URL("../", import.meta.url));
const productionSet = new Set(PRODUCTION_ENEMY_KINDS);
assert.equal(PRODUCTION_ENEMY_KINDS.length, 43, "production roster count changed; update parity intentionally");

for (const kind of PRODUCTION_ENEMY_KINDS) {
  const definition = ENEMY_DEFINITIONS[kind];
  assert.ok(definition.name && definition.description, `${kind}: localized identity`);
  assert.ok(definition.region && definition.aiProfile, `${kind}: region and AI profile`);
  assert.ok(definition.baseStats.hp > 0 && definition.xp >= 0, `${kind}: valid stats`);
  assert.ok(existsSync(`${root}public${definition.sprite.file}`), `${kind}: original sprite exists`);
  for (const skillId of definition.skills) assert.ok(ENEMY_SKILLS[skillId], `${kind}: ${skillId} exists`);
  for (const rule of definition.skillRules) {
    assert.ok(definition.skills.includes(rule.skillId), `${kind}: loadout owns ${rule.skillId}`);
    assert.ok(ENEMY_SKILLS[rule.skillId], `${kind}: rule skill exists`);
    assert.ok((rule.windupTurns ?? 0) >= 0 && (rule.cooldown ?? 0) >= 0, `${kind}: valid rule`);
  }
  if (definition.rareAlt) {
    assert.ok(productionSet.has(definition.rareAlt), `${kind}: rare alt is production-ready`);
    assert.equal(ENEMY_DEFINITIONS[definition.rareAlt].type, "rareAlt");
  }
}

for (const [region, rotations] of Object.entries(ENEMY_ROTATIONS) as [EnemyRegion, readonly (readonly EnemyKind[])[]][]) {
  assert.equal(rotations.length, 5, `${region}: five relative-depth stages`);
  rotations.flat().forEach((kind) => assert.ok(productionSet.has(kind), `${region}: ${kind} is registered`));
  let seed = 0x41c6ce57;
  const roll = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const first = Array.from({ length: 12 }, () => chooseEnemyForSpawn(region, 3, roll));
  seed = 0x41c6ce57;
  const second = Array.from({ length: 12 }, () => chooseEnemyForSpawn(region, 3, roll));
  assert.deepEqual(first, second, `${region}: seeded spawn selection is deterministic`);
}

const forcedRolls = [0, 0];
assert.equal(
  chooseEnemyForSpawn("sewers", 0, () => forcedRolls.shift() ?? 0),
  "albino",
  "rare alternate replaces a selected base mob",
);

const regionCases = [
  ["sewers", 1], ["prison", 3], ["caves", 4], ["city", 5], ["halls", 7],
] as const;
for (const [region, difficulty] of regionCases) {
  const seed = 0x5eeda000 + difficulty;
  const base = createNewGame(seed);
  const make = () => createExpeditionGame(seed, {
    dungeonId:`spawn-test-${region}`, dungeonName:region, maxFloor:5,
    difficultyScale:1, difficulty, enemyRegion:region, mainDropIds:[],
    specialRoomPlan:[], lootPlan:[], goldPlan:[], quests:[],
  }, base.player, []);
  const first = make();
  const second = make();
  assert.deepEqual(
    first.enemies.map(({kind,x,y}) => ({kind,x,y})),
    second.enemies.map(({kind,x,y}) => ({kind,x,y})),
    `${region}: seeded types and positions repeat`,
  );
  const baseKinds = new Set(enemyRotation(region, 0));
  const allowed = new Set<EnemyKind>(baseKinds);
  baseKinds.forEach((kind) => {
    const rare = ENEMY_DEFINITIONS[kind].rareAlt;
    if (rare) allowed.add(rare);
  });
  if (baseKinds.has("shaman_red")) ["shaman_red","shaman_blue","shaman_purple"].forEach((kind) => allowed.add(kind as EnemyKind));
  if (baseKinds.has("elemental_fire")) ["elemental_fire","elemental_frost","elemental_shock","elemental_chaos"].forEach((kind) => allowed.add(kind as EnemyKind));
  first.enemies
    .filter((enemy) => !enemy.questId)
    .forEach((enemy) => assert.ok(allowed.has(enemy.kind), `${region}: ${enemy.kind} belongs to floor pool`));
}

const parity = readFileSync(`${root}ENEMY_PARITY.md`, "utf8");
assert.equal((parity.match(/\| 구현 \|/g) ?? []).length, PRODUCTION_ENEMY_KINDS.length);
assert.ok(parity.includes("후속 boss 작업"));
console.log(`enemy registry/parity smoke passed (${PRODUCTION_ENEMY_KINDS.length} production enemies)`);
