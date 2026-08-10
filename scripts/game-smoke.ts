import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DungeonGame from "../app/components/DungeonGame";
import {
  advanceWandRecharge,
  advanceHungerAndRecovery,
  advanceExpeditionFloor,
  acceptEquipmentOffer,
  activateCompanionQuickslot,
  activateCompanionSkill,
  advanceManualPartyRound,
  assignCompanionItem,
  assignPlayerItem,
  canAssignCompanionItem,
  canAssignPlayerItem,
  canPickupGroundItem,
  chooseAugment,
  createExpeditionGame,
  createNewGame,
  developerGrantItem,
  developerRecruitCompanion,
  developerSpawnEnemy,
  deferActionForManualRound,
  descendFloor,
  discardItem,
  enchantEquippedItem,
  enchantItem,
  equipItem,
  getPlayerAttack,
  getPlayerAttackSpeed,
  getPlayerAccuracy,
  getPlayerEvasion,
  getPlayerMoveSpeed,
  getEnemyWakeChance,
  hasCompanionExplorationWork,
  HIGH_GRASS_SEED_DROP_CHANCE,
  inventorySlotCount,
  manualCompanionStep,
  manualCompanionWait,
  MAX_INVENTORY_SLOTS,
  MAX_PLAYER_LEVEL,
  pathTo,
  plannedDungeonScrollCount,
  performAlchemy,
  planAutoExplore,
  planAutoExploreLoadoutAction,
  pickupGroundItems,
  playerStep,
  previewAlchemy,
  runEnemyTurn,
  scaledEnemyStats,
  setCompanionCommand,
  setCompanionPriorityTarget,
  shouldAutoPickup,
  throwItem,
  throwableChargeCount,
  unassignCompanionItem,
  unassignPlayerItem,
  unequipSlot,
  upgradeItemWithScroll,
  useItem as consumeItemAction,
  waitTurn,
  zapWand,
  BURNING_DURATION,
  COMPANION_PASSIVE_SLOT_INDEXES,
  COMPANION_QUICKSLOT_INDEXES,
} from "../app/game/engine";
import {
  DUNGEON_DEFINITIONS,
  DUNGEON_DIFFICULTY_RULES,
  DUNGEON_GOLD_TARGETS,
  applyLoadoutToPlayer,
  cloneWarehouse,
  companionToPlayer,
  createInitialWarehouse,
  createStarterCompanionRoster,
  depositPlayerInventory,
  generateDungeonOffers,
  normalizeCompanionForHubWithReleasedItems,
  newExpeditionPickups,
  playerToCompanion,
  selectMainLootEntries,
  selectedLoadoutSlotCount,
  takeLoadoutFromWarehouse,
} from "../app/game/campaign";
import {
  BLACKSMITH_UPGRADE_COST,
  SHOP_STOCK_SIZE,
  buyShopListing,
  createShopState,
  listSmithyCandidates,
  sellWarehouseItem,
  shopSalePrice,
  smithyNextGrade,
  smithyUpgradeCost,
  smithyUpgradeRequirements,
  upgradeCampaignEquipmentGrade,
} from "../app/game/commerce";
import {
  COMPANION_CLASSES,
  COMPANION_CLASS_IDS,
  COMPANION_TRAIT_IDS,
  COMPANION_TRAITS,
  createCompanionTraits,
  getCompanionAccuracy,
  getCompanionAttack,
  getCompanionAttackSpeed,
  getCompanionEvasion,
  getCompanionMoveSpeed,
  reduceCharacterDamage,
} from "../app/game/companions";
import {
  COMPANION_ATTACK_FRAMES,
  COMPANION_FRAME_HEIGHT,
  COMPANION_FRAME_WIDTH,
  COMPANION_INTERACT_FRAMES,
  COMPANION_MOVE_FRAMES,
  COMPANION_VISUALS,
} from "../app/presentation/companion-visuals";
import {
  COMPANION_PROFESSIONS,
  COMPANION_PROFESSION_IDS,
  COMPANION_SKILLS,
  COMPANION_SKILL_IDS,
  createCompanionSkills,
  normalizeCompanionProfession,
} from "../app/game/companion-skills";
import {
  companionSkillBlueprint,
  deriveCompanionSkill,
} from "../app/game/companion-skill-blueprints";
import {
  experienceForNextLevel,
  LEVEL_STAT_GROWTH,
  LEVEL_XP_REQUIREMENT_GROWTH,
  LEVEL_XP_REQUIREMENT_MULTIPLIER,
  PLANNED_ENDGAME_POWER_MULTIPLIER,
} from "../app/game/progression";
import { AUGMENT_DEFS, AUGMENTS_ENABLED } from "../app/game/augments";
import {
  createEquipmentInstance,
  createPlainEquipmentInstance,
  enchantEquipmentInstance,
  enchantmentGradePower,
  enchantmentGradeChances,
  equipmentStatProfile,
  equipmentTraitSummary,
  isUpgradeableEquipment,
  normalizeEquipmentInstance,
  rollEnchantmentGrade,
  upgradeEquipmentInstance,
} from "../app/game/equipment";
import type { InventoryInstance } from "../app/game/types";
import {
  ITEM_GRADES,
  itemGradeIndex,
  itemGradeMultiplier,
  resolveItemGrade,
} from "../app/game/item-grade";
import {
  ENEMY_DROP_CHANCE,
  ENEMY_DROP_TABLE,
  ENEMY_SPRITES,
  ENEMY_STATS,
  FLOOR_EQUIPMENT_CATEGORIES,
  FLOOR_LOOT,
  ITEM_DEFS,
  OBJECT_SPRITES,
  SEED_ITEM_IDS,
  SPECIAL_ALCHEMY_IDS,
  SPECIAL_POTION_IDS,
  SPECIAL_SCROLL_IDS,
} from "../app/game/data";
import {
  createEffectTrajectories,
  releaseHeldSignalsAtTurnStart,
} from "../app/presentation/effects";
import {
  WAREHOUSE_SLOT_COUNT,
  normalizeFixedSlots,
  normalizePlayerInventorySlots,
  normalizeStorageSlots,
  swapFixedSlots,
} from "../app/game/inventory-slots";
import {
  reorderDungeonInventory,
  swapPartyLoadout,
} from "../app/game/loadout-transactions";
import { applyPreparationSlotTransfer } from "../app/game/preparation-transactions";
import {
  nearestVisibleEnemy,
  PLAYER_ACTOR_ID,
  suggestedSkillTarget,
} from "../app/game/party";
import { isTileClickReachable } from "../app/game/spatial";
import {
  completeFloorExit,
  resolveGameSession,
} from "../app/game/session";
import {
  blocksSight,
  findPath,
  generateFloor,
  isWalkable,
} from "../app/game/map";
import {
  PLAYER_ATTACK_FRAMES,
  PLAYER_INTERACT_FRAMES,
} from "../app/presentation/player-animation";
import {
  burningStatusPixels,
  cameraShakeOffset,
  connectedWaterTiles,
  createCompanionSkillEffects,
  createDustEffects,
  createEnchantEffects,
  createHitEffects,
  createLevelUpEffects,
  createWaterRippleEffects,
  fieldTilePixels,
  pruneCameraShakes,
  prunePixelEffects,
} from "../app/presentation/pixel-effects";
import {
  createFootprintFragmentParticles,
  createFragmentParticles,
  createShockwaveParticles,
  createSlashParticles,
  createThrustParticles,
  particleFootprintTiles,
} from "../app/presentation/pixel-particle-emitters";
import { SKILL_PARTICLE_RECIPES } from "../app/presentation/skill-particle-recipes";
import { sampleTravelMotion } from "../app/presentation/skill-motion";
import {
  FOG_INNER_BOUNDARY_PIXELS,
  FOG_OUTER_BOUNDARY_PIXELS,
  FOG_PIXELS_PER_CELL,
  FOG_PIXELS_PER_TILE,
  FOG_REMEMBERED_ALPHA,
  FOG_RIPPLE_AMPLITUDE_PIXELS,
  FOG_RIPPLE_FRAME_MS,
  FOG_SIGHT_EDGE_ALPHA,
  FOG_STATIC_CLEARANCE_PIXELS,
  FOG_UNEXPLORED_EXPANSION_PIXELS,
  FOG_UNEXPLORED_ALPHA,
  FOG_VISIBLE_ALPHA,
  createPixelFogRuntime,
  drawPixelFogTexture,
  pixelFogBoundaryStats,
  pixelFogMaskAlpha,
  pixelFogStableMaskAlpha,
  pixelFogStaticSettleAt,
  pixelFogTransitionAlpha,
  pixelFogVisibilityDistance,
  syncPixelFogRuntime,
  usesRememberedFogBase,
  usesStaticFogAtPixel,
} from "../app/presentation/fog-frontier";
import {
  fogMasksForTile,
  SEWER_TILE_FRAMES,
  terrainVisual,
  terrainUnderlayForPixelFog,
  usesQuadrantFogForFrame,
  wallOverlayVisual,
  waterPatternFrame,
  waterSurfaceMaskRows,
  waterTextureSlices,
  WATER_SCROLL_PIXELS_PER_SECOND,
} from "../app/presentation/render";
import {
  ATTACK_SEQUENCE_GAP,
  ATTACK_START_DELAY,
  COMPANION_ATTACK_DURATION,
  COMPANION_MOVE_DURATION,
  createTurnMotionTimeline,
  durationForInteraction,
  durationForMotion,
  impactDelayForMotion,
  ENEMY_ATTACK_DURATION,
  ENEMY_MOVE_DURATION,
  PLAYER_ATTACK_DURATION,
  PLAYER_INTERACTION_DURATION,
  PLAYER_PICKUP_DURATION,
  PLAYER_MOVE_DURATION,
  SKILL_CHARGE_DURATION,
  SKILL_LEAP_DURATION,
  SKILL_TELEPORT_DURATION,
} from "../app/presentation/timing";
import {
  isDamageEffect,
  isDefeatEffect,
  isImpactEffect,
} from "../app/presentation/combat-feedback";

const pointKey = (x: number, y: number) => `${x},${y}`;
const fileHash = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const dungeonUiSource = [
  "app/components/DungeonGame.tsx",
  "app/presentation/dungeon-renderer.ts",
  "app/presentation/description-window.tsx",
  "app/presentation/companion-visuals.ts",
  "app/presentation/inspection-catalog.ts",
]
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
const globalStyleSource = readFileSync("app/globals.css", "utf8");
const mapSource = readFileSync("app/game/map.ts", "utf8");
const dungeonRendererSource = readFileSync(
  "app/presentation/dungeon-renderer.ts",
  "utf8",
);
const campaignHtml = renderToStaticMarkup(createElement(DungeonGame));

const semanticDamageEffect = {
  x: 1,
  y: 1,
  text: "번역과 무관한 피해 문구",
  color: "#fff",
  kind: "damage" as const,
};
assert.ok(
  isDamageEffect(semanticDamageEffect) && isImpactEffect(semanticDamageEffect),
  "damage presentation must use semantic effect kinds instead of localized text",
);
assert.ok(
  !isDamageEffect({ ...semanticDamageEffect, kind: "notice", text: "-99" }),
  "numeric-looking display text must not be interpreted as rule feedback",
);
assert.ok(
  isDefeatEffect({ ...semanticDamageEffect, kind: "defeat", text: "defeated" }),
  "defeat presentation must remain stable when display text changes",
);

const sessionState = createNewGame(0x5e5510);
sessionState.enemies = [];
sessionState.companions = [];
const sessionAction = waitTurn(sessionState);
const sessionResolution = resolveGameSession(sessionAction);
assert.equal(sessionResolution.kind, "turn");
if (sessionResolution.kind === "turn") {
  assert.equal(
    sessionResolution.enemyTurns.length,
    sessionAction.elapsedTurns ?? 1,
    "the game session must own enemy-turn progression",
  );
  assert.equal(
    sessionResolution.state,
    sessionResolution.enemyTurns.at(-1)?.state,
  );
}
const floorSession = resolveGameSession({
  ...sessionAction,
  state: { ...sessionAction.state, floor: 1, maxFloor: 2 },
  reachedExit: true,
});
assert.equal(floorSession.kind, "floorExit");
if (floorSession.kind === "floorExit") {
  assert.equal(
    completeFloorExit(floorSession).kind,
    "descended",
    "the game session must own floor-transition rules",
  );
}

const clickReachState = createNewGame(0xc11cab1e);
clickReachState.tiles.forEach((row) =>
  row.forEach((tile) => {
    tile.visible = false;
    tile.visibleMask = 0;
    tile.discovered = false;
    tile.discoveredMask = 0;
  }),
);
const clickReachCenter = { x: 10, y: 10 };
clickReachState.tiles[clickReachCenter.y][clickReachCenter.x].visible = true;
clickReachState.tiles[clickReachCenter.y][clickReachCenter.x].visibleMask = 15;
clickReachState.tiles[clickReachCenter.y][clickReachCenter.x].discovered = true;
clickReachState.tiles[clickReachCenter.y][clickReachCenter.x].discoveredMask = 15;
assert.equal(
  isTileClickReachable(clickReachState, { x: 11, y: 11 }),
  true,
  "the clickable frontier must extend one diagonal tile beyond live vision",
);
assert.equal(
  isTileClickReachable(clickReachState, { x: 12, y: 10 }),
  false,
  "the clickable frontier must not expose a second hidden tile",
);
clickReachState.tiles[4][4].discovered = true;
assert.equal(
  isTileClickReachable(clickReachState, { x: 4, y: 4 }),
  true,
  "previously explored tiles must remain clickable outside live vision",
);

const loadoutTransactionState = developerRecruitCompanion(
  createNewGame(0x10ad07),
  COMPANION_CLASS_IDS[0],
);
const loadoutCompanion = loadoutTransactionState.companions[0];
loadoutTransactionState.player.equipment.ring = "ring_might";
loadoutTransactionState.player.equipmentInstances.ring =
  createPlainEquipmentInstance(ITEM_DEFS.ring_might);
loadoutCompanion.equipment.ring = "ring_guard";
loadoutCompanion.equipmentInstances.ring =
  createPlainEquipmentInstance(ITEM_DEFS.ring_guard);
const loadoutSwap = swapPartyLoadout(
  loadoutTransactionState,
  { ownerId: PLAYER_ACTOR_ID, target: { kind: "flex", index: 0 } },
  { ownerId: loadoutCompanion.id, target: { kind: "flex", index: 0 } },
);
assert.equal(loadoutSwap.changed, true);
assert.equal(loadoutSwap.state.player.equipment.ring, "ring_guard");
assert.equal(loadoutSwap.state.companions[0].equipment.ring, "ring_might");
assert.equal(
  loadoutTransactionState.player.equipment.ring,
  "ring_might",
  "loadout transactions must not mutate their input state",
);

const cursedTransactionState = loadoutSwap.state;
cursedTransactionState.player.equipmentInstances.ring!.cursed = true;
const cursedSwap = swapPartyLoadout(
  cursedTransactionState,
  { ownerId: PLAYER_ACTOR_ID, target: { kind: "flex", index: 0 } },
  { ownerId: loadoutCompanion.id, target: { kind: "flex", index: 0 } },
);
assert.equal(cursedSwap.changed, false);
assert.equal(cursedSwap.reason, "cursed");
assert.equal(cursedSwap.state.player.equipment.ring, "ring_guard");

const inventoryTransactionState = createNewGame(0x5107);
inventoryTransactionState.player.inventory.potion_healing = 1;
inventoryTransactionState.player.inventory.potion_strength = 1;
inventoryTransactionState.player.inventorySlots = [
  "potion_healing",
  "potion_strength",
  ...Array.from({ length: MAX_INVENTORY_SLOTS - 2 }, () => null),
];
const reorderedInventory = reorderDungeonInventory(
  inventoryTransactionState,
  0,
  1,
  "potion_healing",
);
assert.equal(reorderedInventory.player.inventorySlots?.[0], "potion_strength");
assert.equal(reorderedInventory.player.inventorySlots?.[1], "potion_healing");
assert.equal(
  inventoryTransactionState.player.inventorySlots?.[0],
  "potion_healing",
);

const createPreparationTransferFixture = () => {
  const sword = createPlainEquipmentInstance(
    ITEM_DEFS.shortsword,
    "preparation-sword",
  );
  const ring = createPlainEquipmentInstance(
    ITEM_DEFS.ring_might,
    "preparation-ring",
  );
  const companions = createStarterCompanionRoster(
    COMPANION_CLASS_IDS.slice(0, 2),
  );
  return {
    campaign: {
      version: 8 as const,
      warehouse: {
        stacks: { potion_healing: 3 },
        instances: [sword, ring],
        throwableProfiles: {},
        slots: [
          sword.id,
          ring.id,
          "potion_healing",
          ...Array.from({ length: WAREHOUSE_SLOT_COUNT - 3 }, () => null),
        ],
      },
      companions,
      materials: { potion: 10, seed: 10, runestone: 10 },
      expeditions: 0,
      completedExpeditions: 0,
      bossDungeonClears: 0,
      gold: 0,
      offerSeed: 1,
      shop: createShopState(1),
    },
    loadout: {
      stacks: {},
      instanceIds: [],
      slotRefs: Array.from(
        { length: MAX_INVENTORY_SLOTS },
        () => null,
      ),
    },
    sword,
    ring,
  };
};

const preparationReorderFixture = createPreparationTransferFixture();
const preparationReorder = applyPreparationSlotTransfer(
  preparationReorderFixture.campaign,
  preparationReorderFixture.loadout,
  { zone: "warehouse", index: 0 },
  { zone: "warehouse", index: 1 },
);
assert.equal(preparationReorder.changed, true);
assert.equal(preparationReorder.campaign.warehouse.slots[0], "preparation-ring");
assert.equal(preparationReorder.campaign.warehouse.slots[1], "preparation-sword");
assert.equal(
  preparationReorderFixture.campaign.warehouse.slots[0],
  "preparation-sword",
  "preparation transfers must not mutate the persisted campaign input",
);

const preparationEquipFixture = createPreparationTransferFixture();
const returningWeapon = createPlainEquipmentInstance(
  ITEM_DEFS.rusty_sword,
  "returning-preparation-weapon",
);
preparationEquipFixture.campaign.companions[0].equipment.weapon = "rusty_sword";
preparationEquipFixture.campaign.companions[0].equipmentInstances.weapon =
  returningWeapon;
const preparationEquip = applyPreparationSlotTransfer(
  preparationEquipFixture.campaign,
  preparationEquipFixture.loadout,
  { zone: "warehouse", index: 0 },
  {
    zone: "preparationCompanionEquipment",
    companionId: preparationEquipFixture.campaign.companions[0].id,
    target: { kind: "equipment", slot: "weapon" },
  },
);
assert.equal(preparationEquip.changed, true);
assert.equal(
  preparationEquip.campaign.companions[0].equipmentInstances.weapon?.id,
  "preparation-sword",
  "equipping in preparation must transfer the exact warehouse instance",
);
assert.equal(
  preparationEquip.campaign.warehouse.slots[0],
  "returning-preparation-weapon",
  "displaced companion gear must return to the dragged warehouse slot",
);
assert.equal(
  preparationEquip.campaign.warehouse.instances.some(
    (instance) => instance.id === "preparation-sword",
  ),
  false,
  "one equipment instance must never be owned by the warehouse and companion together",
);

const preparationIncompatibleFixture = createPreparationTransferFixture();
const incompatiblePreparationTransfer = applyPreparationSlotTransfer(
  preparationIncompatibleFixture.campaign,
  preparationIncompatibleFixture.loadout,
  { zone: "warehouse", index: 1 },
  {
    zone: "preparationCompanionEquipment",
    companionId: preparationIncompatibleFixture.campaign.companions[0].id,
    target: { kind: "flex", index: 2 },
  },
);
assert.equal(incompatiblePreparationTransfer.changed, false);
assert.equal(
  incompatiblePreparationTransfer.campaign,
  preparationIncompatibleFixture.campaign,
  "passive rings must be rejected by active preparation quickslots without cloning state",
);

const preparationCurseFixture = createPreparationTransferFixture();
const cursedPreparationRing = createPlainEquipmentInstance(
  ITEM_DEFS.ring_guard,
  "cursed-preparation-ring",
);
cursedPreparationRing.cursed = true;
preparationCurseFixture.campaign.companions[0].equipment.ring = "ring_guard";
preparationCurseFixture.campaign.companions[0].equipmentInstances.ring =
  cursedPreparationRing;
const cursedPreparationTransfer = applyPreparationSlotTransfer(
  preparationCurseFixture.campaign,
  preparationCurseFixture.loadout,
  {
    zone: "preparationCompanionEquipment",
    companionId: preparationCurseFixture.campaign.companions[0].id,
    target: { kind: "flex", index: 0 },
  },
  { zone: "warehouse", index: 5 },
);
assert.equal(cursedPreparationTransfer.changed, false);
assert.equal(
  cursedPreparationTransfer.campaign.companions[0].equipmentInstances.ring?.id,
  "cursed-preparation-ring",
  "cursed preparation gear must remain with its owner",
);

const preparationSharedFixture = createPreparationTransferFixture();
const firstSharedRegistration = applyPreparationSlotTransfer(
  preparationSharedFixture.campaign,
  preparationSharedFixture.loadout,
  { zone: "warehouse", index: 2 },
  {
    zone: "preparationCompanionEquipment",
    companionId: preparationSharedFixture.campaign.companions[0].id,
    target: { kind: "flex", index: 2 },
  },
);
assert.equal(firstSharedRegistration.changed, true);
assert.equal(firstSharedRegistration.loadout.slotRefs[0], "potion_healing");
const secondSharedRegistration = applyPreparationSlotTransfer(
  firstSharedRegistration.campaign,
  firstSharedRegistration.loadout,
  { zone: "preparationInventory", index: 0 },
  {
    zone: "preparationCompanionEquipment",
    companionId: preparationSharedFixture.campaign.companions[1].id,
    target: { kind: "flex", index: 2 },
  },
);
assert.equal(secondSharedRegistration.changed, true);
assert.equal(
  secondSharedRegistration.campaign.companions[0].autoSlots[2]?.defId,
  "potion_healing",
);
assert.equal(
  secondSharedRegistration.campaign.companions[1].autoSlots[2]?.defId,
  "potion_healing",
  "multiple companions must be able to reference one selected consumable stack",
);
const returnedSharedStack = applyPreparationSlotTransfer(
  secondSharedRegistration.campaign,
  secondSharedRegistration.loadout,
  {
    zone: "preparationCompanionEquipment",
    companionId: preparationSharedFixture.campaign.companions[0].id,
    target: { kind: "flex", index: 2 },
  },
  { zone: "warehouse", index: 2 },
);
assert.equal(returnedSharedStack.changed, true);
assert.equal(returnedSharedStack.campaign.companions[0].autoSlots[2], null);
assert.equal(returnedSharedStack.campaign.companions[1].autoSlots[2], null);
assert.equal(returnedSharedStack.loadout.stacks.potion_healing, undefined);

const deterministicShop = createShopState(0x5a17c0de, 3);
assert.equal(
  deterministicShop.stock.length,
  SHOP_STOCK_SIZE,
  "each shop refresh must prepare the fixed twelve-listing stock",
);
assert.deepEqual(
  deterministicShop,
  createShopState(0x5a17c0de, 3),
  "shop stock must be deterministic for one persisted refresh seed",
);
assert.ok(
  deterministicShop.stock.every(
    (listing) =>
      listing.itemId !== "gold" &&
      ITEM_DEFS[listing.itemId]?.category !== "key" &&
      listing.quantity > 0 &&
      listing.unitPrice > 0,
  ),
  "shop stock must contain only positive, tradable item listings",
);
assert.equal(
  deterministicShop.stock.filter((listing) =>
    isUpgradeableEquipment(ITEM_DEFS[listing.itemId])
  ).length,
  SHOP_STOCK_SIZE / 2,
  "each refresh must mix six equipment listings with six supply listings",
);
assert.ok(
  deterministicShop.stock
    .filter((listing) => listing.instance)
    .every((listing) => listing.instance?.cursed === false),
  "the guild shop must not sell cursed equipment",
);
assert.notDeepEqual(
  deterministicShop.stock.map((listing) => listing.id),
  createShopState(0x5a17c0df, 4).stock.map((listing) => listing.id),
  "returning from an expedition must be able to replace the complete shop cycle",
);

const stackSaleFixture = createPreparationTransferFixture();
const rejectedSale = sellWarehouseItem(
  stackSaleFixture.campaign,
  WAREHOUSE_SLOT_COUNT - 1,
);
assert.equal(rejectedSale.changed, false);
assert.equal(rejectedSale.campaign, stackSaleFixture.campaign);
assert.equal(rejectedSale.goldDelta, 0);
assert.equal(
  rejectedSale.campaign.gold,
  stackSaleFixture.campaign.gold,
  "dropping an empty or invalid warehouse slot must not change items or gold",
);
const protectedSaleFixture = createPreparationTransferFixture();
protectedSaleFixture.campaign.warehouse.stacks.iron_key = 1;
protectedSaleFixture.campaign.warehouse.slots[3] = "iron_key";
const protectedSale = sellWarehouseItem(protectedSaleFixture.campaign, 3);
assert.equal(protectedSale.changed, false);
assert.equal(protectedSale.campaign, protectedSaleFixture.campaign);
assert.equal(protectedSale.goldDelta, 0);
assert.equal(
  protectedSaleFixture.campaign.warehouse.stacks.iron_key,
  1,
  "non-tradable items must remain untouched after a rejected sale",
);
const stackSalePrice = shopSalePrice(ITEM_DEFS.potion_healing);
const stackSale = sellWarehouseItem(stackSaleFixture.campaign, 2);
assert.equal(stackSale.changed, true);
assert.equal(stackSale.goldDelta, stackSalePrice);
assert.equal(stackSale.campaign.warehouse.stacks.potion_healing, 2);
assert.equal(
  stackSaleFixture.campaign.warehouse.stacks.potion_healing,
  3,
  "selling one stacked item must not mutate the saved campaign input",
);
assert.equal(stackSale.campaign.shop.buyback.length, 1);
assert.equal(
  stackSale.campaign.shop.buyback[0].unitPrice,
  stackSalePrice,
  "a sold item must enter buyback at exactly the gold paid to the player",
);
const stackBuyback = buyShopListing(
  stackSale.campaign,
  "buyback",
  stackSale.campaign.shop.buyback[0].id,
);
assert.equal(stackBuyback.changed, true);
assert.equal(stackBuyback.campaign.warehouse.stacks.potion_healing, 3);
assert.equal(stackBuyback.campaign.gold, stackSaleFixture.campaign.gold);
assert.equal(
  stackBuyback.campaign.shop.buyback.length,
  0,
  "buying back the sold unit must remove that exact buyback listing",
);

const equipmentSaleFixture = createPreparationTransferFixture();
const soldEquipmentId = equipmentSaleFixture.sword.id;
const equipmentSale = sellWarehouseItem(equipmentSaleFixture.campaign, 0);
assert.equal(equipmentSale.changed, true);
assert.equal(
  equipmentSale.campaign.warehouse.instances.some(
    (instance) => instance.id === soldEquipmentId,
  ),
  false,
  "selling individual equipment must transfer its unique instance out of storage",
);
assert.equal(
  equipmentSale.campaign.shop.buyback[0].instance?.id,
  soldEquipmentId,
  "buyback must preserve the exact sold equipment instance",
);

const stockPurchaseFixture = createPreparationTransferFixture();
stockPurchaseFixture.campaign.gold = 2_000_000;
const purchasedListing = stockPurchaseFixture.campaign.shop.stock[0];
const purchasedStackBefore = (
  stockPurchaseFixture.campaign.warehouse.stacks as Record<string, number>
)[purchasedListing.itemId] ?? 0;
const stockPurchase = buyShopListing(
  stockPurchaseFixture.campaign,
  "stock",
  purchasedListing.id,
);
assert.equal(stockPurchase.changed, true);
assert.equal(
  stockPurchase.campaign.gold,
  stockPurchaseFixture.campaign.gold - purchasedListing.unitPrice,
  "buying shop stock must deduct its persisted listing price",
);
assert.ok(
  purchasedListing.instance
    ? stockPurchase.campaign.warehouse.instances.some(
        (instance) => instance.id === purchasedListing.instance?.id,
      )
    : (stockPurchase.campaign.warehouse.stacks[purchasedListing.itemId] ?? 0) >
      purchasedStackBefore,
  "purchased stock must move into the warehouse",
);

assert.deepEqual(
  BLACKSMITH_UPGRADE_COST,
  { F: 1_600, E: 5_000, D: 16_000, C: 50_000, B: 160_000, A: 500_000 },
  "blacksmith costs must follow the dungeon gold curve through the S upgrade",
);
assert.equal(smithyNextGrade("A"), "S");
assert.equal(smithyNextGrade("S"), null);
assert.equal(smithyUpgradeCost("S"), null);
const smithyRequirementFixture = createPreparationTransferFixture();
smithyRequirementFixture.campaign.gold = 1_599;
assert.deepEqual(
  smithyUpgradeRequirements(smithyRequirementFixture.campaign, "F"),
  [
    {
      resourceKind: "currency",
      resourceId: "gold",
      required: 1_600,
      owned: 1_599,
      satisfied: false,
    },
  ],
  "smithy costs must expose extensible resource requirements without adding unapproved item costs",
);
smithyRequirementFixture.campaign.gold = 1_600;
assert.equal(
  smithyUpgradeRequirements(smithyRequirementFixture.campaign, "F")[0].satisfied,
  true,
  "the current gold requirement must become satisfied at the existing exact cost",
);
const smithyFixture = createPreparationTransferFixture();
smithyFixture.sword.grade = "F";
smithyFixture.sword.traits = [
  { id: "keen", grade: "F" },
  { id: "swift", grade: "C" },
];
smithyFixture.campaign.gold = 2_000;
const smithyCandidate = listSmithyCandidates(smithyFixture.campaign).find(
  (candidate) => candidate.instance.id === smithyFixture.sword.id,
);
assert.ok(smithyCandidate, "the smithy must list warehouse equipment");
const smithyUpgrade = upgradeCampaignEquipmentGrade(
  smithyFixture.campaign,
  smithyCandidate!.target,
);
assert.equal(smithyUpgrade.changed, true);
assert.equal(smithyUpgrade.cost, 1_600);
const smithyUpgradedSword = smithyUpgrade.campaign.warehouse.instances.find(
  (instance) => instance.id === smithyFixture.sword.id,
);
assert.equal(smithyUpgradedSword?.grade, "E");
assert.deepEqual(
  smithyUpgradedSword?.traits,
  [
    { id: "keen", grade: "E" },
    { id: "swift", grade: "C" },
  ],
  "raising equipment grade must raise its first trait while preserving later enchantment grades",
);
assert.equal(
  smithyFixture.sword.grade,
  "F",
  "smithy upgrades must not mutate the original campaign equipment",
);

const companionSmithyFixture = createPreparationTransferFixture();
companionSmithyFixture.campaign.gold = 2_000;
const companionSmithyCandidate = listSmithyCandidates(
  companionSmithyFixture.campaign,
).find((candidate) => candidate.target.kind === "companionEquipment");
assert.ok(
  companionSmithyCandidate,
  "the smithy must reuse every companion's equipped item as a candidate",
);
if (!companionSmithyCandidate || companionSmithyCandidate.target.kind !== "companionEquipment") {
  throw new Error("missing companion smithy candidate");
}
companionSmithyCandidate.instance.grade = "F";
const companionEquipmentId = companionSmithyCandidate.instance.id;
const companionEquipmentDefId = companionSmithyCandidate.instance.defId;
const companionSmithyUpgrade = upgradeCampaignEquipmentGrade(
  companionSmithyFixture.campaign,
  companionSmithyCandidate.target,
);
assert.equal(companionSmithyUpgrade.changed, true);
const upgradedCompanion = companionSmithyUpgrade.campaign.companions.find(
  (companion) => companion.id === companionSmithyCandidate.target.companionId,
);
const companionEquipmentKey = companionSmithyCandidate.target.equipmentKey as keyof NonNullable<
  typeof upgradedCompanion
>["equipmentInstances"];
const upgradedCompanionInstance = upgradedCompanion?.equipmentInstances[
  companionEquipmentKey
];
assert.equal(upgradedCompanionInstance?.id, companionEquipmentId);
assert.equal(upgradedCompanionInstance?.defId, companionEquipmentDefId);
assert.equal(upgradedCompanionInstance?.grade, "E");
assert.equal(
  upgradedCompanion?.equipment[
    companionEquipmentKey
  ],
  companionEquipmentDefId,
  "upgrading companion gear must keep it equipped by the same companion",
);
assert.equal(
  companionSmithyUpgrade.campaign.warehouse.instances.some(
    (instance) => instance.id === companionEquipmentId,
  ),
  false,
  "upgraded companion gear must not be copied or moved into the warehouse",
);
assert.equal(
  listSmithyCandidates(companionSmithyFixture.campaign).some(
    (candidate) => candidate.itemId === "potion_healing",
  ),
  false,
  "non-equipment warehouse items must stay visible in UI without becoming smithy candidates",
);

assert.match(
  campaignHtml,
  /어디로 향하시겠습니까\?/,
  "the initial render must be the expedition hub",
);
assert.match(campaignHtml, />창고</, "the hub must expose the warehouse");
assert.match(campaignHtml, /원정대 상점/, "the hub must expose the shop");
assert.match(campaignHtml, /불꽃 대장간/, "the hub must expose the blacksmith");
assert.match(campaignHtml, /보유 골드[\s\S]*0/, "the hub must expose saved guild gold");
assert.match(
  dungeonUiSource,
  /source\.zone === "warehouse"[\s\S]*target\.zone === "shopSellTarget"[\s\S]*target\.zone === "shopStock"[\s\S]*target\.zone === "shopBuyback"[\s\S]*handleShopSell\(source\.index\)/,
  "dropping a warehouse slot anywhere in the right shop area must execute the existing sale transaction",
);
assert.match(
  dungeonUiSource,
  /source\.zone === "shopStock" \|\| source\.zone === "shopBuyback"[\s\S]*target\.zone === "shopWarehouseTarget" \|\| target\.zone === "warehouse"[\s\S]*handleShopBuy/,
  "dragging shop or buyback stock into the left warehouse area must preserve purchase behavior",
);
assert.match(
  dungeonUiSource,
  /commerce-split-layout[\s\S]*CampaignWarehouseInventory[\s\S]*commerce-shop-panel/,
  "the shop must render the shared warehouse on the left and shop stock on the right",
);
assert.doesNotMatch(
  dungeonUiSource,
  /shopBuyback|BUYBACK|>되사기</,
  "the shop must not render a separate buyback panel or listing",
);
assert.match(
  dungeonUiSource,
  /blacksmith-source-panels[\s\S]*className="preparation-storage-grid blacksmith-warehouse-grid"[\s\S]*companions=\{campaign\.companions\}[\s\S]*placement="reserve"/,
  "the blacksmith must show the shared full warehouse above the complete companion equipment roster",
);
assert.match(
  dungeonUiSource,
  /target\.zone === "smithyTarget"[\s\S]*listSmithyCandidates\(campaign\)[\s\S]*smithyNextGrade\(grade\)[\s\S]*setBlacksmithTarget\(candidate\.target\)/,
  "only an existing upgradeable smithy candidate may register through drag and drop",
);
assert.match(
  dungeonUiSource,
  /smithyUpgradeRequirements\(campaign, currentGrade\)[\s\S]*requirements\.every[\s\S]*resourceKind[\s\S]*resourceId[\s\S]*requirement\.owned[\s\S]*requirement\.required[\s\S]*requirement\.satisfied/,
  "the blacksmith must render each requirement's resource, owned amount, required amount, and satisfaction state",
);
assert.match(
  dungeonUiSource,
  /disabled=\{!requirementsMet\}[\s\S]*onClick=\{\(\) => onUpgrade\(selected\.target\)\}/,
  "the upgrade action must stay disabled until one valid target has every requirement satisfied",
);
assert.match(
  dungeonUiSource,
  /preparation-storage-panel[\s\S]*CampaignWarehouseInventory[\s\S]*placement="party"[\s\S]*placement="reserve"/,
  "expedition preparation must keep using the same shared warehouse and companion equipment renderers",
);
assert.match(
  dungeonUiSource,
  /shop: createShopState\(nextOfferSeed, current\.expeditions\)/,
  "every expedition return must replace the full shop stock cycle",
);
assert.match(
  dungeonUiSource,
  /version: 8[\s\S]*materials: addMaterials[\s\S]*shop: normalizeShopState\(parsed\.shop, offerSeed, expeditions\)/,
  "campaign restore must migrate older saves into the persisted shop schema",
);
assert.match(
  globalStyleSource,
  /\.commerce-split-layout[\s\S]*\.shop-listing-grid[\s\S]*\.blacksmith-source-panels[\s\S]*\.fixed-item-slot\.is-upgradeable-choice/,
  "the two-column shop, split blacksmith sources, and upgrade highlights must have presentation rules",
);
assert.equal(
  DUNGEON_DEFINITIONS.length,
  7,
  "the hub must offer six recommendations and one boss dungeon",
);
assert.equal(
  (campaignHtml.match(/class="dungeon-contract"/g) ?? []).length,
  7,
  "the initial hub render must show all seven dungeon slots",
);
const recommendedDefinitions = DUNGEON_DEFINITIONS.filter(
  (dungeon) => dungeon.offerKind === "recommended",
);
const offeredDifficulties = recommendedDefinitions
  .map((dungeon) => dungeon.difficulty)
  .sort((a, b) => a - b);
assert.equal(
  recommendedDefinitions.length,
  6,
  "the hub must retain exactly six recommended offers",
);
assert.ok(
  offeredDifficulties.every((difficulty) => difficulty === 1 || difficulty === 2),
  "a new campaign must recommend only F and E dungeons",
);
assert.ok(
  offeredDifficulties.includes(1) && offeredDifficulties.includes(2),
  "initial recommendations must include both F and E",
);
assert.ok(
  recommendedDefinitions.some(
    (dungeon) => dungeon.difficulty === 1 && dungeon.floorCount === 3,
  ),
  "each recommendation set must retain at least one three-floor easy expedition",
);
assert.equal(
  (campaignHtml.match(/class="main-drops"/g) ?? []).length,
  6,
  "the boss card must hide only its recommended-loot preview",
);
for (const dungeon of DUNGEON_DEFINITIONS) {
  assert.match(
    campaignHtml,
    new RegExp(dungeon.nameKo),
    `the hub must list ${dungeon.nameKo}`,
  );
  assert.ok(
    dungeon.mainDropIds.length === 2 &&
      dungeon.mainDropIds.every(
        (itemId) =>
          ITEM_DEFS[itemId] &&
          !["seed", "potion", "stone"].includes(
            ITEM_DEFS[itemId].category,
          ),
      ),
    `${dungeon.nameKo} must advertise exactly two rewards while excluding seeds, potions, and runestones`,
  );
  const featuredEntries = selectMainLootEntries(dungeon.lootPlan);
  assert.deepEqual(
    dungeon.mainDropIds,
    featuredEntries.map((entry) => entry.defId),
    `${dungeon.nameKo} must advertise the exact planned instances selected as main loot`,
  );
  assert.ok(
    featuredEntries.every(
      (entry) =>
        entry.purpose === "majorLoot" && entry.source === "specialReward",
    ),
    `${dungeon.nameKo} must bind advertised instances to special-room reward slots`,
  );
  assert.equal(
    dungeon.difficultyGrade,
    DUNGEON_DIFFICULTY_RULES[dungeon.difficulty].grade,
    `${dungeon.nameKo} must expose the grade assigned by the seven-step rules`,
  );
  assert.ok(
    dungeon.mainDropIds.every((itemId) =>
      dungeon.lootPlan.some((entry) => entry.defId === itemId),
    ),
    `${dungeon.nameKo} must actually contain both advertised main drops`,
  );
  assert.ok(
    dungeon.lootPlan.some((entry) => entry.source === "object"),
    `${dungeon.nameKo} must pre-plan object contents before map generation`,
  );
  assert.ok(
    dungeon.lootPlan.every(
      (entry) => entry.floor >= 1 && entry.floor <= dungeon.floorCount,
    ),
    `${dungeon.nameKo} must assign every planned reward to a valid floor`,
  );
  const plannedRunestones = dungeon.lootPlan.filter(
    (entry) => ITEM_DEFS[entry.defId]?.category === "stone",
  );
  assert.ok(
    Math.abs(plannedRunestones.length - dungeon.floorCount) <= 1 &&
      plannedRunestones.every(
        (entry) => entry.source === "ground" && entry.purpose === "runeStone",
      ),
    `${dungeon.nameKo} must pre-plan about one runestone per floor`,
  );
  assert.ok(
    dungeon.goldPlan.every(
      (entry) =>
        entry.floor >= 1 &&
        entry.floor <= dungeon.floorCount &&
        entry.amount > 0,
    ),
    `${dungeon.nameKo} must assign every positive gold pile to a valid floor`,
  );
  assert.ok(
    dungeon.goldPlan.some((entry) => entry.source === "ground") &&
      dungeon.goldPlan.some((entry) => entry.source === "enemy"),
    `${dungeon.nameKo} must distribute gold between map piles and monster drops`,
  );
  const groundGold = dungeon.goldPlan
    .filter((entry) => entry.source === "ground")
    .reduce((total, entry) => total + entry.amount, 0);
  const enemyGold = dungeon.goldPlan
    .filter((entry) => entry.source === "enemy")
    .reduce((total, entry) => total + entry.amount, 0);
  assert.equal(
    groundGold,
    Math.round(dungeon.goldTarget * 0.3),
    `${dungeon.nameKo} must reserve thirty percent of its gold for map piles`,
  );
  assert.equal(
    dungeon.completionGold,
    Math.round(dungeon.goldTarget * 0.2),
    `${dungeon.nameKo} must reserve twenty percent of its gold for the completion fee`,
  );
  assert.equal(
    enemyGold,
    dungeon.goldTarget - dungeon.completionGold - groundGold,
    `${dungeon.nameKo} must reserve the remaining farming budget for monsters`,
  );
  assert.equal(
    groundGold + enemyGold + dungeon.completionGold,
    DUNGEON_GOLD_TARGETS[dungeon.difficulty],
    `${dungeon.nameKo} full farming plus its completion fee must match the grade budget`,
  );
  const gradeRules = DUNGEON_DIFFICULTY_RULES[dungeon.difficulty];
  assert.ok(
    dungeon.lootPlan
      .filter((entry) => entry.instance)
      .every(
        (entry) =>
          itemGradeIndex(entry.instance?.grade ?? "F") >=
            itemGradeIndex(gradeRules.minimumItemGrade) &&
          itemGradeIndex(entry.instance?.grade ?? "S") <=
            itemGradeIndex(gradeRules.maximumItemGrade),
      ),
    `${dungeon.nameKo} equipment grade must follow its difficulty band`,
  );
  assert.ok(
    dungeon.lootPlan
      .filter((entry) => entry.instance)
      .every(
        (entry) =>
          entry.instance?.traits?.[0]?.grade === entry.instance?.grade,
      ),
    `${dungeon.nameKo} equipment must pre-plan a first enchantment matching its item grade`,
  );
}
assert.equal(
  DUNGEON_GOLD_TARGETS[1],
  1_000,
  "F-grade full farming and completion must total one thousand gold",
);
assert.equal(
  DUNGEON_GOLD_TARGETS[7],
  1_000_000,
  "S-grade full farming and completion must total one million gold",
);
assert.equal(
  DUNGEON_DIFFICULTY_RULES[7].enemyStatMultiplier /
    DUNGEON_DIFFICULTY_RULES[1].enemyStatMultiplier,
  50,
  "S enemy stats must use exactly fifty times the F multiplier",
);
const easiestRat = scaledEnemyStats(
  "rat",
  1,
  DUNGEON_DIFFICULTY_RULES[1].enemyStatMultiplier,
);
const hardestRat = scaledEnemyStats(
  "rat",
  1,
  DUNGEON_DIFFICULTY_RULES[7].enemyStatMultiplier,
);
for (const stat of ["hp", "attack", "defense", "accuracy", "evasion", "xp"] as const) {
  assert.equal(
    hardestRat[stat],
    easiestRat[stat] * 50,
    `S rat ${stat} must be exactly fifty times its F value`,
  );
}
const alternateDungeonOffers = generateDungeonOffers(0x71ac92e4);
assert.notDeepEqual(
  alternateDungeonOffers.map((dungeon) => ({
    themeId: dungeon.themeId,
    difficulty: dungeon.difficulty,
    floorCount: dungeon.floorCount,
    mainDropIds: dungeon.mainDropIds,
  })),
  DUNGEON_DEFINITIONS.map((dungeon) => ({
    themeId: dungeon.themeId,
    difficulty: dungeon.difficulty,
    floorCount: dungeon.floorCount,
    mainDropIds: dungeon.mainDropIds,
  })),
  "a new expedition offer seed must change themes, depths, difficulty placement, or featured loot",
);
assert.doesNotMatch(
  campaignHtml,
  /최고 기록/,
  "random recommendations must not display obsolete per-dungeon best-depth records",
);
assert.match(
  campaignHtml,
  /도감[\s\S]*설정[\s\S]*탐사 안내/,
  "the main hub must expose codex, settings, and exploration-guide controls",
);
assert.match(
  dungeonUiSource,
  /dungeon-drop-grid[\s\S]*setItemPreview[\s\S]*ItemSlotContents/,
  "featured dungeon loot must reuse item slots and open the existing item detail dialog",
);
assert.doesNotMatch(
  campaignHtml,
  /class="game-canvas/,
  "the dungeon canvas must stay unmounted until preparation is confirmed",
);

const campaignWarehouse = createInitialWarehouse();
const fixedSlotSource = [
  "potion_healing",
  "stale-item",
  "potion_healing",
  null,
] as const;
const fixedLiveRefs = ["potion_healing", "ration", "slot-sword"] as const;
const normalizedFixedSlotTest = normalizeFixedSlots(
  fixedSlotSource,
  fixedLiveRefs,
  5,
);
assert.deepEqual(
  normalizedFixedSlotTest,
  ["potion_healing", "ration", "slot-sword", null, null],
  "slot normalization must retain valid positions, remove stale duplicates, and fill empty cells",
);
assert.deepEqual(
  fixedSlotSource,
  ["potion_healing", "stale-item", "potion_healing", null],
  "slot normalization must be a pure helper that never mutates its input",
);
const swapSlotSource = ["potion_healing", null, "slot-sword"] as const;
assert.deepEqual(
  swapFixedSlots(swapSlotSource, 0, 1),
  [null, "potion_healing", "slot-sword"],
  "slot swapping must support moving an item into an empty fixed cell",
);
assert.deepEqual(
  swapSlotSource,
  ["potion_healing", null, "slot-sword"],
  "slot swapping must return a new array without mutating its source",
);

const legacyWarehouseInventory = {
  stacks: { ration: 2, potion_healing: 1, empty_stack: 0 },
  instances: [{ id: "legacy-sword", defId: "sword" }],
};
const migratedStorageSlots = normalizeStorageSlots(legacyWarehouseInventory);
assert.equal(
  migratedStorageSlots.length,
  WAREHOUSE_SLOT_COUNT,
  "a warehouse without saved slots must migrate to the fixed warehouse capacity",
);
assert.deepEqual(
  migratedStorageSlots.filter((itemRef): itemRef is string => Boolean(itemRef)),
  ["ration", "potion_healing", "legacy-sword"],
  "warehouse migration must place every live stack and instance exactly once",
);
assert.equal(
  "slots" in legacyWarehouseInventory,
  false,
  "warehouse slot migration must not mutate a legacy save object",
);
const migratedWarehouse = cloneWarehouse({
  ...legacyWarehouseInventory,
  throwableProfiles: {},
} as Parameters<typeof cloneWarehouse>[0]);
assert.deepEqual(
  migratedWarehouse.slots,
  migratedStorageSlots,
  "campaign warehouse cloning must apply the same migration to saves without slot data",
);

const slotPlayer = createNewGame(0x51075).player;
slotPlayer.inventory = { potion_healing: 2, ration: 1 };
slotPlayer.inventoryInstances = [{ id: "slot-sword", defId: "sword" }];
slotPlayer.autoSlots = ["ration", null, null, null];
slotPlayer.inventorySlots = [
  "slot-sword",
  "stale-item",
  "potion_healing",
  "slot-sword",
];
const playerSlotSource = [...slotPlayer.inventorySlots];
const normalizedPlayerSlots = normalizePlayerInventorySlots(slotPlayer);
assert.equal(
  normalizedPlayerSlots.length,
  MAX_INVENTORY_SLOTS,
  "player inventory normalization must always return the fixed 20-slot grid",
);
assert.deepEqual(
  normalizedPlayerSlots.slice(0, 4),
  ["slot-sword", "ration", "potion_healing", null],
  "player normalization must keep registered stackables visible while removing stale duplicates",
);
assert.equal(
  normalizedPlayerSlots.includes("ration"),
  true,
  "a registered consumable stack must remain in the shared inventory grid",
);
assert.deepEqual(
  slotPlayer.inventorySlots,
  playerSlotSource,
  "player inventory normalization must not mutate the player slot array",
);

campaignWarehouse.instances.push({
  id: "warehouse-sword-1",
  defId: "sword",
  grade: "C",
  upgradeLevel: 2,
  traits: [{ id: "keen", grade: "C" }],
});
const warehouseKnife = campaignWarehouse.instances.find(
  (instance) => instance.defId === "throwing_knife",
)!;
warehouseKnife.durability = 5;
warehouseKnife.maxDurability = 8;
const preparedLoadout = {
  stacks: { potion_healing: 2 },
  instanceIds: ["warehouse-sword-1", warehouseKnife.id],
  slotRefs: [
    warehouseKnife.id,
    null,
    "warehouse-sword-1",
    "potion_healing",
  ],
};
assert.equal(
  selectedLoadoutSlotCount(preparedLoadout),
  3,
  "stack types and individual equipment must each consume one preparation slot",
);
const withdrawn = takeLoadoutFromWarehouse(
  campaignWarehouse,
  preparedLoadout,
);
assert.equal(
  withdrawn.warehouse.stacks.potion_healing,
  1,
  "preparation must remove only the chosen stack quantity from the warehouse",
);
assert.equal(
  withdrawn.warehouse.instances.length,
  0,
  "chosen individual equipment must leave the warehouse exactly once",
);
const preparedPlayer = applyLoadoutToPlayer(
  createNewGame(0xc411).player,
  withdrawn.loadout,
  withdrawn.instances,
);
assert.equal(preparedPlayer.inventory.potion_healing, 2);
assert.equal(preparedPlayer.inventory.throwing_knife ?? 0, 0);
assert.deepEqual(
  preparedPlayer.inventorySlots?.slice(0, 4),
  [warehouseKnife.id, null, "warehouse-sword-1", "potion_healing"],
  "preparation must preserve the selected fixed-slot arrangement in the dungeon bag",
);
assert.deepEqual(
  preparedPlayer.inventoryInstances.find(
    (instance) => instance.id === "warehouse-sword-1",
  )?.traits,
  [{ id: "keen", grade: "C" }],
  "preparation must preserve individual equipment identity and traits",
);
const preparedKnife = preparedPlayer.inventoryInstances.find(
  (instance) => instance.id === warehouseKnife.id,
)!;
assert.deepEqual(
  {
    charges: preparedKnife.charges,
    maxCharges: preparedKnife.maxCharges,
    baseMaxCharges: preparedKnife.baseMaxCharges,
    durability: preparedKnife.durability,
  },
  { charges: 4, maxCharges: 4, baseMaxCharges: 4, durability: 5 },
  "preparation must preserve a throwable equipment instance and its independent charge profile",
);
const sewerRules = DUNGEON_DEFINITIONS.find(
  (dungeon) => dungeon.difficulty === 1 && dungeon.floorCount === 3,
)!;
const soloExpedition = createExpeditionGame(
  0xc412,
  {
    dungeonId: sewerRules.id,
    dungeonName: sewerRules.nameKo,
    maxFloor: sewerRules.floorCount,
    difficultyScale: sewerRules.difficultyScale,
    difficulty: sewerRules.difficulty,
    mainDropIds: sewerRules.mainDropIds,
    lootPlan: sewerRules.lootPlan,
    goldPlan: sewerRules.goldPlan,
  },
  preparedPlayer,
  [],
);
assert.equal(
  soloExpedition.maxFloor,
  3,
  "the easiest dungeon expedition must end on its third floor",
);
assert.equal(
  soloExpedition.companions.length,
  0,
  "choosing no companions must not silently recreate the default pair",
);
let floorAdvanceState = soloExpedition;
for (let floor = 1; floor < sewerRules.floorCount; floor += 1) {
  const advanced = advanceExpeditionFloor(floorAdvanceState);
  assert.equal(advanced.kind, "descended");
  floorAdvanceState = advanced.state;
  assert.equal(floorAdvanceState.floor, floor + 1);
}
const completedAdvance = advanceExpeditionFloor(floorAdvanceState);
assert.equal(
  completedAdvance.kind,
  "completed",
  "the final-floor exit must finish the expedition instead of generating another floor",
);
assert.equal(completedAdvance.state.floor, sewerRules.floorCount);
for (let seed = 1; seed <= 24; seed += 1) {
  let scrollExpedition = createExpeditionGame(
    (seed * 0x9e3779b1) >>> 0,
    {
      dungeonId: sewerRules.id,
      dungeonName: sewerRules.nameKo,
      maxFloor: sewerRules.floorCount,
      difficultyScale: sewerRules.difficultyScale,
      difficulty: sewerRules.difficulty,
      mainDropIds: sewerRules.mainDropIds,
      lootPlan: sewerRules.lootPlan,
    },
    preparedPlayer,
    [],
  );
  const plannedScrolls = plannedDungeonScrollCount(scrollExpedition);
  let spawnedScrolls = 0;
  let advertisedScrolls = 0;
  while (true) {
    const floorScrollIds = [
      ...scrollExpedition.groundItems.map((item) => item.defId),
      ...scrollExpedition.objects.flatMap((object) => object.loot),
    ].filter((itemId) => ITEM_DEFS[itemId]?.category === "scroll");
    spawnedScrolls += floorScrollIds.length;
    advertisedScrolls += floorScrollIds.filter((itemId) =>
      sewerRules.mainDropIds.includes(itemId),
    ).length;
    if (scrollExpedition.floor >= scrollExpedition.maxFloor) break;
    scrollExpedition = descendFloor(scrollExpedition);
  }
  assert.equal(
    plannedScrolls,
    sewerRules.lootPlan.filter(
      (entry) => ITEM_DEFS[entry.defId]?.category === "scroll",
    ).length,
    `seed ${seed} must read the immutable dungeon-wide scroll plan`,
  );
  assert.equal(
    spawnedScrolls,
    plannedScrolls,
    `seed ${seed} must spawn exactly its dungeon-wide scroll budget`,
  );
  assert.ok(
    advertisedScrolls >= 1,
    `seed ${seed} must include the scroll advertised as main dungeon loot`,
  );
}
const collectPlacedDungeonLoot = (mapSeed: number) => {
  let expedition = createExpeditionGame(
    mapSeed,
    {
      dungeonId: sewerRules.id,
      dungeonName: sewerRules.nameKo,
      maxFloor: sewerRules.floorCount,
      difficultyScale: sewerRules.difficultyScale,
      difficulty: sewerRules.difficulty,
      mainDropIds: sewerRules.mainDropIds,
      lootPlan: sewerRules.lootPlan,
    },
    preparedPlayer,
    [],
  );
  const ids: string[] = [];
  while (true) {
    ids.push(
      ...expedition.groundItems.flatMap((item) =>
        item.dungeonLootId ? [item.dungeonLootId] : [],
      ),
      ...expedition.objects.flatMap((object) =>
        (object.lootPlanEntryIds ?? []).flatMap((id) => id ? [id] : []),
      ),
      ...expedition.enemies.flatMap((enemy) =>
        enemy.drop?.id ? [enemy.drop.id] : [],
      ),
    );
    if (expedition.floor >= expedition.maxFloor) break;
    expedition = descendFloor(expedition);
  }
  return ids.sort();
};
const expectedPlannedLootIds = sewerRules.lootPlan
  .map((entry) => entry.id)
  .sort();
assert.deepEqual(
  collectPlacedDungeonLoot(0x3150a1),
  expectedPlannedLootIds,
  "the first map layout must place every pre-generated ground, object, and enemy reward",
);
assert.deepEqual(
  collectPlacedDungeonLoot(0x3150a2),
  expectedPlannedLootIds,
  "changing the map seed must not reroll the dungeon's pre-generated loot list",
);
const collectPlacedDungeonGold = (mapSeed: number) => {
  let expedition = createExpeditionGame(
    mapSeed,
    {
      dungeonId: sewerRules.id,
      dungeonName: sewerRules.nameKo,
      maxFloor: sewerRules.floorCount,
      difficultyScale: sewerRules.difficultyScale,
      difficulty: sewerRules.difficulty,
      mainDropIds: sewerRules.mainDropIds,
      lootPlan: sewerRules.lootPlan,
      goldPlan: sewerRules.goldPlan,
    },
    preparedPlayer,
    [],
  );
  let ground = 0;
  let enemy = 0;
  let runestones = 0;
  while (true) {
    ground += expedition.groundItems
      .filter((item) => item.defId === "gold")
      .reduce((total, item) => total + (item.quantity ?? 0), 0);
    enemy += expedition.enemies.reduce(
      (total, candidate) => total + (candidate.goldDrop ?? 0),
      0,
    );
    runestones += expedition.groundItems.filter(
      (item) => ITEM_DEFS[item.defId]?.category === "stone",
    ).length;
    if (expedition.floor >= expedition.maxFloor) break;
    expedition = descendFloor(expedition);
  }
  return { ground, enemy, runestones };
};
const expectedPlacedGold = {
  ground: sewerRules.goldPlan
    .filter((entry) => entry.source === "ground")
    .reduce((total, entry) => total + entry.amount, 0),
  enemy: sewerRules.goldPlan
    .filter((entry) => entry.source === "enemy")
    .reduce((total, entry) => total + entry.amount, 0),
  runestones: sewerRules.lootPlan.filter(
    (entry) => ITEM_DEFS[entry.defId]?.category === "stone",
  ).length,
};
assert.deepEqual(
  collectPlacedDungeonGold(0x3150a1),
  expectedPlacedGold,
  "the first map layout must place every gold pile, monster drop, and planned runestone",
);
assert.deepEqual(
  collectPlacedDungeonGold(0x3150a2),
  expectedPlacedGold,
  "changing the map seed must move gold without changing the grade budget",
);
const roster = createStarterCompanionRoster(COMPANION_CLASS_IDS);
assert.equal(
  roster[0].classId,
  "adventurer",
  "the former player sprite must enter the roster as an ordinary companion",
);
const selectedLeader = roster[3];
const runtimeLeader = companionToPlayer(selectedLeader);
assert.deepEqual(
  {
    companionId: runtimeLeader.companionId,
    classId: runtimeLeader.classId,
    level: runtimeLeader.level,
    xp: runtimeLeader.xp,
    traits: runtimeLeader.traits,
  },
  {
    companionId: selectedLeader.id,
    classId: selectedLeader.classId,
    level: selectedLeader.level,
    xp: selectedLeader.xp,
    traits: selectedLeader.traits,
  },
  "the first selected companion must become the controlled runtime actor without losing identity or progression",
);
assert.equal(
  playerToCompanion(runtimeLeader).id,
  selectedLeader.id,
  "the controlled runtime actor must return to the same roster identity after an expedition",
);
const wandLeader = createStarterCompanionRoster(["mage"])[0];
const leaderWand = createPlainEquipmentInstance(
  ITEM_DEFS.wand_frost,
  "leader-quickslot-wand",
);
wandLeader.autoSlots[2] = {
  defId: leaderWand.defId,
  quantity: 1,
  instance: leaderWand,
};
const wandRuntimeLeader = companionToPlayer(wandLeader);
assert.equal(
  wandRuntimeLeader.autoSlots[2],
  leaderWand.id,
  "the controlled companion's wand must retain its exact quick-slot reference",
);
assert.ok(
  wandRuntimeLeader.inventoryInstances.some(
    (instance) => instance.id === leaderWand.id,
  ),
  "the runtime actor must carry the hidden wand instance so the quick slot can resolve it",
);
assert.equal(
  inventorySlotCount(wandRuntimeLeader),
  0,
  "quick-slot equipment must stay out of backpack occupancy",
);
const preparedWandLeader = applyLoadoutToPlayer(
  wandRuntimeLeader,
  {
    stacks: {},
    instanceIds: [],
    slotRefs: Array.from({ length: MAX_INVENTORY_SLOTS }, () => null),
  },
  [],
);
assert.equal(
  preparedWandLeader.inventoryInstances.find(
    (instance) => instance.id === leaderWand.id,
  )?.charges,
  leaderWand.charges,
  "preparing an expedition must preserve a leader's equipped wand instance",
);
assert.equal(
  playerToCompanion(preparedWandLeader).autoSlots[2]?.instance?.id,
  leaderWand.id,
  "the equipped wand must return to the same companion instead of entering storage",
);
const duoExpedition = createExpeditionGame(
  0xc413,
  {
    dungeonId: sewerRules.id,
    dungeonName: sewerRules.nameKo,
    maxFloor: sewerRules.floorCount,
    difficultyScale: sewerRules.difficultyScale,
    difficulty: sewerRules.difficulty,
    mainDropIds: sewerRules.mainDropIds,
    lootPlan: sewerRules.lootPlan,
  },
  preparedPlayer,
  roster.slice(2, 4),
);
assert.deepEqual(
  duoExpedition.companions.map((companion) => companion.id),
  roster.slice(2, 4).map((companion) => companion.id),
  "only the two explicitly selected companions may enter the dungeon",
);
preparedPlayer.inventory = {
  potion_healing: 1,
  ration: 1,
  iron_key: 1,
};
preparedKnife.baseMaxCharges = 4;
preparedKnife.maxCharges = 2;
preparedKnife.charges = 1;
preparedKnife.durability = 3;
const depositedCampaign = depositPlayerInventory(
  withdrawn.warehouse,
  preparedPlayer,
);
assert.equal(depositedCampaign.warehouse.stacks.potion_healing, 2);
assert.equal(depositedCampaign.warehouse.stacks.throwing_knife, undefined);
assert.equal(depositedCampaign.warehouse.stacks.ration, 5);
assert.equal(
  depositedCampaign.warehouse.stacks.iron_key,
  undefined,
  "floor keys must never leave the dungeon",
);
const depositedKnife = depositedCampaign.warehouse.instances.find(
  (instance) => instance.id === warehouseKnife.id,
)!;
assert.equal(depositedKnife.durability, 8, "settlement must repair throwable durability after the expedition");
assert.deepEqual(
  {
    charges: depositedKnife.charges,
    maxCharges: depositedKnife.maxCharges,
  },
  { charges: 3, maxCharges: 4 },
  "settlement must repair lost durability without merging the throwable into a type stack",
);
assert.equal(depositedCampaign.recoveredItems, 4);
assert.match(
  dungeonUiSource,
  /uniqueSources = \[\.\.\.new Set\(sources\)\]/,
  "map startup must deduplicate sprite requests before waiting for them",
);
assert.match(
  dungeonUiSource,
  /runtimeImageSource\(src\)/,
  "map startup must resolve critical images from the embedded runtime bundle",
);
assert.match(
  dungeonUiSource,
  /setAssetLoadError[\s\S]*loading-map-detail[\s\S]*다시 불러오기/,
  "asset failures must identify the failed source and expose an explicit retry",
);
assert.match(
  dungeonUiSource,
  /FONT_SCALE_OPTIONS = \[0\.85, 1, 1\.15, 1\.3\]/,
  "settings must expose independent font-size choices",
);
assert.match(
  dungeonUiSource,
  /function ItemDetailModal\(/,
  "inventory clicks must open a dedicated item-detail dialog",
);
assert.match(
  dungeonUiSource,
  /function PreparationScreen\([\s\S]*setItemPreview\([\s\S]*<ItemDetailModal[\s\S]*readOnly/,
  "preparation storage, bag, and equipment clicks must reuse the item-detail dialog",
);
assert.match(
  dungeonUiSource,
  /style=\{\{ left: held\.clientX, top: held\.clientY \}\}/,
  "the held item cursor must use the pointer coordinates without a rightward offset",
);
assert.doesNotMatch(
  dungeonUiSource,
  /held\.clientX \+|held\.clientY \+/,
  "item dragging must not add a fixed cursor offset",
);
assert.match(
  globalStyleSource,
  /\.held-item-cursor \{[\s\S]*transform: translate\(-50%, -50%\) rotate\(2deg\) scale\(1\.04\)/,
  "the item ghost must be centered on the pointer while retaining its drag styling",
);
assert.match(
  dungeonUiSource,
  /\[1, 2, 3, 4, 5, 6, 7\]\.map[\s\S]*difficultyGrade/,
  "dungeon difficulty must render as a seven-cell F-to-S gauge",
);
assert.match(
  dungeonUiSource,
  /developerMode && \([\s\S]*DeveloperDungeonLoot/,
  "developer mode must expose the pre-generated dungeon loot list before entry",
);
assert.match(
  dungeonUiSource,
  /const AUTO_EXPLORATION_ENABLED = false;/,
  "auto-explore must be disabled behind an explicit temporary feature flag",
);
assert.doesNotMatch(
  dungeonUiSource,
  /className="auto-explore-tools"/,
  "disabled auto-explore controls must not remain interactive in the dungeon UI",
);
assert.match(
  dungeonUiSource,
  /className="auto-explore-disabled"[\s\S]*자동탐사 일시 중지/,
  "the dungeon UI must clearly show that auto-explore is temporarily paused",
);
assert.match(
  dungeonUiSource,
  /const startAutoExplore = useCallback\(\(\) => \{\s*if \(!AUTO_EXPLORATION_ENABLED\) return;/,
  "the preserved auto-explore loop must have no callable entry while the feature is paused",
);
assert.doesNotMatch(
  dungeonUiSource,
  /const commandOrder:[\s\S]{0,220}"explore"/,
  "individual companion command cycling must not expose solo auto-exploration",
);
assert.match(
  dungeonUiSource,
  /className="companion-skill-list"[\s\S]*onSkill\(casterId, skillId\)/,
  "each active party member card must expose its two manual skill buttons",
);
assert.match(
  dungeonUiSource,
  /pendingCompanionSkill[\s\S]*activateCompanionSkill\([\s\S]*selectedSkill\.casterId[\s\S]*selectedSkill\.skillId[\s\S]*target/,
  "a selected companion skill must resolve only after the player clicks a map target",
);
assert.match(
  dungeonUiSource,
  /const travelProgress = progress;[\s\S]*const arcProgress = progress;/,
  "all thrown items must use a one-way flight ending on the landing tile",
);
assert.doesNotMatch(
  dungeonUiSource,
  /returnsToSource|RETURNING_THROW_DURATION/,
  "the removed returning-weapon path must not remain in the renderer",
);
assert.match(
  dungeonUiSource,
  /className="throw-prompt skill-target-prompt"[\s\S]*Esc 취소/,
  "manual skill aiming must show the caster, skill, range, and cancel guidance",
);
assert.match(
  dungeonUiSource,
  /mode: "skill",[\s\S]*originActorId: pendingCompanionSkill\.casterId[\s\S]*range: definition\.range/,
  "skill targeting presentation must retain the actual caster and cast range",
);
assert.match(
  dungeonUiSource,
  /mode: "quickslot",[\s\S]*originActorId: pendingQuickslotAim\.ownerId/,
  "companion quickslot targeting presentation must retain the item owner",
);
assert.doesNotMatch(
  dungeonUiSource,
  /className="manual-party-control"|완전 수동 조작/,
  "the removed full-party manual-control mode must not remain in the dungeon UI",
);
const canvasMoveStart = dungeonUiSource.indexOf(
  "const onCanvasMove = useCallback",
);
const canvasPointerDownStart = dungeonUiSource.indexOf(
  "const onCanvasPointerDown = useCallback",
);
const canvasPointerFinishStart = dungeonUiSource.indexOf(
  "const finishCanvasPointer = useCallback",
);
assert.ok(
  canvasMoveStart >= 0 &&
    canvasPointerDownStart > canvasMoveStart &&
    canvasPointerFinishStart > canvasPointerDownStart,
  "canvas drag handlers must remain separately inspectable",
);
const canvasMoveSource = dungeonUiSource.slice(
  canvasMoveStart,
  canvasPointerDownStart,
);
const canvasPointerDownSource = dungeonUiSource.slice(
  canvasPointerDownStart,
  canvasPointerFinishStart,
);
assert.match(
  canvasMoveSource,
  /targeting[\s\S]*pointInBounds\(gameRef\.current, point\)[\s\S]*isTileClickReachable/,
  "aiming hover must accept in-bounds fog tiles while ordinary map input remains vision-limited",
);
assert.ok(
  dungeonRendererSource.indexOf("drawImage(\n            fogTextureCanvas") <
    dungeonRendererSource.indexOf("drawTargetingOverlay(") &&
    dungeonRendererSource.indexOf("drawTargetingOverlay(") <
      dungeonRendererSource.indexOf("pixelEffectBuckets.overlay"),
  "targeting overlays must render after fog and before overlay particles",
);
assert.doesNotMatch(
  canvasMoveSource,
  /context\.(?:save|strokeRect)|screen[XY]\(/,
  "pointer movement must not execute canvas-render-only code before drag routing",
);
assert.match(
  canvasMoveSource,
  /companionDrag\.cursor = local[\s\S]*companionDropPoint\(event\)[\s\S]*const drag = cameraDragRef\.current[\s\S]*cameraRef\.current = clampCamera/,
  "pointer movement must update the companion ghost first and preserve ordinary camera panning as the fallback",
);
assert.match(
  canvasPointerDownSource,
  /companionAtCanvasPoint\(local\)[\s\S]*grabOffset:[\s\S]*cameraDragRef\.current = \{/,
  "a press on the rendered companion sprite must own that drag while every other press starts camera dragging",
);
assert.match(
  dungeonUiSource,
  /companionMapDragRef[\s\S]*setCompanionPriorityTarget/,
  "dragging a companion on the map must commit a highest-priority movement tile",
);
assert.match(
  dungeonUiSource,
  /companionDrag\.cursor\.x - companionDrag\.grabOffset\.x[\s\S]*context\.globalAlpha = 0\.58[\s\S]*assets\.companions\[companion\.classId\]/,
  "an active companion drag must render a translucent sprite under the pointer",
);
assert.doesNotMatch(
  dungeonUiSource,
  /companion-tabs|companion-command|항상 플레이어 동행/,
  "the three party interfaces must remain visible together without owner tabs or command buttons",
);
assert.match(
  dungeonUiSource,
  /<div className="companion-roster">[\s\S]*is-player-loadout[\s\S]*companions\.map\(\(companion\)/,
  "the controlled character and both companions must render in one shared roster",
);
assert.match(
  dungeonUiSource,
  /className="companion-card__identity"[\s\S]*setProfileOwner\([\s\S]*descriptionAnchorFromElement\(event\.currentTarget\)[\s\S]*CompanionInspector/,
  "clicking a party portrait must open an anchored character description",
);
assert.match(
  dungeonUiSource,
  /function DescriptionWindow\([\s\S]*createPortal\([\s\S]*description-window-layer[\s\S]*data-anchor-side/,
  "every explanation must use the shared portal-based description window",
);
assert.match(
  dungeonUiSource,
  /function SkillDescriptionWindow\([\s\S]*<DescriptionWindow[\s\S]*function EffectDescriptionWindow\([\s\S]*<DescriptionWindow[\s\S]*function MapElementInspector\([\s\S]*<DescriptionWindow[\s\S]*function ItemDetailModal\([\s\S]*<DescriptionWindow/,
  "skills, effects, map elements, and items must share one description-window shell",
);
assert.doesNotMatch(
  dungeonUiSource,
  /companion-detail-backdrop|item-detail-layer|status-effect-detail/,
  "legacy centered or panel-trapped explanation layers must be removed",
);
assert.match(
  dungeonUiSource,
  /game-event-feed[\s\S]*latestLogs\.map/,
  "field records must render as a compact in-map text feed",
);
assert.doesNotMatch(
  dungeonUiSource,
  /className="side-card (?:log-card|legend-card)"|시야 판독/,
  "the field-log card and visibility legend must not remain in the side interface",
);
assert.match(
  dungeonUiSource,
  /kind: "groundItem"[\s\S]*kind: "object"[\s\S]*kind: "cloud"[\s\S]*kind: "ward"[\s\S]*kind: "terrain"[\s\S]*kind: "unknown"/,
  "inspection mode must describe items, objects, fields, wards, terrain, and unexplored tiles",
);
assert.match(
  dungeonUiSource,
  /candidates\[\(currentIndex \+ 1\) % candidates\.length\]/,
  "repeated inspection of a stacked tile must cycle through every element",
);
assert.match(
  globalStyleSource,
  /grid-template-columns: 54px repeat\(4, minmax\(0, 1fr\)\)[\s\S]*nth-child\(5\)[\s\S]*grid-column: 4[\s\S]*nth-child\(6\)[\s\S]*grid-column: 5/,
  "party cards must reserve a left portrait column, four gear cells, two skills, and two quickslots",
);
assert.match(
  globalStyleSource,
  /@keyframes screen-reveal[\s\S]*@keyframes modal-panel-in[\s\S]*@keyframes target-prompt-in/,
  "screen changes, dialogs, and targeting prompts must keep their interface transition animations",
);
assert.match(
  dungeonUiSource,
  /item-curse-badge[\s\S]*저주받은 장비/,
  "cursed equipment must be visibly marked in item slots",
);
assert.equal(
  existsSync("app/components/pixel-ui.tsx"),
  false,
  "the discarded pixel UI framework must not remain in the restored interface",
);
assert.doesNotMatch(
  dungeonUiSource,
  /PixelUISurface|pixel-ui/,
  "the game and campaign surfaces must use the original non-pixel interface roots",
);
assert.doesNotMatch(
  globalStyleSource,
  /\.pixel-ui-surface|--pixel-unit|--pixel-slot-size|--pixel-ui-scale/,
  "pixel framework geometry and two-pixel scaling must not affect the original interface",
);
assert.equal(
  resolveItemGrade(ITEM_DEFS.shortsword, {
    id: "f-grade-test",
    defId: "shortsword",
    grade: "F",
  }),
  "F",
  "F equipment must resolve to the brown grade border",
);
assert.equal(
  resolveItemGrade(ITEM_DEFS.shortsword, {
    id: "s-grade-test",
    defId: "shortsword",
    grade: "S",
  }),
  "S",
  "S equipment must use the animated rainbow grade border",
);
assert.match(
  dungeonUiSource,
  /className="item-grade-marker"[\s\S]*data-item-grade=\{grade\}/,
  "every occupied shared item slot must publish its resolved F-S grade without changing its layout",
);
assert.match(
  globalStyleSource,
  /data-item-grade="F"[\s\S]*#8b5a2b[\s\S]*data-item-grade="E"[\s\S]*#ffffff[\s\S]*data-item-grade="D"[\s\S]*#ffffff[\s\S]*data-item-grade="C"[\s\S]*#3b82f6[\s\S]*data-item-grade="B"[\s\S]*#22c55e[\s\S]*data-item-grade="A"[\s\S]*#ef4444[\s\S]*data-item-grade="S"/,
  "item slots must define F brown, E/D white, C blue, B green, A red, and S rainbow grades",
);
assert.match(
  globalStyleSource,
  /item-grade-marker\[data-item-grade="S"\][\s\S]*animation:\s*item-grade-rainbow\s+1800ms\s+linear\s+infinite[\s\S]*@keyframes item-grade-rainbow/,
  "the S border must continuously cycle through the rainbow independently of slot animations",
);
const shortWaitResult = waitTurn(createNewGame(0x5a1711), false);
assert.equal(shortWaitResult.consumedTurn, true);
assert.equal(
  shortWaitResult.interacted,
  false,
  "waiting must advance companion actions without the player's long interaction animation",
);
assert.match(
  dungeonUiSource,
  /offerSeed:\s*nextOfferSeed/,
  "finishing any expedition must replace the dungeon offer cycle",
);
assert.match(
  globalStyleSource,
  /\.fixed-item-slot \.slot-value-badge,[\s\S]*font-size:\s*calc\(10px/,
  "fixed item-slot quantities must remain readable at the compact inventory size",
);
assert.match(
  globalStyleSource,
  /\.preparation-storage-grid\s*\{[\s\S]*repeat\(8,[\s\S]*48px/,
  "the preparation warehouse must use enlarged slots inside its scrollable grid",
);
assert.match(
  globalStyleSource,
  /\.preparation-workspace\s*\{[\s\S]*"inventory party"[\s\S]*"inventory reserve"/,
  "desktop preparation must stack the warehouse below the bag and place party equipment to the right",
);
assert.match(
  globalStyleSource,
  /\.preparation-equipment-roster\.is-active-party\s*\{[\s\S]*grid-template-columns:\s*repeat\(3/,
  "the right-side expedition party must fit three selected companions",
);
assert.match(
  globalStyleSource,
  /\.preparation-equipment-roster\.is-reserve-roster\s*\{[\s\S]*grid-template-columns:\s*repeat\(3/,
  "reserve companions must use the same three-column desktop roster",
);
assert.match(
  dungeonUiSource,
  /campaign-utility-dock[\s\S]*도감[\s\S]*설정[\s\S]*탐사 안내/,
  "preparation and result surfaces must retain the global utility controls",
);
assert.match(
  dungeonUiSource,
  /setCompanionPreview\(\{[\s\S]*companion,[\s\S]*descriptionAnchorFromElement\(event\.currentTarget\)[\s\S]*CompanionInspector/,
  "clicking a preparation portrait must open the shared anchored companion description",
);
assert.match(
  dungeonUiSource,
  /backgroundImage:\s*`url\('\$\{runtimeImageSource\(file\)\}'\)`/,
  "preparation portraits must use the same embedded sprite source as the dungeon renderer",
);
assert.match(
  globalStyleSource,
  /\.prep-companion-portrait-button\s*\{[\s\S]*width:\s*48px;[\s\S]*height:\s*48px;/,
  "preparation portraits must fit both 12×15 companion and 16×24 adventurer frames at integer scale",
);
assert.match(
  dungeonUiSource,
  /동행 원정대 장비[\s\S]*동행하지 않는 동료/,
  "selected party equipment and reserve companions must be separate preparation sections",
);
assert.match(
  mapSource,
  /const ROOM_CLEARANCE = 1;[\s\S]*roomsHaveCornerClearance\(layout\.rooms\)/,
  "map validation must retain one tile of room clearance while allowing a tighter layout",
);
assert.match(
  mapSource,
  /const ATTACHED_ROOM_GAP = 2;[\s\S]*const MAX_CORRIDOR_LENGTH = 48;/,
  "compact floors must keep attached rooms close and reject runaway corridors",
);
assert.match(
  dungeonUiSource,
  /if \(!result\.consumedTurn\) \{[\s\S]*?result\.alchemyOpened[\s\S]*?resolveAction\(result, token\)/,
  "click travel must resolve the workbench's zero-turn UI action before stopping",
);
assert.match(
  dungeonUiSource,
  /tab === "alchemy"[\s\S]*?visibleAlchemyRecipes\.map[\s\S]*?ALCHEMY_ENCHANT_CATALYST_IDS\.map/,
  "the codex must render both item recipes and equipment-enchantment recipes from alchemy data",
);
assert.match(
  dungeonUiSource,
  /motionStartedAt = previousMoveEnd/,
  "late travel timers must continue from the previous tile's exact motion boundary",
);
assert.match(
  dungeonUiSource,
  /useState<CampaignScreen>\("hub"\)/,
  "the browser must now open on the expedition hub rather than minting a dungeon immediately",
);
assert.match(
  dungeonUiSource,
  /createExpeditionGame\([\s\S]*randomDungeonSeed\(\)/,
  "a fresh random dungeon seed must be created only after preparation is confirmed",
);
assert.match(
  dungeonUiSource,
  /context\.rotate\(travelAngle \+ Math\.PI \/ 4\)/,
  "thrown sprites must rotate from their north-east source orientation",
);
assert.doesNotMatch(
  dungeonUiSource,
  /<strong>\{text\("장비 대상", "Loadout Owner"\)\}<\/strong>/,
  "the unified loadout must not show a redundant owner heading",
);
assert.match(
  dungeonUiSource,
  /function PersistentInventory\(/,
  "inventory must render as a persistent equipment-panel section",
);
assert.match(
  dungeonUiSource,
  /id="persistent-inventory"/,
  "keyboard actions must be able to focus the persistent inventory",
);
assert.match(
  dungeonUiSource,
  /pendingQuickslotAim[\s\S]*suggestedTarget[\s\S]*같은 퀵슬롯을 다시 눌러 발사/,
  "the second explicit press of an aimed throwable or wand quickslot must fire",
);
assert.doesNotMatch(
  dungeonUiSource,
  />가방 열기</,
  "the action deck must not require a bag-open button",
);
assert.doesNotMatch(
  dungeonUiSource,
  /<span>\{zoomPercent\}%<\/span>/,
  "the map toolbar must not show a zoom-percentage label",
);
assert.match(
  dungeonUiSource,
  /const stacked = Object\.entries\(game\.player\.inventory\)[\s\S]*\.filter\(\(\[, quantity\]\) => quantity > 0\)/,
  "stackable items must remain visible in inventory after quick-slot registration",
);
assert.match(
  dungeonUiSource,
  /pendingActivationRef[\s\S]*onFastUse\(selection\.itemRef\)[\s\S]*onFastEquip\(selection\.itemRef\)[\s\S]*}, 240\)/,
  "a fast second inventory click must use usable items or begin equipment placement",
);
assert.match(
  dungeonUiSource,
  /const openOrUnequip[\s\S]*pending\?\.key === key[\s\S]*onUnequip\(\)[\s\S]*}, 240\)/,
  "a fast second click on occupied player or companion equipment must unequip it",
);
assert.match(
  dungeonUiSource,
  /itemId === "scroll_upgrade"[\s\S]*setPendingUpgradeScrollRef\(itemRef\)/,
  "using an upgrade scroll must enter equipment-target selection",
);
assert.doesNotMatch(
  dungeonUiSource,
  /function UpgradeTargetModal\(/,
  "upgrade-scroll targeting must not open a separate replacement loadout dialog",
);
assert.match(
  dungeonUiSource,
  /upgradeMode=\{Boolean\(pendingUpgradeScrollRef\)\}[\s\S]*onUpgradePlayer=\{upgradePlayerLoadout\}/,
  "the existing player and companion loadout must become the upgrade target surface",
);
assert.ok(
  (dungeonUiSource.match(/<ItemSlotContents/g) ?? []).length >= 3,
  "inventory and both player and companion loadouts must share one item-slot renderer",
);
assert.match(
  dungeonUiSource,
  /\{charges\}\/\{maxCharges\}/,
  "shared wand slots must show current and maximum charge together",
);
assert.match(
  dungeonUiSource,
  /className="item-stat-gauges"/,
  "upgradeable item details must render stat gauges",
);
assert.match(
  globalStyleSource,
  /font-size: calc\([^;]+var\(--font-scale, 1\)\)/,
  "the selected font scale must affect interface typography independently",
);
assert.match(
  globalStyleSource,
  /font-family:\s*"MonaGame"[\s\S]*Mona10x12\.woff2/,
  "the interface must self-host the requested Mona font",
);
assert.doesNotMatch(
  dungeonUiSource,
  /PixelGame/,
  "canvas text must not retain the replaced legacy font family",
);
assert.equal(
  statSync("public/assets/fonts/Mona10x12.woff2").size,
  166564,
  "the pinned Mona webfont asset must remain available offline",
);
assert.match(
  globalStyleSource,
  /\.companion-loadout\s*\{[\s\S]*?grid-template-columns:\s*repeat\(6,/,
  "player and companion loadouts must each render exactly six shared slots",
);
assert.match(
  globalStyleSource,
  /\.item-trait-panel ul\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/,
  "each enchantment must occupy its own full-width row",
);
assert.match(
  dungeonUiSource,
  /useState<UiLanguage>\("ko"\)/,
  "the interface language must default to Korean",
);
assert.match(
  dungeonUiSource,
  /window\.localStorage\.setItem\(\s*LANGUAGE_STORAGE_KEY/,
  "the selected interface language must persist locally",
);
assert.match(
  dungeonUiSource,
  /definition\.slot \|\| definition\.category === "missile"/,
  "double-click equipment placement must include individual throwable equipment",
);
assert.match(
  dungeonUiSource,
  /LEVEL_UP_EFFECT_HOLD = 420/,
  "the augment choice must appear shortly after the level-up effect begins",
);
assert.match(
  dungeonUiSource,
  /className="item-upgrade-badge"/,
  "upgradeable inventory and equipment items must expose a top-left upgrade badge",
);
assert.match(
  globalStyleSource,
  /\.inventory-item-icon \.item-quantity-badge\s*\{[\s\S]*?border:\s*0;/,
  "inventory quantity labels must not draw a border",
);
assert.match(
  globalStyleSource,
  /\.item-upgrade-badge\s*\{[\s\S]*?text-shadow:/,
  "upgrade labels must use borderless pixel text",
);

const heldSignal = {
  holdUntilTurnEnd: true,
  releasedAt: undefined as number | undefined,
};
releaseHeldSignalsAtTurnStart([heldSignal], 500);
assert.equal(
  heldSignal.releasedAt,
  500,
  "a wake alert from the previous turn must release at the next turn start",
);
releaseHeldSignalsAtTurnStart([heldSignal], 900);
assert.equal(
  heldSignal.releasedAt,
  500,
  "a fading held alert must never have its release time restarted",
);
const currentTurnSignal = {
  holdUntilTurnEnd: true,
  releasedAt: undefined as number | undefined,
};
assert.equal(
  currentTurnSignal.releasedAt,
  undefined,
  "a signal added after the turn-start release pass must stay held",
);

assert.deepEqual(
  [...PLAYER_ATTACK_FRAMES],
  [8, 9, 10, 11],
  "the first four frames on row two must be the attack animation",
);
assert.deepEqual(
  [...PLAYER_INTERACT_FRAMES],
  [12, 13, 14, 15],
  "the last four frames on row two must be the interaction animation",
);
assert.equal(
  ENEMY_DROP_TABLE.reduce((total, entry) => total + entry.weight, 0),
  1,
  "enemy drop-table weights must add up to 100%",
);
assert.equal(
  ENEMY_DROP_CHANCE,
  0.28,
  "the inspector must report the engine's real overall drop chance",
);
assert.ok(
  Object.keys(ITEM_DEFS).length >= 170,
  "the compendium and loot pool should contain the full expanded Shattered item catalog",
);
assert.ok(
  Object.values(ITEM_DEFS).every(
    ({ sprite }) => Number.isInteger(sprite) && sprite >= 0 && sprite < 512,
  ),
  "every catalog item must address a valid frame in the 256x512 item sheet",
);
const expectedOriginalSprites: Record<string, number> = {
  dagger: 100,
  longsword: 120,
  greatsword: 128,
  throwing_stone: 147,
  wand_magic_missile: 208,
  ring_accuracy: 224,
  cloak_of_shadows: 240,
  scroll_remove_curse: 306,
  stone_blink: 340,
  seed_firebloom: 385,
  brew_infernal: 400,
  small_ration: 437,
  bomb: 80,
  ankh: 48,
  pickaxe: 468,
};
Object.entries(expectedOriginalSprites).forEach(([itemId, sprite]) => {
  assert.equal(
    ITEM_DEFS[itemId]?.sprite,
    sprite,
    `${itemId} must use its original ItemSpriteSheet frame`,
  );
});

assert.equal(
  durationForMotion({
    id: "player",
    from: { x: 1, y: 1 },
    to: { x: 2, y: 1 },
    kind: "move",
  }),
  PLAYER_MOVE_DURATION,
  "player movement should use the shortened movement duration",
);
assert.equal(
  PLAYER_MOVE_DURATION,
  123,
  "player travel animation should resolve 1.3 times faster than 160ms",
);
assert.equal(
  durationForMotion({
    id: "player",
    from: { x: 1, y: 1 },
    to: { x: 4, y: 1 },
    kind: "move",
    travelStyle: "leap",
  }),
  SKILL_LEAP_DURATION,
  "leap motions must use their own aerial timing",
);
assert.equal(
  durationForMotion({
    id: "player",
    from: { x: 1, y: 1 },
    to: { x: 4, y: 1 },
    kind: "move",
    travelStyle: "teleport",
  }),
  SKILL_TELEPORT_DURATION,
  "teleports must use a disappearance/reappearance timing",
);
assert.equal(
  durationForMotion({
    id: "player",
    from: { x: 1, y: 1 },
    to: { x: 4, y: 1 },
    kind: "move",
    travelStyle: "charge",
  }),
  SKILL_CHARGE_DURATION,
  "charges must retain a fast ground-travel timing",
);
assert.deepEqual(
  [
    impactDelayForMotion({
      id: "player",
      from: { x: 1, y: 1 },
      to: { x: 4, y: 1 },
      kind: "move",
      travelStyle: "leap",
    }),
    impactDelayForMotion({
      id: "player",
      from: { x: 1, y: 1 },
      to: { x: 4, y: 1 },
      kind: "move",
      travelStyle: "teleport",
    }),
    impactDelayForMotion({
      id: "player",
      from: { x: 1, y: 1 },
      to: { x: 4, y: 1 },
      kind: "move",
      travelStyle: "charge",
    }),
  ],
  [
    SKILL_LEAP_DURATION - 10,
    SKILL_TELEPORT_DURATION * 0.62,
    SKILL_CHARGE_DURATION - 10,
  ],
  "combat feedback must resolve at the same landing/reappearance timing as skill particles",
);
assert.equal(
  COMPANION_MOVE_DURATION,
  PLAYER_MOVE_DURATION,
  "companion movement must not extend a clean player travel turn",
);
assert.equal(
  PLAYER_ATTACK_DURATION,
  60,
  "the player attack animation must use the requested 60ms timing",
);
assert.equal(
  PLAYER_PICKUP_DURATION,
  50,
  "floor-item pickup should use the requested 50ms interaction",
);
assert.equal(
  PLAYER_INTERACTION_DURATION,
  360,
  "interaction animation must use the requested 360ms timing",
);
assert.ok(
  PLAYER_INTERACTION_DURATION > PLAYER_ATTACK_DURATION,
  "interaction timing must not be swapped with attack timing",
);

const sequentialAttackTimeline = createTurnMotionTimeline(
  [
    {
      id: "moving-enemy",
      from: { x: 1, y: 1 },
      to: { x: 2, y: 1 },
      kind: "move",
    },
    {
      id: "first-attacker",
      from: { x: 3, y: 1 },
      to: { x: 2, y: 1 },
      kind: "attack",
    },
    {
      id: "second-attacker",
      from: { x: 2, y: 2 },
      to: { x: 2, y: 1 },
      kind: "attack",
    },
  ],
  PLAYER_INTERACTION_DURATION,
);
const scheduledMove = sequentialAttackTimeline.motions[0];
const firstScheduledAttack = sequentialAttackTimeline.motions[1];
const secondScheduledAttack = sequentialAttackTimeline.motions[2];
assert.equal(scheduledMove.duration, ENEMY_MOVE_DURATION);
assert.equal(scheduledMove.delay, 0, "movement should begin in the first phase");
assert.equal(
  firstScheduledAttack.delay,
  PLAYER_INTERACTION_DURATION + ATTACK_START_DELAY,
  "attacks must wait for movement and interaction plus a short pause",
);
assert.equal(
  secondScheduledAttack.delay,
  firstScheduledAttack.delay +
    ENEMY_ATTACK_DURATION +
    ATTACK_SEQUENCE_GAP,
  "multiple attacks in one turn must animate sequentially",
);

const reachableCells = (
  tiles: ReturnType<typeof createNewGame>["tiles"],
  start: { x: number; y: number },
  canUnlock: boolean,
) => {
  const reached = new Set([pointKey(start.x, start.y)]);
  const queue = [start];
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    directions.forEach(([dx, dy]) => {
      const x = point.x + dx;
      const y = point.y + dy;
      const key = pointKey(x, y);
      if (
        !tiles[y]?.[x] ||
        reached.has(key) ||
        !isWalkable(tiles[y][x].terrain, canUnlock)
      ) {
        return;
      }
      reached.add(key);
      queue.push({ x, y });
    });
  }
  return reached;
};

const assertDoorTopology = (
  tiles: ReturnType<typeof createNewGame>["tiles"],
  seed: number,
) => {
  tiles.forEach((row, y) =>
    row.forEach((tile, x) => {
      if (!["door", "lockedDoor"].includes(tile.terrain)) return;
      const walkable = (testX: number, testY: number) =>
        Boolean(
          tiles[testY]?.[testX] &&
            isWalkable(tiles[testY][testX].terrain, true),
        );
      const wall = (testX: number, testY: number) =>
        tiles[testY]?.[testX]?.terrain === "wall";
      const horizontal =
        walkable(x - 1, y) &&
        walkable(x + 1, y) &&
        wall(x, y - 1) &&
        wall(x, y + 1);
      const vertical =
        walkable(x, y - 1) &&
        walkable(x, y + 1) &&
        wall(x - 1, y) &&
        wall(x + 1, y);
      assert.notEqual(
        horizontal,
        vertical,
        `seed ${seed} door ${x},${y} must occupy exactly one valid tunnel axis`,
      );
    }),
  );
};

const assertNoDiagonalOpenings = (
  tiles: ReturnType<typeof createNewGame>["tiles"],
  seed: number,
) => {
  for (let y = 0; y < tiles.length - 1; y += 1) {
    for (let x = 0; x < tiles[0].length - 1; x += 1) {
      const open = [
        isWalkable(tiles[y][x].terrain, true),
        isWalkable(tiles[y][x + 1].terrain, true),
        isWalkable(tiles[y + 1][x].terrain, true),
        isWalkable(tiles[y + 1][x + 1].terrain, true),
      ];
      const diagonalOnly =
        (open[0] && open[3] && !open[1] && !open[2]) ||
        (open[1] && open[2] && !open[0] && !open[3]);
      assert.equal(
        diagonalOnly,
        false,
        `seed ${seed} must not leave a diagonal-only opening at ${x},${y}`,
      );
    }
  }
};

const game = createNewGame(0x5a17c0de);
assert.equal(
  game.width,
  game.tiles[0].length,
  "the generated state width must follow the normalized room bounds",
);
assert.equal(
  game.height,
  game.tiles.length,
  "the generated state height must follow the normalized room bounds",
);
const waterVisualGame = createNewGame(0x7a7e12);
const waterCenter = {
  x: waterVisualGame.player.x,
  y: waterVisualGame.player.y,
};
waterVisualGame.tiles[waterCenter.y][waterCenter.x].terrain = "water";
[
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
].forEach(([dx, dy]) => {
  waterVisualGame.tiles[waterCenter.y + dy][waterCenter.x + dx].terrain =
    "water";
});
assert.equal(
  terrainVisual(waterVisualGame, waterCenter.x, waterCenter.y),
  32,
  "water surrounded by water must use Shattered's unedged base frame",
);
[
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
].forEach(([dx, dy]) => {
  waterVisualGame.tiles[waterCenter.y + dy][waterCenter.x + dx].terrain =
    "floor";
});
assert.equal(
  terrainVisual(waterVisualGame, waterCenter.x, waterCenter.y),
  47,
  "water surrounded by ground must set all four original stitch bits",
);
const isolatedWaterSurfaceRows = waterSurfaceMaskRows(
  waterVisualGame,
  waterCenter.x,
  waterCenter.y,
);
assert.equal(
  isolatedWaterSurfaceRows[0],
  0,
  "an isolated puddle ripple must exclude the square tile's top bank",
);
assert.equal(
  Boolean(isolatedWaterSurfaceRows[8] & (1 << 8)),
  true,
  "an isolated puddle ripple must retain the open water in the tile center",
);
waterVisualGame.tiles[waterCenter.y][waterCenter.x].terrain = "highGrass";
waterVisualGame.tiles[waterCenter.y][waterCenter.x].variant = 20;
assert.equal(
  terrainVisual(waterVisualGame, waterCenter.x, waterCenter.y),
  122,
  "untouched sewer high grass must use the combined floor-and-bush frame",
);
assert.equal(
  SEWER_TILE_FRAMES.raisedHighGrassAlt,
  125,
  "alternate high grass must stay on the original combined atlas frame",
);
assert.deepEqual(
  [
    waterPatternFrame(0, 0),
    waterPatternFrame(1, 0),
    waterPatternFrame(0, 1),
    waterPatternFrame(1, 1),
  ],
  [0, 1, 2, 3],
  "the original 32px water texture must repeat as a connected 2x2 tile skin",
);
assert.equal(
  WATER_SCROLL_PIXELS_PER_SECOND,
  5,
  "the sewer water skin must scroll at Shattered's original five pixels per second",
);
assert.deepEqual(
  waterTextureSlices(0, 0, 200),
  [
    {
      sourceX: 0,
      sourceY: 1,
      sourceHeight: 16,
      destinationY: 0,
    },
  ],
  "water texture sampling must move by one source pixel after 200ms",
);
assert.deepEqual(
  waterTextureSlices(0, 1, 200),
  [
    {
      sourceX: 0,
      sourceY: 17,
      sourceHeight: 15,
      destinationY: 0,
    },
    {
      sourceX: 0,
      sourceY: 0,
      sourceHeight: 1,
      destinationY: 15,
    },
  ],
  "animated water must wrap seamlessly across the repeating 32px texture",
);
assert.equal(
  fileHash("public/assets/environment/tiles_sewers.png"),
  "b4f63a68f81f6375f70ab95d9f51ad5959ae1ca1f6071b3c3b8c859d8913d48c",
  "the sewer atlas must remain byte-identical to Shattered v3.3.8",
);
assert.equal(
  fileHash("public/assets/environment/water0.png"),
  "4d50a06e9381824d50495c6df332c4644349021693cdbceef1a80f25ffae9202",
  "the repeated sewer-water skin must remain byte-identical to Shattered v3.3.8",
);
assert.equal(
  fileHash("public/assets/sounds/water.mp3"),
  "b6d321f079c99ac01c383ffbf19ad9faf7e1f113a0082307bd2bc7f1a739b3cf",
  "water footsteps must use Shattered v3.3.8's original water sound",
);
for (const visibility of [
  { visible: true, discovered: true },
  { visible: false, discovered: true },
  { visible: false, discovered: false },
]) {
  assert.deepEqual(
    terrainUnderlayForPixelFog(visibility),
    { draw: true, alpha: 1 },
    "terrain beneath pixel fog must never add a tile-aligned visibility layer",
  );
}
const partialWallFog = fogMasksForTile(
  {
    terrain: "wall",
    visible: true,
    discovered: true,
    visibleMask: 1,
    discoveredMask: 5,
    variant: 0,
  },
  SEWER_TILE_FRAMES.wallInternal,
);
assert.deepEqual(
  partialWallFog,
  { visibleMask: 1, discoveredMask: 5 },
  "walls must preserve quarter-tile fog silhouettes",
);
for (const terrain of ["highGrass", "door", "water", "floor"] as const) {
  assert.deepEqual(
    fogMasksForTile(
      {
        terrain,
        visible: true,
        discovered: true,
        visibleMask: 1,
        discoveredMask: 5,
        variant: 0,
      },
      terrain === "highGrass"
        ? SEWER_TILE_FRAMES.raisedHighGrass
        : SEWER_TILE_FRAMES.floor,
    ),
    { visibleMask: 15, discoveredMask: 15 },
    `${terrain} must reveal and remember as one complete tile`,
  );
}
assert.equal(
  usesQuadrantFogForFrame(16 * 9),
  true,
  "atlas row 10 must use quarter-tile fog",
);
assert.equal(
  usesQuadrantFogForFrame(16 * 14 - 1),
  true,
  "the final frame of atlas row 14 must use quarter-tile fog",
);
assert.equal(
  usesQuadrantFogForFrame(16 * 9 - 1),
  false,
  "atlas row 9 must use whole-tile fog",
);
assert.equal(
  usesQuadrantFogForFrame(16 * 14),
  false,
  "atlas row 15 must use whole-tile fog",
);
assert.equal(
  SEWER_TILE_FRAMES.water,
  32,
  "one-based DungeonTileSheet.xy conversion must not regress by +17",
);
assert.ok(
  game.tiles.flat().some(
    (tile) => tile.visibleMask > 0 && tile.visibleMask < 15,
  ),
  "field-of-view edges should resolve at quarter-tile granularity",
);
assert.ok(
  game.tiles.flat().every(
    (tile) =>
      tile.visibleMask >= 0 &&
      tile.visibleMask <= 15 &&
      tile.discoveredMask >= 0 &&
      tile.discoveredMask <= 15,
  ),
  "quarter-fog masks must stay within four bits",
);
const lockedDoors = game.tiles.flatMap((row, y) =>
  row.flatMap((tile, x) => (tile.terrain === "lockedDoor" ? [{ x, y }] : [])),
);

assert.equal(lockedDoors.length, 1, "one locked door should be generated");
assert.equal(
  game.groundItems.filter((item) => item.defId === "iron_key").length,
  1,
  "one matching key should be generated",
);
assert.ok(
  game.tiles.flat().some((tile) => tile.discovered),
  "the starting field of view should be revealed",
);
assert.ok(
  game.tiles.flat().some((tile) => !tile.discovered),
  "unexplored cells should remain hidden",
);
assert.ok(
  game.enemies.every(
    (enemy) => enemy.sleeping && enemy.wakeCooldown === 0,
  ),
  "every generated enemy must begin asleep",
);
const farmingObjects = game.objects.filter(
  (object) => object.kind !== "alchemy",
);
assert.ok(
  farmingObjects.length <= 2 &&
    farmingObjects.every(
      (object) =>
        !object.looted &&
        object.loot.length === 1 &&
        FLOOR_EQUIPMENT_CATEGORIES.includes(
          ITEM_DEFS[object.loot[0]].category as (typeof FLOOR_EQUIPMENT_CATEGORIES)[number],
        ),
    ),
  "reduced-loot floors may omit farming objects, but every spawned object must hold one equipment item",
);
assert.equal(
  game.objects.filter((object) => object.kind === "alchemy").length,
  1,
  "each generated floor must include one reusable alchemy workbench",
);
assert.ok(
  getEnemyWakeChance(1) > getEnemyWakeChance(4) &&
    getEnemyWakeChance(4) > getEnemyWakeChance(8),
  "nearby visible players must wake enemies more easily than distant players",
);

const lockedDoor = lockedDoors[0];
const adjacent = [
  { x: lockedDoor.x + 1, y: lockedDoor.y },
  { x: lockedDoor.x - 1, y: lockedDoor.y },
  { x: lockedDoor.x, y: lockedDoor.y + 1 },
  { x: lockedDoor.x, y: lockedDoor.y - 1 },
].find(
  (point) =>
    game.tiles[point.y]?.[point.x] &&
    isWalkable(game.tiles[point.y][point.x].terrain, false),
);
assert.ok(adjacent, "locked door should have a walkable approach");

game.player.x = adjacent.x;
game.player.y = adjacent.y;
delete game.player.inventory.iron_key;
const blocked = playerStep(
  game,
  lockedDoor.x - adjacent.x,
  lockedDoor.y - adjacent.y,
);
assert.equal(blocked.consumedTurn, false, "a locked door must reject a keyless move");
assert.equal(
  blocked.state.tiles[lockedDoor.y][lockedDoor.x].terrain,
  "lockedDoor",
  "a rejected locked door must stay locked",
);
assert.deepEqual(
  { x: blocked.state.player.x, y: blocked.state.player.y },
  adjacent,
  "the player must stay outside a locked door without a key",
);

blocked.state.player.inventory.iron_key = 1;
const unlocked = playerStep(
  blocked.state,
  lockedDoor.x - adjacent.x,
  lockedDoor.y - adjacent.y,
);
assert.equal(unlocked.consumedTurn, true, "unlocking should consume a turn");
assert.equal(
  unlocked.state.tiles[lockedDoor.y][lockedDoor.x].terrain,
  "openDoor",
  "the door should become open after consuming a key",
);
assert.equal(
  unlocked.state.player.inventory.iron_key ?? 0,
  0,
  "the matching key should be consumed",
);
assert.equal(
  unlocked.interacted,
  true,
  "unlocking should play the interaction animation",
);
assert.deepEqual(
  { x: unlocked.state.player.x, y: unlocked.state.player.y },
  adjacent,
  "unlocking must leave the player in front of the door",
);
assert.equal(
  unlocked.motions.length,
  0,
  "unlocking must not move through the door in the same turn",
);
assert.equal(
  unlocked.presentationState?.tiles[lockedDoor.y][lockedDoor.x].terrain,
  "lockedDoor",
  "the locked door must remain closed until interaction animation completes",
);
assert.equal(
  unlocked.presentationState?.player.inventory.iron_key,
  1,
  "the key must remain visible until interaction animation completes",
);

const enteredUnlockedDoor = playerStep(
  unlocked.state,
  lockedDoor.x - adjacent.x,
  lockedDoor.y - adjacent.y,
);
assert.deepEqual(
  {
    x: enteredUnlockedDoor.state.player.x,
    y: enteredUnlockedDoor.state.player.y,
  },
  lockedDoor,
  "the player may enter the open door on the following turn",
);

const blockedTargetGame = createNewGame(0xb10c);
blockedTargetGame.tiles.forEach((row) =>
  row.forEach((tile) => {
    tile.terrain = "wall";
  }),
);
blockedTargetGame.player.x = 10;
blockedTargetGame.player.y = 10;
blockedTargetGame.enemies = [];
blockedTargetGame.groundItems = [];
delete blockedTargetGame.player.inventory.iron_key;
for (let x = 10; x <= 12; x += 1) {
  blockedTargetGame.tiles[10][x].terrain = "floor";
}
assert.deepEqual(
  pathTo(blockedTargetGame, { x: 13, y: 10 }),
  [
    { x: 11, y: 10 },
    { x: 12, y: 10 },
  ],
  "clicking a wall should route to its nearest reachable adjacent tile",
);

blockedTargetGame.tiles[10][13].terrain = "lockedDoor";
assert.deepEqual(
  pathTo(blockedTargetGame, { x: 13, y: 10 }),
  [
    { x: 11, y: 10 },
    { x: 12, y: 10 },
  ],
  "clicking a locked door without a key should stop immediately in front of it",
);

unlocked.state.player.inventory.shortsword = 1;
const equipmentTurn = equipItem(unlocked.state, "shortsword");
assert.equal(equipmentTurn.consumedTurn, true, "equipment changes should consume a turn");
assert.equal(
  equipmentTurn.state.player.equipment.weapon,
  "shortsword",
  "the selected backpack weapon should become equipped",
);
assert.equal(
  equipmentTurn.state.player.inventory.shortsword ?? 0,
  0,
  "equipped items must leave the backpack inventory",
);
assert.equal(
  equipmentTurn.state.player.inventoryInstances.filter(
    (instance) => instance.defId === "rusty_sword",
  ).length,
  1,
  "the replaced weapon should return as its own backpack instance",
);
assert.equal(
  equipmentTurn.presentationState?.player.equipment.weapon,
  "rusty_sword",
  "equipment results must remain hidden until interaction completes",
);
const unequippedWeapon = unequipSlot(equipmentTurn.state, "weapon");
assert.equal(unequippedWeapon.state.player.equipment.weapon, null);
assert.equal(
  unequippedWeapon.state.player.inventoryInstances.filter(
    (instance) => instance.defId === "shortsword",
  ).length,
  1,
  "unequipped gear should occupy one independent inventory slot",
);

const sequenceRandom = (values: number[]) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};
const weakSwordInstance = createEquipmentInstance(
  ITEM_DEFS.shortsword,
  "rolled-weak-sword",
  sequenceRandom([0.99]),
  { grade: "F", allowCurse: false, preferredFirstTrait: "swift" },
);
const strongSwordInstance = createEquipmentInstance(
  ITEM_DEFS.shortsword,
  "rolled-strong-sword",
  sequenceRandom([0.99]),
  { grade: "S", allowCurse: false, preferredFirstTrait: "swift" },
);
assert.equal(weakSwordInstance.grade, "F");
assert.equal(strongSwordInstance.grade, "S");
const weakSwordAttack = equipmentStatProfile(
  ITEM_DEFS.shortsword,
  weakSwordInstance,
).attack;
const strongSwordAttack = equipmentStatProfile(
  ITEM_DEFS.shortsword,
  strongSwordInstance,
).attack;
assert.ok(
  Math.abs(
    strongSwordAttack / weakSwordAttack - itemGradeMultiplier("S"),
  ) < 0.001,
  "equipment base stats must compound by exactly twenty percent at every F-S step",
);
for (const [index, grade] of ITEM_GRADES.entries()) {
  const current = createEquipmentInstance(
    ITEM_DEFS.shortsword,
    `grade-${grade}-sword`,
    sequenceRandom([0.99]),
    { grade, allowCurse: false, preferredFirstTrait: "swift" },
  );
  assert.equal(
    current.traits?.[0]?.grade,
    grade,
    `${grade} equipment must spawn with a first enchantment of the same grade`,
  );
  if (index > 0) {
    const previous = createEquipmentInstance(
      ITEM_DEFS.shortsword,
      `grade-${ITEM_GRADES[index - 1]}-comparison`,
      sequenceRandom([0.99]),
      {
        grade: ITEM_GRADES[index - 1],
        allowCurse: false,
        preferredFirstTrait: "swift",
      },
    );
    const currentAttack = equipmentStatProfile(ITEM_DEFS.shortsword, current).attack;
    const previousAttack = equipmentStatProfile(
      ITEM_DEFS.shortsword,
      previous,
    ).attack;
    assert.ok(
      Math.abs(currentAttack / previousAttack - 1.2) < 0.005,
      `${grade} base attack must be twenty percent stronger than the preceding grade`,
    );
  }
}
ITEM_GRADES.forEach((grade, index) => {
  assert.equal(
    enchantmentGradePower(grade),
    2 ** index,
    `${grade} enchantments must be exactly twice as strong as the preceding grade`,
  );
});
assert.equal(enchantmentGradePower("F"), 1);
assert.equal(enchantmentGradePower("S"), 64);
const fEnchantChances = enchantmentGradeChances("F");
const sEnchantChances = enchantmentGradeChances("S");
assert.equal(fEnchantChances.S, 0.002);
assert.equal(sEnchantChances.S, 0.1);
for (const itemGrade of ITEM_GRADES) {
  const chances = enchantmentGradeChances(itemGrade);
  assert.ok(
    ITEM_GRADES.slice(1).every(
      (grade, index) => chances[ITEM_GRADES[index]] >= chances[grade],
    ),
    `${itemGrade} equipment must always make higher enchantment grades no more common than lower grades`,
  );
}
assert.ok(
  ITEM_GRADES.slice(1).every(
    (grade, index) =>
      enchantmentGradeChances(ITEM_GRADES[index]).S <=
      enchantmentGradeChances(grade).S,
  ),
  "S enchantments must become progressively more likely as item grade rises",
);
assert.equal(rollEnchantmentGrade("F", () => 0.999), "S");
const migratedLegacyEquipment = normalizeEquipmentInstance(
  {
    id: "legacy-quality-five",
    defId: "shortsword",
    quality: 5,
    traits: [{ id: "keen", rank: 2 }],
  } as unknown as InventoryInstance,
  ITEM_DEFS.shortsword,
);
assert.equal(migratedLegacyEquipment.grade, "S");
assert.equal(migratedLegacyEquipment.traits?.[0]?.grade, "S");
assert.equal(
  Object.hasOwn(migratedLegacyEquipment, "quality"),
  false,
  "legacy numeric quality and ranked enchantments must migrate to the F-S model on load",
);
const additionalEnchantInstance = createEquipmentInstance(
  ITEM_DEFS.shortsword,
  "additional-enchant-grade",
  sequenceRandom([0.99]),
  { grade: "F", allowCurse: false, preferredFirstTrait: "swift" },
);
enchantEquipmentInstance(
  additionalEnchantInstance,
  ITEM_DEFS.shortsword,
  () => 0.999,
  "keen",
);
assert.deepEqual(
  additionalEnchantInstance.traits?.map((trait) => trait.grade),
  ["F", "S"],
  "the first enchantment must match the item while later enchantments use the item-grade probability curve",
);
const fKeenSummary = equipmentTraitSummary({
  id: "f-keen",
  defId: "shortsword",
  grade: "F",
  traits: [{ id: "keen", grade: "F" }],
})[0];
const sKeenSummary = equipmentTraitSummary({
  id: "s-keen",
  defId: "shortsword",
  grade: "S",
  traits: [{ id: "keen", grade: "S" }],
})[0];
assert.ok(
  fKeenSummary.power === 1 &&
    sKeenSummary.power === 64 &&
    fKeenSummary.description.includes("+1") &&
    sKeenSummary.description.includes("+64"),
  "keen enchantments must display and apply the exact F +1 through S +64 sequence",
);
const gradeStableUpgrade = createEquipmentInstance(
  ITEM_DEFS.shortsword,
  "grade-stable-upgrade",
  sequenceRandom([0.99]),
  { grade: "D", allowCurse: false, preferredFirstTrait: "swift" },
);
const beforeUpgradeAttack = equipmentStatProfile(
  ITEM_DEFS.shortsword,
  gradeStableUpgrade,
).attack;
upgradeEquipmentInstance(gradeStableUpgrade, 3);
assert.equal(gradeStableUpgrade.grade, "D");
assert.equal(
  equipmentStatProfile(ITEM_DEFS.shortsword, gradeStableUpgrade).attack -
    beforeUpgradeAttack,
  3,
  "upgrade values must remain additive and must never change or scale the item grade",
);
const cursedSwordInstance = createEquipmentInstance(
  ITEM_DEFS.shortsword,
  "rolled-cursed-sword",
  sequenceRandom([0]),
  { grade: "C", preferredFirstTrait: "swift" },
);
assert.equal(
  cursedSwordInstance.cursed,
  true,
  "generated equipment must support an independently rolled cursed state",
);
const cursedEquipmentGame = createNewGame(0xc045ed);
cursedEquipmentGame.player.equipment.weapon = null;
cursedEquipmentGame.player.equipmentInstances.weapon = null;
cursedEquipmentGame.player.inventory = { scroll_remove_curse: 1 };
cursedEquipmentGame.player.inventoryInstances = [cursedSwordInstance];
cursedEquipmentGame.player.inventorySlots = normalizePlayerInventorySlots(
  cursedEquipmentGame.player,
);
const equippedCurse = equipItem(cursedEquipmentGame, cursedSwordInstance.id);
assert.equal(
  equippedCurse.state.player.equipmentInstances.weapon?.cursed,
  true,
  "equipping cursed gear must preserve its curse on the equipped instance",
);
const blockedCurseRemoval = unequipSlot(equippedCurse.state, "weapon");
assert.equal(
  blockedCurseRemoval.consumedTurn,
  false,
  "cursed equipment must refuse unequipping without spending a turn",
);
assert.equal(
  blockedCurseRemoval.state.player.equipment.weapon,
  "shortsword",
  "a refused curse removal must leave the exact equipment in place",
);
const cleansedCurse = consumeItemAction(
  blockedCurseRemoval.state,
  "scroll_remove_curse",
);
assert.equal(
  cleansedCurse.state.player.equipmentInstances.weapon?.cursed,
  false,
  "a Remove Curse scroll must cleanse currently equipped party gear",
);
assert.equal(
  cleansedCurse.state.player.inventory.scroll_remove_curse ?? 0,
  0,
  "removing a curse must consume the rare scroll",
);
const removedCleansedGear = unequipSlot(cleansedCurse.state, "weapon");
assert.equal(
  removedCleansedGear.state.player.equipment.weapon,
  null,
  "cleansed equipment must become removable again",
);
assert.deepEqual(
  ["weapon", "armor", "missile", "wand", "artifact", "ring"],
  [
    "weapon",
    "armor",
    "missile",
    "wand",
    "artifact",
    "ring",
  ].filter((category) =>
    Object.values(ITEM_DEFS).some(
      (definition) =>
        definition.category === category &&
        isUpgradeableEquipment(definition),
    ),
  ),
  "all requested gear categories must use the per-instance upgrade system",
);

strongSwordInstance.traits = [{ id: "keen", grade: "S" }];
const individualGearGame = createNewGame(0x1ee7c0de);
individualGearGame.player.inventory = {};
individualGearGame.player.inventoryInstances = [strongSwordInstance];
const equippedIndividualGear = equipItem(
  individualGearGame,
  strongSwordInstance.id,
);
assert.deepEqual(
  equippedIndividualGear.state.player.equipmentInstances.weapon?.traits,
  [{ id: "keen", grade: "S" }],
  "equipping an item must preserve that exact instance's enchantments",
);
const returnedIndividualGear = unequipSlot(
  equippedIndividualGear.state,
  "weapon",
);
const returnedSword = returnedIndividualGear.state.player.inventoryInstances.find(
  (instance) => instance.id === strongSwordInstance.id,
);
assert.deepEqual(
  returnedSword?.traits,
  [{ id: "keen", grade: "S" }],
  "unequipping must return the same independently enchanted item instance",
);

returnedIndividualGear.state.player.inventory.stone_enchantment = 1;
const enchantedBackpackGear = enchantItem(
  returnedIndividualGear.state,
  strongSwordInstance.id,
);
const enchantedSword =
  enchantedBackpackGear.state.player.inventoryInstances.find(
    (instance) => instance.id === strongSwordInstance.id,
  );
assert.equal(
  enchantedBackpackGear.consumedTurn,
  true,
  "manual enchanting must consume one game turn",
);
assert.equal(
  enchantedBackpackGear.enchanted,
  true,
  "manual enchanting must request its synchronized pixel effect",
);
assert.equal(
  enchantedBackpackGear.state.player.inventory.stone_enchantment ?? 0,
  0,
  "manual enchanting must consume one available enchanting material",
);
assert.ok(
  (enchantedSword?.traits ?? []).length > 1,
  "manual enchanting must add a separately graded instance-specific enchantment",
);

const equippedEnchantGame = equipItem(
  enchantedBackpackGear.state,
  strongSwordInstance.id,
).state;
equippedEnchantGame.player.inventory.stylus = 1;
const enchantedEquippedGear = enchantEquippedItem(
  equippedEnchantGame,
  "weapon",
);
assert.equal(
  enchantedEquippedGear.consumedTurn,
  true,
  "currently equipped gear must be enchantable from its detail dialog",
);
assert.ok(
  (
    enchantedEquippedGear.state.player.equipmentInstances.weapon?.traits ?? []
  ).length >
    (equippedEnchantGame.player.equipmentInstances.weapon?.traits ?? []).length,
  "equipped enchanting must strengthen the equipped instance in place",
);

equipmentTurn.state.player.hp = 7;
const potionCount = equipmentTurn.state.player.inventory.potion_healing;
const healed = consumeItemAction(equipmentTurn.state, "potion_healing");
assert.ok(
  healed.state.player.hp > equipmentTurn.state.player.hp,
  "a healing potion should restore HP",
);
assert.equal(
  healed.state.player.inventory.potion_healing ?? 0,
  potionCount - 1,
  "a used potion should disappear when its count reaches zero",
);
assert.equal(healed.interacted, true, "using an item should trigger interaction");

const pickupGame = createNewGame(0x71e7cafe);
pickupGame.enemies = [];
const pickupTarget = [
  { x: pickupGame.player.x + 1, y: pickupGame.player.y },
  { x: pickupGame.player.x - 1, y: pickupGame.player.y },
  { x: pickupGame.player.x, y: pickupGame.player.y + 1 },
  { x: pickupGame.player.x, y: pickupGame.player.y - 1 },
].find(
  ({ x, y }) =>
    pickupGame.tiles[y]?.[x] &&
    isWalkable(pickupGame.tiles[y][x].terrain, false) &&
    !pickupGame.enemies.some((enemy) => enemy.x === x && enemy.y === y),
);
assert.ok(pickupTarget, "a pickup test cell should exist beside the player");
pickupGame.groundItems.push({
  id: "pickup-test-ring",
  defId: "ring_might",
  ...pickupTarget,
});
const steppedOntoItem = playerStep(
  pickupGame,
  pickupTarget.x - pickupGame.player.x,
  pickupTarget.y - pickupGame.player.y,
);
assert.equal(
  steppedOntoItem.pickups?.length ?? 0,
  0,
  "movement and pickup must remain separate actions",
);
assert.equal(
  steppedOntoItem.state.groundItems.some(
    (item) => item.id === "pickup-test-ring",
  ),
  true,
  "the item must remain on the floor after movement",
);
assert.equal(
  shouldAutoPickup(steppedOntoItem.state),
  true,
  "safe floor items should be eligible for automatic pickup",
);
const pickedUp = pickupGroundItems(steppedOntoItem.state, false);
assert.equal(pickedUp.pickups?.length, 1, "a collected item should be reported");
assert.equal(
  pickedUp.pickups?.[0].defId,
  "ring_might",
  "the pickup animation should receive the collected item sprite",
);
assert.equal(
  pickedUp.state.player.inventoryInstances.filter(
    (instance) => instance.defId === "ring_might",
  ).length,
  pickupGame.player.inventoryInstances.filter(
    (instance) => instance.defId === "ring_might",
  ).length + 1,
  "the collected ring should enter one independent inventory slot",
);
assert.equal(
  pickedUp.state.groundItems.some((item) => item.id === "pickup-test-ring"),
  false,
  "the collected ground item should disappear",
);
assert.equal(
  pickedUp.state.turn,
  steppedOntoItem.state.turn + 1,
  "picking up an item must consume a separate turn",
);
assert.equal(
  pickedUp.interactionKind,
  "pickup",
  "pickup actions should expose a semantic interaction kind",
);
assert.equal(
  durationForInteraction(pickedUp.interactionKind),
  PLAYER_PICKUP_DURATION,
  "the presentation layer should map pickup semantics to short timing",
);
assert.equal(
  pickedUp.presentationState?.groundItems.some(
    (item) => item.id === "pickup-test-ring",
  ),
  true,
  "pickup results must remain hidden until interaction completes",
);

const chestGame = createNewGame(0xc4e57001);
const chestPoint = {
  x: chestGame.player.x + 1,
  y: chestGame.player.y,
};
chestGame.tiles[chestPoint.y][chestPoint.x].terrain = "floor";
chestGame.enemies = [];
chestGame.objects = [
  {
    id: "test-chest",
    kind: "chest",
    looted: false,
    loot: ["wand_frost", "stone_blink"],
    ...chestPoint,
  },
];
const openedChest = playerStep(chestGame, 1, 0);
assert.equal(
  openedChest.state.objects[0].looted,
  true,
  "an adjacent closed chest should become looted after interaction",
);
assert.equal(
  openedChest.presentationState?.objects[0].looted,
  false,
  "the chest must stay closed until interaction animation completes",
);
assert.equal(
  openedChest.presentationState?.player.inventoryInstances.filter(
    (instance) => instance.defId === "wand_frost",
  ).length ?? 0,
  0,
  "chest rewards must not enter inventory before interaction completes",
);
assert.equal(
  openedChest.state.player.inventoryInstances.filter(
    (instance) => instance.defId === "wand_frost",
  ).length,
  1,
  "chest contents should be transferred into the inventory",
);
assert.equal(
  openedChest.pickups?.length,
  2,
  "opening a chest should emit a pickup animation for every reward",
);
assert.deepEqual(
  { x: openedChest.state.player.x, y: openedChest.state.player.y },
  { x: chestGame.player.x, y: chestGame.player.y },
  "opening a chest should consume the turn without moving into it",
);
assert.deepEqual(
  OBJECT_SPRITES,
  {
    chest: { sprite: 36, label: "나무 상자", accent: "#c89961" },
    crystalChest: { sprite: 38, label: "수정 상자", accent: "#78cfe1" },
    tomb: { sprite: 34, label: "오래된 무덤", accent: "#b2b7b4" },
    alchemy: { sprite: 245, label: "연금술 작업대", accent: "#9fe0cf" },
  },
  "containers and the alchemy workbench must use explicit original-sheet frames",
);

const throwableChestGame = createNewGame(0xc4e57002);
const throwableChestPoint = {
  x: throwableChestGame.player.x + 1,
  y: throwableChestGame.player.y,
};
throwableChestGame.tiles[throwableChestPoint.y][throwableChestPoint.x].terrain =
  "floor";
throwableChestGame.enemies = [];
throwableChestGame.objects = [{
  id: "throwable-chest",
  kind: "chest",
  looted: false,
  loot: ["throwing_knife"],
  ...throwableChestPoint,
}];
const openedThrowableChest = playerStep(throwableChestGame, 1, 0);
assert.equal(
  openedThrowableChest.state.player.inventory.throwing_knife ?? 0,
  0,
  "throwable equipment must not enter the stackable inventory map",
);
const chestThrowable = openedThrowableChest.state.player.inventoryInstances.find(
  (instance) => instance.defId === "throwing_knife",
)!;
assert.deepEqual(
  {
    charges: chestThrowable.charges,
    maxCharges: chestThrowable.maxCharges,
  },
  { charges: 3, maxCharges: 3 },
  "a throwable loot bundle must become one independently charged equipment instance",
);
const enchantedThrowableGame = openedThrowableChest.state;
enchantedThrowableGame.player.inventory.stone_enchantment = 1;
const throwableTraitRankBefore = (
  chestThrowable.traits ?? []
).length;
const enchantedThrowable = enchantItem(
  enchantedThrowableGame,
  chestThrowable.id,
);
const enchantedChestThrowable = enchantedThrowable.state.player.inventoryInstances.find(
  (instance) => instance.id === chestThrowable.id,
)!;
const throwableTraitRankAfter = (
  enchantedChestThrowable.traits ?? []
).length;
assert.equal(
  enchantedThrowable.consumedTurn,
  true,
  "an individual throwable equipment instance must accept an enchantment",
);
assert.ok(
  throwableTraitRankAfter > throwableTraitRankBefore,
  "the enchantment must remain on that exact throwable instance",
);

const discardedGame = createNewGame(0xd15ca2d);
discardedGame.enemies = [];
discardedGame.player.inventory.ration = 1;
const discarded = discardItem(discardedGame, "ration");
assert.equal(discarded.consumedTurn, true, "discarding should consume a turn");
assert.equal(
  discarded.state.groundItems.some(
    (item) =>
      item.defId === "ration" &&
      item.manualPickup &&
      item.x === discarded.state.player.x &&
      item.y === discarded.state.player.y,
  ),
  true,
  "discarded items should fall at the player's feet and require manual pickup",
);
assert.equal(
  shouldAutoPickup(discarded.state),
  false,
  "discarded items must never be picked up automatically",
);
const repickedDiscard = pickupGroundItems(discarded.state, true);
assert.equal(
  repickedDiscard.pickups?.[0]?.lootOrigin,
  "carried",
  "a dropped expedition item must retain carried provenance when picked up again",
);
assert.equal(
  newExpeditionPickups(repickedDiscard.pickups ?? []).length,
  0,
  "a brought-in item that is dropped and re-picked must not enter the new-loot report",
);
assert.deepEqual(
  newExpeditionPickups([
    { id: "planned", defId: "ration", quantity: 1, x: 0, y: 0, lootOrigin: "dungeon" },
    { id: "grass", defId: "seed_sungrass", quantity: 1, x: 0, y: 0, lootOrigin: "grass" },
    { id: "carried", defId: "ration", quantity: 1, x: 0, y: 0, lootOrigin: "carried" },
    { id: "key", defId: "iron_key", quantity: 1, x: 0, y: 0, lootOrigin: "dungeon" },
    { id: "gold", defId: "gold", quantity: 99, x: 0, y: 0, lootOrigin: "dungeon" },
  ]).map((pickup) => pickup.id),
  ["planned", "grass"],
  "new-loot accounting must include dungeon and bush finds while excluding carried items, floor keys, and currency",
);

let throwGame = createNewGame(0x7a20);
throwGame.enemies = [];
throwGame = developerGrantItem(throwGame, "throwing_knife");
assert.equal(
  throwGame.player.inventory.throwing_knife ?? 0,
  0,
  "throwable grants must not create a stackable item entry",
);
assert.equal(
  throwGame.player.inventoryInstances.filter(
    (instance) => instance.defId === "throwing_knife",
  ).length,
  1,
  "a throwable grant must create one independently owned equipment instance",
);
const throwingKnifeProfile =
  throwGame.player.inventoryInstances.find(
    (instance) => instance.defId === "throwing_knife",
  );
assert.ok(
  throwingKnifeProfile,
  "throwable equipment must keep its own charge profile",
);
throwingKnifeProfile.upgradeLevel = 2;
throwingKnifeProfile.traits = [{
  id: "keen",
  grade: throwingKnifeProfile.grade ?? "C",
}];
const throwTarget = {
  x: throwGame.player.x + 3,
  y: throwGame.player.y,
};
for (let x = throwGame.player.x; x <= throwTarget.x; x += 1) {
  throwGame.tiles[throwGame.player.y][x].terrain = "floor";
}
throwGame.tiles[throwTarget.y][throwTarget.x].visible = false;
throwGame.tiles[throwTarget.y][throwTarget.x].discovered = false;
const thrown = throwItem(throwGame, throwingKnifeProfile.id, throwTarget);
assert.equal(thrown.consumedTurn, true, "throwing should consume a turn");
assert.deepEqual(thrown.throws?.[0].to, throwTarget);
assert.equal(
  thrown.state.groundItems.some(
    (item) =>
      item.defId === "throwing_knife" &&
      item.quantity === 1 &&
      item.recoversThrowableCharge === true &&
      item.recoversItemRef === throwingKnifeProfile.id &&
      item.x === throwTarget.x,
  ),
  true,
  "one thrown item must land as a recoverable charge marker",
);
assert.equal(
  thrown.state.player.inventoryInstances.some(
    (instance) => instance.id === throwingKnifeProfile.id,
  ),
  true,
  "throwing must preserve ownership of the exact equipment instance",
);
assert.equal(
  throwableChargeCount(thrown.state.player, throwingKnifeProfile.id),
  2,
  "throwing once must consume one charge from that exact equipment instance",
);
const thrownKnife = thrown.state.player.inventoryInstances.find(
  (instance) => instance.id === throwingKnifeProfile.id,
)!;
assert.deepEqual(
  {
    upgradeLevel: thrownKnife.upgradeLevel,
    trait: thrownKnife.traits?.[0]?.id,
  },
  { upgradeLevel: 2, trait: "keen" },
  "throwing must preserve upgrades on the same throwable equipment instance",
);

const grantedCatalogItem = developerGrantItem(chestGame, "wand_lightning");
assert.equal(
  grantedCatalogItem.player.inventoryInstances.filter(
    (instance) => instance.defId === "wand_lightning",
  ).length,
  1,
  "developer mode should grant any catalog item",
);
const spawnedEnemyGame = developerSpawnEnemy(chestGame, "skeleton");
assert.ok(
  spawnedEnemyGame.enemies.some(
    (enemy) => enemy.kind === "skeleton" && enemy.alerted && !enemy.sleeping,
  ),
  "developer mode should spawn an awake selected enemy near the player",
);

const smoothDoorGame = createNewGame(0xd001);
const smoothDoorTarget = {
  x: smoothDoorGame.player.x + 1,
  y: smoothDoorGame.player.y,
};
smoothDoorGame.enemies = [];
smoothDoorGame.groundItems = [];
smoothDoorGame.tiles[smoothDoorTarget.y][smoothDoorTarget.x].terrain = "door";
const smoothDoorMove = playerStep(smoothDoorGame, 1, 0);
assert.equal(
  smoothDoorMove.motions[0]?.kind,
  "move",
  "opening a regular door should retain the uninterrupted movement motion",
);
assert.equal(
  smoothDoorMove.interacted,
  false,
  "a regular door must not replace movement with an interaction animation",
);

const doorGame = createNewGame(0xd00fca5e);
doorGame.tiles.forEach((row) =>
  row.forEach((tile) => {
    tile.terrain = "wall";
    tile.discovered = true;
    tile.visible = false;
  }),
);
for (let x = 9; x <= 11; x += 1) {
  doorGame.tiles[10][x].terrain = "floor";
}
doorGame.tiles[10][10].terrain = "openDoor";
doorGame.player.x = 10;
doorGame.player.y = 10;
doorGame.enemies = [
  {
    id: "door-chaser",
    kind: "rat",
    x: 9,
    y: 10,
    hp: 20,
    maxHp: 20,
    attack: 3,
    defense: 0,
    accuracy: 8,
    evasion: 1_000_000,
    xp: 0,
    alerted: true,
    sawPlayerLastTurn: true,
    sleeping: false,
    wakeCooldown: 0,
  },
];
doorGame.groundItems = [];

const leftDoor = playerStep(doorGame, 1, 0);
assert.equal(
  leftDoor.state.tiles[10][10].terrain,
  "door",
  "an open door should close as soon as the player leaves its tile",
);

const chased = runEnemyTurn(leftDoor.state);
const chaser = chased.state.enemies[0];
assert.deepEqual(
  { x: chaser.x, y: chaser.y },
  { x: 10, y: 10 },
  "an alerted enemy should open the closed door and follow in the same turn",
);
assert.equal(
  chased.state.tiles[10][10].terrain,
  "openDoor",
  "a door opened by an enemy should stay open",
);
assert.equal(
  chaser.sawPlayerLastTurn,
  false,
  "enemy sight history must be captured before it opens the door",
);

const surpriseHp = chaser.hp;
const surprise = playerStep(chased.state, -1, 0);
assert.ok(
  surprise.state.enemies[0].hp < surpriseHp,
  "a surprise attack must ignore even extremely high evasion",
);
assert.ok(
  surprise.state.logs.some((entry) => entry.includes("기습 성공")),
  "a successful surprise attack should be reported",
);

const evadeGame = createNewGame(0xe71de001);
const evadeTarget = {
  x: evadeGame.player.x + 1,
  y: evadeGame.player.y,
};
evadeGame.tiles[evadeTarget.y][evadeTarget.x].terrain = "floor";
evadeGame.enemies = [
  {
    id: "evasion-test",
    kind: "snake",
    ...evadeTarget,
    hp: 20,
    maxHp: 20,
    attack: 5,
    defense: 0,
    accuracy: 10,
    evasion: 1_000_000,
    xp: 0,
    alerted: true,
    sawPlayerLastTurn: true,
    sleeping: false,
    wakeCooldown: 0,
  },
];
evadeGame.rng = 1;
const evaded = playerStep(evadeGame, 1, 0);
assert.equal(
  evaded.state.enemies[0].hp,
  20,
  "a normal attack should be able to miss against evasion",
);
assert.ok(
  evaded.state.logs.some((entry) => entry.includes("회피")),
  "an evaded attack should be reported",
);

const sleepingGame = createNewGame(0x51ee9001);
const sleepingPoint = {
  x: sleepingGame.player.x + 1,
  y: sleepingGame.player.y,
};
sleepingGame.tiles[sleepingPoint.y][sleepingPoint.x].terrain = "floor";
sleepingGame.enemies = [
  {
    id: "sleeping-rat",
    kind: "rat",
    ...sleepingPoint,
    hp: 30,
    maxHp: 30,
    attack: 20,
    defense: 0,
    accuracy: 1_000_000,
    evasion: 0,
    xp: 0,
    alerted: false,
    sawPlayerLastTurn: false,
    sleeping: true,
    wakeCooldown: 0,
  },
];
sleepingGame.rng = 1;
const hpBeforeWake = sleepingGame.player.hp;
const wokeBySight = runEnemyTurn(sleepingGame);
assert.equal(
  wokeBySight.state.enemies[0].sleeping,
  false,
  "a nearby sleeping enemy should be able to wake after seeing the player",
);
assert.equal(
  wokeBySight.state.player.hp,
  hpBeforeWake,
  "waking must consume the enemy's whole turn before it can attack",
);
assert.equal(
  wokeBySight.motions.filter((motion) => motion.id === "sleeping-rat").length,
  0,
  "a waking enemy must not move or attack in the same turn",
);
assert.equal(
  wokeBySight.signals?.[0]?.text,
  "!",
  "waking should emit a speech-bubble state signal",
);
assert.equal(
  wokeBySight.signals?.[0]?.holdUntilTurnEnd,
  true,
  "the wake-up exclamation must remain visible until the turn ends",
);

const searchGame = createNewGame(0x1a57ee11);
searchGame.enemies = [];
searchGame.player.x = 15;
searchGame.player.y = 10;
for (let x = 10; x <= 15; x += 1) {
  searchGame.tiles[10][x].terrain = "floor";
}
searchGame.tiles[10][14].terrain = "wall";
searchGame.enemies.push({
  id: "searcher",
  kind: "rat",
  x: 10,
  y: 10,
  hp: 10,
  maxHp: 10,
  attack: 2,
  defense: 0,
  accuracy: 8,
  evasion: 3,
  xp: 1,
  alerted: true,
  sawPlayerLastTurn: false,
  sleeping: false,
  wakeCooldown: 0,
  lastSeenPlayer: { x: 13, y: 10 },
  searchTurns: 0,
});
const searching = runEnemyTurn(searchGame);
assert.deepEqual(
  { x: searching.state.enemies[0].x, y: searching.state.enemies[0].y },
  { x: 11, y: 10 },
  "an enemy that loses sight should continue toward the last seen position",
);
searching.state.enemies[0].x = 13;
searching.state.enemies[0].y = 10;
const lostTrack = runEnemyTurn(searching.state);
assert.equal(
  lostTrack.signals?.some((signal) => signal.text === "?"),
  true,
  "an enemy should show a question bubble after checking the last seen position",
);
assert.equal(
  lostTrack.state.enemies[0].alerted,
  false,
  "an enemy should leave pursuit mode after the last seen point is empty",
);

const attackedSleeperGame = createNewGame(0x51ee9002);
const attackedSleeperPoint = {
  x: attackedSleeperGame.player.x + 1,
  y: attackedSleeperGame.player.y,
};
attackedSleeperGame.tiles[attackedSleeperPoint.y][attackedSleeperPoint.x].terrain =
  "floor";
attackedSleeperGame.enemies = [
  {
    id: "attacked-sleeper",
    kind: "rat",
    ...attackedSleeperPoint,
    hp: 99,
    maxHp: 99,
    attack: 20,
    defense: 0,
    accuracy: 1_000_000,
    evasion: 0,
    xp: 0,
    alerted: false,
    sawPlayerLastTurn: false,
    sleeping: true,
    wakeCooldown: 0,
  },
];
const struckSleeper = playerStep(attackedSleeperGame, 1, 0);
assert.equal(
  struckSleeper.state.enemies[0].wakeCooldown,
  1,
  "an attacked sleeper must reserve one full wake-up turn",
);
const hpBeforeWakeCooldown = struckSleeper.state.player.hp;
const forcedWakeTurn = runEnemyTurn(struckSleeper.state);
assert.equal(
  forcedWakeTurn.state.player.hp,
  hpBeforeWakeCooldown,
  "an enemy woken by an attack must still skip its next action",
);
assert.equal(
  forcedWakeTurn.state.enemies[0].wakeCooldown,
  0,
  "the wake-up cooldown should be consumed after one enemy turn",
);

const verticalDoorGame = createNewGame(0x71ca1d00);
const doorX = verticalDoorGame.player.x;
const doorY = verticalDoorGame.player.y;
verticalDoorGame.tiles[doorY][doorX].terrain = "door";
verticalDoorGame.tiles[doorY - 1][doorX].terrain = "wall";
verticalDoorGame.tiles[doorY + 1][doorX].terrain = "wall";
verticalDoorGame.tiles[doorY + 1][doorX - 1].terrain = "wall";
verticalDoorGame.tiles[doorY + 1][doorX + 1].terrain = "wall";
assert.equal(
  terrainVisual(verticalDoorGame, doorX, doorY),
  116,
  "a sideways raised door should use the wall above it, matching Shattered",
);
assert.equal(
  wallOverlayVisual(verticalDoorGame, doorX, doorY),
  212,
  "a closed wall-set door must render Shattered's dedicated lower half",
);
verticalDoorGame.tiles[doorY][doorX].terrain = "openDoor";
assert.equal(
  wallOverlayVisual(verticalDoorGame, doorX, doorY),
  208,
  "an open wall-set door must render its dedicated lower half",
);
verticalDoorGame.tiles[doorY][doorX].terrain = "lockedDoor";
assert.equal(
  wallOverlayVisual(verticalDoorGame, doorX, doorY),
  216,
  "a locked wall-set door must render its dedicated lower half",
);
verticalDoorGame.tiles[doorY][doorX].terrain = "door";
verticalDoorGame.tiles[doorY - 1][doorX].terrain = "floor";
verticalDoorGame.tiles[doorY + 1][doorX].terrain = "floor";
assert.equal(
  terrainVisual(verticalDoorGame, doorX, doorY),
  112,
  "a vertical door must keep its complete wall-backed lower sprite",
);

const diagonalMoveGame = createNewGame(0xd1a60a1);
const diagonalStart = { x: diagonalMoveGame.player.x, y: diagonalMoveGame.player.y };
const diagonalTarget = {
  x: diagonalStart.x + 1,
  y: diagonalStart.y + 1,
};
diagonalMoveGame.enemies = [];
diagonalMoveGame.tiles[diagonalStart.y][diagonalStart.x + 1].terrain = "wall";
diagonalMoveGame.tiles[diagonalStart.y + 1][diagonalStart.x].terrain = "wall";
diagonalMoveGame.tiles[diagonalTarget.y][diagonalTarget.x].terrain = "floor";
const diagonalPath = findPath(
  diagonalMoveGame.tiles,
  diagonalStart,
  diagonalTarget,
);
assert.deepEqual(
  diagonalPath,
  [diagonalTarget],
  "pathfinding should allow a diagonal step between wall corners",
);
const diagonalMove = playerStep(diagonalMoveGame, 1, 1);
assert.equal(
  diagonalMove.consumedTurn,
  true,
  "the player should move diagonally while touching two walls",
);
assert.deepEqual(
  { x: diagonalMove.state.player.x, y: diagonalMove.state.player.y },
  diagonalTarget,
  "the diagonal wall-corner move should reach its target tile",
);

const diagonalAttackGame = createNewGame(0xd1a60a2);
const diagonalAttackStart = {
  x: diagonalAttackGame.player.x,
  y: diagonalAttackGame.player.y,
};
const diagonalEnemyPoint = {
  x: diagonalAttackStart.x + 1,
  y: diagonalAttackStart.y + 1,
};
diagonalAttackGame.tiles[diagonalAttackStart.y][
  diagonalAttackStart.x + 1
].terrain = "wall";
diagonalAttackGame.tiles[diagonalAttackStart.y + 1][
  diagonalAttackStart.x
].terrain = "wall";
diagonalAttackGame.tiles[diagonalEnemyPoint.y][diagonalEnemyPoint.x].terrain =
  "floor";
diagonalAttackGame.enemies = [
  {
    id: "diagonal-attack-target",
    kind: "rat",
    ...diagonalEnemyPoint,
    hp: 20,
    maxHp: 20,
    attack: 1,
    defense: 0,
    accuracy: 1,
    evasion: 1_000_000,
    xp: 0,
    alerted: false,
    sawPlayerLastTurn: false,
    sleeping: false,
    wakeCooldown: 0,
  },
];
const diagonalEnemyHp = diagonalAttackGame.enemies[0].hp;
const diagonalAttack = playerStep(diagonalAttackGame, 1, 1);
assert.ok(
  diagonalAttack.state.enemies[0].hp < diagonalEnemyHp,
  "the player should attack a diagonal enemy through a wall corner",
);
assert.deepEqual(
  { x: diagonalAttack.state.player.x, y: diagonalAttack.state.player.y },
  diagonalAttackStart,
  "a diagonal attack should not move the player into the enemy tile",
);

const effectRandomValues = [0.25, 0.75, 0.2, 0.4, 0.5, 0.6, 0.8, 0.3];
let effectRandomIndex = 0;
const trajectories = createEffectTrajectories(
  3,
  () => effectRandomValues[effectRandomIndex++ % effectRandomValues.length],
);
assert.equal(trajectories.length, 3, "three combat texts need three trajectories");
assert.equal(
  new Set(
    trajectories.map(
      ({ velocityX, velocityY }) =>
        `${velocityX.toFixed(3)},${velocityY.toFixed(3)}`,
    ),
  ).size,
  3,
  "simultaneous combat texts must fly along different parabolic directions",
);
assert.ok(
  trajectories.every(({ velocityY, gravity }) => velocityY < 0 && gravity > 0),
  "every combat text should launch upward and fall along a parabola",
);

const tripleEffectGame = createNewGame(0x3ffec700);
const tripleEffectTarget = {
  x: tripleEffectGame.player.x + 1,
  y: tripleEffectGame.player.y,
};
tripleEffectGame.tiles[tripleEffectTarget.y][tripleEffectTarget.x].terrain =
  "floor";
tripleEffectGame.enemies = [
  {
    id: "triple-effect-target",
    kind: "rat",
    ...tripleEffectTarget,
    hp: 1,
    maxHp: 1,
    attack: 1,
    defense: 0,
    accuracy: 1,
    evasion: 1_000_000,
    xp: 0,
    alerted: false,
    sawPlayerLastTurn: false,
    sleeping: false,
    wakeCooldown: 0,
    goldDrop: 137,
  },
];
const tripleEffectAttack = playerStep(tripleEffectGame, 1, 0);
assert.equal(
  tripleEffectAttack.effects.length,
  3,
  "a lethal surprise should emit separate surprise, damage, and defeat texts",
);
assert.ok(
  tripleEffectAttack.effects.some(({ text }) => text === "기습!"),
  "the surprise text should remain independent from damage",
);
assert.ok(
  tripleEffectAttack.effects.some(({ text }) => text.startsWith("-")),
  "the damage text should remain independent from surprise",
);
assert.ok(
  tripleEffectAttack.effects.some(({ text }) => text === "처치!"),
  "the defeat text should remain independent from damage",
);
assert.ok(
  tripleEffectAttack.presentationState?.enemies.some(
    (enemy) => enemy.id === "triple-effect-target",
  ),
  "the defeated enemy must remain in the presentation state until attack impact",
);
assert.equal(
  tripleEffectAttack.state.enemies.some(
    (enemy) => enemy.id === "triple-effect-target",
  ),
  false,
  "the resolved combat state should remove the enemy at impact",
);
assert.deepEqual(
  tripleEffectAttack.defeatedIds,
  ["triple-effect-target"],
  "a lethal attack should report defeated entities for synchronized death audio",
);
assert.equal(
  tripleEffectAttack.state.groundItems.find(
    (item) => item.id === "gold-drop-triple-effect-target",
  )?.quantity,
  137,
  "a defeated monster must drop its independently planned gold even alongside normal loot rules",
);

const generatedMapSizes = new Set<string>();
let generatedMapArea = 0;
let generatedHighGrass = 0;
let generatedFloorRewardCount = 0;
let generatedCorridorCount = 0;
let generatedWideCorridorCount = 0;
let generatedRoomCount = 0;
let generatedCorridorLength = 0;
const floorEquipmentCategories = new Set(FLOOR_EQUIPMENT_CATEGORIES);
const specialFloorLootIds = new Set([
  ...SPECIAL_SCROLL_IDS,
  ...SPECIAL_POTION_IDS,
  ...SPECIAL_ALCHEMY_IDS,
]);
const sewerFloorLootIds = new Set([
  ...FLOOR_LOOT,
  ...sewerRules.mainDropIds,
]);
assert.equal(
  SPECIAL_SCROLL_IDS.length,
  12,
  "all twelve exotic scrolls must stay in the special-reward pool",
);
assert.equal(
  SPECIAL_POTION_IDS.length,
  12,
  "all twelve exotic potions must stay in the special-reward pool",
);
assert.ok(
  FLOOR_LOOT.every((itemId) => !specialFloorLootIds.has(itemId)),
  "special scrolls, potions, brews, and elixirs must never enter normal floor loot",
);
for (let seed = 1; seed <= 96; seed += 1) {
  const generatedLayout = generateFloor((seed * 104729) >>> 0);
  const wideCorridorCount = generatedLayout.corridorWidths.filter(
    (width) => width === 3,
  ).length;
  assert.ok(
    generatedLayout.corridorWidths.length > 0,
    `seed ${seed} must generate at least one room connection`,
  );
  assert.equal(
    wideCorridorCount,
    Math.round(generatedLayout.corridorWidths.length * 0.8),
    `seed ${seed} must assign exactly eighty percent of its connections to three-cell corridors after rounding`,
  );
  assert.ok(
    generatedLayout.corridorWidths.every((width) => width === 1 || width === 3),
    `seed ${seed} must expose only one-cell or three-cell corridor widths`,
  );
  assert.ok(
    generatedLayout.roomCount >= 5 && generatedLayout.roomCount <= 12,
    `seed ${seed} must stay within the reduced five-to-twelve room range`,
  );
  assert.ok(
    generatedLayout.corridorLengths.every((length) => length <= 48),
    `seed ${seed} must keep every room transfer within the compact corridor limit`,
  );
  generatedCorridorCount += generatedLayout.corridorWidths.length;
  generatedWideCorridorCount += wideCorridorCount;
  generatedRoomCount += generatedLayout.roomCount;
  generatedCorridorLength += generatedLayout.corridorLengths.reduce(
    (total, length) => total + length,
    0,
  );

  const generated = createExpeditionGame(
    seed * 7919,
    {
      dungeonId: sewerRules.id,
      dungeonName: sewerRules.nameKo,
      maxFloor: sewerRules.floorCount,
      difficultyScale: sewerRules.difficultyScale,
      difficulty: sewerRules.difficulty,
      mainDropIds: sewerRules.mainDropIds,
      lootPlan: sewerRules.lootPlan,
    },
    soloExpedition.player,
    [],
  );
  generatedMapSizes.add(`${generated.width}x${generated.height}`);
  generatedMapArea += generated.width * generated.height;
  generatedHighGrass += generated.tiles
    .flat()
    .filter((tile) => tile.terrain === "highGrass").length;
  assert.equal(generated.width, generated.tiles[0].length);
  assert.equal(generated.height, generated.tiles.length);
  assert.ok(
    generated.enemies.length >= 22,
    `seed ${seed} must populate the expanded first floor with a large monster group`,
  );
  assert.equal(
    generated.tiles.flat().filter((tile) => tile.terrain === "lockedDoor").length,
    1,
    `seed ${seed} should have one locked door`,
  );
  assert.equal(
    generated.tiles.flat().filter((tile) => tile.terrain === "exit").length,
    1,
    `seed ${seed} should have one exit`,
  );
  assert.equal(
    generated.groundItems.filter((item) => item.defId === "iron_key").length,
    1,
    `seed ${seed} should have one key`,
  );
const ordinaryGroundLoot = generated.groundItems.filter(
    (item) => !["iron_key", "gold"].includes(item.defId),
  );
  const equipmentLoot = ordinaryGroundLoot.filter((item) =>
    floorEquipmentCategories.has(
      ITEM_DEFS[item.defId].category as (typeof FLOOR_EQUIPMENT_CATEGORIES)[number],
    ),
  );
  assert.ok(
    ordinaryGroundLoot.every(
      (item) =>
        sewerFloorLootIds.has(item.defId) &&
        (!specialFloorLootIds.has(item.defId) ||
          sewerRules.mainDropIds.includes(item.defId)),
    ),
    `seed ${seed} must use only normal loot or explicitly advertised special drops`,
  );
  assert.ok(
    equipmentLoot.every(
      (item) =>
        ITEM_DEFS[item.defId].category !== "missile" || item.quantity === 3,
    ),
    `seed ${seed} must spawn throwable equipment in three-item stacks`,
  );
  const generatedFarmingObjects = generated.objects.filter(
    (object) => object.kind !== "alchemy",
  );
  assert.ok(
    generatedFarmingObjects.length <= 2,
    `seed ${seed} may omit farming objects under the reduced floor-loot budget`,
  );
  assert.ok(
    generatedFarmingObjects.every(
      (object) =>
        !object.looted &&
        object.loot.length === 1 &&
        floorEquipmentCategories.has(
          ITEM_DEFS[object.loot[0]].category as (typeof FLOOR_EQUIPMENT_CATEGORIES)[number],
        ),
    ),
    `seed ${seed} farming objects must each contain one equipment item`,
  );
  const floorRewardCount =
    ordinaryGroundLoot.length +
    generatedFarmingObjects.reduce(
      (total, object) => total + object.loot.length,
      0,
    );
  assert.ok(
    floorRewardCount >= 1 && floorRewardCount <= 3,
    `seed ${seed} must place one to three persistent rewards after the one-third reduction`,
  );
  generatedFloorRewardCount += floorRewardCount;
  assert.equal(
    generated.objects.filter((object) => object.kind === "alchemy").length,
    1,
    `seed ${seed} must contain one alchemy workbench`,
  );
  assertDoorTopology(generated.tiles, seed);
  assertNoDiagonalOpenings(generated.tiles, seed);

  const start = generated.player;
  const exit = generated.tiles.flatMap((row, y) =>
    row.flatMap((tile, x) => (tile.terrain === "exit" ? [{ x, y }] : [])),
  )[0];
  const withoutKey = reachableCells(generated.tiles, start, false);
  const withKey = reachableCells(generated.tiles, start, true);
  assert.ok(
    !withoutKey.has(pointKey(exit.x, exit.y)),
    `seed ${seed} exit must stay behind the locked connection`,
  );
  assert.ok(
    withKey.has(pointKey(exit.x, exit.y)),
    `seed ${seed} all room presets and tunnels must connect after unlocking`,
  );
}
const averageFloorRewardCount = generatedFloorRewardCount / 96;
assert.ok(
  averageFloorRewardCount >= 1.75 && averageFloorRewardCount <= 2.25,
  `one-third floor loot must average about two rewards, got ${averageFloorRewardCount.toFixed(3)}`,
);
const wideCorridorRatio = generatedWideCorridorCount / generatedCorridorCount;
const averageRoomCount = generatedRoomCount / 96;
const averageCorridorLength = generatedCorridorLength / generatedCorridorCount;
assert.ok(
  wideCorridorRatio >= 0.78 && wideCorridorRatio <= 0.82,
  `rounded per-floor corridor allocation must remain approximately eighty percent wide, got ${(wideCorridorRatio * 100).toFixed(2)}%`,
);
assert.ok(
  averageRoomCount >= 7.75 && averageRoomCount <= 8.75,
  `reduced room budgets must average about eight rooms, got ${averageRoomCount.toFixed(3)}`,
);
assert.ok(
  averageCorridorLength <= 12,
  `closer room placement must keep the mean corridor length compact, got ${averageCorridorLength.toFixed(3)}`,
);
assert.ok(
  generatedMapSizes.size >= 24,
  "loop and figure-eight builders must produce varied normalized map bounds",
);
assert.ok(
  generatedMapArea / 96 >= 3000 && generatedMapArea / 96 <= 4500,
  "reduced room budgets and tighter placement must keep the average floor footprint compact",
);
assert.ok(
  [...generatedMapSizes].filter((size) => {
    const [width, height] = size.split("x").map(Number);
    return width === height;
  }).length <= 2,
  "generated floors must not fall back to a fixed square canvas",
);
assert.ok(
  generatedHighGrass > 0,
  "the sewer painter must generate untouched high-grass bushes",
);

let augmentGame = developerGrantItem(
  createNewGame(0xa091e17),
  "potion_experience",
  2,
);
augmentGame = consumeItemAction(augmentGame, "potion_experience").state;
augmentGame = consumeItemAction(augmentGame, "potion_experience").state;
assert.equal(
  AUGMENTS_ENABLED,
  false,
  "campaign mode must keep the augment system disabled",
);
assert.deepEqual(
  augmentGame.pendingAugmentOffers,
  [],
  "normal and consecutive level-ups must not interrupt expeditions with augment offers",
);
const weaponInfusionGame = createNewGame(0x1f0510);
weaponInfusionGame.pendingAugmentOffers = [["weaponInfusion"]];
const infusedWeaponGame = chooseAugment(
  weaponInfusionGame,
  "weaponInfusion",
);
assert.deepEqual(
  infusedWeaponGame,
  weaponInfusionGame,
  "even a stale synthetic offer must not activate an augment while the system is disabled",
);

const woundedLevelGame = developerGrantItem(
  createNewGame(0x1e7e1),
  "potion_experience",
);
woundedLevelGame.player.hp = 7;
woundedLevelGame.player.xp = woundedLevelGame.player.nextXp - 1;
const woundedLevelMaxHp = woundedLevelGame.player.maxHp;
const woundedLevelAttack = woundedLevelGame.player.baseAttack;
const woundedLevelResult = consumeItemAction(
  woundedLevelGame,
  "potion_experience",
).state;
assert.ok(
  woundedLevelResult.player.level > woundedLevelGame.player.level,
  "the experience potion fixture must trigger a level-up",
);
assert.equal(
  woundedLevelResult.player.hp,
  7,
  "level-up itself must not heal the player",
);
assert.equal(
  woundedLevelResult.player.maxHp,
  Math.max(
    woundedLevelMaxHp + 1,
    Math.round(woundedLevelMaxHp * LEVEL_STAT_GROWTH),
  ),
  "level-up must increase player maximum health by ten percent",
);
assert.equal(
  woundedLevelResult.player.baseAttack,
  Math.round(woundedLevelAttack * LEVEL_STAT_GROWTH * 1_000_000) /
    1_000_000,
  "level-up must increase player base attack by ten percent",
);
assert.ok(
  createNewGame(0x150150).player.maxHp >= 42,
  "the adventurer companion must retain at least the former player's base health",
);
assert.deepEqual(
  Object.fromEntries(
    Object.entries(COMPANION_CLASSES).map(([id, definition]) => [
      id,
      definition.maxHp,
    ]),
  ),
  {
    adventurer: 42,
    warrior: 36,
    huntress: 29,
    mage: 27,
    rogue: 27,
    duelist: 32,
    cleric: 33,
  },
  "every companion class must receive the rounded 1.5x base-health increase",
);

const invincibleGame = createNewGame(0x1f11c1b1e);
const invincibleTarget = {
  x: invincibleGame.player.x + 1,
  y: invincibleGame.player.y,
};
invincibleGame.tiles[invincibleTarget.y][invincibleTarget.x].terrain = "floor";
const invincibleEnemy = invincibleGame.enemies[0];
Object.assign(invincibleEnemy, invincibleTarget, {
  sleeping: false,
  alerted: true,
  sawPlayerLastTurn: true,
  accuracy: 1_000_000,
  attack: 999,
  lastSeenPlayer: { ...invincibleGame.player },
});
invincibleGame.enemies = [invincibleEnemy];
invincibleGame.companions = [];
const hpBeforeDeveloperTurn = invincibleGame.player.hp;
const developerEnemyTurn = runEnemyTurn(invincibleGame, {
  playerInvincible: true,
});
assert.equal(
  developerEnemyTurn.state.player.hp,
  hpBeforeDeveloperTurn,
  "developer invincibility must reduce enemy damage to zero",
);
assert.ok(
  developerEnemyTurn.effects.some(({ text }) => text === "무효"),
  "developer invincibility should visibly report negated damage",
);

let slotGame = createNewGame(0x25ba6);
slotGame.player.inventory = {};
slotGame.player.inventoryInstances = [];
slotGame = developerGrantItem(slotGame, "wand_frost", MAX_INVENTORY_SLOTS);
assert.equal(
  inventorySlotCount(slotGame.player),
  MAX_INVENTORY_SLOTS,
  "individual wands must each occupy one of the 20 inventory slots",
);
const overfilled = developerGrantItem(slotGame, "wand_frost");
assert.equal(
  inventorySlotCount(overfilled.player),
  MAX_INVENTORY_SLOTS,
  "the backpack must reject a 21st occupied slot",
);

let distinctWands = createNewGame(0xd1571ac7);
distinctWands.player.inventory = {};
distinctWands.player.inventoryInstances = [];
distinctWands.enemies = [];
distinctWands.objects = [];
distinctWands = developerGrantItem(distinctWands, "wand_magic_missile", 2);
const [firstWand, secondWand] = distinctWands.player.inventoryInstances;
const firstWandCharges = firstWand.charges;
const secondWandCharges = secondWand.charges;
const wandTarget = {
  x: distinctWands.player.x + 2,
  y: distinctWands.player.y,
};
for (let x = distinctWands.player.x; x <= wandTarget.x; x += 1) {
  distinctWands.tiles[wandTarget.y][x].terrain = "floor";
}
distinctWands.tiles[wandTarget.y][wandTarget.x].visible = false;
distinctWands.tiles[wandTarget.y][wandTarget.x].discovered = false;
const zapped = zapWand(distinctWands, firstWand.id, wandTarget);
assert.equal(
  zapped.state.player.inventoryInstances.find(
    (instance) => instance.id === firstWand.id,
  )?.charges,
  (firstWandCharges ?? 1) - 1,
  "the fired wand should spend only its own charge",
);
assert.equal(
  zapped.state.player.inventoryInstances.find(
    (instance) => instance.id === secondWand.id,
  )?.charges,
  secondWandCharges,
  "an identical second wand must retain an independent charge count",
);

const setAutoLoadoutSlot = (
  state: ReturnType<typeof createNewGame>,
  index: 0 | 1 | 2 | 3,
  itemRef: string,
) => assignPlayerItem(
  state,
  { kind: "flex", index },
  itemRef,
).state;

let quickSlotGame = developerGrantItem(
  createNewGame(0x3a107),
  "potion_haste",
);
const slotsBeforePotionRegistration = inventorySlotCount(quickSlotGame.player);
quickSlotGame = setAutoLoadoutSlot(quickSlotGame, 2, "potion_haste");
assert.equal(
  quickSlotGame.player.autoSlots[2],
  "potion_haste",
  "the first active quickslot must accept a consumable",
);
assert.equal(
  inventorySlotCount(quickSlotGame.player),
  slotsBeforePotionRegistration,
  "a registered consumable stack must remain in shared backpack occupancy",
);
quickSlotGame = developerGrantItem(quickSlotGame, "wand_frost");
const quickSlotWand = quickSlotGame.player.inventoryInstances.find(
  (instance) => instance.defId === "wand_frost",
)!;
const slotsBeforeWandRegistration = inventorySlotCount(quickSlotGame.player);
quickSlotGame = setAutoLoadoutSlot(quickSlotGame, 3, quickSlotWand.id);
assert.equal(
  quickSlotGame.player.autoSlots[3],
  quickSlotWand.id,
  "the second active quickslot must retain the unique wand instance and its charges",
);
assert.equal(
  inventorySlotCount(quickSlotGame.player),
  slotsBeforeWandRegistration - 1,
  "a registered wand instance must leave backpack occupancy",
);
quickSlotGame = setAutoLoadoutSlot(quickSlotGame, 2, quickSlotWand.id);
assert.deepEqual(
  quickSlotGame.player.autoSlots.slice(2),
  [quickSlotWand.id, null],
  "one owned item reference must move between the two active quickslots instead of duplicating",
);
quickSlotGame = developerGrantItem(quickSlotGame, "potion_healing");
quickSlotGame = setAutoLoadoutSlot(quickSlotGame, 3, "potion_healing");
assert.equal(
  quickSlotGame.player.autoSlots[3],
  "potion_healing",
  "the second active quickslot must accept a consumable",
);
quickSlotGame = setAutoLoadoutSlot(quickSlotGame, 2, quickSlotWand.id);

let flexibleRingGame = developerGrantItem(
  createNewGame(0x3a108),
  "potion_healing",
);
flexibleRingGame = setAutoLoadoutSlot(
  flexibleRingGame,
  2,
  "potion_healing",
);
flexibleRingGame = developerGrantItem(flexibleRingGame, "ring_haste");
const flexibleRing = flexibleRingGame.player.inventoryInstances.find(
  (instance) => instance.defId === "ring_haste",
)!;
flexibleRingGame = assignPlayerItem(
  flexibleRingGame,
  { kind: "flex", index: 1 },
  flexibleRing.id,
).state;
assert.equal(
  flexibleRingGame.player.equipment.ring2,
  "ring_haste",
  "the second passive player slot must accept a ring",
);
assert.equal(
  flexibleRingGame.player.autoSlots[2],
  "potion_healing",
  "passive equipment must not replace either active quickslot",
);
const removedFlexibleRing = unassignPlayerItem(
  flexibleRingGame,
  { kind: "flex", index: 1 },
).state;
assert.equal(
  removedFlexibleRing.player.equipment.ring2,
  null,
  "unassigning a passive player slot must remove its ring",
);
assert.ok(
  removedFlexibleRing.player.inventoryInstances.some(
    (instance) => instance.defId === "ring_haste",
  ),
  "a ring removed from a flexible player slot must return to inventory",
);

const placeVisibleQuickSlotTarget = (state: typeof quickSlotGame) => {
  const enemy = state.enemies[0];
  assert.ok(enemy, "quick-slot planner tests require a generated enemy");
  const offset = state.player.x + 1 < state.width - 1 ? 1 : -1;
  enemy.x = state.player.x + offset;
  enemy.y = state.player.y;
  enemy.hp = Math.max(1, enemy.hp);
  enemy.sleeping = false;
  state.tiles[enemy.y][enemy.x].terrain = "floor";
  state.tiles[enemy.y][enemy.x].visible = true;
  state.tiles[enemy.y][enemy.x].discovered = true;
  state.tiles[enemy.y][enemy.x].visibleMask = 15;
  state.tiles[enemy.y][enemy.x].discoveredMask = 15;
  return enemy;
};

const quickSlotWandTarget = placeVisibleQuickSlotTarget(quickSlotGame);
assert.deepEqual(
  planAutoExploreLoadoutAction(quickSlotGame),
  {
    kind: "wand",
    slotIndex: 2,
    itemRef: quickSlotWand.id,
    target: {
      x: quickSlotWandTarget.x,
      y: quickSlotWandTarget.y,
    },
  },
  "auto-explore must fire a charged loadout wand at the nearest visible enemy",
);

let healingQuickSlotGame = developerGrantItem(
  createNewGame(0x4ea11),
  "potion_healing",
);
healingQuickSlotGame.player.autoSlots = [null, null, null, null];
healingQuickSlotGame.player.hp = 1;
healingQuickSlotGame = setAutoLoadoutSlot(
  healingQuickSlotGame,
  2,
  "potion_healing",
);
assert.deepEqual(
  planAutoExploreLoadoutAction(healingQuickSlotGame),
  {
    kind: "use",
    slotIndex: 2,
    itemRef: "potion_healing",
  },
  "auto-explore must use a registered healing potion when health is low",
);

let nonHealingPotionGame = developerGrantItem(
  createNewGame(0x4ea12),
  "potion_haste",
);
nonHealingPotionGame.player.autoSlots = [null, null, null, null];
nonHealingPotionGame.player.hp = 1;
nonHealingPotionGame = setAutoLoadoutSlot(
  nonHealingPotionGame,
  2,
  "potion_haste",
);
placeVisibleQuickSlotTarget(nonHealingPotionGame);
assert.equal(
  planAutoExploreLoadoutAction(nonHealingPotionGame),
  null,
  "auto-explore must never use a non-healing potion from a flexible slot",
);

let throwableQuickSlotGame = developerGrantItem(
  createNewGame(0x4ea13),
  "throwing_knife",
);
throwableQuickSlotGame.player.autoSlots = [null, null, null, null];
const quickSlotThrowable = throwableQuickSlotGame.player.inventoryInstances.find(
  (instance) => instance.defId === "throwing_knife",
)!;
throwableQuickSlotGame = setAutoLoadoutSlot(
  throwableQuickSlotGame,
  2,
  quickSlotThrowable.id,
);
assert.equal(
  throwableQuickSlotGame.player.autoSlots[2],
  quickSlotThrowable.id,
  "an individual throwable equipment instance must be assignable to a flexible slot",
);
assert.equal(
  inventorySlotCount(throwableQuickSlotGame.player),
  1,
  "equipping the throwable in a quick slot must remove it from backpack occupancy",
);
const quickSlotMissileTarget =
  placeVisibleQuickSlotTarget(throwableQuickSlotGame);
assert.deepEqual(
  planAutoExploreLoadoutAction(throwableQuickSlotGame),
  {
    kind: "throw",
    slotIndex: 2,
    itemRef: quickSlotThrowable.id,
    target: {
      x: quickSlotMissileTarget.x,
      y: quickSlotMissileTarget.y,
    },
  },
  "auto-explore must throw a registered missile at the nearest visible enemy",
);

const blockedThrowableGame = developerGrantItem(
  createNewGame(0x4ea14),
  "throwing_knife",
);
const blockedThrowable = blockedThrowableGame.player.inventoryInstances.find(
  (instance) => instance.defId === "throwing_knife",
)!;
blockedThrowableGame.player.autoSlots = [
  null,
  null,
  blockedThrowable.id,
  null,
];
const blockedTarget = blockedThrowableGame.enemies[0];
assert.ok(blockedTarget, "blocked projectile tests require one enemy");
blockedThrowableGame.enemies = [blockedTarget];
const blockedDirection =
  blockedThrowableGame.player.x + 3 < blockedThrowableGame.width - 1
    ? 1
    : -1;
blockedTarget.x = blockedThrowableGame.player.x + blockedDirection * 3;
blockedTarget.y = blockedThrowableGame.player.y;
blockedTarget.hp = Math.max(1, blockedTarget.hp);
blockedTarget.sleeping = false;
for (let step = 1; step <= 3; step += 1) {
  const x = blockedThrowableGame.player.x + blockedDirection * step;
  blockedThrowableGame.tiles[blockedTarget.y][x].terrain = "floor";
  blockedThrowableGame.tiles[blockedTarget.y][x].visible = true;
  blockedThrowableGame.tiles[blockedTarget.y][x].discovered = true;
}
blockedThrowableGame.tiles[
  blockedTarget.y
][blockedThrowableGame.player.x + blockedDirection].terrain = "wall";
assert.equal(
  planAutoExploreLoadoutAction(blockedThrowableGame),
  null,
  "auto-explore must not spend a quick-slot projectile when terrain blocks the aimed enemy",
);

let persistentPotionSlotGame = createNewGame(0x4ea15);
persistentPotionSlotGame.player.inventory.potion_healing = 1;
persistentPotionSlotGame.player.hp = 1;
persistentPotionSlotGame = setAutoLoadoutSlot(
  persistentPotionSlotGame,
  2,
  "potion_healing",
);
const emptiedPotionSlot = consumeItemAction(
  persistentPotionSlotGame,
  "potion_healing",
);
assert.equal(
  emptiedPotionSlot.state.player.inventory.potion_healing,
  0,
  "the final healing potion must reduce its stack to zero",
);
assert.equal(
  emptiedPotionSlot.state.player.autoSlots[2],
  "potion_healing",
  "a zero-count stackable potion must remain registered in its quick slot",
);

let persistentThrowableSlotGame = developerGrantItem(
  createNewGame(0x4ea16),
  "throwing_knife",
);
persistentThrowableSlotGame.enemies = [];
persistentThrowableSlotGame = setAutoLoadoutSlot(
  persistentThrowableSlotGame,
  2,
  persistentThrowableSlotGame.player.inventoryInstances.find(
    (instance) => instance.defId === "throwing_knife",
  )!.id,
);
const persistentProfile =
  persistentThrowableSlotGame.player.inventoryInstances.find(
    (instance) => instance.defId === "throwing_knife",
  )!;
persistentProfile.upgradeLevel = 3;
persistentProfile.traits = [{
  id: "swift",
  grade: persistentProfile.grade ?? "C",
}];
const persistentThrowTarget = {
  x: persistentThrowableSlotGame.player.x + 1,
  y: persistentThrowableSlotGame.player.y,
};
persistentThrowableSlotGame.tiles[
  persistentThrowTarget.y
][persistentThrowTarget.x].terrain = "floor";
for (let count = 0; count < 3; count += 1) {
  persistentThrowableSlotGame = throwItem(
    persistentThrowableSlotGame,
    persistentProfile.id,
    persistentThrowTarget,
  ).state;
}
assert.equal(
  persistentThrowableSlotGame.player.inventoryInstances.some(
    (instance) => instance.id === persistentProfile.id,
  ),
  true,
  "spending every throwable charge must keep ownership of the equipped instance",
);
assert.equal(
  throwableChargeCount(
    persistentThrowableSlotGame.player,
    persistentProfile.id,
  ),
  0,
  "three throws must deplete the three-charge throwable profile",
);
assert.equal(
  persistentThrowableSlotGame.player.autoSlots[2],
  persistentProfile.id,
  "a zero-charge throwable instance must remain equipped in its quick slot",
);
assert.equal(
  persistentThrowableSlotGame.groundItems.filter(
    (item) =>
      item.defId === "throwing_knife" && item.recoversThrowableCharge,
  ).length,
  3,
  "each surviving thrown projectile must remain recoverable on the floor",
);
persistentThrowableSlotGame.player.x = persistentThrowTarget.x;
persistentThrowableSlotGame.player.y = persistentThrowTarget.y;
const recoveredThrowableSlotGame = pickupGroundItems(
  persistentThrowableSlotGame,
).state;
assert.equal(
  throwableChargeCount(
    recoveredThrowableSlotGame.player,
    persistentProfile.id,
  ),
  3,
  "picking up the three landed projectiles must restore all three charges",
);
assert.equal(
  recoveredThrowableSlotGame.groundItems.some(
    (item) => item.recoversThrowableCharge,
  ),
  false,
  "recovered projectile markers must leave the floor",
);
const recoveredOriginal = recoveredThrowableSlotGame.player.inventoryInstances.find(
  (instance) => instance.id === persistentProfile.id,
)!;
recoveredOriginal.charges = 1;
recoveredThrowableSlotGame.groundItems.push({
  id: "independent-throwing-knife-loot",
  defId: "throwing_knife",
  quantity: 3,
  x: recoveredThrowableSlotGame.player.x,
  y: recoveredThrowableSlotGame.player.y,
});
const reacquiredThrowableSlotGame = pickupGroundItems(
  recoveredThrowableSlotGame,
).state;
assert.equal(
  reacquiredThrowableSlotGame.player.inventoryInstances.filter(
    (instance) => instance.defId === "throwing_knife",
  ).length,
  2,
  "finding the same throwable type again must create a second equipment instance",
);
const reacquiredOriginal = reacquiredThrowableSlotGame.player.inventoryInstances.find(
  (instance) => instance.id === persistentProfile.id,
)!;
const reacquiredSeparate = reacquiredThrowableSlotGame.player.inventoryInstances.find(
  (instance) =>
    instance.defId === "throwing_knife" &&
    instance.id !== persistentProfile.id,
)!;
assert.deepEqual(
  {
    upgradeLevel: reacquiredOriginal.upgradeLevel,
    traits: reacquiredOriginal.traits,
    charges: reacquiredOriginal.charges,
    maxCharges: reacquiredOriginal.maxCharges,
    autoSlot: reacquiredThrowableSlotGame.player.autoSlots[2],
    separateId: reacquiredSeparate.id !== reacquiredOriginal.id,
    separateCharges: reacquiredSeparate.charges,
  },
  {
    upgradeLevel: 3,
    traits: [{ id: "swift", grade: persistentProfile.grade ?? "C" }],
    charges: 1,
    maxCharges: 3,
    autoSlot: persistentProfile.id,
    separateId: true,
    separateCharges: 3,
  },
  "picking up same-type throwable equipment must create a separate item without refilling the equipped instance",
);

let targetedUpgradeGame = developerGrantItem(
  createNewGame(0x0a9eade),
  "wand_frost",
);
targetedUpgradeGame = developerGrantItem(
  targetedUpgradeGame,
  "scroll_upgrade",
);
const upgradeWand = targetedUpgradeGame.player.inventoryInstances.find(
  (instance) => instance.defId === "wand_frost",
);
assert.ok(upgradeWand, "targeted upgrade tests require a wand instance");
targetedUpgradeGame = setAutoLoadoutSlot(
  targetedUpgradeGame,
  2,
  upgradeWand.id,
);
const unselectedUpgradeScroll = consumeItemAction(
  targetedUpgradeGame,
  "scroll_upgrade",
);
assert.equal(
  unselectedUpgradeScroll.consumedTurn,
  false,
  "an upgrade scroll must wait for an explicit equipment target",
);
const targetedUpgrade = upgradeItemWithScroll(
  targetedUpgradeGame,
  "scroll_upgrade",
  { kind: "playerAuto", index: 2 },
);
assert.equal(
  targetedUpgrade.consumedTurn,
  true,
  "choosing a flexible-slot wand must consume the upgrade action",
);
assert.equal(
  targetedUpgrade.state.player.inventoryInstances.find(
    (instance) => instance.id === upgradeWand.id,
  )?.upgradeLevel,
  1,
  "the selected flexible-slot wand must receive exactly one upgrade",
);
assert.equal(
  targetedUpgrade.state.player.inventory.scroll_upgrade,
  0,
  "the selected upgrade must consume one scroll",
);
assert.equal(
  targetedUpgrade.state.player.autoSlots[2],
  upgradeWand.id,
  "upgrading a flexible-slot item must preserve its registration",
);
assert.equal(
  targetedUpgrade.enchanted,
  true,
  "targeted upgrades must trigger the shared 16-by-16 equipment effect",
);

let companionUpgradeGame = developerGrantItem(
  createNewGame(0x0a9eadf),
  "wand_frost",
);
companionUpgradeGame = developerGrantItem(
  companionUpgradeGame,
  "scroll_upgrade",
);
const companionUpgradeWand = companionUpgradeGame.player.inventoryInstances.find(
  (instance) => instance.defId === "wand_frost",
)!;
companionUpgradeGame = assignCompanionItem(
  companionUpgradeGame,
  companionUpgradeGame.companions[0].id,
  { kind: "flex", index: 3 },
  companionUpgradeWand.id,
).state;
const companionUpgrade = upgradeItemWithScroll(
  companionUpgradeGame,
  "scroll_upgrade",
  {
    kind: "companionFlex",
    companionId: companionUpgradeGame.companions[0].id,
    index: 3,
  },
);
assert.equal(
  companionUpgrade.state.companions[0].autoSlots[3]?.instance?.upgradeLevel,
  1,
  "the shared loadout UI must be able to upgrade a companion-held item",
);

const thrownPotionGame = developerGrantItem(
  createNewGame(0x5a477e),
  "potion_toxic_gas",
);
thrownPotionGame.enemies = [];
const potionLanding = {
  x: thrownPotionGame.player.x + 1,
  y: thrownPotionGame.player.y,
};
thrownPotionGame.tiles[potionLanding.y][potionLanding.x].terrain = "floor";
const shatteredPotion = throwItem(
  thrownPotionGame,
  "potion_toxic_gas",
  potionLanding,
);
assert.equal(
  shatteredPotion.itemBreak,
  true,
  "a thrown potion must break on impact",
);
assert.equal(
  shatteredPotion.state.groundItems.some(
    (item) => item.defId === "potion_toxic_gas",
  ),
  false,
  "a shattered potion must not remain as a ground item",
);
assert.deepEqual(
  shatteredPotion.state.clouds[0]?.origin,
  potionLanding,
  "a field-generating potion must create its field at the impact tile",
);

let waterFireGame = developerGrantItem(
  createNewGame(0xf17e0),
  "potion_liquid_flame",
);
waterFireGame.enemies = [];
const waterLanding = {
  x: waterFireGame.player.x + 1,
  y: waterFireGame.player.y,
};
waterFireGame.tiles[waterLanding.y][waterLanding.x].terrain = "water";
waterFireGame = throwItem(
  waterFireGame,
  "potion_liquid_flame",
  waterLanding,
).state;
assert.equal(
  waterFireGame.clouds.some((cloud) => cloud.kind === "fire"),
  false,
  "fire fields must not form on water",
);

let stationaryFireGame = developerGrantItem(
  createNewGame(0xf17e1),
  "potion_liquid_flame",
);
stationaryFireGame.enemies = [];
stationaryFireGame.companions = [];
const stationaryFireLanding = {
  x: stationaryFireGame.player.x + 1,
  y: stationaryFireGame.player.y,
};
for (let y = stationaryFireLanding.y - 1; y <= stationaryFireLanding.y + 1; y += 1) {
  for (let x = stationaryFireLanding.x - 1; x <= stationaryFireLanding.x + 1; x += 1) {
    stationaryFireGame.tiles[y][x].terrain = "floor";
  }
}
stationaryFireGame = throwItem(
  stationaryFireGame,
  "potion_liquid_flame",
  stationaryFireLanding,
).state;
stationaryFireGame = runEnemyTurn(stationaryFireGame).state;
assert.equal(
  stationaryFireGame.clouds[0]?.tiles.length,
  1,
  "fire fields must not spread across ordinary floor tiles",
);

let doorFireGame = developerGrantItem(
  createNewGame(0xf17e2),
  "potion_liquid_flame",
);
doorFireGame.enemies = [];
doorFireGame.companions = [];
const doorFireLanding = {
  x: doorFireGame.player.x + 1,
  y: doorFireGame.player.y,
};
const burningDoor = {
  x: doorFireLanding.x,
  y: doorFireLanding.y + 1,
};
doorFireGame.tiles[doorFireLanding.y][doorFireLanding.x].terrain = "floor";
doorFireGame.tiles[burningDoor.y][burningDoor.x].terrain = "lockedDoor";
doorFireGame = throwItem(
  doorFireGame,
  "potion_liquid_flame",
  doorFireLanding,
).state;
doorFireGame = runEnemyTurn(doorFireGame).state;
assert.equal(
  doorFireGame.tiles[burningDoor.y][burningDoor.x].terrain,
  "floor",
  "an adjacent fire field must burn both ordinary and locked doors away",
);
assert.ok(
  doorFireGame.clouds[0]?.tiles.some(
    (tile) => tile.x === burningDoor.x && tile.y === burningDoor.y,
  ),
  "fire must jump quickly onto an adjacent door without spreading to other floor",
);

let extinguishGame = createNewGame(0xf17e3);
extinguishGame.enemies = [];
extinguishGame.companions = [];
extinguishGame.player.statuses = [{
  id: "burning",
  turns: BURNING_DURATION,
  power: 2,
}];
extinguishGame.tiles[extinguishGame.player.y][extinguishGame.player.x].terrain = "water";
extinguishGame = runEnemyTurn(extinguishGame).state;
assert.equal(
  extinguishGame.player.statuses.some((status) => status.id === "burning"),
  false,
  "stepping onto water must extinguish the long burning status immediately",
);

const fieldStatusGame = createNewGame(0xf17e31);
fieldStatusGame.enemies = [];
fieldStatusGame.companions = [];
fieldStatusGame.objects = [];
const normalMoveSpeed = getPlayerMoveSpeed(fieldStatusGame.player);
const normalAttackSpeed = getPlayerAttackSpeed(fieldStatusGame.player);
fieldStatusGame.player.statuses = [{ id: "chilled", turns: 3, power: 1 }];
assert.ok(
  getPlayerMoveSpeed(fieldStatusGame.player) < normalMoveSpeed &&
    getPlayerAttackSpeed(fieldStatusGame.player) < normalAttackSpeed,
  "a frost field's chilled status must slow both movement and attacks",
);
fieldStatusGame.player.statuses = [{ id: "paralyzed", turns: 2, power: 1 }];
const paralyzedAt = {
  x: fieldStatusGame.player.x,
  y: fieldStatusGame.player.y,
};
fieldStatusGame.tiles[paralyzedAt.y][paralyzedAt.x + 1].terrain = "floor";
const paralyzedStep = playerStep(fieldStatusGame, 1, 0);
assert.equal(
  paralyzedStep.consumedTurn,
  true,
  "a paralytic field must consume the affected player's attempted action",
);
assert.deepEqual(
  { x: paralyzedStep.state.player.x, y: paralyzedStep.state.player.y },
  paralyzedAt,
  "a paralyzed player must remain on the same tile",
);

let carriedFireGame = createNewGame(0xf17e4);
carriedFireGame.enemies = [];
carriedFireGame.companions = [];
carriedFireGame.player.statuses = [{
  id: "burning",
  turns: BURNING_DURATION,
  power: 2,
}];
carriedFireGame.tiles[carriedFireGame.player.y][carriedFireGame.player.x].terrain = "highGrass";
carriedFireGame = runEnemyTurn(carriedFireGame).state;
assert.equal(
  carriedFireGame.tiles[carriedFireGame.player.y][carriedFireGame.player.x].terrain,
  "floor",
  "a burning actor must ignite and consume brush under its feet",
);
assert.ok(
  carriedFireGame.clouds.some(
    (cloud) =>
      cloud.kind === "fire" &&
      cloud.tiles.some(
        (tile) =>
          tile.x === carriedFireGame.player.x &&
          tile.y === carriedFireGame.player.y,
      ),
  ),
  "a burning actor crossing brush or a door must leave a fire field behind",
);

let cloudGame = developerGrantItem(
  createNewGame(0xc10ad),
  "potion_toxic_gas",
);
cloudGame.enemies = [];
cloudGame = consumeItemAction(cloudGame, "potion_toxic_gas").state;
assert.equal(cloudGame.clouds[0].tiles.length, 1);
const spreadCloud = runEnemyTurn(cloudGame).state.clouds[0];
assert.ok(
  spreadCloud.tiles.length > 1,
  "a field effect must spread into neighboring tiles over time",
);
assert.equal(
  new Set(spreadCloud.tiles.map(({ x, y }) => pointKey(x, y))).size,
  spreadCloud.tiles.length,
  "field effects must be stored as distinct affected tiles",
);
const firstCloudTile = { ...cloudGame.clouds[0].origin };
cloudGame.player.hp = 999;
cloudGame.player.maxHp = 999;
for (let turn = 0; turn < cloudGame.clouds[0].tileLifetime; turn += 1) {
  cloudGame = runEnemyTurn(cloudGame).state;
}
assert.ok(
  cloudGame.clouds[0]?.tiles.length > 0,
  "newer field tiles must remain after the oldest tile expires",
);
assert.equal(
  cloudGame.clouds[0].tiles.some(
    (tile) => tile.x === firstCloudTile.x && tile.y === firstCloudTile.y,
  ),
  false,
  "field tiles must disappear in creation order instead of all at once",
);

assert.equal(
  blocksSight("highGrass"),
  true,
  "an untouched bush must block sight",
);
let grassGame = createNewGame(0x6a455);
grassGame.enemies = [];
const grassTarget = {
  x: grassGame.player.x + 1,
  y: grassGame.player.y,
};
grassGame.tiles[grassTarget.y][grassTarget.x].terrain = "highGrass";
grassGame = playerStep(grassGame, 1, 0).state;
assert.equal(
  grassGame.tiles[grassTarget.y][grassTarget.x].terrain,
  "grass",
  "stepping onto a bush must trample it into non-opaque grass",
);
assert.equal(
  HIGH_GRASS_SEED_DROP_CHANCE,
  0.05,
  "trampled bushes must use the requested five-percent seed chance",
);
const seedDropGame = createNewGame(0x5eed05);
seedDropGame.enemies = [];
seedDropGame.companions = [];
seedDropGame.objects = [];
seedDropGame.groundItems = [];
seedDropGame.rng = 1972;
const seedDropTarget = {
  x: seedDropGame.player.x + 1,
  y: seedDropGame.player.y,
};
seedDropGame.tiles[seedDropTarget.y][seedDropTarget.x].terrain = "highGrass";
const seededGrass = playerStep(seedDropGame, 1, 0).state;
const droppedSeeds = seededGrass.groundItems.filter(
  (item) =>
    item.x === seedDropTarget.x &&
    item.y === seedDropTarget.y &&
    SEED_ITEM_IDS.includes(item.defId as (typeof SEED_ITEM_IDS)[number]),
);
assert.equal(
  droppedSeeds.length,
  1,
  "a successful high-grass roll must drop exactly one catalog seed on that tile",
);

let brushFireGame = developerGrantItem(
  createNewGame(0xb1254),
  "potion_liquid_flame",
);
brushFireGame.enemies = [];
const brushLanding = {
  x: brushFireGame.player.x + 1,
  y: brushFireGame.player.y,
};
for (let y = brushLanding.y - 1; y <= brushLanding.y + 1; y += 1) {
  for (let x = brushLanding.x - 1; x <= brushLanding.x + 1; x += 1) {
    brushFireGame.tiles[y][x].terrain = "grass";
  }
}
brushFireGame = throwItem(
  brushFireGame,
  "potion_liquid_flame",
  brushLanding,
).state;
brushFireGame.player.hp = 999;
brushFireGame.player.maxHp = 999;
brushFireGame = runEnemyTurn(brushFireGame).state;
assert.ok(
  brushFireGame.clouds[0].tiles.length >= 6,
  "fire must spread especially quickly through intact or trampled brush",
);

let corruptionGame = createNewGame(0xc077a7);
corruptionGame.enemies = [];
corruptionGame.companions = [];
corruptionGame.player.inventory = {};
corruptionGame.player.inventoryInstances = [];
corruptionGame = developerGrantItem(corruptionGame, "wand_corruption");
const corruptedWand = corruptionGame.player.inventoryInstances[0];
const allyPoint = {
  x: corruptionGame.player.x + 1,
  y: corruptionGame.player.y,
};
const hostilePoint = {
  x: corruptionGame.player.x + 2,
  y: corruptionGame.player.y,
};
for (let x = corruptionGame.player.x; x <= hostilePoint.x; x += 1) {
  corruptionGame.tiles[allyPoint.y][x].terrain = "floor";
}
const enemyTemplate = developerSpawnEnemy(
  createNewGame(0xc077aa),
  "rat",
).enemies.find((enemy) => enemy.id.startsWith("developer-"))!;
corruptionGame.enemies = [
  {
    ...enemyTemplate,
    id: "corruption-ally",
    ...allyPoint,
    statuses: [],
  },
  {
    ...enemyTemplate,
    id: "corruption-hostile",
    ...hostilePoint,
    statuses: [],
  },
];
const corrupted = zapWand(
  corruptionGame,
  corruptedWand.id,
  allyPoint,
).state;
assert.ok(
  corrupted.enemies[0].statuses.some(({ id }) => id === "corrupted"),
  "the corruption wand must apply the allied corruption status",
);
const corruptionTurn = runEnemyTurn(corrupted);
assert.ok(
  corruptionTurn.motions.some(
    (motion) =>
      motion.id === "corruption-ally" &&
      motion.kind === "attack" &&
      motion.to.x === hostilePoint.x,
  ),
  "a corrupted enemy must attack another enemy instead of the player",
);

let speedGame = createNewGame(0x5eed15);
speedGame.enemies = [];
speedGame.objects = [];
speedGame.player.x = 10;
speedGame.player.y = 10;
speedGame.player.statuses = [{ id: "haste", turns: 20, power: 1 }];
for (let x = 10; x <= 13; x += 1) {
  speedGame.tiles[10][x].terrain = "floor";
}
assert.equal(
  getPlayerMoveSpeed(speedGame.player),
  1.5,
  "haste must produce the requested 1.5x movement speed",
);
const speedTurnPattern: number[] = [];
for (let step = 0; step < 3; step += 1) {
  const result = playerStep(speedGame, 1, 0);
  speedTurnPattern.push(result.elapsedTurns ?? -1);
  speedGame = result.state;
}
assert.deepEqual(
  speedTurnPattern,
  [0, 1, 1],
  "1.5x movement must spend exactly two world turns for three cells",
);
assert.ok(
  speedGame.player.actionProgress < 0.001,
  "three 1.5x moves must finish on an exact world-turn boundary",
);

let attackSpeedGame = createNewGame(0xf00f0a);
attackSpeedGame.player.x = 10;
attackSpeedGame.player.y = 10;
attackSpeedGame.tiles[10][10].terrain = "floor";
attackSpeedGame.tiles[10][11].terrain = "floor";
attackSpeedGame.player.equipment.ring = "ring_furor";
attackSpeedGame.enemies = [{
  ...enemyTemplate,
  id: "speed-dummy",
  x: 11,
  y: 10,
  hp: 999,
  maxHp: 999,
  defense: 999,
  evasion: 0,
  sleeping: false,
  statuses: [],
}];
assert.equal(
  getPlayerAttackSpeed(attackSpeedGame.player),
  1.25,
  "the ring of furor must increase attack speed",
);
const attackTurnPattern: number[] = [];
for (let strike = 0; strike < 4; strike += 1) {
  const result = playerStep(attackSpeedGame, 1, 0);
  attackTurnPattern.push(result.elapsedTurns ?? -1);
  attackSpeedGame = result.state;
}
assert.deepEqual(
  attackTurnPattern,
  [0, 1, 1, 1],
  "1.25x attack speed must spend three world turns for four attacks",
);
const fourRingGame = createNewGame(0x3a11);
fourRingGame.player.equipment.ring = "ring_furor";
fourRingGame.player.equipment.ring2 = "ring_furor";
fourRingGame.player.equipment.ring3 = "ring_haste";
fourRingGame.player.equipment.ring4 = "ring_haste";
assert.equal(
  getPlayerAttackSpeed(fourRingGame.player),
  1.56,
  "all four flexible ring slots must participate in attack-speed calculations",
);
assert.equal(
  getPlayerMoveSpeed(fourRingGame.player),
  1.56,
  "the fourth ring slot must participate in movement-speed calculations",
);

const comparisonGame = createNewGame(0xbe77e2);
comparisonGame.player.inventory = {};
comparisonGame.player.inventoryInstances = [];
comparisonGame.groundItems = [{
  id: "better-weapon",
  defId: "greatsword",
  instance: createPlainEquipmentInstance(
    ITEM_DEFS.greatsword,
    "comparison-better-weapon",
  ),
  x: comparisonGame.player.x,
  y: comparisonGame.player.y,
}];
const comparisonPickup = pickupGroundItems(comparisonGame);
assert.equal(
  comparisonPickup.state.equipmentOffers.length,
  1,
  "picking up a superior equipment item must create a comparison offer",
);
assert.equal(
  comparisonPickup.state.equipmentOffers[0].expiresTurn -
    comparisonPickup.state.turn,
  10,
  "the comparison offer must remain for ten complete turns",
);
const acceptedComparison = acceptEquipmentOffer(
  comparisonPickup.state,
  comparisonPickup.state.equipmentOffers[0].id,
);
assert.equal(
  acceptedComparison.state.player.equipment.weapon,
  "greatsword",
  "accepting a comparison offer must equip the superior item",
);

let expiringComparison = comparisonPickup.state;
for (let turn = 0; turn < 10; turn += 1) {
  expiringComparison = waitTurn(expiringComparison).state;
}
assert.equal(
  expiringComparison.equipmentOffers.length,
  0,
  "an unanswered equipment comparison must disappear after ten turns",
);

const exploreGame = createNewGame(0xa070e);
exploreGame.enemies = [];
exploreGame.objects = [];
exploreGame.groundItems = [];
exploreGame.player.x = 10;
exploreGame.player.y = 10;
exploreGame.tiles.forEach((row) =>
  row.forEach((tile) => {
    tile.discovered = true;
  }),
);
exploreGame.tiles[10][10].terrain = "floor";
exploreGame.tiles[10][11].terrain = "floor";
exploreGame.tiles[10][11].discovered = false;
const explorePlan = planAutoExplore(exploreGame);
assert.equal(
  explorePlan?.kind,
  "frontier",
  "auto exploration must target a reachable unexplored frontier",
);
assert.deepEqual(
  explorePlan?.path[0],
  { x: 11, y: 10 },
  "auto exploration must step toward the selected frontier",
);

const workbenchExploreGame = createNewGame(0xa1c0de);
workbenchExploreGame.enemies = [];
workbenchExploreGame.groundItems = [];
workbenchExploreGame.tiles.forEach((row) =>
  row.forEach((tile) => {
    tile.discovered = true;
  }),
);
const workbenchPoint = {
  x: workbenchExploreGame.player.x + 1,
  y: workbenchExploreGame.player.y,
};
workbenchExploreGame.tiles[workbenchPoint.y][workbenchPoint.x].terrain = "floor";
workbenchExploreGame.objects = [{
  id: "auto-explore-workbench",
  kind: "alchemy",
  looted: false,
  loot: [],
  ...workbenchPoint,
}];
assert.equal(
  planAutoExplore(workbenchExploreGame),
  null,
  "auto exploration must ignore the reusable alchemy workbench instead of retrying it forever",
);

const fullBagExploreGame = createNewGame(0xf011ba9);
fullBagExploreGame.enemies = [];
fullBagExploreGame.objects = [];
fullBagExploreGame.tiles.forEach((row) =>
  row.forEach((tile) => {
    tile.discovered = true;
  }),
);
fullBagExploreGame.player.inventory = {};
fullBagExploreGame.player.inventoryInstances = Array.from(
  { length: MAX_INVENTORY_SLOTS },
  (_, index) => ({
    id: `full-bag-${index}`,
    defId: "rusty_sword",
  }),
);
fullBagExploreGame.groundItems = [{
  id: "ignored-full-bag-item",
  defId: "potion_healing",
  x: fullBagExploreGame.player.x,
  y: fullBagExploreGame.player.y,
}];
assert.equal(
  planAutoExplore(fullBagExploreGame)?.kind,
  "item",
  "the default full-bag policy must still identify the blocking item",
);
assert.equal(
  planAutoExplore(fullBagExploreGame, {
    ignoreUnpickableItems: true,
  }),
  null,
  "the continue policy must ignore items that cannot fit in a full bag",
);

const fullBagGoldGame = createNewGame(0x601db49);
fullBagGoldGame.enemies = [];
fullBagGoldGame.player.inventory = {};
fullBagGoldGame.player.inventoryInstances = Array.from(
  { length: MAX_INVENTORY_SLOTS },
  (_, index) => ({
    id: `gold-full-bag-${index}`,
    defId: "rusty_sword",
  }),
);
fullBagGoldGame.groundItems = [{
  id: "full-bag-gold",
  defId: "gold",
  quantity: 321,
  x: fullBagGoldGame.player.x,
  y: fullBagGoldGame.player.y,
  lootOrigin: "dungeon",
}];
assert.equal(
  canPickupGroundItem(fullBagGoldGame, fullBagGoldGame.groundItems[0]),
  true,
  "gold must remain collectible when every inventory slot is occupied",
);
const pickedFullBagGold = pickupGroundItems(fullBagGoldGame, false);
assert.equal(pickedFullBagGold.state.goldCollected, 321);
assert.equal(pickedFullBagGold.state.player.inventoryInstances.length, MAX_INVENTORY_SLOTS);
assert.equal(
  pickedFullBagGold.state.groundItems.some((item) => item.id === "full-bag-gold"),
  false,
  "collected gold must leave the floor without entering the inventory",
);

const pixelOrigin = {
  idPrefix: "smoke",
  x: 24,
  y: 36,
  startedAt: 100,
};
const fixedRandom = () => 0.5;
const dustEffects = createDustEffects(pixelOrigin, fixedRandom);
const waterTerrain = Array.from({ length: 3 }, () =>
  Array.from({ length: 3 }, () => ({ terrain: "floor" })),
);
waterTerrain[0][0].terrain = "water";
waterTerrain[0][1].terrain = "water";
waterTerrain[1][1].terrain = "water";
waterTerrain[2][2].terrain = "water";
const connectedWater = connectedWaterTiles(waterTerrain, {
  x: 0,
  y: 0,
});
const waterEffects = createWaterRippleEffects(
  pixelOrigin,
  connectedWater,
);
const bankMaskedWaterEffects = createWaterRippleEffects(
  pixelOrigin,
  [{ x: 0, y: 0, surfaceRows: isolatedWaterSurfaceRows }],
);
const largeWaterEffects = createWaterRippleEffects(
  pixelOrigin,
  Array.from({ length: 100 }, (_, index) => ({
    x: index % 10,
    y: Math.floor(index / 10),
  })),
);
const hitEffects = createHitEffects(
  { ...pixelOrigin, strong: true },
  fixedRandom,
);
const enchantEffects = createEnchantEffects(pixelOrigin, fixedRandom);
const levelEffects = createLevelUpEffects(pixelOrigin, fixedRandom);
const skillEffectsById = COMPANION_SKILL_IDS.map((skillId, index) => ({
  skillId,
  effects: createCompanionSkillEffects(
    (() => {
      const blueprint = companionSkillBlueprint(skillId);
      return {
      id: `skill-pixel-test-${skillId}`,
      skillId,
      from: { x: 2, y: 2 },
      to: { x: 5 + (index % 2), y: 4 },
      accent: COMPANION_SKILLS[skillId].accent,
        travelMode: blueprint.travelMode,
        impactMode: blueprint.impactMode,
        radius: blueprint.scalars.radius ?? 0,
      };
    })(),
    100,
    48,
  ),
}));
assert.equal(
  dustEffects.some((effect) => effect.kind === "particle"),
  true,
  "walking dust must contain pixel particles",
);
assert.equal(
  dustEffects.filter((effect) => effect.kind === "particle").length >= 14,
  true,
  "walking dust must contain enough bright pixels to read at gameplay zoom",
);
assert.equal(
  [...dustEffects, ...hitEffects, ...enchantEffects].every(
    (effect) =>
      effect.worldPixelSize === 3 &&
      effect.clipBounds?.width === 48 &&
      effect.clipBounds.height === 48,
  ),
  true,
  "walk, hit, and enchant effects must use one clipped 16×16 tile pixel grid",
);
assert.ok(
  enchantEffects.filter((effect) => effect.kind === "particle").length >= 24 &&
    enchantEffects.some((effect) => effect.kind === "ring"),
  "equipment enchanting must combine dense equipment pixels with a ring flash",
);
assert.equal(
  [...dustEffects, ...hitEffects]
    .filter((effect) => effect.kind === "particle")
    .every((effect) => effect.cellSize === 1 || effect.cellSize === 2),
  true,
  "walk and hit particles must use one- or two-cell marks on the 16×16 tile grid",
);
assert.ok(
  skillEffectsById.every(
    ({ effects }) => effects.length > 0,
  ),
  "every manual skill must resolve to a specialized particle recipe",
);
assert.deepEqual(
  Object.keys(SKILL_PARTICLE_RECIPES).sort(),
  [...COMPANION_SKILL_IDS].sort(),
  "the specialized particle recipe table must cover every registered skill",
);
assert.ok(
  skillEffectsById.every(({ effects }) =>
    effects
      .filter((effect) => effect.kind === "particle")
      .every((effect) => effect.cellSize === 1 || effect.cellSize === 2),
  ),
  "manual skill sparks must remain crisp one- or two-pixel marks",
);
assert.ok(
  skillEffectsById.every(({ effects }) =>
    effects
      .filter((effect) => effect.kind === "particle" || effect.kind === "ring")
      .every((effect) => effect.worldPixelSize === 3),
  ),
  "all transient skill marks must snap to the logical 16×16 pixel scale",
);
const shockLeapSignature = skillEffectsById
  .find(({ skillId }) => skillId === "shockLeap")!
  .effects.map((effect) => effect.id)
  .join("|");
const shadowStepSignature = skillEffectsById
  .find(({ skillId }) => skillId === "shadowStep")!
  .effects.map((effect) => effect.id)
  .join("|");
assert.match(
  shockLeapSignature,
  /takeoff|landing/,
  "leap recipes must contain explicit takeoff and landing phases",
);
assert.match(
  shadowStepSignature,
  /depart|arrive|collapse/,
  "teleport recipes must contain disappearance and reappearance phases",
);
assert.doesNotMatch(
  shadowStepSignature,
  /takeoff/,
  "teleports must not reuse the leap travel trail",
);
const upgradedFireballEffects = createCompanionSkillEffects(
  {
    id: "upgraded-fireball",
    skillId: "fireball",
    from: { x: 2, y: 2 },
    to: { x: 7, y: 2 },
    accent: COMPANION_SKILLS.fireball.accent,
    travelMode: "none",
    impactMode: "burst",
    radius: 2,
    rank: 2,
    variants: ["power-up"],
    semanticOverride: false,
  },
  100,
  48,
);
assert.ok(
  upgradedFireballEffects.some((effect) =>
    effect.id.includes("projectile-thrust"),
  ) && upgradedFireballEffects.some((effect) => effect.id.includes("upgrade")),
  "scalar-only upgrades must preserve the base skill identity and add a rank accent",
);
const derivedChainPaths = [
  { from: { x: 2, y: 2 }, to: { x: 5, y: 2 } },
  { from: { x: 5, y: 2 }, to: { x: 6, y: 4 } },
];
const accentChainEffects = createCompanionSkillEffects(
  {
    id: "accent-chain",
    skillId: "chainLightning",
    from: derivedChainPaths[0].from,
    to: derivedChainPaths[0].to,
    accent: "#ff66cc",
    travelMode: "none",
    impactMode: "fragments",
    radius: 0,
    rank: 2,
    variants: ["pink-lightning"],
    semanticOverride: false,
    accentOverride: true,
    paths: derivedChainPaths,
  },
  100,
  48,
);
assert.ok(
  accentChainEffects.some((effect) => effect.id.includes("chain-1")) &&
    accentChainEffects.some((effect) => effect.color === "#ff66cc"),
  "accent-only chain upgrades must preserve every branched path while recoloring pixels",
);
const semanticChainEffects = createCompanionSkillEffects(
  {
    id: "semantic-chain",
    skillId: "chainLightning",
    from: derivedChainPaths[0].from,
    to: derivedChainPaths[0].to,
    accent: "#81e6ff",
    travelMode: "none",
    impactMode: "shockwave",
    radius: 0,
    rank: 2,
    variants: ["thunder-front"],
    semanticOverride: true,
    paths: derivedChainPaths,
  },
  100,
  48,
);
assert.ok(
  semanticChainEffects.some((effect) => effect.id.includes("derived-path-1")),
  "semantic chain variants must retain all rule-provided lightning branches",
);
const companionTripleEffects = createCompanionSkillEffects(
  {
    id: "companion-triple-timing",
    skillId: "tripleStrike",
    from: { x: 2, y: 2 },
    to: { x: 3, y: 2 },
    accent: COMPANION_SKILLS.tripleStrike.accent,
    travelMode: "none",
    impactMode: "slash",
    radius: 0,
    sourceId: "companion-timing-test",
  },
  100,
  48,
);
const tripleImpactStep = COMPANION_ATTACK_DURATION + ATTACK_SEQUENCE_GAP;
const tripleFirstImpact =
  100 + ATTACK_START_DELAY + COMPANION_ATTACK_DURATION * 0.52;
assert.deepEqual(
  [
    companionTripleEffects.find(
      (effect) => effect.kind === "ring" && effect.id.includes("one-slash"),
    )?.startedAt,
    companionTripleEffects.find(
      (effect) => effect.kind === "ring" && effect.id.includes("two-slash"),
    )?.startedAt,
    Math.min(
      ...companionTripleEffects
        .filter((effect) => effect.id.includes("three-thrust"))
        .map((effect) => effect.startedAt),
    ),
  ],
  [
    tripleFirstImpact,
    tripleFirstImpact + tripleImpactStep,
    tripleFirstImpact + tripleImpactStep * 2,
  ],
  "each Triple Strike particle phase must match its scheduled attack impact",
);
const shockLeapEffects = skillEffectsById.find(
  ({ skillId }) => skillId === "shockLeap",
)!.effects;
assert.ok(
  shockLeapEffects
    .filter((effect) => effect.id.includes("landing"))
    .every((effect) => effect.startedAt >= 100 + SKILL_LEAP_DURATION - 10),
  "leap landing particles must wait until the actor reaches the destination",
);
const synchronizedFireballEffects = skillEffectsById.find(
  ({ skillId }) => skillId === "fireball",
)!.effects;
const lastFireballPathStart = Math.max(
  ...synchronizedFireballEffects
    .filter((effect) => effect.id.includes("projectile-thrust"))
    .map((effect) => effect.startedAt),
);
const firstFireballImpact = Math.min(
  ...synchronizedFireballEffects
    .filter(
      (effect) =>
        effect.id.includes("impact") || effect.id.includes("area-"),
    )
    .map((effect) => effect.startedAt),
);
assert.ok(
  firstFireballImpact >= lastFireballPathStart,
  "ranged impact particles must not explode before the projectile reaches its last tile",
);

const directionalFragments = createFragmentParticles(
  {
    idPrefix: "directional-fragments",
    point: { x: 2, y: 2 },
    startedAt: 100,
    palette: ["#fff", "#ccc"],
    tileSize: 48,
    random: () => 0.5,
    clip: "none",
  },
  {
    direction: { x: 1, y: 0 },
    spreadRadians: Math.PI / 2,
    count: 16,
    upwardBiasPixels: 0,
    gravityPixels: 0,
  },
);
assert.ok(
  directionalFragments.every((effect) => effect.velocityX > 0),
  "directional fragments must fly only into the configured forward half-plane",
);
const directionalWave = createShockwaveParticles(
  {
    idPrefix: "directional-wave",
    point: { x: 2, y: 2 },
    startedAt: 100,
    palette: ["#fff"],
    tileSize: 48,
    random: fixedRandom,
    clip: "none",
  },
  { direction: { x: 1, y: 0 }, sweepRadians: Math.PI / 2 },
);
assert.ok(
  directionalWave.every(
    (effect) => Math.abs(effect.sweepAngle ?? 0) === Math.PI / 2,
  ),
  "shockwaves must support a one-sided configurable sweep",
);
const radialWave = createShockwaveParticles({
  idPrefix: "radial-wave",
  point: { x: 2, y: 2 },
  startedAt: 100,
  palette: ["#fff"],
  tileSize: 48,
  random: fixedRandom,
  clip: "none",
});
assert.ok(
  radialWave.every(
    (effect) => Math.abs(effect.sweepAngle ?? 0) === Math.PI * 2,
  ),
  "shockwaves must remain radial when no direction is supplied",
);
const thrustParticles = createThrustParticles(
  {
    idPrefix: "thrust-test",
    from: { x: 1, y: 1 },
    to: { x: 5, y: 1 },
    startedAt: 100,
    palette: ["#fff"],
    tileSize: 48,
    random: fixedRandom,
  },
  { densityPerTile: 4, widthPixels: 2 },
);
assert.ok(
  thrustParticles.every(
    (effect) => effect.kind !== "particle" || Math.abs(effect.velocityY) < 0.001,
  ),
  "horizontal thrust particles must remain in a narrow forward path",
);
const unclippedThrustParticles = createThrustParticles(
  {
    idPrefix: "unclipped-thrust-test",
    from: { x: 1, y: 1 },
    to: { x: 5, y: 1 },
    startedAt: 100,
    palette: ["#fff"],
    tileSize: 48,
    random: fixedRandom,
    clip: "none",
  },
  { densityPerTile: 2 },
);
assert.ok(
  unclippedThrustParticles.every((effect) => !effect.clipBounds),
  "the reusable thrust emitter must honor unclipped multi-tile effects",
);
const clockwiseSlash = createSlashParticles(
  {
    idPrefix: "clockwise-slash",
    point: { x: 2, y: 2 },
    startedAt: 100,
    palette: ["#fff"],
    tileSize: 48,
    random: fixedRandom,
    clip: "none",
  },
  { direction: { x: 1, y: 0 }, clockwise: true },
);
const counterSlash = createSlashParticles(
  {
    idPrefix: "counter-slash",
    point: { x: 2, y: 2 },
    startedAt: 100,
    palette: ["#fff"],
    tileSize: 48,
    random: fixedRandom,
    clip: "none",
  },
  { direction: { x: 1, y: 0 }, clockwise: false },
);
const clockwiseFront = clockwiseSlash.find((effect) => effect.kind === "ring");
const counterFront = counterSlash.find((effect) => effect.kind === "ring");
assert.ok(
  clockwiseFront?.revealProgress &&
    counterFront?.revealProgress &&
    Math.sign(clockwiseFront.sweepAngle ?? 0) ===
      -Math.sign(counterFront.sweepAngle ?? 0),
  "clockwise and counter-clockwise slash fronts must reveal in opposite directions",
);

const whirlwindCenter = { x: 4, y: 4 };
const whirlwindAffectedTiles = particleFootprintTiles(whirlwindCenter, {
  radiusTiles: 1,
});
const whirlwindVisual = {
  id: "whirlwind-footprint-test",
  skillId: "whirlwind" as const,
  from: whirlwindCenter,
  to: whirlwindCenter,
  accent: COMPANION_SKILLS.whirlwind.accent,
  travelMode: "none" as const,
  impactMode: "slash" as const,
  radius: 1,
  affectedTiles: whirlwindAffectedTiles,
};
const whirlwindEffectsAt = (tileSize: number) =>
  createCompanionSkillEffects(whirlwindVisual, 100, tileSize);
const whirlwindTileSetAt = (tileSize: number) => new Set(
  whirlwindEffectsAt(tileSize)
    .filter(
      (effect) =>
        effect.kind === "particle" && effect.id.includes("area-footprint"),
    )
    .map((effect) =>
      pointKey(
        Math.floor(effect.x / tileSize),
        Math.floor(effect.y / tileSize),
      ),
    ),
);
const expectedWhirlwindNeighbors = new Set(
  whirlwindAffectedTiles
    .filter(({ x, y }) => x !== whirlwindCenter.x || y !== whirlwindCenter.y)
    .map(({ x, y }) => pointKey(x, y)),
);
for (const tileSize of [32, 48, 64]) {
  assert.deepEqual(
    whirlwindTileSetAt(tileSize),
    expectedWhirlwindNeighbors,
    `Whirlwind must mark all eight attacked neighbor tiles at tile size ${tileSize}`,
  );
  assert.ok(
    whirlwindEffectsAt(tileSize)
      .filter((effect) => effect.kind === "particle" || effect.kind === "ring")
      .every((effect) => effect.worldPixelSize === tileSize / 16),
    "tile resolution must remain exactly 16 logical cells regardless of world tile size",
  );
  assert.ok(
    whirlwindEffectsAt(tileSize)
      .filter((effect) => effect.kind === "particle")
      .every((effect) => effect.cellSize === 1 || effect.cellSize === 2),
    "particle mark thickness must stay independent from multi-tile effect reach",
  );
}
const wideFootprint = particleFootprintTiles(whirlwindCenter, {
  radiusTiles: 2,
});
assert.equal(
  wideFootprint.length,
  25,
  "a two-tile derived area must cover the full Chebyshev 5×5 footprint",
);
const forwardFootprint = particleFootprintTiles(whirlwindCenter, {
  radiusTiles: 2,
  direction: { x: 1, y: 0 },
  sweepRadians: Math.PI,
});
assert.ok(
  forwardFootprint.every((point) => point.x >= whirlwindCenter.x),
  "directional footprints must support a forward-only half-plane",
);
const budgetedFootprintContext = {
  idPrefix: "budgeted-footprint",
  point: whirlwindCenter,
  startedAt: 100,
  palette: ["#fff", "#ddd"],
  tileSize: 48,
  random: fixedRandom,
  clip: "none" as const,
};
const budgetedFootprint = createFootprintFragmentParticles(
  budgetedFootprintContext,
  { radiusTiles: 4, countPerTile: 5, maxParticles: 144 },
);
assert.equal(budgetedFootprint.length, 144);
assert.equal(
  new Set(
    budgetedFootprint.map((effect) =>
      pointKey(Math.floor(effect.x / 48), Math.floor(effect.y / 48)),
    ),
  ).size,
  81,
  "particle budgeting must preserve at least one mark in every affected tile",
);
assert.deepEqual(
  createFootprintFragmentParticles(
    budgetedFootprintContext,
    { radiusTiles: 4, countPerTile: 5, maxParticles: 144 },
  ).map(({ id }) => id),
  budgetedFootprint.map(({ id }) => id),
  "footprint particle counts and ids must remain deterministic within the budget",
);
const crowdedDerivedFootprint = particleFootprintTiles(
  { x: 12, y: 12 },
  { radiusTiles: 4 },
);
const crowdedDerivedEffects = createCompanionSkillEffects(
  {
    id: "crowded-derived-footprint",
    skillId: "chainLightning",
    from: { x: 1, y: 1 },
    to: { x: 12, y: 12 },
    accent: COMPANION_SKILLS.chainLightning.accent,
    travelMode: "none",
    impactMode: "shockwave",
    radius: 4,
    affectedTiles: crowdedDerivedFootprint,
    semanticOverride: true,
    paths: Array.from({ length: 8 }, (_, index) => ({
      from: { x: 1, y: 1 + index },
      to: { x: 12, y: 12 + index },
    })),
  },
  100,
  48,
);
assert.ok(crowdedDerivedEffects.length <= 256);
assert.equal(
  new Set(
    crowdedDerivedEffects
      .filter(
        (effect) =>
          effect.kind === "particle" && effect.id.includes("area-footprint"),
      )
      .map((effect) =>
        pointKey(Math.floor(effect.x / 48), Math.floor(effect.y / 48)),
      ),
  ).size,
  81,
  "the global skill budget must preserve every footprint tile before decorative paths",
);

const leapMidpoint = sampleTravelMotion("leap", 0.5);
const teleportStart = sampleTravelMotion("teleport", 0.25);
const teleportMiddle = sampleTravelMotion("teleport", 0.5);
const teleportEnd = sampleTravelMotion("teleport", 0.75);
assert.ok(
  leapMidpoint.spriteLift > 0.35 && leapMidpoint.positionProgress === 0.5,
  "leap travel must arc above the ground while crossing space",
);
assert.deepEqual(
  [teleportStart.positionProgress, teleportMiddle.opacity, teleportEnd.positionProgress],
  [0, 0, 1],
  "teleport travel must disappear and snap without crossing intermediate tiles",
);

const baseShockLeap = companionSkillBlueprint("shockLeap");
const upgradedShockLeap = deriveCompanionSkill("shockLeap", [{
  id: "wide-impact",
  scalarChanges: {
    power: { multiply: 1.25 },
    radius: { add: 1 },
  },
  addMechanics: ["status"],
  impactMode: "fragments",
  areaAnchor: "caster",
}]);
assert.equal(baseShockLeap.scalars.radius, 1);
assert.equal(upgradedShockLeap.scalars.radius, 2);
assert.equal(upgradedShockLeap.scalars.power, 2);
assert.equal(upgradedShockLeap.mechanics.includes("status"), true);
assert.equal(upgradedShockLeap.impactMode, "fragments");
assert.equal(upgradedShockLeap.areaAnchor, "caster");
assert.equal(
  companionSkillBlueprint("whirlwind").areaAnchor,
  "caster",
  "caster-centered area skills must declare their footprint anchor in data",
);
assert.equal(
  companionSkillBlueprint("shockLeap").scalars.radius,
  1,
  "derived upgrades must never mutate the immutable base skill blueprint",
);
const fireballSkillEffects = skillEffectsById.find(
  ({ skillId }) => skillId === "fireball",
)?.effects ?? [];
assert.ok(
  new Set(
    fireballSkillEffects
      .flatMap((effect) =>
        effect.kind === "particle" && effect.id.includes("area-")
          ? [`${Math.floor(effect.x / 48)},${Math.floor(effect.y / 48)}`]
          : [],
      ),
  ).size >= 9,
  "area skills must scatter 16×16 particles across every affected neighboring tile",
);
assert.ok(
  fireballSkillEffects
    .filter(
      (effect) => effect.kind === "particle" && effect.id.includes("area-"),
    )
    .every((effect) => !effect.clipBounds),
  "transient area fragments must be free to fly across tile boundaries",
);
const fieldKinds = [
  "fire",
  "frost",
  "paralytic",
  "toxic",
  "corrosive",
  "storm",
] as const;
const fieldPixelsByKind = fieldKinds.map((kind, index) => ({
  kind,
  pixels: fieldTilePixels(kind, 900, index * 17),
}));
assert.ok(
  fieldPixelsByKind.every(({ pixels }) => pixels.length >= 15),
  "every persistent field must render a dense animated pixel pattern",
);
assert.ok(
  fieldPixelsByKind.every(({ pixels }) =>
    pixels.every(
      (pixel) =>
        pixel.x >= 0 &&
        pixel.y >= 0 &&
        pixel.x + pixel.size <= 16 &&
        pixel.y + pixel.size <= 16 &&
        (pixel.size === 1 || pixel.size === 2),
    ),
  ),
  "all field particles must stay inside their own 16×16 logical tile",
);
assert.equal(
  new Set(
    fieldPixelsByKind.map(({ pixels }) =>
      pixels.map((pixel) => `${pixel.x},${pixel.y},${pixel.color}`).join("|"),
    ),
  ).size,
  fieldKinds.length,
  "fire, frost, paralysis, poison, corrosion, and storm fields must use distinct patterns",
);
const burningPixels = burningStatusPixels(900, 23);
assert.ok(
  burningPixels.length >= 18 &&
    burningPixels.every(
      (pixel) =>
        pixel.x >= 0 &&
        pixel.y >= 0 &&
        pixel.x + pixel.size <= 16 &&
        pixel.y + pixel.size <= 16,
    ),
  "burning actors must carry a dense 16×16 fire effect",
);
assert.equal(
  connectedWater.length,
  3,
  "a water step must limit its frontier to the connected puddle",
);
assert.equal(
  waterEffects.length === 1 &&
    waterEffects[0].kind === "waterFrontier" &&
    waterEffects[0].rings.length > 16 &&
    waterEffects[0].edgeRings.some((ring) => ring.length > 0),
  true,
  "water footsteps must create one cached 16px frontier and a puddle-edge hold",
);
const bankMaskedWater =
  bankMaskedWaterEffects[0]?.kind === "waterFrontier"
    ? bankMaskedWaterEffects[0]
    : null;
assert.ok(
  bankMaskedWater,
  "a bank-masked puddle must still create a water frontier",
);
assert.equal(
  bankMaskedWater.rings.some((ring) => {
    for (let index = 0; index < ring.length; index += 2) {
      if (ring[index] === 0 && ring[index + 1] === 0) return true;
    }
    return false;
  }),
  false,
  "water frontiers must follow the puddle silhouette instead of the square tile corner",
);
assert.equal(
  bankMaskedWater.expansionDuration >= 620 &&
    bankMaskedWater.fadeDuration === 70 &&
    bankMaskedWater.duration === 820,
  true,
  "the one-pixel wave must keep its existing total lifetime",
);
assert.match(
  readFileSync("app/presentation/pixel-effects.ts", "utf8"),
  /const alpha = Math\.max\(0, 1 - elapsed \/ effect\.duration\)/,
  "water ripples must begin fading immediately after creation",
);
const largeWater =
  largeWaterEffects[0]?.kind === "waterFrontier"
    ? largeWaterEffects[0]
    : null;
assert.ok(largeWater, "a large connected puddle must create one frontier");
assert.equal(
  largeWater.duration < largeWater.expansionDuration &&
    largeWater.holdDuration === 0,
  true,
  "ripple lifetime must start immediately and may expire before reaching a distant puddle edge",
);
assert.equal(
  prunePixelEffects(
    largeWaterEffects,
    largeWater.startedAt + largeWater.duration + 1,
  ).length,
  0,
  "an unfinished large ripple must disappear as soon as its own lifetime expires",
);
assert.equal(
  hitEffects.filter(
    (effect) => effect.kind === "ring" && effect.layer === "actor",
  ).length >= 2 &&
    hitEffects.filter((effect) => effect.kind === "particle").length >= 26,
  true,
  "strong melee impacts must combine a double hit ring with a dense pixel burst",
);
assert.equal(
  levelEffects.some((effect) => effect.kind === "screenFlash"),
  true,
  "level-up effects must include a pixel screen flash",
);
assert.equal(
  prunePixelEffects(dustEffects, 10_000).length,
  0,
  "expired pixel particles must be removed from the animation frame",
);
const shake = {
  id: "smoke-shake",
  startedAt: 100,
  duration: 300,
  amplitude: 6,
  seed: 4,
};
assert.deepEqual(
  cameraShakeOffset([shake], 50),
  { x: 0, y: 0 },
  "camera shake must not begin before its scheduled impact",
);
assert.equal(
  pruneCameraShakes([shake], 401).length,
  0,
  "expired camera shakes must be removed",
);
const fogRuntime = createPixelFogRuntime();
assert.equal(
  FOG_PIXELS_PER_TILE,
  16,
  "every map tile must own exactly a 16 by 16 graphical fog grid",
);
assert.equal(
  FOG_PIXELS_PER_CELL,
  8,
  "the source FOV cells must rasterize into the tile's 16 by 16 pixel grid",
);
assert.equal(
  FOG_OUTER_BOUNDARY_PIXELS,
  3,
  "the outer sight boundary must extend about three fog pixels",
);
assert.equal(
  FOG_INNER_BOUNDARY_PIXELS,
  3,
  "the inner sight boundary must retract about three fog pixels",
);
assert.equal(
  FOG_STATIC_CLEARANCE_PIXELS,
  FOG_PIXELS_PER_TILE,
  "static fog must begin one complete tile beyond gameplay sight",
);
assert.equal(
  FOG_UNEXPLORED_EXPANSION_PIXELS,
  3,
  "unexplored fog must expand exactly three pixels into discovered terrain",
);

const cellsInRect = (
  minimumX: number,
  maximumX: number,
  minimumY: number,
  maximumY: number,
) => {
  const cells = new Set<string>();
  for (let cellY = minimumY; cellY <= maximumY; cellY += 1) {
    for (let cellX = minimumX; cellX <= maximumX; cellX += 1) {
      cells.add(`${cellX},${cellY}`);
    }
  }
  return cells;
};

const initialFogCells = cellsInRect(4, 7, 2, 5);
const rememberedFogCells = cellsInRect(1, 10, 1, 6);
const initialFogOptions = {
  runtime: fogRuntime,
  now: 1_000,
  visibilityRevision: 1,
  mapKey: 1,
  originCellX: 6,
  originCellY: 4,
  minCellX: 0,
  maxCellX: 11,
  minCellY: 0,
  maxCellY: 7,
  isVisible: (cellX: number, cellY: number) =>
    initialFogCells.has(`${cellX},${cellY}`),
  isDiscovered: (cellX: number, cellY: number) =>
    rememberedFogCells.has(`${cellX},${cellY}`),
};
syncPixelFogRuntime(fogRuntime, initialFogOptions);
assert.equal(
  fogRuntime.pixelWidth,
  6 * FOG_PIXELS_PER_TILE,
  "fog width must be derived from pixels rather than per-tile animation units",
);
assert.equal(
  fogRuntime.pixelHeight,
  4 * FOG_PIXELS_PER_TILE,
  "fog height must be derived from pixels rather than per-tile animation units",
);
assert.equal(
  fogRuntime.transitions.size,
  0,
  "initial fog must paint directly without a startup transition burst",
);
const axialCornerDistance = pixelFogVisibilityDistance(
  fogRuntime,
  67,
  15,
);
const diagonalCornerDistance = pixelFogVisibilityDistance(
  fogRuntime,
  67,
  12,
);
assert.equal(
  diagonalCornerDistance > axialCornerDistance + 0.8,
  true,
  "diagonal fog distance must round corners instead of expanding them as squares",
);

const initialRippleFrame = Math.floor(
  initialFogOptions.now / FOG_RIPPLE_FRAME_MS,
);
assert.equal(
  FOG_RIPPLE_FRAME_MS >= 300 &&
    FOG_RIPPLE_AMPLITUDE_PIXELS <= 1,
  true,
  "fog movement must stay deliberately slow and subtle",
);
assert.equal(
  pixelFogStableMaskAlpha(
    fogRuntime,
    65,
    32,
    initialRippleFrame,
  ),
  FOG_SIGHT_EDGE_ALPHA,
  "the outer boundary must cover pixels just beyond gameplay sight",
);
assert.equal(
  [
    FOG_SIGHT_EDGE_ALPHA,
    FOG_REMEMBERED_ALPHA,
  ].includes(
    pixelFogStableMaskAlpha(
      fogRuntime,
      69,
      32,
      initialRippleFrame,
    ),
  ),
  true,
  "flowing fog must continue after the three-pixel sight edge without static opacity",
);
assert.equal(
  pixelFogStableMaskAlpha(
    fogRuntime,
    62,
    32,
    initialRippleFrame,
  ),
  FOG_SIGHT_EDGE_ALPHA,
  "the inner boundary must retain edge fog just inside gameplay sight",
);
assert.equal(
  pixelFogStableMaskAlpha(
    fogRuntime,
    57,
    32,
    initialRippleFrame,
  ),
  FOG_VISIBLE_ALPHA,
  "the inner sight area must be completely clear",
);
assert.equal(
  pixelFogStableMaskAlpha(
    fogRuntime,
    82,
    32,
    initialRippleFrame,
  ),
  FOG_REMEMBERED_ALPHA,
  "visited terrain must keep one consistent translucent fog shade",
);
assert.equal(
  pixelFogStableMaskAlpha(
    fogRuntime,
    84,
    32,
    initialRippleFrame,
  ),
  FOG_UNEXPLORED_ALPHA,
  "the darkest discovery frontier must extend three pixels into visited terrain",
);
assert.equal(
  pixelFogStableMaskAlpha(
    fogRuntime,
    87,
    32,
    initialRippleFrame,
  ),
  FOG_UNEXPLORED_ALPHA,
  "the discovery frontier must keep its outermost pixel opaque",
);
assert.equal(
  pixelFogStableMaskAlpha(
    fogRuntime,
    88,
    32,
    initialRippleFrame,
  ),
  FOG_UNEXPLORED_ALPHA,
  "never-visited terrain must stay fully opaque",
);
assert.equal(
  usesRememberedFogBase(fogRuntime, 9, 4),
  true,
  "a visited cell outside sight must be recognized as remembered terrain",
);
assert.equal(
  usesRememberedFogBase(fogRuntime, 11, 4),
  false,
  "an unvisited cell must never be treated as remembered terrain",
);
assert.equal(
  usesStaticFogAtPixel(
    fogRuntime,
    75,
    32,
    initialRippleFrame,
  ),
  false,
  "static fog must be pulled back throughout the one-tile sight halo",
);
assert.equal(
  usesStaticFogAtPixel(
    fogRuntime,
    84,
    32,
    initialRippleFrame,
  ),
  true,
  "static fog must resume beyond the one-tile sight halo",
);

const isolatedFogRuntime = createPixelFogRuntime();
const isolatedFogCells = cellsInRect(3, 4, 3, 4);
syncPixelFogRuntime(isolatedFogRuntime, {
  runtime: isolatedFogRuntime,
  now: 1_000,
  visibilityRevision: 1,
  mapKey: 91,
  originCellX: 2,
  originCellY: 4,
  minCellX: 0,
  maxCellX: 7,
  minCellY: 0,
  maxCellY: 7,
  isVisible: (cellX, cellY) =>
    !isolatedFogCells.has(`${cellX},${cellY}`),
  isDiscovered: () => true,
});
assert.equal(
  usesStaticFogAtPixel(
    isolatedFogRuntime,
    31,
    31,
    initialRippleFrame,
  ),
  false,
  "a one-tile fog pocket surrounded by sight must contain no static fog",
);
for (let rippleFrame = 0; rippleFrame < 96; rippleFrame += 1) {
  assert.equal(
    usesStaticFogAtPixel(
      isolatedFogRuntime,
      31,
      31,
      rippleFrame,
    ),
    false,
    "an isolated one-tile pocket must never acquire the static layer",
  );
}
assert.equal(
  pixelFogStableMaskAlpha(
    isolatedFogRuntime,
    31,
    31,
    initialRippleFrame,
  ),
  FOG_REMEMBERED_ALPHA,
  "an isolated fog pocket must use the darkest moving shade instead of opaque static fog",
);
const isolatedFogSilhouettes = new Set<string>();
let isolatedIrregularFrames = 0;
for (let rippleFrame = 0; rippleFrame < 96; rippleFrame += 1) {
  assert.equal(
    pixelFogStableMaskAlpha(
      isolatedFogRuntime,
      31,
      31,
      rippleFrame,
    ),
    FOG_REMEMBERED_ALPHA,
    "the darkest flowing shade must remain solid instead of opening bright holes",
  );
  const rows: string[] = [];
  const leftInsets = new Set<number>();
  const darkPixels = new Uint8Array(16 * 16);
  for (let pixelY = 24; pixelY < 40; pixelY += 1) {
    let row = "";
    let firstDark = -1;
    for (let pixelX = 24; pixelX < 40; pixelX += 1) {
      const alpha = pixelFogStableMaskAlpha(
        isolatedFogRuntime,
        pixelX,
        pixelY,
        rippleFrame,
      );
      assert.equal(
        [FOG_SIGHT_EDGE_ALPHA, FOG_REMEMBERED_ALPHA].includes(
          alpha,
        ),
        true,
        "a one-tile flowing pocket may use only its two contiguous fog shades",
      );
      const dark = alpha === FOG_REMEMBERED_ALPHA;
      row += dark ? "1" : "0";
      if (dark) {
        darkPixels[
          (pixelY - 24) * 16 + pixelX - 24
        ] = 1;
        if (firstDark < 0) firstDark = pixelX - 24;
      }
    }
    if (firstDark >= 0) leftInsets.add(firstDark);
    rows.push(row);
  }

  const edgeShadeVisited = new Uint8Array(16 * 16);
  const edgeShadeQueue: number[] = [];
  for (let index = 0; index < darkPixels.length; index += 1) {
    const pixelX = index % 16;
    const pixelY = Math.floor(index / 16);
    if (
      !darkPixels[index] &&
      (pixelX === 0 ||
        pixelY === 0 ||
        pixelX === 15 ||
        pixelY === 15)
    ) {
      edgeShadeVisited[index] = 1;
      edgeShadeQueue.push(index);
    }
  }
  for (
    let queueIndex = 0;
    queueIndex < edgeShadeQueue.length;
    queueIndex += 1
  ) {
    const index = edgeShadeQueue[queueIndex];
    const pixelX = index % 16;
    const pixelY = Math.floor(index / 16);
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const neighborX = pixelX + dx;
      const neighborY = pixelY + dy;
      if (
        neighborX < 0 ||
        neighborY < 0 ||
        neighborX >= 16 ||
        neighborY >= 16
      ) {
        continue;
      }
      const neighborIndex = neighborY * 16 + neighborX;
      if (
        darkPixels[neighborIndex] ||
        edgeShadeVisited[neighborIndex]
      ) {
        continue;
      }
      edgeShadeVisited[neighborIndex] = 1;
      edgeShadeQueue.push(neighborIndex);
    }
  }
  assert.equal(
    darkPixels.every(
      (dark, index) => Boolean(dark) || Boolean(edgeShadeVisited[index]),
    ),
    true,
    "the darkest flowing shade must not contain punched-out bright pixels",
  );

  const firstDarkPixel = darkPixels.findIndex(Boolean);
  const darkVisited = new Uint8Array(16 * 16);
  const darkQueue =
    firstDarkPixel < 0 ? [] : [firstDarkPixel];
  if (firstDarkPixel >= 0) darkVisited[firstDarkPixel] = 1;
  for (
    let queueIndex = 0;
    queueIndex < darkQueue.length;
    queueIndex += 1
  ) {
    const index = darkQueue[queueIndex];
    const pixelX = index % 16;
    const pixelY = Math.floor(index / 16);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const neighborX = pixelX + dx;
        const neighborY = pixelY + dy;
        if (
          neighborX < 0 ||
          neighborY < 0 ||
          neighborX >= 16 ||
          neighborY >= 16
        ) {
          continue;
        }
        const neighborIndex = neighborY * 16 + neighborX;
        if (
          !darkPixels[neighborIndex] ||
          darkVisited[neighborIndex]
        ) {
          continue;
        }
        darkVisited[neighborIndex] = 1;
        darkQueue.push(neighborIndex);
      }
    }
  }
  assert.equal(
    darkPixels.every(
      (dark, index) => !dark || Boolean(darkVisited[index]),
    ),
    true,
    "the darkest moving shade must stay pixel-connected without detached islands",
  );

  if (leftInsets.size > 1) isolatedIrregularFrames += 1;
  isolatedFogSilhouettes.add(rows.join("/"));
}
assert.equal(
  isolatedFogSilhouettes.size > 8,
  true,
  "a one-tile fog pocket must change silhouette instead of freezing as a square",
);
assert.equal(
  isolatedIrregularFrames > 24,
  true,
  "the flowing contour must stay visibly irregular rather than expanding as a tile-aligned box",
);

const unknownFogRuntime = createPixelFogRuntime();
syncPixelFogRuntime(unknownFogRuntime, {
  runtime: unknownFogRuntime,
  now: 1_000,
  visibilityRevision: 1,
  mapKey: 92,
  originCellX: 2,
  originCellY: 4,
  minCellX: 0,
  maxCellX: 7,
  minCellY: 0,
  maxCellY: 7,
  isVisible: (cellX, cellY) =>
    !isolatedFogCells.has(`${cellX},${cellY}`),
  isDiscovered: () => false,
});
assert.equal(
  usesStaticFogAtPixel(
    unknownFogRuntime,
    31,
    31,
    initialRippleFrame,
  ),
  false,
  "the one-tile graphical halo must still retract static fog around an unknown pocket",
);
for (let rippleFrame = 0; rippleFrame < 96; rippleFrame += 1) {
  for (let pixelY = 24; pixelY < 40; pixelY += 1) {
    for (let pixelX = 24; pixelX < 40; pixelX += 1) {
      assert.equal(
        pixelFogStableMaskAlpha(
          unknownFogRuntime,
          pixelX,
          pixelY,
          rippleFrame,
        ),
        FOG_UNEXPLORED_ALPHA,
        "unvisited terrain beyond a wall must remain fully opaque inside the graphical halo",
      );
    }
  }
}

const outerRippleSamples = new Set<number>();
const innerRippleSamples = new Set<number>();
const discoveryRippleSamples = new Set<number>();
for (let rippleFrame = 0; rippleFrame < 48; rippleFrame += 1) {
  outerRippleSamples.add(
    pixelFogStableMaskAlpha(fogRuntime, 67, 32, rippleFrame),
  );
  innerRippleSamples.add(
    pixelFogStableMaskAlpha(fogRuntime, 60, 32, rippleFrame),
  );
  discoveryRippleSamples.add(
    pixelFogStableMaskAlpha(fogRuntime, 83, 32, rippleFrame),
  );
}
assert.equal(
  outerRippleSamples.has(FOG_SIGHT_EDGE_ALPHA) &&
    outerRippleSamples.has(FOG_REMEMBERED_ALPHA),
  true,
  "the outer three-pixel boundary must gently ripple between adjacent regions",
);
assert.equal(
  innerRippleSamples.has(FOG_SIGHT_EDGE_ALPHA) &&
    innerRippleSamples.has(FOG_VISIBLE_ALPHA),
  true,
  "the inner three-pixel boundary must gently ripple without extra shade bands",
);
assert.equal(
  discoveryRippleSamples.has(FOG_REMEMBERED_ALPHA) &&
    discoveryRippleSamples.has(FOG_UNEXPLORED_ALPHA),
  true,
  "the remembered-to-unexplored boundary must ripple without revealing new terrain",
);

const initialFogStats = pixelFogBoundaryStats(fogRuntime);
assert.equal(
  initialFogStats.totalPixels,
  fogRuntime.pixelWidth * fogRuntime.pixelHeight,
  "fog statistics must count the exact pixel grid",
);
assert.equal(
  initialFogStats.ripplePixels <
    initialFogStats.boundaryPixels &&
    initialFogStats.ripplePixels < initialFogStats.totalPixels,
  true,
  "per-frame animation must stay below the cached boundary and full-map work",
);
assert.equal(
  initialFogStats.sourceCellScans,
  12 * 8,
  "source visibility must be rasterized once per revision",
);
assert.equal(
  initialFogStats.bufferAllocations,
  1,
  "the fog engine must allocate its full-size work buffers only once",
);

let redundantFogChecks = 0;
syncPixelFogRuntime(fogRuntime, {
  ...initialFogOptions,
  now: 1_010,
  isVisible: () => {
    redundantFogChecks += 1;
    return false;
  },
  isDiscovered: () => {
    redundantFogChecks += 1;
    return false;
  },
});
assert.equal(
  redundantFogChecks,
  0,
  "unchanged turns must reuse pixel masks without rescanning map cells",
);
assert.equal(
  pixelFogBoundaryStats(fogRuntime).bufferAllocations,
  1,
  "stable fog frames must reuse work buffers instead of reallocating map-sized arrays",
);

const shiftedFogCells = cellsInRect(5, 8, 2, 5);
syncPixelFogRuntime(fogRuntime, {
  ...initialFogOptions,
  now: 1_200,
  visibilityRevision: 2,
  originCellX: 7,
  isVisible: (cellX, cellY) =>
    shiftedFogCells.has(`${cellX},${cellY}`),
});
assert.equal(
  fogRuntime.transitions.size > 0,
  true,
  "moving sight must schedule pixel transitions",
);
const seamLeftTransition =
  fogRuntime.transitions.get(32 * fogRuntime.pixelWidth + 63);
const seamRightTransition =
  fogRuntime.transitions.get(32 * fogRuntime.pixelWidth + 64);
assert.ok(
  seamLeftTransition && seamRightTransition,
  "a sight change must animate both sides of a tile seam",
);
assert.equal(
  Math.abs(
    seamLeftTransition.startedAt - seamRightTransition.startedAt,
  ) < 30,
  true,
  "pixel propagation must cross tile seams without restarting per tile",
);
const concealingFogEdgeTransition =
  fogRuntime.transitions.get(32 * fogRuntime.pixelWidth + 32);
const concealingSightEdgeTransition =
  fogRuntime.transitions.get(32 * fogRuntime.pixelWidth + 39);
assert.ok(
  concealingFogEdgeTransition && concealingSightEdgeTransition,
  "returning fog must animate both its existing edge and the new sight edge",
);
assert.equal(
  concealingFogEdgeTransition.startedAt <
    concealingSightEdgeTransition.startedAt,
  true,
  "returning fog must advance from the fog edge toward the sight edge",
);
const clearingSightEdgeTransition =
  fogRuntime.transitions.get(32 * fogRuntime.pixelWidth + 64);
const clearingFogEdgeTransition =
  fogRuntime.transitions.get(32 * fogRuntime.pixelWidth + 71);
assert.ok(
  clearingSightEdgeTransition && clearingFogEdgeTransition,
  "clearing fog must animate across the complete newly revealed strip",
);
assert.equal(
  clearingSightEdgeTransition.startedAt <
    clearingFogEdgeTransition.startedAt,
  true,
  "clearing fog must advance from the sight edge toward the fog edge",
);
assert.equal(
  clearingFogEdgeTransition.duration >
    clearingSightEdgeTransition.duration,
  true,
  "pixels nearest the destination fog edge must clear more slowly after starting",
);

const distanceFogRuntime = createPixelFogRuntime();
const distanceInitialCells = new Set([
  ...cellsInRect(2, 3, 2, 5),
  ...cellsInRect(10, 11, 2, 5),
]);
const distanceExpandedCells = new Set([
  ...cellsInRect(2, 5, 2, 5),
  ...cellsInRect(10, 13, 2, 5),
]);
const distanceFogBaseOptions = {
  runtime: distanceFogRuntime,
  mapKey: 93,
  originCellX: 3,
  originCellY: 4,
  minCellX: 0,
  maxCellX: 15,
  minCellY: 0,
  maxCellY: 7,
  isDiscovered: () => true,
};
syncPixelFogRuntime(distanceFogRuntime, {
  ...distanceFogBaseOptions,
  now: 1_000,
  visibilityRevision: 1,
  isVisible: (cellX, cellY) =>
    distanceInitialCells.has(`${cellX},${cellY}`),
});
syncPixelFogRuntime(distanceFogRuntime, {
  ...distanceFogBaseOptions,
  now: 1_200,
  visibilityRevision: 2,
  isVisible: (cellX, cellY) =>
    distanceExpandedCells.has(`${cellX},${cellY}`),
});
const distanceTransitionAt = (pixelX: number, pixelY: number) =>
  distanceFogRuntime.transitions.get(
    pixelY * distanceFogRuntime.pixelWidth + pixelX,
  );
const nearDistanceTransition = distanceTransitionAt(35, 32);
const farDistanceTransition = distanceTransitionAt(99, 32);
assert.ok(
  nearDistanceTransition && farDistanceTransition,
  "matching near and far visibility expansions must both animate",
);
assert.equal(
  farDistanceTransition.startedAt >
    nearDistanceTransition.startedAt + 10,
  true,
  "fog propagation must start later at the same frontier depth when it is farther from the player",
);
assert.equal(
  farDistanceTransition.duration >
    nearDistanceTransition.duration,
  true,
  "farther fog pixels must traverse their opacity layers more slowly",
);

const coherentUpperTransition = distanceTransitionAt(35, 31);
const coherentLowerTransition = distanceTransitionAt(35, 32);
assert.ok(
  coherentUpperTransition && coherentLowerTransition,
  "adjacent contour pixels must both receive transitions",
);
assert.equal(
  Math.abs(
    coherentUpperTransition.startedAt -
      coherentLowerTransition.startedAt,
  ) < 4,
  true,
  "adjacent contour pixels must use a coherent delay field instead of independent random jitter",
);
const outwardTransitions = [34, 35, 36].map((pixelX) =>
  distanceTransitionAt(pixelX, 32),
);
assert.equal(
  outwardTransitions.every(Boolean),
  true,
  "the clearing wave must cover consecutive outward pixels",
);
assert.equal(
  outwardTransitions[0]!.startedAt <
    outwardTransitions[1]!.startedAt &&
    outwardTransitions[1]!.startedAt <
      outwardTransitions[2]!.startedAt,
  true,
  "the clearing frontier must advance monotonically without pixels overtaking one another",
);

const fullConcealTransition = {
  startedAt: 0,
  duration: 270,
  from: FOG_UNEXPLORED_ALPHA,
  to: FOG_VISIBLE_ALPHA,
  seed: 0,
};
assert.equal(
  pixelFogTransitionAlpha(fullConcealTransition, 45),
  FOG_UNEXPLORED_ALPHA,
  "a clearing pixel must begin at its previous opacity",
);
assert.equal(
  pixelFogTransitionAlpha(fullConcealTransition, 100),
  FOG_REMEMBERED_ALPHA,
  "a clearing pixel must pass the remembered shade",
);
assert.equal(
  pixelFogTransitionAlpha(fullConcealTransition, 190),
  FOG_SIGHT_EDGE_ALPHA,
  "a clearing pixel must pass the single sight-edge shade",
);
assert.equal(
  pixelFogTransitionAlpha(fullConcealTransition, 271),
  FOG_VISIBLE_ALPHA,
  "a clearing pixel must finish fully transparent",
);

syncPixelFogRuntime(fogRuntime, {
  ...initialFogOptions,
  now: 1_600,
  visibilityRevision: 3,
});
const returningSeamTransition =
  fogRuntime.transitions.get(32 * fogRuntime.pixelWidth + 64);
assert.ok(
  returningSeamTransition,
  "shrinking sight must schedule returning fog at pixel resolution",
);
assert.equal(
  returningSeamTransition.to >= FOG_SIGHT_EDGE_ALPHA,
  true,
  "returning fog must grow toward the new boundary shade",
);

const createFogContextStub = (width: number, height: number) => {
  const pixels = new Uint8Array(width * height);
  let globalAlpha = 1;
  const paintRectangle = (
    x: number,
    y: number,
    rectangleWidth: number,
    rectangleHeight: number,
    opacity: number,
  ) => {
    const minimumX = Math.max(0, Math.floor(x));
    const maximumX = Math.min(
      width,
      Math.ceil(x + rectangleWidth),
    );
    const minimumY = Math.max(0, Math.floor(y));
    const maximumY = Math.min(
      height,
      Math.ceil(y + rectangleHeight),
    );
    for (let pixelY = minimumY; pixelY < maximumY; pixelY += 1) {
      pixels.fill(
        opacity,
        pixelY * width + minimumX,
        pixelY * width + maximumX,
      );
    }
  };
  const metrics = {
    clearRectCalls: 0,
    fillRectCalls: 0,
    pixels,
  };
  const context = {
    canvas: { width, height },
    fillStyle: "#ffffff",
    get globalAlpha() {
      return globalAlpha;
    },
    set globalAlpha(value: number) {
      globalAlpha = value;
    },
    globalCompositeOperation: "source-over",
    save() {},
    restore() {},
    clearRect(
      x: number,
      y: number,
      rectangleWidth: number,
      rectangleHeight: number,
    ) {
      metrics.clearRectCalls += 1;
      paintRectangle(x, y, rectangleWidth, rectangleHeight, 0);
    },
    fillRect(
      x: number,
      y: number,
      rectangleWidth: number,
      rectangleHeight: number,
    ) {
      metrics.fillRectCalls += 1;
      paintRectangle(
        x,
        y,
        rectangleWidth,
        rectangleHeight,
        Math.round(globalAlpha * 255),
      );
    },
  } as unknown as CanvasRenderingContext2D;
  return { context, metrics };
};

const distanceFogStub = createFogContextStub(128, 64);
const transitionBeforeRipple = distanceTransitionAt(35, 32);
assert.ok(
  transitionBeforeRipple &&
    1_281 <
      transitionBeforeRipple.startedAt +
        transitionBeforeRipple.duration,
  "the coherence test requires a visibility transition spanning the next ripple frame",
);
drawPixelFogTexture(distanceFogStub.context, {
  ...distanceFogBaseOptions,
  now: 1_281,
  visibilityRevision: 2,
  isVisible: (cellX, cellY) =>
    distanceExpandedCells.has(`${cellX},${cellY}`),
});
assert.equal(
  distanceTransitionAt(35, 32),
  transitionBeforeRipple,
  "ambient ripple updates must not retarget an active visibility transition",
);
syncPixelFogRuntime(distanceFogRuntime, {
  ...distanceFogBaseOptions,
  now: 1_600,
  visibilityRevision: 3,
  isVisible: (cellX, cellY) =>
    distanceInitialCells.has(`${cellX},${cellY}`),
});
const nearConcealTransition = distanceTransitionAt(35, 32);
const farConcealTransition = distanceTransitionAt(99, 32);
const adjacentConcealTransition = distanceTransitionAt(35, 31);
assert.ok(
  nearConcealTransition &&
    farConcealTransition &&
    adjacentConcealTransition,
  "matching near and far concealment fronts must animate",
);
assert.equal(
  farConcealTransition.startedAt >
    nearConcealTransition.startedAt + 10,
  true,
  "returning fog must also propagate more slowly farther from the player",
);
assert.equal(
  Math.abs(
    nearConcealTransition.startedAt -
      adjacentConcealTransition.startedAt,
  ) < 4,
  true,
  "returning fog must keep adjacent pixels spatially coherent",
);

const convergenceFogRuntime = createPixelFogRuntime();
const convergenceFogStub = createFogContextStub(96, 64);
const convergenceFogOptions = {
  ...initialFogOptions,
  runtime: convergenceFogRuntime,
  mapKey: 94,
};
drawPixelFogTexture(convergenceFogStub.context, {
  ...convergenceFogOptions,
  now: 1_000,
  visibilityRevision: 1,
});
drawPixelFogTexture(convergenceFogStub.context, {
  ...convergenceFogOptions,
  now: 1_200,
  visibilityRevision: 2,
  originCellX: 7,
  isVisible: (cellX, cellY) =>
    shiftedFogCells.has(`${cellX},${cellY}`),
});
const visibilityCompletionTime =
  Math.ceil(
    Math.max(
      ...Array.from(
        convergenceFogRuntime.transitions.values(),
        (transition) =>
          transition.startedAt + transition.duration,
      ),
    ),
  ) + 1;
drawPixelFogTexture(convergenceFogStub.context, {
  ...convergenceFogOptions,
  now: visibilityCompletionTime,
  visibilityRevision: 2,
  originCellX: 7,
  isVisible: (cellX, cellY) =>
    shiftedFogCells.has(`${cellX},${cellY}`),
});
assert.deepEqual(
  convergenceFogStub.metrics.pixels,
  convergenceFogRuntime.renderedOpacity,
  "completed visibility transitions must paint every committed fog pixel even when a ripple frame changes",
);
assert.equal(
  convergenceFogRuntime.renderedOpacity[
    32 * convergenceFogRuntime.pixelWidth + 67
  ],
  Math.round(FOG_VISIBLE_ALPHA * 255),
  "the newly revealed interior must finish completely clear",
);
assert.equal(
  convergenceFogRuntime.renderedOpacity[
    32 * convergenceFogRuntime.pixelWidth + 32
  ],
  Math.round(FOG_REMEMBERED_ALPHA * 255),
  "the departed interior must finish completely covered by remembered fog",
);

const renderedFogRuntime = createPixelFogRuntime();
const renderedFogStub = createFogContextStub(96, 64);
const renderedFogOptions = {
  ...initialFogOptions,
  runtime: renderedFogRuntime,
  now: 2_000,
  visibilityRevision: 1,
  mapKey: 2,
};
drawPixelFogTexture(renderedFogStub.context, renderedFogOptions);
const fullPaintFillCalls = renderedFogStub.metrics.fillRectCalls;
assert.equal(
  fullPaintFillCalls <
    (renderedFogRuntime.pixelWidth *
      renderedFogRuntime.pixelHeight) /
      3,
  true,
  "the initial texture must use horizontal runs instead of one draw per fog pixel",
);
drawPixelFogTexture(renderedFogStub.context, {
  ...renderedFogOptions,
  now: 2_010,
});
assert.equal(
  renderedFogRuntime.lastPaintedPixels,
  0,
  "a stable frame must perform no fog-pixel painting",
);

let largestRipplePaint = 0;
for (let frame = 1; frame <= 12; frame += 1) {
  drawPixelFogTexture(renderedFogStub.context, {
    ...renderedFogOptions,
    now: 2_010 + frame * 170,
  });
  largestRipplePaint = Math.max(
    largestRipplePaint,
    renderedFogRuntime.lastPaintedPixels,
  );
  assert.equal(
    renderedFogRuntime.lastRippleTouched <=
      renderedFogRuntime.ripplePixels.length,
    true,
    "ripple updates must never scan beyond the cached ripple list",
  );
}
assert.equal(
  largestRipplePaint > 0,
  true,
  "the three cached boundaries must visibly ripple over time",
);
assert.equal(
  largestRipplePaint <= renderedFogRuntime.ripplePixels.length,
  true,
  "a ripple frame must repaint only cached ripple pixels",
);

const returningStaticRuntime = createPixelFogRuntime();
const returningStaticStub = createFogContextStub(96, 64);
const returningInitialCells = cellsInRect(4, 7, 2, 5);
const returningShiftedCells = cellsInRect(0, 3, 2, 5);
const returningBaseOptions = {
  runtime: returningStaticRuntime,
  mapKey: 77,
  originCellY: 4,
  minCellX: 0,
  maxCellX: 11,
  minCellY: 0,
  maxCellY: 7,
  isDiscovered: () => false,
};
drawPixelFogTexture(returningStaticStub.context, {
  ...returningBaseOptions,
  now: 3_000,
  visibilityRevision: 1,
  originCellX: 6,
  isVisible: (cellX, cellY) =>
    returningInitialCells.has(`${cellX},${cellY}`),
});
drawPixelFogTexture(returningStaticStub.context, {
  ...returningBaseOptions,
  now: 3_300,
  visibilityRevision: 2,
  originCellX: 2,
  isVisible: (cellX, cellY) =>
    returningShiftedCells.has(`${cellX},${cellY}`),
});
const staticSettleAt = pixelFogStaticSettleAt(
  returningStaticRuntime,
  75,
  32,
);
assert.ok(
  staticSettleAt,
  "returning static fog must be queued behind the moving frontier",
);
assert.equal(
  staticSettleAt > 3_800,
  true,
  "static fog must wait for fluid arrival, fluid passage, and a settle lag",
);
assert.equal(
  usesStaticFogAtPixel(
    returningStaticRuntime,
    75,
    32,
    Math.floor((staticSettleAt - 1) / FOG_RIPPLE_FRAME_MS),
  ),
  false,
  "static fog must remain absent until the moving frontier has passed",
);
drawPixelFogTexture(returningStaticStub.context, {
  ...returningBaseOptions,
  now: staticSettleAt - 1,
  visibilityRevision: 2,
  originCellX: 2,
  isVisible: (cellX, cellY) =>
    returningShiftedCells.has(`${cellX},${cellY}`),
});
assert.equal(
  pixelFogMaskAlpha(
    returningStaticRuntime,
    75,
    32,
    staticSettleAt - 1,
  ),
  FOG_UNEXPLORED_ALPHA,
  "unvisited terrain must remain opaque while the static layer waits behind the flowing frontier",
);
drawPixelFogTexture(returningStaticStub.context, {
  ...returningBaseOptions,
  now: staticSettleAt + 1,
  visibilityRevision: 2,
  originCellX: 2,
  isVisible: (cellX, cellY) =>
    returningShiftedCells.has(`${cellX},${cellY}`),
});
assert.equal(
  usesStaticFogAtPixel(
    returningStaticRuntime,
    75,
    32,
    Math.floor((staticSettleAt + 1) / FOG_RIPPLE_FRAME_MS),
  ),
  true,
  "static fog may activate only after its flowing frontier completes",
);
drawPixelFogTexture(returningStaticStub.context, {
  ...returningBaseOptions,
  now: staticSettleAt + 500,
  visibilityRevision: 2,
  originCellX: 2,
  isVisible: (cellX, cellY) =>
    returningShiftedCells.has(`${cellX},${cellY}`),
});
assert.equal(
  pixelFogMaskAlpha(
    returningStaticRuntime,
    75,
    32,
    staticSettleAt + 500,
  ),
  FOG_UNEXPLORED_ALPHA,
  "unexplored static fog must finish only after the flowing pass",
);

assert.equal(
  COMPANION_FRAME_WIDTH,
  12,
  "original companion hero sheets must use 12px-wide frames",
);
assert.equal(
  COMPANION_FRAME_HEIGHT,
  15,
  "original companion hero sheets must use 15px-high frames",
);
assert.deepEqual(
  [...COMPANION_MOVE_FRAMES],
  [2, 3, 4, 5, 6, 7],
  "companions must use Shattered's complete six-frame run strip",
);
assert.deepEqual(
  [...COMPANION_ATTACK_FRAMES],
  [13, 14, 15, 0],
  "companions must use Shattered's attack strip",
);
assert.deepEqual(
  [...COMPANION_INTERACT_FRAMES],
  [16, 17, 16, 17],
  "companions must use Shattered's operate strip",
);
for (const classId of COMPANION_CLASS_IDS) {
  const definition = COMPANION_VISUALS[classId];
  const spritePath = `public${definition.sprite}`;
  const spriteBytes = readFileSync(spritePath);
  assert.equal(
    spriteBytes.readUInt32BE(16),
    definition.sheetWidth,
    `${classId} must retain its declared sprite-sheet width`,
  );
  assert.equal(
    spriteBytes.readUInt32BE(20),
    definition.sheetHeight,
    `${classId} must retain its declared sprite-sheet height`,
  );
}
assert.deepEqual(
  {
    frameWidth: COMPANION_VISUALS.adventurer.frameWidth,
    frameHeight: COMPANION_VISUALS.adventurer.frameHeight,
  },
  { frameWidth: 16, frameHeight: 24 },
  "the former player sheet must remain a differently sized companion sprite",
);
assert.equal(
  COMPANION_TRAIT_IDS.length,
  10,
  "the companion system must define ten traits",
);
for (const classId of COMPANION_CLASS_IDS) {
  const traits = createCompanionTraits(`trait-test-${classId}`);
  assert.ok(
    traits.length >= 1 && traits.length <= 4,
    `${classId} must receive between one and four unique traits`,
  );
  assert.equal(new Set(traits).size, traits.length);
  assert.ok(traits.every((traitId) => COMPANION_TRAITS[traitId]));
}
const traitFixture = createStarterCompanionRoster(["warrior"])[0];
const untraitedAttack = getCompanionAttack({ ...traitFixture, traits: [] });
assert.ok(
  getCompanionAttack({ ...traitFixture, traits: ["aggressive"] }) >
    untraitedAttack,
  "Aggressive must increase a companion's outgoing damage",
);
assert.equal(
  reduceCharacterDamage({ traits: ["tough"] }, 10),
  8,
  "Tough must reduce incoming damage by exactly twenty percent",
);

assert.equal(
  COMPANION_SKILL_IDS.length,
  20,
  "the manual companion system must expose exactly twenty skills",
);
assert.equal(
  new Set(COMPANION_SKILL_IDS).size,
  20,
  "every manual companion skill ID must be unique",
);
assert.ok(
  COMPANION_SKILL_IDS.every(
    (skillId) =>
      COMPANION_SKILLS[skillId] && COMPANION_SKILLS[skillId].soundId,
  ),
  "every companion skill ID must resolve to a definition and sound",
);
for (const classId of COMPANION_CLASS_IDS) {
  const professionId = normalizeCompanionProfession(classId, undefined);
  const first = createCompanionSkills(professionId, `skill-test-${classId}`);
  const second = createCompanionSkills(professionId, `skill-test-${classId}`);
  assert.equal(first.length, 2, `${classId} must receive exactly two skills`);
  assert.equal(new Set(first).size, 2, `${classId}'s two skills must be unique`);
  assert.deepEqual(first, second, "skill assignment must remain stable across save restoration");
  assert.ok(
    first.every((skillId) =>
      COMPANION_PROFESSIONS[professionId].skillPool.includes(skillId),
    ),
    `${classId} must draw both skills from the ${professionId} pool`,
  );
}
assert.deepEqual(
  new Set(
    createStarterCompanionRoster(COMPANION_CLASS_IDS).map(
      (companion) => companion.professionId,
    ),
  ),
  new Set(COMPANION_PROFESSION_IDS),
  "the roster must cover warrior, rogue, mage, and cleric professions",
);
assert.ok(
  createStarterCompanionRoster(COMPANION_CLASS_IDS).every(
    (companion) =>
      companion.skills.length === 2 &&
      companion.learnedSkills.length === 2 &&
      companion.skills.every((skillId) => companion.learnedSkills.includes(skillId)),
  ),
  "every roster companion must start with the same two learned and equipped skills",
);
const legacyProfessionCompanion = createStarterCompanionRoster(["warrior"])[0];
Reflect.deleteProperty(legacyProfessionCompanion, "professionId");
Reflect.deleteProperty(legacyProfessionCompanion, "learnedSkills");
legacyProfessionCompanion.skills = ["fireball", "lifeDrain"];
const migratedProfessionCompanion = normalizeCompanionForHubWithReleasedItems(
  legacyProfessionCompanion,
).companion;
assert.equal(
  migratedProfessionCompanion.professionId,
  "warrior",
  "older saves without a profession must receive the class-compatible profession",
);
assert.ok(
  migratedProfessionCompanion.skills.length === 0 &&
    migratedProfessionCompanion.learnedSkills.length === 0,
  "normalization must remove invalid legacy skills without granting free profession skills",
);

const createSkillArena = (skillId: (typeof COMPANION_SKILL_IDS)[number]) => {
  const state = createNewGame(0x5c111000 + COMPANION_SKILL_IDS.indexOf(skillId));
  const center = { x: 18, y: 18 };
  for (let y = center.y - 12; y <= center.y + 12; y += 1) {
    for (let x = center.x - 12; x <= center.x + 12; x += 1) {
      if (!state.tiles[y]?.[x]) continue;
      state.tiles[y][x] = {
        ...state.tiles[y][x],
        terrain: "floor",
        visible: true,
        discovered: true,
      };
    }
  }
  state.player.x = center.x;
  state.player.y = center.y;
  const professionId = COMPANION_PROFESSION_IDS.find((candidate) =>
    COMPANION_PROFESSIONS[candidate].skillPool.includes(skillId),
  );
  assert.ok(professionId, `${skillId} must belong to at least one profession pool`);
  state.player.professionId = professionId;
  state.player.skills = [
    skillId,
    COMPANION_PROFESSIONS[professionId].skillPool.find(
      (candidate) => candidate !== skillId,
    )!,
  ];
  state.player.learnedSkills = [...state.player.skills];
  state.player.skillCooldowns = {};
  state.player.actionProgress = 0;
  state.companions = [];
  state.objects = [];
  state.clouds = [];
  state.wards = [];
  const template = state.enemies[0];
  assert.ok(template, "the skill arena requires an enemy template");
  state.enemies = [{
    ...template,
    id: `skill-target-${skillId}`,
    x: center.x + 3,
    y: center.y,
    hp: 250,
    maxHp: 250,
    sleeping: false,
    alerted: true,
    statuses: [],
  }];
  return { state, center, enemyId: state.enemies[0].id };
};

const companionAimArena = createSkillArena("tripleStrike");
const aimingCompanion = createStarterCompanionRoster(["warrior"])[0];
aimingCompanion.x = companionAimArena.center.x + 7;
aimingCompanion.y = companionAimArena.center.y;
aimingCompanion.professionId = "warrior";
aimingCompanion.skills = ["tripleStrike", "whirlwind"];
aimingCompanion.learnedSkills = [...aimingCompanion.skills];
companionAimArena.state.companions = [aimingCompanion];
const playerNearEnemy = {
  ...companionAimArena.state.enemies[0],
  id: "player-near-aim-target",
  x: companionAimArena.center.x + 1,
  y: companionAimArena.center.y,
};
const companionNearEnemy = {
  ...companionAimArena.state.enemies[0],
  id: "companion-near-aim-target",
  x: aimingCompanion.x + 1,
  y: aimingCompanion.y,
};
companionAimArena.state.enemies = [playerNearEnemy, companionNearEnemy];
assert.equal(
  nearestVisibleEnemy(companionAimArena.state, aimingCompanion.id, 10)?.id,
  companionNearEnemy.id,
  "automatic targeting must measure distance from the companion using it",
);
assert.deepEqual(
  suggestedSkillTarget(
    companionAimArena.state,
    aimingCompanion.id,
    "tripleStrike",
  ),
  { x: companionNearEnemy.x, y: companionNearEnemy.y },
  "skill suggestions must stay anchored to their caster while the player remains selected",
);

const manualRoundArena = createSkillArena("tripleStrike");
manualRoundArena.state.enemies = [];
const manualCompanion = createStarterCompanionRoster(["warrior"])[0];
manualCompanion.x = manualRoundArena.center.x + 2;
manualCompanion.y = manualRoundArena.center.y;
manualCompanion.statuses = [];
manualRoundArena.state.companions = [manualCompanion];
const manualInitialTurn = manualRoundArena.state.turn;
const deferredLeaderWait = deferActionForManualRound(
  manualRoundArena.state,
  waitTurn(manualRoundArena.state),
);
assert.equal(
  deferredLeaderWait.state.turn,
  manualInitialTurn,
  "the first manual party action must not advance the shared world clock",
);
assert.equal(deferredLeaderWait.elapsedTurns, 0);
const manualCompanionMove = manualCompanionStep(
  deferredLeaderWait.state,
  manualCompanion.id,
  0,
  1,
);
assert.equal(manualCompanionMove.consumedTurn, true);
assert.equal(
  manualCompanionMove.state.turn,
  manualInitialTurn,
  "a manually moved companion must not open an enemy turn by itself",
);
assert.deepEqual(
  {
    x: manualCompanionMove.state.companions[0].x,
    y: manualCompanionMove.state.companions[0].y,
  },
  { x: manualCompanion.x, y: manualCompanion.y + 1 },
  "manual companion movement must use the same adjacent tile controls as the leader",
);
const manualRoundAdvance = advanceManualPartyRound(manualCompanionMove.state);
assert.equal(manualRoundAdvance.elapsedTurns, 1);
assert.equal(
  manualRoundAdvance.state.turn,
  manualInitialTurn + 1,
  "the shared world clock must advance exactly once after every living party member acts",
);
const manualEnemyTurn = runEnemyTurn(manualRoundAdvance.state, {
  manualParty: true,
});
assert.equal(
  manualEnemyTurn.motions.some(
    (motion) => motion.id === manualCompanion.id,
  ),
  false,
  "manual rounds must suppress the companion AI during the enemy phase",
);
const manualWaitResult = manualCompanionWait(
  manualRoundArena.state,
  manualCompanion.id,
);
assert.equal(manualWaitResult.consumedTurn, true);
assert.equal(manualWaitResult.elapsedTurns, 0);

const incapacitatedSkillArena = createSkillArena("shockLeap");
const incapacitatedCompanion = createStarterCompanionRoster(["warrior"])[0];
incapacitatedCompanion.x = incapacitatedSkillArena.center.x;
incapacitatedCompanion.y = incapacitatedSkillArena.center.y;
incapacitatedCompanion.professionId = "warrior";
incapacitatedCompanion.skills = ["shockLeap", "shieldCharge"];
incapacitatedCompanion.learnedSkills = [...incapacitatedCompanion.skills];
incapacitatedCompanion.statuses = [{
  id: "paralyzed",
  turns: 2,
  power: 1,
}];
incapacitatedSkillArena.state.player.x = incapacitatedSkillArena.center.x - 2;
incapacitatedSkillArena.state.companions = [incapacitatedCompanion];
const incapacitatedSkill = activateCompanionSkill(
  incapacitatedSkillArena.state,
  incapacitatedCompanion.id,
  "shockLeap",
  { x: incapacitatedSkillArena.center.x + 1, y: incapacitatedSkillArena.center.y },
);
assert.equal(incapacitatedSkill.consumedTurn, true);
assert.equal(
  incapacitatedSkill.state.turn,
  incapacitatedSkillArena.state.turn + 1,
  "an incapacitated ally command must advance the authoritative world clock",
);
assert.equal(
  incapacitatedSkill.elapsedTurns,
  1,
  "an incapacitated ally's failed command must still advance the shared world turn",
);
assert.equal(
  (() => {
    const resolution = resolveGameSession(incapacitatedSkill);
    assert.equal(resolution.kind, "turn");
    return resolution.kind === "turn" ? resolution.enemyTurns.length : 0;
  })(),
  1,
  "an incapacitated ally command must not freeze enemy turns and status timers",
);

const emptyAimArena = createSkillArena("tripleStrike");
const emptyAimTarget = {
  x: emptyAimArena.center.x + 1,
  y: emptyAimArena.center.y,
};
emptyAimArena.state.tiles[emptyAimTarget.y][emptyAimTarget.x].visible = false;
emptyAimArena.state.tiles[emptyAimTarget.y][emptyAimTarget.x].discovered = false;
const emptyAimEnemyHp = emptyAimArena.state.enemies[0].hp;
const emptyAimSkill = activateCompanionSkill(
  emptyAimArena.state,
  "player",
  "tripleStrike",
  emptyAimTarget,
);
assert.equal(
  emptyAimSkill.consumedTurn,
  true,
  "enemy-targeted skills must still fire toward a hidden empty tile",
);
assert.equal(
  emptyAimSkill.state.enemies[0].hp,
  emptyAimEnemyHp,
  "an empty-tile skill cast must preserve unrelated enemies while keeping its visual action",
);
assert.deepEqual(
  emptyAimSkill.skillVisuals?.at(-1)?.to,
  emptyAimTarget,
  "empty-tile skill aiming must publish its effect at the clicked tile",
);
assert.ok(
  emptyAimSkill.soundCues?.some(
    ({ id }) => id === COMPANION_SKILLS.tripleStrike.soundId,
  ),
  "every successful manual skill cast must publish its assigned sound cue",
);

const manualQuickslotArena = createSkillArena("fireball");
manualQuickslotArena.state.enemies = [];
const quickslotCompanion = createStarterCompanionRoster(["mage"])[0];
quickslotCompanion.x = manualQuickslotArena.center.x + 1;
quickslotCompanion.y = manualQuickslotArena.center.y;
const quickslotWand = createPlainEquipmentInstance(
  ITEM_DEFS.wand_magic_missile,
  "manual-quickslot-wand",
);
quickslotWand.charges = 2;
quickslotWand.maxCharges = 2;
quickslotCompanion.autoSlots[2] = {
  defId: "wand_magic_missile",
  quantity: 1,
  instance: quickslotWand,
};
manualQuickslotArena.state.companions = [quickslotCompanion];
const emptyQuickslotTarget = {
  x: quickslotCompanion.x + 3,
  y: quickslotCompanion.y + 1,
};
manualQuickslotArena.state.tiles[emptyQuickslotTarget.y][emptyQuickslotTarget.x]
  .visible = false;
manualQuickslotArena.state.tiles[emptyQuickslotTarget.y][emptyQuickslotTarget.x]
  .discovered = false;
const emptyQuickslotResult = activateCompanionQuickslot(
  manualQuickslotArena.state,
  quickslotCompanion.id,
  2,
  emptyQuickslotTarget,
);
assert.equal(
  emptyQuickslotResult.consumedTurn,
  true,
  "a manually controlled ally wand must fire toward an empty clicked tile",
);
assert.equal(
  emptyQuickslotResult.state.companions[0].autoSlots[2]?.instance?.charges,
  1,
  "manual ally wand fire must spend exactly one charge",
);
assert.deepEqual(
  emptyQuickslotResult.magicVisuals?.at(-1)?.to,
  emptyQuickslotTarget,
  "manual ally quickslot visuals must end at the clicked tile",
);
assert.equal(
  activateCompanionQuickslot(
    manualQuickslotArena.state,
    quickslotCompanion.id,
    2,
    { x: -1, y: -1 },
  ).consumedTurn,
  false,
  "out-of-bounds companion shots must fail without spending a charge or turn",
);

const leapArena = createSkillArena("shockLeap");
leapArena.state.enemies[0].x = leapArena.center.x + 4;
const leapResult = activateCompanionSkill(
  leapArena.state,
  "player",
  "shockLeap",
  { x: leapArena.center.x + 3, y: leapArena.center.y },
);
assert.equal(leapResult.consumedTurn, true);
assert.deepEqual(
  { x: leapResult.state.player.x, y: leapResult.state.player.y },
  { x: leapArena.center.x + 3, y: leapArena.center.y },
  "Shock Leap must move its caster to the selected empty tile",
);
assert.ok(
  leapResult.state.enemies[0].hp < leapArena.state.enemies[0].hp,
  "Shock Leap must damage an enemy adjacent to its landing tile",
);
assert.equal(
  leapResult.motions.find(
    (motion) => motion.id === "player" && motion.kind === "move",
  )?.travelStyle,
  "leap",
  "Shock Leap must publish semantic leap travel instead of ordinary walking",
);
assert.deepEqual(
  {
    travelMode: leapResult.skillVisuals?.[0]?.travelMode,
    impactMode: leapResult.skillVisuals?.[0]?.impactMode,
    radius: leapResult.skillVisuals?.[0]?.radius,
  },
  { travelMode: "leap", impactMode: "shockwave", radius: 1 },
  "Shock Leap must expose reusable travel and impact cues to presentation",
);

const derivedLeapArena = createSkillArena("shockLeap");
const derivedLanding = {
  x: derivedLeapArena.center.x + 1,
  y: derivedLeapArena.center.y,
};
derivedLeapArena.state.enemies = [
  {
    ...derivedLeapArena.state.enemies[0],
    id: "derived-near",
    x: derivedLanding.x + 1,
    hp: 10_000,
    maxHp: 10_000,
    statuses: [],
  },
  {
    ...derivedLeapArena.state.enemies[0],
    id: "derived-wide",
    x: derivedLanding.x + 2,
    hp: 10_000,
    maxHp: 10_000,
    statuses: [],
  },
];
const derivedAttack = getPlayerAttack(derivedLeapArena.state.player);
const derivedModifier = {
  id: "phase-quake",
  scalarChanges: {
    power: { set: 2 },
    radius: { set: 2 },
  },
  travelMode: "teleport",
  impactMode: "fragments",
  accent: "#ff66cc",
  addSpecialEffects: [{
    id: "phase-poison",
    kind: "status",
    target: "area",
    statusId: "poisoned",
    turns: 3,
    radius: 2,
  }],
} as const;
const derivedLeapResult = activateCompanionSkill(
  derivedLeapArena.state,
  "player",
  "shockLeap",
  derivedLanding,
  { modifiers: [derivedModifier] },
);
assert.ok(
  derivedLeapResult.state.enemies.every(
    (enemy, index) =>
      derivedLeapArena.state.enemies[index].hp - enemy.hp ===
        Math.round(derivedAttack * 2),
  ),
  "a derived radius and power modifier must execute through the real skill handler",
);
assert.ok(
  derivedLeapResult.state.enemies.every((enemy) =>
    enemy.statuses.some(
      (status) => status.id === "poisoned" && status.turns === 3,
    ),
  ),
  "data-only derived special effects must execute on their configured targets",
);
assert.equal(
  derivedLeapResult.motions.find(
    (motion) => motion.id === "player" && motion.kind === "move",
  )?.travelStyle,
  "teleport",
  "a travel modifier must change the actual motion, not only metadata",
);
assert.deepEqual(
  {
    travelMode: derivedLeapResult.skillVisuals?.[0]?.travelMode,
    impactMode: derivedLeapResult.skillVisuals?.[0]?.impactMode,
    radius: derivedLeapResult.skillVisuals?.[0]?.radius,
    variants: derivedLeapResult.skillVisuals?.[0]?.variants,
    accent: derivedLeapResult.skillVisuals?.[0]?.accent,
  },
  {
    travelMode: "teleport",
    impactMode: "fragments",
    radius: 2,
    variants: ["phase-quake"],
    accent: "#ff66cc",
  },
  "derived semantics must be forwarded to the reusable particle layer",
);
const derivedLeapParticles = createCompanionSkillEffects(
  derivedLeapResult.skillVisuals![0],
  100,
  48,
);
assert.ok(
  derivedLeapParticles.some((effect) => effect.id.includes("depart")) &&
    derivedLeapParticles.some((effect) => effect.id.includes("area-")) &&
    !derivedLeapParticles.some((effect) => effect.id.includes("takeoff")),
  "derived teleport/fragments visuals must replace the base leap/shockwave recipe",
);
assert.ok(
  derivedLeapParticles.some((effect) => effect.color === "#ff66cc"),
  "derived particle recipes must consume the modifier accent",
);
assert.ok(
  createCompanionSkillEffects(
    {
      ...derivedLeapResult.skillVisuals![0],
      id: "oversized-derived-radius",
      radius: 10,
    },
    100,
    48,
  ).length <= 256,
  "derived visual radii must respect the per-cast particle safety budget",
);
assert.deepEqual(
  companionSkillBlueprint("shockLeap").scalars,
  baseShockLeap.scalars,
  "executing a derived skill must not mutate its stable saved base blueprint",
);

const drivingArena = createSkillArena("drivingLeap");
const drivingTarget = { ...drivingArena.state.enemies[0] };
const drivingResult = activateCompanionSkill(
  drivingArena.state,
  "player",
  "drivingLeap",
  drivingTarget,
);
assert.deepEqual(
  { x: drivingResult.state.player.x, y: drivingResult.state.player.y },
  { x: drivingTarget.x, y: drivingTarget.y },
  "Driving Leap must land on the enemy's former tile",
);
assert.equal(
  drivingResult.state.enemies[0].x,
  drivingTarget.x + 2,
  "Driving Leap must push an unobstructed enemy two tiles away",
);
assert.equal(
  drivingResult.motions.find(
    (motion) => motion.id === "player" && motion.kind === "move",
  )?.travelStyle,
  "leap",
  "Driving Leap must use the same reusable leap travel primitive",
);

const shadowArena = createSkillArena("shadowStep");
const shadowTarget = {
  x: shadowArena.center.x + 2,
  y: shadowArena.center.y,
};
const shadowResult = activateCompanionSkill(
  shadowArena.state,
  "player",
  "shadowStep",
  shadowTarget,
);
assert.equal(shadowResult.consumedTurn, true);
assert.equal(
  shadowResult.motions.find(
    (motion) => motion.id === "player" && motion.kind === "move",
  )?.travelStyle,
  "teleport",
  "Shadow Step must snap with teleport semantics rather than glide like a leap",
);
assert.equal(
  shadowResult.skillVisuals?.[0]?.travelMode,
  "teleport",
  "Shadow Step must request the teleport particle recipe",
);

const chargeArena = createSkillArena("shieldCharge");
const chargeResult = activateCompanionSkill(
  chargeArena.state,
  "player",
  "shieldCharge",
  chargeArena.state.enemies[0],
);
assert.equal(chargeResult.consumedTurn, true);
assert.equal(
  chargeResult.motions.find(
    (motion) => motion.id === "player" && motion.kind === "move",
  )?.travelStyle,
  "charge",
  "Shield Charge must retain ground-charge travel distinct from leap and teleport",
);

const fireballArena = createSkillArena("fireball");
const fireballTarget = { x: fireballArena.center.x + 5, y: fireballArena.center.y };
fireballArena.state.enemies[0].x = fireballTarget.x;
fireballArena.state.tiles[fireballTarget.y][fireballTarget.x].visible = false;
fireballArena.state.tiles[fireballTarget.y][fireballTarget.x].discovered = false;
const fireballResult = activateCompanionSkill(
  fireballArena.state,
  "player",
  "fireball",
  fireballTarget,
);
assert.equal(fireballResult.consumedTurn, true);
assert.deepEqual(
  new Set(
    fireballResult.skillVisuals?.[0].affectedTiles?.map(({ x, y }) =>
      pointKey(x, y),
    ),
  ),
  new Set(
    particleFootprintTiles(fireballTarget, { radiusTiles: 1 }).map(({ x, y }) =>
      pointKey(x, y),
    ),
  ),
  "area skill visuals must receive the exact rule footprint, including all eight neighbors",
);
assert.deepEqual(
  fireballResult.skillVisuals?.[0].footprintOrigin,
  fireballTarget,
  "the rule layer must publish the footprint anchor without presentation skill-id special cases",
);
assert.equal(
  activateCompanionSkill(
    fireballArena.state,
    PLAYER_ACTOR_ID,
    "fireball",
    { x: -1, y: -1 },
  ).consumedTurn,
  false,
  "out-of-bounds skill targets must fail safely without spending a turn",
);
const blockedBlindSkillArena = createSkillArena("fireball");
const blockedBlindTarget = {
  x: blockedBlindSkillArena.center.x + 3,
  y: blockedBlindSkillArena.center.y,
};
blockedBlindSkillArena.state.tiles[blockedBlindTarget.y][blockedBlindTarget.x]
  .visible = false;
blockedBlindSkillArena.state.tiles[
  blockedBlindSkillArena.center.y
][blockedBlindSkillArena.center.x + 1].terrain = "wall";
assert.equal(
  activateCompanionSkill(
    blockedBlindSkillArena.state,
    PLAYER_ACTOR_ID,
    "fireball",
    blockedBlindTarget,
  ).consumedTurn,
  false,
  "blind skill targeting must still respect walls and closed lines of sight",
);
const grassLineSkillArena = createSkillArena("fireball");
const grassLineTarget = {
  x: grassLineSkillArena.center.x + 3,
  y: grassLineSkillArena.center.y,
};
grassLineSkillArena.state.enemies[0].x = grassLineTarget.x;
grassLineSkillArena.state.enemies[0].y = grassLineTarget.y;
grassLineSkillArena.state.tiles[grassLineSkillArena.center.y][
  grassLineSkillArena.center.x + 1
].terrain = "highGrass";
assert.equal(
  activateCompanionSkill(
    grassLineSkillArena.state,
    PLAYER_ACTOR_ID,
    "fireball",
    grassLineTarget,
  ).consumedTurn,
  true,
  "dense grass must not block a manually aimed skill projectile",
);
assert.equal(fireballResult.state.clouds.at(-1)?.kind, "fire");
assert.equal(
  fireballResult.state.clouds.at(-1)?.tiles.length,
  9,
  "Fireball must immediately create fire on the target and all eight adjacent floor tiles",
);
assert.ok(
  (fireballResult.state.enemies[0].statuses.find(
    (status) => status.id === "burning",
  )?.turns ?? 0) >= BURNING_DURATION,
  "burning from a fire attack must persist for the full long-duration minimum",
);

const lightningArena = createSkillArena("chainLightning");
const lightningCompanion = createStarterCompanionRoster(["warrior"])[0];
lightningCompanion.x = lightningArena.center.x + 1;
lightningCompanion.y = lightningArena.center.y;
lightningCompanion.hp = lightningCompanion.maxHp;
lightningArena.state.companions = [lightningCompanion];
for (let x = lightningArena.center.x; x <= lightningArena.state.enemies[0].x; x += 1) {
  lightningArena.state.tiles[lightningArena.center.y][x].terrain = "water";
}
const lightningPlayerHp = lightningArena.state.player.hp;
const lightningCompanionHp = lightningCompanion.hp;
const lightningResult = activateCompanionSkill(
  lightningArena.state,
  "player",
  "chainLightning",
  lightningArena.state.enemies[0],
);
assert.ok(
  lightningResult.state.player.hp < lightningPlayerHp &&
    lightningResult.state.companions[0].hp < lightningCompanionHp,
  "a lightning hit on water must conduct through the connected puddle to every other entity",
);
assert.ok(
  (lightningResult.skillVisuals?.[0].paths?.length ?? 0) > 1,
  "water conduction must publish pixel-lightning paths to secondary entities",
);
assert.equal(
  lightningResult.magicVisuals?.length ?? 0,
  0,
  "manual skills must not duplicate pixel recipes with legacy antialiased magic shapes",
);

const weaponArena = createSkillArena("weaponThrow");
const weaponBeforeHp = weaponArena.state.enemies[0].hp;
const equippedWeaponId = weaponArena.state.player.equipment.weapon!;
const equippedWeaponInstance = weaponArena.state.player.equipmentInstances.weapon;
const weaponDefinition = ITEM_DEFS[equippedWeaponId];
const weaponProfile = equipmentStatProfile(
  weaponDefinition,
  weaponArena.state.player.equipmentInstances.weapon,
);
const weaponResult = activateCompanionSkill(
  weaponArena.state,
  "player",
  "weaponThrow",
  weaponArena.state.enemies[0],
);
assert.equal(
  weaponBeforeHp - weaponResult.state.enemies[0].hp,
  Math.max(1, Math.round(weaponProfile.attack * 5)),
  "Weapon Throw must round the five-times graded weapon value at damage resolution",
);
assert.equal(
  weaponResult.state.player.equipment.weapon,
  null,
  "Weapon Throw must remove the thrown weapon from its equipment slot",
);
assert.equal(
  weaponResult.state.player.equipmentInstances.weapon,
  null,
  "Weapon Throw must transfer ownership out of the equipment instance slot",
);
assert.equal(
  weaponResult.state.groundItems.some(
    (item) =>
      item.defId === equippedWeaponId &&
      item.instance?.id === equippedWeaponInstance?.id &&
      item.x === weaponArena.state.enemies[0].x &&
      item.y === weaponArena.state.enemies[0].y,
  ),
  true,
  "Weapon Throw must leave the exact unique weapon on the impact tile",
);
assert.equal(
  weaponResult.state.player.inventoryInstances.some(
    (instance) => instance.id === equippedWeaponInstance?.id,
  ),
  false,
  "a thrown weapon must exist only on the floor until it is picked up",
);
assert.equal(
  weaponResult.skillVisuals?.[0]?.skillId,
  "weaponThrow",
  "a successful manual skill must publish its 16×16 particle cue",
);
const blockedWeaponArena = createSkillArena("weaponThrow");
const blockedWeaponTarget = {
  x: blockedWeaponArena.center.x + 1,
  y: blockedWeaponArena.center.y,
};
blockedWeaponArena.state.tiles[blockedWeaponTarget.y][
  blockedWeaponTarget.x
] = {
  ...blockedWeaponArena.state.tiles[blockedWeaponTarget.y][blockedWeaponTarget.x],
  terrain: "wall",
  visible: true,
  discovered: true,
};
const blockedWeaponId = blockedWeaponArena.state.player.equipmentInstances.weapon?.id;
const blockedWeaponResult = activateCompanionSkill(
  blockedWeaponArena.state,
  "player",
  "weaponThrow",
  blockedWeaponTarget,
);
assert.equal(blockedWeaponResult.consumedTurn, false);
assert.equal(
  blockedWeaponResult.state.player.equipmentInstances.weapon?.id,
  blockedWeaponId,
  "Weapon Throw must retain ownership when the selected impact tile is not recoverable",
);
assert.equal(
  blockedWeaponResult.state.groundItems.some(
    (item) => item.instance?.id === blockedWeaponId,
  ),
  false,
  "Weapon Throw must never bury a unique weapon inside a wall tile",
);
const circularWeaponArena = createSkillArena("weaponThrow");
const formerSquareCorner = {
  x: circularWeaponArena.center.x + 6,
  y: circularWeaponArena.center.y + 6,
};
circularWeaponArena.state.enemies[0].x = formerSquareCorner.x;
circularWeaponArena.state.enemies[0].y = formerSquareCorner.y;
const circularWeaponId =
  circularWeaponArena.state.player.equipmentInstances.weapon?.id;
const circularWeaponResult = activateCompanionSkill(
  circularWeaponArena.state,
  PLAYER_ACTOR_ID,
  "weaponThrow",
  formerSquareCorner,
);
assert.equal(
  circularWeaponResult.consumedTurn,
  false,
  "a range-eight skill must reject a 6-by-6 diagonal point outside its circular radius",
);
assert.equal(
  circularWeaponResult.state.player.equipmentInstances.weapon?.id,
  circularWeaponId,
  "a circular-range rejection must not spend or drop the equipped weapon",
);

const dischargeArena = createSkillArena("arcaneDischarge");
const dischargeWand = createPlainEquipmentInstance(
  ITEM_DEFS.wand_fireblast,
  "skill-discharge-wand",
);
dischargeWand.charges = 3;
dischargeWand.maxCharges = 3;
dischargeArena.state.player.inventoryInstances.push(dischargeWand);
dischargeArena.state.player.autoSlots[2] = dischargeWand.id;
const dischargeResult = activateCompanionSkill(
  dischargeArena.state,
  "player",
  "arcaneDischarge",
  dischargeArena.state.enemies[0],
);
assert.equal(
  dischargeResult.state.player.inventoryInstances.find(
    (instance) => instance.id === dischargeWand.id,
  )?.charges,
  0,
  "Arcane Discharge must spend every remaining charge in the selected carried wand",
);
assert.ok(
  dischargeResult.state.enemies[0].hp < dischargeArena.state.enemies[0].hp,
  "Arcane Discharge must turn the consumed charges into damage",
);

const medicineArena = createSkillArena("fieldMedicine");
medicineArena.state.player.hp = 1;
const medicineResult = activateCompanionSkill(
  medicineArena.state,
  "player",
  "fieldMedicine",
  medicineArena.state.player,
);
assert.ok(
  medicineResult.state.player.hp > 1,
  "Field Medicine must be able to target and heal the caster",
);
assert.equal(
  medicineResult.state.player.skillCooldowns.fieldMedicine,
  COMPANION_SKILLS.fieldMedicine.cooldown + 1,
  "a successful manual skill must enter its per-character cooldown before the enemy turn",
);

const talentIconBytes = readFileSync("public/assets/interfaces/talent_icons.png");
assert.equal(
  talentIconBytes.readUInt32BE(16),
  512,
  "the original talent icon atlas must retain its 512px width",
);
assert.equal(
  talentIconBytes.readUInt32BE(20),
  128,
  "the original talent icon atlas must retain its 128px height",
);
assert.ok(
  Object.values(AUGMENT_DEFS).every(
    ({ icon }) => Number.isInteger(icon) && icon >= 0 && icon < 256,
  ),
  "every augment must map to a valid original talent icon frame",
);
for (const [kind, sprite] of Object.entries(ENEMY_SPRITES)) {
  const spriteBytes = readFileSync(`public${sprite.file}`);
  assert.equal(
    spriteBytes.readUInt32BE(16),
    sprite.sheetWidth,
    `${kind} codex portrait must use the real enemy sheet width`,
  );
}
assert.equal(
  ENEMY_STATS.snake.evasion,
  10,
  "the sewer snake evasion must be reduced to 10",
);

const companionGame = createNewGame(0xc04a410);
assert.equal(
  companionGame.companions.length,
  2,
  "a new run must start with a multi-companion formation to exercise the roster",
);
assert.equal(
  new Set(companionGame.companions.map(({ id }) => id)).size,
  companionGame.companions.length,
  "every companion must have an independent stable identity",
);
assert.equal(
  PLANNED_ENDGAME_POWER_MULTIPLIER,
  1_000,
  "the combined equipment and augment plan must retain its 1000x endgame target",
);
assert.equal(
  LEVEL_XP_REQUIREMENT_MULTIPLIER,
  5,
  "level two must retain the established fivefold base requirement",
);
assert.equal(
  LEVEL_XP_REQUIREMENT_GROWTH,
  1.15,
  "each successive level requirement must grow by fifteen percent",
);
assert.equal(
  LEVEL_STAT_GROWTH,
  1.1,
  "attack and maximum health must grow by ten percent per level",
);
assert.equal(
  experienceForNextLevel(1),
  50,
  "level two must require five times the former ten-XP threshold",
);
assert.equal(
  experienceForNextLevel(2),
  Math.ceil(experienceForNextLevel(1) * LEVEL_XP_REQUIREMENT_GROWTH),
  "the next level requirement must be fifteen percent above the previous threshold",
);
for (let level = 2; level < 12; level += 1) {
  assert.equal(
    experienceForNextLevel(level),
    Math.ceil(
      10 *
        LEVEL_XP_REQUIREMENT_MULTIPLIER *
        LEVEL_XP_REQUIREMENT_GROWTH ** (level - 1),
    ),
    `level ${level + 1} must remain on the cumulative fifteen-percent XP curve`,
  );
}
const companionSpeedInstance = createEquipmentInstance(
  ITEM_DEFS.shortsword,
  "companion-speed-sword",
  sequenceRandom([0.99]),
  { grade: "S", allowCurse: false, preferredFirstTrait: "swift" },
);
const speedCompanion = {
  ...companionGame.companions[0],
  equipment: {
    ...companionGame.companions[0].equipment,
    weapon: "shortsword",
  },
  equipmentInstances: {
    ...companionGame.companions[0].equipmentInstances,
    weapon: companionSpeedInstance,
  },
};
assert.ok(
  getCompanionMoveSpeed(speedCompanion) > 1 &&
    getCompanionAttackSpeed(speedCompanion) > 1,
  "companion move and attack speed must include equipment enchantments",
);
assert.ok(
  getCompanionMoveSpeed({
    ...speedCompanion,
    statuses: [{ id: "chilled", turns: 2, power: 1 }],
  }) < getCompanionMoveSpeed(speedCompanion),
  "companion speed statistics must include active status effects",
);
assert.match(
  dungeonUiSource,
  /getCompanionMoveSpeed\(companion\)[\s\S]*getCompanionAttackSpeed\(companion\)/,
  "the companion inspector must display calculated movement and attack speed",
);
const levelOnePower = getPlayerAttack(companionGame.player);
assert.equal(
  getPlayerAttack({
    ...companionGame.player,
    level: MAX_PLAYER_LEVEL,
  }),
  levelOnePower,
  "levels alone must not increase attack before equipment or augments are chosen",
);
assert.equal(
  getPlayerAccuracy({
    ...companionGame.player,
    level: MAX_PLAYER_LEVEL,
  }),
  getPlayerAccuracy(companionGame.player),
  "levels alone must not increase accuracy",
);
assert.equal(
  getPlayerEvasion({
    ...companionGame.player,
    level: MAX_PLAYER_LEVEL,
  }),
  getPlayerEvasion(companionGame.player),
  "levels alone must not increase evasion",
);
assert.equal(
  getCompanionAttack({
    ...companionGame.companions[0],
    level: MAX_PLAYER_LEVEL,
  }),
  getCompanionAttack(companionGame.companions[0]),
  "companion levels alone must not increase attack",
);
assert.equal(
  getCompanionAccuracy({
    ...companionGame.companions[0],
    level: MAX_PLAYER_LEVEL,
  }),
  getCompanionAccuracy(companionGame.companions[0]),
  "companion levels alone must not increase accuracy",
);
assert.equal(
  getCompanionEvasion({
    ...companionGame.companions[0],
    level: MAX_PLAYER_LEVEL,
  }),
  getCompanionEvasion(companionGame.companions[0]),
  "companion levels alone must not increase evasion",
);

let recruitedGame = companionGame;
for (const classId of COMPANION_CLASS_IDS) {
  recruitedGame = developerRecruitCompanion(recruitedGame, classId);
}
assert.ok(
  COMPANION_CLASS_IDS.every((classId) =>
    recruitedGame.companions.some(
      (companion) => companion.classId === classId,
    ),
  ),
  "developer recruitment must expose every imported hero class for testing",
);

const swapGame = createNewGame(0x5a4f);
swapGame.enemies = [];
swapGame.objects = [];
const swapFrom = { x: swapGame.player.x, y: swapGame.player.y };
const swapTarget = { x: swapFrom.x + 1, y: swapFrom.y };
swapGame.tiles[swapTarget.y][swapTarget.x].terrain = "floor";
swapGame.companions[0].x = swapTarget.x;
swapGame.companions[0].y = swapTarget.y;
const swapped = playerStep(swapGame, 1, 0);
assert.deepEqual(
  { x: swapped.state.player.x, y: swapped.state.player.y },
  swapTarget,
  "the player must be able to move through a companion",
);
assert.deepEqual(
  {
    x: swapped.state.companions[0].x,
    y: swapped.state.companions[0].y,
  },
  swapFrom,
  "moving through a companion must swap the two actor positions",
);
assert.ok(
  swapped.motions.some(
    (motion) =>
      motion.id === swapped.state.companions[0].id &&
      motion.kind === "move",
  ),
  "a player/companion swap must animate both actors",
);
const afterSwapTurn = runEnemyTurn(swapped.state);
assert.equal(
  afterSwapTurn.motions.some(
    (motion) => motion.id === swapped.state.companions[0].id,
  ),
  false,
  "a swapped companion must not overwrite its swap animation with a second action",
);

const formationGame = createNewGame(0xf04a710);
formationGame.enemies = [];
formationGame.objects = [];
const formationCenter = {
  x: Math.max(5, Math.min(formationGame.width - 5, 10)),
  y: Math.max(3, Math.min(formationGame.height - 3, 10)),
};
for (let x = formationCenter.x - 4; x <= formationCenter.x + 1; x += 1) {
  formationGame.tiles[formationCenter.y][x].terrain = "floor";
}
formationGame.player.x = formationCenter.x;
formationGame.player.y = formationCenter.y;
formationGame.companions[0].x = formationCenter.x - 2;
formationGame.companions[0].y = formationCenter.y;
formationGame.companions[1].x = formationCenter.x - 3;
formationGame.companions[1].y = formationCenter.y;
formationGame.companionTrail = [
  { x: formationCenter.x - 1, y: formationCenter.y },
  { x: formationCenter.x - 2, y: formationCenter.y },
];
const formationTurn = runEnemyTurn(formationGame);
assert.ok(
  formationTurn.motions.some(
    (motion) =>
      motion.id === formationGame.companions[0].id &&
      motion.to.x === formationCenter.x - 1,
  ),
  "the lead companion must occupy the first point in the player's trail",
);
assert.ok(
  formationTurn.motions.some(
    (motion) =>
      motion.id === formationGame.companions[1].id &&
      motion.to.x === formationCenter.x - 2,
  ),
  "a following companion must enter the tile vacated by the ally ahead in the same turn",
);

const reservationGame = createNewGame(0xc0111510);
reservationGame.enemies = [];
reservationGame.objects = [];
const sharedDestination = { x: 10, y: 10 };
reservationGame.player.x = 10;
reservationGame.player.y = 13;
for (let x = 8; x <= 12; x += 1) {
  reservationGame.tiles[10][x].terrain = "floor";
}
reservationGame.tiles[13][10].terrain = "floor";
reservationGame.companions[0].x = 9;
reservationGame.companions[0].y = 10;
reservationGame.companions[1].x = 11;
reservationGame.companions[1].y = 10;
reservationGame.companionTrail = [sharedDestination];
const reservationTurn = runEnemyTurn(reservationGame);
assert.equal(
  reservationTurn.state.companions.filter(
    (companion) =>
      companion.x === sharedDestination.x &&
      companion.y === sharedDestination.y,
  ).length,
  1,
  "only one companion may claim a shared destination in the same turn",
);
assert.equal(
  new Set(
    reservationTurn.state.companions.map(
      (companion) => `${companion.x},${companion.y}`,
    ),
  ).size,
  reservationTurn.state.companions.length,
  "companions must never finish a turn stacked on one tile",
);
assert.equal(
  reservationTurn.motions.filter(
    (motion) =>
      motion.kind === "move" &&
      motion.to.x === sharedDestination.x &&
      motion.to.y === sharedDestination.y,
  ).length,
  1,
  "a losing destination reservation must make that companion wait",
);

const companionDoorGame = createNewGame(0xd001c04);
companionDoorGame.enemies = [];
companionDoorGame.objects = [];
companionDoorGame.player.x = 13;
companionDoorGame.player.y = 12;
companionDoorGame.companions[0].x = 9;
companionDoorGame.companions[0].y = 10;
companionDoorGame.companions[1].hp = 0;
for (let x = 9; x <= 11; x += 1) {
  companionDoorGame.tiles[10][x].terrain = "floor";
}
companionDoorGame.tiles[10][10].terrain = "door";
companionDoorGame.companionTrail = [{ x: 10, y: 10 }];
const companionEnteredDoor = runEnemyTurn(companionDoorGame);
assert.deepEqual(
  {
    x: companionEnteredDoor.state.companions[0].x,
    y: companionEnteredDoor.state.companions[0].y,
  },
  { x: 10, y: 10 },
  "a companion must open and enter a regular door in one movement turn",
);
assert.equal(
  companionEnteredDoor.motions.some(
    (motion) =>
      motion.id === companionEnteredDoor.state.companions[0].id &&
      motion.kind === "interact",
  ),
  false,
  "a companion opening a regular door must not spend an interaction turn",
);
assert.equal(
  companionEnteredDoor.state.tiles[10][10].terrain,
  "openDoor",
  "the doorway must stay open while the companion is standing in it",
);
assert.ok(
  companionEnteredDoor.soundCues?.some(({ id }) => id === "doorOpen"),
  "companion door movement must retain the door-open sound cue",
);
companionEnteredDoor.state.companionTrail = [{ x: 11, y: 10 }];
const companionLeftDoor = runEnemyTurn(companionEnteredDoor.state);
assert.deepEqual(
  {
    x: companionLeftDoor.state.companions[0].x,
    y: companionLeftDoor.state.companions[0].y,
  },
  { x: 11, y: 10 },
  "the companion must continue through the doorway on the next move",
);
assert.equal(
  companionLeftDoor.state.tiles[10][10].terrain,
  "door",
  "a door used by a companion must close automatically after it leaves",
);

const companionPickupGame = createNewGame(0xc011ec7);
companionPickupGame.enemies = [];
companionPickupGame.objects = [];
companionPickupGame.player.inventory = {};
companionPickupGame.player.inventoryInstances = [];
companionPickupGame.companions[1].hp = 0;
const pickingCompanion = companionPickupGame.companions[0];
companionPickupGame.groundItems = [{
  id: "companion-floor-potion",
  defId: "potion_healing",
  quantity: 1,
  manualPickup: true,
  x: pickingCompanion.x,
  y: pickingCompanion.y,
}];
const companionPickupTurn = runEnemyTurn(companionPickupGame);
assert.equal(
  companionPickupTurn.state.player.inventory.potion_healing,
  1,
  "a companion must transfer floor loot into the party's shared inventory",
);
assert.equal(
  companionPickupTurn.state.groundItems.length,
  0,
  "companion-picked loot must leave the floor",
);
assert.ok(
  companionPickupTurn.motions.some(
    (motion) =>
      motion.id === pickingCompanion.id && motion.kind === "interact",
  ),
  "companion pickup must spend its action on the interaction animation",
);
assert.ok(
  companionPickupTurn.pickups?.some(
    (pickup) =>
      pickup.id === "companion-floor-potion" &&
      pickup.sourceId === pickingCompanion.id,
  ),
  "companion pickup must expose an item visual tied to that companion",
);

const companionLootSeekGame = createNewGame(0xc011ec8);
companionLootSeekGame.enemies = [];
companionLootSeekGame.objects = [];
companionLootSeekGame.player.x = 13;
companionLootSeekGame.player.y = 12;
companionLootSeekGame.companions[1].hp = 0;
const seekingCompanion = companionLootSeekGame.companions[0];
seekingCompanion.x = 9;
seekingCompanion.y = 10;
for (let x = 9; x <= 10; x += 1) {
  companionLootSeekGame.tiles[10][x].terrain = "floor";
  companionLootSeekGame.tiles[10][x].discovered = true;
  companionLootSeekGame.tiles[10][x].visible = true;
}
companionLootSeekGame.groundItems = [{
  id: "companion-nearby-potion",
  defId: "potion_healing",
  quantity: 1,
  manualPickup: true,
  x: 10,
  y: 10,
}];
const companionLootApproach = runEnemyTurn(companionLootSeekGame);
assert.deepEqual(
  {
    x: companionLootApproach.state.companions[0].x,
    y: companionLootApproach.state.companions[0].y,
  },
  { x: 9, y: 10 },
  "a companion outside combat must follow the player instead of independently chasing loot",
);
assert.equal(
  companionLootApproach.state.groundItems.length,
  1,
  "visible loot must remain until the player or a companion already standing there collects it",
);

const companionAttackGame = createNewGame(0xc011ba7);
companionAttackGame.objects = [];
companionAttackGame.groundItems = [];
companionAttackGame.companions[1].hp = 0;
const attackingCompanion = companionAttackGame.companions[0];
attackingCompanion.x = 9;
attackingCompanion.y = 10;
companionAttackGame.tiles[10][9].terrain = "floor";
companionAttackGame.tiles[10][10].terrain = "floor";
companionAttackGame.enemies = [{
  id: "companion-finisher-target",
  kind: "rat",
  x: 10,
  y: 10,
  hp: 1,
  maxHp: 7,
  attack: 3,
  defense: 0,
  accuracy: 8,
  evasion: 999,
  xp: 0,
  alerted: false,
  sawPlayerLastTurn: false,
  sleeping: true,
  wakeCooldown: 0,
  lastSeenPlayer: null,
  searchTurns: 0,
  statuses: [],
}];
const companionFinisher = runEnemyTurn(companionAttackGame);
assert.ok(
  companionFinisher.motions.some(
    (motion) =>
      motion.id === attackingCompanion.id && motion.kind === "attack",
  ),
  "a companion finisher must expose its attack animation",
);
assert.equal(
  companionFinisher.effects.find((effect) => effect.text === "처치!")
    ?.sourceId,
  attackingCompanion.id,
  "a companion kill must remain tied to its attack impact timing",
);
assert.equal(
  companionFinisher.state.enemies.length,
  0,
  "the finished enemy must still be removed from the resolved game state",
);

let companionLevelGame = createNewGame(0x1e7e1);
companionLevelGame.companions[0].hp = 0;
companionLevelGame.companions[1].hp = 3;
companionLevelGame.companions[1].xp =
  companionLevelGame.companions[1].nextXp - 2;
const fallenCompanionXp = companionLevelGame.companions[0].xp;
const activeCompanionLevel = companionLevelGame.companions[1].level;
const activeCompanionMaxHp = companionLevelGame.companions[1].maxHp;
const activeCompanionAttack = companionLevelGame.companions[1].baseAttack;
companionLevelGame.player.xp = companionLevelGame.player.nextXp - 1;
companionLevelGame = developerGrantItem(
  companionLevelGame,
  "potion_experience",
);
const companionHealthBeforeLevel = companionLevelGame.companions.map(
  ({ hp }) => hp,
);
const companionLevelResult = consumeItemAction(
  companionLevelGame,
  "potion_experience",
).state;
assert.ok(
  companionLevelResult.player.level > companionLevelGame.player.level,
  "the companion health regression test must trigger a level-up",
);
assert.deepEqual(
  companionLevelResult.companions.map(({ hp }) => hp),
  companionHealthBeforeLevel,
  "player level-up must neither revive nor heal companions",
);
assert.equal(
  companionLevelResult.companions[0].xp,
  fallenCompanionXp,
  "a defeated companion must retain its own experience total",
);
assert.ok(
  companionLevelResult.companions[1].level > activeCompanionLevel,
  "each active companion must resolve experience in its own progression record",
);
assert.notEqual(
  companionLevelResult.companions[1].xp,
  companionLevelResult.player.xp,
  "leader and companion experience must no longer be a mirrored shared value",
);
assert.equal(
  companionLevelResult.companions[1].maxHp,
  Math.max(
    activeCompanionMaxHp + 1,
    Math.round(activeCompanionMaxHp * LEVEL_STAT_GROWTH),
  ),
  "companion level-up must increase maximum health by ten percent",
);
assert.equal(
  companionLevelResult.companions[1].baseAttack,
  Math.round(activeCompanionAttack * LEVEL_STAT_GROWTH * 1_000_000) /
    1_000_000,
  "companion level-up must increase base attack by ten percent",
);

const companionObjectGame = createNewGame(0x0b1ec7);
companionObjectGame.enemies = [];
companionObjectGame.groundItems = [];
companionObjectGame.companions[1].hp = 0;
companionObjectGame.player.x = 13;
companionObjectGame.player.y = 12;
companionObjectGame.companions[0].x = 9;
companionObjectGame.companions[0].y = 10;
companionObjectGame.tiles[10][9].terrain = "floor";
companionObjectGame.tiles[10][10].terrain = "floor";
companionObjectGame.objects = [{
  id: "companion-blocked-chest",
  kind: "chest",
  looted: false,
  loot: ["shortsword"],
  x: 10,
  y: 10,
}];
companionObjectGame.companionTrail = [{ x: 10, y: 10 }];
const companionObjectTurn = runEnemyTurn(companionObjectGame);
assert.equal(
  companionObjectTurn.state.objects[0].looted,
  false,
  "companions must leave farming objects for the player to interact with",
);
assert.deepEqual(
  {
    x: companionObjectTurn.state.companions[0].x,
    y: companionObjectTurn.state.companions[0].y,
  },
  { x: 9, y: 10 },
  "an unopened farming object must remain a hard companion path boundary",
);

/* Legacy per-companion command scenarios retained for save-history context.
let accompanyGame = createNewGame(0xacC04);
accompanyGame.enemies = [];
accompanyGame.objects = [];
accompanyGame.player.x = 12;
accompanyGame.player.y = 10;
for (let x = 6; x <= 12; x += 1) {
  accompanyGame.tiles[10][x].terrain = "floor";
}
const leaderId = accompanyGame.companions[0].id;
const accompanyingId = accompanyGame.companions[1].id;
accompanyGame.companions[0].x = 8;
accompanyGame.companions[0].y = 10;
accompanyGame.companions[1].x = 7;
accompanyGame.companions[1].y = 10;
accompanyGame.companionTrail = [{ x: 9, y: 10 }];
accompanyGame = setCompanionCommand(
  accompanyGame,
  accompanyingId,
  "accompany",
);
assert.equal(
  accompanyGame.companions.find(({ id }) => id === accompanyingId)
    ?.commandTargetId,
  leaderId,
  "the accompany command must bind to another living companion",
);
const accompanyTurn = runEnemyTurn(accompanyGame);
assert.deepEqual(
  {
    x: accompanyTurn.state.companions.find(({ id }) => id === leaderId)?.x,
    y: accompanyTurn.state.companions.find(({ id }) => id === leaderId)?.y,
  },
  { x: 9, y: 10 },
  "the lead companion must keep its own movement command",
);
assert.deepEqual(
  {
    x: accompanyTurn.state.companions.find(
      ({ id }) => id === accompanyingId,
    )?.x,
    y: accompanyTurn.state.companions.find(
      ({ id }) => id === accompanyingId,
    )?.y,
  },
  { x: 8, y: 10 },
  "an accompanying companion must step into the moving leader's old position",
);

let accompanyCombatGame = createNewGame(0xacC06);
accompanyCombatGame.objects = [];
accompanyCombatGame.groundItems = [];
accompanyCombatGame.tiles.forEach((row) =>
  row.forEach((tile) => {
    tile.discovered = true;
    tile.visible = false;
  }),
);
accompanyCombatGame.player.x = 14;
accompanyCombatGame.player.y = 10;
for (let x = 5; x <= 14; x += 1) {
  accompanyCombatGame.tiles[10][x].terrain = "floor";
}
accompanyCombatGame.companions[0].x = 5;
accompanyCombatGame.companions[0].y = 10;
accompanyCombatGame.companions[1].x = 7;
accompanyCombatGame.companions[1].y = 10;
accompanyCombatGame.companions[1].autoSlots = [null, null, null, null];
accompanyCombatGame = setCompanionCommand(
  accompanyCombatGame,
  accompanyCombatGame.companions[1].id,
  "accompany",
);
accompanyCombatGame.enemies = [{
  id: "accompany-nearby-enemy",
  kind: "rat",
  x: 9,
  y: 10,
  hp: 7,
  maxHp: 7,
  attack: 2,
  defense: 0,
  accuracy: 0,
  evasion: 0,
  xp: 0,
  alerted: true,
  sawPlayerLastTurn: false,
  sleeping: false,
  wakeCooldown: 0,
  lastSeenPlayer: null,
  searchTurns: 0,
  statuses: [],
}];
const accompanyCombatTurn = runEnemyTurn(accompanyCombatGame);
const accompanyCombatant = accompanyCombatGame.companions[1];
assert.ok(
  accompanyCombatTurn.motions.some(
    (motion) =>
      motion.id === accompanyCombatant.id &&
      motion.kind === "move" &&
      motion.to.x === 8 &&
      motion.to.y === 10,
  ),
  "an accompanying companion must approach a nearby enemy even after exploration is complete",
);
const unavailableAccompanyGame = createNewGame(0xacC05);
unavailableAccompanyGame.companions[1].hp = 0;
const unavailableAccompany = setCompanionCommand(
  unavailableAccompanyGame,
  unavailableAccompanyGame.companions[0].id,
  "accompany",
);
assert.equal(
  unavailableAccompany.companions[0].command,
  "follow",
  "the accompany command must remain unavailable without another living companion",
);

let divergentExploreGame = createNewGame(0xd1a3e7);
divergentExploreGame.enemies = [];
divergentExploreGame.objects = [];
divergentExploreGame.tiles.forEach((row) =>
  row.forEach((tile) => {
    tile.terrain = "wall";
    tile.discovered = true;
    tile.visible = false;
  }),
);
for (let x = 5; x <= 15; x += 1) {
  divergentExploreGame.tiles[10][x].terrain = "floor";
}
divergentExploreGame.tiles[10][4].discovered = false;
divergentExploreGame.tiles[10][16].discovered = false;
divergentExploreGame.player.x = 10;
divergentExploreGame.player.y = 10;
divergentExploreGame.companions[0].x = 9;
divergentExploreGame.companions[0].y = 10;
divergentExploreGame.companions[1].x = 11;
divergentExploreGame.companions[1].y = 10;
for (const companion of divergentExploreGame.companions) {
  divergentExploreGame = setCompanionCommand(
    divergentExploreGame,
    companion.id,
    "explore",
  );
}
const divergentExploreTurn = runEnemyTurn(divergentExploreGame);
assert.deepEqual(
  {
    x: divergentExploreTurn.state.player.x,
    y: divergentExploreTurn.state.player.y,
  },
  {
    x: divergentExploreGame.player.x,
    y: divergentExploreGame.player.y,
  },
  "companion exploration turns must never move the stationary player",
);
const [firstExploreTarget, secondExploreTarget] =
  divergentExploreTurn.state.companions.map(
    (companion) => companion.exploreTarget,
  );
assert.ok(
  firstExploreTarget &&
    secondExploreTarget &&
    (firstExploreTarget.x - divergentExploreGame.player.x) *
      (secondExploreTarget.x - divergentExploreGame.player.x) <
      0,
  "solo explorers must claim frontiers in different directions when alternatives exist",
);

const commandGame = setCompanionCommand(
  companionGame,
  companionGame.companions[0].id,
  "explore",
);
assert.equal(
  commandGame.companions[0].command,
  "explore",
  "each companion command must independently switch to solo exploration",
);
assert.equal(
  companionGame.companions[0].command,
  "follow",
  "changing a command must preserve the previous immutable game state",
);
*/

let priorityMoveGame = createNewGame(0xacC04);
priorityMoveGame.enemies = [];
priorityMoveGame.objects = [];
priorityMoveGame.groundItems = [];
priorityMoveGame.tiles.forEach((row) =>
  row.forEach((tile) => {
    tile.terrain = "wall";
    tile.discovered = true;
    tile.visible = false;
  }),
);
for (let x = 5; x <= 14; x += 1) {
  priorityMoveGame.tiles[10][x].terrain = "floor";
}
priorityMoveGame.player.x = 14;
priorityMoveGame.player.y = 10;
priorityMoveGame.companions[0].x = 5;
priorityMoveGame.companions[0].y = 10;
priorityMoveGame.companions[1].hp = 0;
const priorityCompanionId = priorityMoveGame.companions[0].id;
priorityMoveGame = setCompanionPriorityTarget(
  priorityMoveGame,
  priorityCompanionId,
  { x: 10, y: 10 },
);
assert.deepEqual(
  priorityMoveGame.companions[0].priorityTarget,
  { x: 10, y: 10 },
  "dropping a companion on a walkable tile must store a priority movement target",
);
const priorityMoveTurn = runEnemyTurn(priorityMoveGame);
assert.deepEqual(
  {
    x: priorityMoveTurn.state.companions[0].x,
    y: priorityMoveTurn.state.companions[0].y,
  },
  { x: 6, y: 10 },
  "a dragged companion must move toward its priority tile before ordinary following",
);

const legacyCommandGame = createNewGame(0xacC05);
legacyCommandGame.companions[0].command = "explore";
legacyCommandGame.companions[0].exploreTarget = { x: 1, y: 1 };
const normalizedCommandGame = setCompanionCommand(
  legacyCommandGame,
  legacyCommandGame.companions[0].id,
  "hold",
);
assert.equal(
  normalizedCommandGame.companions[0].command,
  "follow",
  "legacy companion commands must normalize to always following the player",
);
assert.equal(
  normalizedCommandGame.companions[0].exploreTarget,
  null,
  "disabling companion commands must clear legacy exploration targets",
);

let reservedPositionGame = createNewGame(0xacC06);
reservedPositionGame.enemies = [];
reservedPositionGame.objects = [];
reservedPositionGame.groundItems = [];
reservedPositionGame.tiles.forEach((row) =>
  row.forEach((tile) => {
    tile.terrain = "wall";
    tile.discovered = true;
    tile.visible = false;
  }),
);
for (let x = 5; x <= 14; x += 1) {
  reservedPositionGame.tiles[10][x].terrain = "floor";
}
reservedPositionGame.player.x = 14;
reservedPositionGame.player.y = 10;
reservedPositionGame.companions[0].x = 7;
reservedPositionGame.companions[0].y = 10;
reservedPositionGame.companions[1].x = 8;
reservedPositionGame.companions[1].y = 10;
reservedPositionGame = setCompanionPriorityTarget(
  reservedPositionGame,
  reservedPositionGame.companions[0].id,
  { x: 8, y: 10 },
);
reservedPositionGame = setCompanionPriorityTarget(
  reservedPositionGame,
  reservedPositionGame.companions[1].id,
  { x: 7, y: 10 },
);
const reservedPositionTurn = runEnemyTurn(reservedPositionGame);
const reservedPositions = reservedPositionTurn.state.companions.map(
  ({ x, y }) => ({ x, y }),
);
assert.notDeepEqual(
  reservedPositions,
  [{ x: 8, y: 10 }, { x: 7, y: 10 }],
  "companions must never swap through another companion's occupied combat tile",
);
assert.equal(
  new Set(reservedPositions.map(({ x, y }) => `${x},${y}`)).size,
  reservedPositions.length,
  "companions choosing alternate approaches must still reserve distinct destinations",
);

const sharedCombatGame = createNewGame(0xacC07);
sharedCombatGame.objects = [];
sharedCombatGame.groundItems = [];
sharedCombatGame.tiles.forEach((row) =>
  row.forEach((tile) => {
    tile.terrain = "wall";
    tile.discovered = true;
    tile.visible = false;
  }),
);
for (let x = 5; x <= 12; x += 1) {
  sharedCombatGame.tiles[10][x].terrain = "floor";
}
sharedCombatGame.tiles[9][10].terrain = "floor";
sharedCombatGame.player.x = 10;
sharedCombatGame.player.y = 9;
sharedCombatGame.companions[0].x = 5;
sharedCombatGame.companions[0].y = 10;
sharedCombatGame.companions[0].autoSlots = [null, null, null, null];
sharedCombatGame.companions[1].hp = 0;
sharedCombatGame.enemies = [{
  id: "party-engaged-enemy",
  kind: "rat",
  x: 10,
  y: 10,
  hp: 7,
  maxHp: 7,
  attack: 2,
  defense: 0,
  accuracy: 0,
  evasion: 0,
  xp: 0,
  alerted: true,
  sawPlayerLastTurn: false,
  sleeping: false,
  wakeCooldown: 0,
  lastSeenPlayer: null,
  searchTurns: 0,
  statuses: [],
}];
const sharedCombatTurn = runEnemyTurn(sharedCombatGame);
assert.ok(
  sharedCombatTurn.motions.some(
    (motion) =>
      motion.id === sharedCombatGame.companions[0].id &&
      motion.kind === "move" &&
      motion.to.x === 6 &&
      motion.to.y === 10,
  ),
  "a companion must join combat when the player or another companion is already engaged",
);

let companionEquipmentGame = createNewGame(0xe9019);
companionEquipmentGame.enemies = [];
companionEquipmentGame.player.inventory = {};
companionEquipmentGame.player.inventoryInstances = [];
companionEquipmentGame = developerGrantItem(
  companionEquipmentGame,
  "shortsword",
  1,
);
const companionWeapon =
  companionEquipmentGame.player.inventoryInstances.find(
    (instance) => instance.defId === "shortsword",
  )!;
const weaponTarget = {
  kind: "equipment" as const,
  slot: "weapon" as const,
};
assert.equal(
  canAssignCompanionItem(
    companionEquipmentGame,
    companionWeapon.id,
    weaponTarget,
  ),
  true,
  "a compatible inventory weapon must be selectable for a companion",
);
const equippedCompanion = assignCompanionItem(
  companionEquipmentGame,
  companionEquipmentGame.companions[0].id,
  weaponTarget,
  companionWeapon.id,
);
assert.equal(
  equippedCompanion.state.companions[0].equipment.weapon,
  "shortsword",
  "assigning companion equipment must move it out of the player inventory",
);
assert.equal(
  equippedCompanion.state.player.inventoryInstances.some(
    (instance) => instance.id === companionWeapon.id,
  ),
  false,
  "companion equipment must not remain duplicated in the player inventory",
);
equippedCompanion.state.companions[0].equipmentInstances.weapon!.cursed = true;
const blockedCompanionWeapon = unassignCompanionItem(
  equippedCompanion.state,
  equippedCompanion.state.companions[0].id,
  weaponTarget,
);
assert.equal(
  blockedCompanionWeapon.consumedTurn,
  false,
  "a companion's cursed equipment must refuse removal",
);
blockedCompanionWeapon.state.player.inventory.scroll_remove_curse = 1;
const cleansedCompanionWeapon = consumeItemAction(
  blockedCompanionWeapon.state,
  "scroll_remove_curse",
);
assert.equal(
  cleansedCompanionWeapon.state.companions[0].equipmentInstances.weapon?.cursed,
  false,
  "Remove Curse must cleanse equipment worn by companions as well as the player",
);
const recoveredCompanionWeapon = unassignCompanionItem(
  cleansedCompanionWeapon.state,
  cleansedCompanionWeapon.state.companions[0].id,
  weaponTarget,
);
assert.equal(
  recoveredCompanionWeapon.state.companions[0].equipment.weapon,
  null,
  "recovering companion equipment must clear its slot",
);
assert.ok(
  recoveredCompanionWeapon.state.player.inventoryInstances.some(
    (instance) => instance.defId === "shortsword",
  ),
  "recovered companion equipment must return to the inventory",
);

let companionRingGame = createNewGame(0xe9020);
companionRingGame.player.inventory = {};
companionRingGame.player.inventoryInstances = [];
companionRingGame = developerGrantItem(companionRingGame, "ring_haste");
const companionRing = companionRingGame.player.inventoryInstances.find(
  (instance) => instance.defId === "ring_haste",
)!;
const companionPassiveTarget = { kind: "flex" as const, index: 1 as const };
const companionQuickslotTarget = { kind: "flex" as const, index: 2 as const };
assert.deepEqual(
  [...COMPANION_PASSIVE_SLOT_INDEXES],
  [0, 1],
  "the first two flexible positions must be reserved for passive equipment",
);
assert.deepEqual(
  [...COMPANION_QUICKSLOT_INDEXES],
  [2, 3],
  "only the final two flexible positions may activate items",
);
assert.equal(
  canAssignCompanionItem(
    companionRingGame,
    companionRing.id,
    companionQuickslotTarget,
  ),
  false,
  "rings must be rejected by a companion's active quickslots",
);
const companionWithRing = assignCompanionItem(
  companionRingGame,
  companionRingGame.companions[0].id,
  companionPassiveTarget,
  companionRing.id,
).state;
assert.equal(
  companionWithRing.companions[0].equipment.ring2,
  "ring_haste",
  "the companion's second passive slot must accept a ring",
);
assert.equal(
  companionWithRing.companions[0].autoSlots.length,
  4,
  "the compatibility tuple must retain four saved positions while exposing only two active quickslots",
);
const companionWithoutRing = unassignCompanionItem(
  companionWithRing,
  companionWithRing.companions[0].id,
  companionPassiveTarget,
).state;
assert.equal(
  companionWithoutRing.companions[0].equipment.ring2,
  null,
  "remove-button flows must be able to clear a companion passive ring",
);

let companionArtifactGame = developerGrantItem(
  createNewGame(0xe9021),
  "alchemists_toolkit",
);
const companionArtifact = companionArtifactGame.player.inventoryInstances.find(
  (instance) => instance.defId === "alchemists_toolkit",
)!;
assert.equal(
  canAssignCompanionItem(
    companionArtifactGame,
    companionArtifact.id,
    { kind: "flex", index: 0 },
  ),
  true,
  "a companion passive slot must accept artifacts",
);
assert.equal(
  canAssignCompanionItem(
    companionArtifactGame,
    companionArtifact.id,
    companionQuickslotTarget,
  ),
  false,
  "an artifact must never enter an active quickslot",
);
assert.equal(
  canAssignPlayerItem(
    companionArtifactGame,
    companionArtifact.id,
    { kind: "flex", index: 0 },
  ),
  true,
  "the controlled party member must use the same passive-slot rules",
);
companionArtifactGame = assignCompanionItem(
  companionArtifactGame,
  companionArtifactGame.companions[0].id,
  { kind: "flex", index: 0 },
  companionArtifact.id,
).state;
assert.equal(
  companionArtifactGame.companions[0].equipment.ring,
  "alchemists_toolkit",
  "artifacts must persist in a companion passive equipment position",
);

const legacyLoadoutCompanion = createStarterCompanionRoster(["mage"])[0];
const legacyRing = createPlainEquipmentInstance(
  ITEM_DEFS.ring_haste,
  "legacy-passive-ring",
);
const legacyArtifact = createPlainEquipmentInstance(
  ITEM_DEFS.alchemists_toolkit,
  "legacy-passive-artifact",
);
const legacyOverflowRing = createPlainEquipmentInstance(
  ITEM_DEFS.ring_energy,
  "legacy-overflow-ring",
);
const legacyWand = createPlainEquipmentInstance(
  ITEM_DEFS.wand_frost,
  "legacy-active-wand",
);
const legacyOverflowMissile = createPlainEquipmentInstance(
  ITEM_DEFS.throwing_knife,
  "legacy-overflow-missile",
);
legacyLoadoutCompanion.equipment = {
  ...legacyLoadoutCompanion.equipment,
  ring: legacyRing.defId,
  ring2: legacyArtifact.defId,
  ring3: legacyOverflowRing.defId,
  ring4: null,
};
legacyLoadoutCompanion.equipmentInstances = {
  ...legacyLoadoutCompanion.equipmentInstances,
  ring: legacyRing,
  ring2: legacyArtifact,
  ring3: legacyOverflowRing,
  ring4: null,
};
legacyLoadoutCompanion.autoSlots = [
  { defId: legacyWand.defId, quantity: 1, instance: legacyWand },
  { defId: "potion_healing", quantity: 2, instance: null },
  {
    defId: legacyOverflowMissile.defId,
    quantity: 1,
    instance: legacyOverflowMissile,
  },
  null,
];
const migratedLegacyLoadout =
  normalizeCompanionForHubWithReleasedItems(legacyLoadoutCompanion);
assert.deepEqual(
  {
    passives: [
      migratedLegacyLoadout.companion.equipment.ring,
      migratedLegacyLoadout.companion.equipment.ring2,
      migratedLegacyLoadout.companion.equipment.ring3,
      migratedLegacyLoadout.companion.equipment.ring4,
    ],
    quickslots: migratedLegacyLoadout.companion.autoSlots.map(
      (slot) => slot?.defId ?? null,
    ),
  },
  {
    passives: ["ring_haste", "alchemists_toolkit", null, null],
    quickslots: [null, null, "wand_frost", "potion_healing"],
  },
  "legacy four-flex saves must migrate into two passive slots and two manual quickslots",
);
assert.deepEqual(
  migratedLegacyLoadout.releasedInstances
    .map((instance) => instance.id)
    .sort(),
  [legacyOverflowMissile.id, legacyOverflowRing.id].sort(),
  "individual equipment displaced by the 2+2 migration must return to storage",
);

const missileId = Object.values(ITEM_DEFS).find(
  (definition) => definition.category === "missile",
)!.id;
let companionAutoGame = createNewGame(0xa070);
companionAutoGame.enemies = [];
companionAutoGame.player.inventory = {};
companionAutoGame.player.inventoryInstances = [];
companionAutoGame = developerGrantItem(companionAutoGame, missileId);
companionAutoGame = developerGrantItem(companionAutoGame, missileId);
const [firstCompanionMissile, secondCompanionMissile] =
  companionAutoGame.player.inventoryInstances.filter(
    (instance) => instance.defId === missileId,
  );
const autoTarget = {
  kind: "flex" as const,
  index: 2 as const,
};
const assignedFirstAuto = assignCompanionItem(
  companionAutoGame,
  companionAutoGame.companions[0].id,
  autoTarget,
  firstCompanionMissile.id,
).state;
const assignedAuto = assignCompanionItem(
  assignedFirstAuto,
  assignedFirstAuto.companions[1].id,
  autoTarget,
  secondCompanionMissile.id,
).state;
assert.equal(
  assignedAuto.companions[0].autoSlots[2]?.instance?.charges,
  3,
  "a companion throwable slot must own its equipment's complete charge gauge",
);
assert.equal(
  assignedAuto.companions[1].autoSlots[2]?.instance?.id,
  secondCompanionMissile.id,
  "a second companion may equip a different instance of the same throwable type",
);
assert.equal(
  assignedAuto.player.inventoryInstances.some(
    (instance) =>
      instance.id === firstCompanionMissile.id ||
      instance.id === secondCompanionMissile.id,
  ),
  false,
  "quick-slot equipment must leave the shared inventory when companions equip it",
);
const autoCompanion = assignedAuto.companions[0];
assignedAuto.companions[0].command = "explore";
const autoEnemyPoint = {
  x: autoCompanion.x + 3,
  y: autoCompanion.y,
};
for (let x = autoCompanion.x; x <= autoEnemyPoint.x; x += 1) {
  assignedAuto.tiles[autoCompanion.y][x].terrain = "floor";
  assignedAuto.tiles[autoCompanion.y][x].visible = true;
  assignedAuto.tiles[autoCompanion.y][x].discovered = true;
}
assignedAuto.companions.slice(1).forEach((companion) => {
  companion.hp = 0;
});
assignedAuto.enemies = [{
  id: "companion-auto-target",
  kind: "rat",
  ...autoEnemyPoint,
  hp: 40,
  maxHp: 40,
  attack: 1,
  defense: 0,
  accuracy: 1,
  evasion: 0,
  xp: 0,
  alerted: true,
  sawPlayerLastTurn: false,
  sleeping: false,
  wakeCooldown: 0,
  lastSeenPlayer: null,
  searchTurns: 0,
  statuses: [],
}];
const autoTurn = runEnemyTurn(assignedAuto);
assert.equal(
  autoTurn.motions.some(
    (motion) =>
      motion.id === autoCompanion.id &&
      motion.kind === "attack",
  ),
  false,
  "a companion must never activate a quickslot item without explicit input",
);
assert.equal(
  autoTurn.state.companions[0].autoSlots[2]?.instance?.id,
  firstCompanionMissile.id,
  "an idle quickslot must retain the exact equipment instance",
);
assert.equal(
  autoTurn.state.companions[0].autoSlots[2]?.instance?.durability,
  10,
  "AI turns must not spend quickslot durability",
);
assert.equal(
  autoTurn.state.companions[0].autoSlots[2]?.instance?.charges,
  3,
  "AI turns must not spend quickslot charges",
);
assert.equal(
  autoTurn.throws?.some(
    (itemThrow) => itemThrow.sourceId === autoCompanion.id,
  ) ?? false,
  false,
  "AI turns must not emit companion quickslot projectiles",
);

const manualThrowableTurn = activateCompanionQuickslot(
  assignedAuto,
  autoCompanion.id,
  2,
  autoEnemyPoint,
);
assert.equal(
  manualThrowableTurn.consumedTurn,
  true,
  "clicking a companion quickslot must explicitly activate its throwable",
);
assert.equal(
  manualThrowableTurn.state.companions[0].autoSlots[2]?.instance?.durability,
  9,
  "an explicit successful companion throw must reduce that instance's durability",
);
assert.equal(
  manualThrowableTurn.state.companions[0].autoSlots[2]?.instance?.charges,
  2,
  "an explicit companion throw must spend one independently owned charge",
);
assert.ok(
  manualThrowableTurn.state.groundItems.some(
    (item) =>
      item.defId === missileId &&
      item.recoversThrowableCharge &&
      item.recoversItemRef === firstCompanionMissile.id,
  ),
  "an explicitly thrown companion projectile must land as a recoverable charge",
);
assert.ok(
  manualThrowableTurn.throws?.some(
    (itemThrow) =>
      itemThrow.defId === missileId &&
      itemThrow.sourceId === autoCompanion.id &&
      itemThrow.to.x === autoEnemyPoint.x &&
      itemThrow.to.y === autoEnemyPoint.y,
  ),
  "a companion ranged attack must emit the same visible projectile event as a player throw",
);
const companionRecoveryState = manualThrowableTurn.state;
companionRecoveryState.enemies = [];
companionRecoveryState.companions[0].x = autoEnemyPoint.x;
companionRecoveryState.companions[0].y = autoEnemyPoint.y;
assert.equal(
  hasCompanionExplorationWork(companionRecoveryState),
  false,
  "disabled companion commands must never schedule independent exploration work",
);
const companionRecoveryTurn = runEnemyTurn(companionRecoveryState);
assert.equal(
  companionRecoveryTurn.state.companions[0].autoSlots[2]?.instance?.charges,
  3,
  "a following companion standing on its own projectile must still restore that equipment's charge",
);

const starterCompanionGame = createNewGame(0xc011ab);
assert.ok(
  starterCompanionGame.companions.every(
    (companion) =>
      companion.equipment.weapon && companion.equipment.armor,
  ),
  "every starting companion must receive a random weapon and armor",
);

let companionPotionGame = createNewGame(0xc011ac);
companionPotionGame.enemies = [];
companionPotionGame.groundItems = [];
companionPotionGame.companions.slice(1).forEach((companion) => {
  companion.hp = 0;
});
assert.equal(
  canAssignCompanionItem(
    companionPotionGame,
    "potion_healing",
    autoTarget,
  ),
  true,
  "companion manual quickslots must accept potions",
);
companionPotionGame = assignCompanionItem(
  companionPotionGame,
  companionPotionGame.companions[0].id,
  autoTarget,
  "potion_healing",
).state;
companionPotionGame = assignCompanionItem(
  companionPotionGame,
  companionPotionGame.companions[1].id,
  autoTarget,
  "potion_healing",
).state;
assert.equal(
  companionPotionGame.companions[1].autoSlots[2]?.defId,
  "potion_healing",
  "multiple companions must be able to register one shared healing-potion stack",
);
const sharedPotionCount = companionPotionGame.player.inventory.potion_healing;
companionPotionGame.companions[0].hp = 1;
const potionTurn = runEnemyTurn(companionPotionGame);
assert.equal(
  potionTurn.state.companions[0].hp,
  1,
  "a low-health companion must wait for explicit potion input",
);
assert.equal(
  potionTurn.soundCues?.some((cue) => cue.id === "drink") ?? false,
  false,
  "AI turns must not queue a quickslot potion sound",
);
assert.equal(
  potionTurn.state.player.inventory.potion_healing,
  sharedPotionCount,
  "AI turns must preserve the shared potion stack",
);
const manualPotionTurn = activateCompanionQuickslot(
  potionTurn.state,
  potionTurn.state.companions[0].id,
  2,
  potionTurn.state.companions[0],
);
assert.ok(
  manualPotionTurn.state.companions[0].hp > 1,
  "clicking the healing quickslot must heal its companion",
);
assert.ok(
  manualPotionTurn.soundCues?.some((cue) => cue.id === "drink"),
  "manual companion healing must queue the potion sound",
);
assert.equal(
  manualPotionTurn.state.player.inventory.potion_healing,
  sharedPotionCount - 1,
  "manual companion healing must consume one shared potion",
);
assert.equal(
  manualPotionTurn.state.companions[1].autoSlots[2]?.defId,
  "potion_healing",
  "another companion's registration must remain after one shared potion is consumed",
);

const holdGame = createNewGame(0xc011ad);
holdGame.enemies = [];
holdGame.groundItems = [];
holdGame.companions.slice(1).forEach((companion) => {
  companion.hp = 0;
});
const heldCompanion = holdGame.companions[0];
heldCompanion.command = "hold";
const heldStart = { x: heldCompanion.x, y: heldCompanion.y };
const heldEnemyPoint = [
  { x: heldCompanion.x + 1, y: heldCompanion.y },
  { x: heldCompanion.x - 1, y: heldCompanion.y },
  { x: heldCompanion.x, y: heldCompanion.y + 1 },
  { x: heldCompanion.x, y: heldCompanion.y - 1 },
].find(
  (point) =>
    holdGame.tiles[point.y]?.[point.x] &&
    (point.x !== holdGame.player.x || point.y !== holdGame.player.y),
)!;
holdGame.tiles[heldEnemyPoint.y][heldEnemyPoint.x].terrain = "floor";
holdGame.enemies = [{
  id: "hold-position-target",
  kind: "rat",
  ...heldEnemyPoint,
  hp: 50,
  maxHp: 50,
  attack: 0,
  defense: 0,
  accuracy: 0,
  evasion: 0,
  xp: 0,
  alerted: true,
  sawPlayerLastTurn: false,
  sleeping: false,
  wakeCooldown: 0,
  lastSeenPlayer: null,
  searchTurns: 0,
  statuses: [],
}];
const heldTurn = runEnemyTurn(holdGame);
assert.deepEqual(
  {
    x: heldTurn.state.companions[0].x,
    y: heldTurn.state.companions[0].y,
  },
  heldStart,
  "hold-position companions must not leave their current tile",
);
assert.ok(
  heldTurn.motions.some(
    (motion) => motion.id === heldCompanion.id && motion.kind === "attack",
  ),
  "hold-position companions must still attack adjacent monsters",
);

const regroupGame = createNewGame(0xc011ae);
regroupGame.enemies = [];
regroupGame.groundItems = [];
regroupGame.companions.slice(1).forEach((companion) => {
  companion.hp = 0;
});
const regroupCompanion = regroupGame.companions[0];
regroupCompanion.command = "explore";
regroupCompanion.hp = 1;
regroupCompanion.autoSlots = [null, null, null, null];
const regroupStartDistance = Math.max(
  Math.abs(regroupCompanion.x - regroupGame.player.x),
  Math.abs(regroupCompanion.y - regroupGame.player.y),
);
const regroupTurn = runEnemyTurn(regroupGame);
assert.equal(
  regroupTurn.state.companions[0].command,
  "follow",
  "legacy low-health commands must normalize to permanent player following",
);
assert.ok(
  Math.max(
    Math.abs(regroupTurn.state.companions[0].x - regroupTurn.state.player.x),
    Math.abs(regroupTurn.state.companions[0].y - regroupTurn.state.player.y),
  ) <= regroupStartDistance,
  "a low-health companion must continue regrouping toward the player",
);

const wandId = Object.values(ITEM_DEFS).find(
  (definition) => definition.category === "wand",
)!.id;
let rechargeGame = createNewGame(0xc011af);
rechargeGame = developerGrantItem(rechargeGame, wandId);
const rechargeWand = rechargeGame.player.inventoryInstances.find(
  (instance) => instance.defId === wandId,
)!;
rechargeWand.charges = 0;
rechargeWand.rechargeProgress = 0;
for (let turn = 0; turn < 49; turn += 1) advanceWandRecharge(rechargeGame);
assert.equal(
  rechargeWand.charges,
  0,
  "a wand must not recharge before 50 turns have accumulated",
);
advanceWandRecharge(rechargeGame);
assert.equal(
  rechargeWand.charges,
  1,
  "a wand must recover one charge every 50 turns",
);

let durabilityGame = createNewGame(0xc011b0);
durabilityGame.companions = [];
durabilityGame.enemies = [];
durabilityGame.player.inventory = {};
durabilityGame.player.inventoryInstances = [];
durabilityGame = developerGrantItem(durabilityGame, missileId);
const durabilityProfile = durabilityGame.player.inventoryInstances.find(
  (instance) => instance.defId === missileId,
)!;
durabilityProfile.maxDurability = 10;
durabilityProfile.durability = 1;
const durabilityTarget = {
  x: durabilityGame.player.x + 1,
  y: durabilityGame.player.y,
};
durabilityGame.tiles[durabilityTarget.y][durabilityTarget.x].terrain = "floor";
durabilityGame.enemies = [{
  id: "durability-target",
  kind: "rat",
  ...durabilityTarget,
  hp: 100,
  maxHp: 100,
  attack: 0,
  defense: 0,
  accuracy: 0,
  evasion: 0,
  xp: 0,
  alerted: true,
  sawPlayerLastTurn: false,
  sleeping: false,
  wakeCooldown: 0,
  lastSeenPlayer: null,
  searchTurns: 0,
  statuses: [],
}];
const brokenThrowable = throwItem(
  durabilityGame,
  durabilityProfile.id,
  durabilityTarget,
);
assert.equal(
  brokenThrowable.itemBreak,
  true,
  "the tenth damaging throwable hit must break that throwable",
);
assert.equal(
  brokenThrowable.state.player.inventoryInstances.some(
    (instance) => instance.id === durabilityProfile.id,
  ),
  true,
  "breaking a throwable must preserve ownership of the equipment instance",
);
const brokenThrowableInstance = brokenThrowable.state.player.inventoryInstances.find(
  (instance) => instance.id === durabilityProfile.id,
)!;
assert.deepEqual(
  {
    charges: throwableChargeCount(
      brokenThrowable.state.player,
      durabilityProfile.id,
    ),
    maxCharges: brokenThrowableInstance.maxCharges,
  },
  { charges: 2, maxCharges: 2 },
  "durability exhaustion must reduce the expedition's maximum charge by one",
);
assert.equal(
  brokenThrowableInstance.durability,
  10,
  "the reduced-capacity throwable profile must begin a fresh durability cycle",
);
assert.equal(
  brokenThrowable.state.groundItems.some(
    (item) => item.defId === missileId && item.recoversThrowableCharge,
  ),
  false,
  "a projectile destroyed by durability must not leave a recoverable charge",
);
const emptyRepairWarehouse = createInitialWarehouse();
emptyRepairWarehouse.stacks = {};
emptyRepairWarehouse.instances = [];
emptyRepairWarehouse.throwableProfiles = {};
emptyRepairWarehouse.slots = Array.from(
  { length: WAREHOUSE_SLOT_COUNT },
  () => null,
);
const repairedThrowable = depositPlayerInventory(
  emptyRepairWarehouse,
  brokenThrowable.state.player,
);
const repairedThrowableInstance = repairedThrowable.warehouse.instances.find(
  (instance) => instance.id === durabilityProfile.id,
)!;
assert.deepEqual(
  {
    stackQuantity: repairedThrowable.warehouse.stacks[missileId],
    charges: repairedThrowableInstance.charges,
    maxCharges: repairedThrowableInstance.maxCharges,
    durability: repairedThrowableInstance.durability,
  },
  { stackQuantity: undefined, charges: 3, maxCharges: 3, durability: 10 },
  "expedition settlement must repair durability-lost maximum charges",
);

const capGame = createNewGame(0x1e7e150);
capGame.companions = [];
const capStartMaxHp = capGame.player.maxHp;
const capStartBaseAttack = capGame.player.baseAttack;
const capStartBaseDefense = capGame.player.baseDefense;
let capExpectedMaxHp = capStartMaxHp;
let capExpectedBaseAttack = capStartBaseAttack;
for (let level = 1; level < MAX_PLAYER_LEVEL; level += 1) {
  capExpectedMaxHp = Math.max(
    capExpectedMaxHp + 1,
    Math.round(capExpectedMaxHp * LEVEL_STAT_GROWTH),
  );
  capExpectedBaseAttack =
    Math.round(capExpectedBaseAttack * LEVEL_STAT_GROWTH * 1_000_000) /
    1_000_000;
}
const capTarget = {
  x: capGame.player.x + 1,
  y: capGame.player.y,
};
capGame.tiles[capTarget.y][capTarget.x].terrain = "floor";
capGame.enemies = [{
  id: "level-cap-target",
  kind: "rat",
  ...capTarget,
  hp: 1,
  maxHp: 1,
  attack: 0,
  defense: 0,
  accuracy: 0,
  evasion: 0,
  xp: 1_000_000,
  alerted: true,
  sawPlayerLastTurn: false,
  sleeping: false,
  wakeCooldown: 0,
  lastSeenPlayer: null,
  searchTurns: 0,
  statuses: [],
}];
const capped = playerStep(capGame, 1, 0).state;
assert.equal(
  capped.player.level,
  MAX_PLAYER_LEVEL,
  "even an oversized XP reward must never raise the player above level 50",
);
assert.equal(
  capped.player.xp,
  0,
  "experience must stop accumulating at the level cap",
);
assert.equal(
  capped.player.maxHp,
  capExpectedMaxHp,
  "every level up to the cap must apply ten-percent maximum-health growth",
);
assert.equal(
  capped.player.baseAttack,
  capExpectedBaseAttack,
  "every level up to the cap must apply ten-percent base-attack growth",
);
assert.equal(
  capped.player.baseDefense,
  capStartBaseDefense,
  "ordinary level-ups must not raise base defense",
);

let hungerGame = createNewGame(0x48a93);
hungerGame.enemies = [];
hungerGame.player.hp = hungerGame.player.maxHp - 10;
hungerGame.companions.forEach((companion) => {
  companion.command = "hold";
  companion.hp = companion.maxHp - 10;
});
for (let turn = 0; turn < 10; turn += 1) {
  hungerGame = runEnemyTurn(hungerGame).state;
}
assert.equal(
  hungerGame.player.hunger,
  99,
  "the shared hunger gauge must lose one point every ten elapsed turns",
);
assert.equal(
  hungerGame.player.hp,
  hungerGame.player.maxHp - 8,
  "high hunger must accumulate 0.2 natural healing per turn",
);
assert.ok(
  hungerGame.companions.every(
    (companion) => companion.hp === companion.maxHp - 8,
  ),
  "companions must use the player's hunger tier for the same natural healing rate",
);
const starvingHp = hungerGame.player.hp;
hungerGame.player.hunger = 9;
hungerGame.player.recoveryProgress = -0.95;
advanceHungerAndRecovery(hungerGame);
assert.equal(
  hungerGame.player.hp,
  starvingHp - 1,
  "hunger below ten percent must accumulate 0.05 damage per turn",
);
const foodGame = createNewGame(0xf00d7);
foodGame.player.hunger = 50;
foodGame.player.hp = 7;
foodGame.player.inventory = { ration: 1 };
const ateRation = consumeItemAction(foodGame, "ration");
assert.equal(ateRation.state.player.hunger, 90, "food must restore hunger");
assert.equal(
  ateRation.state.player.hp,
  7,
  "food must no longer directly restore health",
);

const alchemyGame = createNewGame(0xa1c4e);
alchemyGame.enemies = [];
alchemyGame.player.inventory = { small_ration: 2 };
alchemyGame.player.inventoryInstances = [];
alchemyGame.objects = [{
  id: "test-alchemy",
  kind: "alchemy",
  looted: false,
  loot: [],
  x: alchemyGame.player.x + 1,
  y: alchemyGame.player.y,
}];
const openedAlchemy = playerStep(alchemyGame, 1, 0);
assert.equal(openedAlchemy.alchemyOpened, true);
assert.equal(
  openedAlchemy.consumedTurn,
  false,
  "opening the reusable alchemy interface must not consume or loot the workbench",
);
assert.equal(openedAlchemy.state.objects[0].looted, false);
assert.deepEqual(
  previewAlchemy(alchemyGame, ["small_ration", "small_ration"]),
  { kind: "item", outputDefId: "ration", quantity: 1 },
  "the alchemy preview must resolve a two-item higher-tier food recipe",
);
const cookedRation = performAlchemy(
  alchemyGame,
  ["small_ration", "small_ration"],
);
assert.equal(cookedRation.consumedTurn, true, "successful alchemy must cost one turn");
assert.equal(cookedRation.state.player.inventory.small_ration ?? 0, 0);
assert.equal(cookedRation.state.player.inventory.ration ?? 0, 1);

let enchantAlchemyGame = createNewGame(0xa1c4f);
enchantAlchemyGame.enemies = [];
enchantAlchemyGame.player.inventory = {};
enchantAlchemyGame.player.inventoryInstances = [];
enchantAlchemyGame = developerGrantItem(enchantAlchemyGame, "shortsword", 1);
enchantAlchemyGame = developerGrantItem(
  enchantAlchemyGame,
  "stone_enchantment",
  1,
);
enchantAlchemyGame.objects = [{
  id: "test-enchant-alchemy",
  kind: "alchemy",
  looted: false,
  loot: [],
  x: enchantAlchemyGame.player.x + 1,
  y: enchantAlchemyGame.player.y,
}];
const alchemyWeapon = enchantAlchemyGame.player.inventoryInstances.find(
  (instance) => instance.defId === "shortsword",
)!;
const enchantedByAlchemy = performAlchemy(enchantAlchemyGame, [
  alchemyWeapon.id,
  "stone_enchantment",
]);
assert.equal(enchantedByAlchemy.enchanted, true);
assert.ok(
  enchantedByAlchemy.state.player.inventoryInstances.find(
    (instance) => instance.id === alchemyWeapon.id,
  )?.traits?.length,
  "equipment plus a catalyst must produce an enchanted item without consuming the equipment",
);

for (const definition of Object.values(ITEM_DEFS).filter(
  (item) =>
    (item.category === "potion" || item.category === "scroll") &&
    item.id !== "scroll_upgrade",
)) {
  const itemGame = createNewGame(0x17e000 + definition.sprite);
  itemGame.enemies = [];
  itemGame.player.hp = 1;
  itemGame.player.inventory = { [definition.id]: 1 };
  itemGame.player.inventoryInstances = [];
  const used = consumeItemAction(itemGame, definition.id);
  assert.equal(
    used.consumedTurn,
    true,
    `${definition.id} must have a working use action`,
  );
  assert.equal(
    used.state.player.inventory[definition.id] ?? 0,
    0,
    `${definition.id} must be consumed after use`,
  );
  assert.ok(
    used.soundCues?.some(({ id }) =>
      definition.category === "potion" ? id === "drink" : id === "read",
    ),
    `${definition.id} must use its original item-category sound`,
  );
}

console.log("game smoke checks passed");
