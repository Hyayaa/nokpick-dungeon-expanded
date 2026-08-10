import assert from "node:assert/strict";
import {
  createInitialWarehouse,
  createStarterCompanionRoster,
  depositPlayerInventory,
  takeLoadoutFromWarehouse,
  type CampaignSave,
} from "../app/game/campaign";
import {
  addMaterials,
  createCampaignMaterials,
  extractWarehouseMaterials,
  normalizeCampaignMaterials,
} from "../app/game/campaign-materials";
import { COMPANION_CLASS_IDS } from "../app/game/companions";
import { COMPANION_SKILLS } from "../app/game/companion-skills";
import {
  createShopState,
  listSmithyCandidates,
  smithyUpgradeRequirements,
  upgradeCampaignEquipmentGrade,
} from "../app/game/commerce";
import { ITEM_DEFS } from "../app/game/data";
import { createPlainEquipmentInstance } from "../app/game/equipment";
import { learnCompanionSkill } from "../app/game/skill-training";
import type { Player } from "../app/game/types";

const createCampaign = (): CampaignSave => ({
  version: 8,
  warehouse: createInitialWarehouse(),
  materials: createCampaignMaterials(),
  companions: createStarterCompanionRoster(COMPANION_CLASS_IDS.slice(0, 2)),
  expeditions: 0,
  completedExpeditions: 0,
  bossDungeonClears: 0,
  gold: 2_000,
  offerSeed: 1,
  shop: createShopState(1),
});

const returningPlayer = {
  inventory: {
    potion_healing: 2,
    potion_frost: 1,
    seed_sungrass: 2,
    seed_icecap: 3,
    stone_intuition: 2,
    ration: 2,
    scroll_mapping: 1,
  },
  inventoryInstances: [],
  autoSlots: [null, null, null, null],
  throwableProfiles: {},
} as unknown as Player;
const returned = depositPlayerInventory(
  createInitialWarehouse(),
  returningPlayer,
  createCampaignMaterials(),
);
assert.deepEqual(returned.materialsGained, {
  potion: 3,
  seed: 5,
  runestone: 2,
});
assert.equal(returned.recoveredItems, 13);
assert.equal(returned.warehouse.stacks.ration, 6);
assert.equal(returned.warehouse.stacks.scroll_mapping, 2);
for (const itemId of Object.keys(returned.warehouse.stacks)) {
  assert.equal(
    ["potion", "seed", "stone"].includes(ITEM_DEFS[itemId]?.category),
    false,
    `returned material item ${itemId} must not enter the Warehouse`,
  );
}

const onePotionLeft = depositPlayerInventory(
  createInitialWarehouse(),
  { ...returningPlayer, inventory: { potion_healing: 1 } },
  createCampaignMaterials(),
);
assert.equal(onePotionLeft.materialsGained.potion, 1);

const legacyWarehouse = createInitialWarehouse();
legacyWarehouse.stacks = {
  ...legacyWarehouse.stacks,
  potion_healing: 4,
  seed_sungrass: 5,
  stone_intuition: 3,
};
const migrated = extractWarehouseMaterials(legacyWarehouse);
const migratedMaterials = addMaterials(
  normalizeCampaignMaterials(undefined),
  migrated.materialsGained,
);
assert.deepEqual(migratedMaterials, { potion: 4, seed: 5, runestone: 3 });
const migratedAgain = extractWarehouseMaterials(migrated.warehouse);
assert.deepEqual(migratedAgain.materialsGained, {
  potion: 0,
  seed: 0,
  runestone: 0,
});
assert.deepEqual(
  normalizeCampaignMaterials({ potion: Number.NaN, seed: 3.9, runestone: -2 }),
  { potion: 0, seed: 3, runestone: 0 },
);

const staleLoadout = takeLoadoutFromWarehouse(
  legacyWarehouse,
  {
    stacks: { potion_healing: 4, seed_sungrass: 5, ration: 2 },
    instanceIds: [],
    slotRefs: [],
  },
);
assert.deepEqual(staleLoadout.loadout.stacks, { ration: 2 });

const trainingCampaign = createCampaign();
const trainee = trainingCampaign.companions[0];
trainee.professionId = "warrior";
trainee.learnedSkills = ["shockLeap", "weaponThrow"];
trainee.skills = ["shockLeap", "weaponThrow"];
trainingCampaign.gold = 500;
trainingCampaign.materials = { potion: 1, seed: 4, runestone: 0 };
assert.deepEqual(COMPANION_SKILLS.shieldCharge.trainingMaterials, {
  seed: 4,
  potion: 1,
});
const learned = learnCompanionSkill(
  trainingCampaign,
  trainee.id,
  "shieldCharge",
);
assert.equal(learned.changed, true);
assert.equal(learned.campaign.gold, 0);
assert.deepEqual(learned.campaign.materials, {
  potion: 0,
  seed: 0,
  runestone: 0,
});

const poorTraining = createCampaign();
const poorTrainee = poorTraining.companions[0];
poorTrainee.professionId = "warrior";
poorTrainee.learnedSkills = ["shockLeap", "weaponThrow"];
poorTrainee.skills = ["shockLeap", "weaponThrow"];
poorTraining.gold = 500;
poorTraining.materials = { potion: 5, seed: 3, runestone: 0 };
const rejectedTraining = learnCompanionSkill(
  poorTraining,
  poorTrainee.id,
  "shieldCharge",
);
assert.equal(rejectedTraining.reason, "not-enough-materials");
assert.strictEqual(rejectedTraining.campaign, poorTraining);

const smithyCampaign = createCampaign();
const sword = createPlainEquipmentInstance(ITEM_DEFS.shortsword, "material-smithy-sword");
sword.grade = "F";
smithyCampaign.warehouse.instances.push(sword);
smithyCampaign.gold = 1_600;
smithyCampaign.materials.runestone = 3;
assert.deepEqual(
  smithyUpgradeRequirements(smithyCampaign, "F").map((requirement) => ({
    kind: requirement.resourceKind,
    id: requirement.resourceId,
    required: requirement.required,
  })),
  [
    { kind: "currency", id: "gold", required: 1_600 },
    { kind: "material", id: "runestone", required: 3 },
  ],
);
const smithyTarget = listSmithyCandidates(smithyCampaign).find(
  (candidate) => candidate.instance.id === sword.id,
)!;
const upgraded = upgradeCampaignEquipmentGrade(smithyCampaign, smithyTarget.target);
assert.equal(upgraded.changed, true);
assert.equal(upgraded.campaign.gold, 0);
assert.equal(upgraded.campaign.materials.runestone, 0);
assert.equal(
  upgraded.campaign.warehouse.instances.find((instance) => instance.id === sword.id)?.grade,
  "E",
);
const poorSmithy = createCampaign();
const poorSword = createPlainEquipmentInstance(ITEM_DEFS.shortsword, "poor-smithy-sword");
poorSword.grade = "F";
poorSmithy.warehouse.instances.push(poorSword);
poorSmithy.gold = 1_600;
poorSmithy.materials.runestone = 2;
const poorTarget = listSmithyCandidates(poorSmithy).find(
  (candidate) => candidate.instance.id === poorSword.id,
)!;
const rejectedUpgrade = upgradeCampaignEquipmentGrade(poorSmithy, poorTarget.target);
assert.equal(rejectedUpgrade.reason, "not-enough-materials");
assert.strictEqual(rejectedUpgrade.campaign, poorSmithy);

for (const listing of createShopState(0x5a17c0de, 3).stock) {
  assert.equal(
    ["potion", "seed", "stone"].includes(ITEM_DEFS[listing.itemId].category),
    false,
    `shop stock must exclude material category ${listing.itemId}`,
  );
}

console.log("material currency regression smoke passed");
