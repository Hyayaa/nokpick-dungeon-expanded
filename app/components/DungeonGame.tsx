"use client";

import {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  WheelEvent as ReactWheelEvent,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
import {
  acceptEquipmentOffer,
  activateCompanionSkill,
  advanceManualPartyRound,
  advanceExpeditionFloor,
  assignCompanionItem,
  assignPlayerItem,
  autoEquipBetterOffers,
  canAssignCompanionItem,
  canAssignPlayerItem,
  COMPANION_PASSIVE_SLOT_INDEXES,
  COMPANION_QUICKSLOT_INDEXES,
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
  runEnemyTurn,
  setCompanionCommand,
  setCompanionPriorityTarget,
  shouldAutoPickup,
  throwItem,
  unassignCompanionItem,
  unassignPlayerItem,
  upgradeItemWithScroll,
  useItem as consumeItemAction,
  activateCompanionQuickslot,
  waitTurn,
  zapWand,
} from "../game/engine";
import { hasLineOfSight } from "../game/map";
import {
  CampaignSave,
  DungeonDefinition,
  ExpeditionLoadout,
  ExpeditionOutcome,
  ExpeditionStats,
  WarehouseState,
  applyLoadoutToPlayer,
  cloneWarehouse,
  companionToPlayer,
  createInitialWarehouse,
  createStarterCompanionRoster,
  depositPlayerInventory,
  formatElapsedTime,
  generateDungeonOffers,
  INITIAL_DUNGEON_OFFER_SEED,
  mergeReturningCompanions,
  normalizeCompanionForHub,
  normalizeCompanionForHubWithReleasedItems,
  normalizeHeroForHub,
  playerToCompanion,
  selectedLoadoutSlotCount,
  takeLoadoutFromWarehouse,
  warehouseItemCount,
} from "../game/campaign";
import {
  WAREHOUSE_SLOT_COUNT,
  normalizeFixedSlots,
  normalizePlayerInventorySlots,
  normalizeStorageSlots,
  swapFixedSlots,
} from "../game/inventory-slots";
import {
  COMPANION_ATTACK_FRAMES,
  COMPANION_CLASSES,
  COMPANION_CLASS_IDS,
  COMPANION_DEFEAT_FRAMES,
  COMPANION_IDLE_FRAMES,
  COMPANION_INTERACT_FRAMES,
  COMPANION_MOVE_FRAMES,
  COMPANION_TRAITS,
  COMPANION_TRAIT_IDS,
  companionArmorTier,
  companionFrameIndex,
  getCompanionAttack,
  getCompanionAccuracy,
  getCompanionDefense,
  getCompanionEvasion,
  getCompanionViewDistance,
} from "../game/companions";
import { COMPANION_SKILLS } from "../game/companion-skills";
import {
  ALCHEMY_ENCHANT_CATALYST_IDS,
  ALCHEMY_ENCHANT_RECIPES,
  SIMPLE_ALCHEMY_RECIPES,
} from "../game/alchemy";
import {
  createPlainEquipmentInstance,
  equipmentStatProfile,
  equipmentTraitSummary,
  isUpgradeableEquipment,
} from "../game/equipment";
import {
  AUTO_SLOT_CATEGORIES,
  STATUS_DESCRIPTIONS,
  STATUS_LABELS,
  WAND_CODEX,
  isWand,
} from "../game/magic";
import {
  createEffectTrajectories,
  EffectTrajectory,
  releaseHeldSignalsAtTurnStart,
} from "../game/effects";
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
  drawPixelEffects,
  fieldTilePixels,
  LogicalGridPixel,
  PixelCameraShake,
  PixelEffect,
  pruneCameraShakes,
  prunePixelEffects,
} from "../game/pixel-effects";
import {
  FOG_PIXELS_PER_TILE,
  createPixelFogRuntime,
  drawPixelFogTexture,
  resetPixelFogRuntime,
} from "../game/fog-frontier";
import {
  createDungeonRenderCache,
  fogMaskBitAt,
  overlayFrameAt,
  syncDungeonRenderCache,
  terrainFrameAt,
} from "../game/render-cache";
import { resolveItemRarity } from "../game/item-rarity";
import { runtimeImageSource } from "../game/runtime-assets";
import {
  drawSheetFrame,
  terrainUnderlayForPixelFog,
  TILE_SIZE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  waterSurfaceMaskRows,
  waterTextureSlices,
} from "../game/render";
import {
  PLAYER_ATTACK_FRAMES,
  PLAYER_IDLE_FRAMES,
  PLAYER_INTERACT_FRAMES,
  PLAYER_MOVE_FRAMES,
} from "../game/player-animation";
import {
  createTurnMotionTimeline,
  durationForMotion,
  MIN_ACTION_DURATION,
  PLAYER_INTERACTION_DURATION,
  PLAYER_MOVE_DURATION,
} from "../game/timing";
import {
  ActionResult,
  CloudKind,
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
  Terrain,
  UpgradeTarget,
} from "../game/types";

type VisualMotion = Motion & {
  startedAt: number;
  duration: number;
};

type FloatingEffect = CombatEffect & EffectTrajectory & {
  id: string;
  startedAt: number;
};

type PickupVisual = ItemPickup & {
  startedAt: number;
};

type ThrowVisual = ItemThrow & {
  startedAt: number;
  duration: number;
};

type StatusSignalVisual = StatusSignal & {
  id: string;
  startedAt: number;
  duration: number;
  releasedAt?: number;
};

type MagicVisualRuntime = MagicVisual & {
  startedAt: number;
  duration: number;
};

type PlayerActionAnimation = {
  kind: "interact";
  startedAt: number;
  duration: number;
};

type EntityFlashVisual = {
  id: string;
  startedAt: number;
  duration: number;
};

type DefeatedEnemyVisual = {
  enemy: Enemy;
  removeAt: number;
};

type DefeatedCompanionVisual = {
  companion: Companion;
  revealAt: number;
};

type DescriptionAnchor = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

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

type GameAssets = {
  tiles: HTMLImageElement;
  water: HTMLImageElement;
  items: HTMLImageElement;
  player: HTMLImageElement;
  enemies: Record<EnemyKind, HTMLImageElement>;
  companions: Record<CompanionClassId, HTMLImageElement>;
};

type SoundName = GameSoundId;

type CameraDrag = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCameraX: number;
  startCameraY: number;
  moved: boolean;
};

type CompanionMapDrag = {
  pointerId: number;
  companionId: string;
  startClientX: number;
  startClientY: number;
  cursor: Point;
  grabOffset: Point;
  target: Point | null;
  moved: boolean;
};

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

const upgradeTargetVisualKey = (target: UpgradeTarget) => {
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

const randomDungeonSeed = () => {
  const seed =
    (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  return seed || INITIAL_DUNGEON_OFFER_SEED;
};
const PLAYER_ID = "player";
const ENTITY_SPRITE_SCALE = 3;
const PLAYER_IDLE_FRAME_DURATION = 150;
// The walk cycle is deliberately independent from one-tile travel time.
// Otherwise every step lands on the same frame boundary and looks restarted.
const PLAYER_MOVE_FRAME_DURATION = 64;
const PLAYER_MOVE_CONTINUITY_GRACE = 48;
const PICKUP_DURATION = 620;
const THROW_DURATION = 300;
const throwVisualDuration = (itemThrow: ItemThrow) => {
  void itemThrow;
  return THROW_DURATION;
};
const throwImpactDelay = (itemThrow: ItemThrow) =>
  throwVisualDuration(itemThrow) * 0.9;

const drawLogicalGridPixels = (
  context: CanvasRenderingContext2D,
  pixels: readonly LogicalGridPixel[],
  originX: number,
  originY: number,
  pixelSize: number,
  opacity = 1,
) => {
  context.save();
  context.imageSmoothingEnabled = false;
  pixels.forEach((pixel) => {
    context.globalAlpha = opacity * pixel.alpha;
    context.fillStyle = pixel.color;
    context.fillRect(
      Math.round(originX + pixel.x * pixelSize),
      Math.round(originY + pixel.y * pixelSize),
      Math.max(1, Math.ceil(pixel.size * pixelSize)),
      Math.max(1, Math.ceil(pixel.size * pixelSize)),
    );
  });
  context.restore();
};
const LEVEL_UP_EFFECT_HOLD = 420;
const RING_SPRITE_OFFSET = { x: 4, y: 3 };
const UI_SCALE_STORAGE_KEY = "shattered-web-ui-scale";
const UI_SCALE_OPTIONS = [0.8, 0.9, 1, 1.1, 1.2] as const;
const FONT_SCALE_STORAGE_KEY = "shattered-web-font-scale";
const LANGUAGE_STORAGE_KEY = "shattered-web-language";
const CAMPAIGN_STORAGE_KEY = "shattered-web-campaign-v1";
const AUTO_EXPLORATION_ENABLED = false;
const FONT_SCALE_OPTIONS = [0.85, 1, 1.15, 1.3] as const;
const UiLanguageContext = createContext<UiLanguage>("ko");
const useUiLanguage = () => useContext(UiLanguageContext);
const uiText = (
  language: UiLanguage,
  korean: string,
  english: string,
) => (language === "ko" ? korean : english);

const descriptionAnchorFromElement = (
  element: Element,
): DescriptionAnchor => {
  const bounds = element.getBoundingClientRect();
  return {
    left: bounds.left,
    top: bounds.top,
    right: bounds.right,
    bottom: bounds.bottom,
  };
};

const descriptionAnchorFromPoint = (
  clientX: number,
  clientY: number,
): DescriptionAnchor => ({
  left: clientX - 4,
  top: clientY - 4,
  right: clientX + 4,
  bottom: clientY + 4,
});

const fallbackDescriptionAnchor = (): DescriptionAnchor => {
  const active =
    typeof document !== "undefined" && document.activeElement instanceof Element
      ? document.activeElement
      : null;
  if (active) return descriptionAnchorFromElement(active);
  const width = typeof window === "undefined" ? 1280 : window.innerWidth;
  const height = typeof window === "undefined" ? 720 : window.innerHeight;
  return descriptionAnchorFromPoint(width * 0.5, height * 0.42);
};

function DescriptionWindow({
  anchor,
  className = "",
  ariaLabel,
  labelledBy,
  onClose,
  style,
  children,
}: {
  anchor?: DescriptionAnchor | null;
  className?: string;
  ariaLabel?: string;
  labelledBy?: string;
  onClose: () => void;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const resolvedAnchor = anchor ?? fallbackDescriptionAnchor();
  const [placement, setPlacement] = useState({
    left: resolvedAnchor.right + 10,
    top: resolvedAnchor.top,
    side: "right" as "left" | "right",
    ready: false,
    fontScale: "1",
  });

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const updatePlacement = () => {
      const bounds = panel.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 10;
      const gap = 10;
      const roomOnRight = viewportWidth - resolvedAnchor.right;
      const roomOnLeft = resolvedAnchor.left;
      const side =
        roomOnRight >= bounds.width + gap || roomOnRight >= roomOnLeft
          ? "right"
          : "left";
      const preferredLeft =
        side === "right"
          ? resolvedAnchor.right + gap
          : resolvedAnchor.left - bounds.width - gap;
      const preferredTop = resolvedAnchor.top;
      const centerX = Math.max(
        0,
        Math.min(
          viewportWidth - 1,
          (resolvedAnchor.left + resolvedAnchor.right) / 2,
        ),
      );
      const centerY = Math.max(
        0,
        Math.min(
          viewportHeight - 1,
          (resolvedAnchor.top + resolvedAnchor.bottom) / 2,
        ),
      );
      const sourceElement = document.elementFromPoint(centerX, centerY);
      const sourceScale = sourceElement
        ? window
            .getComputedStyle(sourceElement)
            .getPropertyValue("--font-scale")
            .trim()
        : "";
      setPlacement({
        left: Math.max(
          margin,
          Math.min(viewportWidth - bounds.width - margin, preferredLeft),
        ),
        top: Math.max(
          margin,
          Math.min(viewportHeight - bounds.height - margin, preferredTop),
        ),
        side,
        ready: true,
        fontScale: sourceScale || "1",
      });
    };
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    return () => window.removeEventListener("resize", updatePlacement);
  }, [
    resolvedAnchor.bottom,
    resolvedAnchor.left,
    resolvedAnchor.right,
    resolvedAnchor.top,
  ]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="description-window-layer" role="presentation">
      <section
        ref={panelRef}
        className={`description-window ${className}`.trim()}
        data-anchor-side={placement.side}
        role="dialog"
        aria-modal="false"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        style={
          {
            ...style,
            left: placement.left,
            top: placement.top,
            visibility: placement.ready ? "visible" : "hidden",
            "--font-scale": placement.fontScale,
          } as CSSProperties
        }
        onPointerDown={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
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
const SOUND_PATHS: Record<SoundName, string> = {
  step: "/assets/sounds/step.mp3",
  water: "/assets/sounds/water.mp3",
  hit: "/assets/sounds/hit.mp3",
  hitSlash: "/assets/sounds/hit_slash.mp3",
  death: "/assets/sounds/death.mp3",
  levelUp: "/assets/sounds/levelup.mp3",
  item: "/assets/sounds/item.mp3",
  drink: "/assets/sounds/drink.mp3",
  read: "/assets/sounds/read.mp3",
  eat: "/assets/sounds/eat.mp3",
  doorOpen: "/assets/sounds/door_open.mp3",
  unlock: "/assets/sounds/unlock.mp3",
  trample: "/assets/sounds/trample.mp3",
  teleport: "/assets/sounds/teleport.mp3",
  shatter: "/assets/sounds/shatter.mp3",
  descend: "/assets/sounds/descend.mp3",
  healthWarn: "/assets/sounds/health_warn.mp3",
  equip: "/assets/sounds/equip.mp3",
};

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

const pointEquals = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const partyDistance = (a: Point, b: Point) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const livingPartyIds = (state: GameState) => [
  ...(state.player.hp > 0 ? [PLAYER_ID] : []),
  ...(state.companions ?? [])
    .filter((companion) => companion.hp > 0)
    .map((companion) => companion.id),
];
const partyActor = (state: GameState, actorId: string) =>
  actorId === PLAYER_ID
    ? state.player
    : (state.companions ?? []).find(
        (companion) => companion.id === actorId,
      ) ?? state.player;
const nearestVisibleEnemy = (
  state: GameState,
  actorId: string,
  maximumRange: number,
) => {
  const actor = partyActor(state, actorId);
  return state.enemies
    .filter(
      (enemy) =>
        enemy.hp > 0 &&
        state.tiles[enemy.y]?.[enemy.x]?.visible &&
        partyDistance(actor, enemy) <= maximumRange &&
        hasLineOfSight(state.tiles, actor, enemy),
    )
    .sort(
      (a, b) =>
        partyDistance(actor, a) - partyDistance(actor, b) ||
        a.hp - b.hp,
    )[0] ?? null;
};
const suggestedSkillTarget = (
  state: GameState,
  casterId: string,
  skillId: CompanionSkillId,
): Point | null => {
  const definition = COMPANION_SKILLS[skillId];
  const caster = partyActor(state, casterId);
  if (definition.range === 0) return { x: caster.x, y: caster.y };
  if (definition.target === "ally") {
    return [state.player, ...(state.companions ?? [])]
      .filter(
        (actor) =>
          actor.hp > 0 &&
          actor.hp < actor.maxHp &&
          partyDistance(caster, actor) <= definition.range &&
          (!definition.requiresLineOfSight ||
            hasLineOfSight(state.tiles, caster, actor)),
      )
      .sort(
        (a, b) =>
          a.hp / Math.max(1, a.maxHp) -
            b.hp / Math.max(1, b.maxHp) ||
          partyDistance(caster, a) - partyDistance(caster, b),
      )
      .map((actor) => ({ x: actor.x, y: actor.y }))[0] ?? null;
  }
  const enemy = nearestVisibleEnemy(
    state,
    casterId,
    definition.range,
  );
  return enemy ? { x: enemy.x, y: enemy.y } : null;
};
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

const TERRAIN_DETAILS: Record<
  Terrain,
  { nameKo: string; nameEn: string; descriptionKo: string; descriptionEn: string }
> = {
  wall: {
    nameKo: "하수도 벽",
    nameEn: "Sewer Wall",
    descriptionKo: "이동과 시야를 막는 단단한 벽입니다.",
    descriptionEn: "A solid wall that blocks movement and sight.",
  },
  floor: {
    nameKo: "석재 바닥",
    nameEn: "Stone Floor",
    descriptionKo: "특별한 효과 없이 걸을 수 있는 바닥입니다.",
    descriptionEn: "Ordinary walkable dungeon floor.",
  },
  grass: {
    nameKo: "짧은 풀",
    nameEn: "Short Grass",
    descriptionKo: "이미 밟혀 낮아진 풀입니다. 이동과 시야를 막지 않습니다.",
    descriptionEn: "Trampled grass that no longer blocks movement or sight.",
  },
  highGrass: {
    nameKo: "높은 풀",
    nameEn: "High Grass",
    descriptionKo: "시야를 가리는 수풀입니다. 밟으면 낮아지며 불이 빠르게 번집니다.",
    descriptionEn: "Dense grass that blocks sight, flattens when crossed, and readily catches fire.",
  },
  water: {
    nameKo: "얕은 물",
    nameEn: "Shallow Water",
    descriptionKo: "걸어서 건널 수 있습니다. 불을 끄며 전기가 연결된 물웅덩이를 따라 전도됩니다.",
    descriptionEn: "Walkable water that extinguishes fire and conducts electricity through connected pools.",
  },
  entrance: {
    nameKo: "층 입구",
    nameEn: "Floor Entrance",
    descriptionKo: "원정대가 이번 층에 들어온 지점입니다.",
    descriptionEn: "The point where the party entered this floor.",
  },
  exit: {
    nameKo: "하강 계단",
    nameEn: "Down Stairway",
    descriptionKo: "현재 층의 잠금을 해결한 뒤 다음 층으로 내려가는 출구입니다.",
    descriptionEn: "The way down after the floor's locked route has been opened.",
  },
  door: {
    nameKo: "닫힌 문",
    nameEn: "Closed Door",
    descriptionKo: "열 때 1턴을 소비하며, 닫힌 동안 이동과 시야를 막습니다.",
    descriptionEn: "Opening it costs a turn; while closed it blocks movement and sight.",
  },
  openDoor: {
    nameKo: "열린 문",
    nameEn: "Open Door",
    descriptionKo: "현재 열려 있어 이동과 시야가 통하는 문입니다.",
    descriptionEn: "An open doorway that currently allows movement and sight.",
  },
  lockedDoor: {
    nameKo: "잠긴 문",
    nameEn: "Locked Door",
    descriptionKo: "이 층의 쇠 열쇠가 있어야 열 수 있습니다. 상호작용에는 1턴이 듭니다.",
    descriptionEn: "Requires this floor's iron key and costs one turn to unlock.",
  },
};

const OBJECT_DETAILS: Record<
  keyof typeof OBJECT_SPRITES,
  { descriptionKo: string; descriptionEn: string }
> = {
  chest: {
    descriptionKo: "일반 장비 한 점을 보관한 나무 상자입니다. 가까이에서 조사하면 열 수 있습니다.",
    descriptionEn: "A wooden chest holding one equipment reward. Interact nearby to open it.",
  },
  crystalChest: {
    descriptionKo: "희귀한 장비가 담긴 수정 상자입니다. 가까이에서 조사하면 열 수 있습니다.",
    descriptionEn: "A crystal chest containing rare equipment. Interact nearby to open it.",
  },
  tomb: {
    descriptionKo: "오래된 장비가 묻힌 무덤입니다. 가까이에서 조사하면 내용물을 꺼낼 수 있습니다.",
    descriptionEn: "An old tomb concealing equipment. Interact nearby to recover it.",
  },
  alchemy: {
    descriptionKo: "가까이에서 조사하면 연금술 창을 열 수 있는 재사용 작업대입니다.",
    descriptionEn: "A reusable workbench that opens the alchemy interface when investigated nearby.",
  },
};

const CLOUD_DETAILS: Record<
  CloudKind,
  { nameKo: string; nameEn: string; descriptionKo: string; descriptionEn: string }
> = {
  fire: {
    nameKo: "화염 장판",
    nameEn: "Burning Ground",
    descriptionKo: "머무는 대상을 태우며 수풀과 문을 따라 빠르게 번집니다. 물 위에는 유지되지 않습니다.",
    descriptionEn: "Burns occupants and spreads quickly through grass and doors, but cannot persist on water.",
  },
  frost: {
    nameKo: "냉기 장판",
    nameEn: "Frost Field",
    descriptionKo: "대상에게 한기를 누적시키고 심해지면 빙결시킵니다.",
    descriptionEn: "Builds chill on occupants and can eventually freeze them.",
  },
  paralytic: {
    nameKo: "마비 가스",
    nameEn: "Paralytic Gas",
    descriptionKo: "들이마신 대상을 일정 시간 행동할 수 없게 만듭니다.",
    descriptionEn: "Prevents affected targets from acting for a time.",
  },
  toxic: {
    nameKo: "맹독 가스",
    nameEn: "Toxic Gas",
    descriptionKo: "범위 안의 대상에게 지속적인 독 피해를 줍니다.",
    descriptionEn: "Poisons targets within the affected area over time.",
  },
  corrosive: {
    nameKo: "부식 가스",
    nameEn: "Corrosive Gas",
    descriptionKo: "방어를 무시하는 부식 피해를 지속적으로 줍니다.",
    descriptionEn: "Deals ongoing corrosive damage that bypasses defense.",
  },
  storm: {
    nameKo: "폭풍 구름",
    nameEn: "Storm Cloud",
    descriptionKo: "범위 안을 물로 적시고 번개가 전도되기 쉬운 환경을 만듭니다.",
    descriptionEn: "Soaks its area and creates favorable conditions for conducting lightning.",
  },
};

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
const FLEX_RING_KEYS = ["ring", "ring2", "ring3", "ring4"] as const;
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
const isPartyQuickslotTarget = (target: LoadoutTarget) =>
  target.kind === "flex" &&
  COMPANION_QUICKSLOT_INDEXES.includes(
    target.index as (typeof COMPANION_QUICKSLOT_INDEXES)[number],
  );
const equipmentKeyForSelection = (target: PlayerLoadoutSelection) =>
  target.kind === "equipment"
    ? target.slot
    : FLEX_RING_KEYS[target.index];

const itemSpriteOffset = (itemId: string) =>
  ITEM_DEFS[itemId]?.category === "ring" ? RING_SPRITE_OFFSET : { x: 0, y: 0 };

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const clampCamera = (
  camera: Point,
  zoom: number,
  state: Pick<GameState, "width" | "height">,
) => {
  const clampAxis = (value: number, worldSize: number, viewSize: number) => {
    const visibleWorldSize = viewSize / zoom;
    // Allow most of the map to move beyond an edge. This keeps overview zoom
    // useful and lets players deliberately frame rooms away from the centre.
    const overscroll = Math.max(
      TILE_SIZE * 6,
      Math.min(visibleWorldSize * 0.75, worldSize * 0.75),
    );
    if (worldSize <= visibleWorldSize) {
      const centered = (worldSize - visibleWorldSize) / 2;
      return clamp(value, centered - overscroll, centered + overscroll);
    }
    return clamp(
      value,
      -overscroll,
      worldSize - visibleWorldSize + overscroll,
    );
  };
  return {
    x: clampAxis(camera.x, state.width * TILE_SIZE, VIEW_WIDTH),
    y: clampAxis(camera.y, state.height * TILE_SIZE, VIEW_HEIGHT),
  };
};

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

function ItemRarityMarker({
  itemId,
  instance,
}: {
  itemId: string;
  instance?: InventoryInstance | null;
}) {
  const rarity = resolveItemRarity(ITEM_DEFS[itemId], instance);
  return (
    <span
      aria-hidden="true"
      className="item-rarity-marker"
      data-item-rarity={rarity}
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
      <ItemRarityMarker itemId={itemId} instance={instance} />
      <ItemIcon itemId={itemId} size={size} />
      {upgradeLevel > 0 && (
        <span className="item-upgrade-badge">+{upgradeLevel}</span>
      )}
      {instance?.cursed && (
        <span
          className="item-curse-badge"
          aria-label="저주받은 장비"
          title="저주받은 장비"
        >
          저
        </span>
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
  if (!held) return null;
  return (
    <div
      className="held-item-cursor"
      style={{ left: held.clientX + 14, top: held.clientY + 14 }}
      aria-hidden="true"
    >
      <ItemSlotContents
        itemId={held.item.itemId}
        size={40}
        instance={{
          id: held.item.itemRef,
          defId: held.item.itemId,
          upgradeLevel: held.item.upgradeLevel,
          charges: held.item.charges,
          maxCharges: held.item.maxCharges,
        }}
        quantity={held.item.quantity}
        showQuantity={held.item.quantity > 1}
      />
    </div>
  );
}

function useItemSlotDrag(
  onDrop: (source: HeldSlotItem, target: ItemSlotAddress) => void | Promise<void>,
) {
  const [held, setHeld] = useState<HeldSlotItem | null>(null);
  const heldRef = useRef<HeldSlotItem | null>(null);
  const pendingRef = useRef<{
    pointerId: number;
    source: ItemSlotAddress;
    item: DragSlotItem;
    clientX: number;
    clientY: number;
    timer: number;
    container: HTMLElement;
  } | null>(null);
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
        source,
        item,
        clientX: event.clientX,
        clientY: event.clientY,
        timer: 0,
        container,
      };
      pending.timer = window.setTimeout(() => {
        if (pendingRef.current !== pending) return;
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
      }, 280);
      pendingRef.current = pending;
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      if (pendingRef.current?.pointerId === event.pointerId) {
        pendingRef.current.clientX = event.clientX;
        pendingRef.current.clientY = event.clientY;
      }
      if (heldRef.current?.pointerId !== event.pointerId) return;
      const next = {
        ...heldRef.current,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      heldRef.current = next;
      setHeld(next);
      event.preventDefault();
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      const pending = pendingRef.current;
      if (pending?.pointerId === event.pointerId) {
        window.clearTimeout(pending.timer);
        pendingRef.current = null;
      }
      const active = heldRef.current;
      if (!active || active.pointerId !== event.pointerId) return;
      const targetElement = document
        .elementFromPoint(event.clientX, event.clientY)
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
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Capture may already have been released by the browser.
      }
      event.preventDefault();
    },
    onPointerCancel: () => clearDrag(),
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

function CompanionPanel({
  game,
  selection,
  playerSelection,
  pendingItemRef,
  upgradeMode,
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
  const controlledDefinition = COMPANION_CLASSES[game.player.classId];
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
    skillIds: readonly CompanionSkillId[],
    cooldowns: Partial<Record<CompanionSkillId, number>>,
    defeated: boolean,
  ) => (
    <div className="companion-skill-list" aria-label={text("수동 스킬", "Manual Skills")}>
      {skillIds.slice(0, 2).map((skillId) => {
        const skill = COMPANION_SKILLS[skillId];
        const cooldown = cooldowns[skillId] ?? 0;
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
              disabled={busy || defeated || cooldown > 0}
              onClick={() => onSkill(casterId, skillId)}
              aria-pressed={active}
              aria-label={text(`${skill.nameKo} 사용`, `Use ${skill.nameEn}`)}
            >
              <i aria-hidden="true">{language === "ko" ? skill.shortKo : skill.shortEn.slice(0, 2)}</i>
              <span>
                <strong>{language === "ko" ? skill.nameKo : skill.nameEn}</strong>
                <small>
                  {cooldown > 0
                    ? text(`${cooldown}턴 후`, `${cooldown} turns`)
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
            <div>
              <strong>{game.player.name}</strong>
              <small>{language === "ko" ? controlledDefinition.nameKo : controlledDefinition.nameEn} · Lv.{game.player.level}</small>
              <small>HP {game.player.hp}/{game.player.maxHp}</small>
            </div>
          </button>
          {skillButtons(
            PLAYER_ID,
            game.player.skills,
            game.player.skillCooldowns,
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
                itemId && entry.instance && isUpgradeableEquipment(ITEM_DEFS[itemId]),
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
          const classDefinition = COMPANION_CLASSES[companion.classId];
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
                <div>
                  <strong>{displayName}</strong>
                  <small>{language === "ko" ? classDefinition.nameKo : classDefinition.nameEn} · Lv.{companion.level}</small>
                  <small>HP {companion.hp}/{companion.maxHp}</small>
                </div>
              </button>
              {skillButtons(
                companion.id,
                companion.skills,
                companion.skillCooldowns,
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
                    itemId && entry.instance && isUpgradeableEquipment(ITEM_DEFS[itemId]),
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
                {language === "ko" ? COMPANION_CLASSES[classId].nameKo : COMPANION_CLASSES[classId].nameEn}
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
          casterName={inspectedSkillOwner.name}
          skillId={inspectedSkill.skillId}
          cooldown={inspectedSkillOwner.skillCooldowns[inspectedSkill.skillId] ?? 0}
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
  const enemyName = localizedEnemyName(enemy.kind, language);

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
  const definition = COMPANION_CLASSES[player.classId];
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
            <h3>{player.name} · {language === "ko" ? definition.nameKo : definition.nameEn} · Lv.{player.level}</h3>
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
  const definition = COMPANION_CLASSES[companion.classId];
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
            <h3>{displayName} · {language === "ko" ? definition.nameKo : definition.nameEn}</h3>
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
        <span><small>{text("공격력", "Attack")}</small><strong>{getCompanionAttack(companion)}</strong></span>
        <span><small>{text("방어력", "Defense")}</small><strong>{getCompanionDefense(companion)}</strong></span>
        <span><small>{text("명중", "Accuracy")}</small><strong>{getCompanionAccuracy(companion)}</strong></span>
        <span><small>{text("회피", "Evasion")}</small><strong>{getCompanionEvasion(companion)}</strong></span>
        <span><small>{text("시야", "Vision")}</small><strong>{getCompanionViewDistance(companion)}</strong></span>
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

function SkillDescriptionWindow({
  casterName,
  skillId,
  cooldown,
  anchor,
  disabled,
  onUse,
  onClose,
}: {
  casterName: string;
  skillId: CompanionSkillId;
  cooldown: number;
  anchor: DescriptionAnchor;
  disabled: boolean;
  onUse: () => void;
  onClose: () => void;
}) {
  const language = useUiLanguage();
  const text = (korean: string, english: string) =>
    uiText(language, korean, english);
  const skill = COMPANION_SKILLS[skillId];
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
          <small>{casterName} · {text("수동 스킬", "Manual Skill")}</small>
          <h3>{language === "ko" ? skill.nameKo : skill.nameEn}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label={text("스킬 설명 닫기", "Close skill details")}>×</button>
      </header>
      <div className="description-copy">
        <p>{language === "ko" ? skill.descriptionKo : skill.descriptionEn}</p>
        <dl>
          <div><dt>{text("대상", "Target")}</dt><dd>{skill.target === "ally" ? text("아군", "Ally") : skill.target === "enemy" ? text("적", "Enemy") : text("타일", "Tile")}</dd></div>
          <div><dt>{text("사거리", "Range")}</dt><dd>{skill.range === 0 ? text("자기 칸", "Self") : `${skill.range}`}</dd></div>
          <div><dt>{text("재사용", "Cooldown")}</dt><dd>{skill.cooldown}{text("턴", " turns")}</dd></div>
          <div><dt>{text("현재", "Current")}</dt><dd>{cooldown > 0 ? text(`${cooldown}턴 남음`, `${cooldown} turns`) : text("사용 가능", "Ready")}</dd></div>
        </dl>
      </div>
      <footer className="description-window-actions">
        <button type="button" onClick={onClose}>{text("닫기", "Close")}</button>
        <button
          type="button"
          className="is-primary"
          disabled={disabled || cooldown > 0}
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

  const usable = USABLE_ITEM_CATEGORIES.has(definition.category);
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
        {
          label: text("품질", "Quality"),
          value: profile.quality,
          maximum: 5,
          color: "#d8b66b",
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
              <span>
                {text("개별 장비 · 품질", "Individual gear · Quality")}{" "}
                {profile?.quality ?? 3}/5
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
                    "같은 장비라도 품질과 특성에 따라 수치가 달라집니다.",
                    "Stats vary with each item's quality and traits.",
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
                  traits.map((trait) => (
                    <li
                      key={trait.id}
                      style={
                        { "--trait-accent": trait.accent } as CSSProperties
                      }
                    >
                      <strong>
                        {language === "ko" ? trait.name : humanizeId(trait.id)}{" "}
                        {trait.rank > 1 ? `ⅹ${trait.rank}` : ""}
                      </strong>
                      <span>
                        {language === "ko"
                          ? trait.description
                          : `This equipment trait is active at rank ${trait.rank}.`}
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
              ? text("강화할 장비 선택", "Choose Equipment to Upgrade")
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
            instance && isUpgradeableEquipment(definition),
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
                  isWand(itemId) || USABLE_ITEM_CATEGORIES.has(definition.category)
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
              "강조된 장비를 기존 장비창이나 인벤토리에서 선택합니다.",
              "Choose a highlighted item in the existing loadout or inventory.",
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
                "이 비공식 웹 프로토타입은 Shattered Pixel Dungeon v3.3.8의 코드 구조와 그래픽·효과음 자산을 수정·재구성했습니다. 원작은 Evan Debenham, Pixel Dungeon은 Oleg Dolya의 저작물이며 GPL-3.0-or-later에 따라 제공됩니다.",
                "This unofficial web prototype adapts code structures, graphics, and audio from Shattered Pixel Dungeon v3.3.8. The original is by Evan Debenham, Pixel Dungeon is by Oleg Dolya, and the work is provided under GPL-3.0-or-later.",
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
  developerMode,
  onScaleChange,
  onFontScaleChange,
  onLanguageChange,
  onDeveloperModeChange,
  onClose,
}: {
  uiScale: number;
  fontScale: number;
  language: UiLanguage;
  developerMode: boolean;
  onScaleChange: (scale: number) => void;
  onFontScaleChange: (scale: number) => void;
  onLanguageChange: (language: UiLanguage) => void;
  onDeveloperModeChange: (enabled: boolean) => void;
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
    version: 4,
    warehouse: createInitialWarehouse(),
    companions: createStarterCompanionRoster(COMPANION_CLASS_IDS),
    expeditions: 0,
    completedExpeditions: 0,
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
      offerSeed?: number;
    };
    if (
      ![1, 2, 3, 4].includes(parsed.version ?? 0) ||
      !parsed.warehouse ||
      !Array.isArray(parsed.companions) ||
      (parsed.version === 1 && !parsed.hero)
    ) {
      return null;
    }
    const restoredWarehouse = cloneWarehouse({
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
    return {
      version: 4,
      warehouse: restoredWarehouse,
      companions,
      expeditions: Math.max(0, parsed.expeditions ?? 0),
      completedExpeditions: Math.max(0, parsed.completedExpeditions ?? 0),
      offerSeed:
        typeof parsed.offerSeed === "number" &&
        Number.isFinite(parsed.offerSeed)
          ? parsed.offerSeed >>> 0
          : randomDungeonSeed(),
    };
  } catch {
    return null;
  }
};

function CampaignHeader({
  warehouseCount,
  expeditions,
  onOpenWarehouse,
  onOpenCompendium,
  onOpenSettings,
  onOpenHelp,
}: {
  warehouseCount: number;
  expeditions: number;
  onOpenWarehouse: () => void;
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
      </div>
      <nav className="campaign-header-actions" aria-label="거점 메뉴">
        <button type="button" onClick={onOpenCompendium}>도감</button>
        <button type="button" onClick={onOpenSettings}>설정</button>
        <button type="button" onClick={onOpenHelp}>탐사 안내</button>
        <button
          type="button"
          className="warehouse-button"
          onClick={onOpenWarehouse}
        >
          <span aria-hidden="true">▣</span>
          창고
          <b>{warehouseCount}</b>
        </button>
      </nav>
    </header>
  );
}

function HubScreen({
  campaign,
  dungeons,
  onSelectDungeon,
  onOpenWarehouse,
  onOpenCompendium,
  onOpenSettings,
  onOpenHelp,
}: {
  campaign: CampaignSave;
  dungeons: DungeonDefinition[];
  onSelectDungeon: (dungeon: DungeonDefinition) => void;
  onOpenWarehouse: () => void;
  onOpenCompendium: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}) {
  const storedCount = warehouseItemCount(campaign.warehouse);
  const [itemPreview, setItemPreview] = useState<ItemDetailPreview | null>(null);
  const rosterLeader = campaign.companions[0];
  const rosterLeaderDefinition = rosterLeader
    ? COMPANION_CLASSES[rosterLeader.classId]
    : null;
  return (
    <main className="campaign-page">
      <CampaignHeader
        warehouseCount={storedCount}
        expeditions={campaign.completedExpeditions}
        onOpenWarehouse={onOpenWarehouse}
        onOpenCompendium={onOpenCompendium}
        onOpenSettings={onOpenSettings}
        onOpenHelp={onOpenHelp}
      />
      <section className="hub-intro">
        <div>
          <p className="eyebrow">다음 원정</p>
          <h2>어디로 향하시겠습니까?</h2>
          <p>
            이번 원정에 제안된 6개 던전입니다. 원정을 마치면 깊이·난이도·주요 전리품이 다른 새 목록으로 교체됩니다.
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
            <strong>{rosterLeader?.name ?? "모험가"} · LV.{rosterLeader?.level ?? 1}</strong>
            <span>동료 {campaign.companions.length}명 대기</span>
          </div>
        </div>
      </section>
      <section className="dungeon-board" aria-label="탐험할 던전 선택">
        {dungeons.map((dungeon, index) => {
          return (
            <article
              className="dungeon-contract"
              key={dungeon.id}
              style={{ "--dungeon-accent": dungeon.accent } as CSSProperties}
            >
              <header>
                <span className="contract-index">0{index + 1}</span>
                <div>
                  <small>{dungeon.subtitleKo}</small>
                  <h3>{dungeon.nameKo}</h3>
                </div>
              </header>
              <p>{dungeon.descriptionKo}</p>
              <dl>
                <div>
                  <dt>난이도</dt>
                  <dd>
                    <span className="difficulty-pips" aria-hidden="true">
                      {[1, 2, 3].map((pip) => (
                        <i key={pip} className={pip <= dungeon.difficulty ? "is-on" : ""} />
                      ))}
                    </span>
                    {dungeon.difficultyLabelKo}
                  </dd>
                </div>
                <div>
                  <dt>던전 깊이</dt>
                  <dd>총 {dungeon.floorCount}층</dd>
                </div>
              </dl>
              <div className="main-drops">
                <header>
                  <small>주요 전리품</small>
                  <em>아이템칸을 눌러 설명 보기</em>
                </header>
                <div className="fixed-item-grid dungeon-drop-grid">
                  {dungeon.mainDropIds.map((itemId) => (
                    <button
                      type="button"
                      className="fixed-item-slot is-filled"
                      key={itemId}
                      title={ITEM_DEFS[itemId]?.name}
                      aria-label={`${ITEM_DEFS[itemId]?.name ?? itemId} 설명 보기`}
                      onClick={(event) =>
                        setItemPreview({
                          itemId,
                          itemRef: `recommended-${dungeon.id}-${itemId}`,
                          instance: null,
                          quantity: 1,
                          contextLabel: `${dungeon.nameKo} 주요 전리품`,
                          anchor: descriptionAnchorFromElement(event.currentTarget),
                        })
                      }
                    >
                      <ItemSlotContents itemId={itemId} size={34} />
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => onSelectDungeon(dungeon)}>
                이 던전 준비하기 <span aria-hidden="true">→</span>
              </button>
            </article>
          );
        })}
      </section>
      <section className="warehouse-strip">
        <div>
          <p className="eyebrow">WAREHOUSE</p>
          <h2>창고 물자</h2>
          <span>던전에서 회수한 아이템은 원정 종료와 함께 이곳에 보관됩니다.</span>
        </div>
        <div className="warehouse-strip__items">
          {Object.entries(campaign.warehouse.stacks)
            .filter(([, quantity]) => quantity > 0)
            .slice(0, 5)
            .map(([itemId, quantity]) => (
              <span key={itemId} title={ITEM_DEFS[itemId]?.name}>
                <ItemRarityMarker itemId={itemId} />
                <ItemIcon itemId={itemId} size={28} />
                <b>×{quantity}</b>
              </span>
            ))}
          {storedCount === 0 && <em>창고가 비어 있습니다.</em>}
        </div>
        <button type="button" onClick={onOpenWarehouse}>전체 창고 열기</button>
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

function WarehouseModal({
  warehouse,
  onClose,
}: {
  warehouse: WarehouseState;
  onClose: () => void;
}) {
  const slotDrag = useActiveItemSlotDrag();
  const stackEntries = Object.entries(warehouse.stacks)
    .filter(([, quantity]) => quantity > 0)
    .sort(([a], [b]) => (ITEM_DEFS[a]?.name ?? a).localeCompare(ITEM_DEFS[b]?.name ?? b));
  const slots = normalizeStorageSlots(warehouse, WAREHOUSE_SLOT_COUNT);
  const instancesById = new Map(
    warehouse.instances.map((instance) => [instance.id, instance]),
  );
  return (
    <div className="modal-backdrop warehouse-backdrop">
      <section className="warehouse-modal" role="dialog" aria-modal="true" aria-labelledby="warehouse-title">
        <header>
          <div>
            <p className="eyebrow">STORAGE</p>
            <h2 id="warehouse-title">원정대 창고</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="창고 닫기">×</button>
        </header>
        <div className="warehouse-summary">
          <span>총 보관 수량 <b>{warehouseItemCount(warehouse)}</b></span>
          <span>종류 <b>{stackEntries.length + warehouse.instances.length}</b></span>
        </div>
        <div className="fixed-item-grid warehouse-fixed-grid">
          {slots.map((itemRef, index) => {
            const address: ItemSlotAddress = { zone: "warehouse", index };
            const inventoryInstance = itemRef
              ? instancesById.get(itemRef) ?? null
              : null;
            const storedInstance = itemRef
              ? inventoryInstance ?? warehouse.throwableProfiles[itemRef] ?? null
              : null;
            const itemId = itemRef
              ? storedInstance?.defId ??
                (warehouse.stacks[itemRef] > 0 ? itemRef : null)
              : null;
            const quantity = itemId
              ? inventoryInstance ? 1 : warehouse.stacks[itemId] ?? 0
              : 0;
            const instance =
              itemId && !inventoryInstance &&
              ITEM_DEFS[itemId]?.category === "missile"
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
            return itemId ? (
              <button
                type="button"
                className={[
                  "fixed-item-slot",
                  "is-filled",
                  slotDrag?.heldAddressKey === itemSlotAddressKey(address)
                    ? "is-drag-source"
                    : "",
                ].filter(Boolean).join(" ")}
                key={`warehouse-slot-${index}`}
                title={`${ITEM_DEFS[itemId]?.name ?? itemId} ×${quantity}`}
                {...(slotDrag?.addressAttributes(address, {
                  itemRef: itemRef!,
                  itemId,
                  quantity,
                  upgradeLevel: instance?.upgradeLevel,
                  charges: instance?.charges,
                  maxCharges: instance?.maxCharges,
                }) ?? {})}
              >
                <ItemSlotContents
                  itemId={itemId}
                  size={40}
                  instance={instance}
                  quantity={quantity}
                  showQuantity={quantity > 1}
                />
              </button>
            ) : (
              <div
                className="fixed-item-slot is-empty"
                key={`warehouse-slot-${index}`}
                {...(slotDrag?.addressAttributes(address, null) ?? {})}
              />
            );
          })}
          {stackEntries.length === 0 && warehouse.instances.length === 0 && (
            <div className="warehouse-empty"><span>□</span><strong>보관된 아이템이 없습니다.</strong><p>원정을 마치고 전리품을 회수하면 이곳에 표시됩니다.</p></div>
          )}
        </div>
        <footer><button type="button" onClick={onClose}>닫기</button></footer>
      </section>
    </div>
  );
}

function PreparationScreen({
  dungeon,
  campaign,
  loadout,
  selectedCompanionIds,
  onCompanionToggle,
  onBack,
  onStart,
}: {
  dungeon: DungeonDefinition;
  campaign: CampaignSave;
  loadout: ExpeditionLoadout;
  selectedCompanionIds: string[];
  onCompanionToggle: (id: string) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const slotDrag = useActiveItemSlotDrag();
  const [itemPreview, setItemPreview] = useState<ItemDetailPreview | null>(null);
  const [companionPreview, setCompanionPreview] = useState<{
    companion: Companion;
    anchor: DescriptionAnchor;
  } | null>(null);
  const occupiedBagSlots = selectedLoadoutSlotCount(loadout);
  const selectedRefs = new Set([
    ...Object.keys(loadout.stacks).filter((itemId) => loadout.stacks[itemId] > 0),
    ...loadout.instanceIds,
  ]);
  const warehouseSlots = normalizeStorageSlots(
    campaign.warehouse,
    WAREHOUSE_SLOT_COUNT,
  );
  const bagSlots = normalizeFixedSlots(
    loadout.slotRefs,
    [...selectedRefs],
    MAX_INVENTORY_SLOTS,
  );
  const instancesById = new Map(
    campaign.warehouse.instances.map((instance) => [instance.id, instance]),
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
  const resolveStoredItem = (itemRef: string) => {
    const inventoryInstance = instancesById.get(itemRef) ?? null;
    const storedInstance =
      inventoryInstance ??
      campaign.warehouse.throwableProfiles[itemRef] ??
      null;
    const itemId = storedInstance?.defId ??
      (campaign.warehouse.stacks[itemRef] > 0 ? itemRef : null);
    if (!itemId) return null;
    const quantity = inventoryInstance
      ? 1
      : campaign.warehouse.stacks[itemId] ?? 0;
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
    return {
      itemRef,
      itemId,
      instance,
      quantity,
    };
  };
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
  const equipmentTargets = PARTY_LOADOUT_TARGETS;
  const equipmentSlotLabel = (target: LoadoutTarget) =>
    target.kind === "equipment"
      ? target.slot === "weapon" ? "무기" : "갑옷"
      : isPartyQuickslotTarget(target)
        ? `퀵슬롯 ${target.index - 1}`
        : `패시브 ${target.index + 1}`;
  const renderEquipmentSlot = (
    address: ItemSlotAddress,
    entry: ReturnType<typeof resolvePlayerLoadoutItem> | ReturnType<typeof resolveCompanionLoadoutItem>,
    key: string,
  ) => {
    const itemId = entry.itemId;
    const itemRef = itemId ? entry.instance?.id ?? itemId : null;
    return (
      <button
        type="button"
        className={[
          "fixed-item-slot",
          "preparation-equipment-slot",
          itemId ? "is-filled" : "is-empty",
          slotDrag?.heldAddressKey === itemSlotAddressKey(address)
            ? "is-drag-source"
            : "",
        ].filter(Boolean).join(" ")}
        key={key}
        title={itemId ? ITEM_DEFS[itemId]?.name : "빈 장비칸"}
        onClick={(event) => {
          if (!itemId || !itemRef) return;
          setItemPreview({
            itemId,
            itemRef,
            instance: entry.instance,
            quantity: entry.quantity,
            contextLabel:
              "동료 장비",
            anchor: descriptionAnchorFromElement(event.currentTarget),
          });
        }}
        {...(slotDrag?.addressAttributes(
          address,
          itemId && itemRef
            ? {
                itemRef,
                itemId,
                quantity: entry.quantity,
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
        ) : <span className="empty-slot-glyph">+</span>}
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
  const renderCompanionCard = (
    companion: Companion,
    placement: "party" | "reserve",
  ) => {
    const definition = COMPANION_CLASSES[companion.classId];
    const selected = selectedCompanionIds.includes(companion.id);
    const disabled = !selected && selectedCompanionIds.length >= 3;
    const isControlled = placement === "party" && selectedCompanionIds[0] === companion.id;
    const portraitFrame = definition.animationSet === "companion"
      ? companionFrameIndex(
          companionArmorTier(companion),
          COMPANION_IDLE_FRAMES[0],
        )
      : PLAYER_IDLE_FRAMES[0];
    return (
      <article
        className={[
          "preparation-owner-card",
          selected ? "is-selected" : "",
          placement === "reserve" ? "is-reserve" : "",
        ].filter(Boolean).join(" ")}
        key={`${placement}-${companion.id}`}
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
            <small>{isControlled ? "조작 캐릭터 · " : ""}{definition.nameKo}</small>
            <strong>{companion.name}</strong>
            <em>LV.{companion.level} · EXP {companion.xp}/{companion.nextXp || "MAX"}</em>
          </div>
          <button
            type="button"
            onClick={() => onCompanionToggle(companion.id)}
            disabled={disabled}
          >
            {selected ? "동행 해제" : "동행 선택"}
          </button>
        </header>
        <div className="preparation-owner-slots">
          {equipmentTargets.map((target) => (
            <label
              className={isPartyQuickslotTarget(target) ? "is-quickslot" : "is-gear"}
              key={
                target.kind === "equipment"
                  ? target.slot
                  : `flex-${target.index}`
              }
            >
              <span>{equipmentSlotLabel(target)}</span>
              {renderEquipmentSlot(
                {
                  zone: "preparationCompanionEquipment",
                  companionId: companion.id,
                  target,
                },
                resolveCompanionLoadoutItem(
                  companion,
                  target,
                  preparationSharedInventory,
                ),
                `prep-${companion.id}-${
                  target.kind === "equipment" ? target.slot : target.index
                }`,
              )}
            </label>
          ))}
        </div>
      </article>
    );
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
        <dl><div><dt>난이도</dt><dd>{dungeon.difficultyLabelKo}</dd></div><div><dt>깊이</dt><dd>{dungeon.floorCount}층</dd></div></dl>
      </section>
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
            <div className="fixed-item-grid preparation-storage-grid">
              {warehouseSlots.map((itemRef, index) =>
                renderStoredSlot(
                  { zone: "warehouse", index },
                  itemRef && !selectedRefs.has(itemRef) ? itemRef : null,
                  `prep-warehouse-${index}`,
                ),
              )}
            </div>
          </section>
        </div>

        <section className="preparation-equipment-panel preparation-party-panel">
          <header>
            <div><small>03</small><h2>동행 원정대 장비</h2></div>
            <span>{selectedCompanions.length}/3명 · 첫 번째 인원이 조작 캐릭터</span>
          </header>
          <div className="preparation-equipment-roster is-active-party">
            {selectedCompanions.map((companion) =>
              renderCompanionCard(companion, "party"),
            )}
            {selectedCompanions.length === 0 && (
              <div className="preparation-party-empty">
                아래 대기 목록에서 조작할 첫 동료를 선택해 주세요.
              </div>
            )}
          </div>
        </section>

        <section className="preparation-reserve-panel">
          <header>
            <div><small>04</small><h2>동행하지 않는 동료</h2></div>
            <span>{reserveCompanions.length}명 대기</span>
          </header>
          <div className="preparation-equipment-roster is-reserve-roster">
            {reserveCompanions.map((companion) =>
              renderCompanionCard(companion, "reserve"),
            )}
            {reserveCompanions.length === 0 && (
              <div className="preparation-reserve-empty">
                모든 동료가 이번 원정에 동행합니다.
              </div>
            )}
          </div>
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
      {companionPreview && (
        <CompanionInspector
          companion={companionPreview.companion}
          anchor={companionPreview.anchor}
          onClose={() => setCompanionPreview(null)}
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
        </div>
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
        <div className="results-loot-note"><span aria-hidden="true">▣</span><p><strong>전리품 정리 완료</strong>가방에 남아 있던 아이템은 모두 메인 화면의 창고로 이동했습니다.</p></div>
        <button type="button" onClick={onReturn}>거점으로 돌아가기</button>
      </section>
    </main>
  );
}

type DungeonRunProps = {
  initialGame: GameState;
  dungeon: DungeonDefinition;
  uiScale: number;
  fontScale: number;
  language: UiLanguage;
  developerMode: boolean;
  onScaleChange: (scale: number) => void;
  onFontScaleChange: (scale: number) => void;
  onLanguageChange: (language: UiLanguage) => void;
  onDeveloperModeChange: (enabled: boolean) => void;
  onFinish: (
    outcome: ExpeditionOutcome,
    game: GameState,
    stats: ExpeditionStats,
  ) => void;
};

function DungeonRun({
  initialGame,
  dungeon,
  uiScale,
  fontScale,
  language,
  developerMode,
  onScaleChange,
  onFontScaleChange,
  onLanguageChange,
  onDeveloperModeChange,
  onFinish,
}: DungeonRunProps) {
  const [game, setGame] = useState<GameState>(() => initialGame);
  const [busy, setBusy] = useState(false);
  const [autoExploring, setAutoExploring] = useState(false);
  const [stopAutoExploreOnFullBag] = useState(true);
  const [autoDescendAfterExplore] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] =
    useState<InventorySelection | null>(null);
  const [pendingUpgradeScrollRef, setPendingUpgradeScrollRef] =
    useState<string | null>(null);
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
  const [soundEnabled, setSoundEnabled] = useState(true);
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
  const [upgradeFlashKey, setUpgradeFlashKey] = useState<string | null>(null);
  const [alchemyOpen, setAlchemyOpen] = useState(false);
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
  const playerMoveCycleStartedAtRef = useRef<number | null>(null);
  const playerMoveCycleEndsAtRef = useRef(0);
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
  const suggestedAimTargetRef = useRef<Point | null>(null);
  const inspectModeRef = useRef(false);
  const soundsRef = useRef<Record<SoundName, HTMLAudioElement> | null>(null);
  const magicAudioContextRef = useRef<AudioContext | null>(null);
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
  const upgradeFlashTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (upgradeFlashTimerRef.current !== null) {
        window.clearTimeout(upgradeFlashTimerRef.current);
      }
    },
    [],
  );

  const flashUpgradeTarget = useCallback((target: UpgradeTarget) => {
    if (upgradeFlashTimerRef.current !== null) {
      window.clearTimeout(upgradeFlashTimerRef.current);
    }
    setUpgradeFlashKey(upgradeTargetVisualKey(target));
    upgradeFlashTimerRef.current = window.setTimeout(() => {
      setUpgradeFlashKey(null);
      upgradeFlashTimerRef.current = null;
    }, 920);
  }, []);

  const commitGame = useCallback((next: GameState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

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
      runStatsRef.current.itemsFound += pickups.length;
      pickups.forEach((pickup) => {
        if (ITEM_DEFS[pickup.defId]?.category === "key") return;
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
    suggestedAimTargetRef.current =
      pendingQuickslotAim?.suggestedTarget ??
      pendingCompanionSkill?.suggestedTarget ??
      null;
  }, [pendingCompanionSkill, pendingQuickslotAim]);

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
    soundsRef.current = (
      Object.entries(SOUND_PATHS) as Array<[SoundName, string]>
    ).reduce(
      (sounds, [name, path]) => {
        const audio = new Audio(path);
        audio.preload = "auto";
        audio.load();
        sounds[name] = audio;
        return sounds;
      },
      {} as Record<SoundName, HTMLAudioElement>,
    );
    return () => {
      soundsRef.current = null;
    };
  }, []);

  const playSound = useCallback(
    (
      name: SoundName,
      volume = 0.62,
      delay = 0,
      playbackRate = 1,
    ) => {
      if (!soundEnabledRef.current) return;
      const play = () => {
        const source = soundsRef.current?.[name];
        if (!source || !soundEnabledRef.current) return;
        const audio = source.cloneNode(true) as HTMLAudioElement;
        audio.volume = volume;
        audio.playbackRate = playbackRate;
        void audio.play().catch(() => {
          // Browsers can block sound until the first key, click, or touch input.
        });
      };
      if (delay > 0) window.setTimeout(play, delay);
      else play();
    },
    [],
  );

  const playWandSound = useCallback((wandId: string) => {
    if (!soundEnabledRef.current) return;
    const profiles: Record<
      string,
      { start: number; end: number; wave: OscillatorType; duration: number; layer?: number }
    > = {
      wand_magic_missile: { start: 720, end: 1080, wave: "sine", duration: 0.24 },
      wand_frost: { start: 980, end: 360, wave: "sine", duration: 0.48, layer: 1440 },
      wand_fireblast: { start: 170, end: 68, wave: "sawtooth", duration: 0.52, layer: 260 },
      wand_lightning: { start: 1420, end: 180, wave: "square", duration: 0.25, layer: 2100 },
      wand_disintegration: { start: 520, end: 96, wave: "sawtooth", duration: 0.58 },
      wand_prismatic_light: { start: 880, end: 1760, wave: "sine", duration: 0.46, layer: 1320 },
      wand_corrosion: { start: 240, end: 92, wave: "triangle", duration: 0.6, layer: 135 },
      wand_blast_wave: { start: 110, end: 52, wave: "square", duration: 0.34 },
      wand_corruption: { start: 330, end: 82, wave: "sawtooth", duration: 0.7, layer: 247 },
      wand_living_earth: { start: 120, end: 72, wave: "triangle", duration: 0.48, layer: 180 },
      wand_regrowth: { start: 420, end: 760, wave: "sine", duration: 0.58, layer: 630 },
      wand_transfusion: { start: 610, end: 240, wave: "sine", duration: 0.5, layer: 915 },
      wand_warding: { start: 540, end: 940, wave: "triangle", duration: 0.42, layer: 1080 },
    };
    const profile =
      profiles[wandId] ??
      { start: 560, end: 860, wave: "sine" as OscillatorType, duration: 0.35 };
    try {
      const AudioContextConstructor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextConstructor) return;
      const audioContext =
        magicAudioContextRef.current ?? new AudioContextConstructor();
      magicAudioContextRef.current = audioContext;
      const now = audioContext.currentTime;
      const playTone = (
        frequency: number,
        endFrequency: number,
        volume: number,
        offset = 0,
      ) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = profile.wave;
        oscillator.frequency.setValueAtTime(frequency, now + offset);
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(24, endFrequency),
          now + offset + profile.duration,
        );
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(volume, now + offset + 0.025);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + offset + profile.duration,
        );
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + profile.duration + 0.02);
      };
      playTone(profile.start, profile.end, 0.1);
      if (profile.layer) {
        playTone(profile.layer, Math.max(30, profile.end * 1.35), 0.045, 0.035);
      }
    } catch {
      // Audio can be unavailable until the browser receives a direct gesture.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setAssetsReady(false);
      setAssetLoadError(null);
      try {
        const enemyKinds = Object.keys(ENEMY_SPRITES) as EnemyKind[];
        const sources = [
          "/assets/environment/tiles_sewers.png",
          "/assets/environment/water0.png",
          "/assets/sprites/items.png",
          "/assets/sprites/player.png",
          ...enemyKinds.map((kind) => ENEMY_SPRITES[kind].file),
          ...COMPANION_CLASS_IDS.map(
            (classId) => COMPANION_CLASSES[classId].sprite,
          ),
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
        const items = imagesBySource.get("/assets/sprites/items.png");
        const player = imagesBySource.get("/assets/sprites/player.png");
        if (!tiles || !water || !items || !player) {
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
        const companions = COMPANION_CLASS_IDS.reduce(
          (record, classId) => {
            const image = imagesBySource.get(
              COMPANION_CLASSES[classId].sprite,
            );
            if (!image) throw new Error(`Missing companion image: ${classId}`);
            record[classId] = image;
            return record;
          },
          {} as Record<CompanionClassId, HTMLImageElement>,
        );
        assetsRef.current = {
          tiles,
          water,
          items,
          player,
          enemies,
          companions,
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
        let motionStartedAt = now + delay;
        if (motion.id === PLAYER_ID) {
          if (motion.kind === "move") {
            const previousMoveEnd = playerMoveCycleEndsAtRef.current;
            const continuesPreviousMove =
              delay === 0 &&
              playerMoveCycleStartedAtRef.current !== null &&
              previousMoveEnd > 0 &&
              now <= previousMoveEnd + PLAYER_MOVE_CONTINUITY_GRACE;
            if (continuesPreviousMove) {
              // Anchor the next segment to the prior segment's exact end. A
              // slightly late timer therefore advances the interpolation
              // instead of inserting an idle frame between adjacent tiles.
              motionStartedAt = previousMoveEnd;
            }
            if (
              playerMoveCycleStartedAtRef.current === null ||
              now >
                playerMoveCycleEndsAtRef.current +
                  PLAYER_MOVE_CONTINUITY_GRACE
            ) {
              playerMoveCycleStartedAtRef.current = motionStartedAt;
            }
            playerMoveCycleEndsAtRef.current =
              motionStartedAt + motionDuration;
          } else {
            playerMoveCycleStartedAtRef.current = null;
            playerMoveCycleEndsAtRef.current = 0;
          }
        }
        motionRef.current.set(motion.id, {
          ...motion,
          startedAt: motionStartedAt,
          duration: motionDuration,
        });
        const movingPlayer =
          motion.id === PLAYER_ID && motion.kind === "move";
        const movingCompanion =
          motion.kind === "move" &&
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
          ...trajectories[index],
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
        duration: visual.kind === "cloud" ? 720 : 430,
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
          ? result.interactionDuration ?? PLAYER_INTERACTION_DURATION
          : 0;
      const throwEnd = throws.length
        ? Math.max(...throws.map(throwVisualDuration))
        : 0;
      const actionLeadEnd = Math.max(interactionEnd, throwEnd);
      const deferResolution =
        Boolean(result.presentationState) &&
        (playerAttacked || result.interacted || throws.length > 0);
      commitGame(
        withoutPendingAugmentModal(
          deferResolution
            ? result.presentationState ?? result.state
            : result.state,
        ),
      );
      if (result.alchemyOpened) setAlchemyOpen(true);
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
              (effect.sourceId === itemThrow.sourceId ||
                effect.sourceId === itemThrow.id) &&
              effect.x === itemThrow.to.x &&
              effect.y === itemThrow.to.y &&
              /^-\d+/.test(effect.text),
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
          const hardImpact = result.effects.length > 0;
          playSound(
            hardImpact ? "hit" : "step",
            hardImpact ? 0.62 : 0.28,
            Math.max(...throws.map(throwImpactDelay)),
          );
        }
      }
      if (magicVisuals.length) {
        addMagicVisuals(magicVisuals);
        if (result.wandSoundId) playWandSound(result.wandSoundId);
        else playSound("hit", 0.48, 120);
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
      if (result.reachedExit && !result.state.gameOver) {
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
            ? playerAttack.delay + playerAttack.duration * 0.52
            : 0,
        );
        if (playerAttack) {
          const hitEffect = result.effects.find(
            (effect) =>
              effect.sourceId === playerAttack.motion.id &&
              /^-\d+/.test(effect.text),
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
                playerAttack.delay + playerAttack.duration * 0.52,
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
        const floorAdvance = advanceExpeditionFloor(gameRef.current);
        if (floorAdvance.kind === "completed") {
          commitGame(result.state);
          finishCurrentExpedition("completed");
          return;
        }
        const nextFloor = floorAdvance.state;
        motionRef.current.clear();
        playerMoveCycleStartedAtRef.current = null;
        playerMoveCycleEndsAtRef.current = 0;
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

      const enemyTurns: ActionResult[] = [];
      const enemyTurnStarts: GameState[] = [];
      let resolvedState = result.state;
      for (
        let index = 0;
        index < elapsedTurns && !resolvedState.gameOver;
        index += 1
      ) {
        enemyTurnStarts.push(resolvedState);
        const enemyTurn = runEnemyTurn(resolvedState, {
          playerInvincible: developerModeRef.current,
          manualParty: manualPartyModeRef.current,
        });
        enemyTurns.push(enemyTurn);
        resolvedState = enemyTurn.state;
      }
      recordRunProgress(visualStateBefore, resolvedState, pickups);
      if (enemyTurns.length && !deferResolution) {
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
      turnThrows.forEach((itemThrow) => {
        const attack = itemThrow.sourceId
          ? attackSchedule.get(itemThrow.sourceId)
          : undefined;
        const delay = attack
          ? attack.delay + attack.duration * 0.18
          : actionLeadEnd;
        addThrowVisuals([itemThrow], delay);
        const hitEffect = allEffects.find(
          (effect) =>
            effect.sourceId === itemThrow.sourceId &&
            effect.x === itemThrow.to.x &&
            effect.y === itemThrow.to.y &&
            /^-\d+/.test(effect.text),
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
                effect.text === "처치!" &&
                effect.x === enemy.x &&
                effect.y === enemy.y,
            );
          const attack = killEffect?.sourceId
            ? attackSchedule.get(killEffect.sourceId)
            : undefined;
          const removalDelay = attack
            ? attack.delay + attack.duration * 0.52
            : actionLeadEnd;
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
      enemyTurns.forEach((enemyTurn, index) => {
        const before = enemyTurnStarts[index];
        before.companions
          .filter((companion) => {
            const resolved = enemyTurn.state.companions.find(
              (candidate) => candidate.id === companion.id,
            );
            return companion.hp > 0 && Boolean(resolved && resolved.hp <= 0);
          })
          .forEach((companion) => {
            const defeatEffect = [...enemyTurn.effects]
              .reverse()
              .find(
                (effect) =>
                  effect.text === "전투 불능!" &&
                  effect.x === companion.x &&
                  effect.y === companion.y,
              );
            const attack = defeatEffect?.sourceId
              ? attackSchedule.get(defeatEffect.sourceId)
              : undefined;
            const revealDelay = attack
              ? attack.delay + attack.duration * 0.52
              : actionLeadEnd;
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
              revealAt: defeatVisualStartedAt + Math.max(0, revealDelay),
            });
            deathSoundDelays.add(Math.max(0, Math.round(revealDelay)));
          });
      });
      deathSoundDelays.forEach((delay) => {
        playSound("death", 0.7, delay);
      });
      turnMagicVisuals.forEach((visual, index) => {
        const attack = visual.sourceId
          ? attackSchedule.get(visual.sourceId)
          : undefined;
        const delay = attack
          ? attack.delay + attack.duration * 0.2
          : actionLeadEnd;
        addMagicVisuals([visual], delay);
        const wandId = turnWandSoundIds[index];
        if (wandId) {
          window.setTimeout(() => playWandSound(wandId), delay);
        }
      });
      const effectGroups = new Map<number, CombatEffect[]>();
      allEffects.forEach((effect) => {
        const initialThrow = throws.find(
          (itemThrow) =>
            itemThrow.sourceId === effect.sourceId &&
            itemThrow.to.x === effect.x &&
            itemThrow.to.y === effect.y,
        );
        const attack = effect.sourceId
          ? attackSchedule.get(effect.sourceId)
          : undefined;
        const delay = initialThrow
          ? throwImpactDelay(initialThrow)
          : attack
            ? attack.delay + attack.duration * 0.52
            : actionLeadEnd;
        effectGroups.set(delay, [
          ...(effectGroups.get(delay) ?? []),
          effect,
        ]);
      });
      effectGroups.forEach((effects, delay) => {
        addVisuals([], effects, undefined, delay);
      });
      timeline.motions
        .filter(({ motion }) => motion.kind === "attack")
        .forEach(({ motion, delay, duration }) => {
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
              (/^-\d+/.test(effect.text) || effect.text === "무효"),
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
            delay: delay + duration * 0.52,
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
        ? playerAttackSchedule.delay + playerAttackSchedule.duration * 0.52
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
      const resolutionDelay = playerAttackSchedule
        ? Math.max(playerImpactDelay, throwEnd, interactionEnd)
        : throwEnd || interactionEnd;
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
          didLevelUp
            ? resolutionDelay + LEVEL_UP_EFFECT_HOLD
            : 0,
        );
        if (deferResolution) {
          await wait(resolutionDelay);
          if (actionTokenRef.current !== token) return;
          commitGame(withoutPendingAugmentModal(resolvedState));
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
      const living = livingPartyIds(gameRef.current);
      const allReady = living.every((id) => acted.has(id));
      if (!allReady) {
        manualActedIdsRef.current = acted;
        setManualActedIds(new Set(acted));
        const nextActor = living.find((id) => !acted.has(id));
        if (nextActor) selectControlledActor(nextActor);
        return;
      }

      manualActedIdsRef.current = new Set();
      setManualActedIds(new Set());
      await resolveAction(
        advanceManualPartyRound(gameRef.current),
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
      setPendingUpgradeScrollRef(null);
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
      setPendingUpgradeScrollRef(null);
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
      if (itemId === "scroll_upgrade") {
        setThrowingItemId(null);
        setCastingItemId(null);
        setPendingUpgradeScrollRef(itemRef);
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

  const applyUpgradeScroll = useCallback(
    (target: UpgradeTarget) => {
      const scrollItemRef = pendingUpgradeScrollRef;
      if (!scrollItemRef) return;
      void performDuringAutoExplore(() =>
        runExclusive(async (token) => {
          const result = upgradeItemWithScroll(
            gameRef.current,
            scrollItemRef,
            target,
          );
          if (result.consumedTurn) {
            flashUpgradeTarget(target);
            setPendingUpgradeScrollRef(null);
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
      pendingUpgradeScrollRef,
      performDuringAutoExplore,
      resolvePartyAction,
      runExclusive,
      flashUpgradeTarget,
    ],
  );

  const upgradePlayerLoadout = useCallback(
    (selection: PlayerLoadoutSelection) => {
      const target: UpgradeTarget = selection.kind === "equipment"
        ? { kind: "equipment", slot: selection.slot }
        : gameRef.current.player.equipment[FLEX_RING_KEYS[selection.index]]
          ? { kind: "equipment", slot: "ring", ringIndex: selection.index }
          : { kind: "playerAuto", index: selection.index };
      applyUpgradeScroll(target);
    },
    [applyUpgradeScroll],
  );

  const upgradeCompanionLoadout = useCallback(
    (selection: CompanionLoadoutSelection) => {
      setActiveLoadoutOwnerId(selection.companionId);
      applyUpgradeScroll(
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
    [applyUpgradeScroll],
  );

  const beginLoadoutAssignment = useCallback((itemRef: string) => {
    setSelectedInventoryItem(null);
    setPendingUpgradeScrollRef(null);
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
        const slots = normalizePlayerInventorySlots(state.player);
        if (slots[source.index] !== held.item.itemRef) return;
        const next: GameState = {
          ...state,
          player: {
            ...state.player,
            inventorySlots: swapFixedSlots(slots, source.index, target.index),
          },
        };
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
            const result = target.zone === "playerEquipment"
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
                result.state.player.inventorySlots = swapFixedSlots(
                  afterSlots,
                  afterSlots.indexOf(returnedRef),
                  source.index,
                );
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
            const result = targetRef
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
                result.state.player.inventorySlots = swapFixedSlots(
                  afterSlots,
                  afterSlots.indexOf(returnedRef),
                  target.index,
                );
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
      const equipmentKey = (address: typeof source | typeof target) =>
        address.target.kind === "equipment"
          ? address.target.slot
          : FLEX_RING_KEYS[address.target.index];
      const readGear = (address: typeof source | typeof target) => {
        const key = equipmentKey(address);
        const owner = address.zone === "playerEquipment"
          ? state.player
          : state.companions.find(
              (companion) => companion.id === address.companionId,
            );
        if (!owner) return null;
        const defId = owner.equipment[key];
        if (!defId) return null;
        return {
          key,
          defId,
          instance: owner.equipmentInstances[key] ?? null,
        };
      };
      const sourceGear = readGear(source);
      const targetGear = readGear(target);
      if (!sourceGear) return;
      if (sourceGear.instance?.cursed || targetGear?.instance?.cursed) {
        commitGame({
          ...state,
          logs: [
            ...state.logs,
            "저주받은 장비는 위치를 바꾸거나 해제할 수 없습니다.",
          ].slice(-80),
        });
        return;
      }
      const accepts = (defId: string, address: typeof source | typeof target) =>
        address.target.kind === "equipment"
          ? ITEM_DEFS[defId]?.slot === address.target.slot
          : !isPartyQuickslotTarget(address.target) &&
            ["ring", "artifact"].includes(
              ITEM_DEFS[defId]?.category ?? "",
            );
      if (
        !accepts(sourceGear.defId, target) ||
        (targetGear && !accepts(targetGear.defId, source))
      ) {
        return;
      }

      const next: GameState = {
        ...state,
        player: {
          ...state.player,
          equipment: { ...state.player.equipment },
          equipmentInstances: { ...state.player.equipmentInstances },
        },
        companions: state.companions.map((companion) => ({
          ...companion,
          equipment: { ...companion.equipment },
          equipmentInstances: { ...companion.equipmentInstances },
        })),
      };
      const writeGear = (
        address: typeof source | typeof target,
        gear: ReturnType<typeof readGear>,
      ) => {
        const key = equipmentKey(address);
        const owner = address.zone === "playerEquipment"
          ? next.player
          : next.companions.find(
              (companion) => companion.id === address.companionId,
            );
        if (!owner) return;
        owner.equipment[key] = gear?.defId ?? null;
        owner.equipmentInstances[key] = gear?.instance ?? null;
      };
      writeGear(source, targetGear);
      writeGear(target, sourceGear);
      next.logs = [
        ...next.logs,
        "드래그로 장비 위치를 교체했습니다.",
      ].slice(-80);
      commitGame(next);
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
    setPendingUpgradeScrollRef(null);
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
        setPendingUpgradeScrollRef(null);
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
          setPendingUpgradeScrollRef(null);
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
        pendingUpgradeScrollRef ||
        pendingLoadoutItemRef ||
        helpOpen ||
        settingsOpen ||
        compendiumOpen ||
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
    pendingUpgradeScrollRef,
    selectedInventoryItem,
    settingsOpen,
    throwingItemId,
    pendingCompanionSkill,
    pendingQuickslotAim,
    waitOneTurn,
  ]);

  const canvasLocalPoint = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const bounds = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - bounds.left) / bounds.width) * VIEW_WIDTH,
        y: ((event.clientY - bounds.top) / bounds.height) * VIEW_HEIGHT,
      };
    },
    [],
  );

  const canvasPoint = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const local = canvasLocalPoint(event);
      if (!local) return null;
      const zoom = zoomRef.current;
      return {
        x: Math.floor(
          (cameraRef.current.x + local.x / zoom) / TILE_SIZE,
        ),
        y: Math.floor(
          (cameraRef.current.y + local.y / zoom) / TILE_SIZE,
        ),
      };
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
      const definition = COMPANION_CLASSES[companion.classId];
      const width =
        definition.frameWidth * ENTITY_SPRITE_SCALE * zoom;
      const height =
        definition.frameHeight * ENTITY_SPRITE_SCALE * zoom;
      const centerX =
        (companion.x * TILE_SIZE + TILE_SIZE / 2 - camera.x) * zoom;
      const bottom =
        (companion.y * TILE_SIZE + TILE_SIZE - 3 - camera.y) * zoom;
      if (
        local.x >= centerX - width / 2 &&
        local.x <= centerX + width / 2 &&
        local.y >= bottom - height &&
        local.y <= bottom
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
        point.x < 0 ||
        point.y < 0 ||
        point.x >= gameRef.current.width ||
        point.y >= gameRef.current.height ||
        (!developerModeRef.current &&
          !gameRef.current.tiles[point.y][point.x].discovered)
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
        target.x < 0 ||
        target.y < 0 ||
        target.x >= state.width ||
        target.y >= state.height ||
        (!developerModeRef.current &&
          !state.tiles[target.y][target.x].discovered) ||
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
              if (result.alchemyOpened) await resolveAction(result, token);
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
      if (
        !point ||
        point.x < 0 ||
        point.y < 0 ||
        point.x >= gameRef.current.width ||
        point.y >= gameRef.current.height ||
        (!developerModeRef.current &&
          !gameRef.current.tiles[point.y][point.x].discovered)
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !assetsReady) return;
    const context = canvas.getContext("2d");
    const assets = assetsRef.current;
    if (!context || !assets) return;

    let frame = 0;
    let lastDrawAt = Number.NEGATIVE_INFINITY;
    const vignette = context.createRadialGradient(
      VIEW_WIDTH / 2,
      VIEW_HEIGHT / 2,
      VIEW_HEIGHT * 0.2,
      VIEW_WIDTH / 2,
      VIEW_HEIGHT / 2,
      VIEW_WIDTH * 0.62,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,.46)");
    const interpolate = (
      id: string,
      fallback: Point,
      now: number,
    ): { point: Point; motion: VisualMotion | null; progress: number } => {
      const motion = motionRef.current.get(id);
      if (!motion) return { point: fallback, motion: null, progress: 1 };
      if (now < motion.startedAt) {
        return { point: motion.from, motion: null, progress: 0 };
      }
      const progress = Math.max(
        0,
        Math.min(1, (now - motion.startedAt) / motion.duration),
      );
      if (progress >= 1) {
        const settledPoint =
          motion.kind === "move" ? motion.to : motion.from;
        if (pointEquals(fallback, settledPoint)) {
          motionRef.current.delete(id);
        }
        return { point: settledPoint, motion: null, progress: 1 };
      }
      if (motion.kind === "attack") {
        const amount = Math.sin(progress * Math.PI) * 0.36;
        return {
          point: {
            x: motion.from.x + (motion.to.x - motion.from.x) * amount,
            y: motion.from.y + (motion.to.y - motion.from.y) * amount,
          },
          motion,
          progress,
        };
      }
      const eased = progress;
      return {
        point: {
          x: motion.from.x + (motion.to.x - motion.from.x) * eased,
          y: motion.from.y + (motion.to.y - motion.from.y) * eased,
        },
        motion,
        progress,
      };
    };

    const render = (now: number) => {
      defeatedEnemyVisualRef.current =
        defeatedEnemyVisualRef.current.filter(
          (visual) => visual.removeAt > now,
        );
      defeatedCompanionVisualRef.current =
        defeatedCompanionVisualRef.current.filter(
          (visual) => visual.revealAt > now,
        );
      const highMotion =
        companionMapDragRef.current?.moved === true ||
        motionRef.current.size > 0 ||
        defeatedEnemyVisualRef.current.length > 0 ||
        defeatedCompanionVisualRef.current.length > 0 ||
        playerActionRef.current !== null ||
        effectsRef.current.length > 0 ||
        pickupRef.current.length > 0 ||
        throwRef.current.length > 0 ||
        magicRef.current.length > 0 ||
        pixelEffectsRef.current.length > 0 ||
        cameraShakesRef.current.length > 0 ||
        entityFlashRef.current.length > 0 ||
        pixelFogRuntimeRef.current.transitions.size > 0;
      const minimumFrameInterval = highMotion ? 1000 / 60 : 1000 / 30;
      if (now - lastDrawAt < minimumFrameInterval - 1) {
        frame = requestAnimationFrame(render);
        return;
      }
      lastDrawAt = now;

      const state = gameRef.current;
      const renderCache = syncDungeonRenderCache(
        renderCacheRef.current!,
        state,
      );
      const revealAll = developerModeRef.current;
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      context.fillStyle = "#020405";
      context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

      const playerVisual = interpolate(PLAYER_ID, state.player, now);
      const followedActorId = manualPartyModeRef.current
        ? controlledActorIdRef.current
        : PLAYER_ID;
      const followedActor = partyActor(state, followedActorId);
      const followedVisual = followedActorId === PLAYER_ID
        ? playerVisual
        : interpolate(followedActorId, followedActor, now);
      const zoom = zoomRef.current;
      if (cameraFollowRef.current) {
        cameraRef.current = clampCamera(
          {
            x:
              followedVisual.point.x * TILE_SIZE +
              TILE_SIZE / 2 -
              VIEW_WIDTH / zoom / 2,
            y:
              followedVisual.point.y * TILE_SIZE +
              TILE_SIZE / 2 -
              VIEW_HEIGHT / zoom / 2,
          },
          zoom,
          state,
        );
      } else {
        cameraRef.current = clampCamera(cameraRef.current, zoom, state);
      }
      cameraShakesRef.current = pruneCameraShakes(
        cameraShakesRef.current,
        now,
      );
      const shake = cameraShakeOffset(cameraShakesRef.current, now);
      const cameraX = cameraRef.current.x;
      const cameraY = cameraRef.current.y;
      const tileScreenSize = TILE_SIZE * zoom;
      const spritePixelSize = ENTITY_SPRITE_SCALE * zoom;
      const screenX = (worldX: number) =>
        (worldX - cameraX) * zoom + shake.x;
      const screenY = (worldY: number) =>
        (worldY - cameraY) * zoom + shake.y;
      const pixelViewport = {
        screenX,
        screenY,
        zoom,
        width: VIEW_WIDTH,
        height: VIEW_HEIGHT,
      };
      pixelEffectsRef.current = prunePixelEffects(
        pixelEffectsRef.current,
        now,
      );
      entityFlashRef.current = entityFlashRef.current.filter(
        (flash) => now < flash.startedAt + flash.duration,
      );
      const entityFlashAlphas = new Map<string, number>();
      for (const flash of entityFlashRef.current) {
        if (now < flash.startedAt) continue;
        const progress = (now - flash.startedAt) / flash.duration;
        entityFlashAlphas.set(
          flash.id,
          Math.max(0, Math.sin(progress * Math.PI)),
        );
      }
      const entityFlashAlpha = (id: string) =>
        entityFlashAlphas.get(id) ?? 0;
      const drawSpeechBubble = (
        centerX: number,
        bottomY: number,
        text: string,
        color: string,
        alpha = 1,
      ) => {
        const bubbleWidth = (text.length > 1 ? 26 : 20) * zoom;
        const bubbleHeight = 17 * zoom;
        const left = Math.round(centerX - bubbleWidth / 2);
        const top = Math.round(bottomY - bubbleHeight);
        context.save();
        context.globalAlpha = alpha;
        context.fillStyle = "rgba(12, 16, 14, .94)";
        context.strokeStyle = color;
        context.lineWidth = Math.max(1, zoom);
        context.fillRect(left, top, bubbleWidth, bubbleHeight);
        context.strokeRect(left, top, bubbleWidth, bubbleHeight);
        context.beginPath();
        context.moveTo(centerX - 3 * zoom, bottomY);
        context.lineTo(centerX + 3 * zoom, bottomY);
        context.lineTo(centerX, bottomY + 5 * zoom);
        context.closePath();
        context.fill();
        context.stroke();
        context.fillStyle = color;
        context.font = `${Math.round(9 * zoom)}px MonaGame, monospace`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(text, centerX, top + bubbleHeight * 0.54);
        context.restore();
      };
      const drawEntityShadow = (
        centerX: number,
        bottomY: number,
        width: number,
        alpha = 0.34,
      ) => {
        context.save();
        context.globalAlpha = alpha;
        context.fillStyle = "#000";
        context.beginPath();
        context.ellipse(
          Math.round(centerX),
          Math.round(bottomY - 2 * zoom),
          Math.max(7 * zoom, width * 0.32),
          Math.max(2.5 * zoom, width * 0.1),
          0,
          0,
          Math.PI * 2,
        );
        context.fill();
        context.restore();
      };

      const startX = Math.max(0, Math.floor(cameraX / TILE_SIZE) - 2);
      const endX = Math.min(
        state.width - 1,
        Math.ceil((cameraX + VIEW_WIDTH / zoom) / TILE_SIZE) + 2,
      );
      const startY = Math.max(0, Math.floor(cameraY / TILE_SIZE) - 2);
      const endY = Math.min(
        state.height - 1,
        Math.ceil((cameraY + VIEW_HEIGHT / zoom) / TILE_SIZE) + 2,
      );
      const inViewport = (x: number, y: number, padding = 2) =>
        x >= startX - padding &&
        x <= endX + padding &&
        y >= startY - padding &&
        y <= endY + padding;

      for (let y = startY; y <= endY; y += 1) {
        for (let x = startX; x <= endX; x += 1) {
          const tile = state.tiles[y][x];
          const underlay = terrainUnderlayForPixelFog(tile);
          if (!underlay.draw) continue;
          const visual = terrainFrameAt(renderCache, x, y);
          if (visual === null) continue;
          context.globalAlpha = underlay.alpha;
          if (tile.terrain === "water") {
            const waterX = screenX(x * TILE_SIZE);
            const waterY = screenY(y * TILE_SIZE);
            for (const slice of waterTextureSlices(x, y, now)) {
              context.drawImage(
                assets.water,
                slice.sourceX,
                slice.sourceY,
                16,
                slice.sourceHeight,
                waterX,
                waterY +
                  (slice.destinationY / 16) * tileScreenSize,
                tileScreenSize,
                (slice.sourceHeight / 16) * tileScreenSize,
              );
            }
          }
          drawSheetFrame(
            context,
            assets.tiles,
            visual,
            16,
            16,
            screenX(x * TILE_SIZE),
            screenY(y * TILE_SIZE),
            tileScreenSize,
            tileScreenSize,
          );
        }
      }
      context.globalAlpha = 1;
      drawPixelEffects(
        context,
        pixelEffectsRef.current,
        now,
        pixelViewport,
        "ground",
      );

      const activePath = pathRef.current;
      activePath.forEach((point, index) => {
        if (!inViewport(point.x, point.y)) return;
        if (
          !revealAll &&
          !state.tiles[point.y]?.[point.x]?.discovered
        ) return;
        const centerX = screenX(point.x * TILE_SIZE + TILE_SIZE / 2);
        const centerY = screenY(point.y * TILE_SIZE + TILE_SIZE / 2);
        context.fillStyle =
          index === activePath.length - 1
            ? "rgba(255, 215, 112, .78)"
            : "rgba(255, 215, 112, .38)";
        context.beginPath();
        context.arc(
          centerX,
          centerY,
          (index === activePath.length - 1 ? 5 : 3) * zoom,
          0,
          Math.PI * 2,
        );
        context.fill();
      });

      state.groundItems.forEach((item) => {
        if (!inViewport(item.x, item.y)) return;
        if (!revealAll && !state.tiles[item.y][item.x].visible) return;
        const definition = ITEM_DEFS[item.defId];
        const offset = itemSpriteOffset(item.defId);
        const bob = Math.sin(now / 270 + item.x) * zoom;
        drawSheetFrame(
          context,
          assets.items,
          definition.sprite,
          16,
          16,
          screenX(item.x * TILE_SIZE + offset.x * 3),
          screenY(item.y * TILE_SIZE + offset.y * 3) + bob,
          tileScreenSize,
          tileScreenSize,
        );
      });

      throwRef.current = throwRef.current.filter((itemThrow) => {
        const progress = Math.max(
          0,
          Math.min(
            1,
            (now - itemThrow.startedAt) / itemThrow.duration,
          ),
        );
        if (progress >= 1) return false;
        const travelProgress = progress;
        const arcProgress = progress;
        const offset = itemSpriteOffset(itemThrow.defId);
        const worldX =
          itemThrow.from.x +
          (itemThrow.to.x - itemThrow.from.x) * travelProgress;
        const worldY =
          itemThrow.from.y +
          (itemThrow.to.y - itemThrow.from.y) * travelProgress;
        const arc = Math.sin(arcProgress * Math.PI) * TILE_SIZE * 0.55;
        const centerX = screenX(worldX * TILE_SIZE + TILE_SIZE / 2);
        const centerY =
          screenY(worldY * TILE_SIZE + TILE_SIZE / 2) - arc * zoom;
        const travelAngle = Math.atan2(
          itemThrow.to.y - itemThrow.from.y,
          itemThrow.to.x - itemThrow.from.x,
        );
        // Missile sheet art faces north-east by default (-45 degrees).
        context.save();
        context.translate(Math.round(centerX), Math.round(centerY));
        context.rotate(travelAngle + Math.PI / 4);
        drawSheetFrame(
          context,
          assets.items,
          ITEM_DEFS[itemThrow.defId].sprite,
          16,
          16,
          -tileScreenSize / 2 + offset.x * 3 * zoom,
          -tileScreenSize / 2 + offset.y * 3 * zoom,
          tileScreenSize,
          tileScreenSize,
        );
        context.restore();
        return true;
      });

      state.objects.forEach((object) => {
        if (
          !inViewport(object.x, object.y) ||
          object.looted ||
          (!revealAll && !state.tiles[object.y][object.x].visible)
        ) return;
        const definition = OBJECT_SPRITES[object.kind];
        const bob = Math.sin(now / 420 + object.x * 0.7) * 0.5 * zoom;
        drawSheetFrame(
          context,
          assets.items,
          definition.sprite,
          16,
          16,
          screenX(object.x * TILE_SIZE),
          screenY(object.y * TILE_SIZE) + bob,
          tileScreenSize,
          tileScreenSize,
        );
      });

      const cloudColors: Record<string, string> = {
        fire: "rgba(255, 103, 48, .32)",
        frost: "rgba(116, 224, 255, .32)",
        paralytic: "rgba(226, 217, 123, .34)",
        toxic: "rgba(111, 181, 75, .34)",
        corrosive: "rgba(157, 205, 63, .38)",
        storm: "rgba(77, 144, 203, .34)",
      };
      for (const cloud of state.clouds ?? []) {
        for (const cloudTile of cloud.tiles) {
          if (
            !inViewport(cloudTile.x, cloudTile.y) ||
            !revealAll &&
            !state.tiles[cloudTile.y]?.[cloudTile.x]?.visible
          ) continue;
          const drawX = screenX(cloudTile.x * TILE_SIZE);
          const drawY = screenY(cloudTile.y * TILE_SIZE);
          const pulse =
            0.78 +
            Math.sin(now / 190 + cloudTile.x * 1.7 + cloudTile.y) * 0.12;
          context.save();
          context.globalAlpha =
            Math.max(0.24, cloudTile.intensity) * pulse;
          context.fillStyle = cloudColors[cloud.kind];
          context.fillRect(
            Math.floor(drawX),
            Math.floor(drawY),
            Math.ceil(tileScreenSize) + 1,
            Math.ceil(tileScreenSize) + 1,
          );
          context.restore();
          drawLogicalGridPixels(
            context,
            fieldTilePixels(
              cloud.kind,
              now,
              cloudTile.x * 31 + cloudTile.y * 17,
            ),
            drawX,
            drawY,
            tileScreenSize / 16,
            Math.max(0.28, cloudTile.intensity),
          );
        }
      }
      for (const ward of state.wards ?? []) {
        if (!inViewport(ward.x, ward.y)) continue;
        if (!revealAll && !state.tiles[ward.y]?.[ward.x]?.visible) continue;
        const centerX = screenX(ward.x * TILE_SIZE + TILE_SIZE / 2);
        const centerY = screenY(ward.y * TILE_SIZE + TILE_SIZE / 2);
        context.save();
        context.translate(centerX, centerY);
        context.rotate(now / 700);
        context.strokeStyle = "#c7a5ff";
        context.lineWidth = Math.max(1, 2 * zoom);
        context.strokeRect(-7 * zoom, -7 * zoom, 14 * zoom, 14 * zoom);
        context.restore();
      }

      magicRef.current = magicRef.current.filter((visual) => {
        const progress = (now - visual.startedAt) / visual.duration;
        if (progress < 0) return true;
        if (progress >= 1) return false;
        const fromX = screenX(visual.from.x * TILE_SIZE + TILE_SIZE / 2);
        const fromY = screenY(visual.from.y * TILE_SIZE + TILE_SIZE / 2);
        const toX = screenX(visual.to.x * TILE_SIZE + TILE_SIZE / 2);
        const toY = screenY(visual.to.y * TILE_SIZE + TILE_SIZE / 2);
        context.save();
        context.globalAlpha = Math.sin(progress * Math.PI);
        context.strokeStyle = visual.color;
        context.shadowColor = visual.secondaryColor ?? visual.color;
        context.shadowBlur = 9 * zoom;
        context.lineWidth =
          (visual.kind === "cone" ? 9 : 3) * zoom * (1 - progress * 0.45);
        context.beginPath();
        context.moveTo(fromX, fromY);
        context.lineTo(toX, toY);
        context.stroke();
        context.fillStyle = visual.secondaryColor ?? "#fff";
        context.beginPath();
        context.arc(
          fromX + (toX - fromX) * Math.min(1, progress * 1.8),
          fromY + (toY - fromY) * Math.min(1, progress * 1.8),
          3.5 * zoom,
          0,
          Math.PI * 2,
        );
        context.fill();
        context.restore();
        return true;
      });

      const drawBurningStatus = (
        id: string,
        point: Point,
        statuses: readonly { id: StatusEffectId; turns: number }[],
      ) => {
        if (
          !statuses.some(
            (status) => status.id === "burning" && status.turns > 0,
          )
        ) return;
        let seed = 0;
        for (const character of id) {
          seed = Math.imul(seed ^ character.charCodeAt(0), 31);
        }
        drawLogicalGridPixels(
          context,
          burningStatusPixels(now, seed),
          screenX(point.x * TILE_SIZE),
          screenY(point.y * TILE_SIZE),
          tileScreenSize / 16,
        );
      };

      const drawEnemy = (enemy: Enemy) => {
        if (!inViewport(enemy.x, enemy.y)) return;
        if (!revealAll && !state.tiles[enemy.y][enemy.x].visible) return;
        const sprite = ENEMY_SPRITES[enemy.kind];
        const visual = interpolate(enemy.id, enemy, now);
        let frames = sprite.idle;
        if (visual.motion?.kind === "move") frames = sprite.run;
        if (visual.motion?.kind === "attack") frames = sprite.attackFrames;
        const frameIndex = visual.motion
          ? Math.min(
              frames.length - 1,
              Math.floor(visual.progress * frames.length),
            )
          : Math.floor(now / 430) % frames.length;
        const sourceFrame = frames[frameIndex] ?? frames[0];
        const width = sprite.frameWidth * spritePixelSize;
        const height = sprite.frameHeight * spritePixelSize;
        const centerX = screenX(
          visual.point.x * TILE_SIZE + TILE_SIZE / 2,
        );
        const bottom = screenY(
          visual.point.y * TILE_SIZE + TILE_SIZE - 3,
        );
        const flip =
          visual.motion && visual.motion.to.x < visual.motion.from.x;

        drawEntityShadow(centerX, bottom, width, enemy.sleeping ? 0.25 : 0.36);
        const paintEnemySprite = () => {
          context.save();
          if (flip) {
            context.translate(Math.round(centerX), 0);
            context.scale(-1, 1);
            drawSheetFrame(
              context,
              assets.enemies[enemy.kind],
              sourceFrame,
              sprite.frameWidth,
              sprite.frameHeight,
              -width / 2,
              bottom - height,
              width,
              height,
            );
          } else {
            drawSheetFrame(
              context,
              assets.enemies[enemy.kind],
              sourceFrame,
              sprite.frameWidth,
              sprite.frameHeight,
              centerX - width / 2,
              bottom - height,
              width,
              height,
            );
          }
          context.restore();
        };
        paintEnemySprite();
        const flashAlpha = entityFlashAlpha(enemy.id);
        if (flashAlpha > 0) {
          context.save();
          context.globalAlpha = flashAlpha;
          context.globalCompositeOperation = "screen";
          paintEnemySprite();
          context.restore();
        }

        if (
          (enemy.statuses ?? []).some(
            (status) => status.id === "corrupted" && status.turns > 0,
          )
        ) {
          context.save();
          context.strokeStyle = "rgba(201, 156, 255, .9)";
          context.shadowColor = "#9b55d8";
          context.shadowBlur = 7 * zoom;
          context.lineWidth = Math.max(1, 1.5 * zoom);
          context.beginPath();
          context.ellipse(
            centerX,
            bottom - height * 0.45,
            width * 0.55,
            height * 0.6,
            0,
            0,
            Math.PI * 2,
          );
          context.stroke();
          context.restore();
        }
        drawBurningStatus(enemy.id, visual.point, enemy.statuses ?? []);

        if (enemy.sleeping) {
          drawSpeechBubble(
            centerX,
            bottom - height - (8 + Math.sin(now / 360 + enemy.x) * 2) * zoom,
            "Zz",
            "#9dc8d6",
          );
        }

        if (enemy.hp < enemy.maxHp) {
          const barWidth = Math.max(24 * zoom, width);
          const barX = centerX - barWidth / 2;
          const barY = bottom - height - 7 * zoom;
          context.fillStyle = "rgba(0,0,0,.8)";
          context.fillRect(
            Math.round(barX - zoom),
            Math.round(barY - zoom),
            barWidth + 2 * zoom,
            5 * zoom,
          );
          context.fillStyle = "#b82f3b";
          context.fillRect(
            Math.round(barX),
            Math.round(barY),
            Math.round(barWidth * (enemy.hp / enemy.maxHp)),
            3 * zoom,
          );
        }
      };

      renderCache.sortedEnemies.forEach(drawEnemy);
      const liveEnemyIds = new Set(state.enemies.map((enemy) => enemy.id));
      defeatedEnemyVisualRef.current.forEach(({ enemy }) => {
        if (!liveEnemyIds.has(enemy.id)) drawEnemy(enemy);
      });

      const drawCompanion = (companion: Companion) => {
        if (!inViewport(companion.x, companion.y)) return;
        if (
          !revealAll &&
          !state.tiles[companion.y]?.[companion.x]?.visible
        ) {
          return;
        }
        const visual = interpolate(companion.id, companion, now);
        const definition = COMPANION_CLASSES[companion.classId];
        const usesAdventurerFrames = definition.animationSet === "adventurer";
        let frames: readonly number[] = usesAdventurerFrames
          ? PLAYER_IDLE_FRAMES
          : COMPANION_IDLE_FRAMES;
        if (companion.hp <= 0) {
          frames = usesAdventurerFrames
            ? [PLAYER_IDLE_FRAMES[0]]
            : COMPANION_DEFEAT_FRAMES;
        } else if (visual.motion?.kind === "move") {
          frames = usesAdventurerFrames
            ? PLAYER_MOVE_FRAMES
            : COMPANION_MOVE_FRAMES;
        } else if (visual.motion?.kind === "attack") {
          frames = usesAdventurerFrames
            ? PLAYER_ATTACK_FRAMES
            : COMPANION_ATTACK_FRAMES;
        } else if (visual.motion?.kind === "interact") {
          frames = usesAdventurerFrames
            ? PLAYER_INTERACT_FRAMES
            : COMPANION_INTERACT_FRAMES;
        }
        const frameProgress = visual.motion
          ? visual.progress * frames.length
          : companion.hp <= 0
            ? frames.length - 1
            : now / 180;
        const frameWithinTier =
          frames[
            Math.min(
              frames.length - 1,
              Math.floor(frameProgress) % frames.length,
            )
          ] ?? frames[0];
        const sourceFrame = usesAdventurerFrames
          ? frameWithinTier
          : companionFrameIndex(
              companionArmorTier(companion),
              frameWithinTier,
            );
        const width = definition.frameWidth * spritePixelSize;
        const height = definition.frameHeight * spritePixelSize;
        const centerX = screenX(
          visual.point.x * TILE_SIZE + TILE_SIZE / 2,
        );
        const bottom = screenY(
          visual.point.y * TILE_SIZE + TILE_SIZE - 3,
        );
        const flip =
          visual.motion?.kind === "move" ||
          visual.motion?.kind === "attack"
            ? visual.motion.to.x < visual.motion.from.x
            : companion.facing === "left";
        drawEntityShadow(
          centerX,
          bottom,
          width,
          companion.hp <= 0 ? 0.16 : 0.34,
        );
        const paintCompanion = () => {
          context.save();
          const isDragSource =
            companionMapDragRef.current?.moved === true &&
            companionMapDragRef.current.companionId === companion.id;
          context.globalAlpha = isDragSource
            ? 0.34
            : companion.hp <= 0
              ? 0.58
              : 1;
          if (flip) {
            context.translate(Math.round(centerX), 0);
            context.scale(-1, 1);
            drawSheetFrame(
              context,
              assets.companions[companion.classId],
              sourceFrame,
              definition.frameWidth,
              definition.frameHeight,
              -width / 2,
              bottom - height,
              width,
              height,
            );
          } else {
            drawSheetFrame(
              context,
              assets.companions[companion.classId],
              sourceFrame,
              definition.frameWidth,
              definition.frameHeight,
              centerX - width / 2,
              bottom - height,
              width,
              height,
            );
          }
          context.restore();
        };
        paintCompanion();
        const flashAlpha = entityFlashAlpha(companion.id);
        if (flashAlpha > 0) {
          context.save();
          context.globalAlpha = flashAlpha;
          context.globalCompositeOperation = "screen";
          paintCompanion();
          context.restore();
        }
        drawBurningStatus(
          companion.id,
          visual.point,
          companion.statuses ?? [],
        );
        if (companion.hp > 0 && companion.hp < companion.maxHp) {
          const barWidth = Math.max(22 * zoom, width);
          const barX = centerX - barWidth / 2;
          const barY = bottom - height - 6 * zoom;
          context.fillStyle = "rgba(0,0,0,.8)";
          context.fillRect(
            Math.round(barX - zoom),
            Math.round(barY - zoom),
            barWidth + 2 * zoom,
            5 * zoom,
          );
          context.fillStyle = "#5faf78";
          context.fillRect(
            Math.round(barX),
            Math.round(barY),
            Math.round(barWidth * (companion.hp / companion.maxHp)),
            3 * zoom,
          );
        }
      };

      [...(state.companions ?? [])]
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .forEach((companion) => {
          const pendingDefeat = defeatedCompanionVisualRef.current.find(
            (visual) => visual.companion.id === companion.id,
          );
          drawCompanion(pendingDefeat?.companion ?? companion);
        });

      const playerMotion = playerVisual.motion;
      const playerProgress = playerVisual.progress;
      const playerDefinition = COMPANION_CLASSES[state.player.classId];
      const usesAdventurerFrames =
        playerDefinition.animationSet === "adventurer";
      let playerAction = playerActionRef.current;
      let playerActionProgress = -1;
      if (playerAction) {
        playerActionProgress =
          (now - playerAction.startedAt) / playerAction.duration;
        if (playerActionProgress >= 1) {
          playerActionRef.current = null;
          playerAction = null;
        }
      }

      let playerFrames: readonly number[] = usesAdventurerFrames
        ? PLAYER_IDLE_FRAMES
        : COMPANION_IDLE_FRAMES;
      let playerFrameProgress =
        (now / PLAYER_IDLE_FRAME_DURATION) % playerFrames.length;
      if (playerMotion?.kind === "attack") {
        playerFrames = usesAdventurerFrames
          ? PLAYER_ATTACK_FRAMES
          : COMPANION_ATTACK_FRAMES;
        playerFrameProgress = playerProgress * playerFrames.length;
      } else if (
        playerAction?.kind === "interact" &&
        playerActionProgress >= 0
      ) {
        playerFrames = usesAdventurerFrames
          ? PLAYER_INTERACT_FRAMES
          : COMPANION_INTERACT_FRAMES;
        playerFrameProgress = playerActionProgress * playerFrames.length;
      } else if (
        playerMotion?.kind === "move" ||
        (autoTravelRef.current &&
          pathRef.current.length > 0 &&
          playerMoveCycleStartedAtRef.current !== null)
      ) {
        playerFrames = usesAdventurerFrames
          ? PLAYER_MOVE_FRAMES
          : COMPANION_MOVE_FRAMES;
        const cycleStartedAt =
          playerMoveCycleStartedAtRef.current ??
          now - playerProgress * PLAYER_MOVE_DURATION;
        playerFrameProgress =
          Math.max(0, now - cycleStartedAt) / PLAYER_MOVE_FRAME_DURATION;
      }
      const playerFrameWithinTier =
        playerFrames[
          Math.min(
            playerFrames.length - 1,
            Math.floor(playerFrameProgress) % playerFrames.length,
          )
        ];
      const playerFrame = usesAdventurerFrames
        ? playerFrameWithinTier
        : companionFrameIndex(
            companionArmorTier(state.player),
            playerFrameWithinTier,
          );
      const playerWidth = playerDefinition.frameWidth * spritePixelSize;
      const playerHeight = playerDefinition.frameHeight * spritePixelSize;
      const playerCenterX = screenX(
        playerVisual.point.x * TILE_SIZE + TILE_SIZE / 2,
      );
      const playerBottom = screenY(
        playerVisual.point.y * TILE_SIZE + TILE_SIZE - 2,
      );
      drawEntityShadow(
        playerCenterX,
        playerBottom,
        playerWidth,
        state.player.invisibleTurns > 0 ? 0.16 : 0.38,
      );
      const paintPlayerSprite = () => {
        context.save();
        if (state.player.facing === "left") {
          context.translate(Math.round(playerCenterX), 0);
          context.scale(-1, 1);
          drawSheetFrame(
            context,
            assets.companions[state.player.classId],
            playerFrame,
            playerDefinition.frameWidth,
            playerDefinition.frameHeight,
            -playerWidth / 2,
            playerBottom - playerHeight,
            playerWidth,
            playerHeight,
          );
        } else {
          drawSheetFrame(
            context,
            assets.companions[state.player.classId],
            playerFrame,
            playerDefinition.frameWidth,
            playerDefinition.frameHeight,
            playerCenterX - playerWidth / 2,
            playerBottom - playerHeight,
            playerWidth,
            playerHeight,
          );
        }
        context.restore();
      };
      context.globalAlpha = state.player.invisibleTurns > 0 ? 0.48 : 1;
      paintPlayerSprite();
      context.globalAlpha = 1;
      const playerFlashAlpha = entityFlashAlpha(PLAYER_ID);
      if (playerFlashAlpha > 0) {
        context.save();
        context.globalAlpha = playerFlashAlpha;
        context.globalCompositeOperation = "screen";
        paintPlayerSprite();
        context.restore();
      }
      drawBurningStatus(
        state.player.companionId,
        playerVisual.point,
        state.player.statuses ?? [],
      );
      drawPixelEffects(
        context,
        pixelEffectsRef.current,
        now,
        pixelViewport,
        "actor",
      );

      for (let y = startY; y <= endY; y += 1) {
        for (let x = startX; x <= endX; x += 1) {
          const tile = state.tiles[y][x];
          const underlay = terrainUnderlayForPixelFog(tile);
          if (!underlay.draw) continue;
          const overlay = overlayFrameAt(renderCache, x, y);
          if (overlay === null) continue;
          context.globalAlpha = underlay.alpha;
          drawSheetFrame(
            context,
            assets.tiles,
            overlay,
            16,
            16,
            screenX(x * TILE_SIZE),
            screenY(y * TILE_SIZE),
            tileScreenSize,
            tileScreenSize,
          );
        }
      }
      context.globalAlpha = 1;

      (state.companions ?? []).forEach((companion) => {
        const target = companion.priorityTarget;
        const tile = target ? state.tiles[target.y]?.[target.x] : null;
        if (!target || !tile || (!revealAll && !tile.discovered)) return;
        const left = screenX(target.x * TILE_SIZE);
        const top = screenY(target.y * TILE_SIZE);
        const pulse =
          0.52 + Math.sin(now / 150 + companion.id.length) * 0.16;
        context.save();
        context.globalAlpha = pulse;
        context.strokeStyle = "#79f0c4";
        context.lineWidth = Math.max(1, zoom);
        context.strokeRect(
          left + 4 * zoom,
          top + 4 * zoom,
          tileScreenSize - 8 * zoom,
          tileScreenSize - 8 * zoom,
        );
        context.restore();
      });

      const hovered = hoverRef.current;
      if (
        hovered &&
        (revealAll ||
          state.tiles[hovered.y]?.[hovered.x]?.discovered) &&
        !cameraDragRef.current?.moved
      ) {
        const x = screenX(hovered.x * TILE_SIZE);
        const y = screenY(hovered.y * TILE_SIZE);
          context.strokeStyle = inspectModeRef.current
            ? "rgba(126, 222, 255, .95)"
            : "rgba(255, 219, 126, .9)";
        context.lineWidth = Math.max(1, 2 * zoom);
        context.strokeRect(
          Math.round(x + 3 * zoom),
          Math.round(y + 3 * zoom),
          tileScreenSize - 6 * zoom,
          tileScreenSize - 6 * zoom,
        );
      }

      const companionDrag = companionMapDragRef.current;
      if (companionDrag?.moved) {
        const companion = (state.companions ?? []).find(
          (candidate) =>
            candidate.id === companionDrag.companionId && candidate.hp > 0,
        );
        if (companion) {
          const target = companionDrag.target;
          const targetTile = target
            ? state.tiles[target.y]?.[target.x]
            : null;
          const visual = interpolate(companion.id, companion, now);
          const originX = screenX((visual.point.x + 0.5) * TILE_SIZE);
          const originY = screenY((visual.point.y + 0.5) * TILE_SIZE);
          const ghostCenterX =
            companionDrag.cursor.x - companionDrag.grabOffset.x;
          const ghostBottom =
            companionDrag.cursor.y - companionDrag.grabOffset.y;
          const definition = COMPANION_CLASSES[companion.classId];
          const usesAdventurerFrames =
            definition.animationSet === "adventurer";
          const idleFrames = usesAdventurerFrames
            ? PLAYER_IDLE_FRAMES
            : COMPANION_IDLE_FRAMES;
          const idleFrame =
            idleFrames[Math.floor(now / 180) % idleFrames.length] ??
            idleFrames[0];
          const sourceFrame = usesAdventurerFrames
            ? idleFrame
            : companionFrameIndex(
                companionArmorTier(companion),
                idleFrame,
              );
          const ghostWidth = definition.frameWidth * spritePixelSize;
          const ghostHeight = definition.frameHeight * spritePixelSize;
          const pulse = 0.72 + Math.sin(now / 105) * 0.2;
          context.save();
          context.globalAlpha = pulse;
          context.strokeStyle = "#79f0c4";
          context.fillStyle = "rgba(72, 210, 168, .18)";
          context.lineWidth = Math.max(1, zoom);
          context.setLineDash([4 * zoom, 3 * zoom]);
          context.beginPath();
          context.moveTo(originX, originY);
          context.lineTo(ghostCenterX, ghostBottom - ghostHeight / 2);
          context.stroke();
          context.setLineDash([]);
          if (target && targetTile && (revealAll || targetTile.discovered)) {
            const targetX = screenX((target.x + 0.5) * TILE_SIZE);
            const targetY = screenY((target.y + 0.5) * TILE_SIZE);
            context.fillRect(
              targetX - tileScreenSize / 2 + 2 * zoom,
              targetY - tileScreenSize / 2 + 2 * zoom,
              tileScreenSize - 4 * zoom,
              tileScreenSize - 4 * zoom,
            );
            context.strokeRect(
              targetX - tileScreenSize / 2 + 2 * zoom,
              targetY - tileScreenSize / 2 + 2 * zoom,
              tileScreenSize - 4 * zoom,
              tileScreenSize - 4 * zoom,
            );
          }
          context.restore();

          context.save();
          context.globalAlpha = 0.58;
          if (companion.facing === "left") {
            context.translate(Math.round(ghostCenterX), 0);
            context.scale(-1, 1);
            drawSheetFrame(
              context,
              assets.companions[companion.classId],
              sourceFrame,
              definition.frameWidth,
              definition.frameHeight,
              -ghostWidth / 2,
              ghostBottom - ghostHeight,
              ghostWidth,
              ghostHeight,
            );
          } else {
            drawSheetFrame(
              context,
              assets.companions[companion.classId],
              sourceFrame,
              definition.frameWidth,
              definition.frameHeight,
              ghostCenterX - ghostWidth / 2,
              ghostBottom - ghostHeight,
              ghostWidth,
              ghostHeight,
            );
          }
          context.restore();
        }
      }

      const suggestedAim = suggestedAimTargetRef.current;
      if (
        suggestedAim &&
        (revealAll || state.tiles[suggestedAim.y]?.[suggestedAim.x]?.visible)
      ) {
        const origin = partyActor(
          state,
          controlledActorIdRef.current,
        );
        const targetX = screenX(suggestedAim.x * TILE_SIZE);
        const targetY = screenY(suggestedAim.y * TILE_SIZE);
        const originX = screenX((origin.x + 0.5) * TILE_SIZE);
        const originY = screenY((origin.y + 0.5) * TILE_SIZE);
        const pulse = 0.68 + Math.sin(now / 115) * 0.22;
        context.save();
        context.globalAlpha = pulse;
        context.strokeStyle = "#8cecff";
        context.lineWidth = Math.max(1, zoom);
        context.setLineDash([
          Math.max(2, Math.round(3 * zoom)),
          Math.max(2, Math.round(2 * zoom)),
        ]);
        context.beginPath();
        context.moveTo(Math.round(originX), Math.round(originY));
        context.lineTo(
          Math.round(targetX + tileScreenSize / 2),
          Math.round(targetY + tileScreenSize / 2),
        );
        context.stroke();
        context.setLineDash([]);
        context.lineWidth = Math.max(1, 2 * zoom);
        context.strokeRect(
          Math.round(targetX + 2 * zoom),
          Math.round(targetY + 2 * zoom),
          tileScreenSize - 4 * zoom,
          tileScreenSize - 4 * zoom,
        );
        context.fillStyle = "#e7fbff";
        const corner = Math.max(2, Math.round(3 * zoom));
        context.fillRect(targetX, targetY, corner, corner);
        context.fillRect(
          targetX + tileScreenSize - corner,
          targetY,
          corner,
          corner,
        );
        context.fillRect(
          targetX,
          targetY + tileScreenSize - corner,
          corner,
          corner,
        );
        context.fillRect(
          targetX + tileScreenSize - corner,
          targetY + tileScreenSize - corner,
          corner,
          corner,
        );
        context.restore();
      }

      if (!revealAll) {
        const visibleBitAt = (cellX: number, cellY: number) =>
          fogMaskBitAt(renderCache, cellX, cellY, "visible");
        const discoveredBitAt = (cellX: number, cellY: number) =>
          fogMaskBitAt(renderCache, cellX, cellY, "discovered");
        const pixelFogRuntime = pixelFogRuntimeRef.current;
        const fogTextureCanvas =
          fogTextureCanvasRef.current ?? document.createElement("canvas");
        fogTextureCanvasRef.current = fogTextureCanvas;
        const fogTextureWidth = state.width * FOG_PIXELS_PER_TILE;
        const fogTextureHeight = state.height * FOG_PIXELS_PER_TILE;
        if (fogTextureCanvas.width !== fogTextureWidth) {
          fogTextureCanvas.width = fogTextureWidth;
        }
        if (fogTextureCanvas.height !== fogTextureHeight) {
          fogTextureCanvas.height = fogTextureHeight;
        }
        const fogTexture = fogTextureCanvas.getContext("2d", {
          alpha: true,
        });
        if (fogTexture) {
          fogTexture.imageSmoothingEnabled = false;
          drawPixelFogTexture(fogTexture, {
            now,
            visibilityRevision: renderCache.fogRevision,
            mapKey: state.floor,
            runtime: pixelFogRuntime,
            originCellX: state.player.x * 2 + 1,
            originCellY: state.player.y * 2 + 1,
            minCellX: 0,
            maxCellX: state.width * 2 - 1,
            minCellY: 0,
            maxCellY: state.height * 2 - 1,
            isVisible: visibleBitAt,
            isDiscovered: discoveredBitAt,
          });
          context.save();
          context.imageSmoothingEnabled = false;
          context.drawImage(
            fogTextureCanvas,
            screenX(0),
            screenY(0),
            state.width * TILE_SIZE * zoom,
            state.height * TILE_SIZE * zoom,
          );
          context.restore();
        }
      }
      drawPixelEffects(
        context,
        pixelEffectsRef.current,
        now,
        pixelViewport,
        "overlay",
      );

      statusSignalRef.current = statusSignalRef.current.filter((signal) => {
        if (signal.holdUntilTurnEnd) {
          if (now < signal.startedAt) return true;
          const releaseProgress = signal.releasedAt
            ? (now - signal.releasedAt) / 180
            : 0;
          if (releaseProgress >= 1) return false;
          if (
            !revealAll &&
            !state.tiles[signal.y]?.[signal.x]?.visible
          ) {
            return true;
          }
          const bob =
            Math.sin((now - signal.startedAt) / 115) * 1.5 * zoom;
          drawSpeechBubble(
            screenX(signal.x * TILE_SIZE + TILE_SIZE / 2),
            screenY(signal.y * TILE_SIZE) - 7 * zoom - bob,
            signal.text,
            signal.color,
            Math.max(0, 1 - releaseProgress),
          );
          return true;
        }
        const progress = (now - signal.startedAt) / signal.duration;
        if (progress < 0) return true;
        if (progress >= 1) return false;
        if (
          !revealAll &&
          !state.tiles[signal.y]?.[signal.x]?.visible
        ) return true;
        const rise = Math.sin(progress * Math.PI) * 8 * zoom;
        const fade =
          progress < 0.7 ? 1 : (1 - progress) / 0.3;
        drawSpeechBubble(
          screenX(signal.x * TILE_SIZE + TILE_SIZE / 2),
          screenY(signal.y * TILE_SIZE) - 7 * zoom - rise,
          signal.text,
          signal.color,
          Math.max(0, fade),
        );
        return true;
      });

      pickupRef.current = pickupRef.current.filter((pickup) => {
        const progress = (now - pickup.startedAt) / PICKUP_DURATION;
        if (progress < 0) return true;
        if (progress >= 1) return false;
        const definition = ITEM_DEFS[pickup.defId];
        if (!definition) return false;
        const eased = 1 - Math.pow(1 - progress, 3);
        const pulse = 1 + Math.sin(progress * Math.PI) * 0.24;
        const size = tileScreenSize * pulse;
        const offset = itemSpriteOffset(pickup.defId);
        const centerX = screenX(pickup.x * TILE_SIZE + TILE_SIZE / 2);
        const centerY =
          screenY(pickup.y * TILE_SIZE + TILE_SIZE / 2) -
          eased * 30 * zoom;
        const fade = progress < 0.58 ? 1 : 1 - (progress - 0.58) / 0.42;

        context.save();
        context.globalAlpha = Math.max(0, fade);
        context.translate(Math.round(centerX), Math.round(centerY));
        context.rotate(progress * Math.PI * 0.5);
        context.strokeStyle = "rgba(255, 221, 123, .9)";
        context.lineWidth = Math.max(1, 2 * zoom);
        const sparkleSize = (12 + progress * 9) * zoom;
        context.strokeRect(
          -sparkleSize / 2,
          -sparkleSize / 2,
          sparkleSize,
          sparkleSize,
        );
        context.rotate(-progress * Math.PI * 0.5);
        drawSheetFrame(
          context,
          assets.items,
          definition.sprite,
          16,
          16,
          -size / 2 + offset.x * (size / 16),
          -size / 2 + offset.y * (size / 16),
          size,
          size,
        );
        context.restore();
        return true;
      });
      context.globalAlpha = 1;

      effectsRef.current = effectsRef.current.filter((effect) => {
        const progress = (now - effect.startedAt) / 900;
        if (progress < 0) return true;
        if (progress >= 1) return false;
        const fade =
          progress < 0.58 ? 1 : Math.max(0, (1 - progress) / 0.42);
        const travelX =
          effect.originOffsetX + effect.velocityX * progress;
        const travelY =
          effect.originOffsetY +
          effect.velocityY * progress +
          0.5 * effect.gravity * progress * progress;
        context.globalAlpha = fade;
        context.fillStyle = effect.color;
        context.font = `${Math.round(14 * zoom)}px MonaGame, monospace`;
        context.textAlign = "center";
        context.shadowColor = "#000";
        context.shadowBlur = Math.max(1, 2 * zoom);
        context.fillText(
          effect.text,
          screenX(effect.x * TILE_SIZE + TILE_SIZE / 2) + travelX * zoom,
          screenY(effect.y * TILE_SIZE + 5) + travelY * zoom,
        );
        context.shadowBlur = 0;
        return true;
      });
      context.globalAlpha = 1;

      context.fillStyle = vignette;
      context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [assetsReady]);

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
    COMPANION_CLASSES[controlledCharacter.classId];
  const controlledHasActed = manualActedIds.has(controlledActorId);
  const controlledActionDisabled =
    busy || game.gameOver || (manualPartyMode && controlledHasActed);
  const pendingQuickslotDefinition = pendingQuickslotAim
    ? ITEM_DEFS[pendingQuickslotAim.itemId]
    : null;
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
                <b>{game.player.inventory.iron_key ?? 0}</b>
              </span>
              <TurnGauge
                moveSpeed={controlledCompanion ? 1 : getPlayerMoveSpeed(game.player)}
                attackSpeed={controlledCompanion ? 1 : getPlayerAttackSpeed(game.player)}
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
                onClick={() => setSoundEnabled((enabled) => !enabled)}
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
                  {localizedEnemyName(hoveredEnemy.kind, language)}
                </strong>
                <span>
                  HP {hoveredEnemy.hp}/{hoveredEnemy.maxHp}
                </span>
                {hoveredEnemy.sleeping && (
                  <em>{text("수면 중", "Sleeping")}</em>
                )}
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
                    {controlledCharacter.name} · {localizedItemName(
                      pendingQuickslotDefinition.id,
                      language,
                    )}
                  </strong>
                  {pendingQuickslotAim?.suggestedTarget
                    ? text(
                        "가까운 적 조준됨 · 같은 퀵슬롯을 다시 눌러 발사 · 빈 타일도 선택 가능 · Esc 취소",
                        "Nearest enemy targeted · press the same slot to fire · empty tiles are valid · Esc to cancel",
                      )
                    : text(
                        "가까운 적 없음 · 원하는 타일을 선택해 발사 · Esc 취소",
                        "No nearby enemy · select any tile to fire · Esc to cancel",
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
                        `${pendingSkillDefinition.range === 0 ? "자기 칸" : `사거리 ${pendingSkillDefinition.range}칸`} · 같은 스킬을 다시 누르면 자동 발동 · 빈 타일도 선택 가능 · Esc 취소`,
                        `${pendingSkillDefinition.range === 0 ? "Self tile" : `Range ${pendingSkillDefinition.range}`} · press the same skill to auto-cast · empty tiles are valid · Esc to cancel`,
                      )
                    : text(
                        `사거리 ${pendingSkillDefinition.range}칸 · 원하는 타일 선택 · 빈 타일도 발동 · Esc 취소`,
                        `Range ${pendingSkillDefinition.range} · select any tile · empty tiles are valid · Esc to cancel`,
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
                    "던질 방향을 지도에서 클릭 · Esc 취소",
                    "Select a direction on the map · Esc to cancel",
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
                    "발사할 목표를 지도에서 클릭 · Esc 취소",
                    "Select a target tile · Esc to cancel",
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
            {game.gameOver && (
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
              upgradeMode={Boolean(pendingUpgradeScrollRef)}
              onSelectSlot={selectCompanionLoadoutSlot}
              onSelectPlayerSlot={selectPlayerLoadoutSlot}
              onAssignPendingCompanion={assignPendingCompanionItem}
              onAssignPendingPlayer={assignPendingPlayerItem}
              onUpgradeCompanion={upgradeCompanionLoadout}
              onUpgradePlayer={upgradePlayerLoadout}
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
              upgradeMode={Boolean(pendingUpgradeScrollRef)}
              onUpgradeItem={(itemRef) =>
                applyUpgradeScroll({ kind: "inventory", itemRef })
              }
              companionTarget={companionLoadoutSelection}
              playerTarget={playerLoadoutSelection}
              onCompanionItem={assignSelectedCompanionItem}
              onPlayerItem={assignSelectedPlayerItem}
              onCancelPicker={() => {
                setPendingLoadoutItemRef(null);
                setPendingUpgradeScrollRef(null);
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
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {settingsOpen && (
        <SettingsModal
          uiScale={uiScale}
          fontScale={fontScale}
          language={language}
          developerMode={developerMode}
          onScaleChange={onScaleChange}
          onFontScaleChange={onFontScaleChange}
          onLanguageChange={onLanguageChange}
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
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [hubHelpOpen, setHubHelpOpen] = useState(false);
  const [hubSettingsOpen, setHubSettingsOpen] = useState(false);
  const [hubCompendiumOpen, setHubCompendiumOpen] = useState(false);
  const [uiScale, setUiScale] = useState(1);
  const [fontScale, setFontScale] = useState(1);
  const [language, setLanguage] = useState<UiLanguage>("ko");
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
  const dungeonOffers = useMemo(
    () => generateDungeonOffers(campaign.offerSeed),
    [campaign.offerSeed],
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
        }));
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
      setSelectedDungeon(dungeon);
      setWarehouseOpen(false);
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
    [campaign.companions],
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

  const handleCampaignSlotDrop = useCallback(
    (held: HeldSlotItem, target: ItemSlotAddress) => {
      const source = held.source;
      const isWarehouseOrBag = (address: ItemSlotAddress) =>
        address.zone === "warehouse" ||
        address.zone === "preparationInventory";
      const isPreparationEquipment = (
        address: ItemSlotAddress,
      ): address is Extract<
        ItemSlotAddress,
        { zone: "preparationCompanionEquipment" }
      > => address.zone === "preparationCompanionEquipment";

      if (
        !isWarehouseOrBag(source) &&
        !isPreparationEquipment(source)
      ) {
        return;
      }
      if (
        !isWarehouseOrBag(target) &&
        !isPreparationEquipment(target)
      ) {
        return;
      }

      const nextCampaign: CampaignSave = {
        ...campaign,
        warehouse: cloneWarehouse(campaign.warehouse),
        companions: campaign.companions.map((companion) => ({
          ...companion,
          equipment: { ...companion.equipment },
          equipmentInstances: { ...companion.equipmentInstances },
          autoSlots: companion.autoSlots.map((slot) =>
            slot
              ? {
                  ...slot,
                  instance: slot.instance ? { ...slot.instance } : null,
                }
              : null,
          ) as Companion["autoSlots"],
        })),
      };
      const nextLoadout: ExpeditionLoadout = {
        stacks: { ...preparationLoadout.stacks },
        instanceIds: [...preparationLoadout.instanceIds],
        slotRefs: [...preparationLoadout.slotRefs],
      };
      const selectedRefs = () => [
        ...Object.keys(nextLoadout.stacks).filter(
          (itemId) => nextLoadout.stacks[itemId] > 0,
        ),
        ...nextLoadout.instanceIds,
      ];
      const normalizeLoadout = () => {
        nextLoadout.slotRefs = normalizeFixedSlots(
          nextLoadout.slotRefs,
          selectedRefs(),
          MAX_INVENTORY_SLOTS,
        );
      };
      const selectStoredRef = (itemRef: string) => {
        const instance = nextCampaign.warehouse.instances.find(
          (candidate) => candidate.id === itemRef,
        );
        if (instance) {
          if (!nextLoadout.instanceIds.includes(itemRef)) {
            nextLoadout.instanceIds.push(itemRef);
          }
        } else if ((nextCampaign.warehouse.stacks[itemRef] ?? 0) > 0) {
          nextLoadout.stacks[itemRef] = nextCampaign.warehouse.stacks[itemRef];
        }
        normalizeLoadout();
      };
      const deselectStoredRef = (itemRef: string) => {
        delete nextLoadout.stacks[itemRef];
        nextLoadout.instanceIds = nextLoadout.instanceIds.filter(
          (candidate) => candidate !== itemRef,
        );
        normalizeLoadout();
      };
      const warehouseSlots = () =>
        normalizeStorageSlots(nextCampaign.warehouse, WAREHOUSE_SLOT_COUNT);
      const visibleWarehouseRefAt = (index: number) => {
        const itemRef = warehouseSlots()[index];
        return itemRef && !selectedRefs().includes(itemRef) ? itemRef : null;
      };
      const bagRefAt = (index: number) => {
        normalizeLoadout();
        return nextLoadout.slotRefs[index] ?? null;
      };
      const placeWarehouseRef = (itemRef: string, index: number) => {
        const slots = warehouseSlots();
        const fromIndex = slots.indexOf(itemRef);
        nextCampaign.warehouse.slots = fromIndex >= 0
          ? swapFixedSlots(slots, fromIndex, index)
          : slots;
      };
      const placeBagRef = (itemRef: string, index: number) => {
        normalizeLoadout();
        const fromIndex = nextLoadout.slotRefs.indexOf(itemRef);
        if (fromIndex >= 0) {
          nextLoadout.slotRefs = swapFixedSlots(
            nextLoadout.slotRefs,
            fromIndex,
            index,
          );
        }
      };

      if (source.zone === "warehouse" && target.zone === "warehouse") {
        nextCampaign.warehouse.slots = swapFixedSlots(
          warehouseSlots(),
          source.index,
          target.index,
        );
        setCampaign(nextCampaign);
        return;
      }
      if (
        source.zone === "preparationInventory" &&
        target.zone === "preparationInventory"
      ) {
        normalizeLoadout();
        nextLoadout.slotRefs = swapFixedSlots(
          nextLoadout.slotRefs,
          source.index,
          target.index,
        );
        setPreparationLoadout(nextLoadout);
        return;
      }
      if (source.zone === "warehouse" && target.zone === "preparationInventory") {
        const sourceRef = visibleWarehouseRefAt(source.index);
        const targetRef = bagRefAt(target.index);
        if (!sourceRef) return;
        if (!targetRef && selectedLoadoutSlotCount(nextLoadout) >= MAX_INVENTORY_SLOTS) {
          return;
        }
        if (targetRef) deselectStoredRef(targetRef);
        selectStoredRef(sourceRef);
        placeBagRef(sourceRef, target.index);
        if (targetRef) {
          const targetWarehouseIndex = warehouseSlots().indexOf(targetRef);
          if (targetWarehouseIndex >= 0) {
            nextCampaign.warehouse.slots = swapFixedSlots(
              warehouseSlots(),
              source.index,
              targetWarehouseIndex,
            );
          }
        }
        setCampaign(nextCampaign);
        setPreparationLoadout(nextLoadout);
        return;
      }
      if (source.zone === "preparationInventory" && target.zone === "warehouse") {
        const sourceRef = bagRefAt(source.index);
        const targetRef = visibleWarehouseRefAt(target.index);
        if (!sourceRef) return;
        deselectStoredRef(sourceRef);
        if (targetRef) selectStoredRef(targetRef);
        const sourceWarehouseIndex = warehouseSlots().indexOf(sourceRef);
        if (sourceWarehouseIndex >= 0) {
          nextCampaign.warehouse.slots = swapFixedSlots(
            warehouseSlots(),
            sourceWarehouseIndex,
            target.index,
          );
        }
        if (targetRef) placeBagRef(targetRef, source.index);
        setCampaign(nextCampaign);
        setPreparationLoadout(nextLoadout);
        return;
      }

      type PreparationEquipmentAddress = Extract<
        ItemSlotAddress,
        { zone: "preparationCompanionEquipment" }
      >;
      type StoredGear = {
        defId: string;
        instance: InventoryInstance;
      };
      const equipmentKey = (address: PreparationEquipmentAddress) =>
        address.target.kind === "equipment"
          ? address.target.slot
          : FLEX_RING_KEYS[address.target.index];
      const equipmentOwner = (address: PreparationEquipmentAddress) =>
        nextCampaign.companions.find(
          (companion) => companion.id === address.companionId,
        ) ?? null;
      const readGear = (address: PreparationEquipmentAddress) => {
        const owner = equipmentOwner(address);
        if (!owner) return null;
        if (address.target.kind === "flex") {
          const autoItem = owner.autoSlots[address.target.index];
          if (autoItem?.instance) {
            return {
              defId: autoItem.defId,
              instance: autoItem.instance,
            };
          }
          if (autoItem) return null;
        }
        const key = equipmentKey(address);
        const defId = owner.equipment[key];
        if (!defId) return null;
        return {
          defId,
          instance:
            owner.equipmentInstances[key] ??
            createPlainEquipmentInstance(
              ITEM_DEFS[defId],
              `preparation-${defId}-${address.zone}-${key}`,
            ),
        };
      };
      const acceptsGear = (
        gear: StoredGear,
        address: PreparationEquipmentAddress,
      ) => {
        const definition = ITEM_DEFS[gear.defId];
        if (!definition) return false;
        return address.target.kind === "equipment"
          ? definition.slot === address.target.slot
          : isPartyQuickslotTarget(address.target)
            ? AUTO_SLOT_CATEGORIES.has(definition.category)
            : definition.category === "ring" ||
              definition.category === "artifact";
      };
      const writeGear = (
        address: PreparationEquipmentAddress,
        gear: StoredGear | null,
      ) => {
        const owner = equipmentOwner(address);
        if (!owner) return;
        if (address.target.kind === "flex") {
          const ringKey = FLEX_RING_KEYS[address.target.index];
          owner.equipment[ringKey] = null;
          owner.equipmentInstances[ringKey] = null;
          owner.autoSlots[address.target.index] = null;
          if (!gear) return;
          if (
            !isPartyQuickslotTarget(address.target) &&
            ["ring", "artifact"].includes(
              ITEM_DEFS[gear.defId]?.category ?? "",
            )
          ) {
            owner.equipment[ringKey] = gear.defId;
            owner.equipmentInstances[ringKey] = gear.instance;
          } else if (
            isPartyQuickslotTarget(address.target) &&
            ITEM_DEFS[gear.defId] &&
            AUTO_SLOT_CATEGORIES.has(ITEM_DEFS[gear.defId].category)
          ) {
            owner.autoSlots[address.target.index] = {
              defId: gear.defId,
              quantity: 1,
              instance: gear.instance,
            };
          }
          return;
        }
        const key = equipmentKey(address);
        owner.equipment[key] = gear?.defId ?? null;
        owner.equipmentInstances[key] = gear?.instance ?? null;
      };
      const takeStoredGear = (itemRef: string): StoredGear | null => {
        const instanceIndex = nextCampaign.warehouse.instances.findIndex(
          (instance) => instance.id === itemRef,
        );
        if (instanceIndex < 0) return null;
        const [instance] = nextCampaign.warehouse.instances.splice(instanceIndex, 1);
        const gear = { defId: instance.defId, instance };
        deselectStoredRef(itemRef);
        nextCampaign.warehouse.slots = normalizeStorageSlots(
          nextCampaign.warehouse,
          WAREHOUSE_SLOT_COUNT,
        );
        return gear;
      };
      const storeGear = (
        gear: StoredGear,
        warehouseIndex: number | null,
        bagIndex: number | null,
      ) => {
        nextCampaign.warehouse.instances.push(gear.instance);
        nextCampaign.warehouse.slots = normalizeStorageSlots(
          nextCampaign.warehouse,
          WAREHOUSE_SLOT_COUNT,
        );
        if (warehouseIndex !== null) {
          placeWarehouseRef(gear.instance.id, warehouseIndex);
        }
        if (bagIndex !== null) {
          selectStoredRef(gear.instance.id);
          placeBagRef(gear.instance.id, bagIndex);
        }
      };

      const sharedAutoItemAt = (address: PreparationEquipmentAddress) => {
        if (address.target.kind !== "flex") return null;
        const owner = equipmentOwner(address);
        if (!owner) return null;
        const item = owner.autoSlots[address.target.index];
        if (!item) return null;
        return typeof item === "string"
          ? { defId: item, shared: true }
          : {
              defId: item.defId,
              shared: !item.instance,
            };
      };
      const clearSharedAutoReferences = (defId: string) => {
        nextCampaign.companions.forEach((companion) => {
          companion.autoSlots = companion.autoSlots.map((item) =>
            item?.defId === defId && !item.instance ? null : item,
          ) as Companion["autoSlots"];
        });
      };

      if (isWarehouseOrBag(source) && isPreparationEquipment(target)) {
        const sourceRef = source.zone === "warehouse"
          ? visibleWarehouseRefAt(source.index)
          : bagRefAt(source.index);
        const sourceInstance = sourceRef
          ? nextCampaign.warehouse.instances.find(
              (instance) => instance.id === sourceRef,
            ) ?? null
          : null;
        const sourceDefId = sourceRef && !sourceInstance
          ? sourceRef
          : null;
        const sourceDefinition = sourceDefId
          ? ITEM_DEFS[sourceDefId]
          : null;
        if (
          sourceRef &&
          sourceDefId &&
          sourceDefinition &&
          target.target.kind === "flex" &&
          isPartyQuickslotTarget(target.target) &&
          AUTO_SLOT_CATEGORIES.has(sourceDefinition.category) &&
          sourceDefinition.category !== "wand"
        ) {
          if (
            source.zone === "warehouse" &&
            !selectedRefs().includes(sourceRef) &&
            selectedLoadoutSlotCount(nextLoadout) >= MAX_INVENTORY_SLOTS
          ) {
            return;
          }
          if (source.zone === "warehouse") selectStoredRef(sourceRef);
          const owner = equipmentOwner(target);
          if (!owner) return;
          const previousAuto = owner.autoSlots[target.target.index];
          if (
            previousAuto &&
            typeof previousAuto !== "string" &&
            previousAuto.instance
          ) {
            return;
          }
          const ringKey = FLEX_RING_KEYS[target.target.index];
          const previousRing = owner.equipment[ringKey];
          if (owner.equipmentInstances[ringKey]?.cursed) return;
          if (previousRing) {
            nextCampaign.warehouse.instances.push(
              owner.equipmentInstances[ringKey] ??
                createPlainEquipmentInstance(
                  ITEM_DEFS[previousRing],
                  `preparation-return-${previousRing}-${ringKey}`,
                ),
            );
            owner.equipment[ringKey] = null;
            owner.equipmentInstances[ringKey] = null;
            nextCampaign.warehouse.slots = normalizeStorageSlots(
              nextCampaign.warehouse,
              WAREHOUSE_SLOT_COUNT,
            );
          }
          const companion = nextCampaign.companions.find(
            (candidate) => candidate.id === target.companionId,
          );
          if (!companion) return;
          companion.autoSlots[target.target.index] = {
            defId: sourceDefId,
            quantity: 0,
            instance: null,
          };
          setCampaign(nextCampaign);
          setPreparationLoadout(nextLoadout);
          return;
        }
      }

      if (isPreparationEquipment(source) && isWarehouseOrBag(target)) {
        const autoItem = sharedAutoItemAt(source);
        if (autoItem?.shared && source.target.kind === "flex") {
          const owner = equipmentOwner(source);
          if (!owner) return;
          const companion = nextCampaign.companions.find(
            (candidate) => candidate.id === source.companionId,
          );
          if (!companion) return;
          companion.autoSlots[source.target.index] = null;
          if (target.zone === "warehouse") {
            clearSharedAutoReferences(autoItem.defId);
            deselectStoredRef(autoItem.defId);
            placeWarehouseRef(autoItem.defId, target.index);
          } else {
            if (!selectedRefs().includes(autoItem.defId)) {
              if (selectedLoadoutSlotCount(nextLoadout) >= MAX_INVENTORY_SLOTS) {
                return;
              }
              selectStoredRef(autoItem.defId);
            }
            placeBagRef(autoItem.defId, target.index);
          }
          setCampaign(nextCampaign);
          setPreparationLoadout(nextLoadout);
          return;
        }
      }

      if (isWarehouseOrBag(source) && isPreparationEquipment(target)) {
        const sourceRef = source.zone === "warehouse"
          ? visibleWarehouseRefAt(source.index)
          : bagRefAt(source.index);
        if (!sourceRef) return;
        const sourceGear = takeStoredGear(sourceRef);
        const targetGear = readGear(target);
        if (
          !sourceGear ||
          !acceptsGear(sourceGear, target) ||
          targetGear?.instance.cursed
        ) return;
        writeGear(target, sourceGear);
        if (targetGear) {
          storeGear(
            targetGear,
            source.zone === "warehouse" ? source.index : null,
            source.zone === "preparationInventory" ? source.index : null,
          );
        }
        setCampaign(nextCampaign);
        setPreparationLoadout(nextLoadout);
        return;
      }

      if (isPreparationEquipment(source) && isWarehouseOrBag(target)) {
        const sourceGear = readGear(source);
        if (!sourceGear || sourceGear.instance.cursed) return;
        const targetRef = target.zone === "warehouse"
          ? visibleWarehouseRefAt(target.index)
          : bagRefAt(target.index);
        const targetGear = targetRef ? takeStoredGear(targetRef) : null;
        if (targetRef && (!targetGear || !acceptsGear(targetGear, source))) return;
        writeGear(source, targetGear);
        storeGear(
          sourceGear,
          target.zone === "warehouse" ? target.index : null,
          target.zone === "preparationInventory" ? target.index : null,
        );
        setCampaign(nextCampaign);
        setPreparationLoadout(nextLoadout);
        return;
      }

      if (isPreparationEquipment(source) && isPreparationEquipment(target)) {
        const sourceGear = readGear(source);
        const targetGear = readGear(target);
        if (
          !sourceGear ||
          sourceGear.instance.cursed ||
          targetGear?.instance.cursed ||
          !acceptsGear(sourceGear, target) ||
          (targetGear && !acceptsGear(targetGear, source))
        ) {
          return;
        }
        writeGear(source, targetGear);
        writeGear(target, sourceGear);
        setCampaign(nextCampaign);
      }
    },
    [campaign, preparationLoadout],
  );

  const campaignSlotDrag = useItemSlotDrag(handleCampaignSlotDrop);

  const renderCampaignSurface = (content: ReactNode) => (
    <ItemSlotDragContext.Provider value={campaignSlotDrag}>
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
          {warehouseOpen && (
            <WarehouseModal
              warehouse={campaign.warehouse}
              onClose={() => setWarehouseOpen(false)}
            />
          )}
          {hubHelpOpen && <HelpModal onClose={() => setHubHelpOpen(false)} />}
          {hubSettingsOpen && (
            <SettingsModal
              uiScale={uiScale}
              fontScale={fontScale}
              language={language}
              developerMode={developerMode}
              onScaleChange={changeUiScale}
              onFontScaleChange={changeFontScale}
              onLanguageChange={changeLanguage}
              onDeveloperModeChange={setDeveloperMode}
              onClose={() => setHubSettingsOpen(false)}
            />
          )}
          {hubCompendiumOpen && (
            <CompendiumModal
              developerMode={developerMode}
              onClose={() => setHubCompendiumOpen(false)}
            />
          )}
          <HeldItemCursor held={campaignSlotDrag.held} />
        </div>
      </UiLanguageContext.Provider>
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
    const initialGame = createExpeditionGame(
      randomDungeonSeed(),
      {
        dungeonId: dungeon.id,
        dungeonName: dungeon.nameKo,
        maxFloor: dungeon.floorCount,
        difficultyScale: dungeon.difficultyScale,
        mainDropIds: [...dungeon.mainDropIds],
      },
      player,
      companions,
    );
    setCampaign((current) => ({
      ...current,
      warehouse: withdrawal.warehouse,
      expeditions: current.expeditions + 1,
    }));
    setActiveExpedition({ dungeon, initialGame });
    setExpeditionResult(null);
    setScreen("dungeon");
  }, [
    campaign.companions,
    campaign.warehouse,
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
      const rolledOfferSeed = randomDungeonSeed();
      const nextOfferSeed =
        rolledOfferSeed === campaign.offerSeed
          ? ((rolledOfferSeed + 0x9e3779b9) >>> 0) ||
            INITIAL_DUNGEON_OFFER_SEED
          : rolledOfferSeed;
      setCampaign((current) => {
        const deposited = depositPlayerInventory(current.warehouse, finalGame.player);
        const next: CampaignSave = {
          ...current,
          warehouse: deposited.warehouse,
          companions: mergeReturningCompanions(
            current.companions,
            [playerToCompanion(finalGame.player), ...finalGame.companions],
          ),
          completedExpeditions:
            current.completedExpeditions + (outcome === "completed" ? 1 : 0),
          offerSeed: nextOfferSeed,
        };
        setExpeditionResult({
          dungeon: finishedDungeon,
          outcome,
          stats: { ...stats, recoveredItems: deposited.recoveredItems },
        });
        return next;
      });
      setActiveExpedition(null);
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
        uiScale={uiScale}
        fontScale={fontScale}
        language={language}
        developerMode={developerMode}
        onScaleChange={changeUiScale}
        onFontScaleChange={changeFontScale}
        onLanguageChange={changeLanguage}
        onDeveloperModeChange={setDeveloperMode}
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
        loadout={preparationLoadout}
        selectedCompanionIds={selectedCompanionIds}
        onCompanionToggle={togglePreparationCompanion}
        onBack={() => {
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
      onSelectDungeon={openPreparation}
      onOpenWarehouse={() => setWarehouseOpen(true)}
      onOpenCompendium={() => setHubCompendiumOpen(true)}
      onOpenSettings={() => setHubSettingsOpen(true)}
      onOpenHelp={() => setHubHelpOpen(true)}
    />
  );
}
