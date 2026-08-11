import assert from "node:assert/strict";
import {
  CRITICAL_DAMAGE_TEXT_DURATION_MS,
  CRITICAL_DAMAGE_TEXT_FILL,
  CRITICAL_DAMAGE_TEXT_STROKE,
  NORMAL_DAMAGE_TEXT_DURATION_MS,
  combatEffectMotionAt,
} from "../app/presentation/effects";
import {
  DEFAULT_ARMOR_PENETRATION,
  DEFAULT_COOLDOWN_REDUCTION,
  DEFAULT_CRITICAL_CHANCE,
  DEFAULT_CRITICAL_DAMAGE_BONUS,
  DEFAULT_LIFE_STEAL,
  DEFAULT_STATUS_RESISTANCE,
  applyLifeSteal,
  effectiveCombatStats,
  effectiveCooldown,
  effectiveDefense,
  formatCombatPercent,
  normalizeCombatStats,
  remainingCooldownTurns,
  resolveCriticalDamage,
} from "../app/game/combat-stats";
import {
  availableEquipmentTraits,
  combatStatEnchantmentBonus,
  createEquipmentInstance,
  enchantEquipmentInstance,
  enchantmentGradeChances,
  enchantmentGradePower,
  equipmentStatProfile,
  equipmentTraitSummary,
  normalizeEquipmentInstance,
} from "../app/game/equipment";
import { ITEM_DEFS } from "../app/game/data";
import { ITEM_GRADES } from "../app/game/item-grade";
import { tryApplyStatus } from "../app/game/status-effects";
import { createDeveloperTestMap } from "../app/game/developer-test-map";
import {
  activateCompanionSkill,
  advanceCompanionSkillCooldowns,
  createNewGame,
  developerGrantItem,
  manualCompanionStep,
  playerStep,
  runEnemyTurn,
  throwItem,
  zapWand,
} from "../app/game/engine";
import {
  COMPANION_SKILLS,
  normalizeSkillCooldowns,
} from "../app/game/companion-skills";
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
  InventoryInstance,
  ItemGrade,
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
  armorPenetration: DEFAULT_ARMOR_PENETRATION,
  cooldownReduction: DEFAULT_COOLDOWN_REDUCTION,
  statusResistance: DEFAULT_STATUS_RESISTANCE,
});

const defaultGame = createNewGame(0xc8170001);
assert.equal(defaultGame.player.criticalChance, 0.01);
assert.equal(defaultGame.companions[0].criticalChance, 0.01);
assert.equal(defaultGame.enemies[0].criticalChance, 0.01);
assert.equal(defaultGame.player.criticalDamageBonus, 0.5);
assert.equal(defaultGame.player.lifeSteal, 0);
assert.equal(defaultGame.player.armorPenetration, 0);
assert.equal(defaultGame.companions[0].cooldownReduction, 0);
assert.equal(defaultGame.enemies[0].statusResistance, 0);

const equipmentInstance = (
  id: string,
  defId: string,
  grade: ItemGrade,
  traits: InventoryInstance["traits"],
): InventoryInstance => ({
  id,
  defId,
  grade,
  upgradeLevel: 0,
  statRoll: { attack: 0, defense: 0, magic: 0, speed: 0 },
  traits,
});

const lethalValues: Record<ItemGrade, number> = {
  F: 0.02,
  E: 0.04,
  D: 0.06,
  C: 0.09,
  B: 0.12,
  A: 0.18,
  S: 0.25,
};
for (const grade of ITEM_GRADES) {
  assert.equal(combatStatEnchantmentBonus("lethal", grade), lethalValues[grade]);
}
assert.equal(combatStatEnchantmentBonus("vampiric", "F"), 0);
assert.equal(combatStatEnchantmentBonus("vampiric", "E"), 0);
assert.equal(combatStatEnchantmentBonus("vampiric", "D"), 0);
assert.equal(combatStatEnchantmentBonus("vampiric", "C"), 0);
assert.equal(combatStatEnchantmentBonus("vampiric", "B"), 0.08);
assert.equal(combatStatEnchantmentBonus("vampiric", "A"), 0.16);
assert.equal(combatStatEnchantmentBonus("vampiric", "S"), 0.32);
assert.equal(combatStatEnchantmentBonus("quickened", "F"), 0.005);
assert.equal(formatCombatPercent(0.005), "0.5%");
assert.equal(formatCombatPercent(0.125), "12.5%");

const weaponDefinition = ITEM_DEFS.shortsword;
assert.equal(availableEquipmentTraits(weaponDefinition, "C").includes("vampiric"), false);
assert.equal(availableEquipmentTraits(weaponDefinition, "B").includes("vampiric"), true);
const lowPreferredVampiric = createEquipmentInstance(
  weaponDefinition,
  "low-preferred-vampiric",
  () => 0,
  { grade: "C", allowCurse: false, preferredFirstTrait: "vampiric" },
);
assert.notEqual(lowPreferredVampiric.traits?.[0]?.id, "vampiric");
assert.equal(lowPreferredVampiric.traits?.[0]?.grade, "C");
const validPreferredVampiric = createEquipmentInstance(
  weaponDefinition,
  "valid-preferred-vampiric",
  () => 0,
  { grade: "B", allowCurse: false, preferredFirstTrait: "vampiric" },
);
assert.deepEqual(validPreferredVampiric.traits?.[0], { id: "vampiric", grade: "B" });

const invalidLoadedVampiric = normalizeEquipmentInstance(
  equipmentInstance(
    "invalid-loaded-vampiric",
    weaponDefinition.id,
    "C",
    [{ id: "vampiric", grade: "C" }],
  ),
  weaponDefinition,
);
assert.equal(
  invalidLoadedVampiric.traits?.some((trait) => trait.id === "vampiric"),
  false,
);

const rollInsideGrade = (itemGrade: ItemGrade, target: ItemGrade) => {
  const chances = enchantmentGradeChances(itemGrade);
  const targetIndex = ITEM_GRADES.indexOf(target);
  return ITEM_GRADES.slice(0, targetIndex).reduce(
    (total, grade) => total + chances[grade],
    0,
  ) + chances[target] / 2;
};
const cFollowup = equipmentInstance(
  "c-followup",
  weaponDefinition.id,
  "C",
  [{ id: "keen", grade: "C" }],
);
let cFollowupRolls = 0;
const cFollowupValues = [rollInsideGrade("C", "C"), 0];
enchantEquipmentInstance(
  cFollowup,
  weaponDefinition,
  () => cFollowupValues[Math.min(cFollowupRolls++, cFollowupValues.length - 1)],
  "vampiric",
);
assert.equal(cFollowup.traits?.[1]?.grade, "C");
assert.notEqual(cFollowup.traits?.[1]?.id, "vampiric");
assert.equal(cFollowupRolls, 2);
const bFollowup = equipmentInstance(
  "b-followup",
  weaponDefinition.id,
  "C",
  [{ id: "keen", grade: "C" }],
);
let bFollowupRolls = 0;
enchantEquipmentInstance(
  bFollowup,
  weaponDefinition,
  () => {
    bFollowupRolls += 1;
    return rollInsideGrade("C", "B");
  },
  "vampiric",
);
assert.deepEqual(bFollowup.traits?.[1], { id: "vampiric", grade: "B" });
assert.equal(bFollowupRolls, 1, "valid preferred vampiric must not reroll its grade");
assert.equal(enchantmentGradeChances("F").S, 0.002);
assert.equal(enchantmentGradeChances("S").S, 0.1);
assert.equal(enchantmentGradePower("F"), 1);
assert.equal(enchantmentGradePower("S"), 64);

const wandDefinition = Object.values(ITEM_DEFS).find(
  (definition) => definition.category === "wand",
);
if (!wandDefinition) throw new Error("Expected a wand definition");
const chargedWand = createEquipmentInstance(
  wandDefinition,
  "charged-wand-regression",
  () => 0,
  { grade: "D", allowCurse: false, preferredFirstTrait: "charged" },
);
assert.equal(chargedWand.maxCharges, 3 + enchantmentGradePower("D"));
assert.equal(
  equipmentTraitSummary(chargedWand)[0].description,
  `지팡이 최대 충전 +${enchantmentGradePower("D")}`,
);
const lethalSummary = equipmentTraitSummary(
  equipmentInstance("c-lethal-summary", weaponDefinition.id, "C", [
    { id: "lethal", grade: "C" },
  ]),
)[0];
assert.equal(lethalSummary.description, "치명타 확률 +9%");
const quickenedSummary = equipmentTraitSummary(
  equipmentInstance("f-quickened-summary", weaponDefinition.id, "F", [
    { id: "quickened", grade: "F" },
  ]),
)[0];
assert.equal(quickenedSummary.description, "재사용 대기시간 감소 +0.5%");
assert.equal(
  equipmentStatProfile(weaponDefinition, lowPreferredVampiric).criticalChance,
  0,
);

const equipmentCombatGame = createNewGame(0xc8170e01);
equipmentCombatGame.player.equipmentInstances = {
  weapon: equipmentInstance("c-lethal", weaponDefinition.id, "C", [
    { id: "lethal", grade: "C" },
    { id: "devastating", grade: "A" },
    { id: "piercing", grade: "A" },
    { id: "quickened", grade: "F" },
  ]),
  armor: equipmentInstance("d-lethal", weaponDefinition.id, "D", [
    { id: "lethal", grade: "D" },
    { id: "vampiric", grade: "B" },
    { id: "resistant", grade: "S" },
  ]),
  ring: equipmentInstance("a-vampiric", weaponDefinition.id, "A", [
    { id: "vampiric", grade: "A" },
    { id: "resistant", grade: "S" },
  ]),
  ring2: null,
  ring3: null,
  ring4: null,
};
const baseCriticalChance = equipmentCombatGame.player.criticalChance;
const equipmentTotals = effectiveCombatStats(equipmentCombatGame.player);
assert.equal(equipmentTotals.criticalChance, 0.16);
assert.equal(equipmentTotals.criticalDamageBonus, 0.82);
assert.equal(equipmentTotals.lifeSteal, 0.24);
assert.equal(equipmentTotals.armorPenetration, 0.32);
assert.equal(equipmentTotals.cooldownReduction, 0.005);
assert.equal(equipmentTotals.statusResistance, 1);
assert.equal(equipmentCombatGame.player.criticalChance, baseCriticalChance);
assert.deepEqual(
  resolveCriticalDamage(10, equipmentCombatGame.player, 0.05),
  { damage: 18, critical: true },
);
assert.ok(
  Math.abs(effectiveDefense(10, equipmentCombatGame.player) - 6.8) < 1e-9,
);
assert.ok(
  Math.abs(effectiveCooldown(10, equipmentCombatGame.player) - 9.95) < 1e-9,
);
equipmentCombatGame.player.hp = 1;
equipmentCombatGame.player.maxHp = 100;
assert.equal(applyLifeSteal(equipmentCombatGame.player, 100), 24);
const equipmentResistanceRng = equipmentCombatGame.rng;
assert.deepEqual(
  tryApplyStatus(
    equipmentCombatGame,
    equipmentCombatGame.player,
    "poisoned",
    3,
  ),
  { applied: false, resisted: true },
);
assert.equal(equipmentCombatGame.rng, equipmentResistanceRng);
equipmentCombatGame.player.equipmentInstances.weapon = null;
equipmentCombatGame.player.equipmentInstances.armor = null;
equipmentCombatGame.player.equipmentInstances.ring = null;
assert.deepEqual(
  effectiveCombatStats(equipmentCombatGame.player),
  normalizeCombatStats(equipmentCombatGame.player),
  "unequipping must immediately restore the unchanged base combat stats",
);

const companionEquipmentStats = createCompanion("mage", { x: 0, y: 0 });
companionEquipmentStats.equipmentInstances.weapon = equipmentInstance(
  "companion-c-lethal",
  weaponDefinition.id,
  "C",
  [{ id: "lethal", grade: "C" }],
);
assert.equal(effectiveCombatStats(companionEquipmentStats).criticalChance, 0.1);

assert.equal(effectiveDefense(10, { armorPenetration: 0 }), 10);
assert.equal(effectiveDefense(10, { armorPenetration: 0.5 }), 5);
assert.equal(effectiveDefense(10, { armorPenetration: 1 }), 0);
assert.equal(effectiveDefense(10, { armorPenetration: 2 }), 0);
assert.equal(effectiveCooldown(5, { cooldownReduction: 0 }), 5);
assert.equal(effectiveCooldown(5, { cooldownReduction: 0.2 }), 4);
assert.equal(effectiveCooldown(6, { cooldownReduction: 0.25 }), 4.5);
assert.equal(remainingCooldownTurns(4.5), 5);
assert.deepEqual(normalizeSkillCooldowns({ fireball: 4.5 }), { fireball: 4.5 });

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
  delete (actor as Partial<typeof actor>).armorPenetration;
  delete (actor as Partial<typeof actor>).cooldownReduction;
  delete (actor as Partial<typeof actor>).statusResistance;
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
convertedCompanion.armorPenetration = 0.3;
convertedCompanion.cooldownReduction = 0.25;
convertedCompanion.statusResistance = 0.4;
const convertedPlayer = companionToPlayer(convertedCompanion);
const roundTripCompanion = playerToCompanion(convertedPlayer);
assert.deepEqual(
  normalizeCombatStats(roundTripCompanion),
  normalizeCombatStats(convertedCompanion),
);

const penetrationBase = arena(0xc8170003);
penetrationBase.player.accuracy = 1_000_000;
penetrationBase.player.baseAttack = 30;
penetrationBase.player.criticalChance = 0;
penetrationBase.enemies = [makeEnemy("rat", "armor-target", { x: 30, y: 80 }, {
  hp: 100,
  maxHp: 100,
  defense: 10,
  evasion: 0,
})];
const noPenetration = cloneGame(penetrationBase);
const halfPenetration = cloneGame(penetrationBase);
halfPenetration.player.armorPenetration = 0.5;
const noPenetrationResult = playerStep(noPenetration, 1, 0);
const halfPenetrationResult = playerStep(halfPenetration, 1, 0);
const noPenetrationDamage = 100 - noPenetrationResult.state.enemies[0].hp;
const halfPenetrationDamage = 100 - halfPenetrationResult.state.enemies[0].hp;
assert.equal(halfPenetrationDamage - noPenetrationDamage, 5);

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
  armorPenetration: 1,
});
shieldState.enemies = [shieldEnemy];
const shieldResult = runEnemyTurn(shieldState);
assert.equal(shieldResult.state.player.hp, shieldState.player.hp);
assert.equal(shieldResult.state.enemies[0].hp, shieldEnemy.hp);
assert.equal(
  shieldResult.effects.some((effect) => effect.kind === "healing"),
  false,
);

const slimeMitigationState = arena(0xc8170018);
const slimeTarget = makeEnemy("slime", "slime-mitigation", { x: 30, y: 80 }, {
  hp: 100,
  maxHp: 100,
});
slimeMitigationState.enemies = [slimeTarget];
const slimeDamage = applyEnemyIncomingDamage(
  slimeMitigationState,
  slimeTarget,
  20,
);
assert.ok(slimeDamage > 0 && slimeDamage < 20);

const skillState = arena(0xc8170014);
skillState.player.classId = "mage";
skillState.player.professionId = "mage";
skillState.player.skills = ["fireball"];
skillState.player.learnedSkills = ["fireball"];
skillState.player.skillLevels = { fireball: 1 };
skillState.player.criticalChance = 1;
skillState.player.cooldownReduction = 0.25;
skillState.player.currentMana = 100;
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
assert.equal(
  skillResult.state.player.skillCooldowns.fireball,
  effectiveCooldown(COMPANION_SKILLS.fireball.cooldown, skillState.player) + 1,
);
assert.equal(
  skillResult.state.player.currentMana,
  100 - COMPANION_SKILLS.fireball.resourceCost,
);
const playerCooldownTick = cloneGame(skillResult.state);
advanceCompanionSkillCooldowns(playerCooldownTick);
assert.equal(
  playerCooldownTick.player.skillCooldowns.fireball,
  effectiveCooldown(COMPANION_SKILLS.fireball.cooldown, skillState.player),
);

const fractionalSaveState = cloneGame(skillResult.state);
fractionalSaveState.player.skillCooldowns.fireball = 4.5;
assert.equal(cloneGame(fractionalSaveState).player.skillCooldowns.fireball, 4.5);
advanceCompanionSkillCooldowns(fractionalSaveState);
assert.equal(fractionalSaveState.player.skillCooldowns.fireball, 3.5);

const companionSkillState = arena(0xc8170019);
const skillCompanion = createCompanion("mage", { x: 29, y: 80 });
skillCompanion.skills = ["fireball"];
skillCompanion.learnedSkills = ["fireball"];
skillCompanion.skillLevels = { fireball: 1 };
skillCompanion.cooldownReduction = 0.25;
skillCompanion.currentMana = 100;
companionSkillState.player.x = 24;
companionSkillState.companions = [skillCompanion];
companionSkillState.enemies = [makeEnemy("rat", "companion-skill-target", { x: 32, y: 80 }, {
  hp: 100,
  maxHp: 100,
  defense: 0,
})];
const companionSkillResult = activateCompanionSkill(
  companionSkillState,
  skillCompanion.id,
  "fireball",
  { x: 32, y: 80 },
);
assert.equal(
  companionSkillResult.state.companions[0].skillCooldowns.fireball,
  effectiveCooldown(COMPANION_SKILLS.fireball.cooldown, skillCompanion) + 1,
);
assert.equal(
  companionSkillResult.state.companions[0].currentMana,
  100 - COMPANION_SKILLS.fireball.resourceCost,
);
const companionCooldownTick = cloneGame(companionSkillResult.state);
advanceCompanionSkillCooldowns(companionCooldownTick);
assert.equal(
  companionCooldownTick.companions[0].skillCooldowns.fireball,
  effectiveCooldown(COMPANION_SKILLS.fireball.cooldown, skillCompanion),
);

const enemySkillState = arena(0xc8170015);
enemySkillState.player.evasion = 0;
enemySkillState.enemies = [makeEnemy("shaman_red", "skill-attacker", { x: 26, y: 80 }, {
  accuracy: 1_000_000,
  criticalChance: 1,
  cooldownReduction: 0.5,
})];
const enemySkillResult = runEnemyTurn(enemySkillState);
assert.equal(
  enemySkillResult.effects.find(
    (effect) => effect.kind === "damage" && effect.sourceId === "skill-attacker",
  )?.critical,
  true,
);
assert.equal(
  enemySkillResult.state.enemies[0].skillCooldowns?.shamanBolt,
  0.5,
);

const windupState = arena(0xc817001a);
windupState.enemies = [makeEnemy("spinner", "windup-attacker", { x: 26, y: 80 }, {
  cooldownReduction: 0.5,
})];
const windupStarted = runEnemyTurn(windupState);
assert.equal(windupStarted.state.enemies[0].pendingSkill?.remainingWindupTurns, 1);
const windupResolved = runEnemyTurn(windupStarted.state);
assert.equal(windupResolved.state.enemies[0].pendingSkill, null);
assert.equal(windupResolved.state.enemies[0].skillCooldowns?.poisonWeb, 4);

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

const zeroResistanceState = arena(0xc8170021);
zeroResistanceState.player.statusResistance = 0;
const zeroResistanceRng = zeroResistanceState.rng;
assert.deepEqual(
  tryApplyStatus(zeroResistanceState, zeroResistanceState.player, "poisoned", 3, 2),
  { applied: true, resisted: false },
);
assert.equal(zeroResistanceState.rng, zeroResistanceRng);
assert.ok(zeroResistanceState.player.statuses.some((status) => status.id === "poisoned"));

const fullResistanceState = arena(0xc8170022);
fullResistanceState.player.statusResistance = 1;
const fullResistanceRng = fullResistanceState.rng;
assert.deepEqual(
  tryApplyStatus(fullResistanceState, fullResistanceState.player, "poisoned", 3, 2),
  { applied: false, resisted: true },
);
assert.equal(fullResistanceState.rng, fullResistanceRng);
assert.equal(fullResistanceState.player.statuses.length, 0);
assert.deepEqual(
  tryApplyStatus(fullResistanceState, fullResistanceState.player, "haste", 3, 1),
  { applied: true, resisted: false },
);
assert.ok(fullResistanceState.player.statuses.some((status) => status.id === "haste"));

const resistanceSeedBase = arena(0xc8170023);
resistanceSeedBase.player.statusResistance = 0.5;
const resistanceSeedA = cloneGame(resistanceSeedBase);
const resistanceSeedB = cloneGame(resistanceSeedBase);
const resistanceResultA = tryApplyStatus(
  resistanceSeedA,
  resistanceSeedA.player,
  "rooted",
  3,
);
const resistanceResultB = tryApplyStatus(
  resistanceSeedB,
  resistanceSeedB.player,
  "rooted",
  3,
);
assert.deepEqual(resistanceResultA, resistanceResultB);
assert.equal(resistanceSeedA.rng, resistanceSeedB.rng);
assert.deepEqual(resistanceSeedA.player.statuses, resistanceSeedB.player.statuses);

const resistedEnemySkillState = arena(0xc8170024);
resistedEnemySkillState.player.evasion = 0;
resistedEnemySkillState.player.statusResistance = 1;
resistedEnemySkillState.enemies = [makeEnemy(
  "shaman_red",
  "resistance-attacker",
  { x: 26, y: 80 },
  { accuracy: 1_000_000 },
)];
const resistedEnemySkill = runEnemyTurn(resistedEnemySkillState);
assert.equal(
  resistedEnemySkill.state.player.statuses.some(
    (status) => status.id === "weakened",
  ),
  false,
);
assert.ok(resistedEnemySkill.signals?.some((signal) => signal.text === "저항!"));

const statusState = arena(0xc8170025);
statusState.player.statusResistance = 1;
statusState.player.statuses = [{ id: "poisoned", turns: 3, power: 2 }];
const poisonedHpBefore = statusState.player.hp;
const statusResult = runEnemyTurn(statusState);
assert.ok(statusResult.state.player.hp < poisonedHpBefore);
assert.ok(statusResult.state.player.statuses.some((status) => status.id === "poisoned"));
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
  "combat stat smoke passed (six-stat defaults, saves, penetration, cooldowns, resistance, direct damage, visuals)",
);
