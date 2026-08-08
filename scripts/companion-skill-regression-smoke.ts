import assert from "node:assert/strict";
import {
  createCompanion,
  normalizeCompanionProgression,
} from "../app/game/companions";
import { createDeveloperTestMap } from "../app/game/developer-test-map";
import {
  activateCompanionSkill,
  advanceManualPartyRound,
  createNewGame,
  descendFloor,
  deferActionForManualRound,
  manualCompanionWait,
  runEnemyTurn,
  waitTurn,
} from "../app/game/engine";
import { ENEMY_STATS } from "../app/game/data";
import { COMPANION_SKILLS } from "../app/game/companion-skills";
import {
  createInitialWarehouse,
  type CampaignSave,
} from "../app/game/campaign";
import { createShopState } from "../app/game/commerce";
import {
  equipCompanionSkill,
  learnCompanionSkill,
  swapCompanionSkills,
} from "../app/game/skill-training";
import { companionSkillBlueprint } from "../app/game/companion-skill-blueprints";
import { isWalkable, mapPointKey } from "../app/game/map";
import {
  createSkillResources,
  normalizeSkillResources,
  primarySkillResource,
  recoverSkillResources,
} from "../app/game/skill-resources";
import { cloneGameWithoutTiles } from "../app/game/state";
import { isSkillTargetableTile } from "../app/game/targeting";
import type {
  CompanionSkillId,
  Enemy,
  GameState,
  Point,
} from "../app/game/types";

const expectedCosts = {
  shockLeap: ["stamina", 65],
  drivingLeap: ["stamina", 70],
  weaponThrow: ["stamina", 50],
  whirlwind: ["stamina", 45],
  piercingShot: ["stamina", 45],
  toxicOrb: ["stamina", 45],
  corrosiveFlask: ["stamina", 50],
  entanglingRoots: ["stamina", 50],
  shadowStep: ["stamina", 55],
  execute: ["stamina", 50],
  shieldCharge: ["stamina", 75],
  tripleStrike: ["stamina", 45],
  seismicSlam: ["stamina", 70],
  fireball: ["mana", 20],
  arcaneDischarge: ["mana", 10],
  chainLightning: ["mana", 24],
  frostNova: ["mana", 18],
  fieldMedicine: ["mana", 18],
  wardingSigil: ["mana", 24],
  lifeDrain: ["mana", 22],
} as const satisfies Record<CompanionSkillId, readonly ["stamina" | "mana", number]>;

for (const skillId of Object.keys(COMPANION_SKILLS) as CompanionSkillId[]) {
  const blueprint = companionSkillBlueprint(skillId);
  assert.equal(blueprint.id, skillId);
  assert.ok(blueprint.travelMode && blueprint.impactMode);
  assert.ok(Array.isArray(blueprint.mechanics));
  assert.deepEqual(
    [blueprint.resourceType, blueprint.resourceCost],
    expectedCosts[skillId],
    `${skillId} must declare its production resource cost`,
  );
  assert.ok(
    [300, 400, 500].includes(blueprint.trainingCost),
    `${skillId} must declare a production training cost`,
  );
}

assert.equal(primarySkillResource("warrior"), "stamina");
assert.equal(primarySkillResource("rogue"), "stamina");
assert.equal(primarySkillResource("mage"), "mana");
assert.equal(primarySkillResource("cleric"), "mana");

const skillTarget = (
  state: GameState,
  range: number,
  minimumDistance = 2,
) => {
  const occupied = new Set([
    mapPointKey(state.player),
    ...state.companions.map(mapPointKey),
    ...state.objects.filter((object) => !object.looted).map(mapPointKey),
  ]);
  return state.tiles.flatMap((row, y) =>
    row.map((tile, x) => ({ tile, x, y })))
    .find(({ tile, x, y }) =>
      isWalkable(tile.terrain, false) &&
      Math.max(Math.abs(x - state.player.x), Math.abs(y - state.player.y)) >= minimumDistance &&
      Math.max(Math.abs(x - state.player.x), Math.abs(y - state.player.y)) <= range &&
      isSkillTargetableTile(state, state.player, { x, y }, range, true) &&
      !occupied.has(`${x},${y}`),
    );
};

const shockState = createNewGame(0xc04ba7);
shockState.player.skills = ["shockLeap"];
shockState.player.learnedSkills = ["shockLeap"];
shockState.player.skillCooldowns = {};
shockState.player.currentStamina = 100;
shockState.enemies = [];
const shockTarget = skillTarget(shockState, 6);
assert.ok(shockTarget, "shockLeap regression needs a nearby open landing tile");
const shockResult = activateCompanionSkill(
  shockState,
  shockState.player.companionId,
  "shockLeap",
  { x: shockTarget.x, y: shockTarget.y },
);
assert.equal(shockResult.consumedTurn, true);
assert.equal(shockResult.state.player.currentStamina, 35);
assert.ok(shockResult.motions.some((motion) => motion.travelStyle === "leap"));
assert.ok(shockResult.skillVisuals?.some((visual) => visual.skillId === "shockLeap"));
assert.ok((shockResult.state.player.skillCooldowns.shockLeap ?? 0) > 0);

const insufficientState = createNewGame(0xc04ba7);
insufficientState.player.skills = ["shockLeap"];
insufficientState.player.learnedSkills = ["shockLeap"];
insufficientState.player.skillCooldowns = {};
insufficientState.player.currentStamina = 40;
insufficientState.enemies = [];
const insufficientTarget = skillTarget(insufficientState, 6);
assert.ok(insufficientTarget);
const insufficientResult = activateCompanionSkill(
  insufficientState,
  insufficientState.player.companionId,
  "shockLeap",
  { x: insufficientTarget.x, y: insufficientTarget.y },
);
assert.equal(insufficientResult.consumedTurn, false);
assert.equal(insufficientResult.elapsedTurns ?? 0, 0);
assert.equal(insufficientResult.state.player.currentStamina, 40);
assert.equal(insufficientResult.state.player.skillCooldowns.shockLeap, undefined);
assert.match(
  insufficientResult.state.logs.at(-1) ?? "",
  /기력 부족 · 40 \/ 65/,
);

const manaState = createNewGame(0x51a7e);
manaState.player.professionId = "mage";
manaState.player.skills = ["fireball"];
manaState.player.learnedSkills = ["fireball"];
manaState.player.skillCooldowns = {};
manaState.player.currentMana = 100;
manaState.enemies = [];
const fireballTarget = skillTarget(manaState, 10);
assert.ok(fireballTarget);
const fireballResult = activateCompanionSkill(
  manaState,
  manaState.player.companionId,
  "fireball",
  { x: fireballTarget.x, y: fireballTarget.y },
);
assert.equal(fireballResult.consumedTurn, true);
assert.equal(fireballResult.state.player.currentMana, 80);

const fullTurnResources = { ...createSkillResources(), currentStamina: 0, currentMana: 0 };
recoverSkillResources(fullTurnResources, 1);
assert.equal(fullTurnResources.currentStamina, 10);
assert.equal(fullTurnResources.currentMana, 0.5);
const halfTurnResources = { ...createSkillResources(), currentStamina: 0, currentMana: 0 };
recoverSkillResources(halfTurnResources, 0.5);
assert.equal(halfTurnResources.currentStamina, 5);
assert.equal(halfTurnResources.currentMana, 0.25);

let manualState = createNewGame(0x4a11);
manualState.companions = [
  createCompanion("warrior", { x: 0, y: 0 }, 1),
  createCompanion("mage", { x: 0, y: 0 }, 2),
  createCompanion("cleric", { x: 0, y: 0 }, 3),
];
[manualState.player, ...manualState.companions].forEach((actor) => {
  actor.currentStamina = 0;
  actor.currentMana = 0;
});
const manualActors = [
  "player",
  ...manualState.companions.map((companion) => companion.id),
];
for (const actorId of manualActors) {
  const action = actorId === "player"
    ? waitTurn(manualState, false)
    : manualCompanionWait(manualState, actorId);
  manualState = deferActionForManualRound(manualState, action).state;
}
[manualState.player, ...manualState.companions].forEach((actor) => {
  assert.equal(actor.currentStamina, 0);
  assert.equal(actor.currentMana, 0);
});
manualState = advanceManualPartyRound(manualState).state;
[manualState.player, ...manualState.companions].forEach((actor) => {
  assert.equal(actor.currentStamina, 10);
  assert.equal(actor.currentMana, 0.5);
});

let manualSkillState = createNewGame(0xc04ba7);
manualSkillState.companions = [
  createCompanion("warrior", { x: 0, y: 0 }, 4),
  createCompanion("mage", { x: 0, y: 0 }, 5),
  createCompanion("cleric", { x: 0, y: 0 }, 6),
];
manualSkillState.player.skills = ["shockLeap"];
manualSkillState.player.learnedSkills = ["shockLeap"];
manualSkillState.player.skillCooldowns = {};
manualSkillState.player.currentStamina = 100;
manualSkillState.enemies = [];
const manualSkillTarget = skillTarget(manualSkillState, 6);
assert.ok(manualSkillTarget);
const manualSkillAction = activateCompanionSkill(
  manualSkillState,
  manualSkillState.player.companionId,
  "shockLeap",
  { x: manualSkillTarget.x, y: manualSkillTarget.y },
);
manualSkillState = deferActionForManualRound(
  manualSkillState,
  manualSkillAction,
).state;
assert.equal(manualSkillState.player.currentStamina, 35);
for (const companion of manualSkillState.companions) {
  manualSkillState = deferActionForManualRound(
    manualSkillState,
    manualCompanionWait(manualSkillState, companion.id),
  ).state;
}
manualSkillState = advanceManualPartyRound(
  manualSkillState,
  manualSkillAction.resourceRegenExcludedActorIds,
).state;
assert.equal(
  manualSkillState.player.currentStamina,
  35,
  "the caster must not regenerate during the same manual round as its skill",
);

const clamped = normalizeSkillResources({
  currentStamina: 999,
  maxStamina: 80,
  staminaRegen: Number.NaN,
  currentMana: -4,
  maxMana: 120,
  manaRegen: -1,
});
assert.equal(clamped.currentStamina, 80);
assert.equal(clamped.currentMana, 0);
assert.equal(clamped.staminaRegen, 10);
assert.equal(clamped.manaRegen, 0);

const savedState = createNewGame(0x5a7e);
savedState.player.currentMana = 37.5;
savedState.player.maxMana = 120;
const reloaded = cloneGameWithoutTiles(
  JSON.parse(JSON.stringify(savedState)) as GameState,
);
assert.equal(reloaded.player.currentMana, 37.5);
assert.equal(reloaded.player.maxMana, 120);

const floorState = createNewGame(0xf1007);
floorState.player.currentStamina = 42.5;
floorState.player.currentMana = 37.5;
const descended = descendFloor(floorState);
assert.equal(descended.player.currentStamina, 42.5);
assert.equal(descended.player.currentMana, 37.5);

const legacyState = JSON.parse(JSON.stringify(createNewGame(0x01d5a7e))) as GameState;
const legacyPlayer = legacyState.player as GameState["player"] & Record<string, unknown>;
for (const key of [
  "currentStamina",
  "maxStamina",
  "staminaRegen",
  "currentMana",
  "maxMana",
  "manaRegen",
]) {
  delete legacyPlayer[key];
}
const normalizedLegacy = cloneGameWithoutTiles(legacyState);
assert.equal(normalizedLegacy.player.currentStamina, 100);
assert.equal(normalizedLegacy.player.currentMana, 100);

const cooldownState = createNewGame(0xc04ba7);
cooldownState.player.skills = ["shockLeap"];
cooldownState.player.learnedSkills = ["shockLeap"];
cooldownState.player.skillCooldowns = { shockLeap: 2 };
cooldownState.player.currentStamina = 100;
cooldownState.enemies = [];
const cooldownTarget = skillTarget(cooldownState, 6);
assert.ok(cooldownTarget);
const cooldownResult = activateCompanionSkill(
  cooldownState,
  cooldownState.player.companionId,
  "shockLeap",
  { x: cooldownTarget.x, y: cooldownTarget.y },
);
assert.equal(cooldownResult.consumedTurn, false);
assert.equal(cooldownResult.state.player.currentStamina, 100);
assert.equal(cooldownResult.state.player.skillCooldowns.shockLeap, 2);

const trainingCompanion = createCompanion("warrior", { x: 0, y: 0 }, 20);
trainingCompanion.learnedSkills = ["shockLeap", "weaponThrow"];
trainingCompanion.skills = ["shockLeap", "weaponThrow"];
const trainingCampaign: CampaignSave = {
  version: 6,
  warehouse: createInitialWarehouse(),
  companions: [trainingCompanion],
  expeditions: 0,
  completedExpeditions: 0,
  gold: 1_000,
  offerSeed: 123,
  shop: createShopState(123),
};
const learned = learnCompanionSkill(
  trainingCampaign,
  trainingCompanion.id,
  "shieldCharge",
);
assert.equal(learned.changed, true);
assert.equal(learned.campaign.gold, 500);
assert.deepEqual(learned.campaign.companions[0].skills, ["shockLeap", "weaponThrow"]);
assert.ok(learned.campaign.companions[0].learnedSkills.includes("shieldCharge"));
const duplicateLearn = learnCompanionSkill(
  learned.campaign,
  trainingCompanion.id,
  "shieldCharge",
);
assert.equal(duplicateLearn.changed, false);
assert.equal(duplicateLearn.campaign.gold, 500);
const poorCampaign = { ...trainingCampaign, gold: 100 };
const poorLearn = learnCompanionSkill(
  poorCampaign,
  trainingCompanion.id,
  "shieldCharge",
);
assert.equal(poorLearn.changed, false);
assert.equal(poorLearn.campaign.gold, 100);
assert.deepEqual(poorLearn.campaign.companions[0].learnedSkills, ["shockLeap", "weaponThrow"]);
const fullEquip = equipCompanionSkill(
  learned.campaign,
  trainingCompanion.id,
  "shieldCharge",
);
assert.equal(fullEquip.reason, "slot-required");
const replaced = equipCompanionSkill(
  learned.campaign,
  trainingCompanion.id,
  "shieldCharge",
  1,
);
assert.equal(replaced.changed, true);
assert.equal(replaced.campaign.gold, 500);
assert.deepEqual(replaced.campaign.companions[0].skills, ["shockLeap", "shieldCharge"]);
assert.ok(replaced.campaign.companions[0].learnedSkills.includes("weaponThrow"));
const swapped = swapCompanionSkills(
  replaced.campaign,
  trainingCompanion.id,
  0,
  1,
);
assert.deepEqual(swapped.campaign.companions[0].skills, ["shieldCharge", "shockLeap"]);

const legacyCompanion = JSON.parse(JSON.stringify(trainingCompanion)) as typeof trainingCompanion & Record<string, unknown>;
delete legacyCompanion.learnedSkills;
const normalizedLegacySkills = normalizeCompanionProgression(legacyCompanion);
assert.deepEqual(normalizedLegacySkills.learnedSkills, trainingCompanion.skills);
assert.deepEqual(normalizedLegacySkills.skills, trainingCompanion.skills);
const savedTraining = JSON.parse(JSON.stringify(swapped.campaign)) as CampaignSave;
const reloadedTraining = normalizeCompanionProgression(savedTraining.companions[0]);
assert.deepEqual(reloadedTraining.learnedSkills, swapped.campaign.companions[0].learnedSkills);
assert.deepEqual(reloadedTraining.skills, ["shieldCharge", "shockLeap"]);

const equippedOnlyState = createNewGame(0xc04ba7);
equippedOnlyState.player.professionId = "warrior";
equippedOnlyState.player.learnedSkills = ["shockLeap", "weaponThrow", "drivingLeap"];
equippedOnlyState.player.skills = ["weaponThrow", "drivingLeap"];
equippedOnlyState.enemies = [];
const equippedOnlyTarget = skillTarget(equippedOnlyState, 6);
assert.ok(equippedOnlyTarget);
const unequippedCast = activateCompanionSkill(
  equippedOnlyState,
  equippedOnlyState.player.companionId,
  "shockLeap",
  { x: equippedOnlyTarget.x, y: equippedOnlyTarget.y },
);
assert.equal(unequippedCast.consumedTurn, false);
assert.match(unequippedCast.state.logs.at(-1) ?? "", /보유하지 않은 스킬/);

const makeEnemy = (kind: Enemy["kind"], id: string, point: Point): Enemy => {
  const stats = ENEMY_STATS[kind];
  return {
    id,
    kind,
    ...point,
    hp: stats.hp,
    maxHp: stats.hp,
    attack: stats.attack,
    defense: stats.defense,
    accuracy: stats.accuracy,
    evasion: stats.evasion,
    xp: stats.xp,
    alerted: true,
    sawPlayerLastTurn: true,
    sleeping: false,
    wakeCooldown: 0,
    lastSeenPlayer: null,
    searchTurns: 0,
    statuses: [],
    skillCooldowns: {},
    skillUses: {},
    pendingSkill: null,
    faction: "hostile",
    drop: null,
  };
};
let enemyState = createDeveloperTestMap(createNewGame(0xe11e7e57));
enemyState.companions = [];
enemyState.player.x = 113;
enemyState.player.y = 80;
enemyState.enemies = [makeEnemy("training_leaper", "resource-free-leaper", { x: 110, y: 80 })];
enemyState = runEnemyTurn(enemyState).state;
enemyState = runEnemyTurn(enemyState).state;
enemyState = runEnemyTurn(enemyState).state;
assert.equal(enemyState.enemies[0].pendingSkill, null);
assert.equal("currentStamina" in enemyState.enemies[0], false);
assert.equal("currentMana" in enemyState.enemies[0], false);

console.log("companion skill regression passed (resources, training, loadout, save, enemy exemption)");
