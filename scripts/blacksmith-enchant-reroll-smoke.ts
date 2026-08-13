import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { CampaignSave } from "../app/game/campaign";
import {
  BLACKSMITH_UPGRADE_COST,
  createShopState,
  rerollCampaignEquipmentEnchantments,
  smithyEnchantRerollRunestoneCost,
  smithyUpgradeRequirements,
  upgradeCampaignEquipmentGrade,
  type SmithyTarget,
} from "../app/game/commerce";
import { ITEM_DEFS } from "../app/game/data";
import {
  availableEquipmentTraits,
  createPlainEquipmentInstance,
  enchantmentGradePower,
  rerollEquipmentEnchantments,
} from "../app/game/equipment";
import {
  createNewGame,
  developerGrantItem,
  useItem as consumeDungeonItem,
} from "../app/game/engine";
import { ITEM_GRADES } from "../app/game/item-grade";
import { WAREHOUSE_SLOT_COUNT } from "../app/game/inventory-slots";
import type {
  EquipmentTrait,
  InventoryInstance,
  ItemGrade,
} from "../app/game/types";

const uiSource = readFileSync("app/components/DungeonGame.tsx", "utf8");
const cssSource = readFileSync("app/globals.css", "utf8");
const catalogSource = readFileSync("app/game/item-catalog.ts", "utf8");
const engineSource = readFileSync("app/game/engine.ts", "utf8");

const makeCampaign = (
  instance: InventoryInstance,
  options: {
    runestones?: number;
    lockScrolls?: number;
    gold?: number;
    offerSeed?: number;
  } = {},
): CampaignSave => {
  const stacks: Record<string, number> = {};
  if ((options.lockScrolls ?? 0) > 0) {
    stacks.scroll_mirror_image = options.lockScrolls!;
  }
  return {
    version: 8,
    warehouse: {
      stacks,
      instances: [instance],
      throwableProfiles: {},
      slots: [
        instance.id,
        ...Array.from({ length: WAREHOUSE_SLOT_COUNT - 1 }, () => null),
      ],
    },
    companions: [],
    materials: { potion: 0, seed: 0, runestone: options.runestones ?? 20 },
    expeditions: 0,
    completedExpeditions: 0,
    bossDungeonClears: 0,
    gold: options.gold ?? 0,
    offerSeed: options.offerSeed ?? 0x51a7e,
    shop: createShopState(options.offerSeed ?? 0x51a7e),
  };
};

const targetFor = (instance: InventoryInstance): SmithyTarget => ({
  kind: "warehouse",
  instanceId: instance.id,
});

assert.deepEqual(
  ITEM_GRADES.map((grade) => smithyEnchantRerollRunestoneCost(grade)),
  [1, 2, 3, 4, 5, 6, 7],
  "reroll runestone cost must be grade index + 1 from F through S",
);

const swordDefinition = ITEM_DEFS.shortsword;
const threeLineSword = createPlainEquipmentInstance(
  swordDefinition,
  "three-line-reroll",
  "C",
);
threeLineSword.traits = [
  { id: "keen", grade: "C" },
  { id: "lethal", grade: "E" },
  { id: "piercing", grade: "B" },
];
const beforeThreeLine = threeLineSword.traits.map((trait) => ({ ...trait }));
const threeLineResult = rerollEquipmentEnchantments(
  threeLineSword,
  swordDefinition,
  [],
  () => 0,
);
assert.equal(threeLineResult.changed, true);
assert.equal(threeLineSword.traits.length, 3);
assert.deepEqual(
  threeLineSword.traits.map((trait) => trait.grade),
  beforeThreeLine.map((trait) => trait.grade),
  "reroll must preserve every enchantment grade and line count",
);
threeLineSword.traits.forEach((trait, index) => {
  assert.notEqual(
    trait.id,
    beforeThreeLine[index].id,
    "every unlocked line must change when another candidate exists",
  );
});

const lockedSword = createPlainEquipmentInstance(swordDefinition, "locked-lines", "B");
lockedSword.traits = [
  { id: "keen", grade: "B" },
  { id: "lethal", grade: "C" },
  { id: "piercing", grade: "F" },
];
const lockedBefore = lockedSword.traits.map((trait) => ({ ...trait }));
rerollEquipmentEnchantments(lockedSword, swordDefinition, [0, 2], () => 0);
assert.deepEqual(lockedSword.traits[0], lockedBefore[0]);
assert.notDeepEqual(lockedSword.traits[1], lockedBefore[1]);
assert.deepEqual(lockedSword.traits[2], lockedBefore[2]);

assert.equal(
  availableEquipmentTraits(swordDefinition, "C").includes("vampiric"),
  false,
  "vampiric must not be available below B",
);
assert.equal(
  availableEquipmentTraits(swordDefinition, "B").includes("vampiric"),
  true,
  "vampiric must remain available from B",
);

const transactionSword = createPlainEquipmentInstance(
  swordDefinition,
  "transaction-sword",
  "A",
);
transactionSword.traits = [
  { id: "keen", grade: "A" },
  { id: "lethal", grade: "D" },
  { id: "piercing", grade: "B" },
];
const transactionCampaign = makeCampaign(transactionSword, {
  runestones: 20,
  lockScrolls: 2,
  offerSeed: 91234,
});
const transactionTarget = targetFor(transactionSword);
const deterministicA = rerollCampaignEquipmentEnchantments(
  transactionCampaign,
  transactionTarget,
  [0, 2],
);
const deterministicB = rerollCampaignEquipmentEnchantments(
  transactionCampaign,
  transactionTarget,
  [0, 2],
);
assert.equal(deterministicA.changed, true);
assert.equal(deterministicA.runestoneCost, 6);
assert.deepEqual(deterministicA.after, deterministicB.after);
assert.equal(deterministicA.campaign.materials.runestone, 14);
assert.equal(
  deterministicA.campaign.warehouse.stacks.scroll_mirror_image ?? 0,
  0,
);
assert.deepEqual(deterministicA.after[0], transactionSword.traits[0]);
assert.notDeepEqual(deterministicA.after[1], transactionSword.traits[1]);
assert.deepEqual(deterministicA.after[2], transactionSword.traits[2]);
assert.equal(transactionCampaign.materials.runestone, 20);
assert.equal(transactionCampaign.warehouse.stacks.scroll_mirror_image, 2);

const zeroLockResult = rerollCampaignEquipmentEnchantments(
  transactionCampaign,
  transactionTarget,
  [],
);
assert.equal(zeroLockResult.changed, true);
assert.equal(
  zeroLockResult.campaign.warehouse.stacks.scroll_mirror_image,
  2,
  "a zero-lock reroll must not consume a lock scroll",
);

const oneLockResult = rerollCampaignEquipmentEnchantments(
  transactionCampaign,
  transactionTarget,
  [1],
);
assert.equal(oneLockResult.changed, true);
assert.equal(oneLockResult.campaign.warehouse.stacks.scroll_mirror_image, 1);

const allLocked = rerollCampaignEquipmentEnchantments(
  transactionCampaign,
  transactionTarget,
  [0, 1, 2],
);
assert.equal(allLocked.changed, false);
assert.equal(allLocked.reason, "nothing-to-reroll");
assert.equal(allLocked.campaign, transactionCampaign);

const runestoneShortage = rerollCampaignEquipmentEnchantments(
  makeCampaign(transactionSword, { runestones: 5, lockScrolls: 2 }),
  transactionTarget,
  [0],
);
assert.equal(runestoneShortage.reason, "not-enough-runestones");
assert.equal(runestoneShortage.changed, false);
assert.equal(runestoneShortage.campaign.materials.runestone, 5);
assert.equal(runestoneShortage.campaign.warehouse.stacks.scroll_mirror_image, 2);

const lockShortageCampaign = makeCampaign(transactionSword, {
  runestones: 20,
  lockScrolls: 1,
});
const lockShortage = rerollCampaignEquipmentEnchantments(
  lockShortageCampaign,
  transactionTarget,
  [0, 1],
);
assert.equal(lockShortage.reason, "not-enough-lock-scrolls");
assert.equal(lockShortage.campaign, lockShortageCampaign);

const sSword = createPlainEquipmentInstance(swordDefinition, "s-reroll", "S");
const sCampaign = makeCampaign(sSword, { runestones: 7 });
const sResult = rerollCampaignEquipmentEnchantments(
  sCampaign,
  targetFor(sSword),
  [],
);
assert.equal(sResult.changed, true, "S-grade equipment must be rerollable");
assert.equal(sResult.runestoneCost, 7);
assert.equal(sResult.after[0].grade, "S");

const wandDefinition = ITEM_DEFS.wand_magic_missile;
const chargedWand = createPlainEquipmentInstance(
  wandDefinition,
  "charged-to-other",
  "B",
);
chargedWand.traits = [{ id: "charged", grade: "B" }];
chargedWand.maxCharges = 3 + enchantmentGradePower("B");
chargedWand.charges = chargedWand.maxCharges;
rerollEquipmentEnchantments(chargedWand, wandDefinition, [], () => 0);
assert.notEqual(chargedWand.traits[0].id, "charged");
assert.equal(chargedWand.maxCharges, 3);
assert.equal(chargedWand.charges, 3);

const focusedWand = createPlainEquipmentInstance(
  wandDefinition,
  "other-to-charged",
  "B",
);
focusedWand.traits = [{ id: "focused", grade: "B" }];
focusedWand.maxCharges = 3;
focusedWand.charges = 3;
rerollEquipmentEnchantments(focusedWand, wandDefinition, [], () => 0);
assert.equal(focusedWand.traits[0].id, "charged");
assert.equal(focusedWand.maxCharges, 3 + enchantmentGradePower("B"));
assert.equal(focusedWand.charges, focusedWand.maxCharges);
rerollEquipmentEnchantments(focusedWand, wandDefinition, [0], () => 0);
assert.equal(focusedWand.maxCharges, 3 + enchantmentGradePower("B"));
for (let index = 0; index < 8; index += 1) {
  rerollEquipmentEnchantments(focusedWand, wandDefinition, [], () => 0);
  const contribution: number = focusedWand.traits.reduce<number>(
    (total, trait) => total + (
      trait.id === "charged" ? enchantmentGradePower(trait.grade) : 0
    ),
    0,
  );
  assert.equal(
    focusedWand.maxCharges,
    3 + contribution,
    "repeated charged rerolls must not drift max charges",
  );
  assert.ok((focusedWand.charges ?? 0) <= (focusedWand.maxCharges ?? 0));
}

const mirrorDefinition = ITEM_DEFS.scroll_mirror_image;
assert.equal(mirrorDefinition.name, "인챈트 고정 주문서");
assert.equal(mirrorDefinition.effect, "enchantLock");
assert.equal(
  mirrorDefinition.description,
  "대장간에서 인챈트를 변경할 때 원하는 인챈트를 고정합니다. 고정하는 인챈트 한 줄당 주문서 1개가 필요합니다.",
);
let dungeon = createNewGame(0x10cc);
dungeon = developerGrantItem(dungeon, "scroll_mirror_image", 1);
const mirrorQuantity = dungeon.player.inventory.scroll_mirror_image;
const shieldBefore = dungeon.player.shield ?? 0;
const directUse = consumeDungeonItem(dungeon, "scroll_mirror_image");
assert.equal(directUse.consumedTurn, false);
assert.deepEqual(directUse.effects, []);
assert.equal(directUse.state.player.inventory.scroll_mirror_image, mirrorQuantity);
assert.equal(directUse.state.player.shield ?? 0, shieldBefore);
assert.match(engineSource, /definition\.effect === "enchantLock"[\s\S]*consumedTurn: false/);
assert.doesNotMatch(engineSource, /scroll_mirror_image"\s*\|\|/);

const gradeSword = createPlainEquipmentInstance(swordDefinition, "grade-regression", "F");
const gradeCampaign = makeCampaign(gradeSword, { runestones: 3, gold: 1_600 });
const gradeRequirements = smithyUpgradeRequirements(gradeCampaign, "F");
assert.deepEqual(
  gradeRequirements.map(({ resourceId, required }) => [resourceId, required]),
  [["gold", BLACKSMITH_UPGRADE_COST.F], ["runestone", 3]],
);
const gradeUpgrade = upgradeCampaignEquipmentGrade(
  gradeCampaign,
  targetFor(gradeSword),
);
assert.equal(gradeUpgrade.changed, true);
assert.equal(gradeUpgrade.toGrade, "E");
assert.equal(gradeUpgrade.campaign.gold, 0);
assert.equal(gradeUpgrade.campaign.materials.runestone, 0);

assert.match(
  uiSource,
  /type BlacksmithTab = "grade" \| "enchant"[\s\S]*등급 승급[\s\S]*인챈트 변경/,
);
assert.match(
  uiSource,
  /const candidates = listSmithyCandidates\(campaign\)[\s\S]*activeTab === "enchant"[\s\S]*candidate\.instance\.traits/,
  "both tabs must share the existing smithy candidate source",
);
assert.match(
  uiSource,
  /selectionRevision[\s\S]*setLockSelection[\s\S]*switchTab[\s\S]*indexes: new Set/,
  "locks must reset on item or tab changes",
);
assert.match(
  uiSource,
  /lockScrolls = campaign\.warehouse\.stacks\.scroll_mirror_image[\s\S]*enchantments\.length > lockedIndexes\.size/,
);
assert.match(
  uiSource,
  /rerollCampaignEquipmentEnchantments\([\s\S]*setCampaign\(result\.campaign\)/,
);
assert.match(uiSource, /itemId === "scroll_mirror_image"[\s\S]*Enchantment Lock Scroll/);
assert.match(uiSource, /const isDirectlyUsableItem[\s\S]*effect !== "enchantLock"/);
assert.match(uiSource, /flashUpgradeKey[\s\S]*is-upgrade-flashing/);
assert.match(cssSource, /\.blacksmith-tabs[\s\S]*\.blacksmith-enchantment-panel/);
assert.match(catalogSource, /scroll_mirror_image[\s\S]*effect: "enchantLock"/);

const preservedGrades = (traits: readonly EquipmentTrait[]) =>
  traits.map((trait) => trait.grade as ItemGrade);
assert.deepEqual(preservedGrades(deterministicA.before), preservedGrades(deterministicA.after));

console.log("blacksmith enchantment reroll smoke checks passed");
