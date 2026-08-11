import assert from "node:assert/strict";
import {
  CRITICAL_DAMAGE_TEXT_DURATION_MS,
  CRITICAL_DAMAGE_TEXT_FILL,
  CRITICAL_DAMAGE_TEXT_STROKE,
  NORMAL_DAMAGE_TEXT_DURATION_MS,
  combatEffectMotionAt,
} from "../app/presentation/effects";
import {
  DEFAULT_CRITICAL_CHANCE,
  DEFAULT_CRITICAL_DAMAGE_BONUS,
  DEFAULT_LIFE_STEAL,
  applyLifeSteal,
  normalizeCombatStats,
  resolveCriticalDamage,
} from "../app/game/combat-stats";
import { createDeveloperTestMap } from "../app/game/developer-test-map";
import {
  activateCompanionSkill,
  createNewGame,
  developerGrantItem,
  manualCompanionStep,
  playerStep,
  runEnemyTurn,
  throwItem,
  zapWand,
} from "../app/game/engine";
import {
  companionToPlayer,
  playerToCompanion,
} from "../app/game/campaign";
import { createCompanion } from "../app/game/companions";
import {
  createEnemyFromDefinition,
  enemyDefinition,
} from "../app/game/enemy-definitions";
import { applyEnemyIncomingDamage } from "../app/game/enemy-combat";
import { cloneGame } from "../app/game/state";
import type {
  CombatEffect,
  Enemy,
  EnemyKind,
  GameState,
  Point,
} from "../app/game/types";

const makeEnemy = (
  kind: EnemyKind,
  id: string,
  point: Point,
  overrides: Partial<Enemy> = {},
) => {
  const definition = enemyDefinition(kind);
  return createEnemyFromDefinition(
    kind,
    id,
    point,
    { ...definition.baseStats, xp: definition.xp },
    {
      alerted: true,
      sawPlayerLastTurn: true,
      sleeping: false,
      wakeCooldown: 0,
      lastSeenPlayer: null,
      searchTurns: 0,
      drop: null,
      ...overrides,
    },
  );
};

const arena = (seed = 0xc8171ca1) => {
  const state = createDeveloperTestMap(createNewGame(seed));
  state.enemies = [];
  state.companions = [];
  state.objects = [];
  state.clouds = [];
  state.wards = [];
  state.traps = [];
  state.quests = [];
  state.questNpcs = [];
  state.questRooms = [];
  state.bossId = undefined;
  state.bossEncounter = undefined;
  state.player.x = 29;
  state.player.y = 80;
  state.player.statuses = [];
  state.player.invisibleTurns = 0;
  for (let y = 75; y <= 90; y += 1) {
    for (let x = 20; x <= 50; x += 1) {
      state.tiles[y][x] = {
        ...state.tiles[y][x],
        terrain: "floor",
        visible: true,
        discovered: true,
        visibleMask: 15,
        discoveredMask: 15,
      };
    }
  }
  return state;
};

assert.deepEqual(normalizeCombatStats(undefined), {
  criticalChance: DEFAULT_CRITICAL_CHANCE,
  criticalDamageBonus: DEFAULT_CRITICAL_DAMAGE_BONUS,
  lifeSteal: DEFAULT_LIFE_STEAL,
});

const defaultGame = createNewGame(0xc8170001);
assert.equal(defaultGame.player.criticalChance, 0.01);
assert.equal(defaultGame.companions[0].criticalChance, 0.01);
assert.equal(defaultGame.enemies[0].criticalChance, 0.01);
assert.equal(defaultGame.player.criticalDamageBonus, 0.5);
assert.equal(defaultGame.player.lifeSteal, 0);

const forcedCritical = resolveCriticalDamage(
  10,
  { criticalChance: 1, criticalDamageBonus: 0.5, lifeSteal: 0 },
  0.99,
);
assert.deepEqual(forcedCritical, { damage: 15, critical: true });
assert.deepEqual(
  resolveCriticalDamage(
    10,
    { criticalChance: 0, criticalDamageBonus: 0.5, lifeSteal: 0 },
    0,
  ),
  { damage: 10, critical: false },
);

const lifeStealActor = {
  hp: 50,
  maxHp: 100,
  criticalChance: 0,
  criticalDamageBonus: 0.5,
  lifeSteal: 0.25,
};
assert.equal(applyLifeSteal(lifeStealActor, 20), 5);
assert.equal(lifeStealActor.hp, 55);
const fullActor = { ...lifeStealActor, hp: 100 };
assert.equal(applyLifeSteal(fullActor, 20), 0);
assert.equal(fullActor.hp, 100);

const overkillState = arena(0xc8170002);
const overkillEnemy = makeEnemy("rat", "overkill", { x: 30, y: 80 }, {
  hp: 3,
  maxHp: 30,
});
overkillState.enemies = [overkillEnemy];
const actualOverkillDamage = applyEnemyIncomingDamage(
  overkillState,
  overkillEnemy,
  20,
);
assert.equal(actualOverkillDamage, 3);
const overkillAttacker = {
  hp: 10,
  maxHp: 20,
  criticalChance: 0,
  criticalDamageBonus: 0.5,
  lifeSteal: 1,
};
assert.equal(applyLifeSteal(overkillAttacker, actualOverkillDamage), 3);

const oldSave = JSON.parse(JSON.stringify(defaultGame)) as GameState;
for (const actor of [oldSave.player, ...oldSave.companions, ...oldSave.enemies]) {
  delete (actor as Partial<typeof actor>).criticalChance;
  delete (actor as Partial<typeof actor>).criticalDamageBonus;
  delete (actor as Partial<typeof actor>).lifeSteal;
}
const normalizedOldSave = cloneGame(oldSave);
for (const actor of [
  normalizedOldSave.player,
  ...normalizedOldSave.companions,
  ...normalizedOldSave.enemies,
]) {
  assert.deepEqual(normalizeCombatStats(actor), normalizeCombatStats(undefined));
}

const convertedCompanion = createCompanion("mage", { x: 0, y: 0 });
convertedCompanion.criticalChance = 0.33;
convertedCompanion.criticalDamageBonus = 0.8;
convertedCompanion.lifeSteal = 0.2;
const convertedPlayer = companionToPlayer(convertedCompanion);
const roundTripCompanion = playerToCompanion(convertedPlayer);
assert.deepEqual(
  normalizeCombatStats(roundTripCompanion),
  normalizeCombatStats(convertedCompanion),
);

const playerAttackState = arena(0xc8170010);
playerAttackState.player.accuracy = 1_000_000;
playerAttackState.player.criticalChance = 1;
playerAttackState.player.lifeSteal = 0.5;
playerAttackState.player.hp = playerAttackState.player.maxHp - 20;
playerAttackState.enemies = [makeEnemy("rat", "player-target", { x: 30, y: 80 }, {
  hp: 100,
  maxHp: 100,
  defense: 0,
  evasion: 0,
})];
const playerHpBefore = playerAttackState.player.hp;
const playerAttack = playerStep(playerAttackState, 1, 0);
const playerCritical = playerAttack.effects.find(
  (effect) => effect.kind === "damage" && effect.sourceId === "player",
);
assert.equal(playerCritical?.critical, true);
assert.equal(playerCritical?.kind, "damage");
assert.ok(playerAttack.state.player.hp > playerHpBefore);
assert.ok(playerAttack.effects.some((effect) => effect.kind === "healing"));

const companionAttackState = arena(0xc8170011);
const attackingCompanion = createCompanion("warrior", { x: 29, y: 80 });
attackingCompanion.accuracy = 1_000_000;
attackingCompanion.criticalChance = 1;
attackingCompanion.lifeSteal = 0.5;
attackingCompanion.hp = attackingCompanion.maxHp - 20;
companionAttackState.player.x = 24;
companionAttackState.companions = [attackingCompanion];
companionAttackState.enemies = [makeEnemy("rat", "companion-target", { x: 30, y: 80 }, {
  hp: 100,
  maxHp: 100,
  defense: 0,
  evasion: 0,
})];
const companionAttack = manualCompanionStep(
  companionAttackState,
  attackingCompanion.id,
  1,
  0,
);
assert.equal(
  companionAttack.effects.find((effect) => effect.kind === "damage")?.critical,
  true,
);
assert.ok(companionAttack.effects.some((effect) => effect.kind === "healing"));

const enemyAttackState = arena(0xc8170012);
enemyAttackState.player.baseDefense = 0;
enemyAttackState.player.evasion = 0;
enemyAttackState.player.shield = 0;
const attackingEnemy = makeEnemy("rat", "enemy-attacker", { x: 30, y: 80 }, {
  hp: 40,
  maxHp: 100,
  attack: 20,
  accuracy: 1_000_000,
  criticalChance: 1,
  lifeSteal: 0.5,
});
enemyAttackState.enemies = [attackingEnemy];
const enemyAttack = runEnemyTurn(enemyAttackState);
const enemyCritical = enemyAttack.effects.find(
  (effect) => effect.kind === "damage" && effect.sourceId === attackingEnemy.id,
);
assert.equal(enemyCritical?.critical, true);
assert.ok(enemyAttack.state.enemies[0].hp > attackingEnemy.hp);

const shieldState = arena(0xc8170013);
shieldState.player.evasion = 0;
shieldState.player.shield = 1_000;
const shieldEnemy = makeEnemy("rat", "shield-attacker", { x: 30, y: 80 }, {
  hp: 40,
  maxHp: 100,
  attack: 20,
  accuracy: 1_000_000,
  criticalChance: 1,
  lifeSteal: 1,
});
shieldState.enemies = [shieldEnemy];
const shieldResult = runEnemyTurn(shieldState);
assert.equal(shieldResult.state.player.hp, shieldState.player.hp);
assert.equal(shieldResult.state.enemies[0].hp, shieldEnemy.hp);
assert.equal(
  shieldResult.effects.some((effect) => effect.kind === "healing"),
  false,
);

const skillState = arena(0xc8170014);
skillState.player.classId = "mage";
skillState.player.professionId = "mage";
skillState.player.skills = ["fireball"];
skillState.player.learnedSkills = ["fireball"];
skillState.player.skillLevels = { fireball: 1 };
skillState.player.criticalChance = 1;
skillState.enemies = [makeEnemy("rat", "skill-target", { x: 32, y: 80 }, {
  hp: 100,
  maxHp: 100,
  defense: 0,
})];
const skillResult = activateCompanionSkill(
  skillState,
  "player",
  "fireball",
  { x: 32, y: 80 },
);
assert.equal(
  skillResult.effects.find((effect) => effect.kind === "damage")?.critical,
  true,
);

const enemySkillState = arena(0xc8170015);
enemySkillState.player.evasion = 0;
enemySkillState.enemies = [makeEnemy("shaman_red", "skill-attacker", { x: 26, y: 80 }, {
  accuracy: 1_000_000,
  criticalChance: 1,
})];
const enemySkillResult = runEnemyTurn(enemySkillState);
assert.equal(
  enemySkillResult.effects.find(
    (effect) => effect.kind === "damage" && effect.sourceId === "skill-attacker",
  )?.critical,
  true,
);

let wandState = arena(0xc8170016);
wandState = developerGrantItem(wandState, "wand_magic_missile");
wandState.player.criticalChance = 1;
const wand = wandState.player.inventoryInstances.find(
  (instance) => instance.defId === "wand_magic_missile",
)!;
wandState.enemies = [makeEnemy("rat", "wand-target", { x: 31, y: 80 }, {
  hp: 100,
  maxHp: 100,
})];
const wandResult = zapWand(wandState, wand.id, { x: 31, y: 80 });
assert.equal(
  wandResult.effects.find((effect) => effect.kind === "damage")?.critical,
  true,
);

let throwState = arena(0xc8170017);
throwState = developerGrantItem(throwState, "throwing_knife");
throwState.player.criticalChance = 1;
const throwable = throwState.player.inventoryInstances.find(
  (instance) => instance.defId === "throwing_knife",
)!;
throwState.enemies = [makeEnemy("rat", "throw-target", { x: 32, y: 80 }, {
  hp: 100,
  maxHp: 100,
})];
const throwResult = throwItem(throwState, throwable.id, { x: 32, y: 80 });
assert.equal(
  throwResult.effects.find((effect) => effect.kind === "damage")?.critical,
  true,
);

const deterministicBase = arena(0xc8170020);
deterministicBase.player.accuracy = 1_000_000;
deterministicBase.player.criticalChance = 0.5;
deterministicBase.enemies = [makeEnemy("rat", "seed-target", { x: 30, y: 80 }, {
  hp: 100,
  maxHp: 100,
  defense: 0,
  evasion: 0,
})];
const deterministicA = playerStep(cloneGame(deterministicBase), 1, 0);
const deterministicB = playerStep(cloneGame(deterministicBase), 1, 0);
const damageSnapshot = (effects: CombatEffect[]) => effects
  .filter((effect) => effect.kind === "damage")
  .map(({ text, critical }) => ({ text, critical }));
assert.deepEqual(
  damageSnapshot(deterministicA.effects),
  damageSnapshot(deterministicB.effects),
);

const statusState = arena(0xc8170021);
statusState.player.statuses = [{ id: "poisoned", turns: 3, power: 2 }];
const statusResult = runEnemyTurn(statusState);
assert.equal(
  statusResult.effects
    .filter((effect) => effect.kind === "damage")
    .some((effect) => effect.critical === true),
  false,
);

const criticalMotion = combatEffectMotionAt(
  {
    critical: true,
    velocityX: 99,
    velocityY: 99,
    gravity: 99,
    originOffsetX: 99,
    originOffsetY: 99,
  },
  0.7,
);
assert.deepEqual(criticalMotion, { fade: 1, travelX: 0, travelY: -3.5 });
const normalMotion = combatEffectMotionAt(
  {
    critical: false,
    velocityX: 10,
    velocityY: -20,
    gravity: 50,
    originOffsetX: 2,
    originOffsetY: -3,
  },
  0.5,
);
assert.equal(normalMotion.travelX, 7);
assert.equal(normalMotion.travelY, -6.75);
assert.ok(CRITICAL_DAMAGE_TEXT_DURATION_MS > NORMAL_DAMAGE_TEXT_DURATION_MS);
assert.equal(CRITICAL_DAMAGE_TEXT_FILL, "#ffffff");
assert.equal(CRITICAL_DAMAGE_TEXT_STROKE, "#c52f3d");

console.log(
  "critical/lifesteal smoke passed (defaults, saves, basic attacks, skills, wand, throw, shield, determinism, visuals)",
);
