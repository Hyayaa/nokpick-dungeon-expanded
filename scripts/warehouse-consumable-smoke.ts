import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyWarehouseEquipmentConsumable, type CampaignSave } from "../app/game/campaign";
import { createShopState } from "../app/game/commerce";
import { ITEM_DEFS } from "../app/game/data";
import {
  canApplyEquipmentConsumable,
  createPlainEquipmentInstance,
} from "../app/game/equipment";
import { WAREHOUSE_SLOT_COUNT } from "../app/game/inventory-slots";

const uiSource = readFileSync("app/components/DungeonGame.tsx", "utf8");
const cssSource = readFileSync("app/globals.css", "utf8");

const sword = createPlainEquipmentInstance(
  ITEM_DEFS.shortsword,
  "warehouse-scroll-sword",
  "F",
);
sword.traits = [{ id: "keen", grade: "F" }];
const campaign: CampaignSave = {
  version: 8,
  warehouse: {
    stacks: { scroll_upgrade: 1, scroll_identify: 1 },
    instances: [sword],
    throwableProfiles: {},
    slots: [
      "scroll_upgrade",
      "scroll_identify",
      sword.id,
      ...Array.from({ length: WAREHOUSE_SLOT_COUNT - 3 }, () => null),
    ],
  },
  companions: [],
  materials: { potion: 0, seed: 0, runestone: 0 },
  expeditions: 0,
  completedExpeditions: 0,
  bossDungeonClears: 0,
  gold: 0,
  offerSeed: 0x51c011,
  shop: createShopState(0x51c011),
};

assert.equal(
  canApplyEquipmentConsumable("scroll_upgrade", ITEM_DEFS.shortsword, sword),
  true,
);
assert.equal(
  canApplyEquipmentConsumable("scroll_identify", ITEM_DEFS.shortsword, sword),
  true,
);
const upgraded = applyWarehouseEquipmentConsumable(
  campaign,
  "scroll_upgrade",
  sword.id,
);
assert.equal(upgraded.changed, true);
assert.equal(upgraded.campaign.warehouse.stacks.scroll_upgrade ?? 0, 0);
assert.equal(
  upgraded.campaign.warehouse.instances.find(({ id }) => id === sword.id)
    ?.upgradeLevel,
  1,
);

const fullSword = createPlainEquipmentInstance(
  ITEM_DEFS.shortsword,
  "warehouse-full-sword",
  "C",
);
fullSword.traits = [
  { id: "keen", grade: "C" },
  { id: "lethal", grade: "C" },
  { id: "piercing", grade: "C" },
];
const fullCampaign: CampaignSave = {
  ...campaign,
  warehouse: {
    ...campaign.warehouse,
    stacks: { scroll_identify: 1 },
    instances: [fullSword],
    slots: [
      "scroll_identify",
      fullSword.id,
      ...Array.from({ length: WAREHOUSE_SLOT_COUNT - 2 }, () => null),
    ],
  },
};
assert.equal(
  canApplyEquipmentConsumable(
    "scroll_identify",
    ITEM_DEFS.shortsword,
    fullSword,
  ),
  false,
);
const blocked = applyWarehouseEquipmentConsumable(
  fullCampaign,
  "scroll_identify",
  fullSword.id,
);
assert.equal(blocked.changed, false);
assert.equal(blocked.reason, "maximum-enchantments");
assert.equal(blocked.campaign, fullCampaign);
assert.equal(blocked.campaign.warehouse.stacks.scroll_identify, 1);
assert.equal(fullSword.traits.length, 3);

assert.match(
  uiSource,
  /function useCampaignWarehouseInteraction\([\s\S]*itemPreview[\s\S]*pendingEquipmentConsumable[\s\S]*upgradeFlashKey/,
  "one campaign warehouse controller must own preview, pending target, and flash state",
);
assert.match(
  uiSource,
  /interaction\?\.inspectItem\(entry, contextLabel, anchor\)[\s\S]*warehouseInteraction\.itemPreview[\s\S]*<ItemDetailModal[\s\S]*readOnly[\s\S]*onUse=\{isEquipmentConsumableId/,
  "a normal warehouse click must inspect before the shared detail use action starts targeting",
);
assert.match(
  uiSource,
  /setItemPreview\(null\)[\s\S]*onBeginTargetMode\(\)[\s\S]*setPendingEquipmentConsumable/,
  "using a warehouse scroll must close details before entering target mode",
);
assert.match(
  uiSource,
  /pendingTargetMode[\s\S]*eligibleConsumableTarget[\s\S]*is-upgradeable-choice[\s\S]*interaction\?\.applyToTarget\(entry\)/,
  "target mode must highlight and apply through the shared warehouse inventory",
);
assert.match(
  uiSource,
  /canApplyEquipmentConsumable\([\s\S]*applyWarehouseEquipmentConsumable\([\s\S]*onCampaignChange\(result\.campaign\)[\s\S]*setPendingEquipmentConsumable\(null\)/,
  "one validated mutation path must update campaign once and then clear pending state",
);
assert.match(
  uiSource,
  /type UpgradeVisualTarget[\s\S]*kind: "warehouse"[\s\S]*function useUpgradeFlashFeedback[\s\S]*UPGRADE_FLASH_DURATION_MS[\s\S]*isUpgradeFlashing \? "is-upgrade-flashing"/,
  "dungeon and campaign equipment actions must share flash keys, timing, and class",
);
assert.match(cssSource, /\.is-upgrade-flashing\s*\{[\s\S]*upgrade-slot-flash 920ms/);
assert.doesNotMatch(uiSource, /pendingConsumableId|장비에 사용|commerce-selection-bar/);
assert.doesNotMatch(cssSource, /\.commerce-selection-bar/);
assert.equal((uiSource.match(/<CampaignWarehouseInventory/g) ?? []).length, 4);
assert.match(
  uiSource,
  /function CommerceModal\([\s\S]*CampaignWarehouseInventory[\s\S]*shopBuyback[\s\S]*onBuy/,
  "shop stock, buyback, purchase, and shared warehouse must remain connected",
);
assert.match(
  uiSource,
  /source\.zone === "warehouse"[\s\S]*shopSellTarget[\s\S]*handleShopSell/,
  "shop warehouse drag sales must remain connected",
);
assert.match(
  uiSource,
  /function BlacksmithModal\([\s\S]*CampaignWarehouseInventory[\s\S]*onTargetSelect[\s\S]*onUpgrade/,
  "blacksmith grade targeting must remain connected beside shared scroll targeting",
);
assert.match(
  uiSource,
  /function TrainingGroundModal\([\s\S]*CampaignWarehouseInventory[\s\S]*setTrainingSkillDragData[\s\S]*dropOnSkillSlot/,
  "training warehouse, companion selection, and skill dragging must remain connected",
);
assert.match(
  uiSource,
  /warehouseInteraction\.reset\(\)[\s\S]*setCommerceOpen\(false\)[\s\S]*warehouseInteraction\.reset\(\)[\s\S]*setBlacksmithOpen\(false\)[\s\S]*warehouseInteraction\.reset\(\)[\s\S]*setTrainingGroundOpen\(false\)/,
  "closing every facility must clear invisible warehouse interaction state",
);

console.log("warehouse consumable smoke checks passed");
