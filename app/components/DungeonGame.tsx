"use client";

import {
  CSSProperties,
  DragEvent as ReactDragEvent,
  MutableRefObject,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  WheelEvent as ReactWheelEvent,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  CATEGORY_LABELS,
  ENEMY_DESCRIPTIONS,
  ENEMY_DROP_CHANCE,
  ENEMY_DROP_TABLE,
  ENEMY_SPRITES,
  ENEMY_STATS,
  ITEM_DEFS,
  OBJECT_SPRITES,
} from "../game/data";
import { enemyDefinition } from "../game/enemy-definitions";
import { bossDefinition } from "../game/boss-definitions";
import { enemySkill } from "../game/enemy-skills";
import {
  effectiveCombatStats,
  formatCombatPercent,
  remainingCooldownTurns,
} from "../game/combat-stats";
import {
  acceptQuest,
  acceptEquipmentOffer,
  applyEquipmentConsumable,
  activateCompanionSkill,
  advanceManualPartyRound,
  assignCompanionItem,
  assignPlayerItem,
  autoEquipBetterOffers,
  claimQuestReward,
  canAssignCompanionItem,
  canAssignPlayerItem,
  createExpeditionGame,
  developerGrantItem,
  developerRecruitCompanion,
  developerSpawnEnemy,
  declineEquipmentOffer,
  deferActionForManualRound,
  discardItem,
  enchantEquippedItem,
  enchantItem,
  equipmentScore,
  getPlayerAttackSpeed,
  getPlayerAttack,
  getPlayerAccuracy,
  getPlayerDefense,
  getPlayerEvasion,
  getPlayerMoveSpeed,
  getPlayerViewDistance,
  hasCompanionExplorationWork,
  hasEnchantingMaterial,
  inventoryItemProfile,
  inventorySlotCount,
  MAX_INVENTORY_SLOTS,
  MAX_PLAYER_LEVEL,
  manualCompanionPickup,
  manualCompanionStep,
  manualCompanionWait,
  pathTo,
  pathToPartyActor,
  performAlchemy,
  pickupGroundItems,
  playerStep,
  previewAlchemy,
  setCompanionCommand,
  setCompanionPriorityTarget,
  shouldAutoPickup,
  throwItem,
  unassignCompanionItem,
  unassignPlayerItem,
  useItem as consumeItemAction,
  activateCompanionQuickslot,
  waitTurn,
  zapWand,
} from "../game/engine";
import { questDefinition } from "../game/quests";
import { cloneGameWithoutTiles } from "../game/state";
import { P0_ROOM_PRESETS } from "../game/room-presets";
import { isSpecialRoomPreset } from "../game/special-rooms";
import {
  createDeveloperTestMap,
  DEVELOPER_TEST_MAP_ID,
  DEVELOPER_TEST_MAP_SEED,
} from "../game/developer-test-map";
import { completeFloorExit, resolveGameSession } from "../game/session";
import {
  COMPANION_PASSIVE_SLOT_INDEXES,
  COMPANION_QUICKSLOT_INDEXES,
  FLEX_EQUIPMENT_KEYS as FLEX_RING_KEYS,
  isPartyQuickslotTarget,
} from "../game/loadout";
import {
  placeReturnedItemInInventorySlot,
  reorderDungeonInventory,
  swapPartyLoadout,
} from "../game/loadout-transactions";
import {
  applyPreparationSlotTransfer,
  isPreparationSlotAddress,
} from "../game/preparation-transactions";
import type { ActiveSlotEntry } from "../game/active-slots";
import {
  canLearnCompanionSkill,
  canLevelCompanionSkill,
  equipCompanionSkill,
  learnCompanionSkill,
  levelCompanionSkill,
  skillLevelRequirements,
  swapCompanionSkills,
  unequipCompanionSkill,
} from "../game/skill-training";
import {
  PLAYER_ACTOR_ID as PLAYER_ID,
  livingPartyIds,
  nearestVisibleEnemy,
  partyActor,
  suggestedSkillTarget,
} from "../game/party";
import {
  isTileClickReachable,
  pointEquals,
  pointInBounds,
} from "../game/spatial";
import { skillTargetableTiles } from "../game/targeting";
import {
  CampaignSave,
  DungeonDefinition,
  ExpeditionLoadout,
  ExpeditionOutcome,
  ExpeditionStats,
  WarehouseState,
  applyLoadoutToPlayer,
  applyWarehouseEquipmentConsumable,
  bossDungeonClearsAfterOutcome,
  cloneWarehouse,
  companionToPlayer,
  createInitialWarehouse,
  createStarterCompanionRoster,
  depositPlayerInventory,
  formatElapsedTime,
  formatGold,
  generateDungeonOffers,
  INITIAL_DUNGEON_OFFER_SEED,
  mergeReturningCompanions,
  normalizeBossDungeonClears,
  normalizeCompanionForHub,
  normalizeCompanionForHubWithReleasedItems,
  normalizeHeroForHub,
  newExpeditionPickups,
  playerToCompanion,
  selectMainLootEntries,
  selectedLoadoutSlotCount,
  takeLoadoutFromWarehouse,
  warehouseItemCount,
} from "../game/campaign";
import {
  CAMPAIGN_MATERIAL_KINDS,
  CAMPAIGN_MATERIAL_NAMES,
  addMaterials,
  createCampaignMaterials,
  extractWarehouseMaterials,
  normalizeCampaignMaterials,
  type CampaignMaterials,
} from "../game/campaign-materials";
import {
  buyShopListing,
  createShopState,
  listSmithyCandidates,
  normalizeShopState,
  rerollCampaignEquipmentEnchantments,
  sellWarehouseItem,
  smithyEnchantRerollRunestoneCost,
  smithyNextGrade,
  smithyUpgradeRequirements,
  upgradeCampaignEquipmentGrade,
  type ShopListingSource,
  type SmithyCandidate,
  type SmithyTarget,
} from "../game/commerce";
import {
  WAREHOUSE_SLOT_COUNT,
  normalizeFixedSlots,
  normalizePlayerInventorySlots,
  normalizeStorageSlots,
} from "../game/inventory-slots";
import {
  COMPANION_CLASS_IDS,
  COMPANION_TRAITS,
  COMPANION_TRAIT_IDS,
  getCompanionAttack,
  getCompanionAccuracy,
  getCompanionDefense,
  getCompanionEvasion,
  getCompanionAttackSpeed,
  getCompanionMoveSpeed,
  getCompanionViewDistance,
} from "../game/companions";
import {
  COMPANION_IDLE_FRAMES,
  COMPANION_PRESENTATIONS,
  characterPresentation,
  companionArmorTier,
  companionFrameIndex,
} from "../presentation/companion-visuals";
import {
  COMPANION_PROFESSIONS,
  COMPANION_SKILLS,
  MAX_COMPANION_SKILL_LEVEL,
  normalizeCompanionSkillLevel,
} from "../game/companion-skills";
import {
  companionSkillLevelModifier,
  deriveCompanionSkill,
} from "../game/companion-skill-blueprints";
import {
  canPaySkillResource,
  currentSkillResource,
  formatSkillResourceAmount,
  maxSkillResource,
  normalizeSkillResources,
  primarySkillResource,
} from "../game/skill-resources";
import {
  ALCHEMY_ENCHANT_CATALYST_IDS,
  ALCHEMY_ENCHANT_RECIPES,
  SIMPLE_ALCHEMY_RECIPES,
} from "../game/alchemy";
import {
  EQUIPMENT_TRAITS,
  canApplyEquipmentConsumable,
  equipmentStatProfile,
  equipmentTraitSummary,
  isEquipmentConsumableId,
  isUpgradeableEquipment,
  type EquipmentConsumableId,
} from "../game/equipment";
import {
  STATUS_DESCRIPTIONS,
  STATUS_LABELS,
  WAND_CODEX,
  isWand,
} from "../game/magic";
import {
  createEffectTrajectories,
  releaseHeldSignalsAtTurnStart,
} from "../presentation/effects";
import {
  connectedWaterTiles,
  createCompanionSkillEffects,
  createDustEffects,
  createEnchantEffects,
  createHitEffects,
  createLevelUpEffects,
  createWaterRippleEffects,
  PixelCameraShake,
  PixelEffect,
} from "../presentation/pixel-effects";
import {
  createPixelFogRuntime,
  resetPixelFogRuntime,
} from "../presentation/fog-frontier";
import {
  captureVisibleMasks,
  createDungeonRenderCache,
} from "../presentation/render-cache";
import type { TargetingOverlay } from "../presentation/targeting-overlay";
import { resolveItemGrade } from "../game/item-grade";
import { itemSpriteOffset } from "../presentation/item-visuals";
import { runtimeImageSource } from "../presentation/runtime-assets";
import {
  dungeonMusicPath,
  GameAudioRuntime,
} from "../presentation/audio-runtime";
import {
  TILE_SIZE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  waterSurfaceMaskRows,
} from "../presentation/render";
import {
  type CharacterMoveCycleRuntime,
  PLAYER_IDLE_FRAMES,
  registerCharacterMotionCycle,
} from "../presentation/player-animation";
import {
  createTurnMotionTimeline,
  DEATH_EVENT_DELAY,
  durationForInteraction,
  durationForMotion,
  impactDelayForMotion,
  impactTimeForSource,
  MIN_ACTION_DURATION,
  PLAYER_INTERACTION_DURATION,
  presentationOffsetForCombatEffect,
  worldRevealOffsetForDefeat,
} from "../presentation/timing";
import {
  canvasPointFromClient,
  clampCamera,
  companionScreenBounds,
  tileAtCanvasPoint,
} from "../presentation/viewport";
import {
  startDungeonRenderer,
  type CameraDrag,
  type CompanionMapDrag,
  type DefeatedCompanionVisual,
  type DefeatedEnemyVisual,
  type EntityFlashVisual,
  type FloatingEffect,
  type GameAssets,
  type MagicVisualRuntime,
  type PickupVisual,
  type PlayerActionAnimation,
  type StatusSignalVisual,
  type ThrowVisual,
  type VisualMotion,
} from "../presentation/dungeon-renderer";
import {
  DescriptionWindow,
  descriptionAnchorFromElement,
  descriptionAnchorFromPoint,
  type DescriptionAnchor,
} from "../presentation/description-window";
import {
  CLOUD_DETAILS,
  OBJECT_DETAILS,
  TERRAIN_DETAILS,
} from "../presentation/inspection-catalog";
import {
  groundItemComesFromDefeatedEnemy,
  isDamageEffect,
  isDefeatEffect,
  isImpactEffect,
  timingSourceIdForEffect,
} from "../presentation/combat-feedback";
import {
  ActionResult,
  CombatEffect,
  Companion,
  CompanionClassId,
  CompanionSkillId,
  CompanionSkillVisual,
  Enemy,
  EnemyKind,
  GameState,
  GameSoundId,
  ItemCategory,
  ItemDefinition,
  ItemGrade,
  InventoryInstance,
  ItemPickup,
  ItemThrow,
  LoadoutTarget,
  MagicVisual,
  Motion,
  Player,
  Point,
  StatusEffectId,
  StatusSignal,
  UpgradeTarget,
} from "../game/types";

type InspectedEffect =
  | { kind: "invisible"; anchor: DescriptionAnchor }
  | { kind: "shield"; anchor: DescriptionAnchor }
  | { kind: "status"; id: StatusEffectId; anchor: DescriptionAnchor };

type InspectedEntity =
  | { kind: "player"; anchor: DescriptionAnchor }
  | { kind: "companion"; id: string; anchor: DescriptionAnchor }
  | { kind: "enemy"; id: string; anchor: DescriptionAnchor }
  | { kind: "groundItem"; id: string; anchor: DescriptionAnchor }
  | { kind: "object"; id: string; anchor: DescriptionAnchor }
  | {
      kind: "cloud";
      id: string;
      x: number;
      y: number;
      anchor: DescriptionAnchor;
    }
  | { kind: "ward"; id: string; anchor: DescriptionAnchor }
  | { kind: "terrain"; x: number; y: number; anchor: DescriptionAnchor }
  | { kind: "unknown"; x: number; y: number; anchor: DescriptionAnchor };

type CanvasPointer = {
  clientX: number;
  clientY: number;
};

type PinchGesture = {
  pointerIds: [number, number];
  startDistance: number;
  startZoom: number;
  worldAnchor: Point;
  moved: boolean;
};

type InventoryFilter = keyof typeof CATEGORY_LABELS;
type CompendiumTab = "items" | "enemies" | "traits" | "alchemy";
type UiLanguage = "ko" | "en";
type CampaignScreen = "hub" | "preparation" | "dungeon" | "results";
type ExpeditionResultView = {
  dungeon: DungeonDefinition;
  outcome: ExpeditionOutcome;
  stats: ExpeditionStats;
  materialsGained: CampaignMaterials;
};
type ActiveExpedition = {
  dungeon: DungeonDefinition;
  initialGame: GameState;
};
type CompanionLoadoutSelection = {
  companionId: string;
  target: LoadoutTarget;
};

type PlayerLoadoutSelection = LoadoutTarget;

type PendingCompanionSkill = {
  casterId: string;
  skillId: CompanionSkillId;
  suggestedTarget: Point | null;
};

type PendingQuickslotAim = {
  ownerId: string;
  slotIndex: number;
  itemRef: string;
  itemId: string;
  action: "use" | "throw" | "wand";
  suggestedTarget: Point | null;
};

type InventorySelection = {
  itemId: string;
  itemRef: string;
  charges?: number;
  maxCharges?: number;
  playerLoadout?: PlayerLoadoutSelection;
  companionLoadout?: CompanionLoadoutSelection;
  anchor?: DescriptionAnchor;
};

type ItemDetailPreview = {
  itemId: string;
  itemRef: string;
  instance: InventoryInstance | null;
  quantity: number;
  contextLabel?: string;
  anchor?: DescriptionAnchor;
};

type ItemSlotAddress =
  | { zone: "dungeonInventory"; index: number }
  | { zone: "playerEquipment"; target: LoadoutTarget }
  | {
      zone: "companionEquipment";
      companionId: string;
      target: LoadoutTarget;
    }
  | { zone: "warehouse"; index: number }
  | { zone: "shopSellTarget" }
  | { zone: "shopWarehouseTarget" }
  | { zone: "shopStock"; listingId: string }
  | { zone: "shopBuyback"; listingId: string }
  | { zone: "smithyTarget" }
  | { zone: "preparationInventory"; index: number }
  | {
      zone: "preparationCompanionEquipment";
      companionId: string;
      target: LoadoutTarget;
    };

type DragSlotItem = {
  itemRef: string;
  itemId: string;
  quantity: number;
  grade?: ItemGrade;
  upgradeLevel?: number;
  charges?: number;
  maxCharges?: number;
};

type HeldSlotItem = {
  pointerId: number;
  source: ItemSlotAddress;
  item: DragSlotItem;
  clientX: number;
  clientY: number;
};

type PendingItemSlotDrag = {
  pointerId: number;
  pointerType: string;
  source: ItemSlotAddress;
  item: DragSlotItem;
  startClientX: number;
  startClientY: number;
  clientX: number;
  clientY: number;
  timer: number;
  container: HTMLElement;
};

const ITEM_DRAG_MOVE_THRESHOLD = 5;
const TOUCH_ITEM_DRAG_LONG_PRESS_MS = 200;

type UpgradeVisualTarget =
  | UpgradeTarget
  | { kind: "warehouse"; instanceId: string };

const upgradeTargetVisualKey = (target: UpgradeVisualTarget) => {
  if (target.kind === "warehouse") return `warehouse:${target.instanceId}`;
  if (target.kind === "inventory") return `inventory:${target.itemRef}`;
  if (target.kind === "equipment") {
    return target.slot === "ring"
      ? `player:flex:${target.ringIndex ?? 0}`
      : `player:${target.slot}`;
  }
  if (target.kind === "playerAuto") return `player:flex:${target.index}`;
  if (target.kind === "companionEquipment") {
    return `${target.companionId}:${target.slot}`;
  }
  return `${target.companionId}:flex:${target.index}`;
};

type PendingEquipmentConsumable = {
  itemRef: string;
  itemId: EquipmentConsumableId;
};

const UPGRADE_FLASH_DURATION_MS = 920;

function useUpgradeFlashFeedback() {
  const [upgradeFlashKey, setUpgradeFlashKey] = useState<string | null>(null);
  const upgradeFlashTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (upgradeFlashTimerRef.current !== null) {
        window.clearTimeout(upgradeFlashTimerRef.current);
      }
    },
    [],
  );

  const flashUpgradeKey = useCallback((key: string) => {
    if (upgradeFlashTimerRef.current !== null) {
      window.clearTimeout(upgradeFlashTimerRef.current);
    }
    setUpgradeFlashKey(key);
    upgradeFlashTimerRef.current = window.setTimeout(() => {
      setUpgradeFlashKey(null);
      upgradeFlashTimerRef.current = null;
    }, UPGRADE_FLASH_DURATION_MS);
  }, []);

  const clearUpgradeFlash = useCallback(() => {
    if (upgradeFlashTimerRef.current !== null) {
      window.clearTimeout(upgradeFlashTimerRef.current);
      upgradeFlashTimerRef.current = null;
    }
    setUpgradeFlashKey(null);
  }, []);

  return { upgradeFlashKey, flashUpgradeKey, clearUpgradeFlash };
}

const randomDungeonSeed = () => {
  const seed =
    (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  return seed || INITIAL_DUNGEON_OFFER_SEED;
};
const THROW_DURATION = 300;
const throwVisualDuration = (itemThrow: ItemThrow) => {
  void itemThrow;
  return THROW_DURATION;
};
const throwImpactDelay = (itemThrow: ItemThrow) =>
  throwVisualDuration(itemThrow) * 0.9;
const magicVisualDuration = (visual: MagicVisual) =>
  visual.durationMs ??
  (visual.kind === "cloud"
    ? 720
    : visual.kind === "beam"
      ? 560
      : visual.kind === "summon" || visual.kind === "burst"
        ? 520
        : 430);

const LEVEL_UP_EFFECT_HOLD = 420;
const UI_SCALE_STORAGE_KEY = "shattered-web-ui-scale";
const UI_SCALE_OPTIONS = [0.8, 0.9, 1, 1.1, 1.2] as const;
const FONT_SCALE_STORAGE_KEY = "shattered-web-font-scale";
const LANGUAGE_STORAGE_KEY = "shattered-web-language";
const CAMPAIGN_STORAGE_KEY = "shattered-web-campaign-v1";
const ACTIVE_EXPEDITION_STORAGE_KEY = "shattered-web-active-expedition-v1";
const AUTO_EXPLORATION_ENABLED = false;
const DEVELOPER_TEST_DUNGEON: DungeonDefinition = {
  id: DEVELOPER_TEST_MAP_ID,
  themeId: "developer-showcase",
  nameKo: "전체 맵 요소 테스트",
  nameEn: "Dungeon Showcase Map",
  subtitleKo: "개발자 전용 고정 맵",
  subtitleEn: "Developer-only fixed map",
  descriptionKo: "지형, 문, 위험 요소, 특수방과 오브젝트를 한 번에 검증합니다.",
  descriptionEn: "Validates terrain, doors, hazards, special rooms, and objects in one fixed map.",
  difficulty: 1,
  difficultyGrade: "F",
  difficultyLabelKo: "개발자",
  difficultyLabelEn: "Developer",
  floorCount: 1,
  difficultyScale: 1,
  mainDropIds: [],
  specialRoomPlan: [],
  lootPlan: [],
  goldPlan: [],
  completionGold: 0,
  goldTarget: 0,
  accent: "#78d7ec",
};
const DEVELOPER_BOSS_DUNGEON: DungeonDefinition = {
  id: "developer-boss-floor",
  themeId: "developer-showcase",
  nameKo: "개발자 보스 플로어",
  nameEn: "Developer Boss Floor",
  subtitleKo: "Boss Encounter Framework",
  subtitleEn: "Boss Encounter Framework",
  descriptionKo: "실제 던전 생성 흐름으로 최종층 Boss Room과 encounter를 검증합니다.",
  descriptionEn: "Validates the final-floor Boss Room and encounter through the production generator.",
  difficulty: 1,
  difficultyGrade: "F",
  difficultyLabelKo: "개발자",
  difficultyLabelEn: "Developer",
  floorCount: 1,
  difficultyScale: 1,
  bossId: "goo",
  mainDropIds: [],
  specialRoomPlan: [],
  lootPlan: [],
  goldPlan: [],
  completionGold: 0,
  goldTarget: 0,
  accent: "#c97863",
};
const FONT_SCALE_OPTIONS = [0.85, 1, 1.15, 1.3] as const;
const UiLanguageContext = createContext<UiLanguage>("ko");
const useUiLanguage = () => useContext(UiLanguageContext);
const uiText = (
  language: UiLanguage,
  korean: string,
  english: string,
) => (language === "ko" ? korean : english);

const ZOOM_LEVELS = [
  0.09,
  0.125,
  0.18,
  0.25,
  0.36,
  0.5,
  2 / 3,
  1,
  4 / 3,
  5 / 3,
  2,
  2.5,
  3,
] as const;
const DEFAULT_ZOOM = 1;
const USABLE_ITEM_CATEGORIES = new Set<ItemCategory>([
  "potion",
  "scroll",
  "food",
  "brew",
  "elixir",
  "bomb",
  "seed",
  "stone",
  "wand",
]);
const isDirectlyUsableItem = (definition: ItemDefinition) =>
  USABLE_ITEM_CATEGORIES.has(definition.category) &&
  definition.effect !== "enchantLock";
const BENEFICIAL_STATUS_IDS = new Set<StatusEffectId>([
  "haste",
  "levitating",
  "mindVision",
  "magicSight",
  "shielded",
  "earthenArmor",
  "recharging",
  "antimagic",
  "foresight",
  "challenge",
  "stamina",
]);
const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const loadImage = (src: string, retryKey = 0) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const embeddedSource = runtimeImageSource(src);
    const timeout = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error(`Timed out while loading ${src}`));
    }, 12_000);
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error(`Failed to load ${src}`));
    };
    image.src = retryKey > 0 && !embeddedSource.startsWith("data:")
      ? `${embeddedSource}${embeddedSource.includes("?") ? "&" : "?"}retry=${retryKey}`
      : embeddedSource;
  });

const chanceLabel = (chance: number) =>
  `${Math.round(chance * 1000) / 10}%`;

const ITEM_CATEGORY_NAMES: Record<ItemCategory, string> = {
  weapon: "무기",
  armor: "방어구",
  ring: "반지",
  wand: "완드",
  artifact: "유물",
  missile: "투척 무기",
  potion: "물약",
  scroll: "주문서",
  brew: "혼합물",
  elixir: "영약",
  bomb: "폭탄",
  seed: "씨앗",
  stone: "룬석",
  food: "식량",
  misc: "특수 물품",
  key: "열쇠",
};

const ITEM_CATEGORY_NAMES_EN: Record<ItemCategory, string> = {
  weapon: "Weapon",
  armor: "Armor",
  ring: "Ring",
  wand: "Wand",
  artifact: "Artifact",
  missile: "Thrown weapon",
  potion: "Potion",
  scroll: "Scroll",
  brew: "Brew",
  elixir: "Elixir",
  bomb: "Bomb",
  seed: "Seed",
  stone: "Runestone",
  food: "Food",
  misc: "Special item",
  key: "Key",
};

const INVENTORY_FILTER_LABELS_EN: Record<InventoryFilter, string> = {
  all: "All",
  equipment: "Equipment",
  magic: "Magic",
  potion: "Potions",
  scroll: "Scrolls",
  throwable: "Throwables",
  alchemy: "Alchemy",
  nature: "Nature",
  other: "Other",
};

const humanizeId = (id: string) =>
  id
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const localizedItemName = (
  itemId: string,
  language: UiLanguage,
) =>
  language === "ko"
    ? ITEM_DEFS[itemId]?.name ?? itemId
    : itemId === "scroll_identify"
      ? "Scroll of Enchantment"
      : itemId === "scroll_mirror_image"
        ? "Enchantment Lock Scroll"
      : humanizeId(itemId);

const localizedItemDescription = (
  itemId: string,
  language: UiLanguage,
) => {
  const definition = ITEM_DEFS[itemId];
  if (language === "ko") {
    return WAND_CODEX[itemId] ?? definition?.description ?? itemId;
  }
  if (!definition) return humanizeId(itemId);
  if (itemId === "scroll_identify") {
    return "Adds one new enchantment to equipment with no more than two enchantments.";
  }
  if (itemId === "scroll_mirror_image") {
    return "Locks one chosen enchantment per scroll when rerolling equipment at the Blacksmith.";
  }
  const category = ITEM_CATEGORY_NAMES_EN[definition.category].toLowerCase();
  return `A ${category} from the dungeon. Its exact effects and equipment statistics are shown in this detail panel.`;
};

const localizedEnemyName = (
  kind: EnemyKind,
  language: UiLanguage,
) =>
  language === "ko" ? ENEMY_SPRITES[kind].label : humanizeId(kind);

const localizedEnemyDescription = (
  kind: EnemyKind,
  language: UiLanguage,
) =>
  language === "ko"
    ? ENEMY_DESCRIPTIONS[kind]
    : `${humanizeId(kind)} is a dungeon enemy with its own health, attack, defense, accuracy, and evasion values.`;

const localizedStatusLabel = (
  id: StatusEffectId,
  language: UiLanguage,
) => (language === "ko" ? STATUS_LABELS[id] : humanizeId(id));

const localizedStatusDescription = (
  id: StatusEffectId,
  language: UiLanguage,
) =>
  language === "ko"
    ? STATUS_DESCRIPTIONS[id]
    : `${humanizeId(id)} is currently affecting the player. The number beside it shows the remaining turns.`;

const itemStatSummary = (
  itemId: string,
  language: UiLanguage = "ko",
  instance?: InventoryInstance | null,
) => {
  const item = ITEM_DEFS[itemId];
  const equipmentStats = isUpgradeableEquipment(item)
    ? equipmentStatProfile(item, instance)
    : null;
  return [
    equipmentStats?.attack
      ? uiText(language, `공격 ${equipmentStats.attack}`, `Attack ${equipmentStats.attack}`)
      : null,
    equipmentStats?.defense
      ? uiText(language, `방어 ${equipmentStats.defense}`, `Defense ${equipmentStats.defense}`)
      : null,
    equipmentStats?.magic
      ? uiText(language, `마력 ${equipmentStats.magic}`, `Magic ${equipmentStats.magic}`)
      : null,
    equipmentStats?.upgradeLevel
      ? uiText(
          language,
          `강화 +${equipmentStats.upgradeLevel}`,
          `Upgrade +${equipmentStats.upgradeLevel}`,
        )
      : null,
    item.heal
      ? uiText(language, `회복 ${item.heal}`, `Healing ${item.heal}`)
      : null,
    item.satiation
      ? uiText(
          language,
          `허기 +${item.satiation}`,
          `Hunger +${item.satiation}`,
        )
      : null,
  ].filter(Boolean) as string[];
};

const FLEX_SLOT_INDEXES = [0, 1, 2, 3] as const;
const PARTY_GEAR_TARGETS: LoadoutTarget[] = [
  { kind: "equipment", slot: "weapon" },
  { kind: "equipment", slot: "armor" },
  ...COMPANION_PASSIVE_SLOT_INDEXES.map((index) => ({
    kind: "flex" as const,
    index,
  })),
];
const PARTY_QUICKSLOT_TARGETS: LoadoutTarget[] =
  COMPANION_QUICKSLOT_INDEXES.map((index) => ({
    kind: "flex" as const,
    index,
  }));
const PARTY_LOADOUT_TARGETS: LoadoutTarget[] = [
  ...PARTY_GEAR_TARGETS,
  ...PARTY_QUICKSLOT_TARGETS,
];
const equipmentKeyForSelection = (target: PlayerLoadoutSelection) =>
  target.kind === "equipment"
    ? target.slot
    : FLEX_RING_KEYS[target.index];

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

function ItemIcon({
  itemId,
  size = 32,
  className = "",
}: {
  itemId: string;
  size?: number;
  className?: string;
}) {
  const definition = ITEM_DEFS[itemId];
  if (!definition) return <span className={`item-icon ${className}`} />;
  const scale = size / 16;
  const x = definition.sprite % 16;
  const y = Math.floor(definition.sprite / 16);
  const offset = itemSpriteOffset(itemId);
  const style: CSSProperties = {
    width: size,
    height: size,
    overflow: "hidden",
  };
  const spriteStyle: CSSProperties = {
    display: "block",
    width: size,
    height: size,
    backgroundImage: "url('/assets/sprites/items.png')",
    backgroundSize: `${256 * scale}px ${512 * scale}px`,
    backgroundPosition: `${-x * size}px ${-y * size}px`,
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated",
    transform: `translate(${offset.x * scale}px, ${offset.y * scale}px)`,
  };
  return (
    <span
      aria-hidden="true"
      className={`item-icon ${className}`}
      style={style}
    >
      <span className="item-icon__sprite" style={spriteStyle} />
    </span>
  );
}

function ItemGradeMarker({
  itemId,
  instance,
}: {
  itemId: string;
  instance?: InventoryInstance | null;
}) {
  const grade = resolveItemGrade(ITEM_DEFS[itemId], instance);
  return (
    <span
      aria-hidden="true"
      className="item-grade-marker"
      data-item-grade={grade}
    />
  );
}

function ItemSlotContents({
  itemId,
  size,
  instance,
  quantity,
  showQuantity = false,
}: {
  itemId: string;
  size: number;
  instance?: InventoryInstance | null;
  quantity?: number;
  showQuantity?: boolean;
}) {
  const upgradeLevel = instance?.upgradeLevel ?? 0;
  const wand = isWand(itemId);
  const throwable = ITEM_DEFS[itemId]?.category === "missile";
  const chargeBased = wand || throwable;
  const fallbackCharges = wand ? 3 : Math.max(0, quantity ?? 0);
  const charges =
    instance?.charges ?? instance?.maxCharges ?? fallbackCharges;
  const maxCharges = instance?.maxCharges ?? fallbackCharges;
  return (
    <>
      <ItemGradeMarker itemId={itemId} instance={instance} />
      <ItemIcon itemId={itemId} size={size} />
      {upgradeLevel > 0 && (
        <span className="item-upgrade-badge">+{upgradeLevel}</span>
      )}
      {instance?.cursed && (
        <span className="item-curse-marker" aria-hidden="true" />
      )}
      {chargeBased ? (
        <b className="wand-charge-badge slot-value-badge">
          {charges}/{maxCharges}
        </b>
      ) : showQuantity && quantity !== undefined ? (
        <b className="item-quantity-badge slot-value-badge">{quantity}</b>
      ) : null}
    </>
  );
}

function ActiveSlotContents({
  entry,
  size,
  instance,
  quantity = 1,
}: {
  entry: ActiveSlotEntry;
  size: number;
  instance?: InventoryInstance | null;
  quantity?: number;
}) {
  if (entry.kind === "item") {
    return (
      <ItemSlotContents
        itemId={entry.itemId}
        size={size}
        instance={instance}
        quantity={quantity}
        showQuantity={quantity > 1}
      />
    );
  }
  const skill = COMPANION_SKILLS[entry.skillId];
  return (
    <span
      className="active-skill-entry"
      style={{ "--skill-accent": skill.accent } as CSSProperties}
      aria-hidden="true"
    >
      <i>{skill.shortKo}</i>
    </span>
  );
}

const itemSlotAddressKey = (address: ItemSlotAddress) =>
  JSON.stringify(address);

const parseItemSlotAddress = (raw: string | undefined) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ItemSlotAddress;
  } catch {
    return null;
  }
};

const parseDragSlotItem = (raw: string | undefined) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragSlotItem;
  } catch {
    return null;
  }
};

function HeldItemCursor({ held }: { held: HeldSlotItem | null }) {
  if (!held || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="held-item-cursor"
      style={{ left: held.clientX, top: held.clientY }}
      aria-hidden="true"
    >
      <ItemIcon itemId={held.item.itemId} size={40} />
    </div>,
    document.body,
  );
}

function useItemSlotDrag(
  onDrop: (source: HeldSlotItem, target: ItemSlotAddress) => void | Promise<void>,
) {
  const [held, setHeld] = useState<HeldSlotItem | null>(null);
  const heldRef = useRef<HeldSlotItem | null>(null);
  const pendingRef = useRef<PendingItemSlotDrag | null>(null);
  const suppressClickRef = useRef(false);

  const clearDrag = useCallback(() => {
    if (pendingRef.current) {
      window.clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
    }
    heldRef.current = null;
    setHeld(null);
  }, []);

  useEffect(() => {
    const cancel = () => clearDrag();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", onKeyDown);
      clearDrag();
    };
  }, [clearDrag]);

  const addressAttributes = useCallback(
    (address: ItemSlotAddress, item: DragSlotItem | null) => ({
      "data-item-slot-address": itemSlotAddressKey(address),
      "data-item-slot-item": item ? JSON.stringify(item) : undefined,
    }),
    [],
  );

  const activatePendingDrag = useCallback((pending: PendingItemSlotDrag) => {
    if (pendingRef.current !== pending) return;
    window.clearTimeout(pending.timer);
    pendingRef.current = null;
    const active: HeldSlotItem = {
      pointerId: pending.pointerId,
      source: pending.source,
      item: pending.item,
      clientX: pending.clientX,
      clientY: pending.clientY,
    };
    heldRef.current = active;
    setHeld(active);
    try {
      pending.container.setPointerCapture(pending.pointerId);
    } catch {
      // Pointer capture is best-effort; document.elementFromPoint still
      // resolves the eventual drop target when capture is unavailable.
    }
  }, []);

  const trackPointer = useCallback((
    pointerId: number,
    clientX: number,
    clientY: number,
    preventDefault: () => void,
  ) => {
    const pending = pendingRef.current;
    if (pending?.pointerId === pointerId) {
      pending.clientX = clientX;
      pending.clientY = clientY;
      if (
        pending.pointerType !== "touch" &&
        Math.hypot(
          clientX - pending.startClientX,
          clientY - pending.startClientY,
        ) >= ITEM_DRAG_MOVE_THRESHOLD
      ) {
        activatePendingDrag(pending);
      }
    }
    if (heldRef.current?.pointerId !== pointerId) return;
    const next = {
      ...heldRef.current,
      clientX,
      clientY,
    };
    heldRef.current = next;
    setHeld(next);
    preventDefault();
  }, [activatePendingDrag]);

  const finishPointer = useCallback((
    pointerId: number,
    clientX: number,
    clientY: number,
    preventDefault: () => void,
  ) => {
    const pending = pendingRef.current;
    if (pending?.pointerId === pointerId) {
      window.clearTimeout(pending.timer);
      pendingRef.current = null;
    }
    const active = heldRef.current;
    if (!active || active.pointerId !== pointerId) return;
    const targetElement = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-item-slot-address]");
    const target = parseItemSlotAddress(
      targetElement?.dataset.itemSlotAddress,
    );
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    clearDrag();
    if (
      target &&
      itemSlotAddressKey(target) !== itemSlotAddressKey(active.source)
    ) {
      void onDrop(active, target);
    }
    preventDefault();
  }, [clearDrag, onDrop]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      trackPointer(
        event.pointerId,
        event.clientX,
        event.clientY,
        () => event.preventDefault(),
      );
    };
    const onPointerUp = (event: PointerEvent) => {
      finishPointer(
        event.pointerId,
        event.clientX,
        event.clientY,
        () => event.preventDefault(),
      );
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (
        pendingRef.current?.pointerId === event.pointerId ||
        heldRef.current?.pointerId === event.pointerId
      ) {
        clearDrag();
      }
    };
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerCancel, true);
    return () => {
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
    };
  }, [clearDrag, finishPointer, trackPointer]);

  const containerProps = {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || pendingRef.current || heldRef.current) return;
      const slot = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-item-slot-address]",
      );
      if (!slot) return;
      const source = parseItemSlotAddress(slot.dataset.itemSlotAddress);
      const item = parseDragSlotItem(slot.dataset.itemSlotItem);
      if (!source || !item) return;
      const container = event.currentTarget;
      const pending = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        source,
        item,
        startClientX: event.clientX,
        startClientY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        timer: 0,
        container,
      };
      if (event.pointerType === "touch") {
        pending.timer = window.setTimeout(() => {
          activatePendingDrag(pending);
        }, TOUCH_ITEM_DRAG_LONG_PRESS_MS);
      }
      pendingRef.current = pending;
    },
    onLostPointerCapture: () => {
      if (heldRef.current) clearDrag();
    },
    onClickCapture: (event: ReactMouseEvent<HTMLElement>) => {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };

  return {
    held,
    heldAddressKey: held ? itemSlotAddressKey(held.source) : null,
    addressAttributes,
    containerProps,
  };
}

type ItemSlotDragApi = ReturnType<typeof useItemSlotDrag>;
const ItemSlotDragContext = createContext<ItemSlotDragApi | null>(null);
const useActiveItemSlotDrag = () => useContext(ItemSlotDragContext);

const resolvePlayerSlotItem = (
  player: GameState["player"],
  itemRef: string | null,
) => {
  const inventoryInstance = itemRef
    ? player.inventoryInstances.find((candidate) => candidate.id === itemRef) ??
      null
    : null;
  const itemId = inventoryInstance?.defId ?? itemRef;
  const instance =
    inventoryInstance ??
    (itemId ? player.throwableProfiles?.[itemId] ?? null : null);
  return {
    itemRef,
    itemId,
    instance,
    definition: itemId ? ITEM_DEFS[itemId] ?? null : null,
    quantity: itemId
      ? inventoryInstance
        ? 1
        : player.inventory[itemId] ?? 0
      : 0,
  };
};

const resolvePlayerLoadoutItem = (
  player: GameState["player"],
  target: PlayerLoadoutSelection,
) => {
  const equipmentKey = equipmentKeyForSelection(target);
  const equippedId = player.equipment[equipmentKey];
  if (equippedId) {
    return {
      itemRef: equippedId,
      itemId: equippedId,
      instance: player.equipmentInstances[equipmentKey] ?? null,
      definition: ITEM_DEFS[equippedId] ?? null,
      quantity: 1,
      isAuto: false,
    };
  }
  if (target.kind === "flex") {
    return {
      ...resolvePlayerSlotItem(player, player.autoSlots[target.index]),
      isAuto: true,
    };
  }
  return {
    itemRef: null,
    itemId: null,
    instance: null,
    definition: null,
    quantity: 0,
    isAuto: false,
  };
};

const resolveCompanionLoadoutItem = (
  companion: Companion,
  target: LoadoutTarget,
  sharedInventory?: Pick<Player, "inventory" | "throwableProfiles">,
) => {
  if (target.kind === "equipment") {
    const itemId = companion.equipment[target.slot];
    return {
      itemId,
      instance: companion.equipmentInstances[target.slot] ?? null,
      quantity: itemId ? 1 : 0,
      isAuto: false,
    };
  }
  const ringKey = FLEX_RING_KEYS[target.index];
  const ringId = companion.equipment[ringKey];
  if (ringId) {
    return {
      itemId: ringId,
      instance: companion.equipmentInstances[ringKey] ?? null,
      quantity: 1,
      isAuto: false,
    };
  }
  const autoItem = companion.autoSlots[target.index];
  const sharedQuantity = autoItem && !autoItem.instance
    ? sharedInventory?.inventory[autoItem.defId] ?? autoItem.quantity
    : autoItem?.quantity ?? 0;
  const sharedInstance = autoItem &&
      ITEM_DEFS[autoItem.defId]?.category === "missile"
    ? sharedInventory?.throwableProfiles?.[autoItem.defId] ?? autoItem.instance
    : autoItem?.instance ?? null;
  return {
    itemId: autoItem?.defId ?? null,
    instance: sharedInstance,
    quantity: sharedQuantity,
    isAuto: true,
  };
};

type ResolvedWarehouseItem = {
  itemRef: string;
  itemId: string;
  instance: InventoryInstance | null;
  quantity: number;
};

const resolveWarehouseItemRef = (
  warehouse: WarehouseState,
  itemRef: string,
  instancesById = new Map(
    warehouse.instances.map((instance) => [instance.id, instance]),
  ),
): ResolvedWarehouseItem | null => {
  const inventoryInstance = instancesById.get(itemRef) ?? null;
  const storedInstance =
    inventoryInstance ?? warehouse.throwableProfiles[itemRef] ?? null;
  const itemId =
    storedInstance?.defId ??
    ((warehouse.stacks[itemRef] ?? 0) > 0 ? itemRef : null);
  if (!itemId) return null;
  const quantity = inventoryInstance
    ? 1
    : warehouse.stacks[itemId] ?? 0;
  const instance =
    !inventoryInstance && ITEM_DEFS[itemId]?.category === "missile"
      ? {
          ...(storedInstance ?? {
            id: `throwable-${itemId}`,
            defId: itemId,
          }),
          charges: quantity,
          maxCharges: quantity,
          baseMaxCharges: quantity,
        }
      : storedInstance;
  return { itemRef, itemId, instance, quantity };
};

type CampaignWarehouseInteractionContextValue = {
  pendingEquipmentConsumable: PendingEquipmentConsumable | null;
  upgradeFlashKey: string | null;
  inspectItem: (
    entry: ResolvedWarehouseItem,
    contextLabel: string,
    anchor: DescriptionAnchor,
  ) => void;
  canTargetItem: (entry: ResolvedWarehouseItem) => boolean;
  applyToTarget: (entry: ResolvedWarehouseItem) => boolean;
};

type CampaignWarehouseInteractionController =
  CampaignWarehouseInteractionContextValue & {
    itemPreview: ItemDetailPreview | null;
    beginPreviewUse: () => void;
    closePreview: () => void;
    cancelPending: () => void;
    reset: () => void;
  };

const CampaignWarehouseInteractionContext =
  createContext<CampaignWarehouseInteractionContextValue | null>(null);

function useCampaignWarehouseInteraction({
  campaign,
  onCampaignChange,
  onNotice,
  onBeginTargetMode,
}: {
  campaign: CampaignSave;
  onCampaignChange: (campaign: CampaignSave) => void;
  onNotice: (notice: string | null) => void;
  onBeginTargetMode: () => void;
}): CampaignWarehouseInteractionController {
  const [itemPreview, setItemPreview] = useState<ItemDetailPreview | null>(null);
  const [pendingEquipmentConsumable, setPendingEquipmentConsumable] =
    useState<PendingEquipmentConsumable | null>(null);
  const { upgradeFlashKey, flashUpgradeKey, clearUpgradeFlash } =
    useUpgradeFlashFeedback();

  const inspectItem = useCallback((
    entry: ResolvedWarehouseItem,
    contextLabel: string,
    anchor: DescriptionAnchor,
  ) => {
    setItemPreview({
      itemId: entry.itemId,
      itemRef: entry.itemRef,
      instance: entry.instance,
      quantity: entry.quantity,
      contextLabel,
      anchor,
    });
  }, []);

  const closePreview = useCallback(() => setItemPreview(null), []);
  const cancelPending = useCallback(() => {
    setPendingEquipmentConsumable(null);
    onNotice(null);
  }, [onNotice]);
  const reset = useCallback(() => {
    setItemPreview(null);
    setPendingEquipmentConsumable(null);
    clearUpgradeFlash();
  }, [clearUpgradeFlash]);

  const beginPreviewUse = useCallback(() => {
    if (!itemPreview || !isEquipmentConsumableId(itemPreview.itemId)) return;
    setItemPreview(null);
    onBeginTargetMode();
    onNotice(
      itemPreview.itemId === "scroll_upgrade"
        ? "강화할 장비를 선택하세요. Esc로 취소할 수 있습니다."
        : "인챈트를 추가할 장비를 선택하세요. Esc로 취소할 수 있습니다.",
    );
    setPendingEquipmentConsumable({
      itemRef: itemPreview.itemRef,
      itemId: itemPreview.itemId,
    });
  }, [itemPreview, onBeginTargetMode, onNotice]);

  const canTargetItem = useCallback((entry: ResolvedWarehouseItem) => Boolean(
    pendingEquipmentConsumable &&
    entry.instance &&
    canApplyEquipmentConsumable(
      pendingEquipmentConsumable.itemId,
      ITEM_DEFS[entry.itemId],
      entry.instance,
    )
  ), [pendingEquipmentConsumable]);

  const applyToTarget = useCallback((entry: ResolvedWarehouseItem) => {
    const pending = pendingEquipmentConsumable;
    if (!pending || !entry.instance || !canApplyEquipmentConsumable(
      pending.itemId,
      ITEM_DEFS[entry.itemId],
      entry.instance,
    )) {
      return false;
    }
    const result = applyWarehouseEquipmentConsumable(
      campaign,
      pending.itemId,
      entry.instance.id,
    );
    if (!result.changed) {
      onNotice(
        result.reason === "maximum-enchantments"
          ? "이 장비에는 더 이상 인챈트를 추가할 수 없습니다."
          : result.reason === "missing-scroll"
            ? "창고에 사용할 주문서가 없습니다."
            : "주문서를 적용할 수 있는 장비를 선택해야 합니다.",
      );
      return false;
    }

    onCampaignChange(result.campaign);
    setPendingEquipmentConsumable(null);
    flashUpgradeKey(upgradeTargetVisualKey({
      kind: "warehouse",
      instanceId: entry.instance.id,
    }));
    const itemName = result.itemId
      ? ITEM_DEFS[result.itemId]?.name ?? result.itemId
      : "장비";
    const traitName = result.traitId
      ? EQUIPMENT_TRAITS[result.traitId].name
      : null;
    onNotice(
      pending.itemId === "scroll_upgrade"
        ? `${itemName}이(가) +${result.upgradeLevel ?? 0} 장비로 강화되었습니다.${traitName ? ` 새로운 ${traitName} 인챈트가 깃들었습니다.` : ""}`
        : `${itemName}에 ${traitName ?? "새로운"} 인챈트가 추가되었습니다.`,
    );
    return true;
  }, [
    campaign,
    flashUpgradeKey,
    onCampaignChange,
    onNotice,
    pendingEquipmentConsumable,
  ]);

  useEffect(() => {
    if (!pendingEquipmentConsumable) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      cancelPending();
    };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [cancelPending, pendingEquipmentConsumable]);

  return useMemo(() => ({
      itemPreview,
      pendingEquipmentConsumable,
      upgradeFlashKey,
      inspectItem,
      canTargetItem,
      applyToTarget,
      beginPreviewUse,
      closePreview,
      cancelPending,
      reset,
    }), [
      applyToTarget,
      beginPreviewUse,
      canTargetItem,
      cancelPending,
      closePreview,
      inspectItem,
      itemPreview,
      pendingEquipmentConsumable,
      reset,
      upgradeFlashKey,
    ]);
}

function CampaignWarehouseInventory({
  warehouse,
  className,
  hiddenItemRefs,
  selectedIndex = null,
  contextLabel = "창고",
  emptyTitle = "보관된 아이템이 없습니다.",
  emptyDescription = "원정을 마치고 전리품을 회수하면 이곳에 표시됩니다.",
  isItemHighlighted,
  isItemFlashing,
  isItemSelectable,
  onItemSelect,
}: {
  warehouse: WarehouseState;
  className: string;
  hiddenItemRefs?: ReadonlySet<string>;
  selectedIndex?: number | null;
  contextLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  isItemHighlighted?: (entry: ResolvedWarehouseItem, index: number) => boolean;
  isItemFlashing?: (entry: ResolvedWarehouseItem, index: number) => boolean;
  isItemSelectable?: (entry: ResolvedWarehouseItem, index: number) => boolean;
  onItemSelect?: (
    entry: ResolvedWarehouseItem,
    index: number,
    anchor: DescriptionAnchor,
  ) => void;
}) {
  const slotDrag = useActiveItemSlotDrag();
  const interaction = useContext(CampaignWarehouseInteractionContext);
  const slots = normalizeStorageSlots(warehouse, WAREHOUSE_SLOT_COUNT);
  const instancesById = new Map(
    warehouse.instances.map((instance) => [instance.id, instance]),
  );
  const visibleEntries = slots.map((itemRef) =>
    itemRef && !hiddenItemRefs?.has(itemRef)
      ? resolveWarehouseItemRef(warehouse, itemRef, instancesById)
      : null,
  );
  return (
      <div className={`fixed-item-grid ${className}`}>
        {visibleEntries.map((entry, index) => {
          const address: ItemSlotAddress = { zone: "warehouse", index };
          if (!entry) {
            return (
              <div
                className="fixed-item-slot is-empty"
                key={`warehouse-slot-${index}`}
                {...(slotDrag?.addressAttributes(address, null) ?? {})}
              />
            );
          }
          const pendingTargetMode = Boolean(
            interaction?.pendingEquipmentConsumable,
          );
          const eligibleConsumableTarget = Boolean(
            pendingTargetMode && interaction?.canTargetItem(entry),
          );
          const selectable = pendingTargetMode
            ? eligibleConsumableTarget
            : Boolean(
                onItemSelect && (isItemSelectable?.(entry, index) ?? true),
              );
          const highlighted = pendingTargetMode
            ? eligibleConsumableTarget
            : isItemHighlighted?.(entry, index) ?? false;
          const isUpgradeFlashing = Boolean(
            isItemFlashing?.(entry, index) ||
            (
              entry.instance &&
              interaction?.upgradeFlashKey === upgradeTargetVisualKey({
                kind: "warehouse",
                instanceId: entry.instance.id,
              })
            ),
          );
          return (
            <button
              type="button"
              className={[
                "fixed-item-slot",
                "is-filled",
                selectedIndex === index ? "is-selected" : "",
                highlighted ? "is-upgradeable-choice" : "",
                selectable ? "is-selectable-choice" : "",
                isUpgradeFlashing ? "is-upgrade-flashing" : "",
                slotDrag?.heldAddressKey === itemSlotAddressKey(address)
                  ? "is-drag-source"
                  : "",
              ].filter(Boolean).join(" ")}
              key={`warehouse-slot-${index}`}
              title={`${ITEM_DEFS[entry.itemId]?.name ?? entry.itemId} ×${entry.quantity}`}
              onClick={(event) => {
                const anchor = descriptionAnchorFromElement(event.currentTarget);
                if (pendingTargetMode) {
                  if (eligibleConsumableTarget) {
                    interaction?.applyToTarget(entry);
                  }
                  return;
                }
                if (selectable) {
                  onItemSelect?.(entry, index, anchor);
                  return;
                }
                interaction?.inspectItem(entry, contextLabel, anchor);
              }}
              aria-disabled={pendingTargetMode && !eligibleConsumableTarget}
              {...(!pendingTargetMode
                ? slotDrag?.addressAttributes(address, {
                    itemRef: entry.itemRef,
                    itemId: entry.itemId,
                    quantity: entry.quantity,
                    grade: entry.instance?.grade,
                    upgradeLevel: entry.instance?.upgradeLevel,
                    charges: entry.instance?.charges,
                    maxCharges: entry.instance?.maxCharges,
                  }) ?? {}
                : {})}
            >
              <ItemSlotContents
                itemId={entry.itemId}
                size={40}
                instance={entry.instance}
                quantity={entry.quantity}
                showQuantity={entry.quantity > 1}
              />
            </button>
          );
        })}
        {visibleEntries.every((entry) => !entry) && (
          <div className="warehouse-empty">
            <span>□</span>
            <strong>{emptyTitle}</strong>
            <p>{emptyDescription}</p>
          </div>
        )}
      </div>
  );
}

const campaignEquipmentSlotLabel = (target: LoadoutTarget) =>
  target.kind === "equipment"
    ? target.slot === "weapon"
      ? "무기"
      : "갑옷"
    : isPartyQuickslotTarget(target)
      ? `퀵슬롯 ${target.index - 1}`
      : `패시브 ${target.index + 1}`;

type ResolvedCompanionEquipment = ReturnType<
  typeof resolveCompanionLoadoutItem
>;

const COMPANION_DRAG_TYPE = "application/x-nokpick-companion";

const setCompanionDragData = (
  event: ReactDragEvent<HTMLElement>,
  companionId: string,
  effectAllowed: "copy" | "move",
) => {
  event.dataTransfer.setData(COMPANION_DRAG_TYPE, companionId);
  event.dataTransfer.effectAllowed = effectAllowed;
  const dragImage = event.currentTarget.querySelector<HTMLElement>(
    ".pixel-sprite-frame > i",
  );
  if (!dragImage) return;
  const bounds = dragImage.getBoundingClientRect();
  event.dataTransfer.setDragImage(dragImage, bounds.width / 2, bounds.height / 2);
};

const readCompanionDragData = (event: ReactDragEvent<HTMLElement>) =>
  event.dataTransfer.getData(COMPANION_DRAG_TYPE) || null;

const hasCompanionDragData = (event: ReactDragEvent<HTMLElement>) =>
  Array.from(event.dataTransfer.types).includes(COMPANION_DRAG_TYPE);

function CampaignCompanionEquipmentRoster({
  companions,
  placement,
  selectedCompanionIds = [],
  controlledCompanionId = null,
  sharedInventory,
  selectedItemKey = null,
  emptyMessage,
  onCompanionToggle,
  isCompanionToggleDisabled,
  itemSelectionKey,
  isItemHighlighted,
  isItemFlashing,
  onItemSelect,
  onTrainingSelect,
}: {
  companions: Companion[];
  placement: "party" | "reserve" | "smithy" | "training";
  selectedCompanionIds?: readonly string[];
  controlledCompanionId?: string | null;
  sharedInventory?: Pick<Player, "inventory" | "throwableProfiles">;
  selectedItemKey?: string | null;
  emptyMessage: string;
  onCompanionToggle?: (companionId: string) => void;
  isCompanionToggleDisabled?: (companion: Companion) => boolean;
  itemSelectionKey?: (
    companion: Companion,
    target: LoadoutTarget,
    entry: ResolvedCompanionEquipment,
  ) => string | null;
  isItemHighlighted?: (
    companion: Companion,
    target: LoadoutTarget,
    entry: ResolvedCompanionEquipment,
  ) => boolean;
  isItemFlashing?: (
    companion: Companion,
    target: LoadoutTarget,
    entry: ResolvedCompanionEquipment,
  ) => boolean;
  onItemSelect?: (
    companion: Companion,
    target: LoadoutTarget,
    entry: ResolvedCompanionEquipment,
  ) => void;
  onTrainingSelect?: (companionId: string) => void;
}) {
  const slotDrag = useActiveItemSlotDrag();
  const [itemPreview, setItemPreview] = useState<ItemDetailPreview | null>(null);
  const [companionPreview, setCompanionPreview] = useState<{
    companion: Companion;
    anchor: DescriptionAnchor;
  } | null>(null);
  const inspectItem = (
    companion: Companion,
    entry: ResolvedCompanionEquipment,
    anchor: DescriptionAnchor,
  ) => {
    if (!entry.itemId) return;
    setItemPreview({
      itemId: entry.itemId,
      itemRef: entry.instance?.id ?? entry.itemId,
      instance: entry.instance,
      quantity: entry.quantity,
      contextLabel: `${companion.name} 장착 장비`,
      anchor,
    });
  };

  return (
    <>
      <div
        className={`preparation-equipment-roster ${
          placement === "party"
            ? "is-active-party"
            : placement === "reserve"
              ? "is-reserve-roster"
              : placement === "training"
                ? "is-training-roster"
                : "is-smithy-roster"
        }`}
      >
        {companions.map((companion) => {
          const definition = characterPresentation(companion);
          const profession = COMPANION_PROFESSIONS[companion.professionId];
          const selected = selectedCompanionIds.includes(companion.id);
          const isControlled = controlledCompanionId === companion.id;
          const portraitFrame = definition.animationSet === "companion"
            ? companionFrameIndex(
                companionArmorTier(companion),
                COMPANION_IDLE_FRAMES[0],
              )
            : PLAYER_IDLE_FRAMES[0];
          const companionDragEffect = onTrainingSelect ? "copy" : "move";
          const canDragCompanion = Boolean(
            onCompanionToggle || onTrainingSelect,
          );
          return (
            <article
              className={[
                "preparation-owner-card",
                selected ? "is-selected" : "",
                placement === "reserve" ? "is-reserve" : "",
                placement === "smithy" ? "is-smithy" : "",
                placement === "training" ? "is-training" : "",
              ].filter(Boolean).join(" ")}
              key={`${placement}-${companion.id}`}
              draggable={canDragCompanion}
              onPointerDownCapture={(event) => {
                if (
                  (event.target as HTMLElement).closest(
                    "[data-item-slot-address]",
                  )
                ) {
                  event.currentTarget.dataset.companionDragBlocked = "true";
                } else {
                  delete event.currentTarget.dataset.companionDragBlocked;
                }
              }}
              onPointerUpCapture={(event) => {
                delete event.currentTarget.dataset.companionDragBlocked;
              }}
              onPointerCancelCapture={(event) => {
                delete event.currentTarget.dataset.companionDragBlocked;
              }}
              onDragStart={(event) => {
                if (
                  event.currentTarget.dataset.companionDragBlocked === "true" ||
                  (event.target as HTMLElement).closest(
                    "[data-item-slot-address]",
                  )
                ) {
                  delete event.currentTarget.dataset.companionDragBlocked;
                  event.preventDefault();
                  event.stopPropagation();
                  return;
                }
                delete event.currentTarget.dataset.companionDragBlocked;
                setCompanionDragData(
                  event,
                  companion.id,
                  companionDragEffect,
                );
              }}
              onDoubleClick={() => {
                if (placement === "training") onTrainingSelect?.(companion.id);
              }}
            >
              <header>
                <button
                  type="button"
                  className="prep-companion-portrait-button"
                  onClick={(event) =>
                    setCompanionPreview({
                      companion,
                      anchor: descriptionAnchorFromElement(event.currentTarget),
                    })
                  }
                  aria-label={`${companion.name} 정보 보기`}
                >
                  <PixelSpriteFrame
                    file={definition.sprite}
                    sheetWidth={definition.sheetWidth}
                    frameWidth={definition.frameWidth}
                    frameHeight={definition.frameHeight}
                    frame={portraitFrame}
                    size={48}
                  />
                </button>
                <div>
                  <small>{isControlled ? "조작 캐릭터 · " : ""}{profession.nameKo}</small>
                  <strong>{companion.name}</strong>
                  <em>LV.{companion.level} · EXP {companion.xp}/{companion.nextXp || "MAX"}</em>
                </div>
                {onCompanionToggle && (
                  <button
                    type="button"
                    onClick={() => onCompanionToggle(companion.id)}
                    disabled={isCompanionToggleDisabled?.(companion) ?? false}
                  >
                    {selected ? "동행 해제" : "동행 선택"}
                  </button>
                )}
              </header>
              {placement === "training" && (
                <CharacterResourceBars character={companion} />
              )}
              {placement !== "training" && <div className="preparation-owner-slots">
                {PARTY_LOADOUT_TARGETS.map((target) => {
                  const entry = resolveCompanionLoadoutItem(
                    companion,
                    target,
                    sharedInventory,
                  );
                  const itemId = entry.itemId;
                  const itemRef = itemId ? entry.instance?.id ?? itemId : null;
                  const address: ItemSlotAddress = {
                    zone: "preparationCompanionEquipment",
                    companionId: companion.id,
                    target,
                  };
                  const selectionKey = itemSelectionKey?.(
                    companion,
                    target,
                    entry,
                  ) ?? null;
                  const highlighted = isItemHighlighted?.(
                    companion,
                    target,
                    entry,
                  ) ?? false;
                  return (
                    <label
                      className={
                        isPartyQuickslotTarget(target)
                          ? "is-quickslot"
                          : "is-gear"
                      }
                      key={
                        target.kind === "equipment"
                          ? target.slot
                          : `flex-${target.index}`
                      }
                    >
                      <span>{campaignEquipmentSlotLabel(target)}</span>
                      <button
                        type="button"
                        className={[
                          "fixed-item-slot",
                          "preparation-equipment-slot",
                          itemId ? "is-filled" : "is-empty",
                          highlighted ? "is-upgradeable-choice" : "",
                          isItemFlashing?.(companion, target, entry)
                            ? "is-upgrade-flashing"
                            : "",
                          selectionKey && selectionKey === selectedItemKey
                            ? "is-selected"
                            : "",
                          slotDrag?.heldAddressKey === itemSlotAddressKey(address)
                            ? "is-drag-source"
                            : "",
                        ].filter(Boolean).join(" ")}
                        title={itemId ? ITEM_DEFS[itemId]?.name : "빈 장비칸"}
                        onClick={(event) => {
                          if (!itemId || !itemRef) return;
                          if (selectionKey && onItemSelect) {
                            onItemSelect(companion, target, entry);
                          } else {
                            inspectItem(
                              companion,
                              entry,
                              descriptionAnchorFromElement(event.currentTarget),
                            );
                          }
                        }}
                        onDoubleClick={(event) =>
                          inspectItem(
                            companion,
                            entry,
                            descriptionAnchorFromElement(event.currentTarget),
                          )
                        }
                        {...(slotDrag?.addressAttributes(
                          address,
                          itemId && itemRef
                            ? {
                                itemRef,
                                itemId,
                                quantity: entry.quantity,
                                grade: entry.instance?.grade,
                                upgradeLevel: entry.instance?.upgradeLevel,
                                charges: entry.instance?.charges,
                                maxCharges: entry.instance?.maxCharges,
                              }
                            : null,
                        ) ?? {})}
                      >
                        {itemId ? (
                          <ItemSlotContents
                            itemId={itemId}
                            size={36}
                            instance={entry.instance}
                            quantity={entry.quantity}
                            showQuantity={entry.isAuto}
                          />
                        ) : (
                          <span className="empty-slot-glyph">+</span>
                        )}
                      </button>
                    </label>
                  );
                })}
              </div>}
            </article>
          );
        })}
        {companions.length === 0 && (
          <div
            className={
              placement === "reserve"
                ? "preparation-reserve-empty"
                : "preparation-party-empty"
            }
          >
            {emptyMessage}
          </div>
        )}
      </div>
      {itemPreview && (
        <ItemDetailModal
          game={null}
          selected={{
            itemId: itemPreview.itemId,
            itemRef: itemPreview.itemRef,
          }}
          preview={itemPreview}
          readOnly
          onClose={() => setItemPreview(null)}
        />
      )}
      {companionPreview && (
        <CompanionInspector
          companion={companionPreview.companion}
          anchor={companionPreview.anchor}
          onClose={() => setCompanionPreview(null)}
        />
      )}
    </>
  );
}

function CharacterResourceBars({
  character,
}: {
  character: Player | Companion;
}) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  const resources = normalizeSkillResources(character);
  const resourceType = primarySkillResource(character.professionId);
  const resourceCurrent = currentSkillResource(resources, resourceType);
  const resourceMaximum = maxSkillResource(resources, resourceType);
  const resourceLabel = resourceType === "stamina"
    ? text("기력", "Stamina")
    : text("마나", "Mana");
  const percent = (current: number, maximum: number) =>
    Math.max(0, Math.min(100, maximum > 0 ? current / maximum * 100 : 0));
  const hpLabel = `${text("생명력", "Health")} ${character.hp} / ${character.maxHp}`;
  const primaryLabel = `${resourceLabel} ${formatSkillResourceAmount(
    resourceCurrent,
  )} / ${formatSkillResourceAmount(resourceMaximum)}`;
  return (
    <div className="character-resource-bars">
      <span
        className="character-resource-bar is-health"
        title={hpLabel}
        aria-label={hpLabel}
      >
        <i style={{ width: `${percent(character.hp, character.maxHp)}%` }} />
      </span>
      <span
        className={`character-resource-bar is-${resourceType}`}
        title={primaryLabel}
        aria-label={primaryLabel}
      >
        <i style={{ width: `${percent(resourceCurrent, resourceMaximum)}%` }} />
      </span>
    </div>
  );
}

function CompanionPanel({
  game,
  selection,
  playerSelection,
  pendingItemRef,
  upgradeMode,
  canTargetEquipment,
  onSelectSlot,
  onSelectPlayerSlot,
  onAssignPendingCompanion,
  onAssignPendingPlayer,
  onUpgradeCompanion,
  onUpgradePlayer,
  onOpenSlotItem,
  onOpenPlayerSlotItem,
  onUnassign,
  onUnequipPlayer,
  selectedSkill,
  onSkill,
  onQuickslot,
  onRecruit,
  developerMode,
  busy,
  upgradeFlashKey,
}: {
  game: GameState;
  selection: CompanionLoadoutSelection | null;
  playerSelection: PlayerLoadoutSelection | null;
  pendingItemRef: string | null;
  upgradeMode: boolean;
  canTargetEquipment: (itemId: string, instance: InventoryInstance) => boolean;
  onSelectSlot: (selection: CompanionLoadoutSelection) => void;
  onSelectPlayerSlot: (selection: PlayerLoadoutSelection) => void;
  onAssignPendingCompanion: (selection: CompanionLoadoutSelection) => void;
  onAssignPendingPlayer: (selection: PlayerLoadoutSelection) => void;
  onUpgradeCompanion: (selection: CompanionLoadoutSelection) => void;
  onUpgradePlayer: (selection: PlayerLoadoutSelection) => void;
  onOpenSlotItem: (
    selection: CompanionLoadoutSelection,
    itemId: string,
    anchor: DescriptionAnchor,
  ) => void;
  onOpenPlayerSlotItem: (
    selection: PlayerLoadoutSelection,
    itemId: string,
    itemRef: string,
    anchor: DescriptionAnchor,
  ) => void;
  onUnassign: (selection: CompanionLoadoutSelection) => void;
  onUnequipPlayer: (selection: PlayerLoadoutSelection) => void;
  selectedSkill: PendingCompanionSkill | null;
  onSkill: (casterId: string, skillId: CompanionSkillId) => void;
  onQuickslot: (ownerId: string, slotIndex: number) => void;
  onRecruit: (classId: CompanionClassId) => void;
  developerMode: boolean;
  busy: boolean;
  upgradeFlashKey: string | null;
}) {
  const language = useUiLanguage();
  const text = useCallback(
    (korean: string, english: string) => uiText(language, korean, english),
    [language],
  );
  const companions = game.companions ?? [];
  const [profileOwner, setProfileOwner] = useState<{
    ownerId: string;
    anchor: DescriptionAnchor;
  } | null>(null);
  const [inspectedSkill, setInspectedSkill] = useState<{
    casterId: string;
    skillId: CompanionSkillId;
    anchor: DescriptionAnchor;
  } | null>(null);
  const slotDrag = useActiveItemSlotDrag();
  const pendingSlotActivationRef = useRef<{
    key: string;
    timer: number;
  } | null>(null);
  const clearPendingSlotActivation = useCallback(() => {
    if (!pendingSlotActivationRef.current) return;
    window.clearTimeout(pendingSlotActivationRef.current.timer);
    pendingSlotActivationRef.current = null;
  }, []);
  useEffect(
    () => clearPendingSlotActivation,
    [clearPendingSlotActivation],
  );
  const openOrUnequip = useCallback(
    (key: string, onOpen: () => void, onUnequip: () => void) => {
      const pending = pendingSlotActivationRef.current;
      if (pending?.key === key) {
        clearPendingSlotActivation();
        onUnequip();
        return;
      }
      clearPendingSlotActivation();
      const timer = window.setTimeout(() => {
        pendingSlotActivationRef.current = null;
        onOpen();
      }, 240);
      pendingSlotActivationRef.current = { key, timer };
    },
    [clearPendingSlotActivation],
  );
  const controlledDefinition = characterPresentation(game.player);
  const controlledProfession =
    COMPANION_PROFESSIONS[game.player.professionId];
  const targets = PARTY_LOADOUT_TARGETS;
  const slotLabel = (target: LoadoutTarget) =>
    target.kind === "flex"
      ? isPartyQuickslotTarget(target)
        ? text(`퀵슬롯 ${target.index - 1}`, `Quickslot ${target.index - 1}`)
        : text(`패시브 ${target.index + 1}`, `Passive ${target.index + 1}`)
      : target.slot === "weapon"
        ? text("무기", "Weapon")
        : text("갑옷", "Armor");
  const sameTarget = (a: LoadoutTarget | undefined, b: LoadoutTarget) =>
    Boolean(
      a &&
      a.kind === b.kind &&
      (a.kind === "equipment" && b.kind === "equipment"
        ? a.slot === b.slot
        : a.kind === "flex" && b.kind === "flex" && a.index === b.index),
    );
  const skillButtons = (
    casterId: string,
    character: Player | Companion,
    defeated: boolean,
  ) => (
    <div className="companion-skill-list" aria-label={text("수동 스킬", "Manual Skills")}>
      {character.skills.slice(0, 2).map((skillId) => {
        const skill = COMPANION_SKILLS[skillId];
        const cooldown = character.skillCooldowns[skillId] ?? 0;
        const displayedCooldown = remainingCooldownTurns(cooldown);
        const hasResource = canPaySkillResource(
          character,
          skill.resourceType,
          skill.resourceCost,
        );
        const active =
          selectedSkill?.casterId === casterId &&
          selectedSkill.skillId === skillId;
        return (
          <div
            key={skillId}
            className={`companion-skill-action ${active ? "is-targeting" : ""}`}
            style={{ "--skill-accent": skill.accent } as CSSProperties}
          >
            <button
              type="button"
              className="companion-skill-action__cast"
              disabled={busy || defeated || cooldown > 0 || !hasResource}
              onClick={() => onSkill(casterId, skillId)}
              aria-pressed={active}
              aria-label={text(`${skill.nameKo} 사용`, `Use ${skill.nameEn}`)}
            >
              <i aria-hidden="true">{language === "ko" ? skill.shortKo : skill.shortEn.slice(0, 2)}</i>
              <span>
                <strong>{language === "ko" ? skill.nameKo : skill.nameEn}</strong>
                <small>
                  {cooldown > 0
                    ? text(`${displayedCooldown}턴 후`, `${displayedCooldown} turns`)
                    : !hasResource
                      ? skill.resourceType === "stamina"
                        ? text("기력 부족", "Low stamina")
                        : text("마나 부족", "Low mana")
                    : skill.range === 0
                      ? text("자기 칸", "Self tile")
                      : text(`사거리 ${skill.range}`, `Range ${skill.range}`)}
                </small>
              </span>
            </button>
            <button
              type="button"
              className="companion-skill-action__info"
              onClick={(event) =>
                setInspectedSkill({
                  casterId,
                  skillId,
                  anchor: descriptionAnchorFromElement(event.currentTarget),
                })
              }
              aria-label={text(`${skill.nameKo} 설명`, `${skill.nameEn} details`)}
            >
              i
            </button>
          </div>
        );
      })}
    </div>
  );
  const profileCompanion = profileOwner && profileOwner.ownerId !== PLAYER_ID
    ? companions.find((companion) => companion.id === profileOwner.ownerId) ?? null
    : null;
  const inspectedSkillOwner = inspectedSkill?.casterId === PLAYER_ID
    ? game.player
    : companions.find((companion) => companion.id === inspectedSkill?.casterId) ?? null;

  return (
    <section
      className={[
        "companion-panel",
        pendingItemRef ? "is-loadout-picking" : "",
        upgradeMode ? "is-upgrade-picking" : "",
      ].filter(Boolean).join(" ")}
      aria-label={text("원정대 장비", "Party Loadouts")}
    >
      <div className="companion-roster">
        <article className="companion-card is-player-loadout">
          <button
            type="button"
            className="companion-card__identity"
            onClick={(event) =>
              setProfileOwner({
                ownerId: PLAYER_ID,
                anchor: descriptionAnchorFromElement(event.currentTarget),
              })
            }
            aria-label={text(`${game.player.name} 설명 보기`, `View ${game.player.name}'s details`)}
          >
            <PixelSpriteFrame
              file={controlledDefinition.sprite}
              sheetWidth={controlledDefinition.sheetWidth}
              frameWidth={controlledDefinition.frameWidth}
              frameHeight={controlledDefinition.frameHeight}
              frame={
                controlledDefinition.animationSet === "companion"
                  ? companionFrameIndex(
                      companionArmorTier(playerToCompanion(game.player)),
                      COMPANION_IDLE_FRAMES[0],
                    )
                  : PLAYER_IDLE_FRAMES[0]
              }
              size={40}
            />
            <CharacterResourceBars character={game.player} />
            <div className="companion-card__identity-copy">
              <strong>{game.player.name}</strong>
              <small>{language === "ko" ? controlledProfession.nameKo : controlledProfession.nameEn} · Lv.{game.player.level}</small>
            </div>
          </button>
          {skillButtons(
            PLAYER_ID,
            game.player,
            game.player.hp <= 0,
          )}
          <div className="companion-loadout">
            {targets.map((target) => {
              const entry = resolvePlayerLoadoutItem(game.player, target);
              const itemId = entry.itemId;
              const active = sameTarget(playerSelection ?? undefined, target);
              const canAssign = pendingItemRef
                ? canAssignPlayerItem(game, pendingItemRef, target)
                : false;
              const canUpgrade = Boolean(
                itemId && entry.instance && canTargetEquipment(itemId, entry.instance),
              );
              const key = target.kind === "equipment" ? target.slot : `flex-${target.index}`;
              const address: ItemSlotAddress = {
                zone: "playerEquipment",
                target,
              };
              const dragItem = itemId
                ? {
                    itemRef: entry.instance?.id ?? entry.itemRef ?? itemId,
                    itemId,
                    quantity: entry.quantity,
                    upgradeLevel: entry.instance?.upgradeLevel,
                    charges: entry.instance?.charges,
                    maxCharges: entry.instance?.maxCharges,
                  }
                : null;
              return (
                <div
                  className={`companion-slot-wrap ${isPartyQuickslotTarget(target) ? "is-quickslot" : "is-gear"}`}
                  key={key}
                >
                  <button
                    type="button"
                    className={[
                      "companion-slot",
                      itemId ? "is-filled" : "",
                      active || canAssign || (upgradeMode && canUpgrade) ? "is-selecting" : "",
                      upgradeFlashKey ===
                      (target.kind === "equipment"
                        ? `player:${target.slot}`
                        : `player:flex:${target.index}`)
                        ? "is-upgrade-flashing"
                        : "",
                      slotDrag?.heldAddressKey === itemSlotAddressKey(address)
                        ? "is-drag-source"
                        : "",
                    ].filter(Boolean).join(" ")}
                    disabled={busy || Boolean(pendingItemRef && !canAssign) || Boolean(upgradeMode && !canUpgrade)}
                    onClick={(event) => {
                      if (pendingItemRef && canAssign) {
                        clearPendingSlotActivation();
                        return onAssignPendingPlayer(target);
                      }
                      if (upgradeMode && canUpgrade) {
                        clearPendingSlotActivation();
                        return onUpgradePlayer(target);
                      }
                      if (!itemId || !entry.itemRef) {
                        clearPendingSlotActivation();
                        return onSelectPlayerSlot(target);
                      }
                      if (isPartyQuickslotTarget(target)) {
                        clearPendingSlotActivation();
                        return onQuickslot(PLAYER_ID, target.index);
                      }
                      const anchor = descriptionAnchorFromElement(event.currentTarget);
                      openOrUnequip(
                        `player-${key}`,
                        () => onOpenPlayerSlotItem(target, itemId, entry.itemRef!, anchor),
                        () => onUnequipPlayer(target),
                      );
                    }}
                    aria-label={text(
                      `${slotLabel(target)}${itemId ? isPartyQuickslotTarget(target) ? ", 클릭해 수동 사용" : ", 한 번 클릭해 설명·두 번 클릭해 해제" : " 선택"}`,
                      `${slotLabel(target)}${itemId ? isPartyQuickslotTarget(target) ? ", click to use manually" : ", click for details or double-click to unequip" : " selection"}`,
                    )}
                    {...(slotDrag?.addressAttributes(address, dragItem) ?? {})}
                  >
                    {itemId ? (
                      <ItemSlotContents
                        itemId={itemId}
                        size={34}
                        instance={entry.instance}
                        quantity={entry.quantity}
                        showQuantity={entry.isAuto}
                      />
                    ) : <span>+</span>}
                  </button>
                  {itemId && (
                    <button
                      type="button"
                      className="companion-slot__remove"
                      disabled={busy || Boolean(entry.instance?.cursed)}
                      onClick={() => {
                        clearPendingSlotActivation();
                        onUnequipPlayer(target);
                      }}
                      aria-label={text("장비 해제", "Unequip")}
                    >×</button>
                  )}
                </div>
              );
            })}
          </div>
        </article>

        {companions.map((companion) => {
          const classDefinition = characterPresentation(companion);
          const profession = COMPANION_PROFESSIONS[companion.professionId];
          const displayName = language === "en" && companion.name === classDefinition.defaultNameKo
            ? classDefinition.defaultNameEn
            : companion.name;
          return (
            <article className={`companion-card ${companion.hp <= 0 ? "is-defeated" : ""}`} key={companion.id}>
              <button
                type="button"
                className="companion-card__identity"
                onClick={(event) =>
                  setProfileOwner({
                    ownerId: companion.id,
                    anchor: descriptionAnchorFromElement(event.currentTarget),
                  })
                }
                aria-label={text(`${displayName} 설명 보기`, `View ${displayName}'s details`)}
              >
                <PixelSpriteFrame
                  file={classDefinition.sprite}
                  sheetWidth={classDefinition.sheetWidth}
                  frameWidth={classDefinition.frameWidth}
                  frameHeight={classDefinition.frameHeight}
                  frame={
                    classDefinition.animationSet === "companion"
                      ? companionFrameIndex(
                          companionArmorTier(companion),
                          COMPANION_IDLE_FRAMES[0],
                        )
                      : PLAYER_IDLE_FRAMES[0]
                  }
                  size={40}
                />
                <CharacterResourceBars character={companion} />
                <div className="companion-card__identity-copy">
                  <strong>{displayName}</strong>
                  <small>{language === "ko" ? profession.nameKo : profession.nameEn} · Lv.{companion.level}</small>
                </div>
              </button>
              {skillButtons(
                companion.id,
                companion,
                companion.hp <= 0,
              )}
              <div className="companion-loadout">
                {targets.map((target) => {
                  const entry = resolveCompanionLoadoutItem(
                    companion,
                    target,
                    game.player,
                  );
                  const itemId = entry.itemId;
                  const loadoutSelection = { companionId: companion.id, target } satisfies CompanionLoadoutSelection;
                  const active = selection?.companionId === companion.id && sameTarget(selection.target, target);
                  const canAssign = pendingItemRef
                    ? canAssignCompanionItem(game, pendingItemRef, target)
                    : false;
                  const canUpgrade = Boolean(
                    itemId && entry.instance && canTargetEquipment(itemId, entry.instance),
                  );
                  const key = target.kind === "equipment" ? target.slot : `flex-${target.index}`;
                  const address: ItemSlotAddress = {
                    zone: "companionEquipment",
                    companionId: companion.id,
                    target,
                  };
                  const dragItem = itemId
                    ? {
                        itemRef: entry.instance?.id ?? itemId,
                        itemId,
                        quantity: entry.quantity,
                        upgradeLevel: entry.instance?.upgradeLevel,
                        charges: entry.instance?.charges,
                        maxCharges: entry.instance?.maxCharges,
                      }
                    : null;
                  return (
                    <div
                      className={`companion-slot-wrap ${isPartyQuickslotTarget(target) ? "is-quickslot" : "is-gear"}`}
                      key={key}
                    >
                      <button
                        type="button"
                        className={[
                          "companion-slot",
                          itemId ? "is-filled" : "",
                          active || canAssign || (upgradeMode && canUpgrade) ? "is-selecting" : "",
                          upgradeFlashKey ===
                          (target.kind === "equipment"
                            ? `${companion.id}:${target.slot}`
                            : `${companion.id}:flex:${target.index}`)
                            ? "is-upgrade-flashing"
                            : "",
                          slotDrag?.heldAddressKey === itemSlotAddressKey(address)
                            ? "is-drag-source"
                            : "",
                        ].filter(Boolean).join(" ")}
                        disabled={busy || companion.hp <= 0 || Boolean(pendingItemRef && !canAssign) || Boolean(upgradeMode && !canUpgrade)}
                        onClick={(event) => {
                          if (pendingItemRef && canAssign) {
                            clearPendingSlotActivation();
                            return onAssignPendingCompanion(loadoutSelection);
                          }
                          if (upgradeMode && canUpgrade) {
                            clearPendingSlotActivation();
                            return onUpgradeCompanion(loadoutSelection);
                          }
                          if (!itemId) {
                            clearPendingSlotActivation();
                            return onSelectSlot(loadoutSelection);
                          }
                          if (isPartyQuickslotTarget(target)) {
                            clearPendingSlotActivation();
                            return onQuickslot(companion.id, target.index);
                          }
                          const anchor = descriptionAnchorFromElement(event.currentTarget);
                          openOrUnequip(
                            `${companion.id}-${key}`,
                            () => onOpenSlotItem(loadoutSelection, itemId, anchor),
                            () => onUnassign(loadoutSelection),
                          );
                        }}
                        aria-label={text(
                          `${displayName} ${slotLabel(target)}${itemId ? isPartyQuickslotTarget(target) ? ", 클릭해 수동 사용" : ", 한 번 클릭해 설명·두 번 클릭해 해제" : " 선택"}`,
                          `${displayName}'s ${slotLabel(target)}${itemId ? isPartyQuickslotTarget(target) ? ", click to use manually" : ", click for details or double-click to unequip" : " selection"}`,
                        )}
                        {...(slotDrag?.addressAttributes(address, dragItem) ?? {})}
                      >
                        {itemId ? (
                          <ItemSlotContents
                            itemId={itemId}
                            size={34}
                            instance={entry.instance}
                            quantity={entry.quantity}
                            showQuantity={entry.isAuto}
                          />
                        ) : <span>+</span>}
                      </button>
                      {itemId && (
                        <button
                          type="button"
                          className="companion-slot__remove"
                          disabled={busy || Boolean(entry.instance?.cursed)}
                          onClick={() => {
                            clearPendingSlotActivation();
                            onUnassign(loadoutSelection);
                          }}
                          aria-label={text(`${slotLabel(target)} 회수`, `Remove ${slotLabel(target)}`)}
                        >×</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
      {developerMode && (
        <div className="companion-developer-tools">
          <small>{text("개발자 동료 모집", "Developer Recruitment")}</small>
          <div>
            {COMPANION_CLASS_IDS.map((classId) => (
              <button type="button" key={classId} disabled={busy} onClick={() => onRecruit(classId)}>
                {language === "ko" ? COMPANION_PRESENTATIONS[classId].nameKo : COMPANION_PRESENTATIONS[classId].nameEn}
              </button>
            ))}
          </div>
        </div>
      )}
      {profileOwner?.ownerId === PLAYER_ID ? (
        <PlayerInspector
          game={game}
          anchor={profileOwner.anchor}
          onClose={() => setProfileOwner(null)}
        />
      ) : profileOwner && profileCompanion ? (
        <CompanionInspector
          companion={profileCompanion}
          anchor={profileOwner.anchor}
          onClose={() => setProfileOwner(null)}
        />
      ) : null}
      {inspectedSkill && inspectedSkillOwner && (
        <SkillDescriptionWindow
          caster={inspectedSkillOwner}
          skillId={inspectedSkill.skillId}
          anchor={inspectedSkill.anchor}
          disabled={busy || inspectedSkillOwner.hp <= 0}
          onUse={() => {
            onSkill(inspectedSkill.casterId, inspectedSkill.skillId);
            setInspectedSkill(null);
          }}
          onClose={() => setInspectedSkill(null)}
        />
      )}
    </section>
  );
}

function PixelSpriteFrame({
  file,
  sheetWidth,
  frameWidth,
  frameHeight,
  frame = 0,
  size,
  className = "",
}: {
  file: string;
  sheetWidth: number;
  frameWidth: number;
  frameHeight: number;
  frame?: number;
  size: number;
  className?: string;
}) {
  const columns = Math.max(1, Math.floor(sheetWidth / frameWidth));
  const scale = Math.max(
    1,
    Math.floor(size / Math.max(frameWidth, frameHeight)),
  );
  const sourceX = (frame % columns) * frameWidth;
  const sourceY = Math.floor(frame / columns) * frameHeight;
  return (
    <span
      className={`pixel-sprite-frame ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <i
        style={{
          width: frameWidth * scale,
          height: frameHeight * scale,
          backgroundImage: `url('${runtimeImageSource(file)}')`,
          backgroundSize: `${sheetWidth * scale}px auto`,
          backgroundPosition: `${-sourceX * scale}px ${-sourceY * scale}px`,
        }}
      />
    </span>
  );
}

function EnemySpriteIcon({
  kind,
  size = 60,
  className = "",
}: {
  kind: EnemyKind;
  size?: number;
  className?: string;
}) {
  const sprite = ENEMY_SPRITES[kind];
  return (
    <PixelSpriteFrame
      file={sprite.file}
      sheetWidth={sprite.sheetWidth}
      frameWidth={sprite.frameWidth}
      frameHeight={sprite.frameHeight}
      frame={sprite.idle[0] ?? 0}
      size={size}
      className={className}
    />
  );
}

function DungeonObjectIcon({
  kind,
  size = 48,
}: {
  kind: keyof typeof OBJECT_SPRITES;
  size?: number;
}) {
  const definition = OBJECT_SPRITES[kind];
  const scale = size / 16;
  const x = definition.sprite % 16;
  const y = Math.floor(definition.sprite / 16);
  return (
    <span
      className="dungeon-object-icon"
      style={{
        width: size,
        height: size,
        backgroundImage: "url('/assets/sprites/items.png')",
        backgroundSize: `${256 * scale}px ${512 * scale}px`,
        backgroundPosition: `${-x * size}px ${-y * size}px`,
      }}
      aria-hidden="true"
    />
  );
}

function EntityInspector({
  enemy,
  anchor,
  onClose,
}: {
  enemy: Enemy;
  anchor: DescriptionAnchor;
  onClose: () => void;
}) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  const sprite = ENEMY_SPRITES[enemy.kind];
  const definition = enemyDefinition(enemy.kind);
  const enemySkills = definition.skills.flatMap((skillId) => {
    const skill = enemySkill(skillId);
    const rule = definition.skillRules.find((candidate) => candidate.skillId === skillId);
    return skill ? [{ rule, skill }] : [];
  });
  const enemyName = enemy.questId
    ? language === "ko"
      ? enemy.uniqueName ?? localizedEnemyName(enemy.kind, language)
      : questDefinition(enemy.questId)?.targetNameEn ??
        localizedEnemyName(enemy.kind, language)
    : localizedEnemyName(enemy.kind, language);

  return (
    <DescriptionWindow
      anchor={anchor}
      className="entity-inspector"
      ariaLabel={text(`${sprite.label} 조사 결과`, `${enemyName} inspection`)}
      onClose={onClose}
    >
      <header>
        <div className="entity-inspector__identity">
          <EnemySpriteIcon kind={enemy.kind} size={48} />
          <div>
            <p>{text("적군 조사", "Enemy Scan")}</p>
            <h3>
              {enemyName}
              {enemy.sleeping && (
                <em className="sleep-state">{text("수면 중", "Sleeping")}</em>
              )}
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={text("엔티티 조사 닫기", "Close entity inspection")}
        >
          ×
        </button>
      </header>
      <div className="entity-stat-grid">
        <span>
          <small>{text("생명력", "Health")}</small>
          <strong>
            {enemy.hp}/{enemy.maxHp}
          </strong>
        </span>
        <span>
          <small>{text("공격력", "Attack")}</small>
          <strong>{enemy.attack}</strong>
        </span>
        <span>
          <small>{text("방어력", "Defense")}</small>
          <strong>{enemy.defense}</strong>
        </span>
        <span>
          <small>{text("명중", "Accuracy")}</small>
          <strong>{enemy.accuracy}</strong>
        </span>
        <span>
          <small>{text("회피", "Evasion")}</small>
          <strong>{enemy.evasion}</strong>
        </span>
        <span>
          <small>{text("경험치", "Experience")}</small>
          <strong>{enemy.xp}</strong>
        </span>
        <span>
          <small>{text("치명타 확률", "Critical Chance")}</small>
          <strong>{formatCombatPercent(enemy.criticalChance)}</strong>
        </span>
        <span>
          <small>{text("치명타 피해", "Critical Damage")}</small>
          <strong>
            +{formatCombatPercent(enemy.criticalDamageBonus)} ({text("총", "Total")} {formatCombatPercent(1 + enemy.criticalDamageBonus)})
          </strong>
        </span>
        <span>
          <small>{text("피해 흡혈", "Life Steal")}</small>
          <strong>{formatCombatPercent(enemy.lifeSteal)}</strong>
        </span>
        <span>
          <small>{text("방어 관통", "Armor Penetration")}</small>
          <strong>{formatCombatPercent(enemy.armorPenetration)}</strong>
        </span>
        <span>
          <small>{text("재사용 대기시간 감소", "Cooldown Reduction")}</small>
          <strong>{formatCombatPercent(enemy.cooldownReduction)}</strong>
        </span>
        <span>
          <small>{text("상태이상 저항", "Status Resistance")}</small>
          <strong>{formatCombatPercent(enemy.statusResistance)}</strong>
        </span>
      </div>
      {(enemy.statuses ?? []).length > 0 && (
        <div className="inventory-detail__stats">
          {enemy.statuses.map((status) => (
            <span key={status.id}>
              {localizedStatusLabel(status.id, language)} · {status.turns}
              {text("턴", " turns")}
            </span>
          ))}
        </div>
      )}
      {enemySkills.length > 0 && (
        <div className="inventory-detail__stats">
          {enemySkills.map(({ rule, skill }) => (
            <span key={skill.id}>
              <strong>{skill.name}</strong> · {skill.description}
              {(rule?.windupTurns ?? 0) > 0 && ` · 시전 ${rule?.windupTurns}턴 전 범위 표시`}
              {rule?.maxUses === 1 && " · 전투당 1회"}
            </span>
          ))}
        </div>
      )}
      <div className="drop-table">
        <div className="drop-table__title">
          <span>{text("드롭 목록", "Drop Table")}</span>
          <small>{text("처치 시 획득 확률", "Drop chance on defeat")}</small>
        </div>
        <ul>
          {ENEMY_DROP_TABLE.map(({ itemId, weight }) => (
            <li key={itemId}>
              <ItemIcon itemId={itemId} size={28} />
              <span>{localizedItemName(itemId, language)}</span>
              <strong>{chanceLabel(ENEMY_DROP_CHANCE * weight)}</strong>
            </li>
          ))}
          <li className="no-drop">
            <span className="no-drop__icon" aria-hidden="true">
              —
            </span>
            <span>{text("드롭 없음", "No drop")}</span>
            <strong>{chanceLabel(1 - ENEMY_DROP_CHANCE)}</strong>
          </li>
        </ul>
      </div>
    </DescriptionWindow>
  );
}

function PlayerInspector({
  game,
  anchor,
  onClose,
}: {
  game: GameState;
  anchor: DescriptionAnchor;
  onClose: () => void;
}) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  const player = game.player;
  const combatStats = effectiveCombatStats(player);
  const definition = characterPresentation(player);
  const profession = COMPANION_PROFESSIONS[player.professionId];
  const equipment = PARTY_LOADOUT_TARGETS.map((target) => [
    target.kind === "equipment"
      ? target.slot === "weapon" ? text("무기", "Weapon") : text("갑옷", "Armor")
      : isPartyQuickslotTarget(target)
        ? text(`퀵슬롯 ${target.index - 1}`, `Quickslot ${target.index - 1}`)
        : text(`패시브 ${target.index + 1}`, `Passive ${target.index + 1}`),
    resolvePlayerLoadoutItem(player, target).itemId,
  ] as const);
  return (
    <DescriptionWindow
      anchor={anchor}
      className="entity-inspector entity-inspector--detailed"
      ariaLabel={text("조작 캐릭터 상세 능력치", "Detailed controlled-character stats")}
      onClose={onClose}
    >
      <header>
        <div className="entity-inspector__identity">
          <PixelSpriteFrame
            file={definition.sprite}
            sheetWidth={definition.sheetWidth}
            frameWidth={definition.frameWidth}
            frameHeight={definition.frameHeight}
            frame={
              definition.animationSet === "companion"
                ? companionFrameIndex(
                    companionArmorTier(playerToCompanion(player)),
                    COMPANION_IDLE_FRAMES[0],
                  )
                : PLAYER_IDLE_FRAMES[0]
            }
            size={48}
          />
          <div>
            <p>{text("조작 캐릭터", "Controlled Character")}</p>
            <h3>{player.name} · {language === "ko" ? profession.nameKo : profession.nameEn} · Lv.{player.level}</h3>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label={text("조사 닫기", "Close inspection")}>×</button>
      </header>
      <div className="entity-stat-grid entity-stat-grid--wide">
        <span><small>{text("생명력", "Health")}</small><strong>{player.hp}/{player.maxHp}</strong></span>
        <span><small>{text("보호막", "Shield")}</small><strong>{player.shield}</strong></span>
        <span><small>{text("허기", "Hunger")}</small><strong>{Math.floor(player.hunger ?? 100)}/100</strong></span>
        <span><small>{text("경험치", "Experience")}</small><strong>{player.xp}/{player.nextXp}</strong></span>
        <span><small>{text("공격력", "Attack")}</small><strong>{getPlayerAttack(player)}</strong></span>
        <span><small>{text("방어력", "Defense")}</small><strong>{getPlayerDefense(player)}</strong></span>
        <span><small>{text("명중", "Accuracy")}</small><strong>{getPlayerAccuracy(player)}</strong></span>
        <span><small>{text("회피", "Evasion")}</small><strong>{getPlayerEvasion(player)}</strong></span>
        <span><small>{text("이동 속도", "Move Speed")}</small><strong>×{getPlayerMoveSpeed(player).toFixed(2)}</strong></span>
        <span><small>{text("공격 속도", "Attack Speed")}</small><strong>×{getPlayerAttackSpeed(player).toFixed(2)}</strong></span>
        <span><small>{text("시야", "Vision")}</small><strong>{getPlayerViewDistance(player)}</strong></span>
        <span><small>{text("턴 진행도", "Turn Progress")}</small><strong>{Math.round(player.actionProgress * 100)}%</strong></span>
        <span><small>{text("치명타 확률", "Critical Chance")}</small><strong>{formatCombatPercent(combatStats.criticalChance)}</strong></span>
        <span><small>{text("치명타 피해", "Critical Damage")}</small><strong>+{formatCombatPercent(combatStats.criticalDamageBonus)} ({text("총", "Total")} {formatCombatPercent(1 + combatStats.criticalDamageBonus)})</strong></span>
        <span><small>{text("피해 흡혈", "Life Steal")}</small><strong>{formatCombatPercent(combatStats.lifeSteal)}</strong></span>
        <span><small>{text("방어 관통", "Armor Penetration")}</small><strong>{formatCombatPercent(combatStats.armorPenetration)}</strong></span>
        <span><small>{text("재사용 대기시간 감소", "Cooldown Reduction")}</small><strong>{formatCombatPercent(combatStats.cooldownReduction)}</strong></span>
        <span><small>{text("상태이상 저항", "Status Resistance")}</small><strong>{formatCombatPercent(combatStats.statusResistance)}</strong></span>
      </div>
      <div className="character-trait-list">
        <small>{text("고유 특성", "Traits")}</small>
        <ul>
          {player.traits.map((traitId) => {
            const trait = COMPANION_TRAITS[traitId];
            return (
              <li key={traitId} style={{ "--trait-accent": trait.accent } as CSSProperties}>
                <strong>{language === "ko" ? trait.nameKo : trait.nameEn}</strong>
                <span>{language === "ko" ? trait.descriptionKo : trait.descriptionEn}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="character-skill-list">
        <small>{text("보유 스킬", "Skills")}</small>
        <ul>
          {player.skills.map((skillId) => {
            const skill = COMPANION_SKILLS[skillId];
            return (
              <li key={skillId} style={{ "--skill-accent": skill.accent } as CSSProperties}>
                <strong>{language === "ko" ? skill.nameKo : skill.nameEn}</strong>
                <span>{language === "ko" ? skill.descriptionKo : skill.descriptionEn}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="entity-loadout">
        <small>{text("장착 장비", "Equipped Gear")}</small>
        <ul>
          {equipment.map(([label, itemId]) => (
            <li key={label}>
              <span>{label}</span>
              <strong>{itemId ? localizedItemName(itemId, language) : text("비어 있음", "Empty")}</strong>
            </li>
          ))}
        </ul>
      </div>
      {(player.statuses ?? []).length > 0 && (
        <div className="entity-status-list">
          {player.statuses.map((status) => (
            <span key={status.id}>{localizedStatusLabel(status.id, language)} · {status.turns}{text("턴", " turns")}</span>
          ))}
        </div>
      )}
    </DescriptionWindow>
  );
}

function CompanionInspector({
  companion,
  anchor,
  onClose,
}: {
  companion: Companion;
  anchor: DescriptionAnchor;
  onClose: () => void;
}) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  const definition = characterPresentation(companion);
  const combatStats = effectiveCombatStats(companion);
  const profession = COMPANION_PROFESSIONS[companion.professionId];
  const displayName =
    language === "en" && companion.name === definition.defaultNameKo
      ? definition.defaultNameEn
      : companion.name;
  const commandLabel =
    companion.command === "follow"
      ? text("조작 캐릭터 추종", "Follow Leader")
      : companion.command === "explore"
        ? text("단독 탐사", "Solo Explore")
        : companion.command === "accompany"
          ? text("동료 동행", "Accompany")
          : text("현재 위치 사수", "Hold Position");
  const loadout = PARTY_LOADOUT_TARGETS.map((target) => [
    target.kind === "equipment"
      ? target.slot === "weapon" ? text("무기", "Weapon") : text("갑옷", "Armor")
      : isPartyQuickslotTarget(target)
        ? text(`퀵슬롯 ${target.index - 1}`, `Quickslot ${target.index - 1}`)
        : text(`패시브 ${target.index + 1}`, `Passive ${target.index + 1}`),
    resolveCompanionLoadoutItem(companion, target).itemId,
  ] as const);
  return (
    <DescriptionWindow
      anchor={anchor}
      className="entity-inspector entity-inspector--detailed"
      ariaLabel={text(`${displayName} 상세 능력치`, `Detailed stats for ${displayName}`)}
      onClose={onClose}
    >
      <header>
        <div className="entity-inspector__identity">
          <PixelSpriteFrame
            file={definition.sprite}
            sheetWidth={definition.sheetWidth}
            frameWidth={definition.frameWidth}
            frameHeight={definition.frameHeight}
            frame={
              definition.animationSet === "companion"
                ? companionFrameIndex(
                    companionArmorTier(companion),
                    COMPANION_IDLE_FRAMES[0],
                  )
                : PLAYER_IDLE_FRAMES[0]
            }
            size={48}
          />
          <div>
            <p>{text("동료 조사", "Companion Scan")}</p>
            <h3>{displayName} · {language === "ko" ? profession.nameKo : profession.nameEn}</h3>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label={text("조사 닫기", "Close inspection")}>×</button>
      </header>
      <div className="entity-command-summary">
        <span>{commandLabel}</span>
        <strong>Lv.{companion.level} · EXP {companion.xp}/{companion.nextXp || "MAX"}</strong>
      </div>
      <div className="entity-stat-grid entity-stat-grid--wide">
        <span><small>{text("생명력", "Health")}</small><strong>{companion.hp}/{companion.maxHp}</strong></span>
        <span><small>{text("경험치", "Experience")}</small><strong>{companion.level >= MAX_PLAYER_LEVEL ? "MAX" : `${companion.xp}/${companion.nextXp}`}</strong></span>
        <span><small>{text("공격력", "Attack")}</small><strong>{getCompanionAttack(companion)}</strong></span>
        <span><small>{text("방어력", "Defense")}</small><strong>{getCompanionDefense(companion)}</strong></span>
        <span><small>{text("명중", "Accuracy")}</small><strong>{getCompanionAccuracy(companion)}</strong></span>
        <span><small>{text("회피", "Evasion")}</small><strong>{getCompanionEvasion(companion)}</strong></span>
        <span><small>{text("이동 속도", "Move Speed")}</small><strong>×{getCompanionMoveSpeed(companion).toFixed(2)}</strong></span>
        <span><small>{text("공격 속도", "Attack Speed")}</small><strong>×{getCompanionAttackSpeed(companion).toFixed(2)}</strong></span>
        <span><small>{text("시야", "Vision")}</small><strong>{getCompanionViewDistance(companion)}</strong></span>
        <span><small>{text("치명타 확률", "Critical Chance")}</small><strong>{formatCombatPercent(combatStats.criticalChance)}</strong></span>
        <span><small>{text("치명타 피해", "Critical Damage")}</small><strong>+{formatCombatPercent(combatStats.criticalDamageBonus)} ({text("총", "Total")} {formatCombatPercent(1 + combatStats.criticalDamageBonus)})</strong></span>
        <span><small>{text("피해 흡혈", "Life Steal")}</small><strong>{formatCombatPercent(combatStats.lifeSteal)}</strong></span>
        <span><small>{text("방어 관통", "Armor Penetration")}</small><strong>{formatCombatPercent(combatStats.armorPenetration)}</strong></span>
        <span><small>{text("재사용 대기시간 감소", "Cooldown Reduction")}</small><strong>{formatCombatPercent(combatStats.cooldownReduction)}</strong></span>
        <span><small>{text("상태이상 저항", "Status Resistance")}</small><strong>{formatCombatPercent(combatStats.statusResistance)}</strong></span>
      </div>
      <div className="character-trait-list">
        <small>{text("고유 특성", "Traits")}</small>
        <ul>
          {companion.traits.map((traitId) => {
            const trait = COMPANION_TRAITS[traitId];
            return (
              <li key={traitId} style={{ "--trait-accent": trait.accent } as CSSProperties}>
                <strong>{language === "ko" ? trait.nameKo : trait.nameEn}</strong>
                <span>{language === "ko" ? trait.descriptionKo : trait.descriptionEn}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="character-skill-list">
        <small>{text("보유 스킬", "Skills")}</small>
        <ul>
          {companion.skills.map((skillId) => {
            const skill = COMPANION_SKILLS[skillId];
            return (
              <li key={skillId} style={{ "--skill-accent": skill.accent } as CSSProperties}>
                <strong>{language === "ko" ? skill.nameKo : skill.nameEn}</strong>
                <span>{language === "ko" ? skill.descriptionKo : skill.descriptionEn}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="entity-loadout">
        <small>{text("동료 장비와 수동 퀵슬롯", "Companion Gear & Manual Quickslots")}</small>
        <ul>
          {loadout.map(([label, itemId]) => (
            <li key={label}>
              <span>{label}</span>
              <strong>{itemId ? localizedItemName(itemId, language) : text("비어 있음", "Empty")}</strong>
            </li>
          ))}
        </ul>
      </div>
    </DescriptionWindow>
  );
}

const formatSkillEffectPercent = (ratio: number) => {
  const percent = Math.round(ratio * 1000) / 10;
  return Number.isInteger(percent) ? `${percent.toFixed(0)}%` : `${percent.toFixed(1)}%`;
};

const companionSkillEffectSummary = (
  skillId: CompanionSkillId,
  level: number,
  language: UiLanguage = "ko",
) => {
  const skill = deriveCompanionSkill(skillId, [
    companionSkillLevelModifier(skillId, level),
  ]);
  const labels: string[] = [];
  if (skill.scalars.power !== undefined) {
    labels.push(
      `${language === "ko" ? "공격력" : "Power"} ${formatSkillEffectPercent(skill.scalars.power)}`,
    );
  }
  if (skill.scalars.secondaryPower !== undefined) {
    labels.push(
      `${language === "ko" ? "추가 위력" : "Secondary"} ${formatSkillEffectPercent(skill.scalars.secondaryPower)}`,
    );
  }
  if (skill.scalars.healRatio !== undefined) {
    labels.push(
      `${language === "ko" ? "회복" : "Healing"} ${formatSkillEffectPercent(skill.scalars.healRatio)}`,
    );
  }
  if (labels.length === 0 && skill.scalars.durationTurns !== undefined) {
    labels.push(
      language === "ko"
        ? `지속 ${skill.scalars.durationTurns}턴`
        : `Duration ${skill.scalars.durationTurns} turns`,
    );
  }
  return labels.join(" · ") || (language === "ko" ? "고정 효과" : "Fixed effect");
};

function SkillDescriptionWindow({
  caster,
  skillId,
  anchor,
  disabled,
  onUse,
  onClose,
}: {
  caster: Player | Companion;
  skillId: CompanionSkillId;
  anchor: DescriptionAnchor;
  disabled: boolean;
  onUse: () => void;
  onClose: () => void;
}) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  const skill = COMPANION_SKILLS[skillId];
  const skillLevel = normalizeCompanionSkillLevel(caster.skillLevels?.[skillId]);
  const cooldown = caster.skillCooldowns[skillId] ?? 0;
  const displayedCooldown = remainingCooldownTurns(cooldown);
  const hasResource = canPaySkillResource(
    caster,
    skill.resourceType,
    skill.resourceCost,
  );
  const resourceLabel = skill.resourceType === "stamina"
    ? text("기력", "Stamina")
    : text("마나", "Mana");
  return (
    <DescriptionWindow
      anchor={anchor}
      className="skill-description-window"
      ariaLabel={text(`${skill.nameKo} 스킬 설명`, `${skill.nameEn} skill details`)}
      onClose={onClose}
      style={{ "--skill-accent": skill.accent } as CSSProperties}
    >
      <header className="description-summary-header">
        <i aria-hidden="true">
          {language === "ko" ? skill.shortKo : skill.shortEn.slice(0, 2)}
        </i>
        <div>
          <small>{caster.name} · {text("수동 스킬", "Manual Skill")}</small>
          <h3>{language === "ko" ? skill.nameKo : skill.nameEn} · Lv.{skillLevel}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label={text("스킬 설명 닫기", "Close skill details")}>×</button>
      </header>
      <div className="description-copy">
        <p>{language === "ko" ? skill.descriptionKo : skill.descriptionEn}</p>
        <dl>
          <div><dt>{text("대상", "Target")}</dt><dd>{skill.target === "ally" ? text("아군", "Ally") : skill.target === "enemy" ? text("적", "Enemy") : text("타일", "Tile")}</dd></div>
          <div><dt>{text("사거리", "Range")}</dt><dd>{skill.range === 0 ? text("자기 칸", "Self") : `${skill.range}`}</dd></div>
          <div className={`skill-resource-cost is-${skill.resourceType}`}><dt>{text("소모", "Cost")}</dt><dd>{resourceLabel} {formatSkillResourceAmount(skill.resourceCost)}</dd></div>
          <div><dt>{text("재사용", "Cooldown")}</dt><dd>{skill.cooldown}{text("턴", " turns")}</dd></div>
          <div><dt>{text("현재 효과", "Current effect")}</dt><dd>{companionSkillEffectSummary(skillId, skillLevel, language)}</dd></div>
          <div><dt>{text("현재", "Current")}</dt><dd>{cooldown > 0 ? text(`${displayedCooldown}턴 남음`, `${displayedCooldown} turns`) : !hasResource ? text(`${resourceLabel} 부족`, `Low ${resourceLabel.toLowerCase()}`) : text("사용 가능", "Ready")}</dd></div>
        </dl>
      </div>
      <footer className="description-window-actions">
        <button type="button" onClick={onClose}>{text("닫기", "Close")}</button>
        <button
          type="button"
          className="is-primary"
          disabled={disabled || cooldown > 0 || !hasResource}
          onClick={onUse}
        >
          {text("스킬 사용", "Use Skill")}
        </button>
      </footer>
    </DescriptionWindow>
  );
}

function EffectDescriptionWindow({
  detail,
  anchor,
  onClose,
}: {
  detail: { label: string; remaining: string; description: string };
  anchor: DescriptionAnchor;
  onClose: () => void;
}) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  return (
    <DescriptionWindow
      anchor={anchor}
      className="effect-description-window"
      ariaLabel={text(`${detail.label} 효과 설명`, `${detail.label} effect details`)}
      onClose={onClose}
    >
      <header className="description-summary-header">
        <i aria-hidden="true">FX</i>
        <div><small>{text("상태 효과", "Status Effect")}</small><h3>{detail.label}</h3></div>
        <button type="button" onClick={onClose} aria-label={text("효과 설명 닫기", "Close effect details")}>×</button>
      </header>
      <div className="description-copy">
        <p>{detail.description}</p>
        <span>{detail.remaining}</span>
      </div>
    </DescriptionWindow>
  );
}

type MapElementInspection = Extract<
  InspectedEntity,
  | { kind: "object" }
  | { kind: "cloud" }
  | { kind: "ward" }
  | { kind: "terrain" }
  | { kind: "unknown" }
>;

function MapElementInspector({
  inspection,
  game,
  onClose,
}: {
  inspection: MapElementInspection;
  game: GameState;
  onClose: () => void;
}) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  let title = text("알 수 없는 요소", "Unknown Element");
  let category = text("지도 요소", "Map Element");
  let description = text(
    "현재 상태에서는 이 요소의 정보를 확인할 수 없습니다.",
    "This element cannot be identified in its current state.",
  );
  let metadata = "";
  let visual: ReactNode = <span className="terrain-description-swatch" data-terrain="unknown" />;

  if (inspection.kind === "unknown") {
    title = text("미탐사 구역", "Unexplored Area");
    category = text("전장의 안개", "Fog of War");
    description = text(
      "아직 원정대가 확인하지 않은 구역입니다. 지형이나 개체 정보는 탐사하기 전까지 공개되지 않습니다.",
      "The party has not explored this area. Terrain and entity details remain hidden until discovery.",
    );
    metadata = `${inspection.x}, ${inspection.y}`;
  } else if (inspection.kind === "terrain") {
    const terrain = game.tiles[inspection.y]?.[inspection.x]?.terrain ?? "wall";
    const details = TERRAIN_DETAILS[terrain];
    title = language === "ko" ? details.nameKo : details.nameEn;
    category = text("지형", "Terrain");
    description = language === "ko" ? details.descriptionKo : details.descriptionEn;
    metadata = `${inspection.x}, ${inspection.y}`;
    visual = <span className="terrain-description-swatch" data-terrain={terrain} />;
  } else if (inspection.kind === "object") {
    const object = game.objects.find((candidate) => candidate.id === inspection.id);
    if (object) {
      const definition = OBJECT_SPRITES[object.kind];
      const details = OBJECT_DETAILS[object.kind];
      title = language === "ko" ? definition.label : humanizeId(object.kind);
      category = text("상호작용 구조물", "Interactive Object");
      description = language === "ko" ? details.descriptionKo : details.descriptionEn;
      metadata = text(
        `${object.loot.length}개 보관 · ${object.x}, ${object.y}`,
        `${object.loot.length} stored · ${object.x}, ${object.y}`,
      );
      visual = <DungeonObjectIcon kind={object.kind} />;
    }
  } else if (inspection.kind === "cloud") {
    const cloud = game.clouds.find((candidate) => candidate.id === inspection.id);
    if (cloud) {
      const details = CLOUD_DETAILS[cloud.kind];
      const tile = cloud.tiles.find(
        (candidate) => candidate.x === inspection.x && candidate.y === inspection.y,
      );
      title = language === "ko" ? details.nameKo : details.nameEn;
      category = text("장판·가스", "Field Effect");
      description = language === "ko" ? details.descriptionKo : details.descriptionEn;
      metadata = text(
        `${tile?.remaining ?? cloud.turns}턴 · 강도 ${Math.round((tile?.intensity ?? 1) * 100)}%`,
        `${tile?.remaining ?? cloud.turns} turns · ${Math.round((tile?.intensity ?? 1) * 100)}% intensity`,
      );
      visual = <span className="field-description-swatch" data-cloud={cloud.kind} />;
    }
  } else if (inspection.kind === "ward") {
    const ward = game.wards.find((candidate) => candidate.id === inspection.id);
    if (ward) {
      title = text("마법 감시진", "Magic Ward");
      category = text("소환 구조물", "Summoned Object");
      description = text(
        "접근한 적을 자동으로 공격하는 마법진입니다. 남은 시간이 다하면 사라집니다.",
        "A magical ward that automatically attacks approaching enemies until its duration expires.",
      );
      metadata = text(`${ward.turns}턴 · 위력 ${ward.power}`, `${ward.turns} turns · Power ${ward.power}`);
      visual = <span className="ward-description-swatch">◇</span>;
    }
  }

  return (
    <DescriptionWindow
      anchor={inspection.anchor}
      className="map-element-inspector"
      ariaLabel={text(`${title} 설명`, `${title} details`)}
      onClose={onClose}
    >
      <header className="description-summary-header">
        {visual}
        <div><small>{category}</small><h3>{title}</h3></div>
        <button type="button" onClick={onClose} aria-label={text("설명 닫기", "Close details")}>×</button>
      </header>
      <div className="description-copy">
        <p>{description}</p>
        {metadata && <span>{metadata}</span>}
      </div>
    </DescriptionWindow>
  );
}

function ItemDetailModal({
  game,
  selected,
  preview = null,
  readOnly = false,
  onClose,
  onUse,
  onEquip,
  onUnequip,
  onUnassignCompanion,
  onThrow,
  onDiscard,
  onEnchant,
  busy,
}: {
  game: GameState | null;
  selected: InventorySelection;
  preview?: ItemDetailPreview | null;
  readOnly?: boolean;
  onClose: () => void;
  onUse?: (itemRef: string) => void;
  onEquip?: (itemRef: string) => void;
  onUnequip?: (target: PlayerLoadoutSelection) => void;
  onUnassignCompanion?: (selection: CompanionLoadoutSelection) => void;
  onThrow?: (itemRef: string) => void;
  onDiscard?: (itemRef: string) => void;
  onEnchant?: (selected: InventorySelection) => void;
  busy?: boolean;
}) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  const itemId = preview?.itemId ?? selected.itemId;
  const definition = ITEM_DEFS[itemId];
  const playerLoadoutEntry = !preview && game && selected.playerLoadout
    ? resolvePlayerLoadoutItem(game.player, selected.playerLoadout)
    : null;
  const selectedCompanion = !preview && game && selected.companionLoadout
    ? game.companions.find(
        (companion) => companion.id === selected.companionLoadout!.companionId,
      ) ?? null
    : null;
  const companionTarget = selected.companionLoadout?.target ?? null;
  const companionLoadoutEntry = selectedCompanion && companionTarget
    ? resolveCompanionLoadoutItem(
        selectedCompanion,
        companionTarget,
        game?.player,
      )
    : null;
  const inventoryInstance = !preview && game
    ? game.player.inventoryInstances.find(
        (candidate) => candidate.id === selected.itemRef,
      ) ?? null
    : null;
  const instance = preview
    ? preview.instance
    : selected.companionLoadout
    ? companionLoadoutEntry?.instance ?? null
    : selected.playerLoadout
      ? playerLoadoutEntry?.instance ?? null
      : game
        ? inventoryItemProfile(game.player, selected.itemRef)
        : null;
  const quantity = preview
    ? preview.quantity
    : selected.companionLoadout
    ? companionLoadoutEntry?.quantity ?? 0
    : selected.playerLoadout
      ? playerLoadoutEntry?.quantity ?? 0
      : inventoryInstance
        ? 1
        : game?.player.inventory[selected.itemId] ?? 0;
  if (!definition || (!preview && quantity <= 0)) return null;

  const usable = isDirectlyUsableItem(definition);
  const directLoadoutEquip = Boolean(
    definition.slot || definition.category === "missile",
  );
  const upgradeable = isUpgradeableEquipment(definition);
  const profile = upgradeable
    ? equipmentStatProfile(definition, instance)
    : null;
  const traits = equipmentTraitSummary(instance);
  const statGauges = profile
    ? [
        {
          label: text("공격", "Attack"),
          value: profile.attack,
          maximum: 12,
          color: "#df815e",
        },
        {
          label: text("방어", "Defense"),
          value: profile.defense,
          maximum: 12,
          color: "#71a9d0",
        },
        {
          label: text("마력", "Magic"),
          value: profile.magic,
          maximum: 12,
          color: "#b98ce2",
        },
        {
          label: text("속도", "Speed"),
          value: profile.speed,
          maximum: 8,
          color: "#78c990",
        },
      ]
    : [];
  const canEnchant =
    Boolean(game) &&
    !selected.companionLoadout &&
    upgradeable &&
    Boolean(instance) &&
    hasEnchantingMaterial(game!.player);

  return (
    <DescriptionWindow
      anchor={preview?.anchor ?? selected.anchor}
      className="item-detail-modal"
      labelledBy="item-detail-title"
      onClose={onClose}
    >
        <header className="item-detail-header">
          <div
            className="item-detail-art"
            style={{ "--item-accent": definition.accent } as CSSProperties}
          >
            <ItemIcon itemId={definition.id} size={72} />
          </div>
          <div>
            <small>
              {language === "ko"
                ? ITEM_CATEGORY_NAMES[definition.category]
                : ITEM_CATEGORY_NAMES_EN[definition.category]}
              {preview?.contextLabel
                ? ` · ${preview.contextLabel}`
                : selected.playerLoadout || selected.companionLoadout
                ? selected.companionLoadout
                  ? text(" · 동료 장착 중", " · Companion equipped")
                  : text(" · 장착 중", " · Equipped")
                : text(` · ${quantity}개`, ` · ${quantity}`)}
            </small>
            <h2 id="item-detail-title">
              {localizedItemName(definition.id, language)}
              {profile?.upgradeLevel
                ? ` +${profile.upgradeLevel}`
                : ""}
            </h2>
            {instance && (
              <span
                className="item-detail-grade"
                data-item-grade={profile?.grade}
              >
                {text("개별 장비", "Individual gear")} · {profile?.grade ?? "C"}
                {text("급", " grade")}
                {instance.cursed
                  ? text(" · 저주받음", " · Cursed")
                  : ""}
              </span>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={text("아이템 설명 닫기", "Close item details")}
          >
            ×
          </button>
        </header>

        <div className="item-detail-content">
          <section className="item-detail-description">
            <small>{text("설명", "Description")}</small>
            <p>{localizedItemDescription(itemId, language)}</p>
            {instance?.cursed && (
              <p className="item-curse-warning">
                {text(
                  "저주받은 장비입니다. 장착하면 저주 해제의 주문서를 사용하기 전까지 해제하거나 교체할 수 없습니다.",
                  "Cursed equipment cannot be removed or replaced after equipping until a Remove Curse scroll is used.",
                )}
              </p>
            )}
            {isWand(itemId) && (
              <span>
                {text("충전", "Charges")}{" "}
                {instance?.charges ?? selected.charges ?? 3}/
                {instance?.maxCharges ?? selected.maxCharges ?? 3}
                {" · "}
                {text("다음 충전", "Next charge")} {Math.max(
                  0,
                  50 - (instance?.rechargeProgress ?? 0),
                )}
                {text("턴", " turns")}
              </span>
            )}
            {definition.category === "missile" && instance && (
              <span>
                {text("충전", "Charges")} {instance.charges ?? 0}/
                {instance.maxCharges ?? 0}
                {" · "}
                {text("내구도", "Durability")} {instance.durability ?? 10}/
                {instance.maxDurability ?? 10}
              </span>
            )}
          </section>

          {profile && (
            <section
              className="item-stat-panel"
              aria-label={text("장비 능력치", "Equipment statistics")}
            >
              <div className="item-stat-panel__title">
                <span>{text("아이템 능력치", "Item Statistics")}</span>
                <small>
                  {text(
                    "기본 수치는 등급마다 20% 상승하며 강화와 인챈트는 별도로 적용됩니다.",
                    "Base stats rise 20% per grade; upgrades and enchantments apply separately.",
                  )}
                </small>
              </div>
              <div className="item-stat-gauges">
                {statGauges.map(({ label, value, maximum, color }) => (
                  <div className="item-stat-gauge" key={label}>
                    <span>{label}</span>
                    <div>
                      <i
                        style={
                          {
                            width: `${Math.min(100, Math.max(0, value / maximum) * 100)}%`,
                            "--stat-color": color,
                          } as CSSProperties
                        }
                      />
                    </div>
                    <b>{value.toFixed(value % 1 ? 1 : 0)}</b>
                  </div>
                ))}
              </div>
            </section>
          )}

          {upgradeable && (
            <section className="item-trait-panel">
              <div>
                <span>{text("인챈트", "Enchantments")}</span>
                <small>
                  {text(
                    "특성은 같은 종류가 아닌 이 장비 개체에만 저장됩니다.",
                    "Traits are stored only on this equipment instance.",
                  )}
                </small>
              </div>
              <ul>
                {traits.length ? (
                  traits.map((trait, index) => (
                    <li
                      key={`${trait.id}-${trait.grade}-${index}`}
                      data-enchantment-grade={trait.grade}
                      style={
                        { "--trait-accent": trait.gradeColor } as CSSProperties
                      }
                    >
                      <strong>
                        <em>{trait.grade}</em>{" "}
                        {language === "ko" ? trait.name : trait.nameEn}
                      </strong>
                      <span>
                        {language === "ko"
                          ? trait.description
                          : trait.descriptionEn}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="is-empty">
                    <strong>
                      {text("부여된 특성 없음", "No traits enchanted")}
                    </strong>
                    <span>
                      {text(
                        "인챈트 재료로 새로운 특성을 추가할 수 있습니다.",
                        "Use enchanting material to add a new trait.",
                      )}
                    </span>
                  </li>
                )}
              </ul>
            </section>
          )}
        </div>

        <footer className="item-detail-actions">
          {!readOnly && upgradeable && !selected.companionLoadout && game && (
            <div className="enchant-action-copy">
              <span>
                {hasEnchantingMaterial(game.player)
                  ? text("인챈트 재료 보유 · 1턴", "Material ready · 1 turn")
                  : text(
                      "마법 부여의 돌·주문서·신비한 바늘 필요",
                      "Requires an enchantment stone, scroll, or arcane stylus",
                    )}
              </span>
              <button
                type="button"
                className="item-action is-enchant"
                disabled={busy || !canEnchant}
                onClick={() => onEnchant?.(selected)}
              >
                {text("특성 인챈트", "Enchant Trait")}
              </button>
            </div>
          )}
          <div>
            {!readOnly && selected.companionLoadout ? (
              <button
                type="button"
                className="item-action is-primary"
                disabled={busy || Boolean(instance?.cursed)}
                onClick={() => onUnassignCompanion?.(selected.companionLoadout!)}
              >
                {instance?.cursed
                  ? text("저주로 회수 불가", "Locked by Curse")
                  : text("동료에게서 회수", "Remove from Companion")}
              </button>
            ) : !readOnly && selected.playerLoadout ? (
              <button
                type="button"
                className="item-action is-primary"
                disabled={busy || Boolean(instance?.cursed)}
                onClick={() => onUnequip?.(selected.playerLoadout!)}
              >
                {instance?.cursed
                  ? text("저주로 해제 불가", "Locked by Curse")
                  : text("장비 해제", "Unequip")}
              </button>
            ) : readOnly && usable && onUse ? (
              <button
                type="button"
                className="item-action is-primary"
                disabled={busy}
                onClick={() => onUse(selected.itemRef)}
              >
                {text("사용", "Use")}
              </button>
            ) : !readOnly ? (
              <>
                <button
                  type="button"
                  className="item-action is-primary"
                  disabled={busy || (!directLoadoutEquip && !usable)}
                  onClick={() =>
                    directLoadoutEquip
                      ? onEquip?.(selected.itemRef)
                      : onUse?.(selected.itemRef)
                  }
                >
                  {directLoadoutEquip
                    ? text("장비칸 선택", "Choose Slot")
                    : usable
                      ? text("사용 확인", "Use")
                      : text("사용 불가", "Cannot use")}
                </button>
                <button
                  type="button"
                  className="item-action"
                  disabled={busy}
                  onClick={() => onThrow?.(selected.itemRef)}
                >
                  {text("던지기", "Throw")}
                </button>
                <button
                  type="button"
                  className="item-action is-danger"
                  disabled={busy}
                  onClick={() => onDiscard?.(selected.itemRef)}
                >
                  {text("버리기", "Discard")}
                </button>
              </>
            ) : null}
            <button type="button" className="item-action" onClick={onClose}>
              {readOnly ? text("닫기", "Close") : text("취소", "Cancel")}
            </button>
          </div>
        </footer>
    </DescriptionWindow>
  );
}

function PersistentInventory({
  game,
  selected,
  onSelect,
  onFastUse,
  onFastEquip,
  pendingLoadoutItemRef,
  upgradeMode,
  canTargetEquipment,
  onUpgradeItem,
  companionTarget,
  playerTarget,
  onCompanionItem,
  onPlayerItem,
  onCancelPicker,
  upgradeFlashKey,
}: {
  game: GameState;
  selected: InventorySelection | null;
  onSelect: (selected: InventorySelection) => void;
  onFastUse: (itemRef: string) => void;
  onFastEquip: (itemRef: string) => void;
  pendingLoadoutItemRef: string | null;
  upgradeMode: boolean;
  canTargetEquipment: (itemId: string, instance: InventoryInstance) => boolean;
  onUpgradeItem: (itemRef: string) => void;
  companionTarget: CompanionLoadoutSelection | null;
  playerTarget: PlayerLoadoutSelection | null;
  onCompanionItem: (
    selection: CompanionLoadoutSelection,
    itemRef: string,
  ) => void;
  onPlayerItem: (
    selection: PlayerLoadoutSelection,
    itemRef: string,
  ) => void;
  onCancelPicker: () => void;
  upgradeFlashKey: string | null;
}) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const pendingActivationRef = useRef<{
    itemRef: string;
    timer: number;
  } | null>(null);
  useEffect(
    () => () => {
      if (pendingActivationRef.current) {
        window.clearTimeout(pendingActivationRef.current.timer);
      }
    },
    [],
  );
  const openOrFastUse = useCallback(
    (
      selection: InventorySelection,
      fastAction: "use" | "equip" | null,
    ) => {
      const pending = pendingActivationRef.current;
      if (pending?.itemRef === selection.itemRef && fastAction) {
        window.clearTimeout(pending.timer);
        pendingActivationRef.current = null;
        if (fastAction === "use") onFastUse(selection.itemRef);
        else onFastEquip(selection.itemRef);
        return;
      }
      if (pending) {
        window.clearTimeout(pending.timer);
        pendingActivationRef.current = null;
      }
      if (!fastAction) {
        onSelect(selection);
        return;
      }
      const timer = window.setTimeout(() => {
        pendingActivationRef.current = null;
        onSelect(selection);
      }, 240);
      pendingActivationRef.current = { itemRef: selection.itemRef, timer };
    },
    [onFastEquip, onFastUse, onSelect],
  );
  const allOwned = useMemo(
    () => {
      const autoSlotItemRefs = new Set(
        (game.player.autoSlots ?? []).filter(
          (itemRef): itemRef is string => Boolean(itemRef),
        ),
      );
      const stacked = Object.entries(game.player.inventory)
        .filter(([, quantity]) => quantity > 0)
        .map(([itemId, quantity]) => {
          const profile = game.player.throwableProfiles?.[itemId];
          return {
            definition: ITEM_DEFS[itemId],
            itemId,
            itemRef: itemId,
            quantity,
            instance: profile ?? null,
            charges: undefined,
            maxCharges: undefined,
          };
        });
      const individual = (game.player.inventoryInstances ?? [])
        .filter((instance) => !autoSlotItemRefs.has(instance.id))
        .map((instance) => ({
          definition: ITEM_DEFS[instance.defId],
          itemId: instance.defId,
          itemRef: instance.id,
          quantity: 1,
          instance,
          charges: instance.charges,
          maxCharges: instance.maxCharges,
        }),
      );
      return [...stacked, ...individual].filter(({ definition }) => definition);
    },
    [
      game.player.inventory,
      game.player.inventoryInstances,
      game.player.autoSlots,
      game.player.throwableProfiles,
    ],
  );
  const ownedByRef = useMemo(
    () => new Map(allOwned.map((entry) => [entry.itemRef, entry])),
    [allOwned],
  );
  const visibleRefs = useMemo(
    () =>
      new Set(
        allOwned
          .filter(({ definition }) => {
            if (filter === "all") return true;
            if (filter === "equipment") return isUpgradeableEquipment(definition);
            if (filter === "magic") return ["wand", "artifact"].includes(definition.category);
            if (filter === "throwable") return ["missile", "bomb"].includes(definition.category);
            if (filter === "alchemy") return ["brew", "elixir"].includes(definition.category);
            if (filter === "nature") return ["seed", "stone"].includes(definition.category);
            if (filter === "other") return ["food", "misc", "key"].includes(definition.category);
            return definition.category === filter;
          })
          .map(({ itemRef }) => itemRef),
      ),
    [allOwned, filter],
  );
  const inventorySlots = normalizePlayerInventorySlots(game.player);
  const occupiedSlots = inventorySlotCount(game.player);
  const slotDrag = useActiveItemSlotDrag();

  return (
    <section
      id="persistent-inventory"
      className={
        [
          "persistent-inventory",
          pendingLoadoutItemRef ? "is-loadout-picking" : "",
          upgradeMode ? "is-upgrade-picking" : "",
          companionTarget ? "is-companion-picking" : "",
          playerTarget ? "is-companion-picking" : "",
        ].filter(Boolean).join(" ")
      }
      aria-label={text("항상 표시되는 인벤토리", "Persistent inventory")}
    >
      <header className="persistent-inventory__header">
        <div>
          <strong>
            {upgradeMode
              ? text("주문서를 적용할 장비 선택", "Choose Equipment for the Scroll")
              : pendingLoadoutItemRef
                ? text("장착할 6칸 장비 위치 선택", "Choose a Six-slot Loadout Position")
              : companionTarget
                ? text("동료에게 줄 아이템 선택", "Select Companion Item")
                : playerTarget
                  ? text("장착할 아이템 선택", "Select Equipment")
                : text("인벤토리", "Inventory")}
          </strong>
        </div>
        {upgradeMode || pendingLoadoutItemRef || companionTarget || playerTarget ? (
          <button
            type="button"
            className="persistent-inventory__cancel"
            onClick={onCancelPicker}
          >
            {text("취소", "Cancel")}
          </button>
        ) : (
          <span>
            {occupiedSlots}/{MAX_INVENTORY_SLOTS}
          </span>
        )}
      </header>

      <label className="persistent-inventory__filter">
        <span>{text("분류", "Filter")}</span>
        <select
          value={filter}
          onChange={(event) =>
            setFilter(event.target.value as InventoryFilter)
          }
        >
          {(Object.keys(CATEGORY_LABELS) as InventoryFilter[]).map((key) => (
            <option value={key} key={key}>
              {language === "ko"
                ? CATEGORY_LABELS[key]
                : INVENTORY_FILTER_LABELS_EN[key]}
            </option>
          ))}
        </select>
      </label>

      <div
        className="persistent-inventory__grid"
        aria-label={text(
          `${MAX_INVENTORY_SLOTS}칸 가방 아이템`,
          `${MAX_INVENTORY_SLOTS}-slot inventory`,
        )}
      >
        {inventorySlots.map((slotRef, slotIndex) => {
          const address: ItemSlotAddress = {
            zone: "dungeonInventory",
            index: slotIndex,
          };
          const entry = slotRef ? ownedByRef.get(slotRef) : null;
          if (!entry) {
            return (
              <div
                className="inventory-empty-slot"
                key={`inventory-slot-${slotIndex}`}
                aria-label={text("빈 인벤토리 칸", "Empty inventory slot")}
                {...(slotDrag?.addressAttributes(address, null) ?? {})}
              />
            );
          }
          const {
            definition,
            itemId,
            itemRef,
            quantity,
            instance,
            charges,
            maxCharges,
          } = entry;
          const canUpgrade = Boolean(
            instance && canTargetEquipment(itemId, instance),
          );
          const canCompanionEquip =
            companionTarget !== null &&
            canAssignCompanionItem(
              game,
              itemRef,
              companionTarget.target,
            );
          const canPlayerEquip =
            playerTarget !== null &&
            canAssignPlayerItem(game, itemRef, playerTarget);
          return (
            <button
              type="button"
              className={
                [
                  "inventory-item-icon",
                  selected?.itemRef === itemRef &&
                  !selected.playerLoadout
                    ? "is-selected"
                    : "",
                  pendingLoadoutItemRef === itemRef ? "is-loadout-source" : "",
                  upgradeFlashKey === `inventory:${itemRef}`
                    ? "is-upgrade-flashing"
                    : "",
                  upgradeMode
                    ? canUpgrade ? "is-companion-choice" : "is-picker-disabled"
                    : "",
                  companionTarget !== null
                    ? canCompanionEquip
                      ? "is-companion-choice"
                      : "is-picker-disabled"
                    : "",
                  playerTarget !== null
                    ? canPlayerEquip
                      ? "is-companion-choice"
                      : "is-picker-disabled"
                    : "",
                  visibleRefs.has(itemRef) ? "" : "is-filtered-out",
                  slotDrag?.heldAddressKey === itemSlotAddressKey(address)
                    ? "is-drag-source"
                    : "",
                ].filter(Boolean).join(" ")
              }
              key={`inventory-slot-${slotIndex}`}
              disabled={
                Boolean(pendingLoadoutItemRef) ||
                (upgradeMode && !canUpgrade) ||
                (companionTarget !== null && !canCompanionEquip) ||
                (playerTarget !== null && !canPlayerEquip)
              }
              onClick={(event) => {
                if (upgradeMode && canUpgrade) {
                  onUpgradeItem(itemRef);
                  return;
                }
                if (companionTarget && canCompanionEquip) {
                  onCompanionItem(companionTarget, itemRef);
                  return;
                }
                if (playerTarget && canPlayerEquip) {
                  onPlayerItem(playerTarget, itemRef);
                  return;
                }
                openOrFastUse(
                  {
                    itemId,
                    itemRef,
                    charges,
                    maxCharges,
                    anchor: descriptionAnchorFromElement(event.currentTarget),
                  },
                  isWand(itemId) || isDirectlyUsableItem(definition)
                    ? "use"
                    : definition.slot || definition.category === "missile"
                      ? "equip"
                      : null,
                );
              }}
              aria-label={
                isWand(itemId)
                  ? text(
                      `${definition.name} 충전 ${charges ?? 3}/${maxCharges ?? 3}`,
                      `${localizedItemName(itemId, language)} charges ${charges ?? 3}/${maxCharges ?? 3}`,
                    )
                  : text(
                      `${definition.name} ${quantity}개 상세 보기`,
                      `View ${localizedItemName(itemId, language)}, quantity ${quantity}`,
                    )
              }
              style={{ "--item-accent": definition.accent } as CSSProperties}
              {...(slotDrag?.addressAttributes(address, {
                itemRef,
                itemId,
                quantity,
                upgradeLevel: instance?.upgradeLevel,
                charges,
                maxCharges,
              }) ?? {})}
            >
              <ItemSlotContents
                itemId={itemId}
                size={40}
                instance={instance}
                quantity={quantity}
                showQuantity={!definition.slot}
              />
            </button>
          );
        })}
      </div>

      <footer>
        {upgradeMode
          ? text(
              "주문서를 적용할 수 있는 강조된 장비를 선택합니다.",
              "Choose highlighted equipment that can receive this scroll.",
            )
          : pendingLoadoutItemRef
            ? text(
                "플레이어나 동료 탭을 고른 뒤 강조된 장비칸을 선택합니다.",
                "Choose the player or a companion, then select a highlighted slot.",
              )
          : companionTarget
          ? text(
              "강조된 아이템을 선택하면 동료 슬롯으로 옮깁니다.",
              "Choose a highlighted item to move it into the companion slot.",
            )
            : text(
                "한 번 클릭하면 설명, 두 번 클릭하면 사용·장착합니다. 길게 누르면 아이템을 다른 칸으로 옮길 수 있습니다.",
                "Click for details, double-click to use or equip, or hold to drag the item to another slot.",
              )}
      </footer>
    </section>
  );
}

function AlchemyModal({
  game,
  busy,
  onBrew,
  onClose,
}: {
  game: GameState;
  busy: boolean;
  onBrew: (itemRefs: string[]) => void;
  onClose: () => void;
}) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const owned = useMemo(() => {
    const slotted = new Set(
      game.player.autoSlots.filter(
        (itemRef): itemRef is string => Boolean(itemRef),
      ),
    );
    const stacked = Object.entries(game.player.inventory)
      .filter(
        ([itemId, quantity]) =>
          quantity > 0 && ITEM_DEFS[itemId] && !slotted.has(itemId),
      )
      .map(([itemId, quantity]) => ({
        itemId,
        itemRef: itemId,
        quantity,
        instance: game.player.throwableProfiles?.[itemId] ?? null,
      }));
    const individual = game.player.inventoryInstances
      .filter((instance) => !slotted.has(instance.id))
      .map((instance) => ({
        itemId: instance.defId,
        itemRef: instance.id,
        quantity: 1,
        instance,
      }));
    return [...stacked, ...individual].filter(
      ({ itemId }) => ITEM_DEFS[itemId]?.category !== "key",
    );
  }, [
    game.player.inventory,
    game.player.inventoryInstances,
    game.player.autoSlots,
    game.player.throwableProfiles,
  ]);
  const formula = previewAlchemy(game, selectedRefs);
  const selectedCount = (itemRef: string) =>
    selectedRefs.filter((candidate) => candidate === itemRef).length;
  const addIngredient = (itemRef: string, quantity: number) => {
    if (
      busy ||
      selectedRefs.length >= 3 ||
      selectedCount(itemRef) >= quantity
    ) return;
    setSelectedRefs((current) => [...current, itemRef]);
  };
  const removeIngredient = (index: number) => {
    setSelectedRefs((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };
  const formulaLabel = formula?.kind === "item"
    ? text(
        `${ITEM_DEFS[formula.outputDefId].name} 제작`,
        `Create ${localizedItemName(formula.outputDefId, language)}`,
      )
    : formula?.kind === "enchant"
      ? text(
          formula.upgrade ? "장비 강화 + 무작위 인챈트" : "무작위 인챈트 부여",
          formula.upgrade ? "Upgrade + random enchantment" : "Apply a random enchantment",
        )
      : text("알려진 조합이 아닙니다", "No known combination");

  return (
    <div className="modal-backdrop alchemy-backdrop" role="presentation">
      <section className="alchemy-modal" role="dialog" aria-modal="true">
        <header className="modal-header">
          <div>
            <h2>{text("연금술 작업대", "Alchemy Workbench")}</h2>
            <p>{text("재료 2~3개를 골라 간단히 합성합니다.", "Combine two or three ingredients.")}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>×</button>
        </header>
        <div className="alchemy-selection" aria-label={text("선택한 재료", "Selected ingredients")}>
          {[0, 1, 2].map((index) => {
            const itemRef = selectedRefs[index];
            const entry = itemRef
              ? owned.find((candidate) => candidate.itemRef === itemRef)
              : null;
            return itemRef && entry ? (
              <button type="button" key={`${itemRef}-${index}`} onClick={() => removeIngredient(index)}>
                <ItemSlotContents itemId={entry.itemId} size={38} instance={entry.instance} quantity={1} />
                <small>{text("빼기", "Remove")}</small>
              </button>
            ) : <span key={`alchemy-empty-${index}`}>+</span>;
          })}
        </div>
        <div className="alchemy-result" data-valid={Boolean(formula)}>
          <small>{text("예상 결과", "Expected result")}</small>
          <strong>{formulaLabel}</strong>
        </div>
        <div className="alchemy-inventory">
          {owned.map((entry) => {
            const count = selectedCount(entry.itemRef);
            const definition = ITEM_DEFS[entry.itemId];
            return (
              <button
                type="button"
                key={entry.itemRef}
                disabled={busy || selectedRefs.length >= 3 || count >= entry.quantity}
                onClick={() => addIngredient(entry.itemRef, entry.quantity)}
                title={localizedItemName(entry.itemId, language)}
              >
                <ItemSlotContents
                  itemId={entry.itemId}
                  size={36}
                  instance={entry.instance}
                  quantity={entry.quantity}
                  showQuantity={entry.quantity > 1}
                />
                {count > 0 && <b>{text(`선택 ${count}`, `Selected ${count}`)}</b>}
                <small>{localizedItemName(entry.itemId, language)}</small>
                <i style={{ background: definition.accent }} />
              </button>
            );
          })}
        </div>
        <footer>
          <p>{text(
            "같은 재료를 여러 번 누를 수 있습니다. 장비와 마법 촉매를 섞으면 인챈트됩니다.",
            "You can choose stacked ingredients repeatedly. Equipment plus magic catalysts creates an enchantment.",
          )}</p>
          <button type="button" onClick={onClose}>{text("닫기", "Close")}</button>
          <button
            type="button"
            className="is-primary"
            disabled={busy || !formula}
            onClick={() => onBrew(selectedRefs)}
          >
            {text("연금하기 · 1턴", "Transmute · 1 turn")}
          </button>
        </footer>
      </section>
    </div>
  );
}

function QuestInteractionModal({
  game,
  questId,
  onAccept,
  onClaim,
  onClose,
}: {
  game: GameState;
  questId: string;
  onAccept: (questId: string) => void;
  onClaim: (questId: string) => void;
  onClose: () => void;
}) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  const definition = questDefinition(questId);
  const quest = (game.quests ?? []).find(
    (candidate) => candidate.questId === questId,
  );
  if (!definition || !quest) return null;
  const title = language === "ko" ? definition.titleKo : definition.titleEn;
  const npcName = language === "ko"
    ? definition.npcNameKo
    : definition.npcNameEn;
  const description = language === "ko"
    ? definition.descriptionKo
    : definition.descriptionEn;
  const objective = language === "ko"
    ? definition.objectiveKo
    : definition.objectiveEn;
  const reward = ITEM_DEFS[definition.rewardItemId];
  const statusLabel = quest.status === "available"
    ? text("제안", "Offer")
    : quest.status === "active"
      ? text("진행 중", "Active")
      : quest.status === "readyToTurnIn"
        ? text("보고 가능", "Ready")
        : text("완료", "Completed");

  return (
    <div className="modal-backdrop quest-backdrop" role="presentation">
      <section
        className="quest-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quest-dialog-title"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">QUEST · {statusLabel}</p>
            <h2 id="quest-dialog-title">{title}</h2>
            <small>{npcName}</small>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>×</button>
        </header>
        <p>{description}</p>
        <div className="quest-objective">
          <small>{text("목표", "Objective")}</small>
          <strong>{objective}</strong>
          <span>{quest.progress}/{quest.required}</span>
        </div>
        <div className="quest-reward">
          <ItemIcon itemId={definition.rewardItemId} size={34} />
          <span>
            <small>{text("보상", "Reward")}</small>
            <strong>{localizedItemName(definition.rewardItemId, language)} ×{definition.rewardQuantity}</strong>
          </span>
          <i style={{ background: reward.accent }} />
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            {quest.status === "active"
              ? text("계속 진행", "Continue")
              : text("닫기", "Close")}
          </button>
          {quest.status === "available" && (
            <button type="button" className="is-primary" onClick={() => onAccept(questId)}>
              {text("퀘스트 수락", "Accept Quest")}
            </button>
          )}
          {quest.status === "readyToTurnIn" && (
            <button type="button" className="is-primary" onClick={() => onClaim(questId)}>
              {text("보고하고 보상 받기", "Turn In & Claim")}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="help-title">{text("탐사 안내", "Field Guide")}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={text("도움말 닫기", "Close help")}
          >
            ×
          </button>
        </header>

        <div className="help-content">
          <div className="help-section">
            <h3>{text("조작", "Controls")}</h3>
            <dl className="controls-list">
              <div>
                <dt>
                  <kbd>WASD</kbd> / <kbd>{text("방향키", "Arrow keys")}</kbd>
                </dt>
                <dd>{text("상하좌우 이동", "Move in four directions")}</dd>
              </div>
              <div>
                <dt>
                  <kbd>Q E Z C</kbd>
                </dt>
                <dd>{text("대각선 이동", "Move diagonally")}</dd>
              </div>
              <div>
                <dt>{text("지도 클릭", "Map click")}</dt>
                <dd>{text("발견한 칸까지 자동 이동", "Travel to a discovered tile")}</dd>
              </div>
              <div>
                <dt>{text("동료 스킬 → 지도 클릭", "Companion skill → map click")}</dt>
                <dd>{text("선택한 동료가 타일·적·원정대원을 향해 수동 스킬 사용", "Use the selected party member's skill on a tile, enemy, or ally")}</dd>
              </div>
              <div>
                <dt>{text("지도 드래그", "Map drag")}</dt>
                <dd>{text("카메라 이동", "Move the camera")}</dd>
              </div>
              <div>
                <dt>{text("마우스 휠 / 두 손가락", "Mouse wheel / pinch")}</dt>
                <dd>
                  {text(
                    "지도 확대·축소 · 두 손가락 중심 유지",
                    "Zoom the map around the pointer or pinch center",
                  )}
                </dd>
              </div>
              <div>
                <dt>{text("돋보기 → 지도 요소 클릭", "Inspect → map element")}</dt>
                <dd>{text("개체·아이템·구조물·장판·지형 설명", "Inspect entities, items, objects, fields, and terrain")}</dd>
              </div>
              <div>
                <dt>
                  <kbd>.</kbd>
                </dt>
                <dd>{text("한 턴 기다리기", "Wait one turn")}</dd>
              </div>
              <div>
                <dt>
                  <kbd>I</kbd>
                </dt>
                <dd>
                  {text(
                    "항상 표시된 인벤토리로 화면 이동",
                    "Scroll to the persistent inventory",
                  )}
                </dd>
              </div>
            </dl>
          </div>
          <div className="help-section">
            <h3>{text("규칙", "Rules")}</h3>
            {language === "ko" ? (
              <>
                <p>
                  한 칸 이동하거나 공격·아이템 사용·장비 교체를 하면 적도 한 번
                  행동합니다. 적이 있는 칸으로 이동하면 근접 공격합니다. 잠긴 문은
                  반드시 같은 층의 쇠열쇠가 있어야 열립니다.
                </p>
                <p>
                  새로 생성된 적은 잠든 상태입니다. 조작 캐릭터가 적의 시야 안에
                  들어오면 가까울수록 깨어날 확률이 높아지며, 깨어난 턴에는
                  공격하거나 이동하지 않습니다.
                </p>
                <p>
                  나무 상자, 수정 상자, 오래된 무덤에 접근하면 한 턴을 사용해
                  전리품을 획득합니다. 장비·마법·연금술·자연 아이템이 바닥과
                  보관함에서 등장합니다.
                </p>
                <p>
                  설정에서 개발자 모드를 켜면 전장의 안개가 사라집니다. 도감에서
                  아이템을 지급하거나 적을 소환할 수 있으며 조작 캐릭터는 피해를 받지
                  않습니다.
                </p>
                <p>
                  증강 선택 대신 모든 동료가 1~4개의 고유 특성과 별도의 경험치·레벨을
                  지닙니다. 레벨업은 탐사를 멈추지 않으며, 획득한 경험과 전리품은
                  원정 종료 화면에서 함께 정산됩니다.
                </p>
                <p>
                  현재 자동탐사는 일시적으로 완전히 꺼져 있습니다. 각 동료는 20종 중
                  무작위로 정해진 수동 스킬 2개를 지니며, 스킬 버튼을 누른 뒤 지도에서
                  목표를 선택합니다. 스킬은 한 턴을 소비하고 동료별 재사용 대기시간을
                  가집니다.
                </p>
                <p>
                  밝은 칸은 현재 시야, 어두운 칸은 이전에 본 장소이며 검은 영역은
                  아직 탐사하지 않은 곳입니다.
                </p>
              </>
            ) : (
              <>
                <p>
                  Moving, attacking, using an item, or changing equipment lets
                  enemies take their turn. Move into an enemy to make a melee
                  attack. Locked doors require an iron key from the same floor.
                </p>
                <p>
                  Enemies begin asleep. They are more likely to wake when the
                  controlled character is close and inside their sight, and they do not move
                  or attack on the turn they wake.
                </p>
                <p>
                  Loot containers consume a turn and can yield equipment,
                  magic, alchemy, and nature items.
                </p>
                <p>
                  Developer mode reveals the map, enables item grants and enemy
                  spawning from the codex, and prevents controlled-character damage.
                </p>
                <p>
                  Companion traits replace augment choices. Every companion has
                  one to four traits plus independent experience and levels.
                  Level-ups no longer interrupt exploration.
                </p>
                <p>
                  Auto-explore is temporarily disabled in full. Every companion
                  has two randomly assigned manual skills from a pool of twenty.
                  Select a skill button, then choose its target on the map. Skills
                  consume one turn and have per-companion cooldowns.
                </p>
                <p>
                  Bright tiles are visible now, dim tiles are remembered, and
                  black regions have not been explored.
                </p>
              </>
            )}
          </div>
          <div className="help-section license-note">
            <h3>{text("오픈소스 고지", "Open-source Notice")}</h3>
            <p>
              {text(
                "이 비공식 웹 프로토타입은 Shattered Pixel Dungeon v3.3.8의 코드 구조와 그래픽·효과음·배경음악 자산을 수정·재구성했습니다. 원작은 Evan Debenham, Pixel Dungeon은 Oleg Dolya의 저작물이며 GPL-3.0-or-later에 따라 제공됩니다.",
                "This unofficial web prototype adapts code structures, graphics, sound effects, and music from Shattered Pixel Dungeon v3.3.8. The original is by Evan Debenham, Pixel Dungeon is by Oleg Dolya, and the work is provided under GPL-3.0-or-later.",
              )}
            </p>
            <p>
              {text(
                "인터페이스 글꼴은 Monad ABXY의 모나(Mona)이며 SIL Open Font License 1.1에 따라 포함됩니다.",
                "The interface uses Monad ABXY's Mona font, bundled under the SIL Open Font License 1.1.",
              )}
            </p>
            <div className="license-links">
              <a
                href="https://github.com/00-Evan/shattered-pixel-dungeon"
                target="_blank"
                rel="noreferrer"
              >
                {text("원본 저장소", "Original Repository")}
              </a>
              <a href="/LICENSE.txt" target="_blank">
                {text("GPL 전문", "GPL License")}
              </a>
              <a
                href="https://monadabxy.com/fonts/mona/"
                target="_blank"
                rel="noreferrer"
              >
                {text("모나 폰트", "Mona Font")}
              </a>
              <a href="/source/shattered-web-dungeon-source.zip" download>
                {text("수정 소스 내려받기", "Download Modified Source")}
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsModal({
  uiScale,
  fontScale,
  language,
  soundEnabled,
  developerMode,
  onScaleChange,
  onFontScaleChange,
  onLanguageChange,
  onSoundEnabledChange,
  onDeveloperModeChange,
  onEnterTestMap,
  onEnterBossFloor,
  onClose,
}: {
  uiScale: number;
  fontScale: number;
  language: UiLanguage;
  soundEnabled: boolean;
  developerMode: boolean;
  onScaleChange: (scale: number) => void;
  onFontScaleChange: (scale: number) => void;
  onLanguageChange: (language: UiLanguage) => void;
  onSoundEnabledChange: (enabled: boolean) => void;
  onDeveloperModeChange: (enabled: boolean) => void;
  onEnterTestMap?: () => void;
  onEnterBossFloor?: () => void;
  onClose: () => void;
}) {
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="settings-title">
              {text("인터페이스 설정", "Interface Settings")}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={text("설정 닫기", "Close settings")}
          >
            ×
          </button>
        </header>
        <div className="settings-content">
          <div className="settings-copy">
            <div>
              <span>{text("인터페이스 크기", "Interface size")}</span>
              <strong>{Math.round(uiScale * 100)}%</strong>
            </div>
            <p>
              {text(
                "지도 내부 줌과 별개로 버튼, 패널, 글자 등 전체 게임 화면의 크기를 조절합니다.",
                "Adjusts the entire game interface independently from the map camera zoom.",
              )}
            </p>
          </div>
          <div
            className="scale-options"
            role="group"
            aria-label={text("인터페이스 크기", "Interface size")}
          >
            {UI_SCALE_OPTIONS.map((scale) => (
              <button
                type="button"
                key={scale}
                className={uiScale === scale ? "is-active" : ""}
                onClick={() => onScaleChange(scale)}
                aria-pressed={uiScale === scale}
              >
                <span>{Math.round(scale * 100)}%</span>
                <small>
                  {scale < 1
                    ? text("작게", "Small")
                    : scale > 1
                      ? text("크게", "Large")
                      : text("기본", "Default")}
                </small>
              </button>
            ))}
          </div>
          <div className="settings-copy">
            <div>
              <span>{text("폰트 크기", "Font size")}</span>
              <strong>{Math.round(fontScale * 100)}%</strong>
            </div>
            <p>
              {text(
                "인터페이스 배율은 유지하고 설명, 버튼, 상태 정보 등 글자의 크기만 조절합니다.",
                "Changes text size while preserving the overall interface scale.",
              )}
            </p>
          </div>
          <div
            className="scale-options"
            role="group"
            aria-label={text("폰트 크기", "Font size")}
          >
            {FONT_SCALE_OPTIONS.map((scale) => (
              <button
                type="button"
                key={scale}
                className={fontScale === scale ? "is-active" : ""}
                onClick={() => onFontScaleChange(scale)}
                aria-pressed={fontScale === scale}
              >
                <span>{Math.round(scale * 100)}%</span>
                <small>
                  {scale < 1
                    ? text("작게", "Small")
                    : scale > 1
                      ? text("크게", "Large")
                      : text("기본", "Default")}
                </small>
              </button>
            ))}
          </div>
          <div className="settings-copy">
            <div>
              <span>{text("언어", "Language")}</span>
              <strong>
                {language === "ko" ? "한국어" : "English"}
              </strong>
            </div>
            <p>
              {text(
                "선택한 한 가지 언어로 인터페이스를 표시합니다.",
                "Shows the interface in one selected language.",
              )}
            </p>
          </div>
          <div
            className="language-options"
            role="group"
            aria-label={text("언어 선택", "Language selection")}
          >
            <button
              type="button"
              className={language === "ko" ? "is-active" : ""}
              onClick={() => onLanguageChange("ko")}
              aria-pressed={language === "ko"}
            >
              한국어
            </button>
            <button
              type="button"
              className={language === "en" ? "is-active" : ""}
              onClick={() => onLanguageChange("en")}
              aria-pressed={language === "en"}
            >
              English
            </button>
          </div>
          <div className="developer-setting">
            <div>
              <span>{text("게임 소리", "Game audio")}</span>
              <p>
                {text(
                  "배경음악과 전투·스킬·인터페이스 효과음을 함께 켜거나 끕니다.",
                  "Turns music, combat, skill, and interface sounds on or off together.",
                )}
              </p>
            </div>
            <button
              type="button"
              className={soundEnabled ? "is-active" : ""}
              onClick={() => onSoundEnabledChange(!soundEnabled)}
              aria-pressed={soundEnabled}
            >
              {soundEnabled
                ? text("켜짐", "On")
                : text("꺼짐", "Off")}
            </button>
          </div>
          <div className="developer-setting">
            <div>
              <span>{text("개발자 모드", "Developer mode")}</span>
              <p>
                {text(
                  "전체 지도를 밝히고 도감에서 아이템 지급과 적 소환 기능을 활성화하며, 모든 피해를 무효화합니다.",
                  "Reveals the map, enables codex spawning tools, and makes the player invincible.",
                )}
              </p>
            </div>
            <button
              type="button"
              className={developerMode ? "is-active" : ""}
              onClick={() => onDeveloperModeChange(!developerMode)}
              aria-pressed={developerMode}
            >
              {developerMode
                ? text("켜짐", "On")
                : text("꺼짐", "Off")}
            </button>
          </div>
          {developerMode && onEnterTestMap && (
            <div className="developer-setting">
              <div>
                <span>{text("테스트 맵", "Showcase Map")}</span>
                <p>
                  {text(
                    "고정 배치된 전체 맵 요소와 특수 상호작용을 바로 확인합니다.",
                    "Open the fixed developer map for terrain and interaction checks.",
                  )}
                </p>
              </div>
              <button type="button" onClick={onEnterTestMap}>
                {text("입장", "Enter")}
              </button>
            </div>
          )}
          {developerMode && onEnterBossFloor && (
            <div className="developer-setting">
              <div>
                <span>Boss Floor</span>
                <p>
                  {text(
                    "실제 최종층 생성기로 대형 Boss Room, 중앙 Boss, minion과 완료 차단을 확인합니다.",
                    "Open a generated final floor to validate the large room, centered boss, minions, and completion gate.",
                  )}
                </p>
              </div>
              <button type="button" onClick={onEnterBossFloor}>
                {text("입장", "Enter")}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CompendiumModal({
  developerMode,
  onGrantItem,
  onSpawnEnemy,
  onClose,
}: {
  developerMode: boolean;
  onGrantItem?: (itemId: string) => void;
  onSpawnEnemy?: (kind: EnemyKind) => void;
  onClose: () => void;
}) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  const [tab, setTab] = useState<CompendiumTab>("items");
  const [query, setQuery] = useState("");
  const [developerNotice, setDeveloperNotice] = useState(
    text(
      "개발자 기능 활성화 · 항목에서 지급 또는 소환",
      "Developer tools active · grant or spawn from an entry",
    ),
  );
  const itemIds = Object.keys(ITEM_DEFS);
  const enemyKinds = Object.keys(ENEMY_STATS) as EnemyKind[];
  const traitIds = COMPANION_TRAIT_IDS;
  const alchemyEntryCount =
    SIMPLE_ALCHEMY_RECIPES.length + ALCHEMY_ENCHANT_RECIPES.length;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItemIds = normalizedQuery
    ? itemIds.filter((itemId) => {
        const item = ITEM_DEFS[itemId];
        return (
          localizedItemName(itemId, language)
            .toLowerCase()
            .includes(normalizedQuery) ||
          (language === "ko"
            ? ITEM_CATEGORY_NAMES[item.category]
            : ITEM_CATEGORY_NAMES_EN[item.category])
            .toLowerCase()
            .includes(normalizedQuery)
        );
      })
    : itemIds;
  const visibleEnemyKinds = normalizedQuery
    ? enemyKinds.filter((kind) =>
        localizedEnemyName(kind, language)
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : enemyKinds;
  const visibleTraitIds = normalizedQuery
    ? traitIds.filter((id) => {
        const trait = COMPANION_TRAITS[id];
        return (
          (language === "ko" ? trait.nameKo : trait.nameEn)
            .toLowerCase()
            .includes(normalizedQuery) ||
          (language === "ko" ? trait.descriptionKo : trait.descriptionEn)
            .toLowerCase()
            .includes(normalizedQuery)
        );
      })
    : traitIds;
  const visibleAlchemyRecipes = normalizedQuery
    ? SIMPLE_ALCHEMY_RECIPES.filter((recipe) =>
        [...recipe.ingredients, recipe.outputDefId]
          .map((itemId) => localizedItemName(itemId, language))
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : SIMPLE_ALCHEMY_RECIPES;
  const enchantRecipeSearchText = [
    text(
      "강화 가능 장비 인챈트 특성 강화 마법 촉매",
      "upgradeable equipment enchant trait upgrade magic catalyst",
    ),
    ...ALCHEMY_ENCHANT_CATALYST_IDS.map((itemId) =>
      localizedItemName(itemId, language),
    ),
  ]
    .join(" ")
    .toLowerCase();
  const visibleEnchantRecipeRules =
    !normalizedQuery || enchantRecipeSearchText.includes(normalizedQuery)
      ? ALCHEMY_ENCHANT_RECIPES
      : [];
  const visibleAlchemyEntryCount =
    visibleAlchemyRecipes.length + visibleEnchantRecipeRules.length;
  const developerActionsAvailable = Boolean(
    developerMode && onGrantItem && onSpawnEnemy,
  );

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="compendium-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compendium-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="compendium-title">{text("도감", "Dungeon Codex")}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={text("도감 닫기", "Close codex")}
          >
            ×
          </button>
        </header>
        <nav
          className="compendium-tabs"
          aria-label={text("도감 분류", "Codex categories")}
        >
          <button
            type="button"
            className={tab === "items" ? "is-active" : ""}
            onClick={() => setTab("items")}
          >
            {text("아이템", "Items")} <span>{itemIds.length}</span>
          </button>
          <button
            type="button"
            className={tab === "enemies" ? "is-active" : ""}
            onClick={() => setTab("enemies")}
          >
            {text("적군", "Enemies")} <span>{enemyKinds.length}</span>
          </button>
          <button
            type="button"
            className={tab === "traits" ? "is-active" : ""}
            onClick={() => setTab("traits")}
          >
            {text("동료 특성", "Traits")} <span>{traitIds.length}</span>
          </button>
          <button
            type="button"
            className={tab === "alchemy" ? "is-active" : ""}
            onClick={() => setTab("alchemy")}
          >
            {text("연금술", "Alchemy")} <span>{alchemyEntryCount}</span>
          </button>
        </nav>
        <div className="codex-search">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              tab === "items"
                ? text(
                    "아이템 이름 또는 종류 검색",
                    "Search item name or category",
                  )
                : tab === "enemies"
                  ? text("적 이름 검색", "Search enemy name")
                  : tab === "traits"
                    ? text(
                        "특성 이름 또는 효과 검색",
                        "Search trait name or effect",
                      )
                    : text(
                        "재료 또는 결과 아이템 검색",
                        "Search ingredients or results",
                      )
            }
            aria-label={text("도감 검색", "Search codex")}
          />
          <span>
            {tab === "items"
              ? `${visibleItemIds.length}/${itemIds.length}`
              : tab === "enemies"
                ? `${visibleEnemyKinds.length}/${enemyKinds.length}`
                : tab === "traits"
                  ? `${visibleTraitIds.length}/${traitIds.length}`
                  : `${visibleAlchemyEntryCount}/${alchemyEntryCount}`}
          </span>
        </div>
        {developerActionsAvailable && (
          <div className="codex-developer-notice">{developerNotice}</div>
        )}
        <div className="compendium-content">
          {tab === "alchemy"
            ? <>
                {visibleAlchemyRecipes.map((recipe) => {
                  const ingredients = Object.entries(
                    recipe.ingredients.reduce<Record<string, number>>(
                      (counts, itemId) => ({
                        ...counts,
                        [itemId]: (counts[itemId] ?? 0) + 1,
                      }),
                      {},
                    ),
                  );
                  return (
                    <article
                      className="codex-entry alchemy-recipe-entry"
                      key={`${recipe.ingredients.join("+")}-${recipe.outputDefId}`}
                    >
                      <div className="alchemy-recipe-items">
                        <small>{text("재료", "Ingredients")}</small>
                        {ingredients.map(([itemId, quantity]) => (
                          <span key={itemId}>
                            <ItemIcon itemId={itemId} size={30} />
                            <b>{localizedItemName(itemId, language)}</b>
                            <em>×{quantity}</em>
                          </span>
                        ))}
                      </div>
                      <span className="alchemy-recipe-arrow" aria-hidden="true">→</span>
                      <div className="alchemy-recipe-output">
                        <small>{text("제작 결과", "Result")}</small>
                        <ItemIcon itemId={recipe.outputDefId} size={38} />
                        <strong>
                          {localizedItemName(recipe.outputDefId, language)}
                        </strong>
                        {(recipe.quantity ?? 1) > 1 && (
                          <em>×{recipe.quantity}</em>
                        )}
                      </div>
                    </article>
                  );
                })}
                {visibleEnchantRecipeRules.map((rule) => (
                  <article
                    className="codex-entry alchemy-enchant-entry"
                    key={rule.id}
                  >
                    <div className="alchemy-equipment-input">
                      <ItemIcon itemId="shortsword" size={40} />
                      <span>
                        <small>{text("기본 재료", "Base ingredient")}</small>
                        <strong>
                          {text("강화 가능한 장비 1개", "1 upgradeable item")}
                        </strong>
                      </span>
                    </div>
                    <div className="alchemy-catalyst-list">
                      <small>
                        {text(
                          `마법 촉매 ${rule.catalystCount}개`,
                          `${rule.catalystCount} magic catalyst${rule.catalystCount > 1 ? "s" : ""}`,
                        )}
                      </small>
                      <div>
                        {ALCHEMY_ENCHANT_CATALYST_IDS.map((itemId) => (
                          <span
                            key={itemId}
                            title={localizedItemName(itemId, language)}
                          >
                            <ItemIcon itemId={itemId} size={24} />
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="alchemy-recipe-arrow" aria-hidden="true">→</span>
                    <div className="alchemy-enchant-result">
                      <b aria-hidden="true">✦</b>
                      <span>
                        <small>{text("제작 결과", "Result")}</small>
                        <strong>
                          {rule.upgrade
                            ? text(
                                "+1 강화 및 무작위 특성",
                                "+1 upgrade and a random trait",
                              )
                            : text(
                                "무작위 특성 1개 부여",
                                "Apply 1 random trait",
                              )}
                        </strong>
                      </span>
                    </div>
                  </article>
                ))}
              </>
            : tab === "traits"
            ? visibleTraitIds.map((id) => {
                const trait = COMPANION_TRAITS[id];
                return (
                  <article className="codex-entry augment-entry" key={id}>
                    <div
                      className="augment-codex-sigil"
                      style={{ "--augment-accent": trait.accent } as CSSProperties}
                    >
                      <span aria-hidden="true">◆</span>
                    </div>
                    <div className="codex-copy">
                      <small>{text("동료 고유 특성", "Companion trait")}</small>
                      <h3>{language === "ko" ? trait.nameKo : trait.nameEn}</h3>
                      <p>{language === "ko" ? trait.descriptionKo : trait.descriptionEn}</p>
                    </div>
                    <div className="codex-tags">
                      <span>{text("영구 적용", "Permanent")}</span>
                      <span>{text("동료별 1~4개", "1–4 per companion")}</span>
                    </div>
                  </article>
                );
              })
            : tab === "items"
            ? visibleItemIds.map((itemId) => {
                const item = ITEM_DEFS[itemId];
                const stats = itemStatSummary(itemId, language);
                return (
                  <article className="codex-entry item-entry" key={itemId}>
                    <div
                      className="codex-item-art"
                      style={{ "--item-accent": item.accent } as CSSProperties}
                    >
                      <ItemIcon itemId={itemId} size={48} />
                    </div>
                    <div className="codex-copy">
                      <small>
                        {language === "ko"
                          ? ITEM_CATEGORY_NAMES[item.category]
                          : ITEM_CATEGORY_NAMES_EN[item.category]}
                      </small>
                      <h3>{localizedItemName(itemId, language)}</h3>
                      <p>{localizedItemDescription(itemId, language)}</p>
                    </div>
                    <div className="codex-tags">
                      {stats.length ? (
                        stats.map((stat) => <span key={stat}>{stat}</span>)
                      ) : (
                        <span>{text("특수 효과", "Special effect")}</span>
                      )}
                      {developerActionsAvailable && (
                        <button
                          type="button"
                          className="developer-codex-action"
                          onClick={() => {
                            onGrantItem?.(itemId);
                            setDeveloperNotice(
                              text(
                                `${item.name} 1개 지급 완료`,
                                `Granted 1 ${localizedItemName(itemId, language)}`,
                              ),
                            );
                          }}
                        >
                          {text("+1 지급", "Grant +1")}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            : visibleEnemyKinds.map((kind) => {
                const stats = ENEMY_STATS[kind];
                const sprite = ENEMY_SPRITES[kind];
                const enemyName = localizedEnemyName(kind, language);
                return (
                  <article className="codex-entry enemy-entry" key={kind}>
                    <EnemySpriteIcon
                      kind={kind}
                      size={60}
                      className={`enemy-sigil enemy-sigil--${kind}`}
                    />
                    <div className="codex-copy">
                      <small>{text("적군 기본 능력치", "Enemy Base Stats")}</small>
                      <h3>{enemyName}</h3>
                      <p>{localizedEnemyDescription(kind, language)}</p>
                      <div className="codex-stat-grid">
                        <span>{text("생명력", "Health")} <b>{stats.hp}</b></span>
                        <span>{text("공격", "Attack")} <b>{stats.attack}</b></span>
                        <span>{text("방어", "Defense")} <b>{stats.defense}</b></span>
                        <span>{text("명중", "Accuracy")} <b>{stats.accuracy}</b></span>
                        <span>{text("회피", "Evasion")} <b>{stats.evasion}</b></span>
                        <span>{text("경험치", "Experience")} <b>{stats.xp}</b></span>
                      </div>
                    </div>
                    <div className="codex-drops">
                      <small>{text("공통 드롭", "Common Drops")}</small>
                      {developerActionsAvailable && (
                        <button
                          type="button"
                          className="developer-codex-action"
                          onClick={() => {
                            onSpawnEnemy?.(kind);
                            setDeveloperNotice(
                              text(
                                `${sprite.label} 소환 완료`,
                                `Spawned ${enemyName}`,
                              ),
                            );
                          }}
                        >
                          {text("플레이어 근처 소환", "Spawn Near Player")}
                        </button>
                      )}
                      {ENEMY_DROP_TABLE.map(({ itemId, weight }) => (
                        <span key={itemId}>
                          <ItemIcon itemId={itemId} size={24} />
                          {localizedItemName(itemId, language)}
                          <b>{chanceLabel(ENEMY_DROP_CHANCE * weight)}</b>
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
        </div>
      </section>
    </div>
  );
}

function TurnGauge({
  moveSpeed,
  attackSpeed,
  progress,
}: {
  moveSpeed: number;
  attackSpeed: number;
  progress: number;
}) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  const circumference = 2 * Math.PI * 14;
  const normalizedProgress = Math.max(0, Math.min(1, progress));
  return (
    <span
      className="speed-gauge speed-gauge--turn"
      title={text(
        `턴 시간 ${(normalizedProgress * 100).toFixed(0)}% 누적 · 이동 ${moveSpeed.toFixed(2)}× · 공격 ${attackSpeed.toFixed(2)}×`,
        `Turn energy ${(normalizedProgress * 100).toFixed(0)}% · Move ${moveSpeed.toFixed(2)}× · Attack ${attackSpeed.toFixed(2)}×`,
      )}
    >
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="speed-gauge__track" cx="18" cy="18" r="14" />
        <circle
          className="speed-gauge__progress"
          cx="18"
          cy="18"
          r="14"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: circumference * (1 - normalizedProgress),
          }}
        />
      </svg>
      <i>T</i>
      <small>{text("턴 게이지", "Turn Gauge")}</small>
      <b>
        {text("이동", "Move")} {moveSpeed.toFixed(2)} ·{" "}
        {text("공격", "Attack")} {attackSpeed.toFixed(2)}
      </b>
    </span>
  );
}

function EquipmentComparisonModal({
  game,
  onAccept,
  onDecline,
}: {
  game: GameState;
  onAccept: (offerId: string) => void;
  onDecline: (offerId: string) => void;
}) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  const offer = game.equipmentOffers?.[0];
  if (!offer) return null;
  const candidate = ITEM_DEFS[offer.defId];
  const current = offer.currentDefId ? ITEM_DEFS[offer.currentDefId] : null;
  const candidateInstance =
    game.player.inventoryInstances.find(
      (instance) => instance.id === offer.itemRef,
    ) ?? null;
  const currentKey = (
    Object.keys(game.player.equipment) as Array<
      keyof typeof game.player.equipment
    >
  )
    .filter(
      (key) => game.player.equipment[key] === offer.currentDefId,
    )
    .sort(
      (a, b) =>
        equipmentScore(
          game.player.equipment[a],
          game.player.equipmentInstances?.[a],
        ) -
        equipmentScore(
          game.player.equipment[b],
          game.player.equipmentInstances?.[b],
        ),
    )[0];
  const currentInstance = currentKey
    ? game.player.equipmentInstances?.[currentKey] ?? null
    : null;
  const candidateStats = equipmentStatProfile(candidate, candidateInstance);
  const currentStats = current
    ? equipmentStatProfile(current, currentInstance)
    : null;
  const remainingTurns = Math.max(0, offer.expiresTurn - game.turn);
  return (
    <div className="equipment-offer-layer">
      <section className="equipment-offer" role="dialog" aria-modal="false">
        <header>
          <h2>{text("더 좋은 장비를 발견했습니다", "Better Equipment Found")}</h2>
          <span>
            {text(
              `${remainingTurns}턴 뒤 자동으로 닫힘`,
              `Closes automatically in ${remainingTurns} turns`,
            )}
          </span>
        </header>
        <div className="equipment-offer__comparison">
          <article>
            <small>{text("현재 장비", "Current Equipment")}</small>
            {current ? (
              <>
                <ItemIcon itemId={current.id} size={42} />
                <strong>{localizedItemName(current.id, language)}</strong>
                <span>
                  {text("공격", "Attack")} {currentStats?.attack ?? 0} ·{" "}
                  {text("방어", "Defense")} {currentStats?.defense ?? 0}
                </span>
              </>
            ) : (
              <em>{text("비어 있음", "Empty")}</em>
            )}
          </article>
          <i aria-hidden="true">→</i>
          <article className="is-better">
            <small>{text("방금 획득", "Just Acquired")}</small>
            <ItemIcon itemId={candidate.id} size={42} />
            <strong>{localizedItemName(candidate.id, language)}</strong>
            <span>
              {text("공격", "Attack")} {candidateStats.attack} ·{" "}
              {text("방어", "Defense")} {candidateStats.defense}
            </span>
            {(candidate.moveSpeed || candidate.attackSpeed) && (
              <span>
                {candidate.moveSpeed
                  ? `${text("이동", "Move")} ${candidate.moveSpeed.toFixed(2)}× `
                  : ""}
                {candidate.attackSpeed
                  ? `${text("공격속도", "Attack speed")} ${candidate.attackSpeed.toFixed(2)}×`
                  : ""}
              </span>
            )}
          </article>
        </div>
        <footer>
          <span>
            {text("종합 평가", "Overall score")}{" "}
            {equipmentScore(offer.currentDefId, currentInstance).toFixed(0)} →{" "}
            {equipmentScore(offer.defId, candidateInstance).toFixed(0)}
          </span>
          <button type="button" onClick={() => onDecline(offer.id)}>
            {text("거절", "Decline")}
          </button>
          <button type="button" className="is-primary" onClick={() => onAccept(offer.id)}>
            {text("교체", "Replace")}
          </button>
        </footer>
      </section>
    </div>
  );
}

const createDefaultCampaign = (): CampaignSave => {
  return {
    version: 8,
    warehouse: createInitialWarehouse(),
    materials: createCampaignMaterials({ potion: 3 }),
    shop: createShopState(INITIAL_DUNGEON_OFFER_SEED),
    companions: createStarterCompanionRoster(COMPANION_CLASS_IDS),
    expeditions: 0,
    completedExpeditions: 0,
    bossDungeonClears: 0,
    gold: 0,
    offerSeed: INITIAL_DUNGEON_OFFER_SEED,
  };
};

const restoreCampaign = (raw: string | null): CampaignSave | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      version?: number;
      warehouse?: WarehouseState;
      hero?: Player;
      companions?: Companion[];
      expeditions?: number;
      completedExpeditions?: number;
      bossDungeonClears?: number;
      gold?: number;
      offerSeed?: number;
      shop?: CampaignSave["shop"];
      materials?: unknown;
    };
    if (
      ![1, 2, 3, 4, 5, 6, 7, 8].includes(parsed.version ?? 0) ||
      !parsed.warehouse ||
      !Array.isArray(parsed.companions) ||
      (parsed.version === 1 && !parsed.hero)
    ) {
      return null;
    }
    let restoredWarehouse = cloneWarehouse({
      stacks: { ...(parsed.warehouse.stacks ?? {}) },
      instances: (parsed.warehouse.instances ?? []).map((instance) => ({
        ...instance,
        statRoll: instance.statRoll ? { ...instance.statRoll } : undefined,
        traits: (instance.traits ?? []).map((trait) => ({ ...trait })),
      })),
      throwableProfiles: Object.fromEntries(
        Object.entries(parsed.warehouse.throwableProfiles ?? {}).map(
          ([itemId, instance]) => [
            itemId,
            {
              ...instance,
              statRoll: instance.statRoll ? { ...instance.statRoll } : undefined,
              traits: (instance.traits ?? []).map((trait) => ({ ...trait })),
            },
          ],
        ),
      ),
      slots: [...(parsed.warehouse.slots ?? [])],
    });
    const restoredCompanionEntries = parsed.companions.map(
      normalizeCompanionForHubWithReleasedItems,
    );
    const restoredCompanions = restoredCompanionEntries.map(
      (entry) => entry.companion,
    );
    const storedInstanceIds = new Set(
      restoredWarehouse.instances.map((instance) => instance.id),
    );
    restoredCompanionEntries.forEach((entry) => {
      entry.releasedInstances.forEach((instance) => {
        if (storedInstanceIds.has(instance.id)) return;
        storedInstanceIds.add(instance.id);
        restoredWarehouse.instances.push(instance);
      });
    });
    const migratedWarehouse = extractWarehouseMaterials(restoredWarehouse);
    restoredWarehouse = migratedWarehouse.warehouse;
    restoredWarehouse.slots = normalizeStorageSlots(
      restoredWarehouse,
      WAREHOUSE_SLOT_COUNT,
    );
    if (parsed.version === 1 && parsed.hero) {
      const legacyBase = createStarterCompanionRoster(["adventurer"])[0];
      const legacyPlayer: Player = {
        ...companionToPlayer(legacyBase),
        ...parsed.hero,
        companionId: legacyBase.id,
        name: legacyBase.name,
        classId: "adventurer",
        traits: [...legacyBase.traits],
        accuracy: parsed.hero.accuracy ?? legacyBase.accuracy,
        evasion: parsed.hero.evasion ?? legacyBase.evasion,
        viewDistance: parsed.hero.viewDistance ?? legacyBase.viewDistance,
      };
      restoredCompanions.unshift(
        playerToCompanion(normalizeHeroForHub(legacyPlayer)),
      );
    }
    const companions = restoredCompanions.length > 0
      ? restoredCompanions
      : createStarterCompanionRoster(COMPANION_CLASS_IDS);
    const expeditions = Math.max(0, parsed.expeditions ?? 0);
    const offerSeed =
      typeof parsed.offerSeed === "number" && Number.isFinite(parsed.offerSeed)
        ? parsed.offerSeed >>> 0
        : randomDungeonSeed();
    return {
      version: 8,
      warehouse: restoredWarehouse,
      materials: addMaterials(
        normalizeCampaignMaterials(parsed.materials),
        migratedWarehouse.materialsGained,
      ),
      shop: normalizeShopState(parsed.shop, offerSeed, expeditions),
      companions,
      expeditions,
      completedExpeditions: Math.max(0, parsed.completedExpeditions ?? 0),
      bossDungeonClears: normalizeBossDungeonClears(
        parsed.bossDungeonClears,
      ),
      gold:
        typeof parsed.gold === "number" && Number.isFinite(parsed.gold)
          ? Math.max(0, Math.floor(parsed.gold))
          : 0,
      offerSeed,
    };
  } catch {
    return null;
  }
};

const uiAudioControlAt = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return null;
  const control = target.closest(
    "button, a[href], select, summary, [role='button'], [role='tab'], [role='switch']",
  );
  if (
    !control ||
    control.matches(":disabled") ||
    control.getAttribute("aria-disabled") === "true"
  ) return null;
  return control;
};

function CampaignHeader({
  warehouseCount,
  expeditions,
  gold,
  materials,
  onOpenCompendium,
  onOpenSettings,
  onOpenHelp,
}: {
  warehouseCount: number;
  expeditions: number;
  gold: number;
  materials: CampaignMaterials;
  onOpenCompendium: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}) {
  return (
    <header className="campaign-header">
      <div className="brand campaign-brand">
        <span className="brand-mark" aria-hidden="true">
          <span />
        </span>
        <div>
          <p className="eyebrow">EXPEDITION GUILD</p>
          <h1>잔불 원정대</h1>
        </div>
      </div>
      <div className="campaign-ledger" aria-label="원정대 현황">
        <span><small>완료한 원정</small><strong>{expeditions}</strong></span>
        <i />
        <span><small>보관 중인 물품</small><strong>{warehouseCount}</strong></span>
        <i />
        <span><small>보유 골드</small><strong>{formatGold(gold)}</strong></span>
        {CAMPAIGN_MATERIAL_KINDS.map((kind) => (
          <span className={`campaign-material is-${kind}`} key={kind}>
            <small>{CAMPAIGN_MATERIAL_NAMES[kind]}</small>
            <strong>{materials[kind]}</strong>
          </span>
        ))}
      </div>
      <nav className="campaign-header-actions" aria-label="거점 메뉴">
        <button type="button" onClick={onOpenCompendium}>도감</button>
        <button type="button" onClick={onOpenSettings}>설정</button>
        <button type="button" onClick={onOpenHelp}>탐사 안내</button>
      </nav>
    </header>
  );
}

function DeveloperDungeonLoot({
  dungeon,
  onInspect,
}: {
  dungeon: DungeonDefinition;
  onInspect: (preview: ItemDetailPreview) => void;
}) {
  const stackGroups = new Map<
    string,
    {
      key: string;
      itemId: string;
      quantity: number;
      instance: InventoryInstance | null;
      floors: Set<number>;
      sources: Set<string>;
    }
  >();
  const sourceLabel = {
    ground: "바닥",
    object: "오브젝트",
    enemy: "적 드롭",
    specialReward: "특수방 보상",
  } as const;
  const displayEntries: Array<{
    key: string;
    itemId: string;
    quantity: number;
    instance: InventoryInstance | null;
    floors: Set<number>;
    sources: Set<string>;
  }> = [];
  dungeon.lootPlan.forEach((entry) => {
    const source = sourceLabel[entry.source];
    if (entry.instance) {
      displayEntries.push({
        key: entry.id,
        itemId: entry.defId,
        quantity: entry.quantity,
        instance: entry.instance,
        floors: new Set([entry.floor]),
        sources: new Set([source]),
      });
      return;
    }
    const existing = stackGroups.get(entry.defId);
    if (existing) {
      existing.quantity += entry.quantity;
      existing.floors.add(entry.floor);
      existing.sources.add(source);
      return;
    }
    stackGroups.set(entry.defId, {
      key: `stack-${entry.defId}`,
      itemId: entry.defId,
      quantity: entry.quantity,
      instance: null,
      floors: new Set([entry.floor]),
      sources: new Set([source]),
    });
  });
  displayEntries.push(...stackGroups.values());
  displayEntries.sort(
    (a, b) =>
      Math.min(...a.floors) - Math.min(...b.floors) ||
      (ITEM_DEFS[a.itemId]?.name ?? a.itemId).localeCompare(
        ITEM_DEFS[b.itemId]?.name ?? b.itemId,
      ),
  );
  const totalQuantity = dungeon.lootPlan.reduce(
    (total, entry) => total + entry.quantity,
    0,
  );
  return (
    <details
      className="developer-loot-preview"
      style={{ "--dungeon-accent": dungeon.accent } as CSSProperties}
      open
    >
      <summary>
        <span>DEV · 전체 전리품</span>
        <b>{totalQuantity}개</b>
      </summary>
      <p>맵 생성 전 확정된 목록 · 수풀의 확률 드롭 제외</p>
      <div className="fixed-item-grid developer-loot-grid">
        {displayEntries.map((entry) => {
          const floors = [...entry.floors].sort((a, b) => a - b).join(", ");
          const sources = [...entry.sources].join(" · ");
          const itemName = ITEM_DEFS[entry.itemId]?.name ?? entry.itemId;
          return (
            <button
              type="button"
              className="fixed-item-slot is-filled"
              key={entry.key}
              title={`${itemName} · ${floors}층 · ${sources}`}
              aria-label={`${itemName}, ${floors}층, ${sources}`}
              onClick={(event) =>
                onInspect({
                  itemId: entry.itemId,
                  itemRef: entry.instance?.id ?? entry.key,
                  instance: entry.instance,
                  quantity: entry.quantity,
                  contextLabel: `${dungeon.nameKo} 전체 전리품 · ${floors}층 · ${sources}`,
                  anchor: descriptionAnchorFromElement(event.currentTarget),
                })
              }
            >
              <ItemSlotContents
                itemId={entry.itemId}
                size={32}
                instance={entry.instance}
                quantity={entry.quantity}
                showQuantity={entry.quantity > 1}
              />
            </button>
          );
        })}
      </div>
    </details>
  );
}

function HubScreen({
  campaign,
  dungeons,
  developerMode,
  onSelectDungeon,
  onOpenWarehouse,
  onOpenShop,
  onOpenBlacksmith,
  onOpenTraining,
  onOpenCompendium,
  onOpenSettings,
  onOpenHelp,
}: {
  campaign: CampaignSave;
  dungeons: DungeonDefinition[];
  developerMode: boolean;
  onSelectDungeon: (dungeon: DungeonDefinition) => void;
  onOpenWarehouse: () => void;
  onOpenShop: () => void;
  onOpenBlacksmith: () => void;
  onOpenTraining: () => void;
  onOpenCompendium: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}) {
  const storedCount = warehouseItemCount(campaign.warehouse);
  const [itemPreview, setItemPreview] = useState<ItemDetailPreview | null>(null);
  const rosterLeader = campaign.companions[0];
  const rosterLeaderDefinition = rosterLeader
    ? characterPresentation(rosterLeader)
    : null;
  const rosterLeaderProfession = rosterLeader
    ? COMPANION_PROFESSIONS[rosterLeader.professionId]
    : null;
  return (
    <main className="campaign-page">
      <CampaignHeader
        warehouseCount={storedCount}
        expeditions={campaign.completedExpeditions}
        gold={campaign.gold}
        materials={campaign.materials}
        onOpenCompendium={onOpenCompendium}
        onOpenSettings={onOpenSettings}
        onOpenHelp={onOpenHelp}
      />
      <section className="hub-intro">
        <div>
          <p className="eyebrow">다음 원정</p>
          <h2>어디로 향하시겠습니까?</h2>
          <p>
            파밍용 추천 던전 5개와 보스 진행 던전 1개입니다. 원정을 마치면 새로운 목록으로 교체됩니다.
          </p>
        </div>
        <div className="hub-party-summary">
          {rosterLeaderDefinition && (
            <PixelSpriteFrame
              file={rosterLeaderDefinition.sprite}
              sheetWidth={rosterLeaderDefinition.sheetWidth}
              frameWidth={rosterLeaderDefinition.frameWidth}
              frameHeight={rosterLeaderDefinition.frameHeight}
              frame={
                rosterLeaderDefinition.animationSet === "companion"
                  ? companionFrameIndex(
                      companionArmorTier(rosterLeader),
                      COMPANION_IDLE_FRAMES[0],
                    )
                  : PLAYER_IDLE_FRAMES[0]
              }
              size={44}
            />
          )}
          <div>
            <small>첫 원정대원</small>
            <strong>{rosterLeader?.name ?? "모험가"} · {rosterLeaderProfession?.nameKo ?? "전사"} · LV.{rosterLeader?.level ?? 1}</strong>
            <span>동료 {campaign.companions.length}명 대기</span>
          </div>
        </div>
      </section>
      <section className="dungeon-board" aria-label="탐험할 던전 선택">
        {dungeons.map((dungeon, index) => {
          const isBossOffer = dungeon.offerKind === "boss";
          const isPendingBoss = isBossOffer && !dungeon.bossId;
          const bossName = dungeon.bossId
            ? bossDefinition(dungeon.bossId).nameKo
            : null;
          const mainLootEntries = selectMainLootEntries(dungeon.lootPlan);
          return (
            <article
              className="dungeon-contract"
              key={dungeon.id}
              style={{ "--dungeon-accent": dungeon.accent } as CSSProperties}
            >
              <header>
                <span className="contract-index">0{index + 1}</span>
                <div>
                  <small>{isBossOffer ? "보스 던전" : dungeon.subtitleKo}</small>
                  <h3>{dungeon.nameKo}</h3>
                </div>
              </header>
              <p>{dungeon.descriptionKo}</p>
              <dl>
                <div>
                  <dt>난이도</dt>
                  <dd>
                    <span className="difficulty-pips" aria-hidden="true">
                      {[1, 2, 3, 4, 5, 6, 7].map((pip) => (
                        <i key={pip} className={pip <= dungeon.difficulty ? "is-on" : ""} />
                      ))}
                    </span>
                    <b className="difficulty-grade">{dungeon.difficultyGrade}</b>
                    {dungeon.difficultyLabelKo}
                  </dd>
                </div>
                <div>
                  <dt>던전 깊이</dt>
                  <dd>{isPendingBoss ? "준비 중" : `총 ${dungeon.floorCount}층`}</dd>
                </div>
                {isBossOffer && (
                  <div>
                    <dt>보스</dt>
                    <dd>{bossName ?? "다음 보스 준비 중"}</dd>
                  </div>
                )}
              </dl>
              {!isBossOffer && (
                <div className="main-drops">
                  <header>
                    <small>주요 전리품</small>
                    <em>아이템칸을 눌러 설명 보기</em>
                  </header>
                  <div className="fixed-item-grid dungeon-drop-grid">
                    {mainLootEntries.map((entry) => (
                      <button
                        type="button"
                        className="fixed-item-slot is-filled"
                        key={entry.id}
                        title={ITEM_DEFS[entry.defId]?.name}
                        aria-label={`${ITEM_DEFS[entry.defId]?.name ?? entry.defId} 설명 보기`}
                        onClick={(event) =>
                          setItemPreview({
                            itemId: entry.defId,
                            itemRef:
                              entry.instance?.id ??
                              `recommended-${dungeon.id}-${entry.id}`,
                            instance: entry.instance ?? null,
                            quantity: entry.quantity,
                            contextLabel: `${dungeon.nameKo} 주요 전리품`,
                            anchor: descriptionAnchorFromElement(event.currentTarget),
                          })
                        }
                      >
                        <ItemSlotContents
                          itemId={entry.defId}
                          size={34}
                          instance={entry.instance}
                          quantity={entry.quantity}
                          showQuantity={entry.quantity > 1}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {developerMode && (
                <DeveloperDungeonLoot
                  dungeon={dungeon}
                  onInspect={setItemPreview}
                />
              )}
              <button
                type="button"
                disabled={isPendingBoss}
                onClick={() => onSelectDungeon(dungeon)}
              >
                {isPendingBoss ? "다음 보스 준비 중" : "이 던전 준비하기"}{" "}
                {!isPendingBoss && <span aria-hidden="true">→</span>}
              </button>
            </article>
          );
        })}
      </section>
      <section className="hub-facilities" aria-label="원정대 거점 시설">
        <article className="hub-facility-card is-warehouse">
          <span className="hub-facility-symbol" aria-hidden="true">▣</span>
          <div>
            <p className="eyebrow">WAREHOUSE</p>
            <h2>창고</h2>
            <p>보관 중인 물품 {storedCount}개</p>
            <small>원정에서 회수한 장비와 아이템을 관리합니다.</small>
          </div>
          <button type="button" onClick={onOpenWarehouse}>창고 열기</button>
        </article>
        <article className="hub-facility-card is-shop">
          <span className="hub-facility-symbol" aria-hidden="true">◇</span>
          <div>
            <p className="eyebrow">MARKET</p>
            <h2>원정대 상점</h2>
            <p>오늘의 상품 {campaign.shop.stock.length}종 · 되사기 {campaign.shop.buyback.length}종</p>
            <small>상점과 되사기 목록은 다음 원정 귀환 때 갱신됩니다.</small>
          </div>
          <button type="button" onClick={onOpenShop}>상점 열기</button>
        </article>
        <article className="hub-facility-card is-training">
          <span className="hub-facility-symbol" aria-hidden="true">✦</span>
          <div>
            <p className="eyebrow">TRAINING GROUND</p>
            <h2>훈련장</h2>
            <p>골드로 새 스킬을 배우고 원정에 사용할 두 스킬을 장착합니다.</p>
            <small>스킬 습득만 유료 · 장착·해제·교체는 무료</small>
          </div>
          <button type="button" onClick={onOpenTraining}>훈련장 열기</button>
        </article>
        <article className="hub-facility-card is-blacksmith">
          <span className="hub-facility-symbol" aria-hidden="true">♨</span>
          <div>
            <p className="eyebrow">BLACKSMITH</p>
            <h2>불꽃 대장간</h2>
            <p>장비의 기본 등급을 F에서 S까지 한 단계씩 올립니다.</p>
            <small>강화·추가 인챈트 유지 · 첫 인챈트는 등급과 함께 상승 · F→E 1,600 G부터</small>
          </div>
          <button type="button" onClick={onOpenBlacksmith}>대장간 열기</button>
        </article>
      </section>
      {itemPreview && (
        <ItemDetailModal
          game={null}
          selected={{
            itemId: itemPreview.itemId,
            itemRef: itemPreview.itemRef,
          }}
          preview={itemPreview}
          readOnly
          onClose={() => setItemPreview(null)}
        />
      )}
    </main>
  );
}

type CommerceView = "warehouse" | "shop";

function CommerceModal({
  campaign,
  view,
  notice,
  onBuy,
  onClose,
}: {
  campaign: CampaignSave;
  view: CommerceView;
  notice: string | null;
  onBuy: (source: ShopListingSource, listingId: string) => boolean;
  onClose: () => void;
}) {
  const slotDrag = useActiveItemSlotDrag();
  const [itemPreview, setItemPreview] = useState<ItemDetailPreview | null>(null);
  const warehouse = campaign.warehouse;
  const stackEntries = Object.entries(warehouse.stacks)
    .filter(([, quantity]) => quantity > 0)
    .sort(([a], [b]) => (ITEM_DEFS[a]?.name ?? a).localeCompare(ITEM_DEFS[b]?.name ?? b));
  const listingSections = [
    {
      source: "stock" as const,
      eyebrow: "MARKET STOCK",
      title: "판매 상품",
      listings: campaign.shop.stock,
      empty: "현재 판매 중인 상품이 없습니다.",
    },
    {
      source: "buyback" as const,
      eyebrow: "BUYBACK",
      title: "되사기",
      listings: campaign.shop.buyback,
      empty: "되살 수 있는 판매품이 없습니다.",
    },
  ];
  return (
    <div className="modal-backdrop warehouse-backdrop commerce-backdrop">
      <section className="warehouse-modal commerce-modal" role="dialog" aria-modal="true" aria-labelledby="commerce-title">
        <header>
          <div>
            <p className="eyebrow">{view === "warehouse" ? "WAREHOUSE" : "GUILD COMMERCE"}</p>
            <h2 id="commerce-title">{view === "warehouse" ? "원정대 창고" : "창고 · 원정대 상점"}</h2>
          </div>
          <div className="commerce-wallet"><small>보유 골드</small><b>{formatGold(campaign.gold)} G</b></div>
          <button type="button" onClick={onClose} aria-label={view === "warehouse" ? "창고 닫기" : "상점과 창고 닫기"}>×</button>
        </header>
        {notice && <p className="commerce-notice" role="status">{notice}</p>}
        <div className={`commerce-split-layout ${view === "warehouse" ? "is-warehouse-view" : ""}`}>
          <section
            className="commerce-warehouse-panel commerce-column"
            aria-labelledby="commerce-warehouse-title"
            {...(slotDrag?.addressAttributes({ zone: "shopWarehouseTarget" }, null) ?? {})}
          >
            <header className="commerce-column-header">
              <div><p className="eyebrow">WAREHOUSE</p><h3 id="commerce-warehouse-title">창고</h3></div>
              <span>{warehouseItemCount(warehouse)}개</span>
            </header>
            <div className="warehouse-summary">
              <span>총 보관 수량 <b>{warehouseItemCount(warehouse)}</b></span>
              <span>종류 <b>{stackEntries.length + warehouse.instances.length}</b></span>
              <em>{view === "warehouse"
                ? "아이템을 클릭해 설명을 보고 장비 주문서를 사용할 수 있습니다."
                : "상점 상품을 이 영역으로 옮기거나 구매 버튼을 누르세요."}</em>
            </div>
            <CampaignWarehouseInventory
              warehouse={warehouse}
              className="warehouse-fixed-grid"
              contextLabel={view === "warehouse" ? "원정대 창고" : "상점 왼쪽 창고"}
            />
          </section>
          {view === "shop" && <section
            className="commerce-shop-panel commerce-column"
            aria-labelledby="commerce-shop-title"
            {...(slotDrag?.addressAttributes({ zone: "shopSellTarget" }, null) ?? {})}
          >
            <header className="commerce-column-header">
              <div><p className="eyebrow">MARKET</p><h3 id="commerce-shop-title">상점</h3></div>
              <span>{campaign.shop.stock.length}종</span>
            </header>
            <p className="shop-refresh-note">창고 아이템을 이 영역에 놓으면 판매됩니다. 판매한 물품은 이 목록에 추가되며, 판매 당시 받은 금액으로 다시 구매할 수 있습니다. 목록은 던전 귀환 때 갱신됩니다.</p>
            <div className="commerce-shop-scroll">
              {listingSections.map((section) => (
                <section className="shop-listing-section" key={section.source}>
                  <header>
                    <div><p className="eyebrow">{section.eyebrow}</p><h3>{section.title}</h3></div>
                    <span>{section.listings.length}종</span>
                  </header>
                  <div className="shop-listing-grid">
                    {section.listings.map((listing) => {
                      const address: ItemSlotAddress = {
                        zone: section.source === "stock" ? "shopStock" : "shopBuyback",
                        listingId: listing.id,
                      };
                      const affordable = campaign.gold >= listing.unitPrice;
                      return (
                        <article className="shop-listing-card" key={listing.id}>
                          <button
                            type="button"
                            className={[
                              "fixed-item-slot",
                              "is-filled",
                              slotDrag?.heldAddressKey === itemSlotAddressKey(address) ? "is-drag-source" : "",
                            ].filter(Boolean).join(" ")}
                            title="클릭하면 설명을 보고, 길게 눌러 왼쪽 창고로 옮기면 구매합니다."
                            aria-label={`${ITEM_DEFS[listing.itemId]?.name ?? listing.itemId} 설명 및 구매품 끌기`}
                            onClick={(event) => setItemPreview({
                              itemId: listing.itemId,
                              itemRef: listing.instance?.id ?? listing.id,
                              instance: listing.instance,
                              quantity: listing.quantity,
                              contextLabel: section.title,
                              anchor: descriptionAnchorFromElement(event.currentTarget),
                            })}
                            {...(slotDrag?.addressAttributes(address, {
                              itemRef: listing.instance?.id ?? listing.id,
                              itemId: listing.itemId,
                              quantity: listing.quantity,
                              grade: listing.instance?.grade,
                              upgradeLevel: listing.instance?.upgradeLevel,
                              charges: listing.instance?.charges,
                              maxCharges: listing.instance?.maxCharges,
                            }) ?? {})}
                          >
                            <ItemSlotContents itemId={listing.itemId} size={40} instance={listing.instance} quantity={listing.quantity} showQuantity={listing.quantity > 1} />
                          </button>
                          <div>
                            <small>{ITEM_CATEGORY_NAMES[ITEM_DEFS[listing.itemId].category]}</small>
                            <strong>{ITEM_DEFS[listing.itemId]?.name}</strong>
                            <span>{listing.instance ? "고유 장비" : `재고 ${listing.quantity}개`}</span>
                          </div>
                          <b>{formatGold(listing.unitPrice)} G</b>
                          <button type="button" disabled={!affordable} onClick={() => onBuy(section.source, listing.id)}>
                            {affordable ? "구매" : "골드 부족"}
                          </button>
                        </article>
                      );
                    })}
                    {section.listings.length === 0 && <p className="shop-empty">{section.empty}</p>}
                  </div>
                </section>
              ))}
            </div>
          </section>}
        </div>
        <footer><button type="button" onClick={onClose}>닫기</button></footer>
      </section>
      {itemPreview && (
        <ItemDetailModal
          game={null}
          selected={{ itemId: itemPreview.itemId, itemRef: itemPreview.itemRef }}
          preview={itemPreview}
          readOnly
          onClose={() => setItemPreview(null)}
        />
      )}
    </div>
  );
}

const smithyTargetKey = (target: SmithyTarget) => JSON.stringify(target);

type BlacksmithTab = "grade" | "enchant";

function BlacksmithModal({
  campaign,
  selectedTarget,
  selectionRevision,
  notice,
  onTargetSelect,
  onUpgrade,
  onRerollEnchantments,
  onClose,
}: {
  campaign: CampaignSave;
  selectedTarget: SmithyTarget | null;
  selectionRevision: number;
  notice: string | null;
  onTargetSelect: (target: SmithyTarget) => void;
  onUpgrade: (target: SmithyTarget) => boolean;
  onRerollEnchantments: (
    target: SmithyTarget,
    lockedIndexes: readonly number[],
  ) => boolean;
  onClose: () => void;
}) {
  const slotDrag = useActiveItemSlotDrag();
  const [activeTab, setActiveTab] = useState<BlacksmithTab>("grade");
  const [lockSelection, setLockSelection] = useState<{
    revision: number;
    indexes: Set<number>;
  }>(() => ({ revision: selectionRevision, indexes: new Set() }));
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const { upgradeFlashKey, flashUpgradeKey } = useUpgradeFlashFeedback();
  const candidates = listSmithyCandidates(campaign);
  const selectedKey = selectedTarget
    ? smithyTargetKey(selectedTarget)
    : null;
  const lockedIndexes = lockSelection.revision === selectionRevision
    ? lockSelection.indexes
    : new Set<number>();
  const selected = candidates.find(
    (candidate) => smithyTargetKey(candidate.target) === selectedKey,
  ) ?? null;
  const currentGrade = selected
    ? resolveItemGrade(ITEM_DEFS[selected.itemId], selected.instance)
    : null;
  const nextGrade = currentGrade ? smithyNextGrade(currentGrade) : null;
  const enchantments = selected
    ? equipmentTraitSummary(selected.instance)
    : [];
  const lockScrolls = campaign.warehouse.stacks.scroll_mirror_image ?? 0;
  const rerollRunestoneCost = currentGrade
    ? smithyEnchantRerollRunestoneCost(currentGrade)
    : 0;
  const rerollRequirementsMet = Boolean(
    selected &&
    enchantments.length > lockedIndexes.size &&
    campaign.materials.runestone >= rerollRunestoneCost &&
    lockScrolls >= lockedIndexes.size,
  );
  const requirements = currentGrade
    ? smithyUpgradeRequirements(campaign, currentGrade)
    : [];
  const requirementsMet =
    nextGrade !== null &&
    requirements.length > 0 &&
    requirements.every((requirement) => requirement.satisfied);
  const unmetRequirement = requirements.find(
    (requirement) => !requirement.satisfied,
  ) ?? null;
  const requirementLabel = (resourceId: string, resourceKind: "currency" | "material") =>
    resourceKind === "currency" && resourceId === "gold"
      ? "골드"
      : CAMPAIGN_MATERIAL_NAMES[resourceId as keyof CampaignMaterials] ?? resourceId;
  const candidateForInstance = (instance: InventoryInstance | null) =>
    instance
      ? candidates.find((candidate) => candidate.instance.id === instance.id) ?? null
      : null;
  const selectableCandidateForInstance = (
    instance: InventoryInstance | null,
  ) => {
    const candidate = candidateForInstance(instance);
    if (!candidate) return null;
    if (activeTab === "enchant") {
      return (candidate.instance.traits?.length ?? 0) > 0 ? candidate : null;
    }
    const grade = resolveItemGrade(
      ITEM_DEFS[candidate.itemId],
      candidate.instance,
    );
    return smithyNextGrade(grade) ? candidate : null;
  };
  const selectedWarehouseIndex = selected?.target.kind === "warehouse"
    ? normalizeStorageSlots(campaign.warehouse, WAREHOUSE_SLOT_COUNT).indexOf(
        selected.target.instanceId,
      )
    : null;
  const selectedTargetKey = selected
    ? smithyTargetKey(selected.target)
    : null;
  const selectCandidate = (candidate: SmithyCandidate) => {
    setLockSelection({ revision: selectionRevision, indexes: new Set() });
    setLockNotice(null);
    onTargetSelect(candidate.target);
  };
  const switchTab = (tab: BlacksmithTab) => {
    setActiveTab(tab);
    setLockSelection({ revision: selectionRevision, indexes: new Set() });
    setLockNotice(null);
  };
  const toggleLock = (index: number) => {
    setLockSelection((current) => {
      const currentIndexes = current.revision === selectionRevision
        ? current.indexes
        : new Set<number>();
      const next = new Set(currentIndexes);
      if (next.has(index)) {
        next.delete(index);
        setLockNotice(null);
        return { revision: selectionRevision, indexes: next };
      }
      if (next.size >= lockScrolls) {
        setLockNotice("인챈트 고정 주문서가 부족합니다.");
        return { revision: selectionRevision, indexes: currentIndexes };
      }
      next.add(index);
      setLockNotice(null);
      return { revision: selectionRevision, indexes: next };
    });
  };
  const flashSelected = () => {
    if (selected) flashUpgradeKey(smithyTargetKey(selected.target));
  };

  return (
    <div className="modal-backdrop blacksmith-backdrop">
      <section className="blacksmith-modal" role="dialog" aria-modal="true" aria-labelledby="blacksmith-title">
        <header>
          <div><p className="eyebrow">BLACKSMITH</p><h2 id="blacksmith-title">불꽃 대장간</h2></div>
          <div className="commerce-wallet material-wallet">
            <span><small>보유 골드</small><b>{formatGold(campaign.gold)} G</b></span>
            <span><small>보유 룬석</small><b>{campaign.materials.runestone}개</b></span>
          </div>
          <button type="button" onClick={onClose} aria-label="대장간 닫기">×</button>
        </header>
        <nav className="blacksmith-tabs" aria-label="대장간 작업 선택">
          <button type="button" className={activeTab === "grade" ? "is-active" : ""} onClick={() => switchTab("grade")}>등급 승급</button>
          <button type="button" className={activeTab === "enchant" ? "is-active" : ""} onClick={() => switchTab("enchant")}>인챈트 변경</button>
        </nav>
        <p className="blacksmith-lead">
          {activeTab === "grade"
            ? "장비의 기본 등급을 한 단계 상승시킵니다."
            : "룬석을 사용해 장비의 인챈트를 무작위로 변경합니다. 인챈트 고정 주문서가 있다면 원하는 인챈트를 보호할 수 있습니다."}
        </p>
        {((lockSelection.revision === selectionRevision ? lockNotice : null) ?? notice) && (
          <p className="commerce-notice" role="status">
            {(lockSelection.revision === selectionRevision ? lockNotice : null) ?? notice}
          </p>
        )}
        <div className="blacksmith-layout">
          <div className="blacksmith-source-panels">
            <section className="blacksmith-source-panel" aria-labelledby="blacksmith-warehouse-title">
              <header className="commerce-column-header">
                <div><p className="eyebrow">WAREHOUSE</p><h3 id="blacksmith-warehouse-title">창고</h3></div>
                <span>{warehouseItemCount(campaign.warehouse)}개</span>
              </header>
              <p>모든 보유 아이템을 표시합니다. 빛나는 장비를 현재 대장간 작업 대상으로 선택할 수 있습니다.</p>
              <CampaignWarehouseInventory
                warehouse={campaign.warehouse}
                className="preparation-storage-grid blacksmith-warehouse-grid"
                selectedIndex={selectedWarehouseIndex}
                contextLabel="대장간 창고"
                isItemHighlighted={(entry) =>
                  Boolean(selectableCandidateForInstance(entry.instance))
                }
                isItemFlashing={(entry) => {
                  const candidate = candidateForInstance(entry.instance);
                  return Boolean(
                    candidate &&
                    upgradeFlashKey === smithyTargetKey(candidate.target),
                  );
                }}
                isItemSelectable={(entry) =>
                  Boolean(selectableCandidateForInstance(entry.instance))
                }
                onItemSelect={(entry) => {
                  const candidate = selectableCandidateForInstance(entry.instance);
                  if (candidate) selectCandidate(candidate);
                }}
              />
            </section>
            <section className="blacksmith-source-panel blacksmith-companion-panel" aria-labelledby="blacksmith-companion-title">
              <header className="commerce-column-header">
                <div><p className="eyebrow">COMPANIONS</p><h3 id="blacksmith-companion-title">동료 장비</h3></div>
                <span>{campaign.companions.length}명</span>
              </header>
              <p>모든 동료와 현재 장착 중인 장비를 표시합니다.</p>
              <CampaignCompanionEquipmentRoster
                companions={campaign.companions}
                placement="reserve"
                selectedItemKey={selectedTargetKey}
                emptyMessage="등록된 동료가 없습니다."
                itemSelectionKey={(_companion, _target, entry) => {
                  const candidate = selectableCandidateForInstance(entry.instance);
                  return candidate ? smithyTargetKey(candidate.target) : null;
                }}
                isItemHighlighted={(_companion, _target, entry) =>
                  Boolean(selectableCandidateForInstance(entry.instance))
                }
                isItemFlashing={(_companion, _target, entry) => {
                  const candidate = candidateForInstance(entry.instance);
                  return Boolean(
                    candidate &&
                    upgradeFlashKey === smithyTargetKey(candidate.target),
                  );
                }}
                onItemSelect={(_companion, _target, entry) => {
                  const candidate = selectableCandidateForInstance(entry.instance);
                  if (candidate) selectCandidate(candidate);
                }}
              />
            </section>
          </div>
          <aside className="blacksmith-workbench">
            {selected && currentGrade ? (
              <>
                <div className="blacksmith-selected-item">
                  <span
                    className={[
                      "blacksmith-item-icon",
                      "is-large",
                      "blacksmith-target-slot",
                      upgradeFlashKey === smithyTargetKey(selected.target)
                        ? "is-upgrade-flashing"
                        : "",
                    ].filter(Boolean).join(" ")}
                    {...(slotDrag?.addressAttributes({ zone: "smithyTarget" }, null) ?? {})}
                  ><ItemSlotContents itemId={selected.itemId} size={52} instance={selected.instance} quantity={1} /></span>
                  <div><small>{selected.ownerLabel}</small><h3>{ITEM_DEFS[selected.itemId]?.name}</h3><span>{ITEM_CATEGORY_NAMES[ITEM_DEFS[selected.itemId].category]}</span></div>
                </div>
                {activeTab === "grade" ? <>
                  <div className="blacksmith-grade-step">
                    <span data-item-grade={currentGrade}><small>현재</small><b>{currentGrade}</b></span>
                    <i aria-hidden="true">→</i>
                    <span data-item-grade={nextGrade ?? currentGrade}><small>{nextGrade ? "승급 후" : "최고 등급"}</small><b>{nextGrade ?? currentGrade}</b></span>
                  </div>
                  {nextGrade && requirements.length > 0 ? (
                  <>
                    <dl className="blacksmith-requirement-list">
                      {requirements.map((requirement) => (
                        <div
                          className={requirement.satisfied ? "is-satisfied" : "is-missing"}
                          key={`${requirement.resourceKind}:${requirement.resourceId}`}
                        >
                          <dt>
                            <small>{requirement.resourceKind === "currency" ? "통화" : "재료"}</small>
                            <strong>{requirementLabel(requirement.resourceId, requirement.resourceKind)}</strong>
                          </dt>
                          <dd>
                            <span>보유 {requirement.resourceId === "gold" ? `${formatGold(requirement.owned)} G` : `${requirement.owned}개`}</span>
                            <span>필요 {requirement.resourceId === "gold" ? `${formatGold(requirement.required)} G` : `${requirement.required}개`}</span>
                            <b>{requirement.satisfied ? "충족" : "부족"}</b>
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <button type="button" className="blacksmith-upgrade-button" disabled={!requirementsMet} onClick={() => {
                      if (onUpgrade(selected.target)) flashSelected();
                    }}>
                      {requirementsMet
                        ? `${currentGrade} → ${nextGrade} 등급 강화`
                        : unmetRequirement?.resourceId === "gold"
                          ? `${formatGold(unmetRequirement.required - unmetRequirement.owned)} G 부족`
                          : `${unmetRequirement ? requirementLabel(unmetRequirement.resourceId, unmetRequirement.resourceKind) : "강화 재료"} 부족`}
                    </button>
                  </>
                ) : (
                  <p className="blacksmith-max-grade">최대 등급입니다.</p>
                  )}
                </> : <>
                  <section className="blacksmith-enchantment-panel" aria-label="현재 인챈트">
                    <header><strong>현재 인챈트</strong><span>{enchantments.length}줄 · 고정 {lockedIndexes.size}줄</span></header>
                    <div>
                      {enchantments.map((trait, index) => {
                        const locked = lockedIndexes.has(index);
                        return (
                          <button
                            type="button"
                            className={locked ? "is-locked" : ""}
                            data-enchantment-grade={trait.grade}
                            key={`${trait.id}-${trait.grade}-${index}`}
                            onClick={() => toggleLock(index)}
                          >
                            <em>{trait.grade}</em>
                            <span><strong>{trait.name}</strong><small>{trait.description}</small></span>
                            <b>{locked ? "🔒 고정" : "고정"}</b>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  <dl className="blacksmith-requirement-list">
                    <div className={campaign.materials.runestone >= rerollRunestoneCost ? "is-satisfied" : "is-missing"}>
                      <dt><small>재료</small><strong>룬석</strong></dt>
                      <dd><span>보유 {campaign.materials.runestone}개</span><span>필요 {rerollRunestoneCost}개</span><b>{campaign.materials.runestone >= rerollRunestoneCost ? "충족" : "부족"}</b></dd>
                    </div>
                    <div className={lockScrolls >= lockedIndexes.size ? "is-satisfied" : "is-missing"}>
                      <dt><small>재료</small><strong>인챈트 고정 주문서</strong></dt>
                      <dd><span>보유 {lockScrolls}개</span><span>필요 {lockedIndexes.size}개</span><b>{lockScrolls >= lockedIndexes.size ? "충족" : "부족"}</b></dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="blacksmith-upgrade-button"
                    disabled={!rerollRequirementsMet}
                    onClick={() => {
                      if (onRerollEnchantments(
                        selected.target,
                        [...lockedIndexes].sort((a, b) => a - b),
                      )) {
                        flashSelected();
                        setLockSelection({
                          revision: selectionRevision,
                          indexes: new Set(),
                        });
                        setLockNotice(null);
                      }
                    }}
                  >
                    {enchantments.length === lockedIndexes.size
                      ? "변경할 인챈트가 없습니다."
                      : campaign.materials.runestone < rerollRunestoneCost
                        ? `룬석 ${rerollRunestoneCost - campaign.materials.runestone}개 부족`
                        : "인챈트 변경"}
                  </button>
                </>}
              </>
            ) : (
              <div
                className="blacksmith-empty blacksmith-empty-target"
                {...(slotDrag?.addressAttributes({ zone: "smithyTarget" }, null) ?? {})}
              >
                <span className="blacksmith-item-icon is-large"><i aria-hidden="true">+</i></span>
                <p>{activeTab === "grade" ? "승급할 아이템을 선택하세요." : "인챈트를 변경할 아이템을 선택하세요."}</p>
              </div>
            )}
          </aside>
        </div>
        <footer><button type="button" onClick={onClose}>닫기</button></footer>
      </section>
    </div>
  );
}

type TrainingSkillDragData =
  | {
      source: "pool";
      companionId: string;
      skillId: CompanionSkillId;
    }
  | {
      source: "slot";
      companionId: string;
      skillId: CompanionSkillId;
      index: 0 | 1;
    };

const setTrainingSkillDragData = (
  event: ReactDragEvent<HTMLElement>,
  data: TrainingSkillDragData,
) => {
  event.dataTransfer.setData(
    "application/x-nokpick-skill",
    JSON.stringify(data),
  );
  event.dataTransfer.effectAllowed = data.source === "slot" ? "move" : "copy";
};

const readTrainingSkillDragData = (
  event: ReactDragEvent<HTMLElement>,
): TrainingSkillDragData | null => {
  try {
    return JSON.parse(
      event.dataTransfer.getData("application/x-nokpick-skill"),
    ) as TrainingSkillDragData;
  } catch {
    return null;
  }
};

function TrainingGroundModal({
  campaign,
  warehouseNotice,
  onCampaignChange,
  onClose,
}: {
  campaign: CampaignSave;
  warehouseNotice: string | null;
  onCampaignChange: (campaign: CampaignSave) => void;
  onClose: () => void;
}) {
  const [selectedCompanionId, setSelectedCompanionId] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<CompanionSkillId | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const companion = campaign.companions.find(
    (candidate) => candidate.id === selectedCompanionId,
  ) ?? null;
  const profession = companion
    ? COMPANION_PROFESSIONS[companion.professionId]
    : null;
  const companionDefinition = companion
    ? characterPresentation(companion)
    : null;
  const learnedSkills = new Set(companion?.learnedSkills ?? companion?.skills ?? []);
  const selectedSkill = selectedSkillId ? COMPANION_SKILLS[selectedSkillId] : null;
  const selectedLearned = selectedSkillId ? learnedSkills.has(selectedSkillId) : false;
  const learnValidation = companion && selectedSkillId
    ? canLearnCompanionSkill(campaign, companion.id, selectedSkillId)
    : null;
  const selectedSkillLevel = selectedLearned && selectedSkillId
    ? normalizeCompanionSkillLevel(companion?.skillLevels?.[selectedSkillId])
    : 0;
  const levelRequirement = selectedLearned && selectedSkillId
    ? skillLevelRequirements(selectedSkillId, selectedSkillLevel)
    : null;
  const levelValidation = companion && selectedLearned && selectedSkillId
    ? canLevelCompanionSkill(campaign, companion.id, selectedSkillId)
    : null;

  const selectCompanion = (companionId: string) => {
    setSelectedCompanionId(companionId);
    setSelectedSkillId(null);
    setNotice(null);
  };
  const learnSelected = () => {
    if (!companion || !selectedSkillId) return;
    const result = learnCompanionSkill(campaign, companion.id, selectedSkillId);
    if (result.changed) {
      onCampaignChange(result.campaign);
      setNotice(`${COMPANION_SKILLS[selectedSkillId].nameKo} 습득 · ${formatGold(result.cost)} G 사용`);
      return;
    }
    setNotice(
      result.reason === "not-enough-gold"
        ? `골드 부족 · ${formatGold(campaign.gold)} / ${formatGold(result.cost)}`
        : result.reason === "not-enough-materials"
          ? "훈련 재료가 부족합니다."
          : "스킬을 배울 수 없습니다.",
    );
  };
  const equipSkill = (skillId: CompanionSkillId, index?: 0 | 1) => {
    if (!companion) return;
    const result = equipCompanionSkill(campaign, companion.id, skillId, index);
    if (result.changed) {
      onCampaignChange(result.campaign);
      setNotice(`${COMPANION_SKILLS[skillId].nameKo} 장착 완료`);
      return;
    }
    setNotice(
      result.reason === "slot-required"
        ? "교체할 스킬 슬롯으로 드래그하세요."
        : result.reason === "already-equipped"
          ? "이미 장착 중인 스킬입니다."
          : "배운 스킬만 장착할 수 있습니다.",
    );
  };
  const levelSelected = () => {
    if (!companion || !selectedSkillId) return;
    const result = levelCompanionSkill(campaign, companion.id, selectedSkillId);
    if (result.changed && result.requirement) {
      onCampaignChange(result.campaign);
      setNotice(
        `${COMPANION_SKILLS[selectedSkillId].nameKo} Lv.${result.requirement.nextLevel} 달성 · ${formatGold(result.requirement.gold)} G 사용`,
      );
      return;
    }
    setNotice(
      result.reason === "maximum-level"
        ? "이미 최대 레벨입니다."
        : result.reason === "not-enough-gold"
          ? "레벨 업에 필요한 골드가 부족합니다."
          : result.reason === "not-enough-materials"
            ? "레벨 업에 필요한 재료가 부족합니다."
            : "이 스킬의 레벨을 올릴 수 없습니다.",
    );
  };
  const dropOnSkillSlot = (
    event: ReactDragEvent<HTMLElement>,
    index: 0 | 1,
  ) => {
    event.preventDefault();
    if (!companion) return;
    const data = readTrainingSkillDragData(event);
    if (!data || data.companionId !== companion.id) return;
    const result = data.source === "slot"
      ? swapCompanionSkills(campaign, companion.id, data.index, index)
      : equipCompanionSkill(campaign, companion.id, data.skillId, index);
    if (!result.changed) return;
    onCampaignChange(result.campaign);
    setNotice("장착 스킬을 변경했습니다. 골드는 소모되지 않습니다.");
  };

  return (
    <div className="modal-backdrop blacksmith-backdrop">
      <section
        className="blacksmith-modal training-ground-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-ground-title"
      >
        <header>
          <div><p className="eyebrow">TRAINING GROUND</p><h2 id="training-ground-title">훈련장</h2></div>
          <div className="commerce-wallet material-wallet">
            <span><small>보유 골드</small><b>{formatGold(campaign.gold)} G</b></span>
            <span><small>씨앗</small><b>{campaign.materials.seed}개</b></span>
            <span><small>포션</small><b>{campaign.materials.potion}개</b></span>
          </div>
          <button type="button" onClick={onClose} aria-label="훈련장 닫기">×</button>
        </header>
        <p className="blacksmith-lead">동료는 스킬을 제한 없이 배울 수 있지만, 원정에는 두 개만 장착할 수 있습니다.</p>
        {(warehouseNotice ?? notice) && (
          <p className="commerce-notice" role="status">
            {warehouseNotice ?? notice}
          </p>
        )}
        <div className="blacksmith-layout training-ground-layout">
          <div className="blacksmith-source-panels">
            <section className="blacksmith-source-panel" aria-labelledby="training-warehouse-title">
              <header className="commerce-column-header">
                <div><p className="eyebrow">WAREHOUSE</p><h3 id="training-warehouse-title">창고</h3></div>
                <span>{warehouseItemCount(campaign.warehouse)}개</span>
              </header>
              <p>보유 자산 확인용입니다. 아이템은 스킬 슬롯에 놓을 수 없습니다.</p>
              <CampaignWarehouseInventory
                warehouse={campaign.warehouse}
                className="preparation-storage-grid blacksmith-warehouse-grid"
                contextLabel="훈련장 창고"
              />
            </section>
            <section className="blacksmith-source-panel blacksmith-companion-panel" aria-labelledby="training-companion-title">
              <header className="commerce-column-header">
                <div><p className="eyebrow">COMPANIONS</p><h3 id="training-companion-title">동료 목록</h3></div>
                <span>{campaign.companions.length}명</span>
              </header>
              <p>동료를 더블클릭하거나 오른쪽 훈련 대상으로 드래그하세요.</p>
              <CampaignCompanionEquipmentRoster
                companions={campaign.companions}
                placement="training"
                selectedCompanionIds={selectedCompanionId ? [selectedCompanionId] : []}
                emptyMessage="등록된 동료가 없습니다."
                onTrainingSelect={selectCompanion}
              />
            </section>
          </div>
          <aside className="blacksmith-workbench training-workbench">
            <section
              className={`training-target ${companion ? "is-selected" : "is-empty"}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const companionId = readCompanionDragData(event);
                if (campaign.companions.some((candidate) => candidate.id === companionId)) {
                  selectCompanion(companionId);
                }
              }}
            >
              {companion ? (
                <>
                  <div className="training-target-profile">
                    <PixelSpriteFrame
                      file={companionDefinition!.sprite}
                      sheetWidth={companionDefinition!.sheetWidth}
                      frameWidth={companionDefinition!.frameWidth}
                      frameHeight={companionDefinition!.frameHeight}
                      frame={companionDefinition!.animationSet === "companion"
                        ? companionFrameIndex(companionArmorTier(companion), COMPANION_IDLE_FRAMES[0])
                        : PLAYER_IDLE_FRAMES[0]}
                      size={56}
                    />
                    <div><small>훈련 대상 · {profession?.nameKo}</small><h3>{companion.name}</h3><span>LV.{companion.level}</span></div>
                  </div>
                  <CharacterResourceBars character={companion} />
                </>
              ) : <p>훈련할 동료를 선택하세요.</p>}
            </section>
            {companion && profession && (
              <>
                <section className="training-equipped-section">
                  <h3>장착 스킬</h3>
                  <div className="training-equipped-slots">
                    {([0, 1] as const).map((index) => {
                      const skillId = companion.skills[index] ?? null;
                      return (
                        <button
                          type="button"
                          className={`fixed-item-slot training-skill-slot ${skillId ? "is-filled" : "is-empty"}`}
                          key={`equipped-skill-${index}`}
                          title={skillId ? `${COMPANION_SKILLS[skillId].nameKo} · 더블클릭해 해제` : `스킬 슬롯 ${index + 1}`}
                          draggable={Boolean(skillId)}
                          onDragStart={(event) => {
                            if (skillId) setTrainingSkillDragData(event, { source: "slot", companionId: companion.id, skillId, index });
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => dropOnSkillSlot(event, index)}
                          onClick={() => skillId && setSelectedSkillId(skillId)}
                          onDoubleClick={() => {
                            if (!skillId) return;
                            const result = unequipCompanionSkill(campaign, companion.id, index);
                            if (result.changed) onCampaignChange(result.campaign);
                          }}
                        >
                          {skillId
                            ? <>
                                <ActiveSlotContents entry={{ kind: "skill", skillId }} size={42} />
                                <span className="skill-level-badge">Lv.{normalizeCompanionSkillLevel(companion.skillLevels?.[skillId])}</span>
                              </>
                            : <span className="empty-slot-glyph">+</span>}
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section className="training-skill-pool">
                  <h3>{profession.nameKo} 스킬</h3>
                  <div className="training-skill-grid">
                    {profession.skillPool.map((skillId) => {
                      const skill = COMPANION_SKILLS[skillId];
                      const learned = learnedSkills.has(skillId);
                      const equipped = companion.skills.includes(skillId);
                      return (
                        <button
                          type="button"
                          className={`fixed-item-slot training-skill-card ${learned ? "is-learned" : "is-unlearned"} ${equipped ? "is-equipped" : ""} ${selectedSkillId === skillId ? "is-selected" : ""}`}
                          key={skillId}
                          title={`${skill.nameKo}${learned ? " · 습득" : ` · ${skill.trainingCost} G`}`}
                          draggable={learned}
                          onDragStart={(event) => setTrainingSkillDragData(event, { source: "pool", companionId: companion.id, skillId })}
                          onClick={() => setSelectedSkillId(skillId)}
                          onDoubleClick={() => learned && equipSkill(skillId)}
                        >
                          <ActiveSlotContents entry={{ kind: "skill", skillId }} size={42} />
                          {learned && (
                            <span className="skill-level-badge">Lv.{normalizeCompanionSkillLevel(companion.skillLevels?.[skillId])}</span>
                          )}
                          <small>{skill.nameKo}</small>
                          <b>{learned ? (equipped ? "장착" : "습득") : `${skill.trainingCost} G`}</b>
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section className="training-skill-detail">
                  {selectedSkill ? (
                    <>
                      <header><span style={{ background: selectedSkill.accent }} /><div><small>{selectedLearned ? `Lv.${selectedSkillLevel} / ${MAX_COMPANION_SKILL_LEVEL}` : "미습득 스킬"}</small><h3>{selectedSkill.nameKo}</h3></div></header>
                      <p>{selectedSkill.descriptionKo}</p>
                      <dl>
                        <div><dt>소모</dt><dd className={`is-${selectedSkill.resourceType}`}>{selectedSkill.resourceType === "stamina" ? "기력" : "마나"} {formatSkillResourceAmount(selectedSkill.resourceCost)}</dd></div>
                        <div><dt>재사용 대기</dt><dd>{selectedSkill.cooldown}턴</dd></div>
                        <div><dt>사거리</dt><dd>{selectedSkill.range}칸</dd></div>
                        {selectedLearned ? (
                          <>
                            <div><dt>현재 효과</dt><dd>{companionSkillEffectSummary(selectedSkill.id, selectedSkillLevel)}</dd></div>
                            {levelRequirement ? (
                              <>
                                <div><dt>다음 레벨</dt><dd>{companionSkillEffectSummary(selectedSkill.id, levelRequirement.nextLevel)}</dd></div>
                                <div className={campaign.gold >= levelRequirement.gold ? "is-satisfied" : "is-missing"}><dt>Gold</dt><dd>{formatGold(campaign.gold)} / {formatGold(levelRequirement.gold)}</dd></div>
                                {(["seed", "potion"] as const).map((kind) => {
                                  const required = levelRequirement.materials[kind] ?? 0;
                                  const owned = campaign.materials[kind];
                                  return (
                                    <div className={owned >= required ? "is-satisfied" : "is-missing"} key={`level-${kind}`}>
                                      <dt>{CAMPAIGN_MATERIAL_NAMES[kind]}</dt>
                                      <dd>{owned} / {required}</dd>
                                    </div>
                                  );
                                })}
                              </>
                            ) : (
                              <div><dt>성장</dt><dd>최대 레벨</dd></div>
                            )}
                          </>
                        ) : (
                          <div><dt>훈련 비용</dt><dd>{formatGold(selectedSkill.trainingCost)} G</dd></div>
                        )}
                        {!selectedLearned && CAMPAIGN_MATERIAL_KINDS.flatMap((kind) => {
                          const required = selectedSkill.trainingMaterials[kind] ?? 0;
                          if (required <= 0) return [];
                          const owned = campaign.materials[kind];
                          return [(
                            <div className={owned >= required ? "is-satisfied" : "is-missing"} key={`training-${kind}`}>
                              <dt>{CAMPAIGN_MATERIAL_NAMES[kind]}</dt>
                              <dd>{owned} / {required}</dd>
                            </div>
                          )];
                        })}
                      </dl>
                      {!selectedLearned && (
                        <button type="button" disabled={!learnValidation?.changed} onClick={learnSelected}>
                          {learnValidation?.reason === "not-enough-gold"
                            ? `골드 부족 · ${formatGold(campaign.gold)} / ${formatGold(selectedSkill.trainingCost)}`
                            : learnValidation?.reason === "not-enough-materials"
                              ? "훈련 재료 부족"
                              : "배우기"}
                        </button>
                      )}
                      {selectedLearned && levelRequirement && (
                        <button type="button" disabled={!levelValidation?.changed} onClick={levelSelected}>
                          레벨 업
                        </button>
                      )}
                      {selectedLearned && !levelRequirement && (
                        <p className="training-max-level">최대 레벨</p>
                      )}
                    </>
                  ) : <p>스킬을 선택하면 상세 정보와 훈련 비용을 확인할 수 있습니다.</p>}
                </section>
              </>
            )}
          </aside>
        </div>
        <footer><button type="button" onClick={onClose}>닫기</button></footer>
      </section>
    </div>
  );
}

function PreparationScreen({
  dungeon,
  campaign,
  developerMode,
  loadout,
  selectedCompanionIds,
  onCompanionToggle,
  onBack,
  onStart,
}: {
  dungeon: DungeonDefinition;
  campaign: CampaignSave;
  developerMode: boolean;
  loadout: ExpeditionLoadout;
  selectedCompanionIds: string[];
  onCompanionToggle: (id: string) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const slotDrag = useActiveItemSlotDrag();
  const [itemPreview, setItemPreview] = useState<ItemDetailPreview | null>(null);
  const [companionDropTarget, setCompanionDropTarget] = useState<
    "party" | "party-disabled" | "reserve" | null
  >(null);
  const occupiedBagSlots = selectedLoadoutSlotCount(loadout);
  const selectedRefs = new Set([
    ...Object.keys(loadout.stacks).filter((itemId) => loadout.stacks[itemId] > 0),
    ...loadout.instanceIds,
  ]);
  const bagSlots = normalizeFixedSlots(
    loadout.slotRefs,
    [...selectedRefs],
    MAX_INVENTORY_SLOTS,
  );
  const preparationSharedInventory = {
    inventory: loadout.stacks,
    throwableProfiles: Object.fromEntries(
      Object.entries(loadout.stacks).flatMap(([itemId, quantity]) => {
        if (ITEM_DEFS[itemId]?.category !== "missile" || quantity <= 0) {
          return [];
        }
        const profile = campaign.warehouse.throwableProfiles[itemId];
        return [[
          itemId,
          {
            ...(profile ?? {
              id: `throwable-${itemId}`,
              defId: itemId,
            }),
            charges: quantity,
            maxCharges: quantity,
            baseMaxCharges: quantity,
          } satisfies InventoryInstance,
        ]];
      }),
    ),
  };
  const resolveStoredItem = (itemRef: string) =>
    resolveWarehouseItemRef(campaign.warehouse, itemRef);
  const renderStoredSlot = (
    address: ItemSlotAddress,
    itemRef: string | null,
    key: string,
  ) => {
    const entry = itemRef ? resolveStoredItem(itemRef) : null;
    if (!entry) {
      return (
        <div
          className="fixed-item-slot is-empty"
          key={key}
          {...(slotDrag?.addressAttributes(address, null) ?? {})}
        />
      );
    }
    return (
      <button
        type="button"
        className={[
          "fixed-item-slot",
          "is-filled",
          slotDrag?.heldAddressKey === itemSlotAddressKey(address)
            ? "is-drag-source"
            : "",
        ].filter(Boolean).join(" ")}
        key={key}
        title={`${ITEM_DEFS[entry.itemId]?.name ?? entry.itemId} ×${entry.quantity}`}
        onClick={(event) =>
          setItemPreview({
            itemId: entry.itemId,
            itemRef: entry.itemRef,
            instance: entry.instance,
            quantity: entry.quantity,
            contextLabel:
              address.zone === "warehouse" ? "창고" : "원정 가방",
            anchor: descriptionAnchorFromElement(event.currentTarget),
          })
        }
        {...(slotDrag?.addressAttributes(address, {
          itemRef: entry.itemRef,
          itemId: entry.itemId,
          quantity: entry.quantity,
          upgradeLevel: entry.instance?.upgradeLevel,
          charges: entry.instance?.charges,
          maxCharges: entry.instance?.maxCharges,
        }) ?? {})}
      >
        <ItemSlotContents
          itemId={entry.itemId}
          size={40}
          instance={entry.instance}
          quantity={entry.quantity}
          showQuantity={entry.quantity > 1}
        />
      </button>
    );
  };
  const selectedCompanions = selectedCompanionIds.flatMap((companionId) => {
    const companion = campaign.companions.find(
      (candidate) => candidate.id === companionId,
    );
    return companion ? [companion] : [];
  });
  const reserveCompanions = campaign.companions.filter(
    (companion) => !selectedCompanionIds.includes(companion.id),
  );
  useEffect(() => {
    if (!companionDropTarget) return;
    const clearCompanionDropTarget = () => setCompanionDropTarget(null);
    window.addEventListener("dragend", clearCompanionDropTarget);
    return () => window.removeEventListener("dragend", clearCompanionDropTarget);
  }, [companionDropTarget]);
  const handleCompanionDragOver = (
    event: ReactDragEvent<HTMLElement>,
    target: "party" | "reserve",
  ) => {
    if (!hasCompanionDragData(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setCompanionDropTarget(
      target === "party" && selectedCompanionIds.length >= 3
        ? "party-disabled"
        : target,
    );
  };
  const handleCompanionDragLeave = (
    event: ReactDragEvent<HTMLElement>,
    target: "party" | "reserve",
  ) => {
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) return;
    setCompanionDropTarget((current) =>
      current === target ||
      (target === "party" && current === "party-disabled")
        ? null
        : current,
    );
  };
  const handleCompanionDrop = (
    event: ReactDragEvent<HTMLElement>,
    target: "party" | "reserve",
  ) => {
    event.preventDefault();
    setCompanionDropTarget(null);
    const companionId = readCompanionDragData(event);
    if (
      !companionId ||
      !campaign.companions.some(({ id }) => id === companionId)
    ) {
      return;
    }
    const selected = selectedCompanionIds.includes(companionId);
    if (target === "party") {
      if (selected || selectedCompanionIds.length >= 3) return;
    } else if (!selected) {
      return;
    }
    onCompanionToggle(companionId);
  };
  return (
    <main className="campaign-page preparation-page">
      <header className="preparation-header">
        <button type="button" onClick={onBack}>← 던전 선택</button>
        <div>
          <p className="eyebrow">EXPEDITION PREPARATION</p>
          <h1>탐사 준비</h1>
        </div>
        <span>원정대 최대 3명 · 첫 번째 동료를 직접 조작 · 가방 {MAX_INVENTORY_SLOTS}칸</span>
      </header>
      <section className="selected-contract" style={{ "--dungeon-accent": dungeon.accent } as CSSProperties}>
        <div><small>선택한 던전</small><h2>{dungeon.nameKo}</h2><p>{dungeon.descriptionKo}</p></div>
        <dl><div><dt>난이도</dt><dd><span className="difficulty-pips" aria-hidden="true">{[1, 2, 3, 4, 5, 6, 7].map((pip) => <i key={pip} className={pip <= dungeon.difficulty ? "is-on" : ""} />)}</span><b className="difficulty-grade">{dungeon.difficultyGrade}</b>{dungeon.difficultyLabelKo}</dd></div><div><dt>깊이</dt><dd>{dungeon.floorCount}층</dd></div></dl>
      </section>
      {developerMode && (
        <DeveloperDungeonLoot dungeon={dungeon} onInspect={setItemPreview} />
      )}
      <div className="preparation-workspace">
        <div className="preparation-inventory-stack">
          <section className="preparation-panel preparation-bag-panel">
            <header><div><small>01</small><h2>인게임 인벤토리</h2></div><span>{occupiedBagSlots}/{MAX_INVENTORY_SLOTS}칸</span></header>
            <p>이 {MAX_INVENTORY_SLOTS}칸에 놓인 아이템만 던전 안으로 가져갑니다.</p>
            <div className="fixed-item-grid preparation-bag-grid">
              {bagSlots.map((itemRef, index) =>
                renderStoredSlot(
                  { zone: "preparationInventory", index },
                  itemRef,
                  `prep-bag-${index}`,
                ),
              )}
            </div>
          </section>
          <section className="preparation-panel preparation-storage-panel">
            <header><div><small>02</small><h2>창고 인벤토리</h2></div><span>{warehouseItemCount(campaign.warehouse)}개</span></header>
            <p>아이템을 길게 눌러 위 가방이나 오른쪽 장비칸으로 옮깁니다.</p>
            <CampaignWarehouseInventory
              warehouse={campaign.warehouse}
              className="preparation-storage-grid"
              hiddenItemRefs={selectedRefs}
              contextLabel="창고"
            />
          </section>
        </div>

        <section
          className={[
            "preparation-equipment-panel",
            "preparation-party-panel",
            companionDropTarget === "party" ? "is-companion-drop-target" : "",
            companionDropTarget === "party-disabled"
              ? "is-companion-drop-disabled"
              : "",
          ].filter(Boolean).join(" ")}
          onDragOver={(event) => handleCompanionDragOver(event, "party")}
          onDragLeave={(event) => handleCompanionDragLeave(event, "party")}
          onDrop={(event) => handleCompanionDrop(event, "party")}
        >
          <header>
            <div><small>03</small><h2>동행 원정대 장비</h2></div>
            <span>{selectedCompanions.length}/3명 · 첫 번째 인원이 조작 캐릭터</span>
          </header>
          <CampaignCompanionEquipmentRoster
            companions={selectedCompanions}
            placement="party"
            selectedCompanionIds={selectedCompanionIds}
            controlledCompanionId={selectedCompanionIds[0] ?? null}
            sharedInventory={preparationSharedInventory}
            emptyMessage="아래 대기 목록에서 조작할 첫 동료를 선택해 주세요."
            onCompanionToggle={onCompanionToggle}
          />
        </section>

        <section
          className={[
            "preparation-reserve-panel",
            companionDropTarget === "reserve" ? "is-companion-drop-target" : "",
          ].filter(Boolean).join(" ")}
          onDragOver={(event) => handleCompanionDragOver(event, "reserve")}
          onDragLeave={(event) => handleCompanionDragLeave(event, "reserve")}
          onDrop={(event) => handleCompanionDrop(event, "reserve")}
        >
          <header>
            <div><small>04</small><h2>동행하지 않는 동료</h2></div>
            <span>{reserveCompanions.length}명 대기</span>
          </header>
          <CampaignCompanionEquipmentRoster
            companions={reserveCompanions}
            placement="reserve"
            selectedCompanionIds={selectedCompanionIds}
            sharedInventory={preparationSharedInventory}
            emptyMessage="모든 동료가 이번 원정에 동행합니다."
            onCompanionToggle={onCompanionToggle}
            isCompanionToggleDisabled={(companion) =>
              !selectedCompanionIds.includes(companion.id) &&
              selectedCompanionIds.length >= 3
            }
          />
        </section>
      </div>
      <footer className="preparation-footer">
        <div><span>선택 물자 <b>{Object.values(loadout.stacks).reduce((sum, quantity) => sum + quantity, 0) + loadout.instanceIds.length}개</b></span><span>동행 인원 <b>{selectedCompanionIds.length}명</b></span></div>
        <button type="button" onClick={onStart} disabled={selectedCompanionIds.length === 0}>원정 시작 <span aria-hidden="true">→</span></button>
      </footer>
      {itemPreview && (
        <ItemDetailModal
          game={null}
          selected={{
            itemId: itemPreview.itemId,
            itemRef: itemPreview.itemRef,
          }}
          preview={itemPreview}
          readOnly
          onClose={() => setItemPreview(null)}
        />
      )}
    </main>
  );
}

function ResultsScreen({
  result,
  onReturn,
}: {
  result: ExpeditionResultView;
  onReturn: () => void;
}) {
  const dungeon = result.dungeon;
  const outcomeTitle =
    result.outcome === "completed"
      ? "원정 완료"
      : result.outcome === "defeated"
        ? "원정대 귀환"
        : "중도 귀환";
  const outcomeCopy =
    result.outcome === "completed"
      ? `${dungeon.nameKo}의 마지막 층까지 탐사를 마쳤습니다.`
      : result.outcome === "defeated"
        ? "전투는 끝났지만, 회수한 물품은 창고로 옮겨졌습니다."
        : "위험이 커지기 전에 확보한 전리품과 함께 귀환했습니다.";
  return (
    <main className="campaign-page results-page">
      <section className={`results-card is-${result.outcome}`}>
        <div className="results-emblem" aria-hidden="true"><span /></div>
        <p className="eyebrow">EXPEDITION REPORT</p>
        <h1>{outcomeTitle}</h1>
        <strong>{dungeon.nameKo}</strong>
        <p>{outcomeCopy}</p>
        <div className="results-metrics">
          <article><small>쓰러뜨린 적</small><b>{result.stats.enemiesDefeated}</b><span>명</span></article>
          <article><small>획득 경험치</small><b>{result.stats.experienceEarned}</b><span>XP</span></article>
          <article><small>탐사 시간</small><b>{formatElapsedTime(result.stats.elapsedSeconds)}</b><span>분:초</span></article>
          <article><small>도달 층</small><b>{result.stats.deepestFloor}</b><span>/{dungeon.floorCount}층</span></article>
          <article><small>소요 턴</small><b>{result.stats.turns}</b><span>턴</span></article>
          <article><small>회수 물품</small><b>{result.stats.recoveredItems}</b><span>개</span></article>
          <article className="gold-metric"><small>획득 골드</small><b>{formatGold(result.stats.goldFound + result.stats.completionGold)}</b><span>파밍 {formatGold(result.stats.goldFound)} + 수고비 {formatGold(result.stats.completionGold)}</span></article>
        </div>
        {CAMPAIGN_MATERIAL_KINDS.some((kind) => result.materialsGained[kind] > 0) && (
          <section className="results-materials" aria-label="이번 원정에서 획득한 재화">
            <strong>획득 재화</strong>
            {CAMPAIGN_MATERIAL_KINDS.flatMap((kind) =>
              result.materialsGained[kind] > 0
                ? [<span key={kind}>{CAMPAIGN_MATERIAL_NAMES[kind]} +{result.materialsGained[kind]}</span>]
                : [],
            )}
          </section>
        )}
        <section className="results-loot-grid" aria-label="이번 원정에서 새로 얻은 아이템">
          <header>
            <div><small>NEW LOOT</small><strong>새로 얻은 아이템</strong></div>
            <span>{result.stats.loot.reduce((total, item) => total + item.quantity, 0)}개</span>
          </header>
          <div className="fixed-item-grid results-item-grid">
            {Array.from({ length: MAX_INVENTORY_SLOTS }, (_, index) => {
              const loot = result.stats.loot[index];
              return loot ? (
                <div className="fixed-item-slot is-filled" key={`${loot.itemId}-${index}`} title={ITEM_DEFS[loot.itemId]?.name}>
                  <ItemSlotContents
                    itemId={loot.itemId}
                    size={40}
                    quantity={loot.quantity}
                    showQuantity={loot.quantity > 1}
                  />
                </div>
              ) : (
                <div className="fixed-item-slot is-empty" key={`result-empty-${index}`} />
              );
            })}
          </div>
        </section>
        <div className="results-loot-note"><span aria-hidden="true">▣</span><p><strong>전리품 정리 완료</strong>포션·씨앗·룬석은 재화로 환전하고, 나머지 아이템은 창고로 이동했습니다.</p></div>
        <button type="button" onClick={onReturn}>거점으로 돌아가기</button>
      </section>
    </main>
  );
}

type DungeonRunProps = {
  initialGame: GameState;
  dungeon: DungeonDefinition;
  audioRuntimeRef: MutableRefObject<GameAudioRuntime | null>;
  uiScale: number;
  fontScale: number;
  language: UiLanguage;
  soundEnabled: boolean;
  developerMode: boolean;
  onScaleChange: (scale: number) => void;
  onFontScaleChange: (scale: number) => void;
  onLanguageChange: (language: UiLanguage) => void;
  onSoundEnabledChange: (enabled: boolean) => void;
  onDeveloperModeChange: (enabled: boolean) => void;
  onGameSave: (game: GameState) => void;
  onFinish: (
    outcome: ExpeditionOutcome,
    game: GameState,
    stats: ExpeditionStats,
  ) => void;
};

function DungeonRun({
  initialGame,
  dungeon,
  audioRuntimeRef,
  uiScale,
  fontScale,
  language,
  soundEnabled,
  developerMode,
  onScaleChange,
  onFontScaleChange,
  onLanguageChange,
  onSoundEnabledChange,
  onDeveloperModeChange,
  onGameSave,
  onFinish,
}: DungeonRunProps) {
  const [game, setGame] = useState<GameState>(() =>
    cloneGameWithoutTiles(initialGame),
  );
  const [gameOverPresentationReady, setGameOverPresentationReady] =
    useState(initialGame.gameOver);
  const [busy, setBusy] = useState(false);
  const [autoExploring, setAutoExploring] = useState(false);
  const [stopAutoExploreOnFullBag] = useState(true);
  const [autoDescendAfterExplore] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] =
    useState<InventorySelection | null>(null);
  const [pendingEquipmentConsumable, setPendingEquipmentConsumable] =
    useState<PendingEquipmentConsumable | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compendiumOpen, setCompendiumOpen] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [assetLoadError, setAssetLoadError] = useState<string | null>(null);
  const [assetLoadAttempt, setAssetLoadAttempt] = useState(0);
  const [hoveredEnemy, setHoveredEnemy] = useState<Enemy | null>(null);
  const [inspectMode, setInspectMode] = useState(false);
  const [inspectedEntity, setInspectedEntity] =
    useState<InspectedEntity | null>(null);
  const [throwingItemId, setThrowingItemId] = useState<string | null>(null);
  const [castingItemId, setCastingItemId] = useState<string | null>(null);
  const [pendingCompanionSkill, setPendingCompanionSkill] =
    useState<PendingCompanionSkill | null>(null);
  const [pendingQuickslotAim, setPendingQuickslotAim] =
    useState<PendingQuickslotAim | null>(null);
  const manualPartyMode = false;
  const [controlledActorId, setControlledActorId] = useState(PLAYER_ID);
  const [manualActedIds, setManualActedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingLoadoutItemRef, setPendingLoadoutItemRef] =
    useState<string | null>(null);
  const [companionLoadoutSelection, setCompanionLoadoutSelection] =
    useState<CompanionLoadoutSelection | null>(null);
  const [playerLoadoutSelection, setPlayerLoadoutSelection] =
    useState<PlayerLoadoutSelection | null>(null);
  const [inspectedEffect, setInspectedEffect] =
    useState<InspectedEffect | null>(null);
  const [activeLoadoutOwnerId, setActiveLoadoutOwnerId] =
    useState(PLAYER_ID);
  const { upgradeFlashKey, flashUpgradeKey } = useUpgradeFlashFeedback();
  const [alchemyOpen, setAlchemyOpen] = useState(false);
  const [questPrompt, setQuestPrompt] = useState<{
    npcId: string;
    questId: string;
  } | null>(null);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  const gameRef = useRef(game);
  const onFinishRef = useRef(onFinish);
  const finishRequestedRef = useRef(false);
  const runStatsRef = useRef({
    startedAt: 0,
    enemiesDefeated: 0,
    experienceEarned: 0,
    itemsFound: 0,
    deepestFloor: 1,
    loot: {} as Record<string, number>,
  });
  const busyRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fogTextureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderCacheRef = useRef<ReturnType<
    typeof createDungeonRenderCache
  > | null>(null);
  if (renderCacheRef.current === null) {
    renderCacheRef.current = createDungeonRenderCache();
  }
  const assetsRef = useRef<GameAssets | null>(null);
  const motionRef = useRef(new Map<string, VisualMotion>());
  const characterMoveCyclesRef = useRef<CharacterMoveCycleRuntime>(new Map());
  const effectsRef = useRef<FloatingEffect[]>([]);
  const pickupRef = useRef<PickupVisual[]>([]);
  const throwRef = useRef<ThrowVisual[]>([]);
  const magicRef = useRef<MagicVisualRuntime[]>([]);
  const statusSignalRef = useRef<StatusSignalVisual[]>([]);
  const pixelEffectsRef = useRef<PixelEffect[]>([]);
  const cameraShakesRef = useRef<PixelCameraShake[]>([]);
  const pixelFogRuntimeRef = useRef(createPixelFogRuntime());
  const entityFlashRef = useRef<EntityFlashVisual[]>([]);
  const defeatedEnemyVisualRef = useRef<DefeatedEnemyVisual[]>([]);
  const defeatedCompanionVisualRef = useRef<DefeatedCompanionVisual[]>([]);
  const hiddenGroundItemUntilRef = useRef(new Map<string, number>());
  const playerActionRef = useRef<PlayerActionAnimation | null>(null);
  const cameraRef = useRef({ x: 0, y: 0 });
  const cameraFollowRef = useRef(true);
  const cameraDragRef = useRef<CameraDrag | null>(null);
  const companionMapDragRef = useRef<CompanionMapDrag | null>(null);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const canvasPointersRef = useRef(new Map<number, CanvasPointer>());
  const pinchGestureRef = useRef<PinchGesture | null>(null);
  const lastWheelAtRef = useRef(0);
  const soundEnabledRef = useRef(true);
  const developerModeRef = useRef(false);
  const manualPartyModeRef = useRef(false);
  const controlledActorIdRef = useRef(PLAYER_ID);
  const manualActedIdsRef = useRef(new Set<string>());
  const manualResourceRegenExcludedIdsRef = useRef(new Set<string>());
  const targetingOverlayRef = useRef<TargetingOverlay | null>(null);
  const inspectModeRef = useRef(false);
  const hoverRef = useRef<Point | null>(null);
  const pathRef = useRef<Point[]>([]);
  const autoTravelRef = useRef(false);
  const autoExploreRef = useRef(false);
  const autoExploreCompanionCommandsRef = useRef(
    new Map<string, Companion["command"]>(),
  );
  const resumeAutoExploreAfterAugmentRef = useRef(false);
  const pendingTravelAfterAutoExploreRef = useRef<Point | null>(null);
  const pendingAutoExploreUiActionRef = useRef<
    (() => void | Promise<void>) | null
  >(null);
  const resumeAutoExploreAfterUiActionRef = useRef(false);
  const startAutoExploreRef = useRef<() => void>(() => undefined);
  const actionTokenRef = useRef(0);

  const flashUpgradeTarget = useCallback((target: UpgradeTarget) => {
    flashUpgradeKey(upgradeTargetVisualKey(target));
  }, [flashUpgradeKey]);

  const commitGame = useCallback((next: GameState) => {
    gameRef.current = next;
    setGame(next);
    onGameSave(next);
  }, [onGameSave]);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    runStatsRef.current.startedAt = Date.now();
  }, []);

  const recordRunProgress = useCallback(
    (before: GameState, after: GameState, pickups: ItemPickup[] = []) => {
      const survivors = new Set(after.enemies.map((enemy) => enemy.id));
      const defeated = before.enemies.filter((enemy) => !survivors.has(enemy.id));
      runStatsRef.current.enemiesDefeated += defeated.length;
      runStatsRef.current.experienceEarned += defeated.reduce(
        (total, enemy) => total + enemy.xp,
        0,
      );
      const newlyFound = newExpeditionPickups(pickups);
      runStatsRef.current.itemsFound += newlyFound.length;
      newlyFound.forEach((pickup) => {
        runStatsRef.current.loot[pickup.defId] =
          (runStatsRef.current.loot[pickup.defId] ?? 0) +
          Math.max(1, pickup.quantity ?? 1);
      });
      runStatsRef.current.deepestFloor = Math.max(
        runStatsRef.current.deepestFloor,
        after.floor,
      );
    },
    [],
  );

  const finishCurrentExpedition = useCallback(
    (outcome: ExpeditionOutcome) => {
      if (finishRequestedRef.current) return;
      finishRequestedRef.current = true;
      actionTokenRef.current += 1;
      autoExploreRef.current = false;
      autoTravelRef.current = false;
      pathRef.current = [];
      pendingTravelAfterAutoExploreRef.current = null;
      pendingAutoExploreUiActionRef.current = null;
      resumeAutoExploreAfterUiActionRef.current = false;
      resumeAutoExploreAfterAugmentRef.current = false;
      setAutoExploring(false);
      setPendingCompanionSkill(null);
      setPendingQuickslotAim(null);
      setBusy(false);
      busyRef.current = false;
      const state = gameRef.current;
      onFinishRef.current(outcome, state, {
        enemiesDefeated: runStatsRef.current.enemiesDefeated,
        experienceEarned: runStatsRef.current.experienceEarned,
        itemsFound: runStatsRef.current.itemsFound,
        deepestFloor: Math.max(runStatsRef.current.deepestFloor, state.floor),
        turns: Math.max(0, state.turn - 1),
        elapsedSeconds: Math.max(
          0,
          Math.round(
            (Date.now() - (runStatsRef.current.startedAt || Date.now())) / 1000,
          ),
        ),
        recoveredItems: 0,
        goldFound: state.goldCollected,
        completionGold: 0,
        loot: Object.entries(runStatsRef.current.loot).map(
          ([itemId, quantity]) => ({ itemId, quantity }),
        ),
      });
    },
    [],
  );

  const grantDeveloperItem = useCallback(
    (itemId: string) => {
      commitGame(developerGrantItem(gameRef.current, itemId));
    },
    [commitGame],
  );

  const spawnDeveloperEnemy = useCallback(
    (kind: EnemyKind) => {
      commitGame(developerSpawnEnemy(gameRef.current, kind));
    },
    [commitGame],
  );

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    developerModeRef.current = developerMode;
  }, [developerMode]);

  useEffect(() => {
    manualPartyModeRef.current = manualPartyMode;
  }, [manualPartyMode]);

  useEffect(() => {
    controlledActorIdRef.current = controlledActorId;
  }, [controlledActorId]);

  useEffect(() => {
    manualActedIdsRef.current = manualActedIds;
  }, [manualActedIds]);

  useEffect(() => {
    if (pendingCompanionSkill) {
      const definition = COMPANION_SKILLS[pendingCompanionSkill.skillId];
      const origin = partyActor(
        gameRef.current,
        pendingCompanionSkill.casterId,
      );
      targetingOverlayRef.current = {
        mode: "skill",
        originActorId: pendingCompanionSkill.casterId,
        suggestedTarget: pendingCompanionSkill.suggestedTarget,
        range: definition.range,
        targetableTiles: skillTargetableTiles(
          gameRef.current,
          origin,
          definition.range,
          definition.requiresLineOfFire,
        ),
        accent: definition.accent,
      };
      return;
    }
    if (pendingQuickslotAim) {
      targetingOverlayRef.current = {
        mode: "quickslot",
        originActorId: pendingQuickslotAim.ownerId,
        suggestedTarget: pendingQuickslotAim.suggestedTarget,
        range: null,
        targetableTiles: null,
        accent: "#8cecff",
      };
      return;
    }
    if (castingItemId) {
      targetingOverlayRef.current = {
        mode: "wand",
        originActorId: PLAYER_ID,
        suggestedTarget: null,
        range: null,
        targetableTiles: null,
        accent: "#b8a8ff",
      };
      return;
    }
    if (throwingItemId) {
      targetingOverlayRef.current = {
        mode: "throw",
        originActorId: PLAYER_ID,
        suggestedTarget: null,
        range: null,
        targetableTiles: null,
        accent: "#ffd486",
      };
      return;
    }
    targetingOverlayRef.current = null;
  }, [
    castingItemId,
    pendingCompanionSkill,
    pendingQuickslotAim,
    throwingItemId,
  ]);

  useEffect(() => {
    inspectModeRef.current = inspectMode;
  }, [inspectMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const lockPageScroll = (event: WheelEvent) => {
      event.preventDefault();
    };
    canvas.addEventListener("wheel", lockPageScroll, { passive: false });
    return () => canvas.removeEventListener("wheel", lockPageScroll);
  }, []);

  useEffect(() => {
    const runtime = audioRuntimeRef.current;
    if (!runtime) return;
    runtime.setMusic(dungeonMusicPath(dungeon, game.floor));
  }, [audioRuntimeRef, dungeon, game.floor]);

  useEffect(
    () => () => audioRuntimeRef.current?.setMusic(null),
    [audioRuntimeRef],
  );

  const playSound = useCallback(
    (
      name: GameSoundId,
      volume = 0.62,
      delay = 0,
      playbackRate = 1,
    ) => {
      if (!soundEnabledRef.current) return;
      const play = () => {
        if (!soundEnabledRef.current) return;
        audioRuntimeRef.current?.play(name, volume, playbackRate);
      };
      if (delay > 0) window.setTimeout(play, delay);
      else play();
    },
    [audioRuntimeRef],
  );

  const playWandSound = useCallback((wandId: string) => {
    if (!soundEnabledRef.current) return;
    const profiles: Record<
      string,
      { soundId: GameSoundId; volume: number; playbackRate?: number }
    > = {
      wand_magic_missile: { soundId: "skillMagic", volume: 0.52 },
      wand_frost: { soundId: "shatter", volume: 0.5, playbackRate: 0.88 },
      wand_fireblast: { soundId: "skillBlast", volume: 0.62 },
      wand_lightning: { soundId: "skillLightning", volume: 0.58 },
      wand_disintegration: { soundId: "skillMagic", volume: 0.58, playbackRate: 0.78 },
      wand_prismatic_light: { soundId: "skillMagic", volume: 0.54, playbackRate: 1.18 },
      wand_corrosion: { soundId: "skillGas", volume: 0.55 },
      wand_blast_wave: { soundId: "skillBlast", volume: 0.6, playbackRate: 0.84 },
      wand_corruption: { soundId: "skillShadow", volume: 0.57 },
      wand_living_earth: { soundId: "skillImpact", volume: 0.58, playbackRate: 0.86 },
      wand_regrowth: { soundId: "skillNature", volume: 0.55 },
      wand_transfusion: { soundId: "skillHeal", volume: 0.54 },
      wand_warding: { soundId: "skillMagic", volume: 0.5, playbackRate: 0.92 },
    };
    const profile =
      profiles[wandId] ??
      { soundId: "skillMagic" as GameSoundId, volume: 0.52 };
    audioRuntimeRef.current?.play(
      profile.soundId,
      profile.volume,
      profile.playbackRate ?? 1,
    );
  }, [audioRuntimeRef]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setAssetsReady(false);
      setAssetLoadError(null);
      try {
        const enemyKinds = Object.keys(ENEMY_SPRITES) as EnemyKind[];
        const characterSources = [...new Set(
          COMPANION_CLASS_IDS.map(
            (classId) => COMPANION_PRESENTATIONS[classId].sprite,
          ),
        )];
        const sources = [
          "/assets/environment/tiles_sewers.png",
          "/assets/environment/water0.png",
          "/assets/environment/terrain_features.png",
          "/assets/sprites/items.png",
          ...enemyKinds.map((kind) => ENEMY_SPRITES[kind].file),
          ...characterSources,
        ];
        const uniqueSources = [...new Set(sources)];
        const loadedImages = await Promise.all(
          uniqueSources.map((source) => loadImage(source, assetLoadAttempt)),
        );
        if (cancelled) return;
        const imagesBySource = new Map(
          uniqueSources.map((source, index) => [source, loadedImages[index]]),
        );
        const tiles = imagesBySource.get(
          "/assets/environment/tiles_sewers.png",
        );
        const water = imagesBySource.get("/assets/environment/water0.png");
        const terrainFeatures = imagesBySource.get(
          "/assets/environment/terrain_features.png",
        );
        const items = imagesBySource.get("/assets/sprites/items.png");
        if (!tiles || !water || !terrainFeatures || !items) {
          throw new Error("Essential map images are missing");
        }
        const enemies = enemyKinds.reduce(
          (record, kind) => {
            const image = imagesBySource.get(ENEMY_SPRITES[kind].file);
            if (!image) throw new Error(`Missing enemy image: ${kind}`);
            record[kind] = image;
            return record;
          },
          {} as Record<EnemyKind, HTMLImageElement>,
        );
        const characters = characterSources.reduce(
          (record, source) => {
            const image = imagesBySource.get(source);
            if (!image) throw new Error(`Missing character image: ${source}`);
            record[source] = image;
            return record;
          },
          {} as Record<string, HTMLImageElement>,
        );
        assetsRef.current = {
          tiles,
          water,
          terrainFeatures,
          items,
          enemies,
          characters,
        };
        setAssetsReady(true);
      } catch (error) {
        if (cancelled) return;
        setAssetsReady(false);
        setAssetLoadError(
          error instanceof Error ? error.message : "Asset loading failed",
        );
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [assetLoadAttempt]);

  const addVisuals = useCallback(
    (
      motions: Motion[],
      effects: CombatEffect[],
      duration?: number,
      delay = 0,
    ) => {
      const now = performance.now();
      motions.forEach((motion) => {
        const motionDuration =
          duration ?? durationForMotion(motion);
        const isWalkingMotion =
          motion.kind === "move" &&
          (motion.travelStyle === undefined || motion.travelStyle === "walk");
        const isPlayableCharacter =
          motion.id === PLAYER_ID ||
          (gameRef.current.companions ?? []).some(
            (companion) => companion.id === motion.id,
          );
        const motionStartedAt = isPlayableCharacter
          ? registerCharacterMotionCycle({
              runtime: characterMoveCyclesRef.current,
              actorId: motion.id,
              now,
              delay,
              duration: motionDuration,
              walking: isWalkingMotion,
            })
          : now + delay;
        motionRef.current.set(motion.id, {
          ...motion,
          startedAt: motionStartedAt,
          duration: motionDuration,
        });
        const movingPlayer =
          motion.id === PLAYER_ID && isWalkingMotion;
        const movingCompanion =
          isWalkingMotion &&
          (gameRef.current.companions ?? []).some(
            (companion) => companion.id === motion.id,
          );
        if (movingPlayer || movingCompanion) {
          const targetTile =
            gameRef.current.tiles[motion.to.y]?.[motion.to.x];
          const effectStartedAt =
            now + delay + motionDuration * 0.62;
          const origin = {
            idPrefix: `walk-${motion.id}-${now}-${motion.to.x}-${motion.to.y}`,
            x: (motion.to.x + 0.5) * TILE_SIZE,
            y: (motion.to.y + 0.82) * TILE_SIZE,
            startedAt: effectStartedAt,
          };
          pixelEffectsRef.current.push(
            ...(targetTile?.terrain === "water"
              ? createWaterRippleEffects(
                  origin,
                  connectedWaterTiles(
                    gameRef.current.tiles,
                    motion.to,
                  ).map((tile) => ({
                    ...tile,
                    surfaceRows: waterSurfaceMaskRows(
                      gameRef.current,
                      tile.x,
                      tile.y,
                    ),
                  })),
                  TILE_SIZE,
                )
              : createDustEffects(origin)),
          );
          playSound(
            targetTile?.terrain === "water" ? "water" : "step",
            movingPlayer
              ? targetTile?.terrain === "water"
                ? 0.72
                : 0.42
              : targetTile?.terrain === "water"
                ? 0.38
                : 0.24,
            delay + motionDuration * 0.62,
            targetTile?.terrain === "water"
              ? 0.8 + Math.random() * 0.45
              : 0.96 + Math.random() * 0.09,
          );
        }
      });
      const trajectories = createEffectTrajectories(effects.length);
      effectsRef.current.push(
        ...effects.map((effect, index) => ({
          ...effect,
          ...(effect.critical
            ? {
                velocityX: 0,
                velocityY: 0,
                gravity: 0,
                originOffsetX: 0,
                originOffsetY: 0,
              }
            : trajectories[index]),
          id: `${now}-${index}-${effect.text}`,
          startedAt: now + delay,
        })),
      );
    },
    [playSound],
  );

  const addImpactVisual = useCallback(
    ({
      point,
      delay,
      color,
      strong,
      targetId,
    }: {
      point: Point;
      delay: number;
      color: string;
      strong: boolean;
      targetId?: string;
    }) => {
      const startedAt = performance.now() + delay;
      const idPrefix = `impact-${startedAt}-${point.x}-${point.y}`;
      pixelEffectsRef.current.push(
        ...createHitEffects({
          idPrefix,
          x: (point.x + 0.5) * TILE_SIZE,
          y: (point.y + 0.47) * TILE_SIZE,
          startedAt,
          color,
          cold: color.includes("9de") || color.includes("8bd"),
          strong,
        }),
      );
      cameraShakesRef.current.push({
        id: `${idPrefix}-shake`,
        startedAt,
        duration: strong ? 280 : 210,
        amplitude: strong ? 7.5 : 4.5,
        seed: point.x * 17 + point.y * 31 + startedAt % 97,
      });
      if (targetId) {
        entityFlashRef.current.push({
          id: targetId,
          startedAt,
          duration: strong ? 190 : 145,
        });
      }
    },
    [],
  );

  const addLevelUpVisual = useCallback((delay = 0) => {
    const startedAt = performance.now() + delay;
    const player = gameRef.current.player;
    pixelEffectsRef.current.push(
      ...createLevelUpEffects({
        idPrefix: `level-up-${startedAt}`,
        x: (player.x + 0.5) * TILE_SIZE,
        y: (player.y + 0.52) * TILE_SIZE,
        startedAt,
      }),
    );
    cameraShakesRef.current.push({
      id: `level-up-shake-${startedAt}`,
      startedAt,
      duration: 520,
      amplitude: 1.8,
      seed: startedAt % 113,
    });
  }, []);

  const addEnchantVisual = useCallback((delay = 0) => {
    const startedAt = performance.now() + delay;
    const player = gameRef.current.player;
    pixelEffectsRef.current.push(
      ...createEnchantEffects({
        idPrefix: `enchant-${startedAt}`,
        x: (player.x + 0.5) * TILE_SIZE,
        y: (player.y + 0.52) * TILE_SIZE,
        startedAt,
      }),
    );
  }, []);

  const addPickupVisuals = useCallback(
    (pickups: ItemPickup[], delay = 0) => {
      if (!pickups.length) return;
      const now = performance.now();
      pickupRef.current.push(
        ...pickups.map((pickup, index) => ({
          ...pickup,
          startedAt: now + delay + index * 70,
        })),
      );
    },
    [],
  );

  const addThrowVisuals = useCallback((throws: ItemThrow[], delay = 0) => {
    if (!throws.length) return;
    const now = performance.now();
    throwRef.current.push(
      ...throws.map((itemThrow) => ({
        ...itemThrow,
        startedAt: now + delay,
        duration: throwVisualDuration(itemThrow),
      })),
    );
  }, []);

  const addMagicVisuals = useCallback((visuals: MagicVisual[], delay = 0) => {
    if (!visuals.length) return;
    const now = performance.now();
    magicRef.current.push(
        ...visuals.map((visual) => ({
          ...visual,
          startedAt: now + delay,
          duration: magicVisualDuration(visual),
      })),
    );
  }, []);

  const addSkillVisuals = useCallback(
    (visuals: CompanionSkillVisual[], delay = 0) => {
      if (!visuals.length) return;
      const now = performance.now() + delay;
      visuals.forEach((visual, index) => {
        pixelEffectsRef.current.push(
          ...createCompanionSkillEffects(
            visual,
            now + index * 35,
            TILE_SIZE,
          ),
        );
      });
    },
    [],
  );

  const addStatusSignals = useCallback(
    (signals: StatusSignal[], delay = 0, duration = 760) => {
      if (!signals.length) return [];
      const now = performance.now();
      const visuals = signals.map((signal, index) => ({
        ...signal,
        id: `${now}-${index}-${signal.text}`,
        startedAt: now + delay,
        duration,
      }));
      statusSignalRef.current.push(...visuals);
      return visuals.map(({ id }) => id);
    },
    [],
  );

  const startInteractionAnimation = useCallback(
    (delay = 0, duration = PLAYER_INTERACTION_DURATION) => {
      playerActionRef.current = {
        kind: "interact",
        startedAt: performance.now() + delay,
        duration,
      };
    },
    [],
  );

  const resolveAction = useCallback(
    async (result: ActionResult, token: number) => {
      // Release the previous turn's held alert only when a new turn begins.
      // A signal created later in this call therefore remains visible through
      // the complete ready phase instead of expiring with a 120ms timeline.
      const elapsedTurns =
        result.elapsedTurns ?? (result.consumedTurn ? 1 : 0);
      if (elapsedTurns > 0) {
        releaseHeldSignalsAtTurnStart(
          statusSignalRef.current,
          performance.now(),
        );
      }
      const visualStateBefore = gameRef.current;
      const previousLevel = visualStateBefore.player.level;
      const previousHp = visualStateBefore.player.hp;
      const previousMaxHp = visualStateBefore.player.maxHp;
      const didLevelUp = result.state.player.level > previousLevel;
      const withoutPendingAugmentModal = (state: GameState) =>
        didLevelUp && state.pendingAugmentOffers.length > 0
          ? { ...state, pendingAugmentOffers: [] }
          : state;
      const playerAttacked = result.motions.some(
        (motion) => motion.id === PLAYER_ID && motion.kind === "attack",
      );
      const pickups = result.pickups ?? [];
      const throws = result.throws ?? [];
      const magicVisuals = result.magicVisuals ?? [];
      const skillVisuals = result.skillVisuals ?? [];
      const soundCues = result.soundCues ?? [];
      const interactionEnd =
        result.interacted && !playerAttacked
          ? durationForInteraction(result.interactionKind)
          : 0;
      const throwEnd = throws.length
        ? Math.max(...throws.map(throwVisualDuration))
        : 0;
      const actionLeadEnd = Math.max(interactionEnd, throwEnd);
      const deferResolution =
        Boolean(result.presentationState) &&
        (playerAttacked || result.interacted || throws.length > 0);
      const sessionResolution = resolveGameSession(result, {
        playerInvincible: developerModeRef.current,
        manualParty: manualPartyModeRef.current,
      });
      commitGame(
        withoutPendingAugmentModal(
          deferResolution
            ? result.presentationState ?? result.state
            : result.state,
        ),
      );
      if (result.alchemyOpened) setAlchemyOpen(true);
      if (result.questInteraction) {
        setQuestPrompt({
          npcId: result.questInteraction.npcId,
          questId: result.questInteraction.questId,
        });
      }
      if (result.interacted && !playerAttacked) {
        startInteractionAnimation(0, interactionEnd);
      }
      if (result.enchanted) {
        addEnchantVisual(interactionEnd);
      }
      if (throws.length) {
        addThrowVisuals(throws);
        throws.forEach((itemThrow) => {
          const hitEffect = result.effects.find(
            (effect) =>
              [itemThrow.id, itemThrow.sourceId, `throw-${itemThrow.defId}`]
                .includes(timingSourceIdForEffect(effect)) &&
              effect.x === itemThrow.to.x &&
              effect.y === itemThrow.to.y &&
              isDamageEffect(effect),
          );
          if (!hitEffect) return;
          const targetEnemy = visualStateBefore.enemies.find(
            (enemy) =>
              enemy.x === itemThrow.to.x && enemy.y === itemThrow.to.y,
          );
          addImpactVisual({
            point: itemThrow.to,
            delay: throwImpactDelay(itemThrow),
            color: hitEffect.color,
            strong: true,
            targetId: targetEnemy?.id,
          });
        });
        if (!result.itemBreak) {
          const hardImpact = result.effects.some(isImpactEffect);
          playSound(
            hardImpact ? "hit" : "step",
            hardImpact ? 0.62 : 0.28,
            Math.max(...throws.map(throwImpactDelay)),
          );
        }
      }
      if (skillVisuals.length) {
        addSkillVisuals(skillVisuals);
      }
      if (pickups.length) {
        addPickupVisuals(pickups, interactionEnd);
        playSound("item", 0.66, interactionEnd);
      }
      soundCues
        .filter((cue) => !cue.atResolution)
        .forEach((cue) => playSound(cue.id, cue.volume ?? 0.62));
      if (sessionResolution.kind === "floorExit") {
        recordRunProgress(visualStateBefore, result.state, pickups);
        const timeline = createTurnMotionTimeline(
          result.motions,
          actionLeadEnd,
        );
        timeline.motions.forEach(({ motion, duration, delay }) => {
          addVisuals([motion], [], duration, delay);
        });
        const playerAttack = timeline.motions.find(
          ({ motion }) =>
            motion.id === PLAYER_ID && motion.kind === "attack",
        );
        addVisuals(
          [],
          result.effects,
          undefined,
          playerAttack
            ? playerAttack.delay +
              impactDelayForMotion(playerAttack.motion)
            : 0,
        );
        if (playerAttack) {
          const hitEffect = result.effects.find(
            (effect) =>
              effect.sourceId === playerAttack.motion.id &&
              isDamageEffect(effect),
          );
          if (hitEffect) {
            const targetEnemy = visualStateBefore.enemies.find(
              (enemy) =>
                enemy.x === playerAttack.motion.to.x &&
                enemy.y === playerAttack.motion.to.y,
            );
            addImpactVisual({
              point: playerAttack.motion.to,
              delay:
                playerAttack.delay +
                impactDelayForMotion(playerAttack.motion),
              color: hitEffect.color,
              strong: true,
              targetId: targetEnemy?.id,
            });
          }
          playSound(
            "hitSlash",
            0.68,
            playerAttack.delay + playerAttack.duration * 0.28,
          );
        }
        await wait(timeline.totalDuration);
        if (actionTokenRef.current !== token) return;
        const floorAdvance = completeFloorExit(sessionResolution);
        if (floorAdvance.kind === "completed") {
          commitGame(result.state);
          finishCurrentExpedition("completed");
          return;
        }
        if (floorAdvance.kind === "blocked") {
          commitGame(floorAdvance.state);
          return;
        }
        const nextFloor = floorAdvance.state;
        motionRef.current.clear();
        characterMoveCyclesRef.current.clear();
        playerActionRef.current = null;
        effectsRef.current = [];
        pickupRef.current = [];
        throwRef.current = [];
        magicRef.current = [];
        statusSignalRef.current = [];
        pixelEffectsRef.current = [];
        cameraShakesRef.current = [];
        entityFlashRef.current = [];
        defeatedEnemyVisualRef.current = [];
        defeatedCompanionVisualRef.current = [];
        hiddenGroundItemUntilRef.current.clear();
        resetPixelFogRuntime(pixelFogRuntimeRef.current);
        commitGame(nextFloor);
        runStatsRef.current.deepestFloor = Math.max(
          runStatsRef.current.deepestFloor,
          nextFloor.floor,
        );
        pathRef.current = [];
        cameraFollowRef.current = true;
        const zoom = zoomRef.current;
        cameraRef.current = clampCamera(
          {
            x:
              (nextFloor.player.x + 0.5) * TILE_SIZE -
              VIEW_WIDTH / (2 * zoom),
            y:
              (nextFloor.player.y + 0.5) * TILE_SIZE -
              VIEW_HEIGHT / (2 * zoom),
          },
          zoom,
          nextFloor,
        );
        return;
      }

      const {
        enemyTurns,
        enemyTurnStarts,
        state: resolvedState,
      } = sessionResolution;
      recordRunProgress(visualStateBefore, resolvedState, pickups);
      const playerDefeatPending =
        visualStateBefore.player.hp > 0 && resolvedState.player.hp <= 0;
      if (playerDefeatPending) {
        // Rule state and the durable save remain synchronous. Only the
        // expedition-end presentation waits for the lethal visual impact.
        setGameOverPresentationReady(false);
        commitGame(withoutPendingAugmentModal(resolvedState));
      }

      const allMotions = [
        ...result.motions,
        ...enemyTurns.flatMap((enemyTurn) => enemyTurn.motions),
      ];
      const allEffects = [
        ...result.effects,
        ...enemyTurns.flatMap((enemyTurn) => enemyTurn.effects),
      ];
      const allSignals = [
        ...(result.signals ?? []),
        ...enemyTurns.flatMap((enemyTurn) => enemyTurn.signals ?? []),
      ];
      const turnMagicVisuals = enemyTurns.flatMap(
        (enemyTurn) => enemyTurn.magicVisuals ?? [],
      );
      const turnWandSoundIds = enemyTurns.flatMap(
        (enemyTurn) => enemyTurn.wandSoundIds ?? [],
      );
      const turnPickups = enemyTurns.flatMap(
        (enemyTurn) => enemyTurn.pickups ?? [],
      );
      const turnThrows = enemyTurns.flatMap(
        (enemyTurn) => enemyTurn.throws ?? [],
      );
      const allResolutionSoundCues = [
        ...soundCues,
        ...enemyTurns.flatMap((enemyTurn) => enemyTurn.soundCues ?? []),
      ];
      const allTurnThrows = [...throws, ...turnThrows];
      const initialThrowSourceIds = new Set(
        throws.flatMap((itemThrow) =>
          itemThrow.sourceId ? [itemThrow.sourceId] : [],
        ),
      );
      const initialThrowHasAttackMotion = result.motions.some(
        (motion) =>
          motion.kind === "attack" && initialThrowSourceIds.has(motion.id),
      );
      const timeline = createTurnMotionTimeline(
        allMotions,
        initialThrowHasAttackMotion ? interactionEnd : actionLeadEnd,
      );
      timeline.motions.forEach(({ motion, duration, delay }) => {
        addVisuals([motion], [], duration, delay);
      });

      const pickupGroups = new Map<number, ItemPickup[]>();
      turnPickups.forEach((pickup) => {
        const interaction = pickup.sourceId
          ? timeline.motions.find(
              ({ motion }) =>
                motion.id === pickup.sourceId &&
                motion.kind === "interact",
            )
          : undefined;
        const delay = interaction
          ? interaction.delay + interaction.duration
          : actionLeadEnd;
        pickupGroups.set(delay, [
          ...(pickupGroups.get(delay) ?? []),
          pickup,
        ]);
      });
      pickupGroups.forEach((group, delay) => {
        addPickupVisuals(group, delay);
        playSound("item", 0.56, delay);
      });

      const attackSchedule = new Map(
        timeline.motions
          .filter(({ motion }) => motion.kind === "attack")
          .map((scheduled) => [scheduled.motion.id, scheduled]),
      );
      const skillTravelSchedule = new Map(
        timeline.motions
          .filter(
            ({ motion }) =>
              motion.kind === "move" &&
              motion.travelStyle !== undefined &&
              motion.travelStyle !== "walk",
          )
          .map((scheduled) => [scheduled.motion.id, scheduled]),
      );
      const attackImpactSchedule = new Map(
        [...attackSchedule].map(([sourceId, scheduled]) => [
          sourceId,
          scheduled.delay + impactDelayForMotion(scheduled.motion),
        ]),
      );
      const skillTravelImpactSchedule = new Map(
        [...skillTravelSchedule].map(([sourceId, scheduled]) => [
          sourceId,
          scheduled.delay + impactDelayForMotion(scheduled.motion),
        ]),
      );
      const throwImpactSchedule = new Map<string, number>();
      const rememberThrowImpact = (itemThrow: ItemThrow, delay: number) => {
        const impactAt = delay + throwImpactDelay(itemThrow);
        [itemThrow.id, itemThrow.sourceId, `throw-${itemThrow.defId}`]
          .filter((sourceId): sourceId is string => Boolean(sourceId))
          .forEach((sourceId) => throwImpactSchedule.set(sourceId, impactAt));
      };
      throws.forEach((itemThrow) => rememberThrowImpact(itemThrow, 0));
      turnThrows.forEach((itemThrow) => {
        const attack = itemThrow.sourceId
          ? attackSchedule.get(itemThrow.sourceId)
          : undefined;
        const delay = attack
          ? attack.delay + attack.duration * 0.18
          : actionLeadEnd;
        addThrowVisuals([itemThrow], delay);
        rememberThrowImpact(itemThrow, delay);
        const hitEffect = allEffects.find(
          (effect) =>
            [itemThrow.id, itemThrow.sourceId, `throw-${itemThrow.defId}`]
              .includes(timingSourceIdForEffect(effect)) &&
            effect.x === itemThrow.to.x &&
            effect.y === itemThrow.to.y &&
            isDamageEffect(effect),
        );
        if (hitEffect) {
          addImpactVisual({
            point: itemThrow.to,
            delay: delay + throwImpactDelay(itemThrow),
            color: hitEffect.color,
            strong: true,
            targetId: visualStateBefore.enemies.find(
              (enemy) =>
                enemy.x === itemThrow.to.x && enemy.y === itemThrow.to.y,
            )?.id,
          });
        }
        playSound(
          hitEffect ? "hit" : "step",
          hitEffect ? 0.58 : 0.25,
          delay + throwImpactDelay(itemThrow),
        );
      });
      const magicImpactSchedule = new Map<string, number>();
      const scheduleMagicVisual = (
        visual: MagicVisual,
        delay: number,
        wandSoundId?: string,
      ) => {
        addMagicVisuals([visual], delay);
        if (visual.sourceId) {
          const impactAt = delay + magicVisualDuration(visual) * 0.82;
          const previous = magicImpactSchedule.get(visual.sourceId);
          magicImpactSchedule.set(
            visual.sourceId,
            previous === undefined ? impactAt : Math.min(previous, impactAt),
          );
        }
        if (wandSoundId) {
          if (delay <= 0) playWandSound(wandSoundId);
          else window.setTimeout(() => playWandSound(wandSoundId), delay);
        }
      };
      magicVisuals.forEach((visual, index) => {
        const attack = visual.sourceId
          ? attackSchedule.get(visual.sourceId)
          : undefined;
        const delay = attack
          ? attack.delay + attack.duration * 0.2
          : 0;
        scheduleMagicVisual(
          visual,
          delay,
          index === 0 ? result.wandSoundId : undefined,
        );
      });
      if (magicVisuals.length && !result.wandSoundId) {
        playSound("hit", 0.48, 120);
      }
      turnMagicVisuals.forEach((visual, index) => {
        const attack = visual.sourceId
          ? attackSchedule.get(visual.sourceId)
          : undefined;
        const delay = attack
          ? attack.delay + attack.duration * 0.2
          : actionLeadEnd;
        scheduleMagicVisual(visual, delay, turnWandSoundIds[index]);
      });
      const impactDelayForSource = (sourceId: string | undefined) =>
        impactTimeForSource(
          sourceId,
          [
            throwImpactSchedule,
            magicImpactSchedule,
            attackImpactSchedule,
            skillTravelImpactSchedule,
          ],
          actionLeadEnd,
        );
      const presentationDelayForEffect = (effect: CombatEffect) =>
        impactDelayForSource(timingSourceIdForEffect(effect)) +
        presentationOffsetForCombatEffect(effect);
      const defeatContexts = [
        {
          state: visualStateBefore,
          effects: result.effects,
          ids: result.defeatedIds ?? [],
        },
        ...enemyTurns.map((enemyTurn, index) => ({
          state: enemyTurnStarts[index],
          effects: enemyTurn.effects,
          ids: enemyTurn.defeatedIds ?? [],
        })),
      ];
      const defeatVisualStartedAt = performance.now();
      const deathSoundDelays = new Set<number>();
      const defeatEffectsByEnemyId = new Map<string, CombatEffect>();
      let latestDeathPresentationDelay = 0;
      defeatContexts.forEach((context) => {
        context.ids.forEach((enemyId) => {
          const enemy = context.state.enemies.find(
            (candidate) => candidate.id === enemyId,
          );
          if (!enemy) return;
          const killEffect = [...context.effects]
            .reverse()
            .find(
              (effect) =>
                isDefeatEffect(effect) &&
                effect.x === enemy.x &&
                effect.y === enemy.y,
            );
          const removalDelay = killEffect
            ? presentationDelayForEffect(killEffect)
            : actionLeadEnd + DEATH_EVENT_DELAY;
          if (killEffect) defeatEffectsByEnemyId.set(enemy.id, killEffect);
          latestDeathPresentationDelay = Math.max(
            latestDeathPresentationDelay,
            removalDelay,
          );
          deathSoundDelays.add(Math.max(0, Math.round(removalDelay)));
          if (removalDelay <= 0) return;
          defeatedEnemyVisualRef.current =
            defeatedEnemyVisualRef.current.filter(
              (visual) => visual.enemy.id !== enemy.id,
            );
          defeatedEnemyVisualRef.current.push({
            enemy: {
              ...enemy,
              statuses: (enemy.statuses ?? []).map((status) => ({
                ...status,
              })),
            },
            removeAt: defeatVisualStartedAt + removalDelay,
          });
        });
      });
      const companionDefeatContexts = [
        {
          before: visualStateBefore,
          after: result.state,
          effects: result.effects,
        },
        ...enemyTurns.map((enemyTurn, index) => ({
          before: enemyTurnStarts[index],
          after: enemyTurn.state,
          effects: enemyTurn.effects,
        })),
      ];
      companionDefeatContexts.forEach((context) => {
        const { before, after, effects } = context;
        before.companions
          .filter((companion) => {
            const resolved = after.companions.find(
              (candidate) => candidate.id === companion.id,
            );
            return companion.hp > 0 && Boolean(resolved && resolved.hp <= 0);
          })
          .forEach((companion) => {
            const defeatEffect = [...effects]
              .reverse()
              .find(
                (effect) =>
                  isDefeatEffect(effect) &&
                  effect.x === companion.x &&
                  effect.y === companion.y,
              );
            const revealDelay = defeatEffect
              ? presentationDelayForEffect(defeatEffect)
              : actionLeadEnd + DEATH_EVENT_DELAY;
            latestDeathPresentationDelay = Math.max(
              latestDeathPresentationDelay,
              revealDelay,
            );
            defeatedCompanionVisualRef.current =
              defeatedCompanionVisualRef.current.filter(
                (visual) => visual.companion.id !== companion.id,
              );
            defeatedCompanionVisualRef.current.push({
              companion: {
                ...companion,
                equipment: { ...companion.equipment },
                equipmentInstances: { ...companion.equipmentInstances },
                autoSlots: [...companion.autoSlots],
              },
              visibleMasks: captureVisibleMasks(before),
              revealAt: defeatVisualStartedAt + Math.max(0, revealDelay),
            });
            deathSoundDelays.add(Math.max(0, Math.round(revealDelay)));
          });
      });
      deathSoundDelays.forEach((delay) => {
        playSound("death", 0.7, delay);
      });
      const previousGroundItemIds = new Set(
        visualStateBefore.groundItems.map((item) => item.id),
      );
      defeatEffectsByEnemyId.forEach((effect, enemyId) => {
        const revealAt =
          defeatVisualStartedAt +
          impactDelayForSource(timingSourceIdForEffect(effect)) +
          worldRevealOffsetForDefeat(effect);
        resolvedState.groundItems
          .filter(
            (item) =>
              !previousGroundItemIds.has(item.id) &&
              groundItemComesFromDefeatedEnemy(item.id, enemyId),
          )
          .forEach((item) => {
            hiddenGroundItemUntilRef.current.set(item.id, revealAt);
          });
      });
      if (enemyTurns.length && !deferResolution && !playerDefeatPending) {
        commitGame(withoutPendingAugmentModal(resolvedState));
      }
      const effectGroups = new Map<number, CombatEffect[]>();
      allEffects.forEach((effect) => {
        const delay = presentationDelayForEffect(effect);
        effectGroups.set(delay, [
          ...(effectGroups.get(delay) ?? []),
          effect,
        ]);
      });
      effectGroups.forEach((effects, delay) => {
        addVisuals([], effects, undefined, delay);
      });
      allEffects
        .filter(
          (effect) =>
            (effect.deathChainDepth ?? 0) > 0 && isImpactEffect(effect),
        )
        .forEach((effect) => {
          const targetCompanion = visualStateBefore.companions.find(
            (companion) =>
              companion.x === effect.x && companion.y === effect.y,
          );
          const targetEnemy = visualStateBefore.enemies.find(
            (enemy) => enemy.x === effect.x && enemy.y === effect.y,
          );
          addImpactVisual({
            point: effect,
            delay: presentationDelayForEffect(effect),
            color: effect.color,
            strong: true,
            targetId:
              effect.x === visualStateBefore.player.x &&
              effect.y === visualStateBefore.player.y
                ? PLAYER_ID
                : targetCompanion?.id ?? targetEnemy?.id,
          });
        });
      timeline.motions
        .filter(({ motion }) => motion.kind === "attack")
        .forEach(({ motion }) => {
          if (
            allTurnThrows.some(
              (itemThrow) => itemThrow.sourceId === motion.id,
            )
          ) return;
          const hitEffect = allEffects.find(
            (effect) =>
              effect.sourceId === motion.id &&
              effect.x === motion.to.x &&
              effect.y === motion.to.y &&
              isImpactEffect(effect),
          );
          if (!hitEffect) return;
          const targetIsPlayer =
            motion.to.x === resolvedState.player.x &&
            motion.to.y === resolvedState.player.y &&
            motion.id !== PLAYER_ID;
          const targetCompanion = (resolvedState.companions ?? []).find(
            (companion) =>
              companion.id !== motion.id &&
              companion.x === motion.to.x &&
              companion.y === motion.to.y,
          );
          const targetEnemy = visualStateBefore.enemies.find(
            (enemy) =>
              enemy.id !== motion.id &&
              enemy.x === motion.to.x &&
              enemy.y === motion.to.y,
          );
          const attackerIsCompanion = (
            visualStateBefore.companions ?? []
          ).some((companion) => companion.id === motion.id);
          addImpactVisual({
            point: motion.to,
            delay: presentationDelayForEffect(hitEffect),
            color: hitEffect.color,
            strong:
              motion.id === PLAYER_ID ||
              attackerIsCompanion ||
              targetIsPlayer ||
              Boolean(targetCompanion),
            targetId: targetIsPlayer
              ? PLAYER_ID
              : targetCompanion?.id ?? targetEnemy?.id,
          });
        });
      const playerAttackSchedule = attackSchedule.get(PLAYER_ID);
      const playerImpactDelay = playerAttackSchedule
        ? playerAttackSchedule.delay +
          impactDelayForMotion(playerAttackSchedule.motion)
        : 0;
      const movementEnd = timeline.motions
        .filter(({ motion }) => motion.kind !== "attack")
        .reduce(
          (latest, motion) =>
            Math.max(latest, motion.delay + motion.duration),
          actionLeadEnd,
        );
      allSignals.forEach((signal) => {
        const attack = signal.sourceId
          ? attackSchedule.get(signal.sourceId)
          : undefined;
        const signalStart = attack
          ? attack.delay + attack.duration * 0.48
          : signal.holdUntilTurnEnd
            ? actionLeadEnd
            : movementEnd;
        const signalDuration = signal.holdUntilTurnEnd
          ? Math.max(620, timeline.totalDuration - signalStart)
          : 760;
        addStatusSignals(
          [signal],
          Math.max(0, signalStart),
          signalDuration,
        );
      });

      timeline.motions.forEach(({ motion, duration, delay }) => {
        if (motion.kind !== "attack") return;
        if (
          allTurnThrows.some(
            (itemThrow) => itemThrow.sourceId === motion.id,
          )
        ) return;
        playSound(
          motion.id === PLAYER_ID ? "hitSlash" : "hit",
          motion.id === PLAYER_ID ? 0.68 : 0.58,
          delay + duration * 0.28,
        );
      });
      const playerDefeatEffect = playerDefeatPending
        ? [...allEffects]
            .reverse()
            .find(
              (effect) =>
                isDamageEffect(effect) &&
                effect.x === resolvedState.player.x &&
                effect.y === resolvedState.player.y,
            )
        : undefined;
      const playerDefeatDelay = playerDefeatPending
        ? (playerDefeatEffect
            ? presentationDelayForEffect(playerDefeatEffect)
            : actionLeadEnd) + DEATH_EVENT_DELAY
        : 0;
      latestDeathPresentationDelay = Math.max(
        latestDeathPresentationDelay,
        playerDefeatDelay,
      );
      const actionResolutionDelay = playerAttackSchedule
        ? Math.max(playerImpactDelay, throwEnd, interactionEnd)
        : throwEnd || interactionEnd;
      const resolutionDelay = playerDefeatPending
        ? Math.max(actionResolutionDelay, playerDefeatDelay)
        : actionResolutionDelay;
      if (didLevelUp) {
        addLevelUpVisual(resolutionDelay + 20);
        playSound("levelUp", 0.72, resolutionDelay + 20);
      }
      allResolutionSoundCues
        .filter((cue) => cue.atResolution)
        .forEach((cue) =>
          playSound(cue.id, cue.volume ?? 0.62, resolutionDelay),
        );
      if (
        previousHp / Math.max(1, previousMaxHp) >= 0.2 &&
        resolvedState.player.hp / Math.max(1, resolvedState.player.maxHp) < 0.2
      ) {
        playSound("healthWarn", 0.72, resolutionDelay);
      }
      if (
        result.consumedTurn ||
        result.motions.length ||
        result.effects.length
      ) {
        const totalDuration = Math.max(
          MIN_ACTION_DURATION,
          timeline.totalDuration,
          actionLeadEnd,
          latestDeathPresentationDelay,
          didLevelUp
            ? resolutionDelay + LEVEL_UP_EFFECT_HOLD
            : 0,
        );
        if (deferResolution || playerDefeatPending) {
          await wait(resolutionDelay);
          if (actionTokenRef.current !== token) return;
          if (playerDefeatPending) {
            setGameOverPresentationReady(true);
          } else {
            commitGame(withoutPendingAugmentModal(resolvedState));
          }
          await wait(Math.max(0, totalDuration - resolutionDelay));
        } else {
          await wait(totalDuration);
        }
        if (didLevelUp && actionTokenRef.current === token) {
          commitGame(resolvedState);
        }
      }
    },
    [
      addMagicVisuals,
      addEnchantVisual,
      addImpactVisual,
      addLevelUpVisual,
      addPickupVisuals,
      addStatusSignals,
      addSkillVisuals,
      addThrowVisuals,
      addVisuals,
      commitGame,
      finishCurrentExpedition,
      playSound,
      playWandSound,
      recordRunProgress,
      startInteractionAnimation,
    ],
  );

  const selectControlledActor = useCallback((actorId: string) => {
    const state = gameRef.current;
    if (!livingPartyIds(state).includes(actorId)) return;
    controlledActorIdRef.current = actorId;
    setControlledActorId(actorId);
    setActiveLoadoutOwnerId(actorId);
    cameraFollowRef.current = true;
    setPendingCompanionSkill(null);
    setPendingQuickslotAim(null);
    setThrowingItemId(null);
    setCastingItemId(null);
  }, []);

  const resolvePartyAction = useCallback(
    async (
      result: ActionResult,
      token: number,
      actorId = controlledActorIdRef.current,
    ) => {
      if (!manualPartyModeRef.current) {
        await resolveAction(result, token);
        return;
      }
      if (manualActedIdsRef.current.has(actorId)) return;
      const deferred = deferActionForManualRound(gameRef.current, result);
      await resolveAction(deferred, token);
      if (
        actionTokenRef.current !== token ||
        !deferred.consumedTurn ||
        gameRef.current.gameOver
      ) {
        return;
      }

      const acted = new Set(manualActedIdsRef.current);
      acted.add(actorId);
      const resourceRegenExcluded = new Set(
        manualResourceRegenExcludedIdsRef.current,
      );
      (deferred.resourceRegenExcludedActorIds ?? []).forEach((id) =>
        resourceRegenExcluded.add(id),
      );
      const living = livingPartyIds(gameRef.current);
      const allReady = living.every((id) => acted.has(id));
      if (!allReady) {
        manualActedIdsRef.current = acted;
        manualResourceRegenExcludedIdsRef.current = resourceRegenExcluded;
        setManualActedIds(new Set(acted));
        const nextActor = living.find((id) => !acted.has(id));
        if (nextActor) selectControlledActor(nextActor);
        return;
      }

      manualActedIdsRef.current = new Set();
      manualResourceRegenExcludedIdsRef.current = new Set();
      setManualActedIds(new Set());
      await resolveAction(
        advanceManualPartyRound(
          gameRef.current,
          [...resourceRegenExcluded],
        ),
        token,
      );
      if (actionTokenRef.current !== token || gameRef.current.gameOver) return;
      const nextLiving = livingPartyIds(gameRef.current);
      const nextActor = nextLiving.includes(PLAYER_ID)
        ? PLAYER_ID
        : nextLiving[0];
      if (nextActor) selectControlledActor(nextActor);
    },
    [resolveAction, selectControlledActor],
  );

  const runExclusive = useCallback(
    async (action: (token: number) => Promise<void>) => {
      if (
        busyRef.current ||
        gameRef.current.gameOver ||
        gameRef.current.pendingAugmentOffers.length > 0
      ) return;
      busyRef.current = true;
      setBusy(true);
      const token = ++actionTokenRef.current;
      try {
        await action(token);
      } finally {
        if (actionTokenRef.current === token) {
          busyRef.current = false;
          setBusy(false);
        }
      }
    },
    [],
  );

  const performDuringAutoExplore = useCallback(
    (action: () => void | Promise<void>) => {
      if (!autoExploreRef.current) {
        return action();
      }
      pendingAutoExploreUiActionRef.current = action;
      resumeAutoExploreAfterUiActionRef.current = true;
      autoExploreRef.current = false;
      setAutoExploring(false);
    },
    [],
  );

  const autoPickupIfSafe = useCallback(
    async (token: number) => {
      if (
        actionTokenRef.current !== token ||
        !shouldAutoPickup(gameRef.current)
      ) {
        return;
      }
      await resolveAction(
        pickupGroundItems(gameRef.current, false),
        token,
      );
    },
    [resolveAction],
  );

  const move = useCallback(
    (dx: number, dy: number) => {
      void runExclusive(async (token) => {
        pathRef.current = [];
        const actorId = manualPartyModeRef.current
          ? controlledActorIdRef.current
          : PLAYER_ID;
        const result = actorId === PLAYER_ID
          ? playerStep(gameRef.current, dx, dy)
          : manualCompanionStep(gameRef.current, actorId, dx, dy);
        await resolvePartyAction(result, token, actorId);
        if (!manualPartyModeRef.current) await autoPickupIfSafe(token);
      });
    },
    [autoPickupIfSafe, resolvePartyAction, runExclusive],
  );

  const waitOneTurn = useCallback(() => {
    void runExclusive(async (token) => {
      pathRef.current = [];
      const actorId = manualPartyModeRef.current
        ? controlledActorIdRef.current
        : PLAYER_ID;
      const result = actorId === PLAYER_ID
        ? waitTurn(gameRef.current)
        : manualCompanionWait(gameRef.current, actorId);
      await resolvePartyAction(result, token, actorId);
    });
  }, [resolvePartyAction, runExclusive]);

  const beginCompanionSkill = useCallback(
    (casterId: string, skillId: CompanionSkillId) => {
      if (busyRef.current || gameRef.current.gameOver) return;
      if (
        manualPartyModeRef.current &&
        manualActedIdsRef.current.has(casterId)
      ) return;
      if (
        manualPartyModeRef.current &&
        controlledActorIdRef.current !== casterId
      ) {
        selectControlledActor(casterId);
      }
      const sameAim =
        pendingCompanionSkill?.casterId === casterId &&
        pendingCompanionSkill.skillId === skillId;
      if (sameAim && pendingCompanionSkill.suggestedTarget) {
        const target = pendingCompanionSkill.suggestedTarget;
        setPendingCompanionSkill(null);
        void runExclusive(async (token) => {
          const result = activateCompanionSkill(
            gameRef.current,
            casterId,
            skillId,
            target,
          );
          await resolvePartyAction(result, token, casterId);
        });
        return;
      }
      setPendingCompanionSkill({
        casterId,
        skillId,
        suggestedTarget: suggestedSkillTarget(
          gameRef.current,
          casterId,
          skillId,
        ),
      });
      setPendingQuickslotAim(null);
      setThrowingItemId(null);
      setCastingItemId(null);
      setInspectMode(false);
      setInspectedEntity(null);
      setSelectedInventoryItem(null);
      setPendingLoadoutItemRef(null);
      setPendingEquipmentConsumable(null);
      hoverRef.current = null;
      pathRef.current = [];
      autoTravelRef.current = false;
    },
    [
      pendingCompanionSkill,
      resolvePartyAction,
      runExclusive,
      selectControlledActor,
    ],
  );

  const firePendingQuickslot = useCallback(
    async (aim: PendingQuickslotAim, target: Point, token: number) => {
      const result = aim.ownerId === PLAYER_ID
        ? aim.action === "wand"
          ? zapWand(gameRef.current, aim.itemRef, target)
          : aim.action === "throw"
            ? throwItem(gameRef.current, aim.itemRef, target)
            : consumeItemAction(gameRef.current, aim.itemRef)
        : activateCompanionQuickslot(
            gameRef.current,
            aim.ownerId,
            aim.slotIndex,
            target,
          );
      if (result.consumedTurn) setPendingQuickslotAim(null);
      await resolvePartyAction(result, token, aim.ownerId);
    },
    [resolvePartyAction],
  );

  const beginPartyQuickslot = useCallback(
    (ownerId: string, slotIndex: number) => {
      if (busyRef.current) return;
      const state = gameRef.current;
      const owner = ownerId === PLAYER_ID
        ? state.player
        : state.companions.find(
            (companion) => companion.id === ownerId && companion.hp > 0,
          );
      if (!owner) return;
      const playerItemRef = ownerId === PLAYER_ID
        ? state.player.autoSlots[slotIndex] ?? null
        : null;
      const companionSlot = ownerId === PLAYER_ID
        ? null
        : (owner as Companion).autoSlots[slotIndex] ?? null;
      const itemRef = playerItemRef ??
        companionSlot?.instance?.id ??
        companionSlot?.defId ??
        null;
      const itemId = playerItemRef
        ? state.player.inventoryInstances.find(
            (instance) => instance.id === playerItemRef,
          )?.defId ?? playerItemRef
        : companionSlot?.defId ?? null;
      const definition = itemId ? ITEM_DEFS[itemId] : null;
      if (!itemRef || !itemId || !definition) return;

      if (ownerId === PLAYER_ID && isEquipmentConsumableId(itemId)) {
        setPendingQuickslotAim(null);
        setPendingCompanionSkill(null);
        setThrowingItemId(null);
        setCastingItemId(null);
        setSelectedInventoryItem(null);
        setPendingLoadoutItemRef(null);
        setPendingEquipmentConsumable({ itemRef, itemId });
        return;
      }

      const action: PendingQuickslotAim["action"] =
        definition.category === "wand"
          ? "wand"
          : definition.category === "missile" ||
              (definition.category === "potion" && itemId !== "potion_healing")
            ? "throw"
            : "use";
      const aim: PendingQuickslotAim = {
        ownerId,
        slotIndex,
        itemRef,
        itemId,
        action,
        suggestedTarget: action === "use"
          ? { x: owner.x, y: owner.y }
          : (() => {
              const enemy = nearestVisibleEnemy(
                state,
                ownerId,
                definition.category === "wand" ? 10 : 8,
              );
              return enemy ? { x: enemy.x, y: enemy.y } : null;
            })(),
      };
      setActiveLoadoutOwnerId(ownerId);
      if (action === "use") {
        setPendingQuickslotAim(null);
        void runExclusive((token) =>
          firePendingQuickslot(aim, aim.suggestedTarget!, token),
        );
        return;
      }
      const sameAim =
        pendingQuickslotAim?.ownerId === ownerId &&
        pendingQuickslotAim.slotIndex === slotIndex;
      if (sameAim && pendingQuickslotAim.suggestedTarget) {
        const target = pendingQuickslotAim.suggestedTarget;
        void runExclusive((token) =>
          firePendingQuickslot(pendingQuickslotAim, target, token),
        );
        return;
      }
      setPendingQuickslotAim(aim);
      setPendingCompanionSkill(null);
      setThrowingItemId(null);
      setCastingItemId(null);
      setInspectMode(false);
      setInspectedEntity(null);
      setSelectedInventoryItem(null);
      setPendingLoadoutItemRef(null);
      setPendingEquipmentConsumable(null);
      hoverRef.current = null;
      pathRef.current = [];
      autoTravelRef.current = false;
    },
    [firePendingQuickslot, pendingQuickslotAim, runExclusive],
  );

  const handleUseOwnedItem = useCallback(
    (itemRef: string) => {
      setSelectedInventoryItem(null);
      setPendingLoadoutItemRef(null);
      setCompanionLoadoutSelection(null);
      setPlayerLoadoutSelection(null);
      setPendingCompanionSkill(null);
      setPendingQuickslotAim(null);
      const itemId =
        gameRef.current.player.inventoryInstances.find(
          (instance) => instance.id === itemRef,
        )?.defId ?? itemRef;
      if (isEquipmentConsumableId(itemId)) {
        setThrowingItemId(null);
        setCastingItemId(null);
        setPendingEquipmentConsumable({ itemRef, itemId });
        pathRef.current = [];
        return;
      }
      if (isWand(itemId)) {
        setThrowingItemId(null);
        setCastingItemId(null);
        setCastingItemId(itemRef);
        pathRef.current = [];
        return;
      }
      void runExclusive(async (token) => {
        await resolvePartyAction(
          consumeItemAction(gameRef.current, itemRef),
          token,
          PLAYER_ID,
        );
      });
    },
    [resolvePartyAction, runExclusive],
  );

  const applyPendingEquipmentConsumable = useCallback(
    (target: UpgradeTarget) => {
      const pending = pendingEquipmentConsumable;
      if (!pending) return;
      void performDuringAutoExplore(() =>
        runExclusive(async (token) => {
          const result = applyEquipmentConsumable(
            gameRef.current,
            pending.itemRef,
            target,
          );
          if (result.consumedTurn) {
            flashUpgradeTarget(target);
            setPendingEquipmentConsumable(null);
          }
          const actorId = target.kind === "companionEquipment" ||
              target.kind === "companionFlex"
            ? target.companionId
            : PLAYER_ID;
          await resolvePartyAction(result, token, actorId);
        }),
      );
    },
    [
      pendingEquipmentConsumable,
      performDuringAutoExplore,
      resolvePartyAction,
      runExclusive,
      flashUpgradeTarget,
    ],
  );

  const applyConsumableToPlayerLoadout = useCallback(
    (selection: PlayerLoadoutSelection) => {
      const target: UpgradeTarget = selection.kind === "equipment"
        ? { kind: "equipment", slot: selection.slot }
        : gameRef.current.player.equipment[FLEX_RING_KEYS[selection.index]]
          ? { kind: "equipment", slot: "ring", ringIndex: selection.index }
          : { kind: "playerAuto", index: selection.index };
      applyPendingEquipmentConsumable(target);
    },
    [applyPendingEquipmentConsumable],
  );

  const applyConsumableToCompanionLoadout = useCallback(
    (selection: CompanionLoadoutSelection) => {
      setActiveLoadoutOwnerId(selection.companionId);
      applyPendingEquipmentConsumable(
        selection.target.kind === "equipment"
          ? {
              kind: "companionEquipment",
              companionId: selection.companionId,
              slot: selection.target.slot,
            }
          : {
              kind: "companionFlex",
              companionId: selection.companionId,
              index: selection.target.index,
            },
      );
    },
    [applyPendingEquipmentConsumable],
  );

  const beginLoadoutAssignment = useCallback((itemRef: string) => {
    setSelectedInventoryItem(null);
    setPendingEquipmentConsumable(null);
    setCompanionLoadoutSelection(null);
    setPlayerLoadoutSelection(null);
    setPendingLoadoutItemRef(itemRef);
  }, []);

  const removeEquipment = useCallback(
    (target: PlayerLoadoutSelection) => {
      setSelectedInventoryItem(null);
      void performDuringAutoExplore(() =>
        runExclusive(async (token) => {
          await resolvePartyAction(
            unassignPlayerItem(gameRef.current, target),
            token,
            PLAYER_ID,
          );
        }),
      );
    },
    [performDuringAutoExplore, resolvePartyAction, runExclusive],
  );

  const selectCompanionLoadoutSlot = useCallback(
    (selection: CompanionLoadoutSelection) => {
      setActiveLoadoutOwnerId(selection.companionId);
      setSelectedInventoryItem(null);
      setPendingLoadoutItemRef(null);
      setPlayerLoadoutSelection(null);
      setCompanionLoadoutSelection(selection);
      window.requestAnimationFrame(() => {
        document
          .getElementById("persistent-inventory")
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    },
    [],
  );

  const selectPlayerLoadoutSlot = useCallback(
    (selection: PlayerLoadoutSelection) => {
      setActiveLoadoutOwnerId(PLAYER_ID);
      setSelectedInventoryItem(null);
      setPendingLoadoutItemRef(null);
      setCompanionLoadoutSelection(null);
      setPlayerLoadoutSelection(selection);
      window.requestAnimationFrame(() => {
        document
          .getElementById("persistent-inventory")
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    },
    [],
  );

  const openPlayerLoadoutItem = useCallback(
    (
      selection: PlayerLoadoutSelection,
      itemId: string,
      itemRef: string,
      anchor: DescriptionAnchor,
    ) => {
      setActiveLoadoutOwnerId(PLAYER_ID);
      setPlayerLoadoutSelection(null);
      setCompanionLoadoutSelection(null);
      setPendingLoadoutItemRef(null);
      setSelectedInventoryItem({
        itemId,
        itemRef,
        playerLoadout: selection,
        anchor,
      });
    },
    [],
  );

  const openCompanionLoadoutItem = useCallback(
    (
      selection: CompanionLoadoutSelection,
      itemId: string,
      anchor: DescriptionAnchor,
    ) => {
      setActiveLoadoutOwnerId(selection.companionId);
      setPlayerLoadoutSelection(null);
      setCompanionLoadoutSelection(null);
      setPendingLoadoutItemRef(null);
      setSelectedInventoryItem({
        itemId,
        itemRef: itemId,
        companionLoadout: selection,
        anchor,
      });
    },
    [],
  );

  const assignSelectedPlayerItem = useCallback(
    (selection: PlayerLoadoutSelection, itemRef: string) => {
      setActiveLoadoutOwnerId(PLAYER_ID);
      setPlayerLoadoutSelection(null);
      setPendingLoadoutItemRef(null);
      void performDuringAutoExplore(() =>
        runExclusive(async (token) => {
          await resolvePartyAction(
            assignPlayerItem(gameRef.current, selection, itemRef),
            token,
            PLAYER_ID,
          );
        }),
      );
    },
    [performDuringAutoExplore, resolvePartyAction, runExclusive],
  );

  const unequipSelectedPlayerItem = useCallback(
    (selection: PlayerLoadoutSelection) => {
      setPlayerLoadoutSelection(null);
      removeEquipment(selection);
    },
    [removeEquipment],
  );

  const assignSelectedCompanionItem = useCallback(
    (
      selection: CompanionLoadoutSelection,
      itemRef: string,
    ) => {
      setActiveLoadoutOwnerId(selection.companionId);
      setCompanionLoadoutSelection(null);
      setPendingLoadoutItemRef(null);
      void performDuringAutoExplore(() =>
        runExclusive(async (token) => {
          await resolvePartyAction(
            assignCompanionItem(
              gameRef.current,
              selection.companionId,
              selection.target,
              itemRef,
            ),
            token,
            selection.companionId,
          );
        }),
      );
    },
    [performDuringAutoExplore, resolvePartyAction, runExclusive],
  );

  const fastEquipOwnedItem = useCallback(
    (itemRef: string) => {
      const state = gameRef.current;
      const itemId =
        state.player.inventoryInstances.find(
          (instance) => instance.id === itemRef,
        )?.defId ?? itemRef;
      const definition = ITEM_DEFS[itemId];
      if (!definition) return;
      const companion = state.companions.find(
        (candidate) => candidate.id === activeLoadoutOwnerId,
      );
      let target: LoadoutTarget | null = null;
      if (definition.slot === "weapon" || definition.slot === "armor") {
        const slot = definition.slot;
        const isEmpty = companion
          ? !companion.equipment[slot]
          : !state.player.equipment[slot];
        if (isEmpty) target = { kind: "equipment", slot };
      } else {
        const emptyIndex = FLEX_SLOT_INDEXES.find((index) => {
          const ringKey = FLEX_RING_KEYS[index];
          const empty = companion
            ? !companion.equipment[ringKey] && !companion.autoSlots[index]
            : !state.player.equipment[ringKey] && !state.player.autoSlots[index];
          if (!empty) return false;
          const candidate = { kind: "flex", index } as const;
          return companion
            ? canAssignCompanionItem(state, itemRef, candidate)
            : canAssignPlayerItem(state, itemRef, candidate);
        });
        if (emptyIndex !== undefined) {
          target = { kind: "flex", index: emptyIndex };
        }
      }
      if (!target) {
        beginLoadoutAssignment(itemRef);
        return;
      }
      if (companion) {
        assignSelectedCompanionItem(
          { companionId: companion.id, target },
          itemRef,
        );
      } else {
        assignSelectedPlayerItem(target, itemRef);
      }
    },
    [
      activeLoadoutOwnerId,
      assignSelectedCompanionItem,
      assignSelectedPlayerItem,
      beginLoadoutAssignment,
    ],
  );

  const unassignSelectedCompanionItem = useCallback(
    (selection: CompanionLoadoutSelection) => {
      setActiveLoadoutOwnerId(selection.companionId);
      setCompanionLoadoutSelection(null);
      setSelectedInventoryItem(null);
      void performDuringAutoExplore(() =>
        runExclusive(async (token) => {
          await resolvePartyAction(
            unassignCompanionItem(
              gameRef.current,
              selection.companionId,
              selection.target,
            ),
            token,
            selection.companionId,
          );
        }),
      );
    },
    [performDuringAutoExplore, resolvePartyAction, runExclusive],
  );

  const assignPendingPlayerItem = useCallback(
    (selection: PlayerLoadoutSelection) => {
      const itemRef = pendingLoadoutItemRef;
      if (!itemRef) return;
      assignSelectedPlayerItem(selection, itemRef);
    },
    [assignSelectedPlayerItem, pendingLoadoutItemRef],
  );

  const assignPendingCompanionItem = useCallback(
    (selection: CompanionLoadoutSelection) => {
      const itemRef = pendingLoadoutItemRef;
      if (!itemRef) return;
      assignSelectedCompanionItem(selection, itemRef);
    },
    [assignSelectedCompanionItem, pendingLoadoutItemRef],
  );

  const recruitDeveloperCompanion = useCallback(
    (classId: CompanionClassId) => {
      commitGame(
        developerRecruitCompanion(gameRef.current, classId),
      );
    },
    [commitGame],
  );

  const handleDungeonSlotDrop = useCallback(
    (held: HeldSlotItem, target: ItemSlotAddress) => {
      const source = held.source;
      if (
        source.zone === "dungeonInventory" &&
        target.zone === "dungeonInventory"
      ) {
        const state = gameRef.current;
        const next = reorderDungeonInventory(
          state,
          source.index,
          target.index,
          held.item.itemRef,
        );
        if (next === state) return;
        commitGame(next);
        return;
      }

      const isDungeonEquipment = (
        address: ItemSlotAddress,
      ): address is
        | Extract<ItemSlotAddress, { zone: "playerEquipment" }>
        | Extract<ItemSlotAddress, { zone: "companionEquipment" }> =>
        address.zone === "playerEquipment" ||
        address.zone === "companionEquipment";

      if (source.zone === "dungeonInventory" && isDungeonEquipment(target)) {
        void performDuringAutoExplore(() =>
          runExclusive(async (token) => {
            const before = gameRef.current;
            const beforeSlots = normalizePlayerInventorySlots(before.player);
            const beforeRefs = new Set(beforeSlots.filter(Boolean));
            let result = target.zone === "playerEquipment"
              ? assignPlayerItem(before, target.target, held.item.itemRef)
              : assignCompanionItem(
                  before,
                  target.companionId,
                  target.target,
                  held.item.itemRef,
              );
            if (result.consumedTurn) {
              const afterSlots = normalizePlayerInventorySlots(result.state.player);
              const returnedRef = afterSlots.find(
                (ref) =>
                  ref &&
                  ref !== held.item.itemRef &&
                  !beforeRefs.has(ref),
              );
              if (returnedRef) {
                result = {
                  ...result,
                  state: placeReturnedItemInInventorySlot(
                    result.state,
                    returnedRef,
                    source.index,
                  ),
                };
              }
            }
            await resolvePartyAction(
              result,
              token,
              target.zone === "companionEquipment"
                ? target.companionId
                : PLAYER_ID,
            );
          }),
        );
        return;
      }

      if (isDungeonEquipment(source) && target.zone === "dungeonInventory") {
        void performDuringAutoExplore(() =>
          runExclusive(async (token) => {
            const before = gameRef.current;
            const beforeSlots = normalizePlayerInventorySlots(before.player);
            const targetRef = beforeSlots[target.index];
            let result = targetRef
              ? source.zone === "playerEquipment"
                ? assignPlayerItem(before, source.target, targetRef)
                : assignCompanionItem(
                    before,
                    source.companionId,
                    source.target,
                    targetRef,
                  )
              : source.zone === "playerEquipment"
                ? unassignPlayerItem(before, source.target)
                : unassignCompanionItem(
                    before,
                    source.companionId,
                    source.target,
                  );
            if (result.consumedTurn) {
              const afterSlots = normalizePlayerInventorySlots(result.state.player);
              const returnedRef = afterSlots.includes(held.item.itemRef)
                ? held.item.itemRef
                : afterSlots.includes(held.item.itemId)
                  ? held.item.itemId
                  : null;
              if (returnedRef) {
                result = {
                  ...result,
                  state: placeReturnedItemInInventorySlot(
                    result.state,
                    returnedRef,
                    target.index,
                  ),
                };
              }
            }
            await resolvePartyAction(
              result,
              token,
              source.zone === "companionEquipment"
                ? source.companionId
                : PLAYER_ID,
            );
          }),
        );
        return;
      }

      if (!isDungeonEquipment(source) || !isDungeonEquipment(target)) return;
      const state = gameRef.current;
      const toPartyAddress = (address: typeof source | typeof target) => ({
        ownerId: address.zone === "playerEquipment"
          ? PLAYER_ID
          : address.companionId,
        target: address.target,
      });
      const transaction = swapPartyLoadout(
        state,
        toPartyAddress(source),
        toPartyAddress(target),
      );
      if (transaction.state !== state) commitGame(transaction.state);
    },
    [
      commitGame,
      performDuringAutoExplore,
      resolvePartyAction,
      runExclusive,
    ],
  );

  const dungeonSlotDrag = useItemSlotDrag(handleDungeonSlotDrop);

  const enchantOwnedEquipment = useCallback(
    (selected: InventorySelection) => {
      void performDuringAutoExplore(() =>
        runExclusive(async (token) => {
          const loadout = selected.playerLoadout;
          const result = loadout?.kind === "equipment"
            ? enchantEquippedItem(gameRef.current, loadout.slot)
            : loadout?.kind === "flex" &&
                gameRef.current.player.equipment[FLEX_RING_KEYS[loadout.index]]
              ? enchantEquippedItem(gameRef.current, "ring", loadout.index)
              : enchantItem(gameRef.current, selected.itemRef);
          if (result.enchanted) {
            flashUpgradeTarget(
              loadout?.kind === "equipment"
                ? { kind: "equipment", slot: loadout.slot }
                : loadout?.kind === "flex"
                  ? gameRef.current.player.equipment[FLEX_RING_KEYS[loadout.index]]
                    ? { kind: "equipment", slot: "ring", ringIndex: loadout.index }
                    : { kind: "playerAuto", index: loadout.index }
                  : { kind: "inventory", itemRef: selected.itemRef },
            );
            setSelectedInventoryItem(null);
          }
          await resolvePartyAction(result, token, PLAYER_ID);
        }),
      );
    },
    [
      flashUpgradeTarget,
      performDuringAutoExplore,
      resolvePartyAction,
      runExclusive,
    ],
  );

  const acceptEquipmentComparison = useCallback(
    (offerId: string) => {
      void runExclusive(async (token) => {
        await resolvePartyAction(
          acceptEquipmentOffer(gameRef.current, offerId),
          token,
          PLAYER_ID,
        );
      });
    },
    [resolvePartyAction, runExclusive],
  );

  const declineEquipmentComparison = useCallback(
    (offerId: string) => {
      commitGame(declineEquipmentOffer(gameRef.current, offerId));
    },
    [commitGame],
  );

  const beginThrowItem = useCallback((itemId: string) => {
    setSelectedInventoryItem(null);
    setPendingEquipmentConsumable(null);
    setInspectMode(false);
    setInspectedEntity(null);
    setCastingItemId(null);
    setPendingCompanionSkill(null);
    setPendingQuickslotAim(null);
    setThrowingItemId(itemId);
    pathRef.current = [];
  }, []);

  const discardOwnedItem = useCallback(
    (itemId: string) => {
      setSelectedInventoryItem(null);
      void runExclusive(async (token) => {
        await resolvePartyAction(
          discardItem(gameRef.current, itemId),
          token,
          PLAYER_ID,
        );
      });
    },
    [resolvePartyAction, runExclusive],
  );

  const pickUpHere = useCallback(() => {
    void runExclusive(async (token) => {
      pathRef.current = [];
      const actorId = manualPartyModeRef.current
        ? controlledActorIdRef.current
        : PLAYER_ID;
      const result = actorId === PLAYER_ID
        ? pickupGroundItems(gameRef.current)
        : manualCompanionPickup(gameRef.current, actorId);
      await resolvePartyAction(result, token, actorId);
    });
  }, [resolvePartyAction, runExclusive]);

  const acceptCurrentQuest = useCallback((questId: string) => {
    void runExclusive(async (token) => {
      setQuestPrompt(null);
      await resolveAction(acceptQuest(gameRef.current, questId), token);
    });
  }, [resolveAction, runExclusive]);

  const claimCurrentQuestReward = useCallback((questId: string) => {
    void runExclusive(async (token) => {
      setQuestPrompt(null);
      await resolveAction(claimQuestReward(gameRef.current, questId), token);
    });
  }, [resolveAction, runExclusive]);

  const brewSelectedIngredients = useCallback(
    (itemRefs: string[]) => {
      void runExclusive(async (token) => {
        const formula = previewAlchemy(gameRef.current, itemRefs);
        const result = performAlchemy(gameRef.current, itemRefs);
        if (result.consumedTurn) {
          if (formula?.kind === "enchant") {
            flashUpgradeTarget({
              kind: "inventory",
              itemRef: formula.targetItemRef,
            });
          }
          setAlchemyOpen(false);
        }
        await resolvePartyAction(
          result,
          token,
          controlledActorIdRef.current,
        );
      });
    },
    [flashUpgradeTarget, resolvePartyAction, runExclusive],
  );

  const startNewDungeon = useCallback(() => {
    if (!busyRef.current) setExitConfirmOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedInventoryItem(null);
        setPendingEquipmentConsumable(null);
        setPendingLoadoutItemRef(null);
        setCompanionLoadoutSelection(null);
        setPlayerLoadoutSelection(null);
        setHelpOpen(false);
        setSettingsOpen(false);
        setCompendiumOpen(false);
        setInspectMode(false);
        setInspectedEntity(null);
        setThrowingItemId(null);
        setCastingItemId(null);
        setPendingCompanionSkill(null);
        setPendingQuickslotAim(null);
        setAlchemyOpen(false);
        setQuestPrompt(null);
        setExitConfirmOpen(false);
        return;
      }
      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        if (!busyRef.current) {
          setThrowingItemId(null);
          setCastingItemId(null);
          setPendingCompanionSkill(null);
          setPendingQuickslotAim(null);
          setPendingLoadoutItemRef(null);
          setSelectedInventoryItem(null);
          setPendingEquipmentConsumable(null);
          document
            .getElementById("persistent-inventory")
            ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        return;
      }
      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (
        selectedInventoryItem ||
        pendingEquipmentConsumable ||
        pendingLoadoutItemRef ||
        helpOpen ||
        settingsOpen ||
        compendiumOpen ||
        questPrompt ||
        exitConfirmOpen ||
        gameRef.current.pendingAugmentOffers.length > 0 ||
        throwingItemId ||
        castingItemId ||
        pendingCompanionSkill ||
        pendingQuickslotAim ||
        (manualPartyMode && manualActedIds.has(controlledActorId)) ||
        busyRef.current
      ) return;

      const key = event.key.toLowerCase();
      const moves: Record<string, [number, number]> = {
        arrowup: [0, -1],
        w: [0, -1],
        arrowdown: [0, 1],
        s: [0, 1],
        arrowleft: [-1, 0],
        a: [-1, 0],
        arrowright: [1, 0],
        d: [1, 0],
        q: [-1, -1],
        e: [1, -1],
        z: [-1, 1],
        c: [1, 1],
      };
      if (moves[key]) {
        event.preventDefault();
        move(...moves[key]);
      } else if (event.key === ".") {
        event.preventDefault();
        waitOneTurn();
      } else if (event.code === "Space") {
        event.preventDefault();
        waitOneTurn();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    compendiumOpen,
    castingItemId,
    exitConfirmOpen,
    helpOpen,
    controlledActorId,
    manualActedIds,
    manualPartyMode,
    move,
    pendingLoadoutItemRef,
    pendingEquipmentConsumable,
    selectedInventoryItem,
    settingsOpen,
    throwingItemId,
    pendingCompanionSkill,
    pendingQuickslotAim,
    questPrompt,
    waitOneTurn,
  ]);

  const canvasLocalPoint = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const bounds = canvas.getBoundingClientRect();
      return canvasPointFromClient(
        { x: event.clientX, y: event.clientY },
        bounds,
      );
    },
    [],
  );

  const canvasPoint = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const local = canvasLocalPoint(event);
      if (!local) return null;
      return tileAtCanvasPoint(
        local,
        cameraRef.current,
        zoomRef.current,
      );
    },
    [canvasLocalPoint],
  );

  const companionAtCanvasPoint = useCallback((local: Point) => {
    const state = gameRef.current;
    const zoom = zoomRef.current;
    const camera = cameraRef.current;
    const companions = [...(state.companions ?? [])].sort(
      (a, b) => a.y - b.y || a.x - b.x,
    );

    // Companions are drawn in map order, so test in reverse order to select
    // the visible sprite on top when two sprite rectangles overlap.
    for (let index = companions.length - 1; index >= 0; index -= 1) {
      const companion = companions[index];
      if (
        companion.hp <= 0 ||
        (!developerModeRef.current &&
          !state.tiles[companion.y]?.[companion.x]?.visible)
      ) {
        continue;
      }
      const definition = characterPresentation(companion);
      const bounds = companionScreenBounds(
        companion,
        definition,
        camera,
        zoom,
      );
      if (
        local.x >= bounds.left &&
        local.x <= bounds.right &&
        local.y >= bounds.top &&
        local.y <= bounds.bottom
      ) {
        return companion;
      }
    }
    return null;
  }, []);

  const companionDropPoint = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const point = canvasPoint(event);
      if (
        !point ||
        !isTileClickReachable(
          gameRef.current,
          point,
          developerModeRef.current,
        )
      ) {
        return null;
      }
      return point;
    },
    [canvasPoint],
  );

  const travelTo = useCallback(
    (target: Point) => {
      const state = gameRef.current;
      if (
        state.gameOver ||
        !isTileClickReachable(
          state,
          target,
          developerModeRef.current,
        ) ||
        (busyRef.current && !autoTravelRef.current)
      ) {
        return;
      }

      const path = pathTo(state, target);
      if (!path.length) return;
      pathRef.current = path;

      // A click made during auto-travel retargets the existing continuous loop.
      if (autoTravelRef.current) return;

      autoTravelRef.current = true;
      void runExclusive(async (token) => {
        try {
          while (
            pathRef.current.length &&
            actionTokenRef.current === token &&
            !gameRef.current.gameOver &&
            gameRef.current.pendingAugmentOffers.length === 0
          ) {
            const nextPoint = pathRef.current[0];
            const dx = nextPoint.x - gameRef.current.player.x;
            const dy = nextPoint.y - gameRef.current.player.y;
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) break;

            const hpBeforeStep = gameRef.current.player.hp;
            const visibleBefore = new Set(
              gameRef.current.enemies
                .filter(
                  (enemy) =>
                    developerModeRef.current ||
                    gameRef.current.tiles[enemy.y][enemy.x].visible,
                )
                .map((enemy) => enemy.id),
            );
            const sleepingBefore = new Set(
              gameRef.current.enemies
                .filter((enemy) => enemy.sleeping)
                .map((enemy) => enemy.id),
            );
            const result = playerStep(gameRef.current, dx, dy);
            if (!result.consumedTurn) {
              // Reusable objects such as the alchemy workbench open a UI
              // without spending a turn, so their result still has to reach
              // the action resolver before travel stops at the object.
              if (result.alchemyOpened || result.questInteraction) {
                await resolveAction(result, token);
              }
              break;
            }
            const reachedNextPoint =
              result.state.player.x === nextPoint.x &&
              result.state.player.y === nextPoint.y;
            if (reachedNextPoint) pathRef.current.shift();
            await resolveAction(result, token);

            const attacked = result.motions.some(
              (motion) =>
                motion.id === PLAYER_ID && motion.kind === "attack",
            );
            const stationaryInteraction =
              Boolean(result.interacted) && !result.motions.length;
            const tookDamage = gameRef.current.player.hp < hpBeforeStep;
            const discoveredThreat = gameRef.current.enemies.some(
              (enemy) =>
                (developerModeRef.current ||
                  gameRef.current.tiles[enemy.y][enemy.x].visible) &&
                !visibleBefore.has(enemy.id),
            );
            const enemyWoke = gameRef.current.enemies.some(
              (enemy) =>
                sleepingBefore.has(enemy.id) &&
                !enemy.sleeping &&
                (developerModeRef.current ||
                  gameRef.current.tiles[enemy.y]?.[enemy.x]?.visible),
            );
            if (
              attacked ||
              stationaryInteraction ||
              tookDamage ||
              discoveredThreat ||
              enemyWoke ||
              result.reachedExit
            ) {
              break;
            }
          }
          if (
            pathRef.current.length === 0 &&
            actionTokenRef.current === token
          ) {
            await autoPickupIfSafe(token);
          }
        } finally {
          pathRef.current = [];
          autoTravelRef.current = false;
        }
      });
    },
    [autoPickupIfSafe, resolveAction, runExclusive],
  );

  const startAutoExplore = useCallback(() => {
    if (!AUTO_EXPLORATION_ENABLED) return;
    if (
      busyRef.current ||
      autoExploreRef.current ||
      gameRef.current.gameOver ||
      gameRef.current.pendingAugmentOffers.length > 0
    ) {
      return;
    }

    const livingCompanions = gameRef.current.companions.filter(
      (companion) => companion.hp > 0,
    );
    if (!livingCompanions.length) return;

    autoExploreCompanionCommandsRef.current = new Map(
      livingCompanions.map((companion) => [companion.id, companion.command]),
    );
    let explorationState = gameRef.current;
    livingCompanions.forEach((companion) => {
      explorationState = setCompanionCommand(
        explorationState,
        companion.id,
        "explore",
      );
    });
    commitGame(explorationState);

    autoExploreRef.current = true;
    setAutoExploring(true);
    setSelectedInventoryItem(null);
    setPendingLoadoutItemRef(null);
    setThrowingItemId(null);
    setCastingItemId(null);
    setPendingCompanionSkill(null);
    setPendingQuickslotAim(null);
    pathRef.current = [];
    autoTravelRef.current = false;

    void runExclusive(async (token) => {
      try {
        for (let actionCount = 0; actionCount < 600; actionCount += 1) {
          const state = gameRef.current;
          if (
            !autoExploreRef.current ||
            actionTokenRef.current !== token ||
            state.gameOver
          ) {
            break;
          }
          if (state.pendingAugmentOffers.length > 0) {
            resumeAutoExploreAfterAugmentRef.current = true;
            break;
          }
          if (state.player.hp / Math.max(1, state.player.maxHp) < 0.2) {
            playSound("healthWarn", 0.74);
            break;
          }
          if (!state.companions.some((companion) => companion.hp > 0)) {
            break;
          }
          if (
            stopAutoExploreOnFullBag &&
            inventorySlotCount(state.player) >= MAX_INVENTORY_SLOTS
          ) {
            break;
          }

          if ((state.equipmentOffers ?? []).length > 0) {
            commitGame(autoEquipBetterOffers(state));
          }

          if (!hasCompanionExplorationWork(gameRef.current)) {
            if (!autoDescendAfterExplore) break;
            const completedState = gameRef.current;
            let exitPoint: Point | null = null;
            for (let y = 0; y < completedState.height && !exitPoint; y += 1) {
              for (let x = 0; x < completedState.width; x += 1) {
                if (completedState.tiles[y][x].terrain === "exit") {
                  exitPoint = { x, y };
                  break;
                }
              }
            }
            if (!exitPoint) break;
            const exitPath = pathTo(completedState, exitPoint);
            const nextStep = exitPath[0];
            if (!nextStep) break;
            const result = playerStep(
              completedState,
              nextStep.x - completedState.player.x,
              nextStep.y - completedState.player.y,
            );
            if (!result.consumedTurn) break;
            await resolveAction(result, token);
            if (
              finishRequestedRef.current ||
              gameRef.current.gameOver ||
              actionTokenRef.current !== token
            ) {
              break;
            }
            continue;
          }

          await resolveAction(waitTurn(gameRef.current, false), token);
        }
      } finally {
        autoExploreRef.current = false;
        setAutoExploring(false);
        pathRef.current = [];
        if (!finishRequestedRef.current) {
          let restoredState = gameRef.current;
          autoExploreCompanionCommandsRef.current.forEach(
            (command, companionId) => {
              restoredState = setCompanionCommand(
                restoredState,
                companionId,
                command,
              );
            },
          );
          if (restoredState !== gameRef.current) commitGame(restoredState);
        }
        autoExploreCompanionCommandsRef.current.clear();
        const queuedUiAction = pendingAutoExploreUiActionRef.current;
        const shouldResumeAfterUiAction =
          resumeAutoExploreAfterUiActionRef.current;
        pendingAutoExploreUiActionRef.current = null;
        resumeAutoExploreAfterUiActionRef.current = false;
        const queuedTarget = pendingTravelAfterAutoExploreRef.current;
        pendingTravelAfterAutoExploreRef.current = null;
        if (queuedUiAction && actionTokenRef.current === token) {
          window.setTimeout(async () => {
            await queuedUiAction();
            const state = gameRef.current;
            if (
              shouldResumeAfterUiAction &&
              !state.gameOver &&
              state.pendingAugmentOffers.length === 0
            ) {
              startAutoExploreRef.current();
            }
          }, 0);
        } else if (queuedTarget && actionTokenRef.current === token) {
          window.setTimeout(() => travelTo(queuedTarget), 0);
        }
      }
    });
  }, [
    autoDescendAfterExplore,
    commitGame,
    playSound,
    resolveAction,
    runExclusive,
    stopAutoExploreOnFullBag,
    travelTo,
  ]);

  useEffect(() => {
    startAutoExploreRef.current = startAutoExplore;
  }, [startAutoExplore]);

  const onCanvasMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (canvasPointersRef.current.has(event.pointerId)) {
        canvasPointersRef.current.set(event.pointerId, {
          clientX: event.clientX,
          clientY: event.clientY,
        });
      }
      const pinch = pinchGestureRef.current;
      if (pinch && pinch.pointerIds.includes(event.pointerId)) {
        event.preventDefault();
        const first = canvasPointersRef.current.get(pinch.pointerIds[0]);
        const second = canvasPointersRef.current.get(pinch.pointerIds[1]);
        const canvas = canvasRef.current;
        if (!first || !second || !canvas) return;
        const bounds = canvas.getBoundingClientRect();
        const distanceNow = Math.hypot(
          second.clientX - first.clientX,
          second.clientY - first.clientY,
        );
        const nextZoom = clamp(
          pinch.startZoom * (distanceNow / Math.max(1, pinch.startDistance)),
          ZOOM_LEVELS[0],
          ZOOM_LEVELS[ZOOM_LEVELS.length - 1],
        );
        const midpoint = {
          x:
            (((first.clientX + second.clientX) / 2 - bounds.left) /
              bounds.width) *
            VIEW_WIDTH,
          y:
            (((first.clientY + second.clientY) / 2 - bounds.top) /
              bounds.height) *
            VIEW_HEIGHT,
        };
        pinch.moved = true;
        cameraFollowRef.current = false;
        cameraDragRef.current = null;
        companionMapDragRef.current = null;
        zoomRef.current = nextZoom;
        cameraRef.current = clampCamera(
          {
            x: pinch.worldAnchor.x - midpoint.x / nextZoom,
            y: pinch.worldAnchor.y - midpoint.y / nextZoom,
          },
          nextZoom,
          gameRef.current,
        );
        hoverRef.current = null;
        setHoveredEnemy(null);
        return;
      }
      const companionDrag = companionMapDragRef.current;
      if (companionDrag?.pointerId === event.pointerId) {
        const deltaClientX = event.clientX - companionDrag.startClientX;
        const deltaClientY = event.clientY - companionDrag.startClientY;
        const local = canvasLocalPoint(event);
        if (local) companionDrag.cursor = local;
        if (
          !companionDrag.moved &&
          Math.hypot(deltaClientX, deltaClientY) >= 3
        ) {
          companionDrag.moved = true;
          hoverRef.current = null;
          setHoveredEnemy(null);
        }
        companionDrag.target = companionDropPoint(event);
        hoverRef.current = companionDrag.target;
        event.preventDefault();
        return;
      }
      const drag = cameraDragRef.current;
      if (drag?.pointerId === event.pointerId) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const bounds = canvas.getBoundingClientRect();
        const deltaClientX = event.clientX - drag.startClientX;
        const deltaClientY = event.clientY - drag.startClientY;
        if (
          !drag.moved &&
          Math.hypot(deltaClientX, deltaClientY) >= 3
        ) {
          drag.moved = true;
          cameraFollowRef.current = false;
          hoverRef.current = null;
          setHoveredEnemy(null);
        }
        if (drag.moved) {
          event.preventDefault();
          const zoom = zoomRef.current;
          const deltaCanvasX =
            (deltaClientX / bounds.width) * VIEW_WIDTH;
          const deltaCanvasY =
            (deltaClientY / bounds.height) * VIEW_HEIGHT;
          cameraRef.current = clampCamera(
            {
              x: drag.startCameraX - deltaCanvasX / zoom,
              y: drag.startCameraY - deltaCanvasY / zoom,
            },
            zoom,
            gameRef.current,
          );
          return;
        }
      }

      const point = canvasPoint(event);
      const targeting = targetingOverlayRef.current !== null;
      if (
        !point ||
        !(targeting
          ? pointInBounds(gameRef.current, point)
          : isTileClickReachable(
              gameRef.current,
              point,
              developerModeRef.current,
            ))
      ) {
        hoverRef.current = null;
        setHoveredEnemy(null);
        return;
      }
      hoverRef.current = point;
      setHoveredEnemy(
        developerModeRef.current ||
        gameRef.current.tiles[point.y][point.x].visible
          ? gameRef.current.enemies.find((enemy) =>
              pointEquals(enemy, point),
            ) ?? null
          : null,
      );
    },
    [canvasLocalPoint, canvasPoint, companionDropPoint],
  );

  const onCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === "mouse") {
        if (event.button !== 0) return;
        // A cancelled mobile gesture can leave stale touch IDs in some
        // browsers. A fresh desktop press always starts a clean drag session.
        canvasPointersRef.current.clear();
        pinchGestureRef.current = null;
        cameraDragRef.current = null;
        companionMapDragRef.current = null;
      } else if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      canvasPointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture may be unavailable when a browser cancels a gesture
        // between pointerdown and this callback; dragging still works locally.
      }
      if (canvasPointersRef.current.size >= 2) {
        const [firstEntry, secondEntry] = [
          ...canvasPointersRef.current.entries(),
        ].slice(-2);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const bounds = canvas.getBoundingClientRect();
        const first = firstEntry[1];
        const second = secondEntry[1];
        const midpoint = {
          x:
            (((first.clientX + second.clientX) / 2 - bounds.left) /
              bounds.width) *
            VIEW_WIDTH,
          y:
            (((first.clientY + second.clientY) / 2 - bounds.top) /
              bounds.height) *
            VIEW_HEIGHT,
        };
        pinchGestureRef.current = {
          pointerIds: [firstEntry[0], secondEntry[0]],
          startDistance: Math.hypot(
            second.clientX - first.clientX,
            second.clientY - first.clientY,
          ),
          startZoom: zoomRef.current,
          worldAnchor: {
            x: cameraRef.current.x + midpoint.x / zoomRef.current,
            y: cameraRef.current.y + midpoint.y / zoomRef.current,
          },
          moved: false,
        };
        cameraDragRef.current = null;
        companionMapDragRef.current = null;
        return;
      }
      const local = canvasLocalPoint(event);
      const companion =
        !busyRef.current &&
        !inspectMode &&
        !throwingItemId &&
        !castingItemId &&
        !pendingCompanionSkill &&
        !pendingQuickslotAim &&
        local
          ? companionAtCanvasPoint(local)
          : null;
      if (companion && local) {
        const zoom = zoomRef.current;
        const sourceCenterX =
          (companion.x * TILE_SIZE + TILE_SIZE / 2 -
            cameraRef.current.x) *
          zoom;
        const sourceBottom =
          (companion.y * TILE_SIZE + TILE_SIZE - 3 -
            cameraRef.current.y) *
          zoom;
        companionMapDragRef.current = {
          pointerId: event.pointerId,
          companionId: companion.id,
          startClientX: event.clientX,
          startClientY: event.clientY,
          cursor: local,
          grabOffset: {
            x: local.x - sourceCenterX,
            y: local.y - sourceBottom,
          },
          target: { x: companion.x, y: companion.y },
          moved: false,
        };
        cameraDragRef.current = null;
        return;
      }
      cameraDragRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCameraX: cameraRef.current.x,
        startCameraY: cameraRef.current.y,
        moved: false,
      };
    },
    [
      canvasLocalPoint,
      castingItemId,
      companionAtCanvasPoint,
      inspectMode,
      pendingCompanionSkill,
      pendingQuickslotAim,
      throwingItemId,
    ],
  );

  const finishCanvasPointer = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const wasPinching = Boolean(pinchGestureRef.current);
      canvasPointersRef.current.delete(event.pointerId);
      if (
        pinchGestureRef.current?.pointerIds.includes(event.pointerId)
      ) {
        pinchGestureRef.current = null;
        cameraDragRef.current = null;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (wasPinching) return;
      const companionDrag = companionMapDragRef.current;
      if (
        companionDrag &&
        companionDrag.pointerId === event.pointerId
      ) {
        const dropTarget = companionDrag.moved
          ? companionDropPoint(event)
          : null;
        companionMapDragRef.current = null;
        hoverRef.current = dropTarget;
        if (dropTarget) {
          commitGame(
            setCompanionPriorityTarget(
              gameRef.current,
              companionDrag.companionId,
              dropTarget,
            ),
          );
        } else if (inspectModeRef.current) {
          setInspectedEntity({
            kind: "companion",
            id: companionDrag.companionId,
            anchor: descriptionAnchorFromPoint(event.clientX, event.clientY),
          });
        }
        return;
      }
      const drag = cameraDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      cameraDragRef.current = null;
      if (!drag.moved) {
        const target = canvasPoint(event);
        if (target && autoExploreRef.current) {
          pendingTravelAfterAutoExploreRef.current = target;
          autoExploreRef.current = false;
          resumeAutoExploreAfterAugmentRef.current = false;
          setAutoExploring(false);
          return;
        }
        if (target && pendingCompanionSkill) {
          const selectedSkill = pendingCompanionSkill;
          void runExclusive(async (token) => {
            const result = activateCompanionSkill(
              gameRef.current,
              selectedSkill.casterId,
              selectedSkill.skillId,
              target,
            );
            if (result.consumedTurn) setPendingCompanionSkill(null);
            await resolvePartyAction(
              result,
              token,
              selectedSkill.casterId,
            );
          });
          return;
        }
        if (target && pendingQuickslotAim) {
          const aim = pendingQuickslotAim;
          void runExclusive((token) =>
            firePendingQuickslot(aim, target, token),
          );
          return;
        }
        if (target && throwingItemId) {
          const itemId = throwingItemId;
          setThrowingItemId(null);
          void runExclusive(async (token) => {
            await resolvePartyAction(
              throwItem(gameRef.current, itemId, target),
              token,
              PLAYER_ID,
            );
          });
          return;
        }
        if (target && castingItemId) {
          const itemId = castingItemId;
          setCastingItemId(null);
          void runExclusive(async (token) => {
            await resolvePartyAction(
              zapWand(gameRef.current, itemId, target),
              token,
              PLAYER_ID,
            );
          });
          return;
        }
        if (inspectModeRef.current) {
          const tile = target
            ? gameRef.current.tiles[target.y]?.[target.x]
            : null;
          if (!target || !tile) {
            setInspectedEntity(null);
            return;
          }
          const anchor = descriptionAnchorFromPoint(
            event.clientX,
            event.clientY,
          );
          if (!developerModeRef.current && !tile.discovered) {
            setInspectedEntity({
              kind: "unknown",
              x: target.x,
              y: target.y,
              anchor,
            });
            return;
          }
          const candidates: InspectedEntity[] = [];
          const contentsVisible = developerModeRef.current || tile.visible;
          if (contentsVisible) {
            if (pointEquals(gameRef.current.player, target)) {
              candidates.push({ kind: "player", anchor });
            }
            (gameRef.current.companions ?? [])
              .filter((candidate) => pointEquals(candidate, target))
              .forEach((companion) =>
                candidates.push({
                  kind: "companion",
                  id: companion.id,
                  anchor,
                }),
              );
            gameRef.current.enemies
              .filter((candidate) => pointEquals(candidate, target))
              .forEach((enemy) =>
                candidates.push({ kind: "enemy", id: enemy.id, anchor }),
              );
            gameRef.current.groundItems
              .filter((candidate) => pointEquals(candidate, target))
              .forEach((item) =>
                candidates.push({ kind: "groundItem", id: item.id, anchor }),
              );
            gameRef.current.objects
              .filter(
                (candidate) =>
                  !candidate.looted && pointEquals(candidate, target),
              )
              .forEach((object) =>
                candidates.push({ kind: "object", id: object.id, anchor }),
              );
            gameRef.current.clouds.forEach((cloud) => {
              if (
                cloud.tiles.some((candidate) => pointEquals(candidate, target))
              ) {
                candidates.push({
                  kind: "cloud",
                  id: cloud.id,
                  x: target.x,
                  y: target.y,
                  anchor,
                });
              }
            });
            gameRef.current.wards
              .filter((candidate) => pointEquals(candidate, target))
              .forEach((ward) =>
                candidates.push({ kind: "ward", id: ward.id, anchor }),
              );
          }
          candidates.push({
            kind: "terrain",
            x: target.x,
            y: target.y,
            anchor,
          });
          const identity = (inspection: InspectedEntity) =>
            inspection.kind === "player"
              ? "player"
              : "id" in inspection
                ? `${inspection.kind}:${inspection.id}`
                : `${inspection.kind}:${inspection.x},${inspection.y}`;
          const currentIndex = inspectedEntity
            ? candidates.findIndex(
                (candidate) => identity(candidate) === identity(inspectedEntity),
              )
            : -1;
          setInspectedEntity(
            candidates[(currentIndex + 1) % candidates.length],
          );
          return;
        }
        if (target) {
          const actorId = manualPartyModeRef.current
            ? controlledActorIdRef.current
            : PLAYER_ID;
          const actor = partyActor(gameRef.current, actorId);
          const itemsAtActor = gameRef.current.groundItems.some(
            (item) => pointEquals(item, actor),
          );
          if (pointEquals(target, actor) && itemsAtActor) {
            pickUpHere();
            return;
          }
        }
        if (target) {
          if (manualPartyModeRef.current) {
            const actorId = controlledActorIdRef.current;
            if (manualActedIdsRef.current.has(actorId)) return;
            const state = gameRef.current;
            const actor = partyActor(state, actorId);
            const path = pathToPartyActor(state, actorId, target);
            const step = path[0];
            if (!step) return;
            const dx = step.x - actor.x;
            const dy = step.y - actor.y;
            void runExclusive(async (token) => {
              const result = actorId === PLAYER_ID
                ? playerStep(gameRef.current, dx, dy)
                : manualCompanionStep(gameRef.current, actorId, dx, dy);
              await resolvePartyAction(result, token, actorId);
            });
            return;
          }
          travelTo(target);
        }
      }
    },
    [
      canvasPoint,
      castingItemId,
      commitGame,
      companionDropPoint,
      firePendingQuickslot,
      pickUpHere,
      pendingCompanionSkill,
      pendingQuickslotAim,
      inspectedEntity,
      resolvePartyAction,
      runExclusive,
      throwingItemId,
      travelTo,
    ],
  );

  const cancelCanvasPointer = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      canvasPointersRef.current.delete(event.pointerId);
      if (pinchGestureRef.current?.pointerIds.includes(event.pointerId)) {
        pinchGestureRef.current = null;
      }
      if (cameraDragRef.current?.pointerId === event.pointerId) {
        cameraDragRef.current = null;
      }
      if (companionMapDragRef.current?.pointerId === event.pointerId) {
        companionMapDragRef.current = null;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  const loseCanvasPointer = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      // Normal pointerup removes the ID before releasing capture. Only clean
      // up here when capture was genuinely lost mid-gesture.
      if (!canvasPointersRef.current.has(event.pointerId)) return;
      canvasPointersRef.current.delete(event.pointerId);
      if (pinchGestureRef.current?.pointerIds.includes(event.pointerId)) {
        pinchGestureRef.current = null;
      }
      if (cameraDragRef.current?.pointerId === event.pointerId) {
        cameraDragRef.current = null;
      }
      if (companionMapDragRef.current?.pointerId === event.pointerId) {
        companionMapDragRef.current = null;
      }
    },
    [],
  );

  const onCanvasWheel = useCallback(
    (event: ReactWheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      if (event.deltaY === 0) return;
      const now = performance.now();
      if (now - lastWheelAtRef.current < 70) return;
      lastWheelAtRef.current = now;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const bounds = canvas.getBoundingClientRect();
      const local = {
        x: ((event.clientX - bounds.left) / bounds.width) * VIEW_WIDTH,
        y: ((event.clientY - bounds.top) / bounds.height) * VIEW_HEIGHT,
      };
      const currentIndex = ZOOM_LEVELS.reduce(
        (nearest, value, index) =>
          Math.abs(value - zoomRef.current) <
          Math.abs(ZOOM_LEVELS[nearest] - zoomRef.current)
            ? index
            : nearest,
        0,
      );
      const nextIndex = clamp(
        currentIndex + (event.deltaY < 0 ? 1 : -1),
        0,
        ZOOM_LEVELS.length - 1,
      );
      if (nextIndex === currentIndex) return;

      const previousZoom = ZOOM_LEVELS[currentIndex];
      const nextZoom = ZOOM_LEVELS[nextIndex];
      const worldAnchor = {
        x: cameraRef.current.x + local.x / previousZoom,
        y: cameraRef.current.y + local.y / previousZoom,
      };
      zoomRef.current = nextZoom;
      cameraFollowRef.current = false;
      cameraRef.current = clampCamera(
        {
          x: worldAnchor.x - local.x / nextZoom,
          y: worldAnchor.y - local.y / nextZoom,
        },
        nextZoom,
        gameRef.current,
      );
    },
    [],
  );

  const followPlayer = useCallback(() => {
    cameraFollowRef.current = true;
  }, []);

  useEffect(
    () =>
      startDungeonRenderer({
        assetsReady,
        canvasRef,
        fogTextureCanvasRef,
        renderCacheRef,
        assetsRef,
        gameRef,
        motionRef,
        characterMoveCyclesRef,
        effectsRef,
        pickupRef,
        throwRef,
        magicRef,
        statusSignalRef,
        pixelEffectsRef,
        cameraShakesRef,
        pixelFogRuntimeRef,
        entityFlashRef,
        defeatedEnemyVisualRef,
        defeatedCompanionVisualRef,
        hiddenGroundItemUntilRef,
        playerActionRef,
        cameraRef,
        cameraFollowRef,
        cameraDragRef,
        companionMapDragRef,
        zoomRef,
        developerModeRef,
        manualPartyModeRef,
        controlledActorIdRef,
        hoverRef,
        pathRef,
        autoTravelRef,
        inspectModeRef,
        targetingOverlayRef,
      }),
    [assetsReady],
  );

  const controlledCompanion = controlledActorId === PLAYER_ID
    ? null
    : game.companions.find(
        (companion) => companion.id === controlledActorId,
      ) ?? null;
  const controlledCharacter = controlledCompanion ?? game.player;
  const controlledIsPlayer = controlledActorId === PLAYER_ID;
  const controlledShield = controlledIsPlayer ? game.player.shield : 0;
  const vitalTotal = Math.max(
    controlledCharacter.maxHp,
    controlledCharacter.hp + controlledShield,
  );
  const hpPercent = Math.max(
    0,
    Math.min(100, (controlledCharacter.hp / vitalTotal) * 100),
  );
  const shieldPercent = Math.max(
    0,
    Math.min(100 - hpPercent, (controlledShield / vitalTotal) * 100),
  );
  const hungerPercent = Math.max(
    0,
    Math.min(100, game.player.hunger ?? 100),
  );
  const xpPercent =
    controlledCharacter.level >= MAX_PLAYER_LEVEL
      ? 100
      : Math.min(
          100,
          (controlledCharacter.xp /
            Math.max(1, controlledCharacter.nextXp)) *
            100,
        );
  const latestLogs = game.logs.slice(-5);
  const trackedQuests = (game.quests ?? []).filter(
    (quest) =>
      quest.status === "active" || quest.status === "readyToTurnIn",
  );
  const activeBossEncounter = game.bossEncounter?.activated &&
    !game.bossEncounter.defeated
    ? game.bossEncounter
    : null;
  const activeBoss = activeBossEncounter
    ? game.enemies.find(
        (enemy) =>
          enemy.id === activeBossEncounter.bossEnemyId && enemy.hp > 0,
      ) ?? null
    : null;
  const visibleBoss = activeBoss &&
    game.tiles[activeBoss.y]?.[activeBoss.x]?.visible
    ? activeBoss
    : null;
  const visibleBossDefinition = visibleBoss && activeBossEncounter
    ? bossDefinition(activeBossEncounter.bossId)
    : null;
  const itemsHere = game.groundItems.filter((item) =>
    pointEquals(item, controlledCharacter),
  );
  const throwingDefId = throwingItemId
    ? game.player.inventoryInstances.find(
        (instance) => instance.id === throwingItemId,
      )?.defId ?? throwingItemId
    : null;
  const throwingDefinition = throwingDefId
    ? ITEM_DEFS[throwingDefId]
    : null;
  const castingDefId = castingItemId
    ? game.player.inventoryInstances.find(
        (instance) => instance.id === castingItemId,
      )?.defId ?? castingItemId
    : null;
  const castingDefinition = castingDefId
    ? ITEM_DEFS[castingDefId]
    : null;
  const pendingSkillDefinition = pendingCompanionSkill
    ? COMPANION_SKILLS[pendingCompanionSkill.skillId]
    : null;
  const pendingSkillCasterName = pendingCompanionSkill?.casterId === PLAYER_ID
    ? game.player.name
    : game.companions.find(
        (companion) => companion.id === pendingCompanionSkill?.casterId,
      )?.name ?? "";
  const inspectedEnemy =
    inspectedEntity?.kind === "enemy"
      ? game.enemies.find((enemy) => enemy.id === inspectedEntity.id) ?? null
      : null;
  const inspectedCompanion =
    inspectedEntity?.kind === "companion"
      ? (game.companions ?? []).find(
          (companion) => companion.id === inspectedEntity.id,
        ) ?? null
      : null;
  const inspectedGroundItem =
    inspectedEntity?.kind === "groundItem"
      ? game.groundItems.find((item) => item.id === inspectedEntity.id) ?? null
      : null;
  const inspectedMapElement =
    inspectedEntity &&
    ["object", "cloud", "ward", "terrain", "unknown"].includes(
      inspectedEntity.kind,
    )
      ? inspectedEntity as MapElementInspection
      : null;
  const hasInspectedEntity = Boolean(inspectedEntity);
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  const controlledCharacterDefinition =
    characterPresentation(controlledCharacter);
  const controlledHasActed = manualActedIds.has(controlledActorId);
  const controlledActionDisabled =
    busy || game.gameOver || (manualPartyMode && controlledHasActed);
  const pendingQuickslotDefinition = pendingQuickslotAim
    ? ITEM_DEFS[pendingQuickslotAim.itemId]
    : null;
  const pendingQuickslotOwnerName = pendingQuickslotAim?.ownerId === PLAYER_ID
    ? game.player.name
    : game.companions.find(
        (companion) => companion.id === pendingQuickslotAim?.ownerId,
      )?.name ?? "";
  const inspectedEffectDetail = inspectedEffect?.kind === "invisible"
    ? game.player.invisibleTurns > 0
      ? {
          label: text("투명", "Invisible"),
          remaining: text(
            `${game.player.invisibleTurns}턴`,
            `${game.player.invisibleTurns} turns`,
          ),
          description: text(
            "적의 시야에서 사라집니다. 직접 공격하거나 일부 행동을 하면 효과가 해제될 수 있습니다.",
            "Enemies cannot see you. Direct attacks and some actions may end the effect.",
          ),
        }
      : null
    : inspectedEffect?.kind === "shield"
      ? game.player.shield > 0
        ? {
            label: text("보호막", "Shield"),
            remaining: text(
              `${game.player.shield} 남음`,
              `${game.player.shield} remaining`,
            ),
            description: text(
              "추가 체력처럼 생명력보다 먼저 피해를 흡수합니다. 파란 구간이 현재 남은 보호막입니다.",
              "The shield absorbs damage before health. Its remaining amount is shown in blue on the health bar.",
            ),
          }
        : null
      : inspectedEffect?.kind === "status"
        ? (() => {
            const status = controlledCharacter.statuses.find(
              (candidate) => candidate.id === inspectedEffect.id,
            );
            return status
              ? {
                  label: localizedStatusLabel(status.id, language),
                  remaining: text(
                    `${status.turns}턴`,
                    `${status.turns} turns`,
                  ),
                  description: localizedStatusDescription(
                    status.id,
                    language,
                  ),
                }
              : null;
          })()
        : null;

  return (
    <ItemSlotDragContext.Provider value={dungeonSlotDrag}>
      <UiLanguageContext.Provider value={language}>
        <main
        lang={language}
        data-language={language}
        className="game-page"
        style={
          {
            "--ui-scale": uiScale,
            "--font-scale": fontScale,
            "--ui-width": `${100 / uiScale}%`,
            "--ui-max-width": `${1120 / uiScale}px`,
            "--ui-viewport-width": `${100 / uiScale}vw`,
          } as CSSProperties
        }
        {...dungeonSlotDrag.containerProps}
      >
      <header className="game-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <div>
            <h1>{text(dungeon.nameKo, dungeon.nameEn)}</h1>
          </div>
        </div>
        <div
          className="run-meta"
          aria-label={text("현재 탐사 정보", "Current expedition")}
        >
          <span>
            <small>{text("층", "Depth")}</small>
            <strong>{String(game.floor).padStart(2, "0")}/{String(dungeon.floorCount).padStart(2, "0")}</strong>
          </span>
          <i />
          <span>
            <small>{text("턴", "Turn")}</small>
            <strong>{String(game.turn).padStart(3, "0")}</strong>
          </span>
          <i />
          <span>
            <small>{text("골드", "Gold")}</small>
            <strong>{formatGold(game.goldCollected)}</strong>
          </span>
          <i />
          <span className="seed-value">
            <small>{text("시드", "Seed")}</small>
            <strong>{game.seed.toString(16).toUpperCase().padStart(8, "0")}</strong>
          </span>
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => setCompendiumOpen(true)}>
            {text("도감", "Codex")}
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)}>
            {text("설정", "Settings")}
          </button>
          <button type="button" onClick={() => setHelpOpen(true)}>
            {text("탐사 안내", "Guide")}
          </button>
          <button type="button" className="expedition-exit-button" onClick={startNewDungeon} disabled={busy}>
            {text("탐사 종료", "End Expedition")}
          </button>
        </div>
      </header>

      <section className="game-layout">
        <div className="game-column">
          <div className="hero-strip">
            <div className="portrait-frame">
              <PixelSpriteFrame
                file={controlledCharacterDefinition.sprite}
                sheetWidth={controlledCharacterDefinition.sheetWidth}
                frameWidth={controlledCharacterDefinition.frameWidth}
                frameHeight={controlledCharacterDefinition.frameHeight}
                frame={
                  controlledCharacterDefinition.animationSet === "companion"
                    ? companionFrameIndex(
                        companionArmorTier(controlledCharacter),
                        COMPANION_IDLE_FRAMES[0],
                      )
                    : PLAYER_IDLE_FRAMES[0]
                }
                size={48}
              />
              <b>LV.{controlledCharacter.level}</b>
              <small>{controlledCharacter.name}</small>
              {manualPartyMode && (
                <em className={controlledHasActed ? "is-done" : "is-ready"}>
                  {controlledHasActed
                    ? text("행동 완료", "Acted")
                    : text("조작 중", "Active")}
                </em>
              )}
            </div>
            <div className="hero-vitals">
              <div className="vital-row">
                <span>{text("생명력", "Health")}</span>
                <div className="vital-track hp-track">
                  <i
                    className="hp-fill"
                    style={{ width: `${hpPercent}%` }}
                  />
                  {shieldPercent > 0 && (
                    <i
                      className="shield-fill"
                      style={{
                        left: `${hpPercent}%`,
                        width: `${shieldPercent}%`,
                      }}
                    />
                  )}
                </div>
                <strong>
                  {controlledCharacter.hp}/{controlledCharacter.maxHp}
                  {controlledShield > 0 && ` +${controlledShield}`}
                </strong>
              </div>
              <div className="vital-row compact hunger-row">
                <span>{text("허기", "Hunger")}</span>
                <div className="vital-track hunger-track">
                  <i style={{ width: `${hungerPercent}%` }} />
                </div>
                <strong>{Math.floor(game.player.hunger ?? 100)}/100</strong>
              </div>
              <div className="vital-row compact">
                <span>{text("경험", "Experience")}</span>
                <div className="vital-track xp-track">
                  <i style={{ width: `${xpPercent}%` }} />
                </div>
                <strong>
                  {controlledCharacter.level >= MAX_PLAYER_LEVEL
                    ? "MAX"
                    : `${controlledCharacter.xp}/${controlledCharacter.nextXp}`}
                </strong>
              </div>
            </div>
            <div className="combat-stats">
              <span>
                <small>{text("공격", "Attack")}</small>
                <b>
                  {controlledCompanion
                    ? getCompanionAttack(controlledCompanion)
                    : getPlayerAttack(game.player)}
                </b>
              </span>
              <span>
                <small>{text("방어", "Defense")}</small>
                <b>
                  {controlledCompanion
                    ? getCompanionDefense(controlledCompanion)
                    : getPlayerDefense(game.player)}
                </b>
              </span>
              <span>
                <small>{text("열쇠", "Keys")}</small>
                <b>
                  {text("쇠", "Iron")} {game.player.inventory.iron_key ?? 0}
                  {(game.player.inventory.crystal_key ?? 0) > 0
                    ? ` · ${text("수정", "Crystal")} ${game.player.inventory.crystal_key}`
                    : ""}
                </b>
              </span>
              <TurnGauge
                moveSpeed={controlledCompanion
                  ? getCompanionMoveSpeed(controlledCompanion)
                  : getPlayerMoveSpeed(game.player)}
                attackSpeed={controlledCompanion
                  ? getCompanionAttackSpeed(controlledCompanion)
                  : getPlayerAttackSpeed(game.player)}
                progress={controlledCompanion ? 0 : game.player.actionProgress ?? 0}
              />
            </div>
            <div
              className="player-status-effects"
              aria-label={text(
                "현재 적용 중인 상태이상과 강화 효과",
                "Active status effects and buffs",
              )}
            >
              <small>{text("상태 효과", "Status Effects")}</small>
              <div className="status-effect-list">
                {controlledIsPlayer && game.player.invisibleTurns > 0 && (
                  <button
                    type="button"
                    className="is-beneficial"
                    onClick={(event) =>
                      setInspectedEffect({
                        kind: "invisible",
                        anchor: descriptionAnchorFromElement(event.currentTarget),
                      })
                    }
                  >
                    {text("투명", "Invisible")} <b>{game.player.invisibleTurns}</b>
                  </button>
                )}
                {controlledShield > 0 && (
                  <button
                    type="button"
                    className="is-beneficial"
                    onClick={(event) =>
                      setInspectedEffect({
                        kind: "shield",
                        anchor: descriptionAnchorFromElement(event.currentTarget),
                      })
                    }
                  >
                    {text("보호막", "Shield")} <b>{controlledShield}</b>
                  </button>
                )}
                {controlledCharacter.statuses.map((status) => (
                  <button
                    type="button"
                    className={
                      BENEFICIAL_STATUS_IDS.has(status.id)
                        ? "is-beneficial"
                        : "is-harmful"
                    }
                    key={status.id}
                    title={text(
                      `${STATUS_LABELS[status.id]} ${status.turns}턴 남음`,
                      `${localizedStatusLabel(status.id, language)} ${status.turns} turns remaining`,
                    )}
                    onClick={(event) =>
                      setInspectedEffect({
                        kind: "status",
                        id: status.id,
                        anchor: descriptionAnchorFromElement(event.currentTarget),
                      })
                    }
                  >
                    {localizedStatusLabel(status.id, language)}{" "}
                    <b>{status.turns}</b>
                  </button>
                ))}
                {(!controlledIsPlayer || game.player.invisibleTurns <= 0) &&
                  controlledShield <= 0 &&
                  controlledCharacter.statuses.length === 0 && (
                    <em>{text("적용 효과 없음", "No active effects")}</em>
                  )}
              </div>
              {inspectedEffectDetail && (
                <EffectDescriptionWindow
                  detail={inspectedEffectDetail}
                  anchor={inspectedEffect!.anchor}
                  onClose={() => setInspectedEffect(null)}
                />
              )}
            </div>
          </div>

          <div className={`viewport-frame ${busy ? "is-busy" : ""}`}>
            <div className="viewport-label">
              <span>
                {text(
                  `${dungeon.nameKo} ${game.floor}/${dungeon.floorCount}층`,
                  `${dungeon.nameEn} · Floor ${game.floor}/${dungeon.floorCount}`,
                )}
              </span>
            </div>
            <div
              className="viewport-tools"
              aria-label={text("지도 보기 설정", "Map view controls")}
            >
              <button
                type="button"
                className={`inspect-tool ${inspectMode ? "is-active" : ""}`}
                onClick={() => {
                  setThrowingItemId(null);
                  setCastingItemId(null);
                  setPendingCompanionSkill(null);
                  setPendingQuickslotAim(null);
                  if (inspectMode) setInspectedEntity(null);
                  setInspectMode(!inspectMode);
                }}
                aria-label={text("지도 모든 요소 조사", "Inspect every map element")}
                aria-pressed={inspectMode}
              >
                <i className="magnifier-glyph" aria-hidden="true" />
                {text("조사", "Inspect")}
              </button>
              <button type="button" onClick={followPlayer}>
                {text("플레이어 추적", "Follow Player")}
              </button>
              <button
                type="button"
                onClick={() => onSoundEnabledChange(!soundEnabled)}
                aria-pressed={soundEnabled}
              >
                {text("소리", "Sound")}{" "}
                {soundEnabled ? text("켬", "On") : text("끔", "Off")}
              </button>
            </div>
            {developerMode && (
              <div className="developer-badge">
                {text(
                  "개발자 · 전체 시야 · 무적",
                  "Developer · Full Vision · Invincible",
                )}
              </div>
            )}
            <div className="auto-explore-disabled" role="status">
              <i aria-hidden="true">×</i>
              <span>
                <strong>{text("자동탐사 일시 중지", "Auto-explore Paused")}</strong>
                <small>{text("동료는 플레이어를 자동으로 동행합니다", "Companions automatically follow the player")}</small>
              </span>
            </div>
            <canvas
              ref={canvasRef}
              width={VIEW_WIDTH}
              height={VIEW_HEIGHT}
              className={`game-canvas ${inspectMode ? "is-inspecting" : ""} ${throwingItemId || castingItemId || pendingCompanionSkill || pendingQuickslotAim ? "is-throwing" : ""} ${pendingCompanionSkill ? "is-skill-targeting" : ""} ${pendingQuickslotAim ? "is-quickslot-targeting" : ""}`}
              onPointerMove={onCanvasMove}
              onPointerLeave={() => {
                if (cameraDragRef.current || companionMapDragRef.current) return;
                hoverRef.current = null;
                setHoveredEnemy(null);
              }}
              onPointerDown={onCanvasPointerDown}
              onPointerUp={finishCanvasPointer}
              onPointerCancel={cancelCanvasPointer}
              onLostPointerCapture={loseCanvasPointer}
              onWheel={onCanvasWheel}
              aria-label={
                pendingSkillDefinition
                  ? text(
                      `${pendingSkillCasterName}의 ${pendingSkillDefinition.nameKo} 조준 모드. 강조된 대상을 다시 선택하거나 원하는 지도 타일을 클릭합니다. 빈 타일에도 발동합니다.`,
                      `${pendingSkillCasterName}'s ${pendingSkillDefinition.nameEn} aiming mode. Confirm the highlighted target or select any map tile; empty tiles are valid.`,
                    )
                  : pendingQuickslotDefinition
                  ? text(
                      `${pendingQuickslotDefinition.name} 조준 모드. 강조된 적을 자동 조준 중이며, 지도 타일을 클릭하면 해당 방향으로 발사합니다.`,
                      `${localizedItemName(pendingQuickslotDefinition.id, language)} aiming mode. The highlighted enemy is auto-targeted; select any map tile to fire in that direction.`,
                    )
                  : castingDefinition
                  ? text(
                      `${castingDefinition.name} 조준 모드. 목표 지도 칸을 클릭합니다.`,
                      `${localizedItemName(castingDefinition.id, language)} aiming mode. Select a map tile.`,
                    )
                  : throwingDefinition
                  ? text(
                      `${throwingDefinition.name} 던지기 모드. 목표 방향의 지도 칸을 클릭합니다.`,
                      `${localizedItemName(throwingDefinition.id, language)} throwing mode. Select a map tile in the target direction.`,
                    )
                  : inspectMode
                  ? text(
                      "조사 모드. 지도에서 개체, 아이템, 구조물, 장판 또는 지형을 클릭해 설명을 확인합니다. 같은 칸을 다시 클릭하면 겹친 다음 요소를 봅니다.",
                      "Inspection mode. Select any entity, item, object, field effect, or terrain tile. Click a stacked tile again to cycle its elements.",
                    )
                  : text(
                      "던전 지도. 빈 타일을 드래그하면 카메라가 움직이고, 동료를 드래그해 놓으면 해당 타일을 향해 우선 이동합니다.",
                      "Dungeon map. Drag empty ground to pan, or drag a companion onto a tile to give it a priority destination.",
                    )
              }
            />
            {!assetsReady && (
              <div className={`loading-map ${assetLoadError ? "is-error" : ""}`}>
                {!assetLoadError && <span />}
                <p>
                  {assetLoadError
                    ? text(
                        "지도 이미지를 불러오지 못했습니다.",
                        "The map images could not be loaded.",
                      )
                    : text("타일 지도를 펼치는 중…", "Preparing the map…")}
                </p>
                {assetLoadError && (
                  <>
                    <small className="loading-map-detail">{assetLoadError}</small>
                    <button
                      type="button"
                      onClick={() => setAssetLoadAttempt((attempt) => attempt + 1)}
                    >
                      {text("다시 불러오기", "Retry")}
                    </button>
                  </>
                )}
              </div>
            )}
            {hoveredEnemy && (
              <div className="enemy-tooltip">
                <strong>
                  {hoveredEnemy.questId
                    ? language === "ko"
                      ? hoveredEnemy.uniqueName
                      : questDefinition(hoveredEnemy.questId)?.targetNameEn ??
                        localizedEnemyName(hoveredEnemy.kind, language)
                    : localizedEnemyName(hoveredEnemy.kind, language)}
                </strong>
                <span>
                  HP {hoveredEnemy.hp}/{hoveredEnemy.maxHp}
                </span>
                {hoveredEnemy.sleeping && (
                  <em>{text("수면 중", "Sleeping")}</em>
                )}
              </div>
            )}
            {visibleBoss && visibleBossDefinition && (
              <section
                className={activeBossEncounter?.phase === 2
                  ? "boss-health-display boss-health-display--enraged"
                  : "boss-health-display"}
                aria-label={text("보스 생명력", "Boss health")}
              >
                <header>
                  <small>BOSS</small>
                  <strong>
                    {text(
                      visibleBossDefinition.nameKo,
                      visibleBossDefinition.nameEn,
                    )}
                  </strong>
                  <span>{visibleBoss.hp}/{visibleBoss.maxHp}</span>
                </header>
                <div>
                  <i
                    style={{
                      width: `${Math.max(0, Math.min(100, visibleBoss.hp / Math.max(1, visibleBoss.maxHp) * 100))}%`,
                    }}
                  />
                </div>
              </section>
            )}
            {trackedQuests.length > 0 && (
              <div className="quest-tracker" aria-label={text("퀘스트 진행", "Quest progress")}>
                <small>QUEST</small>
                {trackedQuests.map((quest) => {
                  const definition = questDefinition(quest.questId);
                  if (!definition) return null;
                  return (
                    <p key={quest.questId} data-ready={quest.status === "readyToTurnIn"}>
                      <strong>{language === "ko" ? definition.titleKo : definition.titleEn}</strong>
                      <span>
                        {quest.status === "readyToTurnIn"
                          ? text("NPC에게 보고", "Return to NPC")
                          : `${quest.progress}/${quest.required}`}
                      </span>
                    </p>
                  );
                })}
              </div>
            )}
            <div className="game-event-feed" aria-live="polite" aria-label={text("탐사 기록", "Field Log")}>
              {latestLogs.map((entry, index) => (
                <p key={`${game.turn}-${index}-${entry}`}>
                  <span aria-hidden="true">›</span>
                  {entry}
                </p>
              ))}
            </div>
            {inspectMode && !hasInspectedEntity && (
              <div className="inspect-prompt">
                <i className="magnifier-glyph" aria-hidden="true" />
                {text(
                  "개체·아이템·구조물·장판·지형을 클릭해 조사 · 같은 칸 재클릭 시 다음 요소",
                  "Inspect entities, items, objects, fields, and terrain · click again to cycle a stacked tile",
                )}
              </div>
            )}
            {pendingQuickslotDefinition && (
              <div className="throw-prompt quickslot-target-prompt">
                <ItemIcon itemId={pendingQuickslotDefinition.id} size={28} />
                <span>
                  <strong>
                    {pendingQuickslotOwnerName} · {localizedItemName(
                      pendingQuickslotDefinition.id,
                      language,
                    )}
                  </strong>
                  {pendingQuickslotAim?.suggestedTarget
                      ? text(
                        "가까운 적 조준됨 · 같은 퀵슬롯을 다시 눌러 발사 · 빈 타일·시야 밖 타일도 선택 가능 · Esc 취소",
                        "Nearest enemy targeted · press the same slot to fire · empty and unseen tiles are valid · Esc to cancel",
                      )
                    : text(
                        "가까운 적 없음 · 시야 밖을 포함한 원하는 타일로 발사 · Esc 취소",
                        "No nearby enemy · fire toward any tile, including unseen tiles · Esc to cancel",
                      )}
                </span>
              </div>
            )}
            {pendingSkillDefinition && (
              <div
                className="throw-prompt skill-target-prompt"
                style={{ "--skill-accent": pendingSkillDefinition.accent } as CSSProperties}
              >
                <i aria-hidden="true">
                  {language === "ko"
                    ? pendingSkillDefinition.shortKo
                    : pendingSkillDefinition.shortEn.slice(0, 2)}
                </i>
                <span>
                  <strong>
                    {pendingSkillCasterName} · {language === "ko"
                      ? pendingSkillDefinition.nameKo
                      : pendingSkillDefinition.nameEn}
                  </strong>
                  {pendingCompanionSkill?.suggestedTarget
                    ? text(
                        `${pendingSkillDefinition.range === 0 ? "자기 칸" : `사거리 ${pendingSkillDefinition.range}칸`} · 같은 스킬을 다시 누르면 자동 발동 · 빈 타일·시야 밖 타일도 선택 가능 · Esc 취소`,
                        `${pendingSkillDefinition.range === 0 ? "Self tile" : `Range ${pendingSkillDefinition.range}`} · press the same skill to auto-cast · empty and unseen tiles are valid · Esc to cancel`,
                      )
                    : text(
                        `사거리 ${pendingSkillDefinition.range}칸 · 빈 타일·시야 밖 타일도 선택 가능 · Esc 취소`,
                        `Range ${pendingSkillDefinition.range} · empty and unseen tiles are valid · Esc to cancel`,
                      )}
                </span>
              </div>
            )}
            {throwingDefinition && (
              <div className="throw-prompt">
                <ItemIcon itemId={throwingDefinition.id} size={28} />
                <span>
                  <strong>
                    {localizedItemName(throwingDefinition.id, language)}
                  </strong>
                  {text(
                    "던질 방향을 지도에서 클릭 · 시야 밖도 가능 · Esc 취소",
                    "Select a direction, including unseen tiles · Esc to cancel",
                  )}
                </span>
              </div>
            )}
            {castingDefinition && (
              <div className="throw-prompt magic-prompt">
                <ItemIcon itemId={castingDefinition.id} size={28} />
                <span>
                  <strong>
                    {localizedItemName(castingDefinition.id, language)}
                  </strong>
                  {text(
                    "발사할 목표를 지도에서 클릭 · 시야 밖도 가능 · Esc 취소",
                    "Select a target tile, including unseen tiles · Esc to cancel",
                  )}
                </span>
              </div>
            )}
            {inspectMode && inspectedEnemy && (
              <EntityInspector
                enemy={inspectedEnemy}
                anchor={inspectedEntity!.anchor}
                onClose={() => {
                  setInspectedEntity(null);
                  setInspectMode(false);
                }}
              />
            )}
            {inspectMode && inspectedEntity?.kind === "player" && (
              <PlayerInspector
                game={game}
                anchor={inspectedEntity.anchor}
                onClose={() => {
                  setInspectedEntity(null);
                  setInspectMode(false);
                }}
              />
            )}
            {inspectMode && inspectedCompanion && (
              <CompanionInspector
                companion={inspectedCompanion}
                anchor={inspectedEntity!.anchor}
                onClose={() => {
                  setInspectedEntity(null);
                  setInspectMode(false);
                }}
              />
            )}
            {inspectMode && inspectedGroundItem && inspectedEntity?.kind === "groundItem" && (
              <ItemDetailModal
                game={null}
                selected={{
                  itemId: inspectedGroundItem.defId,
                  itemRef: inspectedGroundItem.instance?.id ?? inspectedGroundItem.id,
                  anchor: inspectedEntity.anchor,
                }}
                preview={{
                  itemId: inspectedGroundItem.defId,
                  itemRef: inspectedGroundItem.instance?.id ?? inspectedGroundItem.id,
                  instance: inspectedGroundItem.instance ?? null,
                  quantity: inspectedGroundItem.quantity ?? 1,
                  contextLabel: text("바닥의 아이템", "Ground Item"),
                  anchor: inspectedEntity.anchor,
                }}
                readOnly
                onClose={() => {
                  setInspectedEntity(null);
                  setInspectMode(false);
                }}
              />
            )}
            {inspectMode && inspectedMapElement && (
              <MapElementInspector
                inspection={inspectedMapElement}
                game={game}
                onClose={() => {
                  setInspectedEntity(null);
                  setInspectMode(false);
                }}
              />
            )}
            {busy && (
              <div className="turn-indicator">
                {autoExploring
                  ? text(
                      "자동탐사 중 · 적 조우 및 생명력 감시",
                      "Auto-exploring · monitoring enemies and health",
                    )
                  : text("턴이 이어지는 중", "Resolving turn")}
              </div>
            )}
            {game.gameOver && gameOverPresentationReady && (
              <div className="game-over">
                <h2>{text("탐사가 끝났습니다", "The Expedition Ends")}</h2>
                <span>
                  {text(
                    `지하 ${game.floor}층 · ${game.turn}턴`,
                    `Floor ${game.floor} · Turn ${game.turn}`,
                  )}
                </span>
                <button type="button" onClick={() => finishCurrentExpedition("defeated")}>
                  {text("성과 확인", "View Results")}
                </button>
              </div>
            )}
          </div>

          <div className="action-deck">
            <div
              className="movement-pad"
              aria-label={text("이동 조작", "Movement controls")}
            >
              <button
                type="button"
                disabled={controlledActionDisabled}
                onClick={() => move(-1, -1)}
                aria-label={text("왼쪽 위", "Up-left")}
              >
                ↖
              </button>
              <button
                type="button"
                disabled={controlledActionDisabled}
                onClick={() => move(0, -1)}
                aria-label={text("위", "Up")}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={controlledActionDisabled}
                onClick={() => move(1, -1)}
                aria-label={text("오른쪽 위", "Up-right")}
              >
                ↗
              </button>
              <button
                type="button"
                disabled={controlledActionDisabled}
                onClick={() => move(-1, 0)}
                aria-label={text("왼쪽", "Left")}
              >
                ←
              </button>
              <button
                type="button"
                disabled={controlledActionDisabled}
                onClick={waitOneTurn}
                aria-label={text("한 턴 기다리기", "Wait one turn")}
              >
                ·
              </button>
              <button
                type="button"
                disabled={controlledActionDisabled}
                onClick={() => move(1, 0)}
                aria-label={text("오른쪽", "Right")}
              >
                →
              </button>
              <button
                type="button"
                disabled={controlledActionDisabled}
                onClick={() => move(-1, 1)}
                aria-label={text("왼쪽 아래", "Down-left")}
              >
                ↙
              </button>
              <button
                type="button"
                disabled={controlledActionDisabled}
                onClick={() => move(0, 1)}
                aria-label={text("아래", "Down")}
              >
                ↓
              </button>
              <button
                type="button"
                disabled={controlledActionDisabled}
                onClick={() => move(1, 1)}
                aria-label={text("오른쪽 아래", "Down-right")}
              >
                ↘
              </button>
            </div>
            {itemsHere.length > 0 && (
              <button
                type="button"
                className="pickup-action"
                onClick={pickUpHere}
                disabled={controlledActionDisabled}
              >
                <ItemIcon itemId={itemsHere[0].defId} size={34} />
                <span>
                  <strong>
                    {text("줍기", "Pick Up")}
                    {itemsHere.length > 1 ? ` ×${itemsHere.length}` : ""}
                  </strong>
                  <small>{text("1턴", "1 turn")}</small>
                </span>
              </button>
            )}
            <button
              type="button"
              className="secondary-action"
              onClick={waitOneTurn}
              disabled={controlledActionDisabled}
            >
              <strong>{text("한 턴 대기", "Wait One Turn")}</strong>
              <small>{text("스페이스", "Space")}</small>
            </button>
            <div className="keyboard-hint">
              <span>
                <kbd>WASD</kbd>
                {text("이동", "Move")}
              </span>
              <span>
                <kbd>{text("클릭", "Click")}</kbd>
                {text("자동 이동", "Travel")}
              </span>
              <span>
                <kbd>{text("휠·핀치", "Wheel·Pinch")}</kbd>
                {text("확대·축소", "Zoom")}
              </span>
              <span>
                <kbd>{text("드래그", "Drag")}</kbd>
                {text("동료 지시 · 카메라", "Companion order · Camera")}
              </span>
            </div>
          </div>
        </div>

        <aside className="side-column">
          <section className="side-card equipment-card">
            <header>
              <div>
                <h2>{text("장비", "Equipment")}</h2>
              </div>
              <span>{text("교체 시 1턴", "1 turn to change")}</span>
            </header>
            <CompanionPanel
              game={game}
              selection={companionLoadoutSelection}
              playerSelection={playerLoadoutSelection}
              pendingItemRef={pendingLoadoutItemRef}
              upgradeMode={Boolean(pendingEquipmentConsumable)}
              canTargetEquipment={(itemId, instance) => Boolean(
                pendingEquipmentConsumable &&
                canApplyEquipmentConsumable(
                  pendingEquipmentConsumable.itemId,
                  ITEM_DEFS[itemId],
                  instance,
                )
              )}
              onSelectSlot={selectCompanionLoadoutSlot}
              onSelectPlayerSlot={selectPlayerLoadoutSlot}
              onAssignPendingCompanion={assignPendingCompanionItem}
              onAssignPendingPlayer={assignPendingPlayerItem}
              onUpgradeCompanion={applyConsumableToCompanionLoadout}
              onUpgradePlayer={applyConsumableToPlayerLoadout}
              onOpenSlotItem={openCompanionLoadoutItem}
              onOpenPlayerSlotItem={openPlayerLoadoutItem}
              onUnassign={unassignSelectedCompanionItem}
              onUnequipPlayer={unequipSelectedPlayerItem}
              selectedSkill={pendingCompanionSkill}
              onSkill={beginCompanionSkill}
              onQuickslot={beginPartyQuickslot}
              onRecruit={recruitDeveloperCompanion}
              developerMode={developerMode}
              busy={busy && !autoExploring}
              upgradeFlashKey={upgradeFlashKey}
            />
            <PersistentInventory
              game={game}
              selected={selectedInventoryItem}
              onSelect={setSelectedInventoryItem}
              onFastUse={handleUseOwnedItem}
              onFastEquip={fastEquipOwnedItem}
              pendingLoadoutItemRef={pendingLoadoutItemRef}
              upgradeMode={Boolean(pendingEquipmentConsumable)}
              canTargetEquipment={(itemId, instance) => Boolean(
                pendingEquipmentConsumable &&
                canApplyEquipmentConsumable(
                  pendingEquipmentConsumable.itemId,
                  ITEM_DEFS[itemId],
                  instance,
                )
              )}
              onUpgradeItem={(itemRef) =>
                applyPendingEquipmentConsumable({ kind: "inventory", itemRef })
              }
              companionTarget={companionLoadoutSelection}
              playerTarget={playerLoadoutSelection}
              onCompanionItem={assignSelectedCompanionItem}
              onPlayerItem={assignSelectedPlayerItem}
              onCancelPicker={() => {
                setPendingLoadoutItemRef(null);
                setPendingEquipmentConsumable(null);
                setCompanionLoadoutSelection(null);
                setPlayerLoadoutSelection(null);
              }}
              upgradeFlashKey={upgradeFlashKey}
            />
          </section>

        </aside>
      </section>

      <footer className="site-footer">
        <span>
          {text(
            "비공식 GPL-3.0 웹 프로토타입",
            "Unofficial GPL-3.0 web prototype",
          )}
        </span>
        <button type="button" onClick={() => setHelpOpen(true)}>
          {text(
            "원작·라이선스·조작 안내",
            "Credits, License, and Controls",
          )}
        </button>
      </footer>

      {selectedInventoryItem && (
        <ItemDetailModal
          game={game}
          selected={selectedInventoryItem}
          onClose={() => setSelectedInventoryItem(null)}
          onUse={handleUseOwnedItem}
          onEquip={beginLoadoutAssignment}
          onUnequip={removeEquipment}
          onUnassignCompanion={unassignSelectedCompanionItem}
          onThrow={beginThrowItem}
          onDiscard={discardOwnedItem}
          onEnchant={enchantOwnedEquipment}
          busy={busy && !autoExploring}
        />
      )}
      {alchemyOpen && (
        <AlchemyModal
          game={game}
          busy={busy}
          onBrew={brewSelectedIngredients}
          onClose={() => setAlchemyOpen(false)}
        />
      )}
      {questPrompt && (
        <QuestInteractionModal
          game={game}
          questId={questPrompt.questId}
          onAccept={acceptCurrentQuest}
          onClaim={claimCurrentQuestReward}
          onClose={() => setQuestPrompt(null)}
        />
      )}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {settingsOpen && (
        <SettingsModal
          uiScale={uiScale}
          fontScale={fontScale}
          language={language}
          soundEnabled={soundEnabled}
          developerMode={developerMode}
          onScaleChange={onScaleChange}
          onFontScaleChange={onFontScaleChange}
          onLanguageChange={onLanguageChange}
          onSoundEnabledChange={onSoundEnabledChange}
          onDeveloperModeChange={onDeveloperModeChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {compendiumOpen && (
        <CompendiumModal
          developerMode={developerMode}
          onGrantItem={grantDeveloperItem}
          onSpawnEnemy={spawnDeveloperEnemy}
          onClose={() => setCompendiumOpen(false)}
        />
      )}
      {exitConfirmOpen && (
        <div className="modal-backdrop expedition-exit-backdrop">
          <section className="expedition-exit-modal" role="dialog" aria-modal="true" aria-labelledby="expedition-exit-title">
            <p className="eyebrow">RETURN TO BASE</p>
            <h2 id="expedition-exit-title">탐사를 종료하시겠습니까?</h2>
            <p>
              현재 층에서 원정을 마치고 귀환합니다. 가방에 남은 아이템은 모두 창고로 이동합니다.
            </p>
            <div>
              <button type="button" onClick={() => setExitConfirmOpen(false)}>계속 탐사</button>
              <button type="button" className="is-primary" onClick={() => finishCurrentExpedition("retreated")}>탐사 종료</button>
            </div>
          </section>
        </div>
      )}
      {(game.equipmentOffers?.length ?? 0) > 0 &&
        !autoExploring && (
          <EquipmentComparisonModal
            game={game}
            onAccept={acceptEquipmentComparison}
            onDecline={declineEquipmentComparison}
          />
        )}
      <HeldItemCursor held={dungeonSlotDrag.held} />
      </main>
      </UiLanguageContext.Provider>
    </ItemSlotDragContext.Provider>
  );
}

export default function DungeonGame() {
  const [campaign, setCampaign] = useState<CampaignSave>(() =>
    createDefaultCampaign(),
  );
  const [campaignHydrated, setCampaignHydrated] = useState(false);
  const [screen, setScreen] = useState<CampaignScreen>("hub");
  const [commerceOpen, setCommerceOpen] = useState(false);
  const [commerceView, setCommerceView] = useState<CommerceView>("warehouse");
  const [blacksmithOpen, setBlacksmithOpen] = useState(false);
  const [trainingGroundOpen, setTrainingGroundOpen] = useState(false);
  const [blacksmithTarget, setBlacksmithTarget] = useState<SmithyTarget | null>(null);
  const [blacksmithSelectionRevision, setBlacksmithSelectionRevision] = useState(0);
  const [facilityNotice, setFacilityNotice] = useState<string | null>(null);
  const [hubHelpOpen, setHubHelpOpen] = useState(false);
  const [hubSettingsOpen, setHubSettingsOpen] = useState(false);
  const [hubCompendiumOpen, setHubCompendiumOpen] = useState(false);
  const [uiScale, setUiScale] = useState(1);
  const [fontScale, setFontScale] = useState(1);
  const [language, setLanguage] = useState<UiLanguage>("ko");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [developerMode, setDeveloperMode] = useState(false);
  const [selectedDungeon, setSelectedDungeon] =
    useState<DungeonDefinition | null>(null);
  const [preparationLoadout, setPreparationLoadout] =
    useState<ExpeditionLoadout>({
      stacks: {},
      instanceIds: [],
      slotRefs: Array.from({ length: MAX_INVENTORY_SLOTS }, () => null),
    });
  const [selectedCompanionIds, setSelectedCompanionIds] = useState<string[]>([]);
  const [activeExpedition, setActiveExpedition] =
    useState<ActiveExpedition | null>(null);
  const [expeditionResult, setExpeditionResult] =
    useState<ExpeditionResultView | null>(null);
  const uiAudioRuntimeRef = useRef<GameAudioRuntime | null>(null);
  const beginWarehouseConsumableTargetMode = useCallback(() => {
    setBlacksmithTarget(null);
  }, []);
  const warehouseInteraction = useCampaignWarehouseInteraction({
    campaign,
    onCampaignChange: setCampaign,
    onNotice: setFacilityNotice,
    onBeginTargetMode: beginWarehouseConsumableTargetMode,
  });
  const dungeonOffers = useMemo(
    () => generateDungeonOffers(
      campaign.offerSeed,
      campaign.bossDungeonClears,
    ),
    [campaign.bossDungeonClears, campaign.offerSeed],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const restored = restoreCampaign(
        window.localStorage.getItem(CAMPAIGN_STORAGE_KEY),
      );
      if (restored) {
        setCampaign(restored);
      } else {
        const firstOfferSeed = randomDungeonSeed();
        setCampaign((current) => ({
          ...current,
          offerSeed: firstOfferSeed,
          shop: createShopState(firstOfferSeed, current.expeditions),
        }));
      }
      try {
        const rawActive = window.localStorage.getItem(
          ACTIVE_EXPEDITION_STORAGE_KEY,
        );
        const saved = rawActive
          ? JSON.parse(rawActive) as ActiveExpedition
          : null;
        if (
          saved?.dungeon?.id &&
          saved.initialGame?.tiles?.length &&
          saved.initialGame.player
        ) {
          setActiveExpedition(saved);
          setScreen("dungeon");
        }
      } catch {
        window.localStorage.removeItem(ACTIVE_EXPEDITION_STORAGE_KEY);
      }
      const savedScale = Number(
        window.localStorage.getItem(UI_SCALE_STORAGE_KEY),
      );
      const savedFontScale = Number(
        window.localStorage.getItem(FONT_SCALE_STORAGE_KEY),
      );
      const savedLanguage = window.localStorage.getItem(
        LANGUAGE_STORAGE_KEY,
      );
      if (UI_SCALE_OPTIONS.some((scale) => scale === savedScale)) {
        setUiScale(savedScale);
      }
      if (FONT_SCALE_OPTIONS.some((scale) => scale === savedFontScale)) {
        setFontScale(savedFontScale);
      }
      if (savedLanguage === "ko" || savedLanguage === "en") {
        setLanguage(savedLanguage);
      }
      setCampaignHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const runtime = new GameAudioRuntime();
    runtime.setEnabled(true);
    runtime.preload();
    uiAudioRuntimeRef.current = runtime;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (uiAudioControlAt(event.target)) {
        void runtime.unlockAndPlay("uiClick", 0.62, 1.04);
      } else {
        void runtime.unlock();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        (event.key !== "Enter" && event.key !== " ") ||
        !uiAudioControlAt(event.target)
      ) return;
      void runtime.unlockAndPlay("uiClick", 0.62, 1.04);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      runtime.destroy();
      if (uiAudioRuntimeRef.current === runtime) {
        uiAudioRuntimeRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    uiAudioRuntimeRef.current?.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (!campaignHydrated) return;
    window.localStorage.setItem(
      CAMPAIGN_STORAGE_KEY,
      JSON.stringify(campaign),
    );
  }, [campaign, campaignHydrated]);

  const changeUiScale = useCallback((scale: number) => {
    setUiScale(scale);
    window.localStorage.setItem(UI_SCALE_STORAGE_KEY, String(scale));
  }, []);

  const changeFontScale = useCallback((scale: number) => {
    setFontScale(scale);
    window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(scale));
  }, []);

  const changeLanguage = useCallback((nextLanguage: UiLanguage) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  }, []);

  const openPreparation = useCallback(
    (dungeon: DungeonDefinition) => {
      warehouseInteraction.reset();
      setSelectedDungeon(dungeon);
      setCommerceOpen(false);
      setBlacksmithOpen(false);
      setTrainingGroundOpen(false);
      setFacilityNotice(null);
      setHubHelpOpen(false);
      setHubSettingsOpen(false);
      setHubCompendiumOpen(false);
      setPreparationLoadout({
        stacks: {},
        instanceIds: [],
        slotRefs: Array.from({ length: MAX_INVENTORY_SLOTS }, () => null),
      });
      setSelectedCompanionIds(
        campaign.companions.slice(0, 3).map((companion) => companion.id),
      );
      setScreen("preparation");
    },
    [campaign.companions, warehouseInteraction],
  );

  const togglePreparationCompanion = useCallback((companionId: string) => {
    setSelectedCompanionIds((current) => {
      if (current.includes(companionId)) {
        return current.filter((id) => id !== companionId);
      }
      if (current.length >= 3) return current;
      return [...current, companionId];
    });
  }, []);

  const handleShopSell = useCallback((slotIndex: number) => {
    const result = sellWarehouseItem(campaign, slotIndex);
    if (result.changed) {
      setCampaign(result.campaign);
      setFacilityNotice(`${ITEM_DEFS[result.itemId]?.name ?? result.itemId}을(를) ${formatGold(result.goldDelta)} G에 판매했습니다. 같은 가격으로 되살 수 있습니다.`);
      return true;
    }
    setFacilityNotice("판매할 물품을 찾지 못했습니다.");
    return false;
  }, [campaign]);

  const handleShopBuy = useCallback((source: ShopListingSource, listingId: string) => {
    const result = buyShopListing(campaign, source, listingId);
    if (result.changed) {
      setCampaign(result.campaign);
      setFacilityNotice(`${ITEM_DEFS[result.itemId]?.name ?? result.itemId}을(를) ${formatGold(-result.goldDelta)} G에 구매해 창고로 옮겼습니다.`);
      return true;
    }
    const message = result.reason === "not-enough-gold"
      ? "구매에 필요한 골드가 부족합니다."
      : result.reason === "warehouse-full"
        ? "창고가 가득 차 새 물품을 보관할 수 없습니다."
        : "구매할 상품을 찾지 못했습니다.";
    setFacilityNotice(message);
    return false;
  }, [campaign]);

  const handleBlacksmithUpgrade = useCallback((target: SmithyTarget) => {
    const result = upgradeCampaignEquipmentGrade(campaign, target);
    if (result.changed) {
      setCampaign(result.campaign);
      const itemName = result.itemId
        ? ITEM_DEFS[result.itemId]?.name ?? result.itemId
        : "장비";
      setFacilityNotice(`${itemName}: ${result.fromGrade} → ${result.toGrade} 등급 강화 완료 · ${formatGold(result.cost)} G 사용`);
      return true;
    }
    const message = result.reason === "not-enough-gold"
      ? `등급 강화에 필요한 골드가 ${formatGold(result.cost - campaign.gold)} G 부족합니다.`
      : result.reason === "not-enough-materials"
        ? "등급 강화에 필요한 룬석이 부족합니다."
      : result.reason === "maximum-grade"
        ? "이미 최고 등급인 S급 장비입니다."
        : "강화할 장비를 찾지 못했습니다.";
    setFacilityNotice(message);
    return false;
  }, [campaign]);

  const handleBlacksmithEnchantReroll = useCallback((
    target: SmithyTarget,
    lockedIndexes: readonly number[],
  ) => {
    const result = rerollCampaignEquipmentEnchantments(
      campaign,
      target,
      lockedIndexes,
    );
    if (result.changed) {
      setCampaign(result.campaign);
      const itemName = result.itemId
        ? ITEM_DEFS[result.itemId]?.name ?? result.itemId
        : "장비";
      setFacilityNotice(
        `${itemName}: 인챈트 변경 완료 · 룬석 ${result.runestoneCost}개${result.lockedCount > 0 ? ` · 고정 주문서 ${result.lockedCount}개` : ""} 사용`,
      );
      return true;
    }
    const message = result.reason === "not-enough-runestones"
      ? `인챈트 변경에 필요한 룬석이 ${Math.max(0, result.runestoneCost - campaign.materials.runestone)}개 부족합니다.`
      : result.reason === "not-enough-lock-scrolls"
        ? "인챈트 고정 주문서가 부족합니다."
        : result.reason === "nothing-to-reroll"
          ? "변경할 인챈트가 없습니다."
          : result.reason === "invalid-item"
            ? "인챈트를 변경할 수 없는 장비입니다."
            : "인챈트를 변경할 장비를 찾지 못했습니다.";
    setFacilityNotice(message);
    return false;
  }, [campaign]);

  const handleCampaignSlotDrop = useCallback(
    (held: HeldSlotItem, target: ItemSlotAddress) => {
      const source = held.source;
      if (target.zone === "smithyTarget") {
        warehouseInteraction.cancelPending();
        const candidate = listSmithyCandidates(campaign).find(
          (entry) => entry.instance.id === held.item.itemRef,
        );
        const grade = candidate
          ? resolveItemGrade(ITEM_DEFS[candidate.itemId], candidate.instance)
          : null;
        if (candidate && grade && smithyNextGrade(grade)) {
          setBlacksmithTarget(candidate.target);
          setBlacksmithSelectionRevision((revision) => revision + 1);
          setFacilityNotice(null);
        }
        return;
      }
      if (
        source.zone === "warehouse" &&
        (
          target.zone === "shopSellTarget" ||
          target.zone === "shopStock" ||
          target.zone === "shopBuyback"
        )
      ) {
        handleShopSell(source.index);
        return;
      }
      if (
        (source.zone === "shopStock" || source.zone === "shopBuyback") &&
        (target.zone === "shopWarehouseTarget" || target.zone === "warehouse")
      ) {
        handleShopBuy(
          source.zone === "shopStock" ? "stock" : "buyback",
          source.listingId,
        );
        return;
      }
      if (
        !isPreparationSlotAddress(source) ||
        !isPreparationSlotAddress(target)
      ) {
        return;
      }
      const result = applyPreparationSlotTransfer(
        campaign,
        preparationLoadout,
        source,
        target,
      );
      if (!result.changed) return;
      setCampaign(result.campaign);
      setPreparationLoadout(result.loadout);
    },
    [
      campaign,
      handleShopBuy,
      handleShopSell,
      preparationLoadout,
      warehouseInteraction,
    ],
  );
  const campaignSlotDrag = useItemSlotDrag(handleCampaignSlotDrop);

  const enterDeveloperTestMap = useCallback(() => {
    if (!developerMode) return;
    const party = campaign.companions
      .slice(0, 3)
      .map((companion) => normalizeCompanionForHub(companion));
    const leader = party[0];
    if (!leader) return;
    const base = createExpeditionGame(
      DEVELOPER_TEST_MAP_SEED,
      {
        dungeonId: DEVELOPER_TEST_MAP_ID,
        dungeonName: DEVELOPER_TEST_DUNGEON.nameKo,
        maxFloor: 1,
        difficultyScale: 1,
        difficulty: 1,
        mainDropIds: [],
        specialRoomPlan: [],
        lootPlan: [],
        goldPlan: [],
      },
      companionToPlayer(leader),
      party.slice(1),
    );
    const initialGame = createDeveloperTestMap(base);
    const active = {
      dungeon: DEVELOPER_TEST_DUNGEON,
      initialGame,
    };
    setActiveExpedition(active);
    window.localStorage.setItem(
      ACTIVE_EXPEDITION_STORAGE_KEY,
      JSON.stringify(active),
    );
    setExpeditionResult(null);
    setHubSettingsOpen(false);
    setScreen("dungeon");
  }, [campaign.companions, developerMode]);

  const enterDeveloperBossFloor = useCallback(() => {
    if (!developerMode) return;
    const party = campaign.companions
      .slice(0, 3)
      .map((companion) => normalizeCompanionForHub(companion));
    const leader = party[0];
    if (!leader) return;
    const initialGame = createExpeditionGame(
      0xb055f100,
      {
        dungeonId: DEVELOPER_BOSS_DUNGEON.id,
        dungeonName: DEVELOPER_BOSS_DUNGEON.nameKo,
        maxFloor: DEVELOPER_BOSS_DUNGEON.floorCount,
        difficultyScale: DEVELOPER_BOSS_DUNGEON.difficultyScale,
        difficulty: DEVELOPER_BOSS_DUNGEON.difficulty,
        bossId: DEVELOPER_BOSS_DUNGEON.bossId,
        mainDropIds: [],
        specialRoomPlan: [],
        lootPlan: [],
        goldPlan: [],
        quests: [],
      },
      companionToPlayer(leader),
      party.slice(1),
    );
    const active = {
      dungeon: DEVELOPER_BOSS_DUNGEON,
      initialGame,
    };
    setActiveExpedition(active);
    window.localStorage.setItem(
      ACTIVE_EXPEDITION_STORAGE_KEY,
      JSON.stringify(active),
    );
    setExpeditionResult(null);
    setHubSettingsOpen(false);
    setScreen("dungeon");
  }, [campaign.companions, developerMode]);

  const renderCampaignSurface = (content: ReactNode) => (
    <ItemSlotDragContext.Provider value={campaignSlotDrag}>
      <CampaignWarehouseInteractionContext.Provider value={warehouseInteraction}>
        <UiLanguageContext.Provider value={language}>
        <div
          lang={language}
          data-language={language}
          className={`campaign-drag-surface screen-${screen}`}
          style={
            {
              "--ui-scale": uiScale,
              "--font-scale": fontScale,
              "--ui-width": `${100 / uiScale}%`,
            } as CSSProperties
          }
          {...campaignSlotDrag.containerProps}
        >
          {content}
          {screen !== "hub" && (
            <nav className="campaign-utility-dock" aria-label="항상 사용 가능한 메뉴">
              <button type="button" onClick={() => setHubCompendiumOpen(true)}>도감</button>
              <button type="button" onClick={() => setHubSettingsOpen(true)}>설정</button>
              <button type="button" onClick={() => setHubHelpOpen(true)}>탐사 안내</button>
            </nav>
          )}
          {commerceOpen && (
            <CommerceModal
              campaign={campaign}
              view={commerceView}
              notice={facilityNotice}
              onBuy={handleShopBuy}
              onClose={() => {
                warehouseInteraction.reset();
                setCommerceOpen(false);
                setFacilityNotice(null);
              }}
            />
          )}
          {blacksmithOpen && (
            <BlacksmithModal
              campaign={campaign}
              selectedTarget={blacksmithTarget}
              selectionRevision={blacksmithSelectionRevision}
              notice={facilityNotice}
              onTargetSelect={(target) => {
                warehouseInteraction.cancelPending();
                setBlacksmithTarget(target);
                setBlacksmithSelectionRevision((revision) => revision + 1);
                setFacilityNotice(null);
              }}
              onUpgrade={handleBlacksmithUpgrade}
              onRerollEnchantments={handleBlacksmithEnchantReroll}
              onClose={() => {
                warehouseInteraction.reset();
                setBlacksmithOpen(false);
                setBlacksmithTarget(null);
                setFacilityNotice(null);
              }}
            />
          )}
          {trainingGroundOpen && (
            <TrainingGroundModal
              campaign={campaign}
              warehouseNotice={facilityNotice}
              onCampaignChange={setCampaign}
              onClose={() => {
                warehouseInteraction.reset();
                setTrainingGroundOpen(false);
                setFacilityNotice(null);
              }}
            />
          )}
          {hubHelpOpen && <HelpModal onClose={() => setHubHelpOpen(false)} />}
          {hubSettingsOpen && (
            <SettingsModal
              uiScale={uiScale}
              fontScale={fontScale}
              language={language}
              soundEnabled={soundEnabled}
              developerMode={developerMode}
              onScaleChange={changeUiScale}
              onFontScaleChange={changeFontScale}
              onLanguageChange={changeLanguage}
              onSoundEnabledChange={setSoundEnabled}
              onDeveloperModeChange={setDeveloperMode}
              onEnterTestMap={enterDeveloperTestMap}
              onEnterBossFloor={enterDeveloperBossFloor}
              onClose={() => setHubSettingsOpen(false)}
            />
          )}
          {hubCompendiumOpen && (
            <CompendiumModal
              developerMode={developerMode}
              onClose={() => setHubCompendiumOpen(false)}
            />
          )}
          {warehouseInteraction.itemPreview && (
            <ItemDetailModal
              game={null}
              selected={{
                itemId: warehouseInteraction.itemPreview.itemId,
                itemRef: warehouseInteraction.itemPreview.itemRef,
              }}
              preview={warehouseInteraction.itemPreview}
              readOnly
              onUse={isEquipmentConsumableId(
                warehouseInteraction.itemPreview.itemId,
              ) ? warehouseInteraction.beginPreviewUse : undefined}
              onClose={warehouseInteraction.closePreview}
            />
          )}
          <HeldItemCursor held={campaignSlotDrag.held} />
        </div>
        </UiLanguageContext.Provider>
      </CampaignWarehouseInteractionContext.Provider>
    </ItemSlotDragContext.Provider>
  );

  const startPreparedExpedition = useCallback(() => {
    const dungeon = selectedDungeon ?? dungeonOffers[0];
    const uniqueCompanionIds = [...new Set(selectedCompanionIds)].slice(0, 3);
    const party = uniqueCompanionIds.flatMap((companionId) => {
      const companion = campaign.companions.find(
        (candidate) => candidate.id === companionId,
      );
      return companion ? [normalizeCompanionForHub(companion)] : [];
    });
    const leader = party[0];
    if (!leader) return;
    const companions = party.slice(1);
    const withdrawal = takeLoadoutFromWarehouse(
      campaign.warehouse,
      preparationLoadout,
    );
    const player = applyLoadoutToPlayer(
      companionToPlayer(leader),
      withdrawal.loadout,
      withdrawal.instances,
    );
    const developerParams = new URLSearchParams(window.location.search);
    const requestedRoom = developerParams.get("dev-room");
    const forcedSpecialRoom =
      developerMode && requestedRoom && isSpecialRoomPreset(requestedRoom)
        ? requestedRoom
        : undefined;
    const expeditionSeed =
      developerMode &&
        (developerParams.get("dev-room") === "p0" || forcedSpecialRoom)
        ? 0x00000002
        : randomDungeonSeed();
    const forcedRoomPresets =
      developerMode && developerParams.get("dev-room") === "p0"
        ? P0_ROOM_PRESETS
        : [];
    const initialGame = createExpeditionGame(
      expeditionSeed,
      {
        dungeonId: dungeon.id,
        dungeonName: dungeon.nameKo,
        maxFloor: dungeon.floorCount,
        difficultyScale: dungeon.difficultyScale,
        difficulty: dungeon.difficulty,
        bossId: dungeon.bossId,
        mainDropIds: [...dungeon.mainDropIds],
        specialRoomPlan: dungeon.specialRoomPlan,
        lootPlan: dungeon.lootPlan,
        goldPlan: dungeon.goldPlan,
      },
      player,
      companions,
      forcedRoomPresets,
      forcedSpecialRoom,
    );
    setCampaign((current) => ({
      ...current,
      warehouse: withdrawal.warehouse,
      expeditions: current.expeditions + 1,
    }));
    setActiveExpedition({ dungeon, initialGame });
    window.localStorage.setItem(
      ACTIVE_EXPEDITION_STORAGE_KEY,
      JSON.stringify({ dungeon, initialGame }),
    );
    setExpeditionResult(null);
    setScreen("dungeon");
  }, [
    campaign.companions,
    campaign.warehouse,
    developerMode,
    dungeonOffers,
    preparationLoadout,
    selectedCompanionIds,
    selectedDungeon,
  ]);

  const finishExpedition = useCallback(
    (
      outcome: ExpeditionOutcome,
      finalGame: GameState,
      stats: ExpeditionStats,
    ) => {
      const finishedDungeon =
        activeExpedition?.dungeon ?? selectedDungeon ?? dungeonOffers[0];
      if (finishedDungeon.id === DEVELOPER_TEST_MAP_ID) {
        setActiveExpedition(null);
        setExpeditionResult(null);
        window.localStorage.removeItem(ACTIVE_EXPEDITION_STORAGE_KEY);
        setSelectedDungeon(null);
        setScreen("hub");
        return;
      }
      const rolledOfferSeed = randomDungeonSeed();
      const nextOfferSeed =
        rolledOfferSeed === campaign.offerSeed
          ? ((rolledOfferSeed + 0x9e3779b9) >>> 0) ||
            INITIAL_DUNGEON_OFFER_SEED
          : rolledOfferSeed;
      setCampaign((current) => {
        const deposited = depositPlayerInventory(
          current.warehouse,
          finalGame.player,
          current.materials,
        );
        const goldFound = Math.max(0, Math.floor(finalGame.goldCollected));
        const completionGold = outcome === "completed"
          ? finishedDungeon.completionGold
          : 0;
        const next: CampaignSave = {
          ...current,
          warehouse: deposited.warehouse,
          materials: deposited.materials,
          companions: mergeReturningCompanions(
            current.companions,
            [playerToCompanion(finalGame.player), ...finalGame.companions],
          ),
          completedExpeditions:
            current.completedExpeditions + (outcome === "completed" ? 1 : 0),
          bossDungeonClears: bossDungeonClearsAfterOutcome(
            current.bossDungeonClears,
            finishedDungeon,
            outcome,
          ),
          gold: current.gold + goldFound + completionGold,
          offerSeed: nextOfferSeed,
          shop: createShopState(nextOfferSeed, current.expeditions),
        };
        setExpeditionResult({
          dungeon: finishedDungeon,
          outcome,
          materialsGained: deposited.materialsGained,
          stats: {
            ...stats,
            recoveredItems: deposited.recoveredItems,
            goldFound,
            completionGold,
          },
        });
        return next;
      });
      setActiveExpedition(null);
      window.localStorage.removeItem(ACTIVE_EXPEDITION_STORAGE_KEY);
      setSelectedDungeon(null);
      setScreen("results");
    },
    [activeExpedition, campaign.offerSeed, dungeonOffers, selectedDungeon],
  );

  if (screen === "dungeon" && activeExpedition) {
    return (
      <DungeonRun
        key={`${activeExpedition.dungeon.id}-${activeExpedition.initialGame.seed}`}
        initialGame={activeExpedition.initialGame}
        dungeon={activeExpedition.dungeon}
        audioRuntimeRef={uiAudioRuntimeRef}
        uiScale={uiScale}
        fontScale={fontScale}
        language={language}
        soundEnabled={soundEnabled}
        developerMode={developerMode}
        onScaleChange={changeUiScale}
        onFontScaleChange={changeFontScale}
        onLanguageChange={changeLanguage}
        onSoundEnabledChange={setSoundEnabled}
        onDeveloperModeChange={setDeveloperMode}
        onGameSave={(game) => {
          window.localStorage.setItem(
            ACTIVE_EXPEDITION_STORAGE_KEY,
            JSON.stringify({ dungeon: activeExpedition.dungeon, initialGame: game }),
          );
        }}
        onFinish={finishExpedition}
      />
    );
  }

  if (screen === "results" && expeditionResult) {
    return renderCampaignSurface(
      <ResultsScreen
        result={expeditionResult}
        onReturn={() => {
          setExpeditionResult(null);
          setScreen("hub");
        }}
      />
    );
  }

  if (screen === "preparation") {
    return renderCampaignSurface(
      <PreparationScreen
        dungeon={selectedDungeon ?? dungeonOffers[0]}
        campaign={campaign}
        developerMode={developerMode}
        loadout={preparationLoadout}
        selectedCompanionIds={selectedCompanionIds}
        onCompanionToggle={togglePreparationCompanion}
        onBack={() => {
          warehouseInteraction.reset();
          setSelectedDungeon(null);
          setScreen("hub");
        }}
        onStart={startPreparedExpedition}
      />
    );
  }

  return renderCampaignSurface(
    <HubScreen
      campaign={campaign}
      dungeons={dungeonOffers}
      developerMode={developerMode}
      onSelectDungeon={openPreparation}
      onOpenWarehouse={() => {
        warehouseInteraction.reset();
        setCommerceView("warehouse");
        setCommerceOpen(true);
        setBlacksmithOpen(false);
        setTrainingGroundOpen(false);
        setFacilityNotice(null);
      }}
      onOpenShop={() => {
        warehouseInteraction.reset();
        setCommerceView("shop");
        setCommerceOpen(true);
        setBlacksmithOpen(false);
        setTrainingGroundOpen(false);
        setFacilityNotice(null);
      }}
      onOpenBlacksmith={() => {
        warehouseInteraction.reset();
        setBlacksmithOpen(true);
        setTrainingGroundOpen(false);
        setBlacksmithTarget(null);
        setCommerceOpen(false);
        setFacilityNotice(null);
      }}
      onOpenTraining={() => {
        warehouseInteraction.reset();
        setTrainingGroundOpen(true);
        setBlacksmithOpen(false);
        setCommerceOpen(false);
        setFacilityNotice(null);
      }}
      onOpenCompendium={() => setHubCompendiumOpen(true)}
      onOpenSettings={() => setHubSettingsOpen(true)}
      onOpenHelp={() => setHubHelpOpen(true)}
    />
  );
}
