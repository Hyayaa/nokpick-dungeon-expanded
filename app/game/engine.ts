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
} from "./data";
import {
  AUGMENTS_ENABLED,
  AUGMENT_IDS,
  AUGMENT_DEFS,
  augmentRank,
} from "./augments";
import {
  findPath,
  floorFeelingFor,
  generateFloor,
  hasLineOfSight,
  isWalkable,
  mapPointKey,
  updateFieldOfView,
} from "./map";
import type { P0RoomPreset } from "./room-presets";
import type { SpecialRewardSlot, SpecialRoomPreset } from "./special-rooms";
import { AUTO_SLOT_CATEGORIES, isWand } from "./magic";
import {
  COMPANION_SKILLS,
  normalizeCompanionProfession,
  normalizeCompanionSkills,
  normalizeSkillCooldowns,
} from "./companion-skills";
import {
  companionSkillBlueprint,
  companionSkillScalar,
  deriveCompanionSkill,
  type CompanionSkillModifier,
} from "./companion-skill-blueprints";
import {
  EQUIPMENT_TRAITS,
  createEquipmentInstance,
  createPlainEquipmentInstance,
  enchantEquipmentInstance,
  equipmentStatProfile,
  isUpgradeableEquipment,
  upgradeEquipmentInstance,
} from "./equipment";
import {
  cloneCompanionInstance,
  companionDirection,
  createCompanion,
  characterAccuracyBonus,
  characterAttackBonus,
  characterAttackMultiplier,
  characterDefenseBonus,
  characterEvasionBonus,
  characterViewBonus,
  getCompanionAccuracy,
  getCompanionAttack,
  getCompanionDefense,
  getCompanionEvasion,
  getCompanionViewDistance,
  reduceCharacterDamage,
} from "./companions";
import {
  experienceForNextLevel,
  LEVEL_STAT_GROWTH,
  MAX_PLAYER_LEVEL,
} from "./progression";
import {
  AlchemyFormula,
  resolveAlchemyFormula,
} from "./alchemy";
import {
  MAX_INVENTORY_SLOTS,
  normalizePlayerInventorySlots,
} from "./inventory-slots";
import {
  cloneGame,
  cloneGameWithoutTiles,
  cloneInventoryInstance,
  presentationStateWithFacing,
} from "./state";
import { pushLog } from "./log";
import {
  COMPANION_PASSIVE_SLOT_INDEXES,
  COMPANION_QUICKSLOT_INDEXES,
  FLEX_EQUIPMENT_KEYS as RING_EQUIPMENT_KEYS,
} from "./loadout";
import { random, randomInt } from "./random";
import {
  gridDistance as distance,
  pointEquals,
  pointInBounds as inBounds,
} from "./spatial";
import {
  hasProjectileLineOfFire,
  isSkillTargetableTile,
  isWithinCircularSkillRange,
} from "./targeting";
import {
  ActionResult,
  AugmentId,
  CloudKind,
  CombatEffect,
  Companion,
  CompanionAutoItem,
  CompanionClassId,
  CompanionCommand,
  CompanionSkillId,
  Direction,
  Enemy,
  EnemyKind,
  EquipmentOffer,
  EquipmentKey,
  EquipmentTraitId,
  EquipSlot,
  FlexSlotIndex,
  GameSoundCue,
  GameState,
  InventoryInstance,
  ItemCategory,
  ItemPickup,
  ItemThrow,
  LoadoutTarget,
  MagicVisual,
  Motion,
  Player,
  Point,
  StatusEffect,
  StatusEffectId,
  StatusSignal,
  UpgradeTarget,
} from "./types";

const PLAYER_ID = "player";
export { MAX_INVENTORY_SLOTS } from "./inventory-slots";
export const HIGH_GRASS_SEED_DROP_CHANCE = 0.05;
export { MAX_PLAYER_LEVEL } from "./progression";
export {
  COMPANION_PASSIVE_SLOT_INDEXES,
  COMPANION_QUICKSLOT_INDEXES,
} from "./loadout";
export const WAND_RECHARGE_TURNS = 50;
export const BURNING_DURATION = 8;
const FIRE_FIELD_DURATION = 6;

export type ExpeditionRules = {
  dungeonId: string;
  dungeonName: string;
  maxFloor: number;
  difficultyScale: number;
  difficulty?: number;
  mainDropIds: string[];
  lootPlan?: GameState["lootPlan"];
  goldPlan?: GameState["goldPlan"];
};

const DEFAULT_EXPEDITION_RULES: ExpeditionRules = {
  dungeonId: "flooded_sewers",
  dungeonName: "침수된 하수도",
  maxFloor: 3,
  difficultyScale: 1,
  difficulty: 1,
  mainDropIds: [],
  lootPlan: [],
  goldPlan: [],
};

const DIRECTIONS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

const isIndividualInventoryItem = (defId: string) => {
  const definition = ITEM_DEFS[defId];
  return Boolean(isUpgradeableEquipment(definition));
};

const playerInstances = (player: Player) => player.inventoryInstances ?? [];
const throwableProfile = (player: Player, defId: string) =>
  player.throwableProfiles?.[defId] ?? null;

const playerThrowableInstance = (player: Player, itemRef: string) => {
  const exact = playerInstances(player).find(
    (instance) =>
      instance.id === itemRef &&
      ITEM_DEFS[instance.defId]?.category === "missile",
  );
  if (exact) return exact;
  return throwableProfile(player, itemRef);
};

export const throwableChargeCount = (player: Player, itemRef: string) => {
  const profile = playerThrowableInstance(player, itemRef);
  if (!profile) return 0;
  const maximum = Math.max(0, profile.maxCharges ?? 0);
  return Math.max(0, Math.min(maximum, profile.charges ?? maximum));
};

const ownedThrowableInstance = (
  state: GameState,
  itemRef: string,
) => {
  const playerInstance = playerThrowableInstance(state.player, itemRef);
  if (playerInstance) return playerInstance;
  for (const companion of state.companions ?? []) {
    for (const slot of companion.autoSlots) {
      if (
        slot?.instance?.id === itemRef &&
        ITEM_DEFS[slot.instance.defId]?.category === "missile"
      ) {
        return slot.instance;
      }
    }
  }
  return null;
};

const restoreThrowableCharge = (
  state: GameState,
  itemRef: string,
  quantity = 1,
) => {
  const profile = ownedThrowableInstance(state, itemRef);
  if (!profile || quantity <= 0) return 0;
  const maximum = Math.max(0, profile.maxCharges ?? 0);
  const current = Math.max(
    0,
    Math.min(maximum, profile.charges ?? maximum),
  );
  const recovered = Math.max(0, Math.min(quantity, maximum - current));
  profile.charges = current + recovered;
  return recovered;
};

export const inventorySlotCount = (player: Player) => {
  const slottedInstanceRefs = new Set(
    (player.autoSlots ?? []).filter(
      (itemRef): itemRef is string =>
        Boolean(
          itemRef &&
            playerInstances(player).some(
              (instance) => instance.id === itemRef,
            ),
        ),
    ),
  );
  return (
    Object.entries(player.inventory).filter(
      ([defId, quantity]) =>
        quantity > 0 &&
        !isIndividualInventoryItem(defId),
    ).length +
    playerInstances(player).filter(
      (instance) => !slottedInstanceRefs.has(instance.id),
    ).length
  );
};

export const inventoryItemQuantity = (player: Player, defId: string) =>
  (player.inventory[defId] ?? 0) +
  playerInstances(player).filter((instance) => instance.defId === defId).length;

const resolveInventoryItem = (
  player: Player,
  itemRef: string,
): {
  defId: string;
  instance: InventoryInstance | null;
  individual: boolean;
} => {
  const individualInstance =
    playerInstances(player).find((candidate) => candidate.id === itemRef) ?? null;
  const defId = individualInstance?.defId ?? itemRef;
  return {
    defId,
    instance: individualInstance ?? throwableProfile(player, defId),
    individual: Boolean(individualInstance),
  };
};

export const inventoryItemProfile = (player: Player, itemRef: string) =>
  resolveInventoryItem(player, itemRef).instance;

const canAddInventoryItem = (player: Player, defId: string) =>
  inventorySlotCount(player) < MAX_INVENTORY_SLOTS ||
  (!isIndividualInventoryItem(defId) && (player.inventory[defId] ?? 0) > 0);

export const canPickupGroundItem = (
  state: GameState,
  item: GameState["groundItems"][number],
) => item.defId === "gold"
  ? true
  : item.recoversThrowableCharge
  ? Boolean(
      item.recoversItemRef &&
        (() => {
          const instance = ownedThrowableInstance(state, item.recoversItemRef!);
          if (!instance) return false;
          const maximum = Math.max(0, instance.maxCharges ?? 0);
          const current = Math.max(
            0,
            Math.min(maximum, instance.charges ?? maximum),
          );
          return current < maximum;
        })(),
    )
  : canAddInventoryItem(state.player, item.defId);

const addInventoryItem = (
  state: GameState,
  defId: string,
  instanceSeed = "",
  preservedInstance?: InventoryInstance,
  quantity = 1,
): string | null => {
  if (!canAddInventoryItem(state.player, defId) || quantity <= 0) return null;
  if (isIndividualInventoryItem(defId)) {
    const index = playerInstances(state.player).length;
    const id = `item-${defId}-${state.floor}-${state.turn}-${state.rng}-${index}-${instanceSeed}`;
    const instance = preservedInstance
      ? cloneInventoryInstance(preservedInstance)
      : createEquipmentInstance(ITEM_DEFS[defId], id, () => random(state));
    if (ITEM_DEFS[defId]?.category === "missile") {
      const initialCapacity = Math.max(
        1,
        preservedInstance?.baseMaxCharges ??
          preservedInstance?.maxCharges ??
          quantity,
      );
      instance.baseMaxCharges = initialCapacity;
      instance.maxCharges = Math.max(
        0,
        Math.min(initialCapacity, preservedInstance?.maxCharges ?? initialCapacity),
      );
      instance.charges = Math.max(
        0,
        Math.min(
          instance.maxCharges,
          preservedInstance?.charges ?? instance.maxCharges,
        ),
      );
      instance.maxDurability = preservedInstance?.maxDurability ?? 10;
      instance.durability = Math.max(
        1,
        Math.min(
          instance.maxDurability,
          preservedInstance?.durability ?? instance.maxDurability,
        ),
      );
    }
    state.player.inventoryInstances.push(instance);
    state.player.inventorySlots = normalizePlayerInventorySlots(state.player);
    return instance.id;
  } else {
    state.player.inventory[defId] =
      (state.player.inventory[defId] ?? 0) + quantity;
  }
  state.player.inventorySlots = normalizePlayerInventorySlots(state.player);
  return defId;
};

const removeInventoryItem = (state: GameState, itemRef: string) => {
  const { defId, instance, individual } = resolveInventoryItem(
    state.player,
    itemRef,
  );
  if (individual && instance) {
    state.player.inventoryInstances = state.player.inventoryInstances.filter(
      (candidate) => candidate.id !== instance.id,
    );
  } else {
    const quantity = state.player.inventory[defId] ?? 0;
    if (quantity <= 1) state.player.inventory[defId] = 0;
    else state.player.inventory[defId] = quantity - 1;
  }
  state.player.autoSlots = (state.player.autoSlots ?? [null, null, null, null]).map(
    (slot) => {
      if (!slot) return null;
      if (playerInstances(state.player).some((instance) => instance.id === slot)) {
        return slot;
      }
      return ITEM_DEFS[slot] && !isIndividualInventoryItem(slot) ? slot : null;
    },
  ) as Player["autoSlots"];
  state.player.inventorySlots = normalizePlayerInventorySlots(state.player);
  return { defId, instance };
};

const trampleHighGrass = (
  state: GameState,
  point: Point,
  canDropSeed = false,
) => {
  if (state.tiles[point.y]?.[point.x]?.terrain !== "highGrass") {
    return { trampled: false, droppedSeed: null };
  }
  state.tiles[point.y][point.x].terrain = "grass";
  if (
    !canDropSeed ||
    !SEED_ITEM_IDS.length ||
    random(state) >= HIGH_GRASS_SEED_DROP_CHANCE
  ) {
    return { trampled: true, droppedSeed: null };
  }
  const defId = SEED_ITEM_IDS[randomInt(state, 0, SEED_ITEM_IDS.length - 1)];
  const droppedSeed: GameState["groundItems"][number] = {
    id: `grass-seed-${state.floor}-${state.turn}-${point.x}-${point.y}-${state.rng}`,
    defId,
    lootOrigin: "grass",
    x: point.x,
    y: point.y,
  };
  state.groundItems.push(droppedSeed);
  return { trampled: true, droppedSeed };
};

const equipmentInstanceAt = (player: Player, key: EquipmentKey) =>
  player.equipmentInstances?.[key] ?? null;

const equippedItemEntries = (player: Player) =>
  (Object.keys(player.equipment) as EquipmentKey[]).flatMap((key) => {
    const defId = player.equipment[key];
    const definition = defId ? ITEM_DEFS[defId] : null;
    return definition
      ? [{
          key,
          defId,
          definition,
          instance: equipmentInstanceAt(player, key),
        }]
      : [];
  });

const itemBonus = (player: Player, field: "attack" | "defense") =>
  equippedItemEntries(player).reduce(
    (total, { definition, instance }) =>
      total + equipmentStatProfile(definition, instance)[field],
    0,
  );

const itemSpeedMultiplier = (
  player: Player,
  field: "moveSpeed" | "attackSpeed",
) =>
  equippedItemEntries(player).reduce(
    (multiplier, { definition, instance }) =>
      multiplier * equipmentStatProfile(definition, instance)[field],
    1,
  );

export const getPlayerMoveSpeed = (player: Player) => {
  const statusMultiplier =
    ((player.statuses ?? []).some((status) => status.id === "haste") ? 1.5 : 1) *
    ((player.statuses ?? []).some((status) => status.id === "stamina") ? 1.15 : 1) *
    ((player.statuses ?? []).some((status) => status.id === "chilled") ? 0.75 : 1);
  return Math.max(
    0.25,
    Math.round(itemSpeedMultiplier(player, "moveSpeed") * statusMultiplier * 100) /
      100,
  );
};

export const getPlayerAttackSpeed = (player: Player) => {
  const statusMultiplier =
    ((player.statuses ?? []).some((status) => status.id === "stamina") ? 1.15 : 1) *
    ((player.statuses ?? []).some((status) => status.id === "chilled") ? 0.75 : 1);
  return Math.max(
    0.25,
    Math.round(
      itemSpeedMultiplier(player, "attackSpeed") * statusMultiplier * 100,
    ) / 100,
  );
};

export const equipmentScore = (
  defId: string | null,
  instance?: InventoryInstance | null,
) => {
  if (!defId) return 0;
  const definition = ITEM_DEFS[defId];
  if (!isUpgradeableEquipment(definition)) return 0;
  const profile = equipmentStatProfile(definition, instance);
  const speedValue =
    Math.max(0, profile.moveSpeed - 1) * 16 +
    Math.max(0, profile.attackSpeed - 1) * 16;
  return (
    profile.attack * 3 +
    profile.defense * 3 +
    profile.magic * 2 +
    speedValue +
    profile.upgradeLevel * 2
  );
};

const comparisonEquipmentKey = (player: Player, slot: EquipSlot) => {
  if (slot !== "ring") return slot;
  const empty = RING_EQUIPMENT_KEYS.find(
    (key, index) =>
      !(player.equipment[key] ?? null) &&
      !(player.autoSlots?.[index] ?? null),
  );
  if (empty) return empty;
  const equippedRings = RING_EQUIPMENT_KEYS.filter(
    (key) => Boolean(player.equipment[key]),
  );
  if (!equippedRings.length) return null;
  return [...equippedRings].sort(
    (a, b) =>
      equipmentScore(
        player.equipment[a] ?? null,
        equipmentInstanceAt(player, a),
      ) -
      equipmentScore(
        player.equipment[b] ?? null,
        equipmentInstanceAt(player, b),
      ),
  )[0];
};

const comparisonEquipmentId = (player: Player, slot: EquipSlot) => {
  const key = comparisonEquipmentKey(player, slot);
  return key ? player.equipment[key] ?? null : null;
};

export const isBetterEquipment = (
  player: Player,
  defId: string,
  itemRef?: string,
) => {
  const definition = ITEM_DEFS[defId];
  if (!definition?.slot) return false;
  const candidate =
    playerInstances(player).find((instance) => instance.id === itemRef) ?? null;
  const currentKey = comparisonEquipmentKey(player, definition.slot);
  if (!currentKey) return false;
  const currentInstance = equipmentInstanceAt(player, currentKey);
  if (candidate?.cursed || currentInstance?.cursed) return false;
  return (
    equipmentScore(defId, candidate) >
    equipmentScore(
      player.equipment[currentKey] ?? null,
      currentInstance,
    )
  );
};

const pruneEquipmentOffers = (state: GameState) => {
  state.equipmentOffers = (state.equipmentOffers ?? []).filter(
    (offer) =>
      offer.expiresTurn > state.turn &&
      playerInstances(state.player).some(
        (instance) =>
          instance.id === offer.itemRef && instance.defId === offer.defId,
      ),
  );
};

const spendPlayerTime = (state: GameState, cost: number) => {
  const total = (state.player.actionProgress ?? 0) + Math.max(0, cost);
  const elapsedTurns = Math.floor(total + 0.000001);
  state.player.actionProgress = Math.max(
    0,
    Math.min(0.999999, total - elapsedTurns),
  );
  state.turn += elapsedTurns;
  if (elapsedTurns > 0) pruneEquipmentOffers(state);
  return elapsedTurns;
};

const equipInventoryItemDirect = (
  state: GameState,
  itemRef: string,
  announce = true,
  preferredRingIndex?: number,
) => {
  const { defId, instance } = resolveInventoryItem(state.player, itemRef);
  const definition = ITEM_DEFS[defId];
  if (!definition?.slot || inventoryItemQuantity(state.player, defId) <= 0) {
    return false;
  }
  const equipmentKey =
    definition.slot === "ring" && preferredRingIndex !== undefined
      ? RING_EQUIPMENT_KEYS[
          Math.max(
            0,
            Math.min(RING_EQUIPMENT_KEYS.length - 1, preferredRingIndex),
          )
        ]
      : comparisonEquipmentKey(state.player, definition.slot);
  if (!equipmentKey) return false;
  const previousItem = state.player.equipment[equipmentKey] ?? null;
  const previousInstance = equipmentInstanceAt(state.player, equipmentKey);
  if (previousItem && previousInstance?.cursed) {
    pushLog(
      state,
      `${ITEM_DEFS[previousItem].name}은(는) 저주받아 해제하거나 교체할 수 없습니다.`,
    );
    return false;
  }
  if (definition.slot === "ring") {
    const flexIndex = RING_EQUIPMENT_KEYS.indexOf(
      equipmentKey as (typeof RING_EQUIPMENT_KEYS)[number],
    );
    if (flexIndex >= 0) {
      const previousAutoRef = state.player.autoSlots[flexIndex];
      const previousAutoInstance = previousAutoRef
        ? resolveInventoryItem(state.player, previousAutoRef).instance
        : null;
      if (previousAutoRef && previousAutoInstance?.cursed) {
        pushLog(
          state,
          `${ITEM_DEFS[previousAutoInstance.defId].name}은(는) 저주받아 퀵슬롯에서 뺄 수 없습니다.`,
        );
        return false;
      }
      state.player.autoSlots[flexIndex] = null;
    }
  }
  const removed = removeInventoryItem(state, itemRef);
  if (previousItem) {
    const restored =
      previousInstance ??
      createPlainEquipmentInstance(
        ITEM_DEFS[previousItem],
        `equipped-${previousItem}-${state.turn}-${equipmentKey}`,
      );
    state.player.inventoryInstances.push(cloneInventoryInstance(restored));
  }
  state.player.equipment[equipmentKey] = defId;
  state.player.equipmentInstances[equipmentKey] =
    removed.instance ??
    instance ??
    createPlainEquipmentInstance(
      definition,
      `equipped-${defId}-${state.turn}-${equipmentKey}`,
    );
  state.equipmentOffers = (state.equipmentOffers ?? []).filter(
    (offer) =>
      offer.itemRef !== itemRef &&
      playerInstances(state.player).some(
        (instance) => instance.id === offer.itemRef,
      ) &&
      isBetterEquipment(state.player, offer.defId, offer.itemRef),
  ).map((offer) => ({
    ...offer,
    currentDefId: comparisonEquipmentId(state.player, offer.slot),
  }));
  if (announce) pushLog(state, `${definition.name}을(를) 장착했습니다.`);
  return true;
};

const queueEquipmentOffer = (
  state: GameState,
  defId: string,
  itemRef: string,
) => {
  const definition = ITEM_DEFS[defId];
  if (
    !definition?.slot ||
    !isBetterEquipment(state.player, defId, itemRef)
  ) return;
  const currentDefId = comparisonEquipmentId(state.player, definition.slot);
  const offer: EquipmentOffer = {
    id: `equipment-offer-${itemRef}`,
    itemRef,
    defId,
    slot: definition.slot,
    currentDefId,
    createdTurn: state.turn,
    expiresTurn: state.turn + 10,
  };
  state.equipmentOffers = [
    ...(state.equipmentOffers ?? []).filter(
      (candidate) => candidate.itemRef !== itemRef,
    ),
    offer,
  ];
};

export const getPlayerAttack = (player: Player) =>
  Math.max(
    1,
    Math.round(
      (player.baseAttack +
        characterAttackBonus(player) +
        itemBonus(player, "attack") +
        augmentRank(player, "strongman") +
        (player.statuses ?? [])
          .filter((status) => status.id === "stamina")
          .reduce((total, status) => total + status.power, 0)) *
        characterAttackMultiplier(player),
    ),
  );

export const getPlayerDefense = (player: Player) =>
  player.baseDefense +
  characterDefenseBonus(player) +
  itemBonus(player, "defense") +
  (player.statuses ?? [])
    .filter(
      (status) =>
        status.id === "earthenArmor" ||
        status.id === "challenge",
    )
    .reduce((total, status) => total + status.power, 0);

export const getPlayerAccuracy = (player: Player) =>
  (player.accuracy ?? 10) +
  characterAccuracyBonus(player) +
  augmentRank(player, "preciseAssault") * 2;

export const getPlayerEvasion = (player: Player) =>
  (player.evasion ?? 5) +
  characterEvasionBonus(player) +
  augmentRank(player, "liquidAgility") * 2 +
  ((player.statuses ?? []).some((status) => status.id === "haste") ? 3 : 0);

export const getPlayerViewDistance = (player: Player) =>
  (player.viewDistance ?? 7) +
  characterViewBonus(player) +
  augmentRank(player, "farsight");

const updatePlayerFieldOfView = (state: GameState, revealAll = false) => {
  updateFieldOfView(
    state.tiles,
    state.player,
    getPlayerViewDistance(state.player),
    revealAll,
  );
  if (!revealAll) {
    (state.companions ?? [])
      .filter((companion) => companion.hp > 0)
      .forEach((companion) =>
        updateFieldOfView(
          state.tiles,
          companion,
          getCompanionViewDistance(companion),
          false,
          false,
        ),
      );
  }
};

export const getEnemyLabel = (enemy: Enemy) => ENEMY_SPRITES[enemy.kind].label;

const combatHit = (
  state: GameState,
  accuracy: number,
  evasion: number,
  surprise: boolean,
) =>
  surprise ||
  random(state) * Math.max(0, accuracy) >=
    random(state) * Math.max(0, evasion);

const directionFromDelta = (dx: number, dy: number): Direction => {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
};

const openCellCandidates = (state: GameState) => {
  const occupied = new Set([
    mapPointKey(state.player),
    ...(state.companions ?? []).map(mapPointKey),
    ...state.enemies.map(mapPointKey),
    ...state.groundItems.map(mapPointKey),
    ...state.objects.filter((object) => !object.looted).map(mapPointKey),
    ...(state.traps ?? []).map(mapPointKey),
  ]);
  return state.tiles.flatMap((row, y) =>
    row.flatMap((tile, x) => {
      const point = { x, y };
      return isWalkable(tile.terrain, false) &&
        tile.terrain !== "door" &&
        tile.terrain !== "openDoor" &&
        tile.terrain !== "entrance" &&
        tile.terrain !== "exit" &&
        !(state.specialRooms ?? []).some(
          (room) =>
            x >= room.left &&
            x <= room.right &&
            y >= room.top &&
            y <= room.bottom,
        ) &&
        !occupied.has(mapPointKey(point))
        ? [point]
        : [];
    }),
  );
};

const chooseAndRemove = (state: GameState, points: Point[]) => {
  if (!points.length) return null;
  const index = randomInt(state, 0, points.length - 1);
  return points.splice(index, 1)[0];
};

const enemyPoolForFloor = (floor: number): EnemyKind[] => {
  if (floor <= 1) return ["rat", "rat", "rat", "gnoll", "snake"];
  if (floor === 2) return ["rat", "gnoll", "gnoll", "snake", "slime"];
  if (floor === 3) return ["gnoll", "snake", "slime", "slime", "crab"];
  if (floor === 4) return ["slime", "crab", "crab", "skeleton"];
  return ["crab", "skeleton", "skeleton", "slime"];
};

export const scaledEnemyStats = (
  kind: EnemyKind,
  floor: number,
  difficultyScale: number,
) => {
  const base = ENEMY_STATS[kind];
  const floorScale = 1 + Math.max(0, floor - 1) * 0.2;
  const scale = floorScale * Math.max(1, difficultyScale || 1);
  const scaled = (value: number) =>
    Math.max(1, Math.round(Math.max(1, value) * scale));
  return {
    hp: scaled(base.hp),
    attack: scaled(base.attack),
    defense: scaled(base.defense),
    accuracy: scaled(base.accuracy),
    evasion: scaled(base.evasion),
    xp: scaled(base.xp),
  };
};

const lootPoolForFloor = (
  floor: number,
  categories: readonly ItemCategory[],
  excludedIds: ReadonlySet<string> = new Set(),
) => {
  const categorySet = new Set<ItemCategory>(categories);
  const available = FLOOR_LOOT.filter(
    (itemId) =>
      categorySet.has(ITEM_DEFS[itemId]?.category) &&
      !excludedIds.has(itemId) &&
      (ITEM_DEFS[itemId]?.minFloor ?? 1) <= floor,
  );
  return available;
};

const randomLootId = (
  state: GameState,
  categories: readonly ItemCategory[],
  excludedIds?: ReadonlySet<string>,
) => {
  const pool = lootPoolForFloor(state.floor, categories, excludedIds);
  if (!pool.length) {
    throw new Error(
      `No floor loot is available for categories: ${categories.join(", ")}`,
    );
  }
  return pool[randomInt(state, 0, pool.length - 1)];
};

const spawnedGroundQuantity = (defId: string) =>
  ITEM_DEFS[defId]?.category === "missile" ? 3 : 1;

const plannedDungeonScrollFloors = (state: GameState) => {
  const depth = Math.max(1, state.maxFloor);
  const mixed = Math.imul(
    (state.seed ^ 0x6d2b79f5) >>> 0,
    0x9e3779b1,
  ) >>> 0;
  const budget = 1 + ((mixed >>> 9) & 1);
  const first = 1 + (mixed % depth);
  if (budget === 1) return [first];
  let second =
    1 + (((mixed ^ 0x85ebca6b) + Math.imul(state.seed, 33)) >>> 0) % depth;
  if (depth > 1 && second === first) second = (second % depth) + 1;
  return [first, second];
};

export const plannedDungeonScrollCount = (state: GameState) =>
  state.lootPlan?.length
    ? state.lootPlan.filter(
        (entry) => ITEM_DEFS[entry.defId]?.category === "scroll",
      ).length
    : plannedDungeonScrollFloors(state).length;

const plannedFloorScrollCount = (state: GameState) =>
  plannedDungeonScrollFloors(state).filter((floor) => floor === state.floor)
    .length;

const populateFloor = (
  state: GameState,
  keyPoint: Point,
  alchemyPoint: Point,
  specialRewards: readonly SpecialRewardSlot[] = [],
  toxicGasTiles: readonly Point[] = [],
) => {
  const flattenOccupiedGrass = (point: Point) => {
    if (state.tiles[point.y][point.x].terrain === "highGrass") {
      state.tiles[point.y][point.x].terrain = "grass";
    }
  };
  const candidates = openCellCandidates(state).filter(
    (point) =>
      distance(point, state.player) > 3 &&
      mapPointKey(point) !== mapPointKey(keyPoint),
  );

  state.groundItems.push({
    id: `key-${state.floor}-${state.seed}`,
    defId: "iron_key",
    ...keyPoint,
  });
  flattenOccupiedGrass(keyPoint);

  state.objects.push({
    id: `alchemy-${state.floor}-${state.seed}`,
    kind: "alchemy",
    looted: false,
    loot: [],
    ...alchemyPoint,
  });
  const alchemyCandidateIndex = candidates.findIndex(
    (point) => mapPointKey(point) === mapPointKey(alchemyPoint),
  );
  if (alchemyCandidateIndex >= 0) candidates.splice(alchemyCandidateIndex, 1);
  flattenOccupiedGrass(alchemyPoint);

  let lootIndex = 0;
  const spawnGroundLoot = (
    defId: string,
    planned?: GameState["lootPlan"][number],
  ) => {
    const point = chooseAndRemove(state, candidates);
    if (!point) return false;
    state.groundItems.push({
      id: planned?.id ?? `loot-${state.floor}-${lootIndex}-${state.rng}`,
      defId,
      quantity: planned?.quantity ?? spawnedGroundQuantity(defId),
      instance: planned?.instance
        ? cloneInventoryInstance(planned.instance)
        : undefined,
      lootOrigin: "dungeon",
      dungeonLootId: planned?.id,
      ...point,
    });
    lootIndex += 1;
    flattenOccupiedGrass(point);
    return true;
  };

  // Required special-room solutions are placed before ordinary random loot,
  // using only normal, reachable cells outside every special room.
  for (const requirement of state.requiredFloorSpawns ?? []) {
    const reachableCandidates = candidates.filter(
      (point) =>
        findPath(state.tiles, state.player, point, new Set(), false).length > 0,
    );
    const point = chooseAndRemove(state, reachableCandidates);
    if (!point) {
      throw new Error(`Unable to place required floor item: ${requirement.defId}`);
    }
    const candidateIndex = candidates.findIndex(
      (candidate) => mapPointKey(candidate) === mapPointKey(point),
    );
    if (candidateIndex >= 0) candidates.splice(candidateIndex, 1);
    state.groundItems.push({
      id: requirement.id,
      defId: requirement.defId,
      quantity: spawnedGroundQuantity(requirement.defId),
      lootOrigin: "dungeon",
      ...point,
    });
    flattenOccupiedGrass(point);
  }

  specialRewards.forEach((slot) => {
    const excluded = new Set<string>();
    let defId = randomLootId(state, slot.categories, excluded);
    if (slot.tier >= 2) {
      const rolls = Array.from({ length: slot.tier }, () =>
        randomLootId(state, slot.categories, excluded),
      );
      defId = rolls.sort(
        (first, second) =>
          (ITEM_DEFS[second]?.minFloor ?? 1) -
          (ITEM_DEFS[first]?.minFloor ?? 1),
      )[0] ?? defId;
    }
    if (slot.source === "object") {
      state.objects.push({
        id: slot.id,
        kind: slot.objectKind ?? "chest",
        looted: false,
        loot: [defId],
        lootOrigins: ["dungeon"],
        ...slot.point,
      });
    } else {
      state.groundItems.push({
        id: slot.id,
        defId,
        quantity: spawnedGroundQuantity(defId),
        lootOrigin: "dungeon",
        ...slot.point,
      });
    }
  });

  if (toxicGasTiles.length > 0) {
    state.clouds.push({
      id: `special-toxic-${state.floor}-${state.seed}`,
      kind: "toxic",
      origin: { ...toxicGasTiles[0] },
      tiles: toxicGasTiles.map((point) => ({
        ...point,
        remaining: 999,
        intensity: 1,
      })),
      maxRadius: 0,
      spreadPerTurn: 0,
      tileLifetime: 999,
      turns: 999,
      power: 2,
    });
  }
  const floorLootPlan = (state.lootPlan ?? []).filter(
    (entry) => entry.floor === state.floor,
  );
  const floorGoldPlan = (state.goldPlan ?? []).filter(
    (entry) => entry.floor === state.floor,
  );
  const plannedEnemyDrops = floorLootPlan.filter(
    (entry) => entry.source === "enemy",
  );
  if (state.lootPlan?.length) {
    floorLootPlan
      .filter((entry) => entry.source === "ground")
      .forEach((entry) => spawnGroundLoot(entry.defId, entry));
    floorLootPlan
      .filter((entry) => entry.source === "object")
      .forEach((entry, objectIndex) => {
        const point = chooseAndRemove(state, candidates);
        if (!point) return;
        state.objects.push({
          id: `object-${state.floor}-${objectIndex}-${entry.id}`,
          kind: entry.objectKind ?? "chest",
          looted: false,
          loot: [entry.defId],
          lootInstances: [
            entry.instance ? cloneInventoryInstance(entry.instance) : null,
          ],
          lootOrigins: ["dungeon"],
          lootPlanEntryIds: [entry.id],
          ...point,
        });
        flattenOccupiedGrass(point);
      });
  } else {
    type PlannedFloorReward =
      | { kind: "ground"; defId: string; priority: number }
      | {
          kind: "object";
          defId: string;
          objectKind: "chest" | "tomb" | "crystalChest";
          priority: number;
        };
    const plannedRewards: PlannedFloorReward[] = [];
    const potionCount = randomInt(state, 1, 3);
    plannedRewards.push({
      kind: "ground",
      defId: "potion_healing",
      priority: 1,
    });
    const healingPotion = new Set(["potion_healing"]);
    for (let index = 1; index < potionCount; index += 1) {
      plannedRewards.push({
        kind: "ground",
        defId: randomLootId(state, ["potion"], healingPotion),
        priority: 0,
      });
    }
    const featuredScrolls = (state.mainDropIds ?? []).filter(
      (itemId) => ITEM_DEFS[itemId]?.category === "scroll",
    );
    const spawnedScrolls = new Set<string>();
    for (let index = 0; index < plannedFloorScrollCount(state); index += 1) {
      const featured = featuredScrolls[index];
      const defId =
        featured && !spawnedScrolls.has(featured)
          ? featured
          : randomLootId(state, ["scroll"], spawnedScrolls);
      if (spawnGroundLoot(defId)) spawnedScrolls.add(defId);
    }
    const equipmentCount = randomInt(state, 0, 1);
    for (let index = 0; index < equipmentCount; index += 1) {
      plannedRewards.push({
        kind: "ground",
        defId: randomLootId(state, FLOOR_EQUIPMENT_CATEGORIES),
        priority: 0,
      });
    }
    const mainDropPool = (state.mainDropIds ?? []).filter(
      (itemId) =>
        Boolean(ITEM_DEFS[itemId]) && ITEM_DEFS[itemId].category !== "scroll",
    );
    if (mainDropPool.length > 0 && random(state) < 0.72) {
      plannedRewards.push({
        kind: "ground",
        defId: mainDropPool[randomInt(state, 0, mainDropPool.length - 1)],
        priority: 2,
      });
    }
    const objectCount = randomInt(state, 1, 2);
    for (let index = 0; index < objectCount; index += 1) {
      const roll = random(state);
      const objectKind =
        roll < 0.58 ? "chest" : roll < 0.82 ? "tomb" : "crystalChest";
      plannedRewards.push({
        kind: "object",
        defId: randomLootId(state, FLOOR_EQUIPMENT_CATEGORIES),
        objectKind,
        priority: 0,
      });
    }
    const rewardCount = Math.max(1, Math.round(plannedRewards.length / 3));
    const selectedRewards = plannedRewards
      .map((reward) => ({ reward, tieBreaker: random(state) }))
      .sort(
        (a, b) =>
          b.reward.priority - a.reward.priority ||
          a.tieBreaker - b.tieBreaker,
      )
      .slice(0, rewardCount)
      .map(({ reward }) => reward);
    let objectIndex = 0;
    selectedRewards.forEach((reward) => {
      if (reward.kind === "ground") {
        spawnGroundLoot(reward.defId);
        return;
      }
      const point = chooseAndRemove(state, candidates);
      if (!point) return;
      state.objects.push({
        id: `object-${state.floor}-${objectIndex}-${state.rng}`,
        kind: reward.objectKind,
        looted: false,
        loot: [reward.defId],
        lootOrigins: ["dungeon"],
        ...point,
      });
      objectIndex += 1;
      flattenOccupiedGrass(point);
    });
  }

  floorGoldPlan
    .filter((entry) => entry.source === "ground")
    .forEach((entry) => {
      const point = chooseAndRemove(state, candidates);
      if (!point) return;
      state.groundItems.push({
        id: entry.id,
        defId: "gold",
        quantity: entry.amount,
        lootOrigin: "dungeon",
        dungeonLootId: entry.id,
        ...point,
      });
      flattenOccupiedGrass(point);
    });

  const pool = enemyPoolForFloor(state.floor);
  const difficultyScale = Math.max(1, state.difficultyScale ?? 1);
  const difficultyBonus = Math.max(0, (state.difficulty - 1) * 2);
  // Larger floors support real encounter groups instead of isolated enemies.
  // Floor one now begins at 22 enemies (previously 9) and later floors scale
  // up without overwhelming the expanded walkable-cell pool.
  const enemyCount = Math.min(18 + state.floor * 4 + difficultyBonus, 52);
  const enemyCells = candidates.filter(
    (point) =>
      distance(point, state.player) > 6 &&
      state.tiles[point.y][point.x].terrain !== "water",
  );
  const firstSpawnedEnemyIndex = state.enemies.length;

  for (let index = 0; index < enemyCount; index += 1) {
    const point = chooseAndRemove(state, enemyCells);
    if (!point) break;
    const kind = pool[randomInt(state, 0, pool.length - 1)];
    const stats = scaledEnemyStats(kind, state.floor, difficultyScale);
    const plannedDrop = plannedEnemyDrops[index];
    state.enemies.push({
      id: `enemy-${state.floor}-${index}-${state.rng}`,
      kind,
      hp: stats.hp,
      maxHp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      accuracy: stats.accuracy,
      evasion: stats.evasion,
      xp: stats.xp,
      alerted: false,
      sawPlayerLastTurn: false,
      sleeping: true,
      wakeCooldown: 0,
      lastSeenPlayer: null,
      searchTurns: 0,
      statuses: [],
      drop: plannedDrop
        ? {
            id: plannedDrop.id,
            defId: plannedDrop.defId,
            quantity: plannedDrop.quantity,
            instance: plannedDrop.instance
              ? cloneInventoryInstance(plannedDrop.instance)
              : undefined,
            lootOrigin: "dungeon",
          }
        : state.lootPlan?.length
          ? null
          : undefined,
      ...point,
    });
    flattenOccupiedGrass(point);
  }

  const spawnedEnemies = state.enemies.slice(firstSpawnedEnemyIndex);
  const unassignedGoldEnemies = [...spawnedEnemies];
  floorGoldPlan
    .filter((entry) => entry.source === "enemy")
    .forEach((entry) => {
      const candidatesForDrop = unassignedGoldEnemies.length
        ? unassignedGoldEnemies
        : spawnedEnemies;
      if (!candidatesForDrop.length) return;
      const targetIndex = randomInt(state, 0, candidatesForDrop.length - 1);
      const [target] = unassignedGoldEnemies.length
        ? unassignedGoldEnemies.splice(targetIndex, 1)
        : [candidatesForDrop[targetIndex]];
      target.goldDrop = (target.goldDrop ?? 0) + entry.amount;
    });
};

const makePlayer = (point: Point): Player => {
  const adventurer = createCompanion("adventurer", point, 0);
  return {
  ...point,
  companionId: adventurer.id,
  name: adventurer.name,
  classId: adventurer.classId,
  professionId: adventurer.professionId,
  traits: [...adventurer.traits],
  skills: [...adventurer.skills],
  skillCooldowns: {},
  hp: adventurer.hp,
  maxHp: adventurer.maxHp,
  level: adventurer.level,
  xp: adventurer.xp,
  nextXp: adventurer.nextXp,
  baseAttack: adventurer.baseAttack,
  baseDefense: adventurer.baseDefense,
  accuracy: adventurer.accuracy,
  evasion: adventurer.evasion,
  viewDistance: adventurer.viewDistance,
  inventory: {
    potion_healing: 1,
  },
  inventoryInstances: [],
  inventorySlots: [
    "potion_healing",
    ...Array.from({ length: MAX_INVENTORY_SLOTS - 1 }, () => null),
  ],
  throwableProfiles: {},
  equipment: {
    weapon: "rusty_sword",
    armor: "cloth_armor",
    ring: null,
    ring2: null,
    ring3: null,
    ring4: null,
  },
  equipmentInstances: {
    weapon: createPlainEquipmentInstance(
      ITEM_DEFS.rusty_sword,
      "equipped-starter-rusty-sword",
    ),
    armor: createPlainEquipmentInstance(
      ITEM_DEFS.cloth_armor,
      "equipped-starter-cloth-armor",
    ),
    ring: null,
    ring2: null,
    ring3: null,
    ring4: null,
  },
  invisibleTurns: 0,
  statuses: [],
  shield: 0,
  autoSlots: [null, null, null, null],
  wandCharges: {},
  augments: {},
  natureAidCooldown: 0,
  facing: "down",
  actionProgress: 0,
  hunger: 100,
  hungerTurns: 0,
  recoveryProgress: 0,
  };
};

const companionSpawnPoints = (
  tiles: GameState["tiles"],
  origin: Point,
  count: number,
) => {
  const candidates: Point[] = [];
  const maximumRadius = Math.max(4, count + 1);
  for (let radius = 1; radius <= maximumRadius; radius += 1) {
    for (let y = origin.y - radius; y <= origin.y + radius; y += 1) {
      for (let x = origin.x - radius; x <= origin.x + radius; x += 1) {
        if (
          Math.max(Math.abs(x - origin.x), Math.abs(y - origin.y)) !== radius ||
          !tiles[y]?.[x] ||
          !isWalkable(tiles[y][x].terrain, false) ||
          ["door", "openDoor", "lockedDoor", "exit"].includes(
            tiles[y][x].terrain,
          )
        ) {
          continue;
        }
        candidates.push({ x, y });
      }
    }
    if (candidates.length >= count) break;
  }
  return candidates.slice(0, count);
};

const cloneCompanionForFloor = (
  companion: Companion,
  point: Point,
): Companion => ({
  ...companion,
  ...point,
  professionId: normalizeCompanionProfession(
    companion.classId,
    companion.professionId,
  ),
  traits: [...(companion.traits ?? [])],
  skills: normalizeCompanionSkills(
    normalizeCompanionProfession(
      companion.classId,
      companion.professionId,
    ),
    companion.id,
    companion.skills,
  ),
  skillCooldowns: normalizeSkillCooldowns(companion.skillCooldowns),
  statuses: (companion.statuses ?? []).map((status) => ({ ...status })),
  hp: Math.min(companion.maxHp, companion.hp + 4),
  facing: "down",
  equipment: {
    ...companion.equipment,
    ring2: companion.equipment.ring2 ?? null,
    ring3: companion.equipment.ring3 ?? null,
    ring4: companion.equipment.ring4 ?? null,
  },
  equipmentInstances: {
    weapon: cloneCompanionInstance(companion.equipmentInstances.weapon),
    armor: cloneCompanionInstance(companion.equipmentInstances.armor),
    ring: cloneCompanionInstance(companion.equipmentInstances.ring),
    ring2: cloneCompanionInstance(companion.equipmentInstances.ring2),
    ring3: cloneCompanionInstance(companion.equipmentInstances.ring3),
    ring4: cloneCompanionInstance(companion.equipmentInstances.ring4),
  },
  autoSlots: RING_EQUIPMENT_KEYS.map((_, index) => {
    const slot = companion.autoSlots[index];
    return slot
      ? {
          ...slot,
          instance: cloneCompanionInstance(slot.instance),
        }
      : null;
  }) as Companion["autoSlots"],
  command: "follow",
  priorityTarget: null,
  exploreTarget: null,
  commandTargetId: null,
  actionCooldown: 0,
  recoveryProgress: companion.recoveryProgress ?? 0,
});

const makeFloorState = (
  seed: number,
  floor: number,
  turn: number,
  carriedPlayer?: Player,
  carriedCompanions?: Companion[],
  expeditionRules: ExpeditionRules = DEFAULT_EXPEDITION_RULES,
  forcedRoomPresets: readonly P0RoomPreset[] = [],
  forcedSpecialPreset?: SpecialRoomPreset,
) => {
  const generated = generateFloor(
    seed ^ Math.imul(floor, 0x9e3779b1),
    0,
    floorFeelingFor(seed, floor),
    forcedRoomPresets,
    forcedSpecialPreset,
    floor,
  );
  const player = carriedPlayer
    ? {
        ...carriedPlayer,
        ...generated.start,
        professionId: normalizeCompanionProfession(
          carriedPlayer.classId,
          carriedPlayer.professionId,
        ),
        traits: [...(carriedPlayer.traits ?? [])],
        skills: normalizeCompanionSkills(
          normalizeCompanionProfession(
            carriedPlayer.classId,
            carriedPlayer.professionId,
          ),
          carriedPlayer.companionId,
          carriedPlayer.skills,
        ),
        skillCooldowns: normalizeSkillCooldowns(
          carriedPlayer.skillCooldowns,
        ),
        hp: Math.min(carriedPlayer.maxHp, carriedPlayer.hp + 4),
        invisibleTurns: 0,
        statuses: (carriedPlayer.statuses ?? []).map((status) => ({ ...status })),
        shield: 0,
        wandCharges: { ...(carriedPlayer.wandCharges ?? {}) },
        inventoryInstances: (carriedPlayer.inventoryInstances ?? []).map(
          cloneInventoryInstance,
        ),
        throwableProfiles: Object.fromEntries(
          Object.entries(carriedPlayer.throwableProfiles ?? {}).map(
            ([defId, instance]) => [defId, cloneInventoryInstance(instance)],
          ),
        ),
        autoSlots: [
          ...(carriedPlayer.autoSlots ?? [null, null, null, null]),
        ].slice(0, 4) as Player["autoSlots"],
        facing: "down" as Direction,
        inventory: { ...carriedPlayer.inventory },
        equipment: {
          ...carriedPlayer.equipment,
          ring2: carriedPlayer.equipment.ring2 ?? null,
          ring3: carriedPlayer.equipment.ring3 ?? null,
          ring4: carriedPlayer.equipment.ring4 ?? null,
        },
        equipmentInstances: {
          weapon: carriedPlayer.equipmentInstances?.weapon
            ? cloneInventoryInstance(carriedPlayer.equipmentInstances.weapon)
            : null,
          armor: carriedPlayer.equipmentInstances?.armor
            ? cloneInventoryInstance(carriedPlayer.equipmentInstances.armor)
            : null,
          ring: carriedPlayer.equipmentInstances?.ring
            ? cloneInventoryInstance(carriedPlayer.equipmentInstances.ring)
            : null,
          ring2: carriedPlayer.equipmentInstances?.ring2
            ? cloneInventoryInstance(carriedPlayer.equipmentInstances.ring2)
            : null,
          ring3: carriedPlayer.equipmentInstances?.ring3
            ? cloneInventoryInstance(carriedPlayer.equipmentInstances.ring3)
            : null,
          ring4: carriedPlayer.equipmentInstances?.ring4
            ? cloneInventoryInstance(carriedPlayer.equipmentInstances.ring4)
            : null,
        },
        augments: { ...carriedPlayer.augments },
        actionProgress: carriedPlayer.actionProgress ?? 0,
        hunger: carriedPlayer.hunger ?? 100,
        hungerTurns: carriedPlayer.hungerTurns ?? 0,
        recoveryProgress: carriedPlayer.recoveryProgress ?? 0,
      }
    : makePlayer(generated.start);
  // Both dungeon key types are scoped to a floor. Ordinary keys are replaced
  // by the next floor's lock plan; crystal keys must never survive a reload or
  // descent to unlock an extra reward door.
  delete player.inventory.iron_key;
  delete player.inventory.crystal_key;

  const rosterClasses: CompanionClassId[] = carriedCompanions !== undefined
    ? carriedCompanions.map((companion) => companion.classId)
    : ["warrior", "huntress"];
  const spawnPoints = companionSpawnPoints(
    generated.tiles,
    generated.start,
    rosterClasses.length,
  );
  const companions = rosterClasses.flatMap((classId, index) => {
    const point = spawnPoints[index];
    if (!point) return [];
    const carried = carriedCompanions?.[index];
    return [
      carried
        ? cloneCompanionForFloor(carried, point)
        : createCompanion(classId, point, index),
    ];
  });

  const state: GameState = {
    width: generated.width,
    height: generated.height,
    tiles: generated.tiles,
    player,
    companions,
    companionTrail: [],
    enemies: [],
    groundItems: [],
    objects: [],
    clouds: [],
    wards: [],
    traps: generated.traps.map((trap) => ({ ...trap })),
    specialRooms: generated.specialRooms.map((room) => ({ ...room })),
    requiredFloorSpawns: generated.requiredFloorSpawns.map((spawn) => ({ ...spawn })),
    floor,
    dungeonId: expeditionRules.dungeonId,
    dungeonName: expeditionRules.dungeonName,
    maxFloor: expeditionRules.maxFloor,
    difficultyScale: expeditionRules.difficultyScale,
    difficulty: Math.max(1, Math.min(7, expeditionRules.difficulty ?? 1)),
    mainDropIds: [...expeditionRules.mainDropIds],
    lootPlan: (expeditionRules.lootPlan ?? []).map((entry) => ({
      ...entry,
      instance: entry.instance
        ? cloneInventoryInstance(entry.instance)
        : undefined,
    })),
    goldPlan: (expeditionRules.goldPlan ?? []).map((entry) => ({ ...entry })),
    goldCollected: 0,
    turn,
    seed,
    rng: generated.rng,
    logs: [],
    gameOver: false,
    pendingAugmentOffers: [],
    equipmentOffers: [],
  };

  if (carriedCompanions === undefined) {
    const starterWeapons = ["rusty_sword", "shortsword", "spear"];
    const starterArmors = ["cloth_armor", "leather_armor"];
    companions.forEach((companion, index) => {
      const weaponId =
        starterWeapons[randomInt(state, 0, starterWeapons.length - 1)];
      const armorId =
        starterArmors[randomInt(state, 0, starterArmors.length - 1)];
      companion.equipment.weapon = weaponId;
      companion.equipment.armor = armorId;
      companion.equipmentInstances.weapon = createEquipmentInstance(
        ITEM_DEFS[weaponId],
        `companion-starter-${index}-weapon-${state.rng}`,
        () => random(state),
        { allowCurse: false },
      );
      companion.equipmentInstances.armor = createEquipmentInstance(
        ITEM_DEFS[armorId],
        `companion-starter-${index}-armor-${state.rng}`,
        () => random(state),
        { allowCurse: false },
      );
    });
  }

  populateFloor(
    state,
    generated.keyPoint,
    generated.alchemyPoint,
    generated.specialRewards,
    generated.toxicGasTiles,
  );
  updatePlayerFieldOfView(state);
  return state;
};

export function createNewGame(seed: number): GameState {
  const state = makeFloorState(
    seed,
    1,
    1,
    undefined,
    undefined,
    DEFAULT_EXPEDITION_RULES,
  );
  state.logs = [
    "차가운 돌계단 아래에서 희미한 물소리가 들립니다.",
    "행동 시간이 1.0 누적될 때마다 적의 턴이 진행됩니다.",
    "잠긴 문을 열려면 같은 층의 쇠열쇠가 필요합니다.",
  ];
  return state;
}

export function createExpeditionGame(
  seed: number,
  rules: ExpeditionRules,
  player: Player,
  companions: Companion[],
  forcedRoomPresets: readonly P0RoomPreset[] = [],
  forcedSpecialPreset?: SpecialRoomPreset,
): GameState {
  const state = makeFloorState(
    seed,
    1,
    1,
    player,
    companions,
    rules,
    forcedRoomPresets,
    forcedSpecialPreset,
  );
  state.pendingAugmentOffers = [];
  state.player.augments = {};
  state.logs = [
    `${rules.dungeonName} 원정을 시작했습니다.`,
    `목표는 지하 ${rules.maxFloor}층의 출구입니다.`,
    "탐사 종료 버튼으로 언제든 확보한 전리품과 함께 귀환할 수 있습니다.",
  ];
  if (forcedSpecialPreset && (state.requiredFloorSpawns?.length ?? 0) > 0) {
    state.logs.push(
      `[개발자] ${forcedSpecialPreset}: ${(state.requiredFloorSpawns ?? [])
        .map((spawn) => ITEM_DEFS[spawn.defId]?.name ?? spawn.defId)
        .join(", ")} 층내 보장`,
    );
  }
  return state;
}

export function descendFloor(state: GameState): GameState {
  const next = makeFloorState(
    state.seed,
    state.floor + 1,
    state.turn,
    state.player,
    state.companions ?? [],
    {
      dungeonId: state.dungeonId,
      dungeonName: state.dungeonName,
      maxFloor: state.maxFloor,
      difficultyScale: state.difficultyScale,
      difficulty: state.difficulty,
      mainDropIds: [...state.mainDropIds],
      lootPlan: state.lootPlan,
      goldPlan: state.goldPlan,
    },
  );
  next.goldCollected = state.goldCollected;
  next.pendingAugmentOffers = [];
  next.equipmentOffers = (state.equipmentOffers ?? [])
    .filter((offer) => offer.expiresTurn > state.turn)
    .map((offer) => ({ ...offer }));
  next.logs = [
    ...state.logs.slice(-5),
    `지하 ${next.floor}층으로 내려왔습니다. 더 위험한 기척이 느껴집니다.`,
  ];
  return next;
}

export function advanceExpeditionFloor(state: GameState):
  | { kind: "completed"; state: GameState }
  | { kind: "descended"; state: GameState } {
  if (state.floor >= state.maxFloor) {
    return { kind: "completed", state };
  }
  return { kind: "descended", state: descendFloor(state) };
}

type ProgressingCharacter = Pick<
  Player | Companion,
  "name" | "level" | "xp" | "nextXp" | "hp" | "maxHp" | "baseAttack"
>;

const growLevelStat = (value: number) =>
  Math.round(value * LEVEL_STAT_GROWTH * 1_000_000) / 1_000_000;

const gainCharacterXp = (
  state: GameState,
  character: ProgressingCharacter,
  amount: number,
) => {
  if (character.level >= MAX_PLAYER_LEVEL) {
    character.xp = 0;
    character.nextXp = 0;
    return;
  }
  character.xp += Math.max(0, amount);
  while (
    character.level < MAX_PLAYER_LEVEL &&
    character.xp >= character.nextXp
  ) {
    character.xp -= character.nextXp;
    character.level += 1;
    character.baseAttack = growLevelStat(character.baseAttack);
    character.maxHp = Math.max(
      character.maxHp + 1,
      Math.round(character.maxHp * LEVEL_STAT_GROWTH),
    );
    character.hp = Math.min(character.hp, character.maxHp);
    character.nextXp = experienceForNextLevel(character.level);
    pushLog(
      state,
      `${character.name} 레벨 ${character.level}!`,
    );
  }
  if (character.level >= MAX_PLAYER_LEVEL) {
    character.level = MAX_PLAYER_LEVEL;
    character.xp = 0;
    character.nextXp = 0;
  }
};

const gainXp = (state: GameState, amount: number) => {
  gainCharacterXp(state, state.player, amount);
  (state.companions ?? [])
    .filter((companion) => companion.hp > 0)
    .forEach((companion) => gainCharacterXp(state, companion, amount));
};

const ensureEquippedInstance = (
  state: GameState,
  key: EquipmentKey,
) => {
  const defId = state.player.equipment[key];
  if (!defId) return null;
  const existing = state.player.equipmentInstances?.[key] ?? null;
  if (existing) return existing;
  const created = createPlainEquipmentInstance(
    ITEM_DEFS[defId],
    `equipped-${defId}-${state.turn}-${key}`,
  );
  state.player.equipmentInstances[key] = created;
  return created;
};

const enchantEquippedDirect = (
  state: GameState,
  key: EquipmentKey,
  preferred?: EquipmentTraitId,
  upgrade = false,
) => {
  const defId = state.player.equipment[key];
  const instance = ensureEquippedInstance(state, key);
  if (!defId || !instance) return null;
  if (upgrade) upgradeEquipmentInstance(instance);
  const traitId = enchantEquipmentInstance(
    instance,
    ITEM_DEFS[defId],
    () => random(state),
    preferred,
  );
  return {
    definition: ITEM_DEFS[defId],
    instance,
    traitId,
  };
};

export function chooseAugment(state: GameState, id: AugmentId): GameState {
  if (!AUGMENTS_ENABLED) return state;
  const offer = state.pendingAugmentOffers[0];
  if (!offer?.includes(id)) return state;
  const definition = AUGMENT_DEFS[id];
  const rank = augmentRank(state.player, id);
  if (rank >= definition.maxRank) return state;
  const next = cloneGame(state);
  next.player.augments[id] = rank + 1;
  next.pendingAugmentOffers.shift();
  next.pendingAugmentOffers = next.pendingAugmentOffers.map((queuedOffer) => {
    const queuedGrade = queuedOffer[0]
      ? AUGMENT_DEFS[queuedOffer[0]].grade
      : null;
    const valid = queuedOffer.filter(
      (queuedId, index) =>
        queuedOffer.indexOf(queuedId) === index &&
        (!queuedGrade || AUGMENT_DEFS[queuedId].grade === queuedGrade) &&
        augmentRank(next.player, queuedId) < AUGMENT_DEFS[queuedId].maxRank,
    );
    for (const candidate of AUGMENT_IDS) {
      if (valid.length >= 3) break;
      if (
        !valid.includes(candidate) &&
        (!queuedGrade || AUGMENT_DEFS[candidate].grade === queuedGrade) &&
        augmentRank(next.player, candidate) < AUGMENT_DEFS[candidate].maxRank
      ) {
        valid.push(candidate);
      }
    }
    return valid;
  }).filter((queuedOffer) => queuedOffer.length > 0);
  if (id === "ironWill") {
    next.player.maxHp += 4;
    next.player.hp = Math.min(next.player.maxHp, next.player.hp + 4);
  }
  if (id === "weaponInfusion") {
    enchantEquippedDirect(next, "weapon", "keen");
  } else if (id === "armorInfusion") {
    enchantEquippedDirect(next, "armor", "guarded");
  } else if (id === "ringResonance") {
    const rings = RING_EQUIPMENT_KEYS.filter(
      (key) => next.player.equipment[key],
    );
    const target = rings[Math.floor(random(next) * rings.length)];
    if (target) {
      enchantEquippedDirect(
        next,
        target,
        random(next) < 0.5 ? "focused" : "swift",
      );
    }
  } else if (id === "runicTemper") {
    const equipped = (Object.keys(next.player.equipment) as EquipmentKey[])
      .filter((key) => next.player.equipment[key]);
    const target = equipped[Math.floor(random(next) * equipped.length)];
    if (target) enchantEquippedDirect(next, target, undefined, true);
  } else if (id === "royalArmory") {
    (Object.keys(next.player.equipment) as EquipmentKey[])
      .filter((key) => next.player.equipment[key])
      .forEach((key) => {
        const preferred =
          key === "weapon"
            ? "keen"
            : key === "armor"
              ? "guarded"
              : "focused";
        enchantEquippedDirect(next, key, preferred);
      });
  }
  pushLog(next, `증강 · ${definition.name} ${rank + 1}단계를 선택했습니다.`);
  updatePlayerFieldOfView(next);
  return next;
}

const removeDefeatedEnemies = (
  state: GameState,
  effects: CombatEffect[],
  allowDrop = true,
  sourceId?: string,
) => {
  const defeated = state.enemies.filter((enemy) => enemy.hp <= 0);
  defeated.forEach((enemy) => {
    const resolvedSourceId =
      sourceId ??
      [...effects]
        .reverse()
        .find(
          (effect) =>
            effect.x === enemy.x &&
            effect.y === enemy.y &&
            (effect.kind === "damage" || effect.kind === "blocked"),
        )?.sourceId;
    gainXp(state, enemy.xp);
    const momentumHealing = Math.min(
      augmentRank(state.player, "lethalMomentum"),
      state.player.maxHp - state.player.hp,
    );
    if (momentumHealing > 0) {
      state.player.hp += momentumHealing;
      pushLog(state, `치명적 가속으로 생명력 ${momentumHealing}을 회복했습니다.`);
    }
    pushLog(state, `${getEnemyLabel(enemy)}을(를) 쓰러뜨렸습니다.`);
    effects.push({
      x: enemy.x,
      y: enemy.y,
      text: "처치!",
      color: "#ffd56a",
      kind: "defeat",
      sourceId: resolvedSourceId,
    });
    if ((enemy.goldDrop ?? 0) > 0) {
      state.groundItems.push({
        id: `gold-drop-${enemy.id}`,
        defId: "gold",
        quantity: enemy.goldDrop,
        lootOrigin: "dungeon",
        x: enemy.x,
        y: enemy.y,
      });
    }
    if (allowDrop && enemy.drop) {
      state.groundItems.push({
        id: `drop-${enemy.id}-${enemy.drop.id}`,
        defId: enemy.drop.defId,
        quantity: enemy.drop.quantity,
        instance: enemy.drop.instance
          ? cloneInventoryInstance(enemy.drop.instance)
          : undefined,
        lootOrigin: enemy.drop.lootOrigin,
        dungeonLootId: enemy.drop.id,
        x: enemy.x,
        y: enemy.y,
      });
    } else if (
      allowDrop &&
      enemy.drop === undefined &&
      !(state.lootPlan?.length) &&
      random(state) < ENEMY_DROP_CHANCE
    ) {
      const dropRoll = random(state);
      let accumulatedWeight = 0;
      const drop =
        ENEMY_DROP_TABLE.find(({ weight }) => {
          accumulatedWeight += weight;
          return dropRoll < accumulatedWeight;
        }) ?? ENEMY_DROP_TABLE[ENEMY_DROP_TABLE.length - 1];
      state.groundItems.push({
        id: `drop-${enemy.id}`,
        defId: drop.itemId,
        quantity: spawnedGroundQuantity(drop.itemId),
        lootOrigin: "dungeon",
        x: enemy.x,
        y: enemy.y,
      });
    }
  });
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  return defeated.map(({ id }) => id);
};

export const groundItemsAtPlayer = (state: GameState) =>
  state.groundItems.filter(
    (item) => item.x === state.player.x && item.y === state.player.y,
  );

export const hasNearbyEnemy = (state: GameState, radius = 4) =>
  state.enemies.some(
    (enemy) =>
      distance(enemy, state.player) <= radius &&
      state.tiles[enemy.y]?.[enemy.x]?.visible,
  );

export const shouldAutoPickup = (state: GameState, stoppedOnItem = true) =>
  stoppedOnItem &&
  groundItemsAtPlayer(state).some(
    (item) => !item.manualPickup && canPickupGroundItem(state, item),
  ) &&
  !hasNearbyEnemy(state);

export function pickupGroundItems(
  state: GameState,
  includeManual = true,
  autoEquipBetter = false,
): ActionResult {
  if (state.gameOver) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const found = groundItemsAtPlayer(state).filter(
    (item) => includeManual || !item.manualPickup,
  );
  if (!found.length) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }

  const next = cloneGameWithoutTiles(state);
  const presentationState = state;
  const picked = found.flatMap((item) => {
    if (item.defId === "gold") {
      const quantity = Math.max(0, Math.floor(item.quantity ?? 0));
      if (quantity <= 0) return [];
      next.goldCollected += quantity;
      pushLog(next, `골드 ${quantity.toLocaleString("ko-KR")}개를 주웠습니다.`);
      return [{ ...item, quantity, itemRef: item.id }];
    }
    const recoveredCharge =
      item.recoversThrowableCharge && item.recoversItemRef
      ? restoreThrowableCharge(next, item.recoversItemRef, item.quantity ?? 1)
      : 0;
    const itemRef = recoveredCharge > 0
      ? item.recoversItemRef ?? null
      : item.recoversThrowableCharge
        ? null
        : addInventoryItem(
            next,
            item.defId,
            item.id,
            item.instance,
            item.quantity ?? 1,
          );
    if (itemRef) {
      const quantity = recoveredCharge || item.quantity || 1;
      pushLog(
        next,
        recoveredCharge > 0
          ? `${ITEM_DEFS[item.defId].name}을(를) 회수해 충전 ${recoveredCharge}을(를) 회복했습니다.`
          : quantity > 1
          ? `${ITEM_DEFS[item.defId].name} ${quantity}개를 주웠습니다.`
          : `${ITEM_DEFS[item.defId].name}을(를) 주웠습니다.`,
      );
      if (
        autoEquipBetter &&
        ITEM_DEFS[item.defId]?.slot &&
        isBetterEquipment(next.player, item.defId, itemRef)
      ) {
        equipInventoryItemDirect(next, itemRef);
        pushLog(next, "자동탐사가 더 좋은 장비로 즉시 교체했습니다.");
      }
      return [{ ...item, itemRef }];
    }
    return [];
  });
  if (!picked.length) {
    pushLog(next, `가방이 가득 찼습니다. 최대 ${MAX_INVENTORY_SLOTS}칸입니다.`);
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  if (picked.length < found.length) {
    pushLog(next, "가방에 들어가지 않은 아이템은 바닥에 남겨두었습니다.");
  }
  const foundIds = new Set(picked.map((item) => item.id));
  next.groundItems = next.groundItems.filter(
    (item) => !foundIds.has(item.id),
  );
  const elapsedTurns = spendPlayerTime(next, 1);
  if (!autoEquipBetter) {
    picked.forEach(({ defId, itemRef }) => {
      if (defId !== "gold") queueEquipmentOffer(next, defId, itemRef);
    });
  }
  return {
    state: next,
    presentationState,
    motions: [],
    effects: [],
    pickups: picked.map(({
      id,
      defId,
      quantity,
      itemRef,
      lootOrigin,
      dungeonLootId,
      x,
      y,
    }) => ({
      id,
      defId,
      quantity: quantity ?? 1,
      itemRef,
      lootOrigin,
      dungeonLootId,
      x,
      y,
    })),
    consumedTurn: true,
    elapsedTurns,
    interacted: true,
    interactionKind: "pickup",
  };
}

export function playerStep(
  state: GameState,
  dx: number,
  dy: number,
  autoEquipBetter = false,
): ActionResult {
  if (state.gameOver) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const incapacitated = consumeIncapacitatedPlayerTurn(state);
  if (incapacitated) return incapacitated;
  if (hasStatus(state.player, "rooted") && (dx !== 0 || dy !== 0)) {
    const next = cloneGameWithoutTiles(state);
    pushLog(next, "뿌리에 붙잡혀 이동할 수 없습니다.");
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }

  const target = { x: state.player.x + dx, y: state.player.y + dy };
  const effects: CombatEffect[] = [];
  const motions: Motion[] = [];
  const facing = directionFromDelta(dx, dy);

  if (!inBounds(state, target)) {
    const next = cloneGameWithoutTiles(state);
    next.player.facing = facing;
    return { state: next, motions, effects, consumedTurn: false };
  }

  const targetEnemy = state.enemies.find(
    (candidate) => candidate.x === target.x && candidate.y === target.y,
  );
  const targetCompanion = (state.companions ?? []).find(
    (candidate) =>
      candidate.hp > 0 &&
      candidate.x === target.x &&
      candidate.y === target.y,
  );
  const targetObject = state.objects.find(
    (candidate) =>
      !candidate.looted &&
      candidate.x === target.x &&
      candidate.y === target.y,
  );
  const targetTerrain = state.tiles[target.y][target.x].terrain;
  const lockedWithoutKey =
    (targetTerrain === "lockedDoor" &&
      (state.player.inventory.iron_key ?? 0) <= 0) ||
    (targetTerrain === "crystalDoor" &&
      (state.player.inventory.crystal_key ?? 0) <= 0);
  const needsTileCopy =
    !targetEnemy &&
    !targetObject &&
    targetTerrain !== "wall" &&
    !lockedWithoutKey;
  const next = needsTileCopy
    ? cloneGame(state)
    : cloneGameWithoutTiles(state);
  next.player.facing = facing;

  const enemy = targetEnemy
    ? next.enemies.find((candidate) => candidate.id === targetEnemy.id)
    : null;
  if (enemy) {
    const presentationState = presentationStateWithFacing(state, facing);
    const wasSleeping = enemy.sleeping;
    if (wasSleeping) {
      enemy.sleeping = false;
      enemy.alerted = true;
      enemy.wakeCooldown = 1;
      enemy.lastSeenPlayer = { x: next.player.x, y: next.player.y };
    }
    const surprise = !enemy.sawPlayerLastTurn;
    const hit = combatHit(
      next,
      getPlayerAccuracy(next.player),
      enemy.evasion,
      surprise,
    );
    const elapsedTurns = spendPlayerTime(
      next,
      1 / getPlayerAttackSpeed(next.player),
    );
    motions.push({
      id: PLAYER_ID,
      from: { x: next.player.x, y: next.player.y },
      to: target,
      kind: "attack",
    });
    if (hit) {
      const damage = Math.max(
        1,
        getPlayerAttack(next.player) -
          enemy.defense +
          randomInt(next, -1, 2) +
          (surprise ? augmentRank(next.player, "suckerPunch") * 2 : 0),
      );
      enemy.hp -= damage;
      pushLog(
        next,
        surprise
          ? `기습 성공! ${getEnemyLabel(enemy)}에게 ${damage} 피해를 입혔습니다.`
          : `${getEnemyLabel(enemy)}에게 ${damage} 피해를 입혔습니다.`,
      );
      if (surprise) {
        effects.push({
          ...target,
          text: "기습!",
          color: "#ffd56a",
          sourceId: PLAYER_ID,
        });
      }
      effects.push({
        ...target,
        text: `-${damage}`,
        color: "#fff0a6",
        kind: "damage",
        sourceId: PLAYER_ID,
      });
      const defeatedIds = removeDefeatedEnemies(
        next,
        effects,
        true,
        PLAYER_ID,
      );
      return {
        state: next,
        presentationState,
        motions,
        effects,
        defeatedIds,
        signals:
          wasSleeping && !defeatedIds.length
            ? [{
                ...target,
                text: "!",
                color: "#f2d487",
                sourceId: PLAYER_ID,
                holdUntilTurnEnd: true,
              }]
            : [],
        consumedTurn: true,
        elapsedTurns,
      };
    } else {
      pushLog(next, `${getEnemyLabel(enemy)}이(가) 공격을 회피했습니다.`);
      effects.push({
        ...target,
        text: "회피!",
        color: "#b9e5ff",
        sourceId: PLAYER_ID,
      });
    }
    return {
      state: next,
      presentationState,
      motions,
      effects,
      signals: wasSleeping
        ? [{
            ...target,
            text: "!",
            color: "#f2d487",
            sourceId: PLAYER_ID,
            holdUntilTurnEnd: true,
          }]
        : [],
      consumedTurn: true,
      elapsedTurns,
    };
  }

  const object = targetObject
    ? next.objects.find((candidate) => candidate.id === targetObject.id)
    : null;
  if (object) {
    const presentationState = presentationStateWithFacing(state, facing);
    if (object.kind === "alchemy") {
      pushLog(next, "연금술 작업대에 재료 두세 개를 올려놓았습니다.");
      return {
        state: next,
        motions,
        effects,
        consumedTurn: false,
        interacted: true,
        alchemyOpened: true,
      };
    }
    object.looted = true;
    const acquired: Array<{
      defId: string;
      itemRef: string;
      quantity: number;
      lootOrigin: NonNullable<ItemPickup["lootOrigin"]>;
      dungeonLootId?: string;
    }> = [];
    object.loot.forEach((itemId, index) => {
      const quantity = spawnedGroundQuantity(itemId);
      const lootOrigin = object.lootOrigins?.[index] ?? "dungeon";
      const dungeonLootId = object.lootPlanEntryIds?.[index] ?? undefined;
      const preservedInstance = object.lootInstances?.[index] ?? undefined;
      const itemRef = addInventoryItem(
        next,
        itemId,
        `${object.id}-${index}`,
        preservedInstance ?? undefined,
        quantity,
      );
      if (itemRef) {
        acquired.push({
          defId: itemId,
          itemRef,
          quantity,
          lootOrigin,
          dungeonLootId,
        });
      } else {
        next.groundItems.push({
          id: `${object.id}-overflow-${index}`,
          defId: itemId,
          quantity,
          x: object.x,
          y: object.y,
          manualPickup: true,
          instance: preservedInstance
            ? cloneInventoryInstance(preservedInstance)
            : undefined,
          lootOrigin,
          dungeonLootId,
        });
      }
    });
    const objectDefinition = OBJECT_SPRITES[object.kind];
    pushLog(
      next,
      `${objectDefinition.label}에서 전리품 ${acquired.length}개를 챙겼습니다.${
        acquired.length < object.loot.length ? " 가방 밖의 물품은 바닥에 남았습니다." : ""
      }`,
    );
    const elapsedTurns = spendPlayerTime(next, 1);
    acquired.forEach(({ defId, itemRef }) => {
      if (
        autoEquipBetter &&
        ITEM_DEFS[defId]?.slot &&
        isBetterEquipment(next.player, defId, itemRef)
      ) {
        equipInventoryItemDirect(next, itemRef);
        pushLog(next, "자동탐사가 더 좋은 장비로 즉시 교체했습니다.");
      } else if (!autoEquipBetter) {
        queueEquipmentOffer(next, defId, itemRef);
      }
    });
    const pickups = acquired.map(({ defId, itemRef, quantity, lootOrigin, dungeonLootId }, index) => ({
      id: `${object.id}-loot-${index}`,
      defId,
      quantity,
      itemRef,
      lootOrigin,
      dungeonLootId,
      x: object.x,
      y: object.y,
    }));
    effects.push({
      x: object.x,
      y: object.y,
      text: `전리품 ${object.loot.length}`,
      color: objectDefinition.accent,
    });
    return {
      state: next,
      presentationState,
      motions,
      effects,
      pickups,
      consumedTurn: true,
      elapsedTurns,
      interacted: true,
    };
  }

  const terrain = targetTerrain;
  if (
    terrain === "wall" ||
    (terrain === "chasm" && !hasStatus(next.player, "levitating"))
  ) {
    return { state: next, motions, effects, consumedTurn: false };
  }

  if (terrain === "barricade" || terrain === "magicalFire") {
    pushLog(
      next,
      terrain === "barricade"
        ? "바리케이드는 열쇠로 열 수 없습니다. 불이 필요합니다."
        : "영원의 불꽃은 피해를 감수해 통과할 수 없습니다. 냉기가 필요합니다.",
    );
    return { state: next, motions, effects, consumedTurn: false };
  }

  if (terrain === "crystalDoor") {
    const keys = next.player.inventory.crystal_key ?? 0;
    if (keys <= 0) {
      pushLog(next, "수정문입니다. 이 층의 수정 열쇠가 필요합니다.");
      return { state: next, motions, effects, consumedTurn: false };
    }
    const presentationState = presentationStateWithFacing(state, facing);
    if (keys === 1) delete next.player.inventory.crystal_key;
    else next.player.inventory.crystal_key = keys - 1;
    next.tiles[target.y][target.x].terrain = "openDoor";
    pushLog(next, "수정 열쇠 하나를 사용해 수정문을 열었습니다.");
    const elapsedTurns = spendPlayerTime(next, 1);
    updatePlayerFieldOfView(next);
    return {
      state: next,
      presentationState,
      motions,
      effects,
      consumedTurn: true,
      elapsedTurns,
      interacted: true,
      soundCues: [{ id: "unlock", atResolution: true }],
    };
  }

  if (terrain === "lockedDoor") {
    const keys = next.player.inventory.iron_key ?? 0;
    if (keys <= 0) {
      pushLog(next, "문이 잠겨 있습니다. 이 층의 쇠열쇠가 필요합니다.");
      return { state: next, motions, effects, consumedTurn: false };
    }
    const presentationState = presentationStateWithFacing(state, facing);
    if (keys === 1) delete next.player.inventory.iron_key;
    else next.player.inventory.iron_key = keys - 1;
    next.tiles[target.y][target.x].terrain = "openDoor";
    pushLog(next, "쇠열쇠를 사용해 잠긴 문을 열었습니다.");
    const elapsedTurns = spendPlayerTime(next, 1);
    updatePlayerFieldOfView(next);
    return {
      state: next,
      presentationState,
      motions,
      effects,
      consumedTurn: true,
      elapsedTurns,
      interacted: true,
      soundCues: [{ id: "unlock", atResolution: true }],
    };
  } else if (terrain === "door") {
    next.tiles[target.y][target.x].terrain = "openDoor";
    pushLog(next, "낡은 나무문을 밀어 열었습니다.");
  }

  const from = { x: next.player.x, y: next.player.y };
  const closeDoorBehindPlayer =
    next.tiles[next.player.y][next.player.x].terrain === "openDoor";
  const swappingCompanion = targetCompanion
    ? next.companions.find(
        (candidate) => candidate.id === targetCompanion.id,
      ) ?? null
    : null;
  next.player.x = target.x;
  next.player.y = target.y;
  triggerTrapAt(next, target, effects);
  next.companionTrail = [
    from,
    ...(next.companionTrail ?? []).filter(
      (point) => mapPointKey(point) !== mapPointKey(from),
    ),
  ].slice(0, Math.max(12, next.companions.length * 4));
  if (swappingCompanion) {
    const companionFrom = {
      x: swappingCompanion.x,
      y: swappingCompanion.y,
    };
    swappingCompanion.x = from.x;
    swappingCompanion.y = from.y;
    swappingCompanion.facing = companionDirection(companionFrom, from);
    swappingCompanion.actionCooldown = 1;
    motions.push({
      id: swappingCompanion.id,
      from: companionFrom,
      to: from,
      kind: "move",
    });
  }
  if (next.player.natureAidCooldown > 0) {
    next.player.natureAidCooldown -= 1;
  }
  if (
    next.tiles[target.y][target.x].terrain === "highGrass" &&
    next.player.natureAidCooldown <= 0 &&
    augmentRank(next.player, "naturesAid") > 0
  ) {
    const healing = Math.min(
      augmentRank(next.player, "naturesAid"),
      next.player.maxHp - next.player.hp,
    );
    next.player.hp += healing;
    next.player.natureAidCooldown = 5;
    if (healing > 0) pushLog(next, `자연의 도움으로 생명력 ${healing}을 회복했습니다.`);
  }
  const grassResult = trampleHighGrass(next, target, true);
  const trampledGrass = grassResult.trampled;
  if (trampledGrass) {
    pushLog(next, "무성한 수풀을 헤치고 지나갔습니다.");
  }
  if (grassResult.droppedSeed) {
    pushLog(
      next,
      `수풀에서 ${ITEM_DEFS[grassResult.droppedSeed.defId].name}이(가) 떨어졌습니다.`,
    );
  }
  if (closeDoorBehindPlayer && !swappingCompanion) {
    next.tiles[from.y][from.x].terrain = "door";
  }
  const elapsedTurns = spendPlayerTime(
    next,
    1 / getPlayerMoveSpeed(next.player),
  );
  motions.push({ id: PLAYER_ID, from, to: target, kind: "move" });
  updatePlayerFieldOfView(next);

  return {
    state: next,
    motions,
    effects,
    consumedTurn: true,
    elapsedTurns,
    interacted: false,
    reachedExit: next.tiles[target.y][target.x].terrain === "exit",
    soundCues: [
      ...(terrain === "door" ? [{ id: "doorOpen" as const }] : []),
      ...(trampledGrass ? [{ id: "trample" as const }] : []),
      ...(next.tiles[target.y][target.x].terrain === "exit"
        ? [{ id: "descend" as const }]
        : []),
    ],
  };
}

export function waitTurn(state: GameState, logRest = true): ActionResult {
  const next = cloneGameWithoutTiles(state);
  const elapsedTurns = spendPlayerTime(next, 1);
  if (logRest) {
    pushLog(next, "잠시 숨을 고르며 주변 소리에 귀를 기울였습니다.");
  }
  return {
    state: next,
    motions: [],
    effects: [],
    consumedTurn: true,
    elapsedTurns,
    // Waiting advances the turn without playing the player's 360 ms
    // interaction animation. Companion-only auto-explore calls this every
    // turn, so it must use the short minimum/motion timeline instead.
    interacted: false,
  };
}

/**
 * Manual-party actions are resolved immediately for presentation, but the
 * shared world clock must not move until every living party member has acted.
 * This helper removes the player-time side effects produced by the existing
 * player/item/skill actions while preserving every other state mutation.
 */
export function deferActionForManualRound(
  previous: GameState,
  result: ActionResult,
): ActionResult {
  if (!result.consumedTurn) return result;
  const state = {
    ...result.state,
    turn: previous.turn,
    player: {
      ...result.state.player,
      actionProgress: previous.player.actionProgress ?? 0,
    },
  };
  return {
    ...result,
    state,
    elapsedTurns: 0,
  };
}

/** Advance exactly one shared round after all manually controlled actors act. */
export function advanceManualPartyRound(state: GameState): ActionResult {
  const next = cloneGameWithoutTiles(state);
  next.turn += 1;
  next.player.actionProgress = 0;
  pruneEquipmentOffers(next);
  return {
    state: next,
    motions: [],
    effects: [],
    consumedTurn: true,
    elapsedTurns: 1,
  };
}

const companionIncapacitatedResult = (
  state: GameState,
  companionId: string,
): ActionResult | null => {
  const companion = (state.companions ?? []).find(
    (candidate) => candidate.id === companionId && candidate.hp > 0,
  );
  const status = companion?.statuses.find(
    (candidate) =>
      (candidate.id === "frozen" || candidate.id === "paralyzed") &&
      candidate.turns > 0,
  );
  if (!companion || !status) return null;
  const next = cloneGameWithoutTiles(state);
  const resolved = next.companions.find(
    (candidate) => candidate.id === companionId,
  )!;
  pushLog(
    next,
    status.id === "frozen"
      ? `${resolved.name}의 몸이 얼어붙어 이번 라운드에는 행동할 수 없습니다.`
      : `${resolved.name}이(가) 마비되어 이번 라운드에는 행동할 수 없습니다.`,
  );
  const elapsedTurns = spendPlayerTime(next, 1);
  return {
    state: next,
    motions: [],
    effects: [{
      x: resolved.x,
      y: resolved.y,
      text: status.id === "frozen" ? "빙결!" : "마비!",
      color: status.id === "frozen" ? "#8ee9ff" : "#f0e57e",
      sourceId: `status-${status.id}`,
    }],
    consumedTurn: true,
    elapsedTurns,
  };
};

/** One adjacent movement or melee action for a manually controlled companion. */
export function manualCompanionStep(
  state: GameState,
  companionId: string,
  dx: number,
  dy: number,
): ActionResult {
  if (state.gameOver) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const incapacitated = companionIncapacitatedResult(state, companionId);
  if (incapacitated) return incapacitated;
  const original = (state.companions ?? []).find(
    (candidate) => candidate.id === companionId && candidate.hp > 0,
  );
  if (!original) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  if (hasStatus(original, "rooted") && (dx !== 0 || dy !== 0)) {
    const next = cloneGameWithoutTiles(state);
    pushLog(next, `${original.name}이(가) 뿌리에 붙잡혀 이동할 수 없습니다.`);
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }

  const target = { x: original.x + dx, y: original.y + dy };
  const facing = companionDirection(original, target);
  if (!inBounds(state, target)) {
    const next = cloneGameWithoutTiles(state);
    const companion = next.companions.find((candidate) => candidate.id === companionId)!;
    companion.facing = facing;
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }

  const targetEnemy = state.enemies.find(
    (enemy) => enemy.hp > 0 && pointEquals(enemy, target),
  );
  if (targetEnemy) {
    const next = cloneGameWithoutTiles(state);
    const companion = next.companions.find((candidate) => candidate.id === companionId)!;
    const enemy = next.enemies.find((candidate) => candidate.id === targetEnemy.id)!;
    const effects: CombatEffect[] = [];
    const wasSleeping = enemy.sleeping;
    enemy.sleeping = false;
    enemy.alerted = true;
    enemy.lastSeenPlayer = { x: companion.x, y: companion.y };
    if (wasSleeping) enemy.wakeCooldown = Math.max(1, enemy.wakeCooldown);
    companion.facing = facing;
    const motions: Motion[] = [{
      id: companion.id,
      from: { x: companion.x, y: companion.y },
      to: target,
      kind: "attack",
    }];
    if (
      combatHit(
        next,
        getCompanionAccuracy(companion),
        enemy.evasion,
        wasSleeping,
      )
    ) {
      const damage = Math.max(
        1,
        getCompanionAttack(companion) -
          enemy.defense +
          randomInt(next, -1, 1),
      );
      enemy.hp -= damage;
      effects.push({
        ...target,
        text: `-${damage}`,
        color: "#ffe3a1",
        kind: "damage",
        sourceId: companion.id,
      });
      pushLog(
        next,
        `${companion.name}이(가) ${getEnemyLabel(enemy)}에게 ${damage} 피해를 입혔습니다.`,
      );
    } else {
      effects.push({
        ...target,
        text: "회피!",
        color: "#b9e5ff",
        sourceId: companion.id,
      });
    }
    const defeatedIds = removeDefeatedEnemies(
      next,
      effects,
      true,
      companion.id,
    );
    updatePlayerFieldOfView(next);
    return {
      state: next,
      motions,
      effects,
      defeatedIds,
      signals: wasSleeping && !defeatedIds.length
        ? [{
            ...target,
            text: "!",
            color: "#f2d487",
            sourceId: enemy.id,
            holdUntilTurnEnd: true,
          }]
        : [],
      consumedTurn: true,
      elapsedTurns: 0,
    };
  }

  const targetObject = state.objects.find(
    (object) => !object.looted && pointEquals(object, target),
  );
  if (targetObject) {
    const next = cloneGameWithoutTiles(state);
    const companion = next.companions.find((candidate) => candidate.id === companionId)!;
    companion.facing = facing;
    const object = next.objects.find((candidate) => candidate.id === targetObject.id)!;
    if (object.kind === "alchemy") {
      pushLog(next, `${companion.name}이(가) 연금술 작업대를 살폈습니다.`);
      return {
        state: next,
        motions: [],
        effects: [],
        consumedTurn: false,
        interacted: true,
        alchemyOpened: true,
      };
    }
    object.looted = true;
    const pickups: ItemPickup[] = [];
    object.loot.forEach((defId, index) => {
      const quantity = spawnedGroundQuantity(defId);
      const lootOrigin = object.lootOrigins?.[index] ?? "dungeon";
      const dungeonLootId = object.lootPlanEntryIds?.[index] ?? undefined;
      const preservedInstance = object.lootInstances?.[index] ?? undefined;
      const itemRef = addInventoryItem(
        next,
        defId,
        `${object.id}-manual-${index}`,
        preservedInstance ?? undefined,
        quantity,
      );
      if (itemRef) {
        pickups.push({
          id: `${object.id}-manual-loot-${index}`,
          defId,
          quantity,
          itemRef,
          lootOrigin,
          dungeonLootId,
          x: object.x,
          y: object.y,
          sourceId: companion.id,
        });
      } else {
        next.groundItems.push({
          id: `${object.id}-manual-overflow-${index}`,
          defId,
          quantity,
          x: object.x,
          y: object.y,
          manualPickup: true,
          instance: preservedInstance
            ? cloneInventoryInstance(preservedInstance)
            : undefined,
          lootOrigin,
          dungeonLootId,
        });
      }
    });
    pushLog(next, `${companion.name}이(가) ${OBJECT_SPRITES[object.kind].label}을(를) 조사했습니다.`);
    return {
      state: next,
      motions: [{
        id: companion.id,
        from: { x: companion.x, y: companion.y },
        to: target,
        kind: "interact",
      }],
      effects: [],
      pickups,
      consumedTurn: true,
      elapsedTurns: 0,
      interacted: true,
    };
  }

  const terrain = state.tiles[target.y][target.x].terrain;
  if (terrain === "wall" || terrain === "chasm") {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  if (terrain === "lockedDoor") {
    const keys = state.player.inventory.iron_key ?? 0;
    const next = cloneGame(state);
    const companion = next.companions.find((candidate) => candidate.id === companionId)!;
    companion.facing = facing;
    if (keys <= 0) {
      pushLog(next, "문이 잠겨 있습니다. 이 층의 쇠열쇠가 필요합니다.");
      return { state: next, motions: [], effects: [], consumedTurn: false };
    }
    if (keys === 1) delete next.player.inventory.iron_key;
    else next.player.inventory.iron_key = keys - 1;
    next.player.inventorySlots = normalizePlayerInventorySlots(next.player);
    next.tiles[target.y][target.x].terrain = "openDoor";
    updatePlayerFieldOfView(next);
    pushLog(next, `${companion.name}이(가) 쇠열쇠로 잠긴 문을 열었습니다.`);
    return {
      state: next,
      motions: [],
      effects: [],
      consumedTurn: true,
      elapsedTurns: 0,
      interacted: true,
      soundCues: [{ id: "unlock", atResolution: true }],
    };
  }

  const next = cloneGame(state);
  const companion = next.companions.find((candidate) => candidate.id === companionId)!;
  const from = { x: companion.x, y: companion.y };
  const motions: Motion[] = [];
  const swappingPlayer = pointEquals(next.player, target);
  const swappingCompanion = next.companions.find(
    (candidate) =>
      candidate.id !== companion.id &&
      candidate.hp > 0 &&
      pointEquals(candidate, target),
  ) ?? null;
  if (terrain === "door") next.tiles[target.y][target.x].terrain = "openDoor";
  companion.x = target.x;
  companion.y = target.y;
  companion.facing = facing;
  if (swappingPlayer) {
    next.player.x = from.x;
    next.player.y = from.y;
    next.player.facing = directionFromDelta(from.x - target.x, from.y - target.y);
    motions.push({ id: PLAYER_ID, from: target, to: from, kind: "move" });
  } else if (swappingCompanion) {
    swappingCompanion.x = from.x;
    swappingCompanion.y = from.y;
    swappingCompanion.facing = companionDirection(target, from);
    motions.push({ id: swappingCompanion.id, from: target, to: from, kind: "move" });
  }
  const grassResult = trampleHighGrass(next, target, true);
  if (grassResult.droppedSeed) {
    pushLog(next, `${companion.name}이(가) 수풀에서 ${ITEM_DEFS[grassResult.droppedSeed.defId].name}을(를) 발견했습니다.`);
  }
  if (
    next.tiles[from.y][from.x].terrain === "openDoor" &&
    !swappingPlayer &&
    !swappingCompanion
  ) {
    next.tiles[from.y][from.x].terrain = "door";
  }
  motions.push({ id: companion.id, from, to: target, kind: "move" });
  updatePlayerFieldOfView(next);
  return {
    state: next,
    motions,
    effects: [],
    consumedTurn: true,
    elapsedTurns: 0,
    soundCues: [
      ...(terrain === "door" ? [{ id: "doorOpen" as const }] : []),
      ...(grassResult.trampled ? [{ id: "trample" as const }] : []),
    ],
  };
}

export function manualCompanionWait(
  state: GameState,
  companionId: string,
): ActionResult {
  const incapacitated = companionIncapacitatedResult(state, companionId);
  if (incapacitated) return incapacitated;
  const companion = (state.companions ?? []).find(
    (candidate) => candidate.id === companionId && candidate.hp > 0,
  );
  if (!companion) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const next = cloneGameWithoutTiles(state);
  pushLog(next, `${companion.name}이(가) 자리를 지키며 행동을 마쳤습니다.`);
  return {
    state: next,
    motions: [],
    effects: [],
    consumedTurn: true,
    elapsedTurns: 0,
  };
}

export function manualCompanionPickup(
  state: GameState,
  companionId: string,
): ActionResult {
  const companion = (state.companions ?? []).find(
    (candidate) => candidate.id === companionId && candidate.hp > 0,
  );
  if (!companion) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const found = state.groundItems.filter((item) => pointEquals(item, companion));
  if (!found.length) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const next = cloneGameWithoutTiles(state);
  const pickups: ItemPickup[] = [];
  for (const item of found) {
    if (item.defId === "gold") {
      const quantity = Math.max(0, Math.floor(item.quantity ?? 0));
      if (quantity <= 0) continue;
      next.goldCollected += quantity;
      pickups.push({
        id: item.id,
        defId: item.defId,
        quantity,
        itemRef: item.id,
        lootOrigin: item.lootOrigin,
        dungeonLootId: item.dungeonLootId,
        x: item.x,
        y: item.y,
        sourceId: companion.id,
      });
      pushLog(
        next,
        `${companion.name}이(가) 골드 ${quantity.toLocaleString("ko-KR")}개를 주웠습니다.`,
      );
      continue;
    }
    const recoveredCharge =
      item.recoversThrowableCharge && item.recoversItemRef
        ? restoreThrowableCharge(next, item.recoversItemRef, item.quantity ?? 1)
        : 0;
    const itemRef = recoveredCharge > 0
      ? item.recoversItemRef ?? null
      : item.recoversThrowableCharge
        ? null
        : addInventoryItem(
            next,
            item.defId,
            item.id,
            item.instance,
            item.quantity ?? 1,
          );
    if (!itemRef) continue;
    pickups.push({
      id: item.id,
      defId: item.defId,
      quantity: item.quantity ?? 1,
      itemRef,
      lootOrigin: item.lootOrigin,
      dungeonLootId: item.dungeonLootId,
      x: item.x,
      y: item.y,
      sourceId: companion.id,
    });
  }
  if (!pickups.length) {
    pushLog(next, `가방이 가득 찼습니다. 최대 ${MAX_INVENTORY_SLOTS}칸입니다.`);
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  const pickedIds = new Set(pickups.map((pickup) => pickup.id));
  next.groundItems = next.groundItems.filter((item) => !pickedIds.has(item.id));
  pushLog(next, `${companion.name}이(가) 바닥의 아이템 ${pickups.length}개를 주웠습니다.`);
  return {
    state: next,
    motions: [{
      id: companion.id,
      from: { x: companion.x, y: companion.y },
      to: { x: companion.x, y: companion.y },
      kind: "interact",
    }],
    effects: [],
    pickups,
    consumedTurn: true,
    elapsedTurns: 0,
    interacted: true,
  };
}

const enemyBlockedSet = (state: GameState, currentEnemyId: string) =>
  new Set(
    [
      ...state.enemies
        .filter((enemy) => enemy.id !== currentEnemyId)
        .map(mapPointKey),
      ...(state.companions ?? [])
        .filter((companion) => companion.hp > 0)
        .map(mapPointKey),
    ],
  );

const enemyCanSeePlayer = (state: GameState, enemy: Enemy) =>
  distance(enemy, state.player) <= 8 &&
  hasLineOfSight(state.tiles, enemy, state.player);

export const getEnemyWakeChance = (range: number) =>
  Math.max(0.12, Math.min(0.92, 0.92 - (Math.max(1, range) - 1) * 0.115));

const addStatus = (
  statuses: StatusEffect[],
  id: StatusEffectId,
  turns: number,
  power = 1,
) => {
  const resolvedTurns = id === "burning"
    ? Math.max(BURNING_DURATION, turns)
    : turns;
  const existing = statuses.find((status) => status.id === id);
  if (existing) {
    existing.turns = Math.max(existing.turns, resolvedTurns);
    existing.power = Math.max(existing.power, power);
  } else {
    statuses.push({ id, turns: resolvedTurns, power });
  }
};

const hasStatus = (
  entity: { statuses?: StatusEffect[] },
  id: StatusEffectId,
) => (entity.statuses ?? []).some((status) => status.id === id && status.turns > 0);

const triggerTrapAt = (
  state: GameState,
  point: Point,
  effects: CombatEffect[],
  actor: "player" | "thrown" = "player",
) => {
  const trap = (state.traps ?? []).find(
    (candidate) =>
      candidate.active && candidate.x === point.x && candidate.y === point.y,
  );
  if (!trap || (actor === "player" && hasStatus(state.player, "levitating"))) {
    return false;
  }
  trap.hidden = false;
  trap.revealed = true;
  trap.triggered = true;
  trap.active = false;
  if (actor === "thrown") {
    pushLog(state, "던진 물체가 함정을 작동시켰습니다.");
    return true;
  }
  const harmPlayer = (amount: number, text: string, color: string) => {
    state.player.hp = Math.max(0, state.player.hp - amount);
    effects.push({ ...point, text, color, kind: "damage", sourceId: trap.id });
  };
  if (trap.kind === "gripping") {
    harmPlayer(2, "속박!", "#a98d62");
    addStatus(state.player.statuses, "rooted", 3, 1);
  } else if (trap.kind === "poisonDart") {
    harmPlayer(3, "독침!", "#9ad36a");
    addStatus(state.player.statuses, "poisoned", 5, 2);
  } else if (trap.kind === "explosive") {
    harmPlayer(7, "폭발!", "#ff9a55");
    state.enemies.forEach((enemy) => {
      if (distance(enemy, point) <= 2) enemy.hp -= 7;
    });
    removeDefeatedEnemies(state, effects, false, trap.id);
  } else if (trap.kind === "teleportation") {
    const destinations = openCellCandidates(state).filter(
      (candidate) => distance(candidate, point) >= 6,
    );
    const destination = chooseAndRemove(state, destinations);
    if (destination) {
      state.player.x = destination.x;
      state.player.y = destination.y;
    }
    effects.push({ ...state.player, text: "전이!", color: "#a9c8ff", sourceId: trap.id });
  } else if (trap.kind === "flashing") {
    harmPlayer(3, "섬광!", "#fff7ba");
    addStatus(state.player.statuses, "blinded", 5, 1);
    addStatus(state.player.statuses, "rooted", 2, 1);
  }
  pushLog(state, "바닥 함정이 발동했습니다.");
  return true;
};

function consumeIncapacitatedPlayerTurn(
  state: GameState,
): ActionResult | null {
  const status = (state.player.statuses ?? []).find(
    (candidate) =>
      (candidate.id === "frozen" || candidate.id === "paralyzed") &&
      candidate.turns > 0,
  );
  if (!status) return null;
  const next = cloneGameWithoutTiles(state);
  const elapsedTurns = spendPlayerTime(next, 1);
  pushLog(
    next,
    status.id === "frozen"
      ? "몸이 얼어붙어 이번 턴에는 행동할 수 없습니다."
      : "몸이 마비되어 이번 턴에는 행동할 수 없습니다.",
  );
  return {
    state: next,
    motions: [],
    effects: [{
      x: next.player.x,
      y: next.player.y,
      text: status.id === "frozen" ? "빙결!" : "마비!",
      color: status.id === "frozen" ? "#8ee9ff" : "#f0e57e",
      sourceId: `status-${status.id}`,
    }],
    consumedTurn: true,
    elapsedTurns,
  };
}

const statusDamage = (
  actor: Point & { hp: number; statuses: StatusEffect[] },
  effects: CombatEffect[],
) => {
  let skipAction = false;
  for (const status of actor.statuses ?? []) {
    if (status.id === "burning" || status.id === "poisoned" || status.id === "corroded") {
      const amount =
        status.id === "corroded"
          ? Math.max(1, status.power + Math.floor((5 - status.turns) / 2))
          : Math.max(1, status.power);
      actor.hp -= amount;
      effects.push({
        x: actor.x,
        y: actor.y,
        text: `-${amount}`,
        color: status.id === "burning" ? "#ff8a45" : "#8fd56a",
        kind: "damage",
        sourceId: `status-${status.id}`,
      });
    }
    if (status.id === "frozen" || status.id === "paralyzed") skipAction = true;
  }
  actor.statuses = (actor.statuses ?? [])
    .map((status) => ({ ...status, turns: status.turns - 1 }))
    .filter((status) => status.turns > 0);
  return skipAction;
};

const createCloud = (
  state: GameState,
  kind: GameState["clouds"][number]["kind"],
  origin: Point,
  turns: number,
  power: number,
  maxRadius: number,
  spreadPerTurn: number,
) => {
  const center = { x: origin.x, y: origin.y };
  if (
    !inBounds(state, center) ||
    state.tiles[center.y][center.x].terrain === "wall" ||
    (kind === "fire" && state.tiles[center.y][center.x].terrain === "water")
  ) {
    return false;
  }
  state.clouds.push({
    id: `cloud-${kind}-${state.turn}-${state.rng}-${state.clouds.length}`,
    kind,
    origin: center,
    tiles: [{ ...center, remaining: turns, intensity: 1 }],
    maxRadius,
    spreadPerTurn,
    tileLifetime: turns,
    turns,
    power,
  });
  resolveSpecialTerrainFromCloud(state, kind, center, maxRadius);
  return true;
};

const resolveSpecialTerrainFromCloud = (
  state: GameState,
  kind: CloudKind,
  origin: Point,
  radius: number,
) => {
  if (kind === "fire") {
    let destroyed = 0;
    state.tiles.forEach((row, y) => row.forEach((tile, x) => {
      if (tile.terrain === "barricade" && distance(origin, { x, y }) <= radius) {
        tile.terrain = "floor";
        destroyed += 1;
      }
    }));
    if (destroyed > 0) pushLog(state, "불길이 바리케이드를 태워 길을 열었습니다.");
    return;
  }
  if (kind !== "frost") return;
  const touchedRooms = (state.specialRooms ?? []).filter(
    (room) =>
      room.kind === "magicalFire" &&
      state.tiles.some((row, y) => row.some((tile, x) =>
        tile.terrain === "magicalFire" &&
        x >= room.left && x <= room.right &&
        y >= room.top && y <= room.bottom &&
        distance(origin, { x, y }) <= radius,
      )),
  );
  if (!touchedRooms.length) return;
  touchedRooms.forEach((room) => {
    for (let y = room.top; y <= room.bottom; y += 1) {
      for (let x = room.left; x <= room.right; x += 1) {
        if (state.tiles[y][x].terrain === "magicalFire") {
          state.tiles[y][x].terrain = "floor";
        }
      }
    }
  });
  pushLog(state, "서리가 영원의 불꽃을 완전히 꺼뜨렸습니다.");
};

const BURNABLE_TERRAINS = new Set([
  "grass",
  "highGrass",
  "door",
  "openDoor",
  "lockedDoor",
  "barricade",
]);

const isBurnableTerrain = (terrain: string | undefined) =>
  Boolean(terrain && BURNABLE_TERRAINS.has(terrain));

const ensureFireField = (
  state: GameState,
  point: Point,
  power = 2,
) => {
  if (!inBounds(state, point)) return false;
  const terrain = state.tiles[point.y][point.x].terrain;
  if (terrain === "water" || terrain === "wall") return false;
  const existing = (state.clouds ?? []).find(
    (cloud) =>
      cloud.kind === "fire" &&
      cloud.tiles.some((tile) => pointEquals(tile, point)),
  );
  if (existing) {
    existing.turns = Math.max(existing.turns, FIRE_FIELD_DURATION);
    existing.tileLifetime = Math.max(
      existing.tileLifetime ?? 0,
      FIRE_FIELD_DURATION,
    );
    existing.power = Math.max(existing.power, power);
    existing.tiles.forEach((tile) => {
      if (!pointEquals(tile, point)) return;
      tile.remaining = Math.max(tile.remaining, FIRE_FIELD_DURATION);
      tile.intensity = 1;
    });
    return true;
  }
  return createCloud(
    state,
    "fire",
    point,
    FIRE_FIELD_DURATION,
    power,
    0,
    0,
  );
};

const extinguishOrIgniteBurningActors = (
  state: GameState,
  effects: CombatEffect[],
) => {
  const actors: Array<
    Point & { hp: number; statuses: StatusEffect[]; id?: string }
  > = [state.player, ...(state.companions ?? []), ...state.enemies];
  actors.forEach((actor) => {
    if (actor.hp <= 0 || !hasStatus(actor, "burning")) return;
    const terrain = state.tiles[actor.y]?.[actor.x]?.terrain;
    if (terrain === "water") {
      actor.statuses = (actor.statuses ?? []).filter(
        (status) => status.id !== "burning",
      );
      effects.push({
        x: actor.x,
        y: actor.y,
        text: "진화!",
        color: "#8bdcff",
        sourceId: actor.id ?? "water-extinguish",
      });
      return;
    }
    if (!isBurnableTerrain(terrain)) return;
    state.tiles[actor.y][actor.x].terrain = "floor";
    ensureFireField(state, actor, 2);
  });
};

const connectedWaterRegion = (state: GameState, start: Point) => {
  if (state.tiles[start.y]?.[start.x]?.terrain !== "water") {
    return [] as Point[];
  }
  const queue: Point[] = [{ ...start }];
  const visited = new Set([mapPointKey(start)]);
  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index];
    for (const direction of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const candidate = {
        x: point.x + direction.x,
        y: point.y + direction.y,
      };
      const key = mapPointKey(candidate);
      if (
        visited.has(key) ||
        state.tiles[candidate.y]?.[candidate.x]?.terrain !== "water"
      ) {
        continue;
      }
      visited.add(key);
      queue.push(candidate);
    }
  }
  return queue;
};

const lightningEntityId = (
  kind: "player" | "companion" | "enemy",
  actor: Player | Companion | Enemy,
) => kind === "player" ? PLAYER_ID : (actor as Companion | Enemy).id;

const damageLightningEntity = (
  state: GameState,
  kind: "player" | "companion" | "enemy",
  actor: Player | Companion | Enemy,
  amount: number,
  effects: CombatEffect[],
  sourceId: string,
) => {
  let damage = Math.max(1, Math.round(amount));
  if (kind === "player") {
    damage = reduceCharacterDamage(state.player, damage);
    if (state.player.shield > 0) {
      const blocked = Math.min(state.player.shield, damage);
      state.player.shield -= blocked;
      damage -= blocked;
    }
  } else if (kind === "companion") {
    damage = reduceCharacterDamage(actor as Companion, damage);
  }
  if (damage > 0) actor.hp = Math.max(0, actor.hp - damage);
  if (kind === "enemy") {
    const enemy = actor as Enemy;
    enemy.sleeping = false;
    enemy.alerted = true;
  }
  effects.push({
    x: actor.x,
    y: actor.y,
    text: damage > 0 ? `-${damage}` : "막음",
    color: "#8bdcff",
    sourceId,
  });
  return damage;
};

const conductLightningFromEnemy = (
  state: GameState,
  primary: Enemy,
  amount: number,
  effects: CombatEffect[],
  magicVisuals: MagicVisual[],
  sourceId: string,
  excludedIds: ReadonlySet<string> = new Set([primary.id]),
  claimedWaterTiles: Set<string> = new Set(),
) => {
  const waterRegion = connectedWaterRegion(state, primary);
  if (!waterRegion.length) return [] as string[];
  if (waterRegion.some((point) => claimedWaterTiles.has(mapPointKey(point)))) {
    return [] as string[];
  }
  const waterKeys = new Set(waterRegion.map(mapPointKey));
  waterKeys.forEach((key) => claimedWaterTiles.add(key));
  const candidates: Array<{
    kind: "player" | "companion" | "enemy";
    actor: Player | Companion | Enemy;
  }> = [
    { kind: "player", actor: state.player },
    ...(state.companions ?? []).map((actor) => ({
      kind: "companion" as const,
      actor,
    })),
    ...state.enemies.map((actor) => ({
      kind: "enemy" as const,
      actor,
    })),
  ];
  return candidates.flatMap(({ kind, actor }) => {
    const id = lightningEntityId(kind, actor);
    if (
      actor.hp <= 0 ||
      excludedIds.has(id) ||
      !waterKeys.has(mapPointKey(actor))
    ) {
      return [];
    }
    damageLightningEntity(
      state,
      kind,
      actor,
      amount,
      effects,
      `${sourceId}-water`,
    );
    magicVisuals.push({
      id: `${sourceId}-water-${primary.id}-${id}-${state.turn}`,
      kind: "bolt",
      from: { x: primary.x, y: primary.y },
      to: { x: actor.x, y: actor.y },
      color: "#fff37a",
      secondaryColor: "#8bdcff",
      sourceId,
    });
    return [id];
  });
};

type SkillActor = {
  kind: "player" | "companion";
  motionId: string;
  character: Player | Companion;
};

const resolveSkillActor = (
  state: GameState,
  casterId: string,
): SkillActor | null => {
  if (casterId === PLAYER_ID || casterId === state.player.companionId) {
    return {
      kind: "player",
      motionId: PLAYER_ID,
      character: state.player,
    };
  }
  const companion = (state.companions ?? []).find(
    (candidate) => candidate.id === casterId,
  );
  return companion
    ? { kind: "companion", motionId: companion.id, character: companion }
    : null;
};

const skillFailure = (state: GameState, message: string): ActionResult => {
  const next = cloneGameWithoutTiles(state);
  pushLog(next, message);
  return {
    state: next,
    motions: [],
    effects: [],
    consumedTurn: false,
  };
};

const skillActorAttack = (actor: SkillActor) =>
  actor.kind === "player"
    ? getPlayerAttack(actor.character as Player)
    : getCompanionAttack(actor.character as Companion);

const skillActorDefense = (actor: SkillActor) =>
  actor.kind === "player"
    ? getPlayerDefense(actor.character as Player)
    : getCompanionDefense(actor.character as Companion);

const skillMagicColor = (defId = "") =>
  defId.includes("fire") ? "#ff7b3f"
  : defId.includes("frost") ? "#8ee9ff"
  : defId.includes("lightning") ? "#fff37a"
  : defId.includes("corrosion") ? "#9bd34f"
  : defId.includes("regrowth") ? "#6fd06a"
  : "#c3a5ff";

const skillEnemiesInRange = (
  state: GameState,
  center: Point,
  radius: number,
) => state.enemies.filter(
  (enemy) => enemy.hp > 0 && distance(enemy, center) <= radius,
);

const skillAreaTiles = (
  state: Pick<GameState, "width" | "height">,
  center: Point,
  radius: number,
) => {
  const boundedRadius = Math.max(0, Math.floor(radius));
  const tiles: Point[] = [];
  for (
    let y = Math.max(0, center.y - boundedRadius);
    y <= Math.min(state.height - 1, center.y + boundedRadius);
    y += 1
  ) {
    for (
      let x = Math.max(0, center.x - boundedRadius);
      x <= Math.min(state.width - 1, center.x + boundedRadius);
      x += 1
    ) {
      if (distance(center, { x, y }) <= boundedRadius) tiles.push({ x, y });
    }
  }
  return tiles;
};

const skillOccupied = (
  state: GameState,
  point: Point,
  ignoredIds: ReadonlySet<string> = new Set(),
) =>
  (!ignoredIds.has(PLAYER_ID) && pointEquals(state.player, point)) ||
  (state.companions ?? []).some(
    (companion) =>
      companion.hp > 0 &&
      !ignoredIds.has(companion.id) &&
      pointEquals(companion, point),
  ) ||
  state.enemies.some(
    (enemy) =>
      enemy.hp > 0 &&
      !ignoredIds.has(enemy.id) &&
      pointEquals(enemy, point),
  ) ||
  state.objects.some(
    (object) => !object.looted && pointEquals(object, point),
  );

const skillLandingOpen = (
  state: GameState,
  point: Point,
  ignoredIds: ReadonlySet<string> = new Set(),
) => {
  const tile = state.tiles[point.y]?.[point.x];
  return Boolean(
    tile &&
    isWalkable(tile.terrain, false) &&
    !skillOccupied(state, point, ignoredIds),
  );
};

const moveSkillActor = (
  actor: SkillActor,
  target: Point,
  motions: Motion[],
  travelStyle: Motion["travelStyle"] = "walk",
) => {
  const from = { x: actor.character.x, y: actor.character.y };
  actor.character.facing = companionDirection(from, target);
  actor.character.x = target.x;
  actor.character.y = target.y;
  motions.push({
    id: actor.motionId,
    from,
    to: { ...target },
    kind: "move",
    travelStyle,
  });
};

const skillAttackMotion = (
  actor: SkillActor,
  target: Point,
  motions: Motion[],
) => {
  const from = { x: actor.character.x, y: actor.character.y };
  actor.character.facing = companionDirection(from, target);
  motions.push({
    id: actor.motionId,
    from,
    to: { ...target },
    kind: "attack",
  });
};

const skillInteractMotion = (
  actor: SkillActor,
  target: Point,
  motions: Motion[],
) => {
  const from = { x: actor.character.x, y: actor.character.y };
  actor.character.facing = companionDirection(from, target);
  motions.push({
    id: actor.motionId,
    from,
    to: { ...target },
    kind: "interact",
  });
};

const damageWithSkill = (
  enemy: Enemy,
  amount: number,
  actor: SkillActor,
  effects: CombatEffect[],
  color: string,
) => {
  const damage = Math.max(1, Math.round(amount));
  enemy.hp -= damage;
  enemy.sleeping = false;
  enemy.alerted = true;
  enemy.lastSeenPlayer = {
    x: actor.character.x,
    y: actor.character.y,
  };
  effects.push({
    x: enemy.x,
    y: enemy.y,
    text: `-${damage}`,
    color,
    kind: "damage",
    sourceId: actor.motionId,
  });
  return damage;
};

const skillPushDestination = (
  state: GameState,
  enemy: Enemy,
  awayFrom: Point,
  maximumTiles: number,
) => {
  const direction = {
    x: Math.sign(enemy.x - awayFrom.x),
    y: Math.sign(enemy.y - awayFrom.y),
  };
  if (direction.x === 0 && direction.y === 0) return { ...enemy };
  let destination = { x: enemy.x, y: enemy.y };
  for (let step = 0; step < maximumTiles; step += 1) {
    const candidate = {
      x: destination.x + direction.x,
      y: destination.y + direction.y,
    };
    if (
      !skillLandingOpen(
        state,
        candidate,
        new Set([enemy.id]),
      )
    ) break;
    destination = candidate;
  }
  return destination;
};

const moveSkillEnemy = (
  enemy: Enemy,
  destination: Point,
  motions: Motion[],
) => {
  if (pointEquals(enemy, destination)) return;
  const from = { x: enemy.x, y: enemy.y };
  enemy.x = destination.x;
  enemy.y = destination.y;
  motions.push({
    id: enemy.id,
    from,
    to: { ...destination },
    kind: "move",
  });
};

const skillLinePoints = (from: Point, to: Point) => {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  const points: Point[] = [];
  const seen = new Set<string>();
  for (let index = 1; index <= steps; index += 1) {
    const point = {
      x: Math.round(from.x + ((to.x - from.x) * index) / steps),
      y: Math.round(from.y + ((to.y - from.y) * index) / steps),
    };
    const key = mapPointKey(point);
    if (!seen.has(key)) {
      seen.add(key);
      points.push(point);
    }
  }
  return points;
};

const actorWands = (state: GameState, actor: SkillActor) => {
  if (actor.kind === "player") {
    const player = actor.character as Player;
    const slotted = (player.autoSlots ?? []).flatMap((itemRef) => {
      if (!itemRef) return [];
      const instance = (player.inventoryInstances ?? []).find(
        (candidate) => candidate.id === itemRef,
      );
      return instance && ITEM_DEFS[instance.defId]?.category === "wand"
        ? [instance]
        : [];
    });
    const all = [...slotted, ...(player.inventoryInstances ?? []).filter(
      (instance) => ITEM_DEFS[instance.defId]?.category === "wand",
    )];
    return [...new Map(all.map((instance) => [instance.id, instance])).values()];
  }
  return (actor.character as Companion).autoSlots.flatMap((slot) =>
    slot?.instance && ITEM_DEFS[slot.defId]?.category === "wand"
      ? [slot.instance]
      : [],
  );
};

const createImmediateSkillCloud = (
  state: GameState,
  kind: CloudKind,
  target: Point,
  radius: number,
  turns: number,
  power: number,
) => {
  if (!createCloud(state, kind, target, turns, power, radius, 1)) return false;
  const cloud = state.clouds[state.clouds.length - 1];
  cloud.tiles = [];
  for (let y = target.y - radius; y <= target.y + radius; y += 1) {
    for (let x = target.x - radius; x <= target.x + radius; x += 1) {
      const point = { x, y };
      const terrain = state.tiles[y]?.[x]?.terrain;
      if (
        !terrain ||
        distance(point, target) > radius ||
        terrain === "wall" ||
        terrain === "lockedDoor" ||
        (kind === "fire" && terrain === "water")
      ) continue;
      cloud.tiles.push({ ...point, remaining: turns, intensity: 1 });
    }
  }
  return cloud.tiles.length > 0;
};

export const advanceCompanionSkillCooldowns = (state: GameState) => {
  const tick = (character: Player | Companion) => {
    character.skillCooldowns = Object.fromEntries(
      Object.entries(character.skillCooldowns ?? {}).flatMap(
        ([id, turns]) => Number(turns) > 1
          ? [[id, Number(turns) - 1]]
          : [],
      ),
    );
  };
  tick(state.player);
  (state.companions ?? []).forEach(tick);
};

export function activateCompanionSkill(
  state: GameState,
  casterId: string,
  skillId: CompanionSkillId,
  target: Point,
  options: Readonly<{
    modifiers?: readonly CompanionSkillModifier[];
  }> = {},
): ActionResult {
  const modifiers = options.modifiers ?? [];
  if (state.gameOver) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const currentActor = resolveSkillActor(state, casterId);
  const definition = COMPANION_SKILLS[skillId]
    ? modifiers.length
      ? deriveCompanionSkill(skillId, modifiers)
      : companionSkillBlueprint(skillId)
    : null;
  if (!currentActor || !definition || currentActor.character.hp <= 0) {
    return skillFailure(state, "이 스킬을 사용할 원정대원이 없습니다.");
  }
  const assignedSkills = normalizeCompanionSkills(
    normalizeCompanionProfession(
      currentActor.character.classId,
      currentActor.character.professionId,
    ),
    currentActor.kind === "player"
      ? state.player.companionId
      : (currentActor.character as Companion).id,
    currentActor.character.skills,
  );
  if (!assignedSkills.includes(skillId)) {
    return skillFailure(state, "이 원정대원이 보유하지 않은 스킬입니다.");
  }
  const cooldown = currentActor.character.skillCooldowns?.[skillId] ?? 0;
  if (cooldown > 0) {
    return skillFailure(state, `${definition.nameKo} 재사용까지 ${cooldown}턴 남았습니다.`);
  }
  const tile = state.tiles[target.y]?.[target.x];
  if (!tile) {
    return skillFailure(state, "던전 안의 타일을 선택해야 합니다.");
  }
  if (
    !isWithinCircularSkillRange(
      currentActor.character,
      target,
      definition.range,
    )
  ) {
    return skillFailure(state, `${definition.nameKo}의 사거리는 ${definition.range}칸입니다.`);
  }
  if (
    !isSkillTargetableTile(
      state,
      currentActor.character,
      target,
      definition.range,
      definition.requiresLineOfFire,
    )
  ) {
    return skillFailure(state, "벽이나 장애물로 막힌 타일에는 이 스킬을 사용할 수 없습니다.");
  }
  const targetEnemy = state.enemies.find(
    (enemy) => enemy.hp > 0 && pointEquals(enemy, target),
  ) ?? null;
  const targetAlly = pointEquals(state.player, target)
    ? state.player
    : (state.companions ?? []).find(
        (companion) => companion.hp > 0 && pointEquals(companion, target),
      ) ?? null;
  if (definition.target === "ally" && !targetAlly) {
    return skillFailure(state, "대상 타일에 회복할 원정대원이 없습니다.");
  }
  if (
    skillId === "fieldMedicine" &&
    targetAlly &&
    targetAlly.hp >= targetAlly.maxHp
  ) {
    return skillFailure(state, "생명력이 가득 찬 원정대원은 치료할 필요가 없습니다.");
  }
  if (definition.target === "tile" && tile.terrain === "wall") {
    return skillFailure(state, "벽 타일은 목표로 선택할 수 없습니다.");
  }
  if (
    skillId === "weaponThrow" &&
    !isWalkable(tile.terrain, false)
  ) {
    return skillFailure(state, "무기를 회수할 수 있는 바닥 타일을 선택해야 합니다.");
  }

  if (skillId === "whirlwind" && !pointEquals(currentActor.character, target)) {
    return skillFailure(state, "회전 베기는 스킬 사용자의 타일을 선택해야 합니다.");
  }
  if (
    (skillId === "shockLeap" || skillId === "shadowStep") &&
    !skillLandingOpen(
      state,
      target,
      new Set([currentActor.motionId]),
    )
  ) {
    return skillFailure(state, "착지할 수 있는 빈 바닥 타일을 선택해야 합니다.");
  }
  if (skillId === "drivingLeap" && targetEnemy) {
    const destination = skillPushDestination(
      state,
      targetEnemy,
      currentActor.character,
      companionSkillScalar(definition, "pushDistance", 2),
    );
    if (pointEquals(destination, targetEnemy)) {
      return skillFailure(state, "적을 밀어낼 공간이 없어 쇄도 도약을 사용할 수 없습니다.");
    }
  } else if (
    skillId === "drivingLeap" &&
    !skillLandingOpen(
      state,
      target,
      new Set([currentActor.motionId]),
    )
  ) {
    return skillFailure(state, "도약할 수 있는 빈 바닥 타일을 선택해야 합니다.");
  }
  if (skillId === "shieldCharge" && targetEnemy) {
    const destination = skillPushDestination(
      state,
      targetEnemy,
      currentActor.character,
      companionSkillScalar(definition, "pushDistance", 3),
    );
    if (pointEquals(destination, targetEnemy)) {
      return skillFailure(state, "적을 밀어낼 공간이 없어 방패 돌진을 사용할 수 없습니다.");
    }
  } else if (
    skillId === "shieldCharge" &&
    !skillLandingOpen(
      state,
      target,
      new Set([currentActor.motionId]),
    )
  ) {
    return skillFailure(state, "돌진할 수 있는 빈 바닥 타일을 선택해야 합니다.");
  }
  if (skillId === "weaponThrow" && !currentActor.character.equipment.weapon) {
    return skillFailure(state, "무기 투척을 사용하려면 무기를 장착해야 합니다.");
  }
  if (
    skillId === "weaponThrow" &&
    currentActor.character.equipmentInstances.weapon?.cursed
  ) {
    return skillFailure(
      state,
      "저주받은 무기는 손에서 떨어지지 않습니다. 먼저 저주를 해제해야 합니다.",
    );
  }
  if (
    skillId === "arcaneDischarge" &&
    !actorWands(state, currentActor).some(
      (instance) => (instance.charges ?? instance.maxCharges ?? 0) > 0,
    )
  ) {
    return skillFailure(state, "충전이 남은 지팡이를 공용 칸에 등록해야 합니다.");
  }
  if (currentActor.kind === "player") {
    const incapacitated = consumeIncapacitatedPlayerTurn(state);
    if (incapacitated) return incapacitated;
  } else {
    const incapacitated = companionIncapacitatedResult(
      state,
      currentActor.motionId,
    );
    if (incapacitated) return incapacitated;
  }

  const next = cloneGame(state);
  const actor = resolveSkillActor(next, casterId)!;
  const castFrom = {
    x: actor.character.x,
    y: actor.character.y,
  };
  const enemy = targetEnemy
    ? next.enemies.find((candidate) => candidate.id === targetEnemy.id) ?? null
    : null;
  const ally = pointEquals(next.player, target)
    ? next.player
    : next.companions.find(
        (companion) => companion.hp > 0 && pointEquals(companion, target),
      ) ?? null;
  const motions: Motion[] = [];
  const effects: CombatEffect[] = [];
  const magicVisuals: MagicVisual[] = [];
  const throws: ItemThrow[] = [];
  const soundCues: GameSoundCue[] = [
    { id: definition.soundId, volume: 0.68 },
  ];
  const attack = skillActorAttack(actor);
  const defense = skillActorDefense(actor);
  let wandSoundId: string | undefined;
  const skillTravelStyle: Motion["travelStyle"] =
    definition.travelMode === "none" ? "walk" : definition.travelMode;
  const skillHasMechanic = (
    mechanic: (typeof definition.mechanics)[number],
  ) => definition.mechanics.includes(mechanic);

  const skillEffectHandlers: Record<CompanionSkillId, () => void> = {
    shockLeap: () => {
    moveSkillActor(actor, target, motions, skillTravelStyle);
    const shocked = skillEnemiesInRange(
      next,
      target,
      companionSkillScalar(definition, "radius", 1),
    ).map((candidate) => ({
      candidate,
      damage: damageWithSkill(
        candidate,
        attack * companionSkillScalar(definition, "power", 1.6),
        actor,
        effects,
        "#ffd06f",
      ),
    }));
    if (skillHasMechanic("conductive")) {
      const directlyHitIds = new Set(shocked.map(({ candidate }) => candidate.id));
      const claimedWaterTiles = new Set<string>();
      shocked.forEach(({ candidate, damage }) =>
        conductLightningFromEnemy(
          next,
          candidate,
          damage,
          effects,
          magicVisuals,
          `skill-shock-leap-${actor.motionId}`,
          directlyHitIds,
          claimedWaterTiles,
        ),
      );
    }
    effects.push({ ...target, text: "도약!", color: "#ffd06f", sourceId: actor.motionId });
    },
    drivingLeap: () => {
    if (enemy) {
      const origin = { x: enemy.x, y: enemy.y };
      const destination = skillPushDestination(
        next,
        enemy,
        actor.character,
        companionSkillScalar(definition, "pushDistance", 2),
      );
      damageWithSkill(
        enemy,
        attack * companionSkillScalar(definition, "power", 1.3),
        actor,
        effects,
        "#ffb278",
      );
      moveSkillEnemy(enemy, destination, motions);
      moveSkillActor(actor, origin, motions, skillTravelStyle);
    } else {
      moveSkillActor(actor, target, motions, skillTravelStyle);
      effects.push({ ...target, text: "쇄도!", color: "#ffb278", sourceId: actor.motionId });
    }
    },
    fireball: () => {
    skillAttackMotion(actor, target, motions);
    const power = Math.max(
      3,
      Math.round(attack * companionSkillScalar(definition, "power", 1.2)),
    );
    const radius = companionSkillScalar(definition, "radius", 1);
    skillEnemiesInRange(next, target, radius).forEach((candidate) => {
      damageWithSkill(candidate, power, actor, effects, "#ff8553");
      if (skillHasMechanic("status")) {
        addStatus(
          candidate.statuses,
          "burning",
          companionSkillScalar(definition, "statusTurns", 4),
          2,
        );
      }
    });
    if (skillHasMechanic("cloud")) {
      createImmediateSkillCloud(
        next,
        "fire",
        target,
        radius,
        companionSkillScalar(definition, "durationTurns", 5),
        2,
      );
    }
    magicVisuals.push(
      { id: `skill-fireball-${next.turn}`, kind: "bolt", from: actor.character, to: target, color: "#ff6b35", secondaryColor: "#ffd27a", sourceId: actor.motionId },
      { id: `skill-fireburst-${next.turn}`, kind: "burst", from: target, to: target, color: "#ff8a45", secondaryColor: "#ffd27a", sourceId: actor.motionId },
    );
    },
    weaponThrow: () => {
    const weaponId = actor.character.equipment.weapon!;
    const weaponInstance = actor.character.equipmentInstances.weapon;
    const weaponPower = Math.max(
      1,
      equipmentStatProfile(ITEM_DEFS[weaponId], weaponInstance).attack,
    );
    skillAttackMotion(actor, target, motions);
    if (enemy) {
      damageWithSkill(
        enemy,
        weaponPower * companionSkillScalar(definition, "power", 5),
        actor,
        effects,
        "#f4d28f",
      );
    }
    throws.push({
      id: `skill-weapon-${actor.motionId}-${next.turn}`,
      defId: weaponId,
      from: { x: actor.character.x, y: actor.character.y },
      to: { ...target },
      sourceId: actor.motionId,
    });
    const droppedInstance = weaponInstance
      ? cloneInventoryInstance(weaponInstance)
      : createPlainEquipmentInstance(
          ITEM_DEFS[weaponId],
          `skill-weapon-${actor.motionId}-${next.turn}`,
        );
    actor.character.equipment.weapon = null;
    actor.character.equipmentInstances.weapon = null;
    next.groundItems.push({
      id: `skill-dropped-weapon-${droppedInstance.id}-${next.turn}`,
      defId: weaponId,
      quantity: 1,
      instance: droppedInstance,
      lootOrigin: "carried",
      x: target.x,
      y: target.y,
    });
    },
    arcaneDischarge: () => {
    const wand = actorWands(next, actor)
      .filter((instance) => (instance.charges ?? instance.maxCharges ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.charges ?? b.maxCharges ?? 0) -
          (a.charges ?? a.maxCharges ?? 0),
      )[0];
    const charges = wand.charges ?? wand.maxCharges ?? 0;
    const magic = Math.max(
      2,
      equipmentStatProfile(ITEM_DEFS[wand.defId], wand).magic + 2,
    );
    wand.charges = 0;
    skillAttackMotion(actor, target, motions);
    if (enemy) {
      damageWithSkill(
        enemy,
        magic * charges * companionSkillScalar(definition, "power", 1),
        actor,
        effects,
        skillMagicColor(wand.defId),
      );
    }
    magicVisuals.push({
      id: `skill-discharge-${actor.motionId}-${next.turn}`,
      kind: "beam",
      from: actor.character,
      to: target,
      color: skillMagicColor(wand.defId),
      secondaryColor: "#ffffff",
      sourceId: actor.motionId,
    });
    wandSoundId = wand.defId;
    },
    whirlwind: () => {
    skillAttackMotion(actor, target, motions);
    skillEnemiesInRange(
      next,
      actor.character,
      companionSkillScalar(definition, "radius", 1),
    ).forEach((candidate) =>
      damageWithSkill(
        candidate,
        attack * companionSkillScalar(definition, "power", 1.4),
        actor,
        effects,
        "#ffe1a1",
      ),
    );
    },
    piercingShot: () => {
    skillAttackMotion(actor, target, motions);
    const line = new Set(skillLinePoints(actor.character, target).map(mapPointKey));
    next.enemies
      .filter((candidate) => line.has(mapPointKey(candidate)))
      .forEach((candidate) =>
        damageWithSkill(
          candidate,
          attack * companionSkillScalar(definition, "power", 1.8),
          actor,
          effects,
          "#bfe8a7",
        ),
      );
    magicVisuals.push({
      id: `skill-pierce-${actor.motionId}-${next.turn}`,
      kind: "beam",
      from: actor.character,
      to: target,
      color: "#bfe8a7",
      secondaryColor: "#f7f1c5",
      sourceId: actor.motionId,
    });
    },
    chainLightning: () => {
    skillAttackMotion(actor, target, motions);
    const chained: Enemy[] = enemy ? [enemy] : [];
    let current = enemy;
    while (
      skillHasMechanic("chain") &&
      chained.length < companionSkillScalar(definition, "targetCount", 3)
    ) {
      if (!current) break;
      const currentTarget = current;
      const nextTarget = next.enemies
        .filter(
          (candidate) =>
            candidate.hp > 0 &&
            !chained.some((hit) => hit.id === candidate.id) &&
            distance(candidate, currentTarget) <=
              companionSkillScalar(definition, "chainRange", 3),
        )
        .sort(
          (a, b) =>
            distance(a, currentTarget) - distance(b, currentTarget),
        )[0];
      if (!nextTarget) break;
      chained.push(nextTarget);
      current = nextTarget;
    }
    let from: Point = actor.character;
    const chainDamage = new Map<string, number>();
    chained.forEach((candidate, index) => {
      chainDamage.set(
        candidate.id,
        damageWithSkill(
          candidate,
          attack * companionSkillScalar(
            definition,
            index === 0 ? "power" : "secondaryPower",
            index === 0 ? 1.5 : 1,
          ),
          actor,
          effects,
          "#fff27c",
        ),
      );
      magicVisuals.push({
        id: `skill-chain-${actor.motionId}-${next.turn}-${index}`,
        kind: "bolt",
        from: { ...from },
        to: { x: candidate.x, y: candidate.y },
        color: "#fff27c",
        secondaryColor: "#d9f5ff",
        sourceId: actor.motionId,
      });
      from = candidate;
    });
    if (!enemy) {
      magicVisuals.push({
        id: `skill-chain-empty-${actor.motionId}-${next.turn}`,
        kind: "bolt",
        from: { ...actor.character },
        to: { ...target },
        color: "#fff27c",
        secondaryColor: "#d9f5ff",
        sourceId: actor.motionId,
      });
    }
    if (skillHasMechanic("conductive")) {
      const directlyHitIds = new Set(chained.map((candidate) => candidate.id));
      const claimedWaterTiles = new Set<string>();
      chained.forEach((candidate) =>
        conductLightningFromEnemy(
          next,
          candidate,
          chainDamage.get(candidate.id) ?? attack,
          effects,
          magicVisuals,
          `skill-chain-${actor.motionId}`,
          directlyHitIds,
          claimedWaterTiles,
        ),
      );
    }
    },
    frostNova: () => {
    skillAttackMotion(actor, target, motions);
    const radius = companionSkillScalar(definition, "radius", 1);
    skillEnemiesInRange(next, target, radius).forEach((candidate) => {
      damageWithSkill(
        candidate,
        attack * companionSkillScalar(definition, "power", 1.1),
        actor,
        effects,
        "#8ee9ff",
      );
      if (skillHasMechanic("status")) {
        addStatus(
          candidate.statuses,
          "frozen",
          companionSkillScalar(definition, "statusTurns", 2),
          1,
        );
      }
    });
    if (skillHasMechanic("cloud")) {
      createImmediateSkillCloud(
        next,
        "frost",
        target,
        radius,
        companionSkillScalar(definition, "durationTurns", 4),
        1,
      );
    }
    magicVisuals.push({ id: `skill-frost-${next.turn}`, kind: "burst", from: target, to: target, color: "#8ee9ff", secondaryColor: "#ffffff", sourceId: actor.motionId });
    },
    toxicOrb: () => {
    skillAttackMotion(actor, target, motions);
    if (skillHasMechanic("cloud")) {
      createCloud(
        next,
        "toxic",
        target,
        companionSkillScalar(definition, "durationTurns", 6),
        2,
        companionSkillScalar(definition, "radius", 2),
        2,
      );
    }
    magicVisuals.push({ id: `skill-toxic-${next.turn}`, kind: "cloud", from: actor.character, to: target, color: "#79ae58", secondaryColor: "#cce379", sourceId: actor.motionId });
    },
    corrosiveFlask: () => {
    skillAttackMotion(actor, target, motions);
    if (skillHasMechanic("cloud")) {
      createCloud(
        next,
        "corrosive",
        target,
        companionSkillScalar(definition, "durationTurns", 6),
        2,
        companionSkillScalar(definition, "radius", 2),
        2,
      );
    }
    magicVisuals.push({ id: `skill-corrosion-${next.turn}`, kind: "cloud", from: actor.character, to: target, color: "#a5bd50", secondaryColor: "#e0df75", sourceId: actor.motionId });
    },
    entanglingRoots: () => {
    skillAttackMotion(actor, target, motions);
    skillEnemiesInRange(
      next,
      target,
      companionSkillScalar(definition, "radius", 2),
    ).forEach((candidate) => {
      damageWithSkill(
        candidate,
        attack * companionSkillScalar(definition, "power", 0.8),
        actor,
        effects,
        "#81bc6c",
      );
      if (skillHasMechanic("status")) {
        addStatus(
          candidate.statuses,
          "rooted",
          companionSkillScalar(definition, "statusTurns", 3),
          1,
        );
      }
    });
    magicVisuals.push({ id: `skill-roots-${next.turn}`, kind: "burst", from: target, to: target, color: "#6d9f62", secondaryColor: "#b8d789", sourceId: actor.motionId });
    },
    shadowStep: () => {
    moveSkillActor(actor, target, motions, skillTravelStyle);
    skillEnemiesInRange(
      next,
      target,
      companionSkillScalar(definition, "radius", 1),
    ).forEach((candidate) =>
      damageWithSkill(
        candidate,
        attack * companionSkillScalar(definition, "power", 1.7),
        actor,
        effects,
        "#c7a8ff",
      ),
    );
    },
    execute: () => {
    skillAttackMotion(actor, target, motions);
    if (enemy) {
      const multiplier =
        skillHasMechanic("threshold") &&
        enemy.hp / Math.max(1, enemy.maxHp) <=
        companionSkillScalar(definition, "thresholdRatio", 0.4)
          ? companionSkillScalar(definition, "secondaryPower", 4)
          : companionSkillScalar(definition, "power", 1.5);
      damageWithSkill(enemy, attack * multiplier, actor, effects, "#ff9387");
    }
    },
    shieldCharge: () => {
    if (enemy) {
      const origin = { x: enemy.x, y: enemy.y };
      const destination = skillPushDestination(
        next,
        enemy,
        actor.character,
        companionSkillScalar(definition, "pushDistance", 3),
      );
      damageWithSkill(
        enemy,
        Math.max(
          attack * companionSkillScalar(definition, "power", 1),
          defense * companionSkillScalar(definition, "secondaryPower", 1.8),
        ),
        actor,
        effects,
        "#b8ced8",
      );
      if (skillHasMechanic("status")) {
        addStatus(
          enemy.statuses,
          "paralyzed",
          companionSkillScalar(definition, "statusTurns", 2),
          1,
        );
      }
      moveSkillEnemy(enemy, destination, motions);
      moveSkillActor(actor, origin, motions, skillTravelStyle);
    } else {
      moveSkillActor(actor, target, motions, skillTravelStyle);
      effects.push({ ...target, text: "돌진!", color: "#b8ced8", sourceId: actor.motionId });
    }
    },
    fieldMedicine: () => {
      if (!ally) return;
    skillInteractMotion(actor, ally, motions);
    const previousHp = ally.hp;
    ally.hp = Math.min(
      ally.maxHp,
      ally.hp + Math.ceil(
        ally.maxHp * companionSkillScalar(definition, "healRatio", 0.5),
      ),
    );
    effects.push({
      x: ally.x,
      y: ally.y,
      text: `+${ally.hp - previousHp}`,
      color: "#78e38f",
      sourceId: actor.motionId,
    });
    },
    wardingSigil: () => {
    skillAttackMotion(actor, target, motions);
    next.wards.push({
      id: `skill-ward-${actor.motionId}-${next.turn}-${next.wards.length}`,
      x: target.x,
      y: target.y,
      turns: companionSkillScalar(definition, "durationTurns", 6),
      power: Math.max(2, Math.round(actor.character.level / 2) + 2),
    });
    magicVisuals.push({ id: `skill-ward-visual-${next.turn}`, kind: "burst", from: target, to: target, color: "#b99cff", secondaryColor: "#ffffff", sourceId: actor.motionId });
    },
    tripleStrike: () => {
    const hitCount = companionSkillScalar(definition, "hitCount", 3);
    for (let strike = 0; strike < hitCount; strike += 1) {
      skillAttackMotion(actor, target, motions);
      if (enemy) {
        damageWithSkill(
          enemy,
          attack * companionSkillScalar(definition, "power", 0.75),
          actor,
          effects,
          strike === hitCount - 1 ? "#fff0a6" : "#e8d09b",
        );
      }
    }
    },
    seismicSlam: () => {
    skillAttackMotion(actor, target, motions);
    skillEnemiesInRange(
      next,
      target,
      companionSkillScalar(definition, "radius", 2),
    ).forEach((candidate) => {
      damageWithSkill(
        candidate,
        attack * companionSkillScalar(definition, "power", 1.25),
        actor,
        effects,
        "#d4ad76",
      );
      addStatus(
        candidate.statuses,
        "paralyzed",
        companionSkillScalar(definition, "statusTurns", 1),
        1,
      );
    });
    magicVisuals.push({ id: `skill-quake-${next.turn}`, kind: "burst", from: target, to: target, color: "#b98b58", secondaryColor: "#e1c08a", sourceId: actor.motionId });
    },
    lifeDrain: () => {
    skillAttackMotion(actor, target, motions);
    if (enemy) {
      const before = Math.max(0, enemy.hp);
      const dealt = Math.min(
        before,
        damageWithSkill(
          enemy,
          attack * companionSkillScalar(definition, "power", 1.5),
          actor,
          effects,
          "#c879c3",
        ),
      );
      const previousHp = actor.character.hp;
      actor.character.hp = Math.min(
        actor.character.maxHp,
        actor.character.hp + Math.ceil(
          dealt * companionSkillScalar(definition, "healRatio", 0.5),
        ),
      );
      effects.push({
        x: actor.character.x,
        y: actor.character.y,
        text: `+${actor.character.hp - previousHp}`,
        color: "#d78bd0",
        sourceId: actor.motionId,
      });
      magicVisuals.push({ id: `skill-drain-${next.turn}`, kind: "beam", from: enemy, to: actor.character, color: "#c879c3", secondaryColor: "#6f315f", sourceId: actor.motionId });
    } else {
      magicVisuals.push({ id: `skill-drain-empty-${next.turn}`, kind: "beam", from: target, to: actor.character, color: "#c879c3", secondaryColor: "#6f315f", sourceId: actor.motionId });
    }
    },
  };
  skillEffectHandlers[skillId]();

  const specialEffectTargets = (
    specialEffect: { target: "target" | "area"; radius?: number },
  ) => specialEffect.target === "area"
    ? skillEnemiesInRange(
        next,
        target,
        specialEffect.radius ?? companionSkillScalar(definition, "radius", 1),
      )
    : enemy && enemy.hp > 0
      ? [enemy]
      : [];
  for (const specialEffect of definition.specialEffects) {
    if (specialEffect.kind === "damage") {
      specialEffectTargets(specialEffect).forEach((candidate) => {
        damageWithSkill(
          candidate,
          attack * specialEffect.power,
          actor,
          effects,
          definition.accent,
        );
      });
    } else if (specialEffect.kind === "status") {
      specialEffectTargets(specialEffect).forEach((candidate) => {
        addStatus(
          candidate.statuses,
          specialEffect.statusId,
          specialEffect.turns,
          specialEffect.potency ?? 1,
        );
      });
    } else {
      const previousHp = actor.character.hp;
      actor.character.hp = Math.min(
        actor.character.maxHp,
        actor.character.hp + Math.ceil(
          actor.character.maxHp * specialEffect.ratio,
        ),
      );
      const restored = actor.character.hp - previousHp;
      if (restored > 0) {
        effects.push({
          x: actor.character.x,
          y: actor.character.y,
          text: `+${restored}`,
          color: definition.accent,
          sourceId: actor.motionId,
        });
      }
    }
  }

  actor.character.skillCooldowns = {
    ...(actor.character.skillCooldowns ?? {}),
    [skillId]: definition.cooldown + 1,
  };
  if (actor.kind === "companion") {
    (actor.character as Companion).actionCooldown = Math.max(
      1,
      (actor.character as Companion).actionCooldown ?? 0,
    );
  }
  const elapsedTurns = spendPlayerTime(next, 1);
  const defeatedIds = removeDefeatedEnemies(next, effects, true, actor.motionId);
  updatePlayerFieldOfView(next);
  pushLog(next, `${actor.character.name}이(가) ${definition.nameKo}을(를) 사용했습니다.`);
  const visualRadius = companionSkillScalar(definition, "radius", 0);
  const areaCenter = definition.areaAnchor === "caster" ? castFrom : target;
  return {
    state: next,
    motions,
    effects,
    defeatedIds,
    consumedTurn: true,
    elapsedTurns,
    throws,
    magicVisuals: [],
    skillVisuals: [{
      id: `skill-particles-${actor.motionId}-${skillId}-${next.turn}`,
      skillId,
      from: castFrom,
      to: { ...target },
      accent: definition.accent,
      travelMode: definition.travelMode,
      impactMode: definition.impactMode,
      radius: visualRadius,
      footprintOrigin:
        skillHasMechanic("area") && visualRadius > 0
          ? { ...areaCenter }
          : undefined,
      affectedTiles:
        skillHasMechanic("area") && visualRadius > 0
          ? skillAreaTiles(next, areaCenter, visualRadius)
          : undefined,
      rank: 1 + modifiers.length,
      variants: modifiers.length
        ? modifiers.map((modifier) => modifier.id)
        : undefined,
      semanticOverride: modifiers.some(
        (modifier) =>
          modifier.travelMode !== undefined ||
          modifier.impactMode !== undefined ||
          modifier.areaAnchor !== undefined,
      ),
      accentOverride: modifiers.some(
        (modifier) => modifier.accent !== undefined,
      ),
      paths: skillId === "chainLightning"
        ? magicVisuals
            .filter((visual) => visual.kind === "bolt")
            .map((visual) => ({
              from: { x: visual.from.x, y: visual.from.y },
              to: { x: visual.to.x, y: visual.to.y },
            }))
        : undefined,
      sourceId: actor.motionId,
    }],
    wandSoundId,
    soundCues,
    interacted: skillId === "fieldMedicine",
  };
}

const applyClouds = (
  state: GameState,
  effects: CombatEffect[],
  magicVisuals: MagicVisual[] = [],
) => {
  for (const cloud of state.clouds ?? []) {
    const tileLifetime =
      cloud.tileLifetime ??
      Math.max(3, cloud.turns, ...cloud.tiles.map((tile) => tile.remaining));
    cloud.tileLifetime = tileLifetime;
    if (cloud.kind === "fire") {
      cloud.tiles = cloud.tiles.filter(
        (tile) => state.tiles[tile.y]?.[tile.x]?.terrain !== "water",
      );
    }
    const occupied = new Set(cloud.tiles.map(mapPointKey));
    const stormHitEnemies: Enemy[] = [];
    const applyFieldEffect = (
      kind: "player" | "companion" | "enemy",
      actor: Player | Companion | Enemy,
    ) => {
      if (actor.hp <= 0 || !occupied.has(mapPointKey(actor))) return;
      if (cloud.kind === "fire") {
        addStatus(actor.statuses, "burning", BURNING_DURATION, cloud.power);
      } else if (cloud.kind === "frost") {
        addStatus(actor.statuses, "chilled", 3, cloud.power);
      } else if (cloud.kind === "paralytic") {
        addStatus(actor.statuses, "paralyzed", 2, 1);
      } else if (cloud.kind === "toxic") {
        if (!hasStatus(actor, "purified")) {
          addStatus(actor.statuses, "poisoned", 4, cloud.power);
        }
      } else if (cloud.kind === "corrosive") {
        if (!hasStatus(actor, "purified")) {
          addStatus(actor.statuses, "corroded", 5, cloud.power);
        }
      } else if (cloud.kind === "storm") {
        damageLightningEntity(
          state,
          kind,
          actor,
          cloud.power,
          effects,
          cloud.id,
        );
        if (kind === "enemy") stormHitEnemies.push(actor as Enemy);
      }
    };
    applyFieldEffect("player", state.player);
    (state.companions ?? []).forEach((companion) =>
      applyFieldEffect("companion", companion),
    );
    state.enemies.forEach((enemy) => applyFieldEffect("enemy", enemy));

    if (cloud.kind === "storm" && stormHitEnemies.length > 0) {
      const directlyHitIds = new Set(stormHitEnemies.map((enemy) => enemy.id));
      const claimedWaterTiles = new Set<string>();
      stormHitEnemies.forEach((enemy) =>
        conductLightningFromEnemy(
          state,
          enemy,
          cloud.power,
          effects,
          magicVisuals,
          cloud.id,
          directlyHitIds,
          claimedWaterTiles,
        ),
      );
    }

    if (cloud.kind === "fire") {
      cloud.tiles.forEach((tile) => {
        if (isBurnableTerrain(state.tiles[tile.y]?.[tile.x]?.terrain)) {
          state.tiles[tile.y][tile.x].terrain = "floor";
        }
      });
    }

    const candidates = new Map<string, Point>();
    const canSpread = cloud.kind === "fire"
      ? cloud.tiles.some((tile) => tile.remaining > 1)
      : cloud.turns > 0;
    if (canSpread) {
      for (const tile of cloud.tiles) {
        for (const direction of DIRECTIONS) {
          const point = { x: tile.x + direction.x, y: tile.y + direction.y };
          const key = mapPointKey(point);
          if (!inBounds(state, point) || occupied.has(key)) continue;
          const terrain = state.tiles[point.y][point.x].terrain;
          if (cloud.kind === "fire") {
            // Fire fields stay on their original ground. They only jump to
            // adjacent brush or doors, which are consumed by the new flame.
            if (!isBurnableTerrain(terrain)) continue;
          } else if (
            distance(point, cloud.origin) > cloud.maxRadius ||
            terrain === "wall" ||
            terrain === "door" ||
            terrain === "lockedDoor"
          ) {
            continue;
          }
          candidates.set(key, point);
        }
      }
    }
    const spreadCandidates = [...candidates.values()];
    for (let index = spreadCandidates.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(state, 0, index);
      [spreadCandidates[index], spreadCandidates[swapIndex]] = [
        spreadCandidates[swapIndex],
        spreadCandidates[index],
      ];
    }
    if (cloud.kind !== "fire") {
      spreadCandidates.sort((a, b) => {
        const terrainA = state.tiles[a.y][a.x].terrain;
        const terrainB = state.tiles[b.y][b.x].terrain;
        const affinity = (terrain: string) =>
          (cloud.kind === "frost" || cloud.kind === "storm") &&
              terrain === "water"
            ? 3
            : 1;
        return affinity(terrainB) - affinity(terrainA);
      });
    }
    const spreadCount = cloud.kind === "fire"
      ? spreadCandidates.length
      : Math.min(spreadCandidates.length, cloud.spreadPerTurn);
    const survivingTiles = cloud.tiles
      .map((tile) => {
        const remaining = tile.remaining - 1;
        return {
          ...tile,
          remaining,
          intensity: Math.max(0.12, remaining / tileLifetime),
        };
      })
      .filter((tile) => tile.remaining > 0);
    const newTiles = spreadCandidates.slice(0, spreadCount).map((point) => {
      if (
        cloud.kind === "fire" &&
        isBurnableTerrain(state.tiles[point.y]?.[point.x]?.terrain)
      ) {
        state.tiles[point.y][point.x].terrain = "floor";
      }
      return {
        ...point,
        remaining: tileLifetime,
        intensity: 1,
      };
    });
    cloud.tiles = [...survivingTiles, ...newTiles];
    cloud.turns = Math.max(0, cloud.turns - 1);
  }
  state.clouds = (state.clouds ?? [])
    .filter((cloud) => cloud.tiles.length > 0);
};

const tickPlayerStatuses = (state: GameState, effects: CombatEffect[]) => {
  const hoveringOverChasm =
    state.tiles[state.player.y]?.[state.player.x]?.terrain === "chasm";
  for (const status of state.player.statuses ?? []) {
    if (status.id === "burning" || status.id === "poisoned" || status.id === "corroded") {
      let damage = Math.max(1, status.power);
      if (state.player.shield > 0) {
        const blocked = Math.min(state.player.shield, damage);
        state.player.shield -= blocked;
        damage -= blocked;
      }
      if (damage > 0) {
        state.player.hp = Math.max(0, state.player.hp - damage);
        effects.push({
          x: state.player.x,
          y: state.player.y,
          text: `-${damage}`,
          color: status.id === "burning" ? "#ff8a45" : "#8fd56a",
          kind: "damage",
          sourceId: `status-${status.id}`,
        });
      }
    }
  }
  state.player.statuses = (state.player.statuses ?? [])
    .map((status) => ({
      ...status,
      turns:
        hoveringOverChasm && status.id === "levitating"
          ? Math.max(2, status.turns)
          : status.turns - 1,
    }))
    .filter((status) => status.turns > 0);
};

const companionBlockedSet = (state: GameState) =>
  new Set([
    mapPointKey(state.player),
    ...state.enemies
      .filter((enemy) => enemy.hp > 0)
      .map(mapPointKey),
    ...state.objects
      .filter((object) => !object.looted)
      .map(mapPointKey),
  ]);

export const hasCompanionExplorationFrontier = (state: GameState) =>
  state.tiles.some((row, y) =>
    row.some((tile, x) =>
      tile.discovered &&
      (isWalkable(tile.terrain, false) ||
        (tile.terrain === "lockedDoor" &&
          (state.player.inventory.iron_key ?? 0) > 0)) &&
      DIRECTIONS.some((direction) => {
        const neighbor = state.tiles[y + direction.y]?.[x + direction.x];
        return Boolean(neighbor && !neighbor.discovered);
      }),
    ),
  );

export const hasCompanionExplorationWork = (state: GameState) => {
  void state;
  return false;
};

const followerTarget = (
  state: GameState,
  companion: Companion,
  followerIndex: number,
) => {
  const trail = state.companionTrail ?? [];
  const trailTarget = trail[Math.min(followerIndex, trail.length - 1)];
  if (
    trailTarget &&
    state.tiles[trailTarget.y]?.[trailTarget.x] &&
    isWalkable(state.tiles[trailTarget.y][trailTarget.x].terrain, false)
  ) {
    return trailTarget;
  }
  const facingOffset: Record<Direction, Point> = {
    up: { x: 0, y: 1 },
    down: { x: 0, y: -1 },
    left: { x: 1, y: 0 },
    right: { x: -1, y: 0 },
  };
  const offset = facingOffset[state.player.facing];
  const preferred = {
    x: state.player.x + offset.x * (followerIndex + 1),
    y: state.player.y + offset.y * (followerIndex + 1),
  };
  if (
    state.tiles[preferred.y]?.[preferred.x] &&
    isWalkable(state.tiles[preferred.y][preferred.x].terrain, false)
  ) {
    return preferred;
  }
  return [...DIRECTIONS]
    .map((direction) => ({
      x: state.player.x + direction.x,
      y: state.player.y + direction.y,
    }))
    .filter(
      (point) =>
        state.tiles[point.y]?.[point.x] &&
        isWalkable(state.tiles[point.y][point.x].terrain, false),
    )
    .sort(
      (a, b) =>
        distance(a, companion) - distance(b, companion),
    )[0] ?? null;
};

type CompanionMovePlan = {
  companion: Companion;
  destination: Point;
};

const resolveCompanionMovePlans = (
  state: GameState,
  plans: CompanionMovePlan[],
  motions: Motion[],
) => {
  const occupiedAtStart = new Map(
    (state.companions ?? [])
      .filter((companion) => companion.hp > 0)
      .map((companion) => [mapPointKey(companion), companion] as const),
  );
  const accepted = new Map<string, CompanionMovePlan>();
  const reservedDestinations = new Set<string>();
  const hardBlocked = companionBlockedSet(state);

  for (const plan of plans) {
    const destinationKey = mapPointKey(plan.destination);
    const startingOccupant = occupiedAtStart.get(destinationKey);
    const terrain =
      state.tiles[plan.destination.y]?.[plan.destination.x]?.terrain;
    if (
      !terrain ||
      !isWalkable(
        terrain,
        (state.player.inventory.iron_key ?? 0) > 0,
      ) ||
      hardBlocked.has(destinationKey) ||
      reservedDestinations.has(destinationKey) ||
      (startingOccupant &&
        startingOccupant.id !== plan.companion.id &&
        !accepted.has(startingOccupant.id))
    ) {
      continue;
    }
    reservedDestinations.add(destinationKey);
    accepted.set(plan.companion.id, plan);
  }

  const acceptedPlans = plans.filter((plan) =>
    accepted.has(plan.companion.id),
  );
  const finalOccupied = new Set(
    (state.companions ?? [])
      .filter((companion) => companion.hp > 0)
      .map((companion) => {
        const plan = accepted.get(companion.id);
        return mapPointKey(plan?.destination ?? companion);
      }),
  );
  let openedDoor = false;

  for (const { destination } of acceptedPlans) {
    const terrain = state.tiles[destination.y][destination.x].terrain;
    if (terrain === "lockedDoor") {
      const keys = state.player.inventory.iron_key ?? 0;
      if (keys > 0) {
        if (keys === 1) delete state.player.inventory.iron_key;
        else state.player.inventory.iron_key = keys - 1;
        state.player.inventorySlots = normalizePlayerInventorySlots(
          state.player,
        );
        state.tiles[destination.y][destination.x].terrain = "openDoor";
        openedDoor = true;
      }
    } else if (terrain === "door") {
      state.tiles[destination.y][destination.x].terrain = "openDoor";
      openedDoor = true;
    }
  }
  for (const { companion, destination } of acceptedPlans) {
    const from = { x: companion.x, y: companion.y };
    if (
      state.tiles[from.y][from.x].terrain === "openDoor" &&
      !finalOccupied.has(mapPointKey(from))
    ) {
      state.tiles[from.y][from.x].terrain = "door";
    }
    companion.facing = companionDirection(from, destination);
    companion.x = destination.x;
    companion.y = destination.y;
    const grassResult = trampleHighGrass(state, destination, true);
    if (grassResult.droppedSeed) {
      pushLog(
        state,
        `${companion.name}이(가) 수풀에서 ${ITEM_DEFS[grassResult.droppedSeed.defId].name}을(를) 발견했습니다.`,
      );
    }
    motions.push({
      id: companion.id,
      from,
      to: destination,
      kind: "move",
    });
  }

  return openedDoor;
};

const companionWandColor = (defId: string) =>
  defId.includes("fire") ? "#ff7b3f"
  : defId.includes("frost") ? "#8ee9ff"
  : defId.includes("lightning") ? "#fff37a"
  : defId.includes("corrosion") ? "#9bd34f"
  : defId.includes("regrowth") ? "#6fd06a"
  : "#c3a5ff";

const activateCompanionRangedSlot = (
  state: GameState,
  companion: Companion,
  target: Point,
  motions: Motion[],
  effects: CombatEffect[],
  magicVisuals: MagicVisual[],
  wandSoundIds: string[],
  signals: StatusSignal[],
  throws: ItemThrow[],
  preferredSlotIndex?: number,
) => {
  const usableSlot = (slot: CompanionAutoItem | null) => {
    if (!slot) return false;
    const definition = ITEM_DEFS[slot.defId];
    if (!definition) return false;
    if (
      definition.category === "wand" &&
      (slot.instance?.charges ?? slot.instance?.maxCharges ?? 0) <= 0
    ) {
      return false;
    }
    if (
      definition.category === "missile" &&
      (!slot.instance ||
        Math.max(
          0,
          Math.min(
            slot.instance.maxCharges ?? 0,
            slot.instance.charges ?? slot.instance.maxCharges ?? 0,
          ),
        ) <= 0)
    ) {
      return false;
    }
    return (
      (definition.category === "wand" ||
        definition.category === "missile") &&
      distance(companion, target) <=
        (definition.category === "wand" ? 10 : 8) &&
      hasProjectileLineOfFire(state, companion, target)
    );
  };
  const slotIndex = preferredSlotIndex === undefined
    ? companion.autoSlots.findIndex(usableSlot)
    : usableSlot(companion.autoSlots[preferredSlotIndex] ?? null)
      ? preferredSlotIndex
      : -1;
  if (slotIndex < 0) return false;
  const slot = companion.autoSlots[slotIndex];
  if (!slot) return false;
  const definition = ITEM_DEFS[slot.defId];
  const activeInstance = slot.instance;
  if (definition.category === "missile" && !activeInstance) return false;
  const targetEnemy = state.enemies.find(
    (enemy) => enemy.hp > 0 && pointEquals(enemy, target),
  ) ?? null;
  companion.facing = companionDirection(companion, target);
  motions.push({
    id: companion.id,
    from: { x: companion.x, y: companion.y },
    to: { x: target.x, y: target.y },
    kind: "attack",
  });
  if (definition.category === "missile") {
    throws.push({
      id: `companion-throw-${companion.id}-${state.turn}-${slotIndex}`,
      defId: slot.defId,
      from: { x: companion.x, y: companion.y },
      to: { x: target.x, y: target.y },
      sourceId: companion.id,
    });
  }
  const hit = Boolean(
    targetEnemy &&
      combatHit(
        state,
        getCompanionAccuracy(companion),
        targetEnemy.evasion,
        targetEnemy.sleeping,
      ),
  );
  if (hit && targetEnemy) {
    const profile = equipmentStatProfile(definition, activeInstance);
    const damage =
      definition.category === "wand"
        ? Math.max(2, profile.magic + 3)
        : Math.max(1, profile.attack + 1);
    targetEnemy.hp -= damage;
    const wasSleeping = targetEnemy.sleeping;
    targetEnemy.sleeping = false;
    targetEnemy.alerted = true;
    if (wasSleeping) {
      targetEnemy.wakeCooldown = Math.max(1, targetEnemy.wakeCooldown);
    }
    if (wasSleeping) {
      signals.push({
        x: targetEnemy.x,
        y: targetEnemy.y,
        text: "!",
        color: "#f2d487",
        sourceId: targetEnemy.id,
        holdUntilTurnEnd: true,
      });
    }
    targetEnemy.lastSeenPlayer = { x: companion.x, y: companion.y };
    effects.push({
      x: targetEnemy.x,
      y: targetEnemy.y,
      text: `-${damage}`,
      color:
        definition.category === "wand"
          ? companionWandColor(slot.defId)
          : "#e7d19b",
      kind: "damage",
      sourceId: companion.id,
    });
    if (slot.defId === "wand_frost") {
      addStatus(targetEnemy.statuses, "chilled", 4, 1);
    } else if (slot.defId === "wand_fireblast") {
      addStatus(targetEnemy.statuses, "burning", 4, 2);
    } else if (slot.defId === "wand_corrosion") {
      addStatus(targetEnemy.statuses, "corroded", 5, 2);
    } else if (slot.defId === "wand_corruption") {
      addStatus(targetEnemy.statuses, "corrupted", 7, 1);
    } else if (slot.defId === "wand_prismatic_light") {
      addStatus(targetEnemy.statuses, "blinded", 5, 1);
    } else if (slot.defId === "wand_regrowth") {
      addStatus(targetEnemy.statuses, "rooted", 4, 1);
    }
  } else if (targetEnemy) {
    effects.push({
      x: target.x,
      y: target.y,
      text: "회피!",
      color: "#b9e5ff",
      sourceId: companion.id,
    });
  }
  if (definition.category === "wand") {
    if (slot.instance) {
      slot.instance.charges = Math.max(
        0,
        (slot.instance.charges ?? slot.instance.maxCharges ?? 0) - 1,
      );
    }
    magicVisuals.push({
      id: `companion-magic-${companion.id}-${state.turn}`,
      kind: slot.defId === "wand_fireblast" ? "cone" : "beam",
      from: { x: companion.x, y: companion.y },
      to: { x: target.x, y: target.y },
      color: companionWandColor(slot.defId),
      secondaryColor: "#ffffff",
      sourceId: companion.id,
    });
    wandSoundIds.push(slot.defId);
  } else {
    const profile = activeInstance!;
    const maximum = Math.max(0, profile.maxCharges ?? 0);
    profile.charges = Math.max(
      0,
      Math.min(maximum, profile.charges ?? maximum) - 1,
    );
    let durabilityBroke = false;
    if (hit) {
      const maxDurability = profile.maxDurability ?? 10;
      profile.maxDurability = maxDurability;
      profile.durability =
        (profile.durability ?? maxDurability) - 1;
      if (profile.durability <= 0) {
        profile.maxCharges = Math.max(0, maximum - 1);
        profile.charges = Math.min(
          profile.maxCharges,
          profile.charges,
        );
        profile.durability = maxDurability;
        durabilityBroke = true;
        pushLog(
          state,
          `${definition.name} 하나가 파손되어 이번 탐사의 최대 충전량이 ${profile.maxCharges}로 감소했습니다.`,
        );
      } else {
        pushLog(
          state,
          `${definition.name} 내구도 ${profile.durability}/${maxDurability}.`,
        );
      }
    }
    if (!durabilityBroke) {
      state.groundItems.push({
        id: `companion-thrown-${slot.defId}-${companion.id}-${state.turn}-${state.rng}`,
        defId: slot.defId,
        quantity: 1,
        recoversThrowableCharge: true,
        recoversItemRef: profile.id,
        lootOrigin: "carried",
        x: target.x,
        y: target.y,
      });
    }
  }
  pushLog(
    state,
    `${companion.name}이(가) ${definition.name}을(를) 사용했습니다.`,
  );
  return true;
};

/** Use one specific quickslot after an explicit player input. */
export function activateCompanionQuickslot(
  state: GameState,
  companionId: string,
  slotIndex: number,
  target: Point,
): ActionResult {
  if (
    state.gameOver ||
    !COMPANION_QUICKSLOT_INDEXES.includes(
      slotIndex as (typeof COMPANION_QUICKSLOT_INDEXES)[number],
    )
  ) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const incapacitated = companionIncapacitatedResult(state, companionId);
  if (incapacitated) return incapacitated;
  const source = (state.companions ?? []).find(
    (candidate) => candidate.id === companionId && candidate.hp > 0,
  );
  const slot = source?.autoSlots[slotIndex] ?? null;
  const definition = slot ? ITEM_DEFS[slot.defId] : null;
  if (
    source &&
    slot?.defId === "potion_healing" &&
    definition?.category === "potion"
  ) {
    if ((state.player.inventory.potion_healing ?? 0) <= 0) {
      return skillFailure(state, "등록된 치유 물약이 남아 있지 않습니다.");
    }
    if (source.hp >= source.maxHp) {
      return skillFailure(state, `${source.name}의 생명력이 이미 가득 찼습니다.`);
    }
    const next = cloneGameWithoutTiles(state);
    const companion = next.companions.find(
      (candidate) => candidate.id === companionId,
    )!;
    const previousHp = companion.hp;
    companion.hp = Math.min(
      companion.maxHp,
      companion.hp + Math.max(8, Math.ceil(companion.maxHp * 0.6)),
    );
    next.player.inventory.potion_healing = Math.max(
      0,
      (next.player.inventory.potion_healing ?? 0) - 1,
    );
    next.player.inventorySlots = normalizePlayerInventorySlots(next.player);
    pushLog(next, `${companion.name}이(가) 치유 물약을 사용했습니다.`);
    return {
      state: next,
      motions: [{
        id: companion.id,
        from: { x: companion.x, y: companion.y },
        to: { x: companion.x, y: companion.y },
        kind: "interact",
      }],
      effects: [{
        x: companion.x,
        y: companion.y,
        text: `+${companion.hp - previousHp}`,
        color: "#78e38f",
        sourceId: companion.id,
      }],
      soundCues: [{ id: "drink", atResolution: true, volume: 0.48 }],
      consumedTurn: true,
      elapsedTurns: 0,
      interacted: true,
    };
  }
  if (source && slot && definition?.category === "potion") {
    if ((state.player.inventory[slot.defId] ?? 0) <= 0) {
      return skillFailure(state, `등록된 ${definition.name}이(가) 남아 있지 않습니다.`);
    }
    const path = projectilePath(state, target, 8, source);
    if (!path.length) {
      return skillFailure(state, `${definition.name}을(를) 던질 타일을 선택해야 합니다.`);
    }
    const landing = path[path.length - 1];
    const next = cloneGameWithoutTiles(state);
    const companion = next.companions.find(
      (candidate) => candidate.id === companionId,
    )!;
    removeInventoryItem(next, slot.defId);
    const cloud = THROWN_POTION_CLOUDS[slot.defId];
    const created = cloud
      ? createCloud(
          next,
          cloud.kind,
          landing,
          cloud.turns,
          cloud.power,
          cloud.maxRadius,
          cloud.spreadPerTurn,
        )
      : false;
    if (cloud?.kind === "fire" && !created) {
      pushLog(next, `${companion.name}이(가) 던진 ${definition.name}의 불꽃이 물 위에서 식었습니다.`);
    } else if (created) {
      pushLog(next, `${companion.name}이(가) ${definition.name}을(를) 던져 장막을 만들었습니다.`);
    } else {
      pushLog(next, `${companion.name}이(가) ${definition.name}을(를) 던졌습니다.`);
    }
    return {
      state: next,
      presentationState: state,
      motions: [{
        id: companion.id,
        from: { x: companion.x, y: companion.y },
        to: landing,
        kind: "attack",
      }],
      effects: [],
      throws: [{
        id: `companion-potion-${slot.defId}-${companion.id}-${next.turn}`,
        defId: slot.defId,
        from: { x: companion.x, y: companion.y },
        to: landing,
        sourceId: companion.id,
      }],
      itemBreak: true,
      soundCues: [{ id: "shatter", atResolution: true }],
      consumedTurn: true,
      elapsedTurns: 0,
    };
  }
  if (
    !source ||
    !slot ||
    !definition ||
    (definition.category !== "wand" && definition.category !== "missile")
  ) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const maximumRange = definition.category === "wand" ? 10 : 8;
  const tile = state.tiles[target.y]?.[target.x];
  if (
    !tile ||
    distance(source, target) > maximumRange ||
    !hasProjectileLineOfFire(state, source, target)
  ) {
    const next = cloneGameWithoutTiles(state);
    pushLog(next, `${definition.name}의 사거리 안에서 막히지 않은 타일을 선택해야 합니다.`);
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }

  const next = cloneGameWithoutTiles(state);
  const companion = next.companions.find(
    (candidate) => candidate.id === companionId,
  )!;
  const motions: Motion[] = [];
  const effects: CombatEffect[] = [];
  const magicVisuals: MagicVisual[] = [];
  const wandSoundIds: string[] = [];
  const signals: StatusSignal[] = [];
  const throws: ItemThrow[] = [];
  const used = activateCompanionRangedSlot(
    next,
    companion,
    target,
    motions,
    effects,
    magicVisuals,
    wandSoundIds,
    signals,
    throws,
    slotIndex,
  );
  if (!used) {
    pushLog(next, `${definition.name}의 충전량이 없습니다.`);
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  const defeatedIds = removeDefeatedEnemies(
    next,
    effects,
    true,
    companion.id,
  );
  updatePlayerFieldOfView(next);
  return {
    state: next,
    presentationState: state,
    motions,
    effects,
    signals,
    defeatedIds,
    throws,
    magicVisuals,
    wandSoundId: wandSoundIds[0],
    consumedTurn: true,
    elapsedTurns: 0,
  };
}

const pickupGroundItemsForCompanion = (
  state: GameState,
  companion: Companion,
  motions: Motion[],
  pickups: ItemPickup[],
) => {
  const found = state.groundItems.filter(
    (item) => item.x === companion.x && item.y === companion.y,
  );
  if (!found.length) return false;

  const picked = found.flatMap((item) => {
    if (item.defId === "gold") {
      const quantity = Math.max(0, Math.floor(item.quantity ?? 0));
      if (quantity <= 0) return [];
      state.goldCollected += quantity;
      return [{ item, itemRef: item.id, quantity }];
    }
    const recoveredCharge =
      item.recoversThrowableCharge && item.recoversItemRef
      ? restoreThrowableCharge(state, item.recoversItemRef, item.quantity ?? 1)
      : 0;
    const itemRef = recoveredCharge > 0
      ? item.recoversItemRef ?? null
      : item.recoversThrowableCharge
        ? null
        : addInventoryItem(
            state,
            item.defId,
            `${companion.id}-${item.id}`,
            item.instance,
            item.quantity ?? 1,
          );
    return itemRef ? [{ item, itemRef, quantity: item.quantity ?? 1 }] : [];
  });
  if (!picked.length) return false;

  const pickedIds = new Set(picked.map(({ item }) => item.id));
  state.groundItems = state.groundItems.filter(
    (item) => !pickedIds.has(item.id),
  );
  picked.forEach(({ item, itemRef, quantity }) => {
    pushLog(
      state,
      item.defId === "gold"
        ? `${companion.name}이(가) 골드 ${quantity.toLocaleString("ko-KR")}개를 주웠습니다.`
        : item.recoversThrowableCharge
        ? `${companion.name}이(가) ${ITEM_DEFS[item.defId].name}을(를) 회수해 충전을 회복했습니다.`
        : quantity > 1
        ? `${companion.name}이(가) ${ITEM_DEFS[item.defId].name} ${quantity}개를 주웠습니다.`
        : `${companion.name}이(가) ${ITEM_DEFS[item.defId].name}을(를) 주웠습니다.`,
    );
    if (!item.recoversThrowableCharge && item.defId !== "gold") {
      queueEquipmentOffer(state, item.defId, itemRef);
    }
    pickups.push({
      id: item.id,
      defId: item.defId,
      quantity,
      itemRef,
      sourceId: companion.id,
      lootOrigin: item.lootOrigin,
      dungeonLootId: item.dungeonLootId,
      x: item.x,
      y: item.y,
    });
  });
  motions.push({
    id: companion.id,
    from: { x: companion.x, y: companion.y },
    to: { x: companion.x, y: companion.y },
    kind: "interact",
  });
  return true;
};

const companionMovementBlockedSet = (
  state: GameState,
  companionId: string,
  reservedDestinations: ReadonlySet<string> = new Set(),
) => {
  const blocked = companionBlockedSet(state);
  (state.companions ?? []).forEach((companion) => {
    if (companion.hp > 0 && companion.id !== companionId) {
      blocked.add(mapPointKey(companion));
    }
  });
  reservedDestinations.forEach((key) => blocked.add(key));
  return blocked;
};

const nextCompanionStepToward = (
  state: GameState,
  companion: Companion,
  target: Point,
  reservedDestinations: ReadonlySet<string>,
  canUnlock: boolean,
  allowOccupiedTarget = false,
) => {
  const blocked = companionMovementBlockedSet(
    state,
    companion.id,
    reservedDestinations,
  );
  const targetKey = mapPointKey(target);
  if (allowOccupiedTarget) blocked.delete(targetKey);
  const targetTerrain = state.tiles[target.y]?.[target.x]?.terrain;
  if (!targetTerrain) return null;

  if (!blocked.has(targetKey) && isWalkable(targetTerrain, canUnlock)) {
    const path = findPath(
      state.tiles,
      companion,
      target,
      blocked,
      canUnlock,
    );
    if (path[0]) return path[0];
  }

  const approaches = DIRECTIONS
    .map((direction) => ({
      x: target.x + direction.x,
      y: target.y + direction.y,
    }))
    .filter((point) => {
      const terrain = state.tiles[point.y]?.[point.x]?.terrain;
      return Boolean(
        terrain &&
          isWalkable(terrain, canUnlock) &&
          !blocked.has(mapPointKey(point)),
      );
    })
    .sort(
      (a, b) =>
        distance(a, companion) - distance(b, companion) ||
        a.y - b.y ||
        a.x - b.x,
    );
  for (const approach of approaches) {
    if (pointEquals(companion, approach)) return null;
    const path = findPath(
      state.tiles,
      companion,
      approach,
      blocked,
      canUnlock,
    );
    if (path[0]) return path[0];
  }
  return null;
};

const enemyEngagedWithParty = (state: GameState, enemy: Enemy) => {
  const party = [state.player, ...(state.companions ?? []).filter(
    (companion) => companion.hp > 0,
  )];
  return party.some((actor) => {
    const separation = distance(enemy, actor);
    if (separation <= 1) return true;
    return Boolean(
      enemy.alerted &&
        !enemy.sleeping &&
        separation <= 10 &&
        hasLineOfSight(state.tiles, enemy, actor),
    );
  });
};

const companionMeleeAttack = (
  state: GameState,
  companion: Companion,
  target: Enemy,
  motions: Motion[],
  effects: CombatEffect[],
  signals: StatusSignal[],
) => {
  const wasSleeping = target.sleeping;
  target.sleeping = false;
  target.alerted = true;
  if (wasSleeping) target.wakeCooldown = Math.max(1, target.wakeCooldown);
  if (wasSleeping) {
    signals.push({
      x: target.x,
      y: target.y,
      text: "!",
      color: "#f2d487",
      sourceId: target.id,
      holdUntilTurnEnd: true,
    });
  }
  target.lastSeenPlayer = { x: companion.x, y: companion.y };
  companion.facing = companionDirection(companion, target);
  motions.push({
    id: companion.id,
    from: { x: companion.x, y: companion.y },
    to: { x: target.x, y: target.y },
    kind: "attack",
  });
  if (
    combatHit(
      state,
      getCompanionAccuracy(companion),
      target.evasion,
      wasSleeping,
    )
  ) {
    const damage = Math.max(
      1,
      getCompanionAttack(companion) -
        target.defense +
        randomInt(state, -1, 1),
    );
    target.hp -= damage;
    effects.push({
      x: target.x,
      y: target.y,
      text: `-${damage}`,
      color: "#ffe3a1",
      kind: "damage",
      sourceId: companion.id,
    });
    pushLog(
      state,
      `${companion.name}이(가) ${getEnemyLabel(target)}에게 ${damage} 피해를 입혔습니다.`,
    );
  } else {
    effects.push({
      x: target.x,
      y: target.y,
      text: "회피!",
      color: "#b9e5ff",
      sourceId: companion.id,
    });
  }
};

const runCompanionActions = (
  state: GameState,
  motions: Motion[],
  effects: CombatEffect[],
  signals: StatusSignal[],
  pickups: ItemPickup[],
) => {
  (state.companions ?? []).forEach((companion) => {
    companion.command = "follow";
    companion.exploreTarget = null;
    companion.commandTargetId = null;
  });
  const retreatingIds = new Set(
    (state.companions ?? [])
      .filter(
        (companion) =>
          companion.hp > 0 &&
          companion.hp / Math.max(1, companion.maxHp) < 0.2,
      )
      .map((companion) => companion.id),
  );
  const followers = (state.companions ?? []).filter(
    (companion) => companion.hp > 0,
  );
  const movePlans: CompanionMovePlan[] = [];
  const reservedDestinations = new Set<string>();
  const queueMove = (companion: Companion, destination: Point | null) => {
    if (!destination) return false;
    const key = mapPointKey(destination);
    if (
      key === mapPointKey(state.player) ||
      key === mapPointKey(companion) ||
      reservedDestinations.has(key)
    ) {
      return false;
    }
    reservedDestinations.add(key);
    movePlans.push({ companion, destination });
    return true;
  };
  const actionOrder = [...(state.companions ?? [])];
  for (const companion of actionOrder) {
    if (companion.hp <= 0) continue;
    const hpBeforeStatuses = companion.hp;
    const incapacitated = statusDamage(companion, effects);
    if (companion.hp <= 0) {
      if (hpBeforeStatuses > 0) {
        effects.push({
          x: companion.x,
          y: companion.y,
          text: "전투 불능!",
          color: "#d8a0a0",
          kind: "defeat",
          sourceId: "status",
        });
        pushLog(state, `${companion.name}이(가) 상태이상 피해로 쓰러졌습니다.`);
      }
      continue;
    }
    if (incapacitated) continue;
    if ((companion.actionCooldown ?? 0) > 0) {
      companion.actionCooldown -= 1;
      continue;
    }
    const targetCandidates = state.enemies
      .filter(
        (enemy) =>
          enemy.hp > 0 &&
          !hasStatus(enemy, "corrupted") &&
          ((distance(enemy, companion) <= getCompanionViewDistance(companion) &&
            hasLineOfSight(state.tiles, companion, enemy)) ||
            enemyEngagedWithParty(state, enemy)),
      )
      .sort(
        (a, b) => {
          const visibleA =
            distance(a, companion) <= getCompanionViewDistance(companion) &&
            hasLineOfSight(state.tiles, companion, a);
          const visibleB =
            distance(b, companion) <= getCompanionViewDistance(companion) &&
            hasLineOfSight(state.tiles, companion, b);
          return (
            Number(!visibleA) - Number(!visibleB) ||
          distance(a, companion) - distance(b, companion) ||
            a.hp - b.hp ||
            a.id.localeCompare(b.id)
          );
        },
      );
    const adjacentTarget = targetCandidates.find(
      (target) => distance(companion, target) <= 1,
    );
    if (adjacentTarget) {
      companionMeleeAttack(
        state,
        companion,
        adjacentTarget,
        motions,
        effects,
        signals,
      );
      continue;
    }

    const priorityTarget = companion.priorityTarget;
    if (priorityTarget) {
      const tile = state.tiles[priorityTarget.y]?.[priorityTarget.x];
      if (
        pointEquals(companion, priorityTarget) ||
        !tile ||
        !tile.discovered ||
        !isWalkable(
          tile.terrain,
          (state.player.inventory.iron_key ?? 0) > 0,
        )
      ) {
        companion.priorityTarget = null;
      } else if (!hasStatus(companion, "rooted")) {
        const destination = nextCompanionStepToward(
          state,
          companion,
          priorityTarget,
          reservedDestinations,
          (state.player.inventory.iron_key ?? 0) > 0,
        );
        if (queueMove(companion, destination)) continue;
        companion.priorityTarget = null;
      }
    }

    let actedInCombat = false;
    for (const target of targetCandidates) {
      if (
        retreatingIds.has(companion.id) &&
        distance(target, companion) > 1
      ) {
        continue;
      }
      if (hasStatus(companion, "rooted")) break;
      const destination = nextCompanionStepToward(
        state,
        companion,
        target,
        reservedDestinations,
        false,
      );
      if (queueMove(companion, destination)) {
        actedInCombat = true;
        break;
      }
    }
    if (actedInCombat) continue;

    if (pickupGroundItemsForCompanion(state, companion, motions, pickups)) {
      continue;
    }

    if (hasStatus(companion, "rooted")) continue;

    const followerIndex = followers.findIndex(
      (candidate) => candidate.id === companion.id,
    );
    const destinationTarget = followerTarget(
      state,
      companion,
      Math.max(0, followerIndex),
    );
    if (
      !destinationTarget ||
      mapPointKey(destinationTarget) === mapPointKey(companion)
    ) {
      continue;
    }
    const destination = nextCompanionStepToward(
      state,
      companion,
      destinationTarget,
      reservedDestinations,
      (state.player.inventory.iron_key ?? 0) > 0,
      true,
    );
    queueMove(companion, destination);
  }
  return resolveCompanionMovePlans(state, movePlans, motions);
};

const rechargeWandInstance = (
  instance: InventoryInstance | null | undefined,
  progressPerTurn: number,
) => {
  if (!instance || ITEM_DEFS[instance.defId]?.category !== "wand") return;
  const maximum = instance.maxCharges ?? 3;
  const current = instance.charges ?? maximum;
  if (current >= maximum) {
    instance.charges = maximum;
    instance.rechargeProgress = 0;
    return;
  }
  const progress = (instance.rechargeProgress ?? 0) + progressPerTurn;
  const recovered = Math.floor(progress / WAND_RECHARGE_TURNS);
  instance.charges = Math.min(maximum, current + recovered);
  instance.rechargeProgress =
    instance.charges >= maximum
      ? 0
      : progress % WAND_RECHARGE_TURNS;
};

export const advanceWandRecharge = (state: GameState) => {
  const playerRate = (state.player.statuses ?? []).some(
    (status) => status.id === "recharging",
  )
    ? 5
    : 1;
  const seen = new Set<string>();
  [
    ...(state.player.inventoryInstances ?? []),
    ...Object.values(state.player.equipmentInstances ?? {}),
  ].forEach((instance) => {
    if (!instance || seen.has(instance.id)) return;
    seen.add(instance.id);
    rechargeWandInstance(instance, playerRate);
  });
  (state.companions ?? []).forEach((companion) => {
    companion.autoSlots.forEach((slot) => {
      if (slot?.instance) rechargeWandInstance(slot.instance, 1);
    });
  });
};

export const hungerRecoveryRate = (hunger: number) => {
  if (hunger >= 70) return 0.2;
  if (hunger >= 50) return 0.1;
  if (hunger >= 20) return 0.05;
  if (hunger >= 10) return 0;
  return -0.05;
};

const applyRecoveryTick = (
  actor: { hp: number; maxHp: number; recoveryProgress: number },
  rate: number,
  onChange: (amount: number) => void,
  invincible = false,
) => {
  if (rate > 0 && actor.hp >= actor.maxHp) {
    actor.recoveryProgress = 0;
    return;
  }
  if (rate < 0 && invincible) {
    actor.recoveryProgress = 0;
    return;
  }
  actor.recoveryProgress = (actor.recoveryProgress ?? 0) + rate;
  if (actor.recoveryProgress >= 1) {
    const amount = Math.min(
      Math.floor(actor.recoveryProgress),
      actor.maxHp - actor.hp,
    );
    if (amount > 0) {
      actor.hp += amount;
      actor.recoveryProgress -= amount;
      onChange(amount);
    }
  } else if (actor.recoveryProgress <= -1) {
    const amount = Math.min(
      Math.floor(-actor.recoveryProgress),
      actor.hp,
    );
    if (amount > 0) {
      actor.hp -= amount;
      actor.recoveryProgress += amount;
      onChange(-amount);
    }
  }
};

export const advanceHungerAndRecovery = (
  state: GameState,
  effects: CombatEffect[] = [],
  playerInvincible = false,
) => {
  state.player.hunger = Math.max(
    0,
    Math.min(100, state.player.hunger ?? 100),
  );
  state.player.hungerTurns = (state.player.hungerTurns ?? 0) + 1;
  if (state.player.hungerTurns >= 10) {
    const consumed = Math.floor(state.player.hungerTurns / 10);
    state.player.hunger = Math.max(0, state.player.hunger - consumed);
    state.player.hungerTurns %= 10;
  }
  const rate = hungerRecoveryRate(state.player.hunger);
  applyRecoveryTick(
    state.player,
    rate,
    (amount) => {
      effects.push({
        x: state.player.x,
        y: state.player.y,
        text: amount > 0 ? `+${amount}` : `${amount}`,
        color: amount > 0 ? "#78df8b" : "#c97863",
        kind: amount > 0 ? "healing" : "damage",
        sourceId: "hunger",
      });
    },
    playerInvincible,
  );
  (state.companions ?? []).forEach((companion) => {
    if (companion.hp <= 0) return;
    const previousHp = companion.hp;
    applyRecoveryTick(companion, rate, (amount) => {
      effects.push({
        x: companion.x,
        y: companion.y,
        text: amount > 0 ? `+${amount}` : `${amount}`,
        color: amount > 0 ? "#78df8b" : "#c97863",
        kind: amount > 0 ? "healing" : "damage",
        sourceId: "hunger",
      });
    });
    if (previousHp > 0 && companion.hp <= 0) {
      effects.push({
        x: companion.x,
        y: companion.y,
        text: "전투 불능!",
        color: "#d8a0a0",
        kind: "defeat",
        sourceId: "hunger",
      });
      pushLog(state, `${companion.name}이(가) 굶주림으로 쓰러졌습니다.`);
    }
  });
};

export function runEnemyTurn(
  state: GameState,
  options: {
    playerInvincible?: boolean;
    manualParty?: boolean;
  } = {},
): ActionResult {
  const next = cloneGame(state);
  const motions: Motion[] = [];
  const effects: CombatEffect[] = [];
  const signals: StatusSignal[] = [];
  const magicVisuals: MagicVisual[] = [];
  const wandSoundIds: string[] = [];
  const pickups: ItemPickup[] = [];
  const throws: ItemThrow[] = [];
  const soundCues: GameSoundCue[] = [];
  extinguishOrIgniteBurningActors(next, effects);
  applyClouds(next, effects, magicVisuals);
  for (const ward of next.wards ?? []) {
    const target = next.enemies
      .filter((enemy) => distance(enemy, ward) <= 4)
      .sort((a, b) => distance(a, ward) - distance(b, ward))[0];
    if (target) {
      target.hp -= ward.power;
      effects.push({
        x: target.x,
        y: target.y,
        text: `-${ward.power}`,
        color: "#b99cff",
        kind: "damage",
        sourceId: ward.id,
      });
    }
  }
  next.wards = (next.wards ?? [])
    .map((ward) => ({ ...ward, turns: ward.turns - 1 }))
    .filter((ward) => ward.turns > 0);
  let companionOpenedDoor = false;
  if (options.manualParty) {
    (next.companions ?? []).forEach((companion) => {
      if (companion.hp <= 0) return;
      const hpBefore = companion.hp;
      statusDamage(companion, effects);
      companion.actionCooldown = 0;
      if (hpBefore > 0 && companion.hp <= 0) {
        effects.push({
          x: companion.x,
          y: companion.y,
          text: "전투 불능!",
          color: "#d8a0a0",
          kind: "defeat",
          sourceId: "status",
        });
        pushLog(next, `${companion.name}이(가) 상태이상 피해로 쓰러졌습니다.`);
      }
    });
  } else {
    companionOpenedDoor = runCompanionActions(
      next,
      motions,
      effects,
      signals,
      pickups,
    );
  }
  const companionDefeatedIds = removeDefeatedEnemies(
    next,
    effects,
    true,
  );
  const sightAtTurnStart = new Map(
    next.enemies.map((enemy) => [
      enemy.id,
      {
        enemySawPlayer:
          next.player.invisibleTurns <= 0 && enemyCanSeePlayer(next, enemy),
        seenCompanion:
          (next.companions ?? [])
            .filter(
              (companion) =>
                companion.hp > 0 &&
                distance(enemy, companion) <= 8 &&
                hasLineOfSight(next.tiles, enemy, companion),
            )
            .sort(
              (a, b) =>
                distance(a, enemy) - distance(b, enemy),
            )[0] ?? null,
        playerSawEnemy:
          next.tiles[enemy.y][enemy.x].visible &&
          hasLineOfSight(next.tiles, next.player, enemy),
      },
    ]),
  );

  for (const enemy of next.enemies) {
    if (next.player.hp <= 0) break;
    if (statusDamage(enemy, effects) || enemy.hp <= 0) continue;
    const playerInvisible = next.player.invisibleTurns > 0;
    const turnSight = sightAtTurnStart.get(enemy.id);
    const enemySawPlayer = turnSight?.enemySawPlayer ?? false;
    const seenCompanion = turnSight?.seenCompanion ?? null;
    const playerSawEnemy = turnSight?.playerSawEnemy ?? false;
    const sawPlayerBeforeTurn = enemy.sawPlayerLastTurn;

    if (enemy.wakeCooldown > 0) {
      enemy.wakeCooldown -= 1;
      enemy.sawPlayerLastTurn = enemySawPlayer;
      if (enemySawPlayer) {
        enemy.lastSeenPlayer = { x: next.player.x, y: next.player.y };
      } else if (seenCompanion) {
        enemy.lastSeenPlayer = {
          x: seenCompanion.x,
          y: seenCompanion.y,
        };
      }
      continue;
    }

    if (enemy.sleeping) {
      enemy.sawPlayerLastTurn = false;
      const wakeTarget =
        enemySawPlayer
          ? next.player
          : seenCompanion;
      const range = wakeTarget
        ? distance(enemy, wakeTarget)
        : Number.POSITIVE_INFINITY;
      if (
        wakeTarget &&
        (enemySawPlayer ? !playerInvisible : true) &&
        random(next) < getEnemyWakeChance(range)
      ) {
        enemy.sleeping = false;
        enemy.alerted = true;
        enemy.sawPlayerLastTurn = true;
        enemy.lastSeenPlayer = {
          x: wakeTarget.x,
          y: wakeTarget.y,
        };
        enemy.searchTurns = 0;
        pushLog(next, `${getEnemyLabel(enemy)}이(가) 잠에서 깨어났습니다.`);
        signals.push({
          x: enemy.x,
          y: enemy.y,
          text: "!",
          color: "#f2d487",
          sourceId: enemy.id,
          holdUntilTurnEnd: true,
        });
      }
      continue;
    }

    if (hasStatus(enemy, "corrupted")) {
      enemy.alerted = false;
      enemy.lastSeenPlayer = null;
      const allyTarget = next.enemies
        .filter(
          (candidate) =>
            candidate.id !== enemy.id &&
            candidate.hp > 0 &&
            !hasStatus(candidate, "corrupted"),
        )
        .sort((a, b) => distance(a, enemy) - distance(b, enemy))[0];
      if (!allyTarget) continue;
      if (distance(enemy, allyTarget) <= 1) {
        motions.push({
          id: enemy.id,
          from: { x: enemy.x, y: enemy.y },
          to: { x: allyTarget.x, y: allyTarget.y },
          kind: "attack",
        });
        if (combatHit(next, enemy.accuracy, allyTarget.evasion, false)) {
          const amount = Math.max(
            1,
            enemy.attack - allyTarget.defense + randomInt(next, -1, 1),
          );
          allyTarget.hp -= amount;
          effects.push({
            x: allyTarget.x,
            y: allyTarget.y,
            text: `-${amount}`,
            color: "#d5adff",
            kind: "damage",
            sourceId: enemy.id,
          });
          pushLog(
            next,
            `타락한 ${getEnemyLabel(enemy)}이(가) ${getEnemyLabel(allyTarget)}을(를) 공격했습니다.`,
          );
        }
      } else {
        const blocked = enemyBlockedSet(next, enemy.id);
        blocked.delete(mapPointKey(allyTarget));
        const path = findPath(
          next.tiles,
          enemy,
          allyTarget,
          blocked,
          false,
        );
        const destination = path[0];
        if (destination && mapPointKey(destination) !== mapPointKey(allyTarget)) {
          const from = { x: enemy.x, y: enemy.y };
          enemy.x = destination.x;
          enemy.y = destination.y;
          trampleHighGrass(next, destination);
          motions.push({
            id: enemy.id,
            from,
            to: destination,
            kind: "move",
          });
        }
      }
      continue;
    }

    enemy.sawPlayerLastTurn = enemySawPlayer;
    if (enemySawPlayer) {
      enemy.alerted = true;
      enemy.lastSeenPlayer = { x: next.player.x, y: next.player.y };
      enemy.searchTurns = 0;
    } else if (seenCompanion) {
      enemy.alerted = true;
      enemy.lastSeenPlayer = {
        x: seenCompanion.x,
        y: seenCompanion.y,
      };
      enemy.searchTurns = 0;
    } else if (
      enemy.alerted &&
      sawPlayerBeforeTurn &&
      !enemy.lastSeenPlayer
    ) {
      // Compatibility for an already-alerted actor crossing a door boundary:
      // preserve a final target even if an older save lacks lastSeenPlayer.
      enemy.lastSeenPlayer = { x: next.player.x, y: next.player.y };
    }

    const range = distance(enemy, next.player);
    if (!playerInvisible && range <= 1) {
      if (hasStatus(enemy, "charmed")) continue;
      const surprise = !playerSawEnemy;
      const hit = combatHit(
        next,
        enemy.accuracy,
        getPlayerEvasion(next.player),
        surprise,
      );
      motions.push({
        id: enemy.id,
        from: { x: enemy.x, y: enemy.y },
        to: { x: next.player.x, y: next.player.y },
        kind: "attack",
      });
      if (hit) {
        const rolledDamage = reduceCharacterDamage(
          next.player,
          Math.max(
            1,
            enemy.attack - getPlayerDefense(next.player) + randomInt(next, -1, 1),
          ),
        );
        let damage = options.playerInvincible ? 0 : rolledDamage;
        if (next.player.shield > 0 && damage > 0) {
          const blocked = Math.min(next.player.shield, damage);
          next.player.shield -= blocked;
          damage -= blocked;
        }
        next.player.hp = Math.max(0, next.player.hp - damage);
        pushLog(
          next,
          surprise
            ? `${getEnemyLabel(enemy)}의 기습! ${options.playerInvincible ? "개발자 무적으로 피해를 무효화했습니다." : `${damage} 피해를 받았습니다.`}`
            : `${getEnemyLabel(enemy)}의 공격! ${options.playerInvincible ? "개발자 무적으로 피해를 무효화했습니다." : `${damage} 피해를 받았습니다.`}`,
        );
        if (surprise) {
          effects.push({
            x: next.player.x,
            y: next.player.y,
            text: "기습!",
            color: "#ffad69",
            sourceId: enemy.id,
          });
        }
        effects.push({
          x: next.player.x,
          y: next.player.y,
          text: options.playerInvincible ? "무효" : `-${damage}`,
          color: options.playerInvincible ? "#8ce7ff" : "#ff6969",
          kind: options.playerInvincible ? "blocked" : "damage",
          sourceId: enemy.id,
        });
      } else {
        pushLog(next, `${getEnemyLabel(enemy)}의 공격을 회피했습니다.`);
        effects.push({
          x: next.player.x,
          y: next.player.y,
          text: "회피!",
          color: "#b9e5ff",
          sourceId: enemy.id,
        });
      }
      continue;
    }

    const adjacentCompanion = (next.companions ?? [])
      .filter(
        (companion) =>
          companion.hp > 0 &&
          distance(enemy, companion) <= 1,
      )
      .sort(
        (a, b) =>
          a.hp / Math.max(1, a.maxHp) -
          b.hp / Math.max(1, b.maxHp),
      )[0];
    if (adjacentCompanion) {
      if (hasStatus(enemy, "charmed")) continue;
      const hit = combatHit(
        next,
        enemy.accuracy,
        getCompanionEvasion(adjacentCompanion),
        false,
      );
      motions.push({
        id: enemy.id,
        from: { x: enemy.x, y: enemy.y },
        to: {
          x: adjacentCompanion.x,
          y: adjacentCompanion.y,
        },
        kind: "attack",
      });
      if (hit) {
        const damage = reduceCharacterDamage(
          adjacentCompanion,
          Math.max(
            1,
            enemy.attack -
              getCompanionDefense(adjacentCompanion) +
              randomInt(next, -1, 1),
          ),
        );
        adjacentCompanion.hp = Math.max(0, adjacentCompanion.hp - damage);
        effects.push({
          x: adjacentCompanion.x,
          y: adjacentCompanion.y,
          text: `-${damage}`,
          color: "#ff8d7c",
          kind: "damage",
          sourceId: enemy.id,
        });
        pushLog(
          next,
          `${getEnemyLabel(enemy)}이(가) ${adjacentCompanion.name}에게 ${damage} 피해를 입혔습니다.`,
        );
        if (adjacentCompanion.hp <= 0) {
          effects.push({
            x: adjacentCompanion.x,
            y: adjacentCompanion.y,
            text: "전투 불능!",
            color: "#d8a0a0",
            kind: "defeat",
            sourceId: enemy.id,
          });
          pushLog(
            next,
            `${adjacentCompanion.name}이(가) 전투 불능 상태가 되었습니다.`,
          );
        }
      } else {
        effects.push({
          x: adjacentCompanion.x,
          y: adjacentCompanion.y,
          text: "회피!",
          color: "#b9e5ff",
          sourceId: enemy.id,
        });
      }
      continue;
    }

    let destination: Point | null = null;
    if (hasStatus(enemy, "terrified")) {
      destination = [...DIRECTIONS]
        .map((direction) => ({
          x: enemy.x + direction.x,
          y: enemy.y + direction.y,
        }))
        .filter(
          (point) =>
            inBounds(next, point) &&
            isWalkable(next.tiles[point.y][point.x].terrain, false) &&
            !enemyBlockedSet(next, enemy.id).has(mapPointKey(point)),
        )
        .sort((a, b) => distance(b, next.player) - distance(a, next.player))[0] ?? null;
    } else if (hasStatus(enemy, "rooted")) {
      destination = null;
      continue;
    } else
    if (
      enemy.alerted &&
      enemy.lastSeenPlayer &&
      mapPointKey(enemy) === mapPointKey(enemy.lastSeenPlayer) &&
      !enemySawPlayer
    ) {
      enemy.alerted = false;
      enemy.lastSeenPlayer = null;
      enemy.searchTurns = randomInt(next, 1, 2);
      pushLog(next, `${getEnemyLabel(enemy)}이(가) 마지막 흔적을 놓쳤습니다.`);
      signals.push({
        x: enemy.x,
        y: enemy.y,
        text: "?",
        color: "#a9d7e3",
        sourceId: enemy.id,
        holdUntilTurnEnd: true,
      });
    } else if (enemy.alerted && enemy.lastSeenPlayer) {
      const path = findPath(
        next.tiles,
        enemy,
        enemy.lastSeenPlayer,
        enemyBlockedSet(next, enemy.id),
        false,
      );
      if (path.length && mapPointKey(path[0]) !== mapPointKey(next.player)) {
        destination = path[0];
      }
    } else if (enemy.searchTurns > 0) {
      enemy.searchTurns -= 1;
    } else if (random(next) < 0.28) {
      const shuffled = [...DIRECTIONS].sort(() => random(next) - 0.5);
      destination =
        shuffled
          .map((direction) => ({
            x: enemy.x + direction.x,
            y: enemy.y + direction.y,
          }))
          .find(
            (point) =>
              inBounds(next, point) &&
              isWalkable(next.tiles[point.y][point.x].terrain, false) &&
              !enemyBlockedSet(next, enemy.id).has(mapPointKey(point)) &&
              mapPointKey(point) !== mapPointKey(next.player),
          ) ?? null;
    }

    if (destination) {
      const from = { x: enemy.x, y: enemy.y };
      enemy.x = destination.x;
      enemy.y = destination.y;
      if (next.tiles[enemy.y][enemy.x].terrain === "door") {
        next.tiles[enemy.y][enemy.x].terrain = "openDoor";
      }
      trampleHighGrass(next, destination);
      motions.push({ id: enemy.id, from, to: destination, kind: "move" });
    }
  }

  if (next.player.invisibleTurns > 0) next.player.invisibleTurns -= 1;
  extinguishOrIgniteBurningActors(next, effects);
  tickPlayerStatuses(next, effects);
  advanceWandRecharge(next);
  advanceCompanionSkillCooldowns(next);
  advanceHungerAndRecovery(next, effects, options.playerInvincible);
  const defeatedIds = [
    ...companionDefeatedIds,
    ...removeDefeatedEnemies(next, effects, false),
  ];
  if (next.player.hp <= 0) {
    next.gameOver = true;
    pushLog(next, "시야가 어두워집니다. 이번 탐사는 여기까지입니다.");
  }
  updatePlayerFieldOfView(next);
  return {
    state: next,
    motions,
    effects,
    signals,
    pickups,
    throws,
    magicVisuals,
    wandSoundIds,
    soundCues: [
      ...soundCues,
      ...(companionOpenedDoor
        ? [{ id: "doorOpen" as const, atResolution: true, volume: 0.42 }]
        : []),
    ],
    defeatedIds,
    consumedTurn: false,
  };
}

const consumeInventoryItem = (state: GameState, itemRef: string) => {
  removeInventoryItem(state, itemRef);
};

const selectedAlchemyIngredients = (
  state: GameState,
  itemRefs: string[],
) => {
  if (itemRefs.length < 2 || itemRefs.length > 3) return null;
  const refCounts = new Map<string, number>();
  itemRefs.forEach((itemRef) =>
    refCounts.set(itemRef, (refCounts.get(itemRef) ?? 0) + 1),
  );
  for (const [itemRef, count] of refCounts) {
    const resolved = resolveInventoryItem(state.player, itemRef);
    const available = resolved.individual
      ? resolved.instance ? 1 : 0
      : state.player.inventory[resolved.defId] ?? 0;
    if (count > available) return null;
  }
  return itemRefs.map((itemRef) => {
    const resolved = resolveInventoryItem(state.player, itemRef);
    const definition = ITEM_DEFS[resolved.defId];
    return definition
      ? {
          itemRef,
          defId: resolved.defId,
          category: definition.category,
          upgradeable: isUpgradeableEquipment(definition),
        }
      : null;
  }).filter((ingredient): ingredient is NonNullable<typeof ingredient> => Boolean(ingredient));
};

export const previewAlchemy = (
  state: GameState,
  itemRefs: string[],
): AlchemyFormula | null => {
  const ingredients = selectedAlchemyIngredients(state, itemRefs);
  if (!ingredients || ingredients.length !== itemRefs.length) return null;
  return resolveAlchemyFormula(ingredients);
};

const clearPartyEquipmentCurses = (state: GameState) => {
  const cleansedIds = new Set<string>();
  let cleansed = 0;
  const clear = (instance: InventoryInstance | null | undefined) => {
    if (!instance?.cursed) return;
    instance.cursed = false;
    if (!cleansedIds.has(instance.id)) {
      cleansedIds.add(instance.id);
      cleansed += 1;
    }
  };
  (state.player.inventoryInstances ?? []).forEach(clear);
  Object.values(state.player.throwableProfiles ?? {}).forEach(clear);
  Object.values(state.player.equipmentInstances ?? {}).forEach(clear);
  (state.companions ?? []).forEach((companion) => {
    Object.values(companion.equipmentInstances ?? {}).forEach(clear);
    companion.autoSlots.forEach((slot) => clear(slot?.instance));
  });
  return cleansed;
};

export function performAlchemy(
  state: GameState,
  itemRefs: string[],
): ActionResult {
  const nearWorkbench = state.objects.some(
    (object) =>
      object.kind === "alchemy" &&
      !object.looted &&
      distance(object, state.player) <= 1,
  );
  const formula = previewAlchemy(state, itemRefs);
  if (state.gameOver || !nearWorkbench || !formula) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const next = cloneGameWithoutTiles(state);
  const effects: CombatEffect[] = [];
  if (formula.kind === "enchant") {
    const target = resolveInventoryItem(next.player, formula.targetItemRef);
    const definition = ITEM_DEFS[target.defId];
    if (!target.instance || !isUpgradeableEquipment(definition)) {
      return { state, motions: [], effects: [], consumedTurn: false };
    }
    itemRefs
      .filter((itemRef) => itemRef !== formula.targetItemRef)
      .forEach((itemRef) => removeInventoryItem(next, itemRef));
    if (formula.upgrade) upgradeEquipmentInstance(target.instance);
    const traitId = enchantEquipmentInstance(
      target.instance,
      definition,
      () => random(next),
    );
    if (!traitId) {
      return { state, motions: [], effects: [], consumedTurn: false };
    }
    const trait = EQUIPMENT_TRAITS[traitId];
    pushLog(
      next,
      `${definition.name}에 ${trait.name} 특성이 연금되었습니다.${formula.upgrade ? " 강화 수치도 1 올랐습니다." : ""}`,
    );
    effects.push({
      x: next.player.x,
      y: next.player.y,
      text: formula.upgrade ? "강화 연금!" : "인챈트!",
      color: trait.accent,
    });
  } else {
    itemRefs.forEach((itemRef) => removeInventoryItem(next, itemRef));
    const added = addInventoryItem(
      next,
      formula.outputDefId,
      `alchemy-${next.turn}`,
      undefined,
      formula.quantity,
    );
    if (!added) {
      return { state, motions: [], effects: [], consumedTurn: false };
    }
    const output = ITEM_DEFS[formula.outputDefId];
    pushLog(next, `연금술로 ${output.name}을(를) 만들었습니다.`);
    effects.push({
      x: next.player.x,
      y: next.player.y,
      text: output.name,
      color: output.accent,
    });
  }
  const elapsedTurns = spendPlayerTime(next, 1);
  return {
    state: next,
    presentationState: state,
    motions: [],
    effects,
    consumedTurn: true,
    elapsedTurns,
    interacted: true,
    enchanted: formula.kind === "enchant",
    soundCues: [{ id: "item", atResolution: true, volume: 0.7 }],
  };
}

const damageEnemiesInRange = (
  state: GameState,
  radius: number,
  damage: (enemy: Enemy) => number,
  visibleOnly: boolean,
  effects: CombatEffect[],
) => {
  state.enemies.forEach((enemy) => {
    if (
      distance(enemy, state.player) <= radius &&
      (!visibleOnly || state.tiles[enemy.y][enemy.x].visible)
    ) {
      const amount = damage(enemy);
      enemy.hp -= amount;
      effects.push({
        x: enemy.x,
        y: enemy.y,
        text: `-${amount}`,
        color: "#9deaff",
        kind: "damage",
      });
    }
  });
  return removeDefeatedEnemies(state, effects, false);
};

export function useItem(state: GameState, defId: string): ActionResult {
  const definition = ITEM_DEFS[defId];
  const quantity = state.player.inventory[defId] ?? 0;
  if (!definition || quantity <= 0) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  if (
    ![
      "potion",
      "scroll",
      "food",
      "brew",
      "elixir",
      "bomb",
      "seed",
      "stone",
    ].includes(definition.category)
  ) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const incapacitated = consumeIncapacitatedPlayerTurn(state);
  if (incapacitated) return incapacitated;
  if (defId === "scroll_upgrade") {
    const next = cloneGameWithoutTiles(state);
    pushLog(next, "강화의 주문서를 적용할 장비를 선택하세요.");
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }

  const next = cloneGame(state);
  const presentationState = state;
  const motions: Motion[] = [];
  const effects: CombatEffect[] = [];
  let defeatedIds: string[] = [];
  const effect = definition.effect;
  const power = definition.power ?? definition.heal ?? 6;
  const addPlayerStatus = (id: StatusEffectId, turns: number, value = 1) =>
    addStatus(next.player.statuses, id, turns, value);
  const addVisibleEnemyStatus = (
    id: StatusEffectId,
    turns: number,
    value = 1,
  ) => {
    next.enemies.forEach((enemy) => {
      if (next.tiles[enemy.y][enemy.x].visible) {
        enemy.sleeping = false;
        addStatus(enemy.statuses, id, turns, value);
      }
    });
  };

  if (definition.category === "food") {
    if ((next.player.hunger ?? 100) >= 100) {
      pushLog(next, "배가 불러 지금은 음식을 더 먹을 수 없습니다.");
      return { state: next, motions, effects, consumedTurn: false };
    }
    const mealMultiplier =
      1 + augmentRank(next.player, "heartyMeal") * 0.25;
    const satiation = Math.max(
      1,
      Math.ceil((definition.satiation ?? Math.max(10, power * 5)) * mealMultiplier),
    );
    const before = next.player.hunger ?? 100;
    next.player.hunger = Math.min(100, before + satiation);
    const restored = next.player.hunger - before;
    pushLog(next, `${definition.name}을(를) 먹어 허기 ${restored}을 회복했습니다.`);
    effects.push({
      x: next.player.x,
      y: next.player.y,
      text: `허기 +${restored}`,
      color: "#e1bd72",
    });
  } else if (defId === "potion_paralytic_gas") {
    createCloud(next, "paralytic", next.player, 6, 1, 3, 3);
    pushLog(next, "마비 가스가 주변으로 무겁게 퍼집니다.");
  } else if (defId === "potion_toxic_gas") {
    createCloud(next, "toxic", next.player, 7, 2, 4, 3);
    pushLog(next, "유독 가스가 주변을 뒤덮습니다.");
  } else if (defId === "potion_corrosive_gas") {
    createCloud(next, "corrosive", next.player, 7, 2, 4, 2);
    pushLog(next, "부식성 가스가 갑옷과 살을 녹이기 시작합니다.");
  } else if (defId === "potion_liquid_flame") {
    const created = createCloud(next, "fire", next.player, 6, 2, 4, 4);
    next.enemies
      .filter((enemy) => distance(enemy, next.player) <= 2)
      .forEach((enemy) => addStatus(enemy.statuses, "burning", 4, 2));
    pushLog(
      next,
      created
        ? "액체 불꽃이 바닥을 타고 번집니다."
        : "액체 불꽃이 물에 닿자마자 식었습니다.",
    );
  } else if (defId === "potion_snap_freeze") {
    createCloud(next, "frost", next.player, 5, 1, 4, 4);
    next.enemies
      .filter((enemy) => distance(enemy, next.player) <= 3)
      .forEach((enemy) => addStatus(enemy.statuses, "frozen", 2, 1));
    pushLog(next, "순간적인 혹한이 주변을 얼려붙게 만듭니다.");
  } else if (defId === "potion_storm_clouds") {
    createCloud(next, "storm", next.player, 7, 2, 5, 3);
    pushLog(next, "검푸른 폭풍 구름이 던전 안에 모여듭니다.");
  } else if (defId === "potion_haste" || defId === "potion_stamina") {
    addPlayerStatus(defId === "potion_haste" ? "haste" : "stamina", 8, 1);
    pushLog(next, "몸놀림이 놀랍도록 가벼워졌습니다.");
  } else if (defId === "potion_levitation") {
    addPlayerStatus("levitating", 10, 1);
    pushLog(next, "몸이 바닥에서 가볍게 떠오릅니다.");
  } else if (defId === "potion_mind_vision") {
    addPlayerStatus("mindVision", 12, 1);
    next.enemies.forEach((enemy) => {
      next.tiles[enemy.y][enemy.x].discovered = true;
      next.tiles[enemy.y][enemy.x].discoveredMask = 15;
    });
    pushLog(next, "던전 안 모든 생명체의 정신이 느껴집니다.");
  } else if (defId === "potion_magical_sight") {
    addPlayerStatus("magicSight", 12, 1);
    updatePlayerFieldOfView(next, true);
    pushLog(next, "벽 너머까지 꿰뚫는 마법 시야가 열렸습니다.");
  } else if (defId === "potion_shielding") {
    next.player.shield += 12;
    addPlayerStatus("shielded", 12, 1);
    pushLog(next, "푸른 보호막이 몸을 감쌉니다.");
  } else if (defId === "potion_earthen_armor") {
    next.player.shield += 8;
    addPlayerStatus("earthenArmor", 16, 2);
    pushLog(next, "돌가죽이 몸을 덮어 피해를 막아냅니다.");
  } else if (defId === "potion_dragons_breath") {
    addPlayerStatus("burning", 1, 0);
    next.enemies
      .filter((enemy) => distance(enemy, next.player) <= 4)
      .forEach((enemy) => addStatus(enemy.statuses, "burning", 5, 3));
    pushLog(next, "용의 숨결이 시야 앞을 불태웁니다.");
  } else if (defId === "potion_purity" || defId === "potion_cleansing") {
    next.player.statuses = next.player.statuses.filter((status) =>
      ["haste", "levitating", "mindVision", "magicSight", "shielded", "earthenArmor", "recharging", "foresight", "stamina"].includes(status.id),
    );
    addPlayerStatus("purified", 12, 1);
    next.clouds = next.clouds.filter(
      (cloud) => cloud.kind !== "toxic" && cloud.kind !== "corrosive",
    );
    pushLog(next, "모든 해로운 상태가 깨끗하게 씻겨 나갔습니다.");
  } else if (defId === "potion_adrenaline_surge") {
    addPlayerStatus("stamina", 12, 2);
    addPlayerStatus("haste", 5, 1);
    pushLog(next, "아드레날린이 솟구쳐 공격력과 몸놀림이 강화됩니다.");
  } else if (defId === "potion_holy_furor") {
    addPlayerStatus("challenge", 10, 3);
    defeatedIds = damageEnemiesInRange(
      next,
      20,
      () => randomInt(next, 7, 11),
      true,
      effects,
    );
    pushLog(next, "신성한 분노가 시야 안의 적들을 심판합니다.");
  } else if (defId === "potion_divine_inspiration") {
    const gained = Math.max(8, Math.ceil(next.player.nextXp * 0.8));
    gainXp(next, gained);
    pushLog(next, "신성한 영감이 원정대에 풍부한 경험을 전해 줍니다.");
  } else if (defId === "scroll_identify") {
    updatePlayerFieldOfView(next, true);
    pushLog(next, "보유한 물품의 성질과 현재 층의 지형을 완전히 파악했습니다.");
  } else if (defId === "scroll_transmutation") {
    const candidates = Object.keys(next.player.inventory).filter(
      (itemId) =>
        itemId !== defId &&
        (next.player.inventory[itemId] ?? 0) > 0 &&
        ITEM_DEFS[itemId]?.category !== "key",
    );
    const sourceId = candidates[randomInt(next, 0, Math.max(0, candidates.length - 1))];
    if (sourceId) {
      const alternatives = Object.keys(ITEM_DEFS).filter(
        (itemId) =>
          itemId !== sourceId &&
          ITEM_DEFS[itemId].category === ITEM_DEFS[sourceId].category,
      );
      const replacement =
        alternatives[randomInt(next, 0, Math.max(0, alternatives.length - 1))];
      if (replacement) {
        consumeInventoryItem(next, sourceId);
        next.player.inventory[replacement] =
          (next.player.inventory[replacement] ?? 0) + 1;
        pushLog(
          next,
          `${ITEM_DEFS[sourceId].name}이(가) ${ITEM_DEFS[replacement].name}(으)로 변했습니다.`,
        );
      }
    } else {
      pushLog(next, "변환할 수 있는 아이템이 없습니다.");
    }
  } else if (defId === "scroll_lullaby") {
    next.enemies.forEach((enemy) => {
      if (next.tiles[enemy.y][enemy.x].visible) {
        enemy.sleeping = true;
        enemy.alerted = false;
      }
    });
    pushLog(next, "고요한 선율에 시야 안의 적들이 잠듭니다.");
  } else if (defId === "scroll_terror" || defId === "scroll_dread") {
    addVisibleEnemyStatus("terrified", defId === "scroll_dread" ? 8 : 5, 1);
    pushLog(next, "섬뜩한 공포가 적들의 마음을 휘어잡습니다.");
  } else if (defId === "scroll_sirens_song") {
    addVisibleEnemyStatus("charmed", 7, 1);
    pushLog(next, "매혹적인 노래가 적들의 적의를 잠재웁니다.");
  } else if (defId === "scroll_recharging" || defId === "scroll_mystical_energy") {
    next.player.inventoryInstances.forEach((instance) => {
      if (isWand(instance.defId)) {
        instance.charges = instance.maxCharges ?? 3;
      }
    });
    addPlayerStatus("recharging", 8, 1);
    pushLog(next, "보유한 마법 지팡이에 다시 마력이 차오릅니다.");
  } else if (defId === "scroll_antimagic") {
    addPlayerStatus("antimagic", 10, 1);
    pushLog(next, "항마의 장막이 해로운 마법을 밀어냅니다.");
  } else if (defId === "scroll_foresight") {
    addPlayerStatus("foresight", 16, 1);
    updatePlayerFieldOfView(next, true);
    pushLog(next, "앞으로 마주칠 위험과 지형이 머릿속에 펼쳐집니다.");
  } else if (defId === "scroll_challenge") {
    addPlayerStatus("challenge", 10, 2);
    next.enemies.forEach((enemy) => {
      if (next.tiles[enemy.y][enemy.x].visible) {
        enemy.sleeping = false;
        enemy.alerted = true;
        enemy.lastSeenPlayer = { ...next.player };
      }
    });
    pushLog(next, "결투의 문장이 적들을 끌어당기고 방어를 강화합니다.");
  } else if (defId === "scroll_mirror_image" || defId === "scroll_prismatic_image") {
    next.player.shield += defId === "scroll_prismatic_image" ? 14 : 8;
    addPlayerStatus("shielded", 10, 1);
    pushLog(next, "환영이 공격을 대신 받아낼 준비를 합니다.");
  } else if (defId === "scroll_remove_curse") {
    const cleansedEquipment = clearPartyEquipmentCurses(next);
    next.player.statuses = next.player.statuses.filter((status) =>
      ["haste", "levitating", "mindVision", "magicSight", "shielded", "earthenArmor", "recharging", "foresight", "stamina"].includes(status.id),
    );
    pushLog(
      next,
      cleansedEquipment > 0
        ? `검은 저주가 원정대 장비 ${cleansedEquipment}개와 몸에서 벗겨집니다.`
        : "몸을 휘감던 검은 저주의 기운이 흩어집니다.",
    );
  } else if (
    defId === "scroll_retribution" ||
    defId === "scroll_psionic_blast"
  ) {
    defeatedIds = damageEnemiesInRange(
      next,
      20,
      () => randomInt(next, defId === "scroll_psionic_blast" ? 8 : 5, defId === "scroll_psionic_blast" ? 13 : 9),
      true,
      effects,
    );
    if (defId === "scroll_psionic_blast") addPlayerStatus("blinded", 3, 1);
    pushLog(next, "정신을 뒤흔드는 파동이 시야 안의 적을 강타합니다.");
  } else if (defId === "scroll_divination") {
    updatePlayerFieldOfView(next, true);
    pushLog(next, "아이템과 지형의 숨겨진 지식이 드러납니다.");
  } else if (defId === "scroll_metamorphosis") {
    gainXp(next, Math.max(5, Math.ceil(next.player.nextXp * 0.45)));
    pushLog(next, "변신의 마력이 원정대에 새로운 경험을 새깁니다.");
  } else if (defId === "scroll_passage") {
    const entrance = next.tiles.flatMap((row, y) =>
      row.flatMap((tile, x) =>
        tile.terrain === "entrance" ? [{ x, y }] : [],
      ),
    )[0];
    if (entrance) {
      const from = { x: next.player.x, y: next.player.y };
      next.player.x = entrance.x;
      next.player.y = entrance.y;
      motions.push({ id: PLAYER_ID, from, to: entrance, kind: "move" });
      updatePlayerFieldOfView(next);
    }
    pushLog(next, "공간이 접히며 이 층의 입구로 돌아왔습니다.");
  } else if (defId === "scroll_enchantment") {
    const weapon = ensureEquippedInstance(next, "weapon");
    if (weapon) {
      const result = enchantEquippedDirect(next, "weapon");
      if (result?.traitId) {
        pushLog(
          next,
          `${result.definition.name}에 ${EQUIPMENT_TRAITS[result.traitId].name} 특성이 새겨졌습니다.`,
        );
      } else {
        pushLog(next, "마법을 부여할 장착 무기가 없습니다.");
      }
    } else {
      pushLog(next, "마법을 부여할 장착 무기가 없습니다.");
    }
  } else if (effect === "heal") {
    if (next.player.hp >= next.player.maxHp) {
      pushLog(next, "지금은 생명력이 가득 차 있습니다.");
      return { state: next, motions, effects, consumedTurn: false };
    }
    const mealMultiplier =
      definition.category === "food"
        ? 1 + augmentRank(next.player, "heartyMeal") * 0.25
        : 1;
    const amount = Math.min(
      next.player.maxHp - next.player.hp,
      Math.ceil(power * mealMultiplier),
    );
    next.player.hp += amount;
    pushLog(next, `${definition.name}을(를) 사용해 생명력 ${amount}을 회복했습니다.`);
    effects.push({
      x: next.player.x,
      y: next.player.y,
      text: `+${amount}`,
      color: "#70e276",
    });
  } else if (effect === "strength") {
    next.player.baseAttack += 1;
    next.player.maxHp += 3;
    next.player.hp += 3;
    pushLog(next, "몸 안에 뜨거운 힘이 퍼집니다. 공격력과 최대 생명력이 올랐습니다.");
  } else if (effect === "invisibility") {
    next.player.invisibleTurns = 5;
    pushLog(next, "몸이 투명해졌습니다. 5턴 동안 적의 추적을 피합니다.");
  } else if (effect === "frost") {
    resolveSpecialTerrainFromCloud(next, "frost", next.player, 2);
    defeatedIds = damageEnemiesInRange(
      next,
      2,
      () => randomInt(next, Math.max(3, power - 2), power + 1),
      false,
      effects,
    );
    pushLog(next, "서리 폭풍이 주변의 적들을 휩쓸었습니다.");
  } else if (effect === "mapping" || effect === "vision") {
    updatePlayerFieldOfView(next, true);
    pushLog(next, "던전의 구조가 머릿속에 선명하게 새겨졌습니다.");
  } else if (effect === "teleport") {
    const candidates = openCellCandidates(next).filter(
      (point) => distance(point, next.player) >= 8,
    );
    const destination = chooseAndRemove(next, candidates);
    if (destination) {
      const from = { x: next.player.x, y: next.player.y };
      next.player.x = destination.x;
      next.player.y = destination.y;
      trampleHighGrass(next, destination, true);
      motions.push({ id: PLAYER_ID, from, to: destination, kind: "move" });
      updatePlayerFieldOfView(next);
    }
    pushLog(next, "공간이 접히며 다른 장소로 이동했습니다.");
  } else if (effect === "upgrade") {
    const equipped = (Object.keys(next.player.equipment) as EquipmentKey[])
      .filter((key) => next.player.equipment[key]);
    const target = equipped[Math.floor(random(next) * equipped.length)];
    const result = target
      ? enchantEquippedDirect(next, target, undefined, true)
      : null;
    if (result) {
      pushLog(
        next,
        `${result.definition.name}이(가) +${result.instance.upgradeLevel}로 강화되고 새로운 특성을 얻었습니다.`,
      );
    } else {
      pushLog(next, "강화할 장비가 없습니다.");
    }
  } else if (effect === "rage" || effect === "blast") {
    defeatedIds = damageEnemiesInRange(
      next,
      effect === "rage" ? 20 : 3,
      () => randomInt(next, Math.max(2, power - 2), power + 1),
      effect === "rage",
      effects,
    );
    pushLog(next, "붉은 파동이 시야 안의 적들을 뒤흔들었습니다.");
  } else if (effect === "experience") {
    const gained = Math.max(6, Math.ceil(next.player.nextXp * 0.65));
    gainXp(next, gained);
    pushLog(next, `${definition.name}에서 경험 ${gained}을 얻었습니다.`);
  } else if (effect === "cleanse") {
    next.player.invisibleTurns = 0;
    next.player.statuses = next.player.statuses.filter((status) =>
      ["haste", "levitating", "mindVision", "magicSight", "shielded", "earthenArmor", "recharging", "foresight", "challenge", "stamina"].includes(status.id),
    );
    const amount = Math.min(5, next.player.maxHp - next.player.hp);
    next.player.hp += amount;
    pushLog(next, "해로운 기운이 걷히고 몸이 가벼워졌습니다.");
  } else if (effect === "haste") {
    const amount = Math.min(3, next.player.maxHp - next.player.hp);
    next.player.hp += amount;
    addPlayerStatus("haste", 6, 1);
    pushLog(next, "짧은 시간 동안 몸놀림이 빨라졌습니다.");
  } else {
    pushLog(next, `${definition.name}을(를) 사용했습니다.`);
  }

  consumeInventoryItem(next, defId);
  const elapsedTurns = spendPlayerTime(next, 1);
  const soundCues = [
    definition.category === "potion" || definition.category === "elixir"
      ? { id: "drink" as const, atResolution: true }
      : definition.category === "scroll"
        ? { id: "read" as const, atResolution: true }
        : definition.category === "food"
          ? { id: "eat" as const, atResolution: true }
          : { id: "item" as const, atResolution: true },
    ...(effect === "teleport" || defId === "scroll_passage"
      ? [{ id: "teleport" as const, atResolution: true }]
      : []),
  ];
  return {
    state: next,
    presentationState,
    motions,
    effects,
    defeatedIds,
    consumedTurn: true,
    elapsedTurns,
    interacted: true,
    soundCues,
  };
}

export function equipItem(
  state: GameState,
  itemRef: string,
  preferredRingIndex?: number,
): ActionResult {
  const { defId } = resolveInventoryItem(state.player, itemRef);
  const definition = ITEM_DEFS[defId];
  if (
    !definition?.slot ||
    inventoryItemQuantity(state.player, defId) <= 0 ||
    state.gameOver
  ) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const next = cloneGameWithoutTiles(state);
  const presentationState = state;
  if (!equipInventoryItemDirect(next, itemRef, true, preferredRingIndex)) {
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  const elapsedTurns = spendPlayerTime(next, 1);
  return {
    state: next,
    presentationState,
    motions: [],
    effects: [],
    consumedTurn: true,
    elapsedTurns,
    interacted: true,
    soundCues: [{ id: "equip", atResolution: true }],
  };
}

const inventoryItemIsAvailable = (player: Player, itemRef: string) => {
  const resolved = resolveInventoryItem(player, itemRef);
  return resolved.individual
    ? Boolean(resolved.instance)
    : (player.inventory[resolved.defId] ?? 0) > 0;
};

const canOccupyAutoSlot = (category: ItemCategory) =>
  AUTO_SLOT_CATEGORIES.has(category);

const isPassiveLoadoutItem = (category: ItemCategory) =>
  category === "ring" || category === "artifact";

const isPassiveFlexTarget = (target: LoadoutTarget) =>
  target.kind === "flex" &&
  COMPANION_PASSIVE_SLOT_INDEXES.includes(
    target.index as (typeof COMPANION_PASSIVE_SLOT_INDEXES)[number],
  );

const assignPlayerPassiveItemDirect = (
  state: GameState,
  itemRef: string,
  index: FlexSlotIndex,
) => {
  const resolved = resolveInventoryItem(state.player, itemRef);
  const definition = ITEM_DEFS[resolved.defId];
  if (!definition || !isPassiveLoadoutItem(definition.category)) return false;

  const ringKey = RING_EQUIPMENT_KEYS[index];
  const previousDefId = state.player.equipment[ringKey];
  const previousInstance = equipmentInstanceAt(state.player, ringKey);
  const previousAutoRef = state.player.autoSlots[index];
  const previousAutoInstance = previousAutoRef
    ? resolveInventoryItem(state.player, previousAutoRef).instance
    : null;
  if (previousDefId && previousInstance?.cursed) {
    pushLog(
      state,
      `${ITEM_DEFS[previousDefId].name}은(는) 저주받아 해제하거나 교체할 수 없습니다.`,
    );
    return false;
  }
  if (previousAutoRef && previousAutoInstance?.cursed) {
    pushLog(
      state,
      `${ITEM_DEFS[previousAutoInstance.defId].name}은(는) 저주받아 퀵슬롯에서 뺄 수 없습니다.`,
    );
    return false;
  }

  const removed = removeInventoryItem(state, itemRef);
  if (previousDefId) {
    const returned = addInventoryItem(
      state,
      previousDefId,
      `player-passive-swap-${index}`,
      previousInstance ?? undefined,
    );
    if (!returned) {
      addInventoryItem(
        state,
        removed.defId,
        `player-passive-rollback-${index}`,
        removed.instance ?? undefined,
      );
      return false;
    }
  }
  state.player.autoSlots[index] = null;
  state.player.equipment[ringKey] = removed.defId;
  state.player.equipmentInstances[ringKey] = removed.instance
    ? cloneInventoryInstance(removed.instance)
    : createPlainEquipmentInstance(
        definition,
        `player-passive-${index}-${state.turn}`,
      );
  return true;
};

export const canAssignPlayerItem = (
  state: GameState,
  itemRef: string,
  target: LoadoutTarget,
) => {
  const resolved = resolveInventoryItem(state.player, itemRef);
  const definition = ITEM_DEFS[resolved.defId];
  if (!definition || !inventoryItemIsAvailable(state.player, itemRef)) {
    return false;
  }
  if (target.kind === "equipment") {
    return definition.slot === target.slot;
  }
  return isPassiveFlexTarget(target)
    ? isPassiveLoadoutItem(definition.category)
    : canOccupyAutoSlot(definition.category);
};

const assignPlayerAutoItemDirect = (
  state: GameState,
  itemRef: string,
  index: FlexSlotIndex,
) => {
  const resolved = resolveInventoryItem(state.player, itemRef);
  const definition = ITEM_DEFS[resolved.defId];
  if (!definition || !canOccupyAutoSlot(definition.category)) return false;

  const ringKey = RING_EQUIPMENT_KEYS[index];
  const previousRingId = state.player.equipment[ringKey];
  const previousRingInstance = equipmentInstanceAt(state.player, ringKey);
  const previousAutoRef = state.player.autoSlots[index];
  const previousAutoInstance = previousAutoRef
    ? resolveInventoryItem(state.player, previousAutoRef).instance
    : null;
  if (previousRingId && previousRingInstance?.cursed) {
    pushLog(
      state,
      `${ITEM_DEFS[previousRingId].name}은(는) 저주받아 해제하거나 교체할 수 없습니다.`,
    );
    return false;
  }
  if (previousAutoRef && previousAutoInstance?.cursed) {
    pushLog(
      state,
      `${ITEM_DEFS[previousAutoInstance.defId].name}은(는) 저주받아 퀵슬롯에서 뺄 수 없습니다.`,
    );
    return false;
  }
  const previousAutoSlots = [...state.player.autoSlots] as Player["autoSlots"];
  state.player.autoSlots = state.player.autoSlots.map((registered, slotIndex) =>
    slotIndex !== index && registered === itemRef ? null : registered,
  ) as Player["autoSlots"];
  state.player.autoSlots[index] = itemRef;

  if (previousRingId) {
    const returned = addInventoryItem(
      state,
      previousRingId,
      `player-flex-swap-${index}`,
      previousRingInstance ?? undefined,
    );
    if (!returned) {
      state.player.autoSlots = previousAutoSlots;
      return false;
    }
    state.player.equipment[ringKey] = null;
    state.player.equipmentInstances[ringKey] = null;
  }
  return true;
};

export function assignPlayerItem(
  state: GameState,
  target: LoadoutTarget,
  itemRef: string,
): ActionResult {
  if (state.gameOver || !canAssignPlayerItem(state, itemRef, target)) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const next = cloneGameWithoutTiles(state);
  const resolved = resolveInventoryItem(next.player, itemRef);
  const definition = ITEM_DEFS[resolved.defId];
  const assigned = target.kind === "equipment"
    ? equipInventoryItemDirect(next, itemRef, false)
    : isPassiveFlexTarget(target)
      ? assignPlayerPassiveItemDirect(next, itemRef, target.index)
      : assignPlayerAutoItemDirect(next, itemRef, target.index);
  if (!assigned) {
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  pushLog(next, `${definition.name}을(를) 장비칸에 배치했습니다.`);
  const elapsedTurns = spendPlayerTime(next, 1);
  return {
    state: next,
    presentationState: state,
    motions: [],
    effects: [],
    consumedTurn: true,
    elapsedTurns,
    interacted: true,
    soundCues: [{ id: "equip", atResolution: true }],
  };
}

export function unassignPlayerItem(
  state: GameState,
  target: LoadoutTarget,
): ActionResult {
  if (target.kind === "equipment") {
    return unequipSlot(state, target.slot);
  }
  const ringKey = RING_EQUIPMENT_KEYS[target.index];
  if (state.player.equipment[ringKey]) {
    return unequipSlot(state, "ring", target.index);
  }
  if (!state.player.autoSlots[target.index] || state.gameOver) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const next = cloneGameWithoutTiles(state);
  const itemRef = next.player.autoSlots[target.index];
  const equippedInstance = itemRef
    ? resolveInventoryItem(next.player, itemRef).instance
    : null;
  if (equippedInstance?.cursed) {
    pushLog(
      next,
      `${ITEM_DEFS[equippedInstance.defId].name}은(는) 저주받아 퀵슬롯에서 뺄 수 없습니다.`,
    );
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  next.player.autoSlots[target.index] = null;
  const itemId = itemRef
    ? resolveInventoryItem(next.player, itemRef).defId
    : null;
  if (itemId) pushLog(next, `${ITEM_DEFS[itemId].name}을(를) 장비칸에서 뺐습니다.`);
  const elapsedTurns = spendPlayerTime(next, 1);
  return {
    state: next,
    presentationState: state,
    motions: [],
    effects: [],
    consumedTurn: true,
    elapsedTurns,
    interacted: true,
    soundCues: [{ id: "equip", atResolution: true }],
  };
}

export function unequipSlot(
  state: GameState,
  slot: EquipSlot,
  ringIndex = 0,
): ActionResult {
  const equipmentKey =
    slot === "ring"
      ? RING_EQUIPMENT_KEYS[
          Math.max(0, Math.min(RING_EQUIPMENT_KEYS.length - 1, ringIndex))
        ]
      : slot;
  const itemId = state.player.equipment[equipmentKey];
  if (!itemId || state.gameOver) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const next = cloneGameWithoutTiles(state);
  const presentationState = state;
  const equippedInstance =
    ensureEquippedInstance(next, equipmentKey) ??
    createPlainEquipmentInstance(
      ITEM_DEFS[itemId],
      `equipped-${itemId}-${next.turn}-${equipmentKey}`,
    );
  if (equippedInstance.cursed) {
    pushLog(
      next,
      `${ITEM_DEFS[itemId].name}은(는) 저주받아 해제할 수 없습니다. 저주 해제의 주문서가 필요합니다.`,
    );
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  if (
    !addInventoryItem(
      next,
      itemId,
      `unequipped-${slot}`,
      equippedInstance,
    )
  ) {
    pushLog(next, "가방이 가득 차 장비를 해제할 수 없습니다.");
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  next.player.equipment[equipmentKey] = null;
  next.player.equipmentInstances[equipmentKey] = null;
  pushLog(next, `${ITEM_DEFS[itemId].name}을(를) 해제했습니다.`);
  const elapsedTurns = spendPlayerTime(next, 1);
  return {
    state: next,
    presentationState,
    motions: [],
    effects: [],
    consumedTurn: true,
    elapsedTurns,
    interacted: true,
    soundCues: [{ id: "equip", atResolution: true }],
  };
}

export type CompanionLoadoutTarget = LoadoutTarget;

export const canAssignCompanionItem = (
  state: GameState,
  itemRef: string,
  target: CompanionLoadoutTarget,
) => {
  const resolved = resolveInventoryItem(state.player, itemRef);
  const definition = ITEM_DEFS[resolved.defId];
  if (!definition || inventoryItemQuantity(state.player, resolved.defId) <= 0) {
    return false;
  }
  if (target.kind === "equipment") {
    return definition.slot === target.slot;
  }
  return isPassiveFlexTarget(target)
    ? isPassiveLoadoutItem(definition.category)
    : canOccupyAutoSlot(definition.category);
};

const returnCompanionAutoItem = (
  state: GameState,
  item: CompanionAutoItem,
  seed: string,
) => {
  if (!isIndividualInventoryItem(item.defId)) return true;
  return Boolean(addInventoryItem(
    state,
    item.defId,
    seed,
    item.instance ?? undefined,
    Math.max(1, item.quantity),
  ));
};

export function assignCompanionItem(
  state: GameState,
  companionId: string,
  target: CompanionLoadoutTarget,
  itemRef: string,
): ActionResult {
  if (
    state.gameOver ||
    !canAssignCompanionItem(state, itemRef, target)
  ) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const resolved = resolveInventoryItem(state.player, itemRef);
  const definition = ITEM_DEFS[resolved.defId];
  const next = cloneGameWithoutTiles(state);
  const companion = next.companions.find(
    (candidate) => candidate.id === companionId,
  );
  if (!companion || !definition) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }

  if (target.kind === "equipment") {
    const previousDefId = companion.equipment[target.slot];
    const previousInstance = companion.equipmentInstances[target.slot];
    if (previousDefId && previousInstance?.cursed) {
      pushLog(
        next,
        `${companion.name}의 ${ITEM_DEFS[previousDefId].name}은(는) 저주받아 교체할 수 없습니다.`,
      );
      return { state: next, motions: [], effects: [], consumedTurn: false };
    }
    const removed = removeInventoryItem(next, itemRef);
    if (previousDefId) {
      const returned = addInventoryItem(
        next,
        previousDefId,
        `companion-swap-${companion.id}-${target.slot}`,
        previousInstance ?? undefined,
      );
      if (!returned) {
        return {
          state,
          motions: [],
          effects: [],
          consumedTurn: false,
        };
      }
    }
    companion.equipment[target.slot] = removed.defId;
    companion.equipmentInstances[target.slot] = removed.instance
      ? cloneCompanionInstance(removed.instance)
      : createPlainEquipmentInstance(
          definition,
          `companion-${companion.id}-${target.slot}-${next.turn}`,
        );
  } else {
    const ringKey = RING_EQUIPMENT_KEYS[target.index];
    const previousRingId = companion.equipment[ringKey];
    const previousRingInstance = companion.equipmentInstances[ringKey];
    const previousAuto = companion.autoSlots[target.index];
    if (previousRingId && previousRingInstance?.cursed) {
      pushLog(
        next,
        `${companion.name}의 ${ITEM_DEFS[previousRingId].name}은(는) 저주받아 교체할 수 없습니다.`,
      );
      return { state: next, motions: [], effects: [], consumedTurn: false };
    }
    if (previousAuto?.instance?.cursed) {
      pushLog(
        next,
        `${companion.name}의 ${ITEM_DEFS[previousAuto.defId].name}은(는) 저주받아 퀵슬롯에서 뺄 수 없습니다.`,
      );
      return { state: next, motions: [], effects: [], consumedTurn: false };
    }
    let quantity = 1;
    let instance = resolved.instance
      ? cloneCompanionInstance(resolved.instance)
      : null;
    if (isPassiveFlexTarget(target)) {
      removeInventoryItem(next, itemRef);
    } else if (!resolved.individual) {
      quantity = Math.max(0, next.player.inventory[resolved.defId] ?? 0);
      instance = null;
    } else {
      removeInventoryItem(next, itemRef);
    }
    if (
      previousAuto &&
      !returnCompanionAutoItem(
        next,
        previousAuto,
        `companion-auto-swap-${companion.id}-${target.index}`,
      )
    ) {
      return {
        state,
        motions: [],
        effects: [],
        consumedTurn: false,
      };
    }
    if (
      previousRingId &&
      !addInventoryItem(
        next,
        previousRingId,
        `companion-flex-swap-${companion.id}-${target.index}`,
        previousRingInstance ?? undefined,
      )
    ) {
      return { state, motions: [], effects: [], consumedTurn: false };
    }
    companion.equipment[ringKey] = null;
    companion.equipmentInstances[ringKey] = null;
    companion.autoSlots[target.index] = null;
    if (isPassiveFlexTarget(target)) {
      companion.equipment[ringKey] = resolved.defId;
      companion.equipmentInstances[ringKey] = instance
        ? cloneCompanionInstance(instance)
        : createPlainEquipmentInstance(
            definition,
            `companion-${companion.id}-${ringKey}-${next.turn}`,
          );
    } else {
      companion.autoSlots[target.index] = {
        defId: resolved.defId,
        quantity,
        instance,
      };
    }
  }

  pushLog(
    next,
    `${companion.name}에게 ${definition.name}을(를) 맡겼습니다.`,
  );
  const elapsedTurns = spendPlayerTime(next, 1);
  return {
    state: next,
    presentationState: state,
    motions: [{
      id: companion.id,
      from: { x: companion.x, y: companion.y },
      to: { x: companion.x, y: companion.y },
      kind: "interact",
    }],
    effects: [],
    consumedTurn: true,
    elapsedTurns,
    interacted: false,
    soundCues: [{ id: "equip", atResolution: true }],
  };
}

export function unassignCompanionItem(
  state: GameState,
  companionId: string,
  target: CompanionLoadoutTarget,
): ActionResult {
  if (state.gameOver) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const next = cloneGameWithoutTiles(state);
  const companion = next.companions.find(
    (candidate) => candidate.id === companionId,
  );
  if (!companion) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  let itemName = "";
  if (target.kind === "equipment") {
    const defId = companion.equipment[target.slot];
    if (!defId) {
      return { state, motions: [], effects: [], consumedTurn: false };
    }
    if (companion.equipmentInstances[target.slot]?.cursed) {
      pushLog(
        next,
        `${companion.name}의 ${ITEM_DEFS[defId].name}은(는) 저주받아 회수할 수 없습니다.`,
      );
      return { state: next, motions: [], effects: [], consumedTurn: false };
    }
    if (
      !addInventoryItem(
        next,
        defId,
        `companion-unequip-${companion.id}-${target.slot}`,
        companion.equipmentInstances[target.slot] ?? undefined,
      )
    ) {
      pushLog(next, "가방이 가득 차 동료 장비를 해제할 수 없습니다.");
      return { state: next, motions: [], effects: [], consumedTurn: false };
    }
    itemName = ITEM_DEFS[defId]?.name ?? defId;
    companion.equipment[target.slot] = null;
    companion.equipmentInstances[target.slot] = null;
  } else {
    const ringKey = RING_EQUIPMENT_KEYS[target.index];
    const ringId = companion.equipment[ringKey];
    const item = companion.autoSlots[target.index];
    if (!item && !ringId) {
      return { state, motions: [], effects: [], consumedTurn: false };
    }
    if (ringId) {
      if (companion.equipmentInstances[ringKey]?.cursed) {
        pushLog(
          next,
          `${companion.name}의 ${ITEM_DEFS[ringId].name}은(는) 저주받아 회수할 수 없습니다.`,
        );
        return { state: next, motions: [], effects: [], consumedTurn: false };
      }
      if (
        !addInventoryItem(
          next,
          ringId,
          `companion-ring-unequip-${companion.id}-${target.index}`,
          companion.equipmentInstances[ringKey] ?? undefined,
        )
      ) {
        pushLog(next, "가방이 가득 차 동료 반지를 회수할 수 없습니다.");
        return { state: next, motions: [], effects: [], consumedTurn: false };
      }
      itemName = ITEM_DEFS[ringId]?.name ?? ringId;
      companion.equipment[ringKey] = null;
      companion.equipmentInstances[ringKey] = null;
    } else if (item) {
      if (item.instance?.cursed) {
        pushLog(
          next,
          `${companion.name}의 ${ITEM_DEFS[item.defId].name}은(는) 저주받아 퀵슬롯에서 뺄 수 없습니다.`,
        );
        return { state: next, motions: [], effects: [], consumedTurn: false };
      }
      if (
        !returnCompanionAutoItem(
          next,
          item,
          `companion-auto-unequip-${companion.id}-${target.index}`,
        )
      ) {
        pushLog(next, "가방이 가득 차 동료 아이템을 회수할 수 없습니다.");
        return { state: next, motions: [], effects: [], consumedTurn: false };
      }
      itemName = ITEM_DEFS[item.defId]?.name ?? item.defId;
      companion.autoSlots[target.index] = null;
    }
  }
  pushLog(next, `${companion.name}에게서 ${itemName}을(를) 회수했습니다.`);
  const elapsedTurns = spendPlayerTime(next, 1);
  return {
    state: next,
    presentationState: state,
    motions: [{
      id: companion.id,
      from: { x: companion.x, y: companion.y },
      to: { x: companion.x, y: companion.y },
      kind: "interact",
    }],
    effects: [],
    consumedTurn: true,
    elapsedTurns,
    soundCues: [{ id: "equip", atResolution: true }],
  };
}

export function setCompanionCommand(
  state: GameState,
  companionId: string,
  command: CompanionCommand,
): GameState {
  void command;
  const current = (state.companions ?? []).find(
    (companion) => companion.id === companionId,
  );
  if (
    !current ||
    (current.command === "follow" &&
      current.exploreTarget === null &&
      current.commandTargetId === null)
  ) return state;
  const next = cloneGameWithoutTiles(state);
  const companion = next.companions.find(
    (candidate) => candidate.id === companionId,
  );
  if (!companion) return state;
  companion.command = "follow";
  companion.exploreTarget = null;
  companion.commandTargetId = null;
  return next;
}

export function setCompanionPriorityTarget(
  state: GameState,
  companionId: string,
  target: Point,
): GameState {
  const current = (state.companions ?? []).find(
    (companion) => companion.id === companionId && companion.hp > 0,
  );
  const tile = state.tiles[target.y]?.[target.x];
  if (!current || !tile || !tile.discovered) return state;
  if (
    !isWalkable(
      tile.terrain,
      (state.player.inventory.iron_key ?? 0) > 0,
    )
  ) {
    const next = cloneGameWithoutTiles(state);
    const companion = next.companions.find(
      (candidate) => candidate.id === companionId,
    );
    if (companion) companion.priorityTarget = null;
    pushLog(next, "동료가 이동할 수 있는 타일에 지시를 내려야 합니다.");
    return next;
  }
  const next = cloneGameWithoutTiles(state);
  const companion = next.companions.find(
    (candidate) => candidate.id === companionId,
  );
  if (!companion) return state;
  companion.command = "follow";
  companion.exploreTarget = null;
  companion.commandTargetId = null;
  companion.priorityTarget = pointEquals(companion, target)
    ? null
    : { ...target };
  pushLog(
    next,
    companion.priorityTarget
      ? `${companion.name}이(가) 지정한 타일을 향해 우선 이동합니다.`
      : `${companion.name}의 이동 지시를 해제했습니다.`,
  );
  return next;
}

const ENCHANTING_MATERIALS = [
  "stone_enchantment",
  "scroll_enchantment",
  "stylus",
] as const;

const enchantingMaterial = (player: Player) =>
  ENCHANTING_MATERIALS.find(
    (defId) => (player.inventory[defId] ?? 0) > 0,
  ) ?? null;

export const hasEnchantingMaterial = (player: Player) =>
  enchantingMaterial(player) !== null;

export function upgradeItemWithScroll(
  state: GameState,
  scrollItemRef: string,
  target: UpgradeTarget,
): ActionResult {
  const scroll = resolveInventoryItem(state.player, scrollItemRef);
  if (
    state.gameOver ||
    scroll.defId !== "scroll_upgrade" ||
    (state.player.inventory.scroll_upgrade ?? 0) <= 0
  ) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }

  const next = cloneGameWithoutTiles(state);
  const presentationState = state;
  let definition: (typeof ITEM_DEFS)[string] | null = null;
  let instance: InventoryInstance | null = null;

  if (target.kind === "equipment") {
    const key: EquipmentKey =
      target.slot === "ring"
        ? RING_EQUIPMENT_KEYS[
            Math.max(
              0,
              Math.min(
                RING_EQUIPMENT_KEYS.length - 1,
                target.ringIndex ?? 0,
              ),
            )
          ]
        : target.slot;
    const defId = next.player.equipment[key];
    definition = defId ? ITEM_DEFS[defId] : null;
    instance = defId ? ensureEquippedInstance(next, key) : null;
  } else if (target.kind === "playerAuto") {
    const itemRef = next.player.autoSlots[target.index];
    if (itemRef) {
      const resolved = resolveInventoryItem(next.player, itemRef);
      definition = ITEM_DEFS[resolved.defId] ?? null;
      instance = inventoryItemQuantity(next.player, resolved.defId) > 0
        ? resolved.instance
        : null;
    }
  } else if (target.kind === "companionEquipment") {
    const companion = next.companions.find(
      (candidate) => candidate.id === target.companionId,
    );
    const defId = companion?.equipment[target.slot] ?? null;
    definition = defId ? ITEM_DEFS[defId] : null;
    instance = companion?.equipmentInstances[target.slot] ?? null;
  } else if (target.kind === "companionFlex") {
    const companion = next.companions.find(
      (candidate) => candidate.id === target.companionId,
    );
    if (companion) {
      const ringKey = RING_EQUIPMENT_KEYS[target.index];
      const ringId = companion.equipment[ringKey];
      const autoItem = companion.autoSlots[target.index];
      const defId = ringId ?? autoItem?.defId ?? null;
      definition = defId ? ITEM_DEFS[defId] : null;
      instance = ringId
        ? companion.equipmentInstances[ringKey]
        : autoItem?.instance ?? null;
    }
  } else {
    const resolved = resolveInventoryItem(next.player, target.itemRef);
    definition = ITEM_DEFS[resolved.defId] ?? null;
    instance = resolved.instance;
    if (inventoryItemQuantity(next.player, resolved.defId) <= 0) {
      instance = null;
    }
  }

  if (!definition || !instance || !isUpgradeableEquipment(definition)) {
    pushLog(next, "강화할 수 있는 장비를 선택해야 합니다.");
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }

  upgradeEquipmentInstance(instance);
  removeInventoryItem(next, scrollItemRef);
  pushLog(
    next,
    `${definition.name}이(가) +${instance.upgradeLevel ?? 0} 장비로 강화되었습니다.`,
  );
  const elapsedTurns = spendPlayerTime(next, 1);
  return {
    state: next,
    presentationState,
    motions: [],
    effects: [],
    consumedTurn: true,
    elapsedTurns,
    interacted: true,
    enchanted: true,
    soundCues: [{ id: "read", atResolution: true }],
  };
}

const enchantActionResult = (
  next: GameState,
  presentationState: GameState,
  definition: (typeof ITEM_DEFS)[string],
  traitId: EquipmentTraitId,
): ActionResult => {
  const material = enchantingMaterial(next.player);
  if (!material) {
    pushLog(
      next,
      "인챈트에는 마법 부여의 돌·주문서 또는 신비한 바늘이 필요합니다.",
    );
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  removeInventoryItem(next, material);
  const trait = EQUIPMENT_TRAITS[traitId];
  pushLog(
    next,
    `${definition.name}에 ${trait.name} 특성이 부여되었습니다. ${trait.description}.`,
  );
  const elapsedTurns = spendPlayerTime(next, 1);
  return {
    state: next,
    presentationState,
    motions: [],
    effects: [],
    consumedTurn: true,
    elapsedTurns,
    interacted: true,
    enchanted: true,
    soundCues: [{ id: "equip", atResolution: true }],
  };
};

export function enchantItem(
  state: GameState,
  itemRef: string,
): ActionResult {
  if (state.gameOver || !hasEnchantingMaterial(state.player)) {
    const next = cloneGameWithoutTiles(state);
    if (!hasEnchantingMaterial(state.player)) {
      pushLog(
        next,
        "인챈트 재료가 없습니다. 마법 부여의 돌·주문서 또는 신비한 바늘이 필요합니다.",
      );
    }
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  const next = cloneGameWithoutTiles(state);
  const presentationState = state;
  const resolved = resolveInventoryItem(next.player, itemRef);
  const definition = ITEM_DEFS[resolved.defId];
  if (
    !resolved.instance ||
    !isUpgradeableEquipment(definition) ||
    inventoryItemQuantity(next.player, resolved.defId) <= 0
  ) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const traitId = enchantEquipmentInstance(
    resolved.instance,
    definition,
    () => random(next),
  );
  if (!traitId) {
    pushLog(next, `${definition.name}에는 더 이상 특성을 부여할 수 없습니다.`);
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  return enchantActionResult(next, presentationState, definition, traitId);
}

export function enchantEquippedItem(
  state: GameState,
  slot: EquipSlot,
  ringIndex = 0,
): ActionResult {
  if (state.gameOver || !hasEnchantingMaterial(state.player)) {
    const next = cloneGameWithoutTiles(state);
    if (!hasEnchantingMaterial(state.player)) {
      pushLog(
        next,
        "인챈트 재료가 없습니다. 마법 부여의 돌·주문서 또는 신비한 바늘이 필요합니다.",
      );
    }
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  const key =
    slot === "ring"
      ? RING_EQUIPMENT_KEYS[
          Math.max(0, Math.min(RING_EQUIPMENT_KEYS.length - 1, ringIndex))
        ]
      : slot;
  const next = cloneGameWithoutTiles(state);
  const presentationState = state;
  const result = enchantEquippedDirect(next, key);
  if (!result?.traitId) {
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  return enchantActionResult(
    next,
    presentationState,
    result.definition,
    result.traitId,
  );
}

export function acceptEquipmentOffer(
  state: GameState,
  offerId: string,
): ActionResult {
  const offer = (state.equipmentOffers ?? []).find(
    (candidate) => candidate.id === offerId,
  );
  if (!offer || offer.expiresTurn <= state.turn || state.gameOver) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const next = cloneGameWithoutTiles(state);
  const presentationState = state;
  if (!equipInventoryItemDirect(next, offer.itemRef)) {
    next.equipmentOffers = next.equipmentOffers.filter(
      (candidate) => candidate.id !== offerId,
    );
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  const elapsedTurns = spendPlayerTime(next, 1);
  return {
    state: next,
    presentationState,
    motions: [],
    effects: [],
    consumedTurn: true,
    elapsedTurns,
    interacted: true,
    soundCues: [{ id: "equip", atResolution: true }],
  };
}

export function declineEquipmentOffer(
  state: GameState,
  offerId: string,
): GameState {
  const next = cloneGameWithoutTiles(state);
  next.equipmentOffers = next.equipmentOffers.filter(
    (offer) => offer.id !== offerId,
  );
  return next;
}

export function autoEquipBetterOffers(state: GameState): GameState {
  const next = cloneGameWithoutTiles(state);
  const offers = [...(next.equipmentOffers ?? [])];
  offers.forEach((offer) => {
    if (
      offer.expiresTurn > next.turn &&
      isBetterEquipment(next.player, offer.defId, offer.itemRef)
    ) {
      equipInventoryItemDirect(next, offer.itemRef);
      pushLog(next, "자동탐사가 더 좋은 장비로 교체했습니다.");
    }
  });
  pruneEquipmentOffers(next);
  return next;
}

const projectilePath = (
  state: GameState,
  target: Point,
  maximumRange = 8,
  origin: Point = state.player,
) => {
  const from = origin;
  const deltaX = target.x - from.x;
  const deltaY = target.y - from.y;
  const span = Math.max(Math.abs(deltaX), Math.abs(deltaY));
  if (span === 0) return [] as Point[];

  const path: Point[] = [];
  for (let step = 1; step <= Math.min(span, maximumRange); step += 1) {
    const point = {
      x: Math.round(from.x + (deltaX * step) / span),
      y: Math.round(from.y + (deltaY * step) / span),
    };
    if (
      !inBounds(state, point) ||
      state.tiles[point.y][point.x].terrain === "wall" ||
      state.tiles[point.y][point.x].terrain === "door" ||
      state.tiles[point.y][point.x].terrain === "lockedDoor" ||
      state.objects.some(
        (object) => !object.looted && object.x === point.x && object.y === point.y,
      )
    ) {
      break;
    }
    if (!path.some((candidate) => mapPointKey(candidate) === mapPointKey(point))) {
      path.push(point);
    }
    if (
      state.enemies.some(
        (enemy) => enemy.x === point.x && enemy.y === point.y,
      )
    ) {
      break;
    }
  }
  return path;
};

const projectileHitsEnemy = (
  state: GameState,
  target: Enemy,
  maximumRange: number,
) => {
  const path = projectilePath(state, target, maximumRange);
  const landing = path[path.length - 1];
  return Boolean(
    landing &&
      landing.x === target.x &&
      landing.y === target.y &&
      state.enemies.some(
        (enemy) =>
          enemy.id === target.id &&
          enemy.hp > 0 &&
          enemy.x === landing.x &&
          enemy.y === landing.y,
      ),
  );
};

export type AutoLoadoutAction =
  | {
      kind: "use";
      slotIndex: number;
      itemRef: string;
    }
  | {
      kind: "wand" | "throw";
      slotIndex: number;
      itemRef: string;
      target: Point;
    };

const AUTO_COMBAT_CONSUMABLE_CATEGORIES = new Set<ItemCategory>([
  "scroll",
  "brew",
  "bomb",
  "seed",
  "stone",
]);

const AUTO_COMBAT_EFFECTS = new Set([
  "blast",
  "frost",
  "rage",
]);

export function planAutoExploreLoadoutAction(
  state: GameState,
): AutoLoadoutAction | null {
  const autoSlots = state.player.autoSlots ?? [];
  const resolveAvailableSlot = (itemRef: string, slotIndex: number) => {
    const resolved = resolveInventoryItem(state.player, itemRef);
    const definition = ITEM_DEFS[resolved.defId];
    const available = definition?.category === "missile"
      ? Boolean(
          resolved.instance &&
            throwableChargeCount(state.player, resolved.instance.id) > 0,
        )
      : resolved.individual
        ? playerInstances(state.player).some(
          (instance) => instance.id === resolved.instance?.id,
        )
        : (state.player.inventory[resolved.defId] ?? 0) > 0;
    return definition && available
      ? {
          slotIndex,
          itemRef,
          resolved,
          definition,
        }
      : null;
  };
  const availableSlots = autoSlots.flatMap((itemRef, slotIndex) => {
    if (!itemRef) return [];
    const slot = resolveAvailableSlot(itemRef, slotIndex);
    return slot ? [slot] : [];
  });

  if (state.player.hp < state.player.maxHp * 0.55) {
    const healingPotion = availableSlots.find(
      ({ resolved }) => resolved.defId === "potion_healing",
    );
    if (healingPotion) {
      return {
        kind: "use",
        slotIndex: healingPotion.slotIndex,
        itemRef: healingPotion.itemRef,
      };
    }
  }

  const targets = state.enemies
    .filter(
      (enemy) =>
        enemy.hp > 0 &&
        state.tiles[enemy.y]?.[enemy.x]?.visible,
    )
    .sort(
      (a, b) =>
        distance(a, state.player) - distance(b, state.player),
    );
  if (!targets.length) return null;

  for (const slot of availableSlots) {
    const { definition, itemRef, resolved, slotIndex } = slot;
    if (
      definition.category === "wand" &&
      resolved.instance &&
      (resolved.instance.charges ?? resolved.instance.maxCharges ?? 3) > 0
    ) {
      const target = targets.find(
        (candidate) =>
          distance(candidate, state.player) <= 10 &&
          projectileHitsEnemy(state, candidate, 10),
      );
      if (target) {
        return {
          kind: "wand",
          slotIndex,
          itemRef,
          target: { x: target.x, y: target.y },
        };
      }
    }
    if (definition.category === "missile") {
      const target = targets.find(
        (candidate) =>
          distance(candidate, state.player) <= 8 &&
          projectileHitsEnemy(state, candidate, 8),
      );
      if (target) {
        return {
          kind: "throw",
          slotIndex,
          itemRef,
          target: { x: target.x, y: target.y },
        };
      }
    }
    const nearbyTarget = targets.find(
      (candidate) => distance(candidate, state.player) <= 3,
    );
    if (
      definition.category !== "potion" &&
      AUTO_COMBAT_CONSUMABLE_CATEGORIES.has(definition.category) &&
      definition.effect &&
      AUTO_COMBAT_EFFECTS.has(definition.effect) &&
      (definition.effect === "rage" || nearbyTarget)
    ) {
      return { kind: "use", slotIndex, itemRef };
    }
  }
  return null;
}

export function zapWand(
  state: GameState,
  itemRef: string,
  target: Point,
): ActionResult {
  const resolved = resolveInventoryItem(state.player, itemRef);
  const defId = resolved.defId;
  const definition = ITEM_DEFS[defId];
  if (
    state.gameOver ||
    !definition ||
    !isWand(defId) ||
    !resolved.instance
  ) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const charges = resolved.instance.charges ?? resolved.instance.maxCharges ?? 3;
  if (charges <= 0) {
    const next = cloneGameWithoutTiles(state);
    pushLog(next, `${definition.name}의 충전량이 없습니다.`);
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  const path = projectilePath(state, target, 10);
  if (!path.length) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const incapacitated = consumeIncapacitatedPlayerTurn(state);
  if (incapacitated) return incapacitated;

  const next = cloneGame(state);
  const presentationState = state;
  const baseWandMagic = equipmentStatProfile(definition).magic;
  const wandMagic = equipmentStatProfile(
    definition,
    resolved.instance,
  ).magic;
  const wandPowerBonus = Math.max(0, wandMagic - baseWandMagic);
  const landing = path[path.length - 1];
  const primary = next.enemies.find(
    (enemy) => enemy.x === landing.x && enemy.y === landing.y,
  );
  const effects: CombatEffect[] = [];
  const hit = (enemy: Enemy, amount: number, color: string) => {
    const resolvedAmount = amount + wandPowerBonus;
    enemy.hp -= resolvedAmount;
    enemy.sleeping = false;
    enemy.alerted = true;
    enemy.lastSeenPlayer = { ...next.player };
    effects.push({
      x: enemy.x,
      y: enemy.y,
      text: `-${resolvedAmount}`,
      color,
      kind: "damage",
      sourceId: `wand-${defId}`,
    });
    return resolvedAmount;
  };
  const magicVisuals = [{
    id: `magic-${defId}-${next.turn}`,
    kind: defId === "wand_fireblast" ? "cone" as const : "beam" as const,
    from: { x: next.player.x, y: next.player.y },
    to: landing,
    color:
      defId.includes("fire") ? "#ff7b3f"
      : defId.includes("frost") ? "#8ee9ff"
      : defId.includes("lightning") ? "#fff37a"
      : defId.includes("corrosion") ? "#9bd34f"
      : defId.includes("regrowth") ? "#6fd06a"
      : "#c3a5ff",
    secondaryColor: "#ffffff",
  }];

  if (defId === "wand_magic_missile" && primary) {
    hit(primary, 6, "#d6b6ff");
  } else if (defId === "wand_frost" && primary) {
    hit(primary, 5, "#8ee9ff");
    addStatus(primary.statuses, "chilled", 4, 1);
    if (next.tiles[primary.y][primary.x].terrain === "water") {
      addStatus(primary.statuses, "frozen", 2, 1);
    }
  } else if (defId === "wand_fireblast") {
    next.enemies
      .filter((enemy) => distance(enemy, landing) <= 2)
      .forEach((enemy) => {
        hit(enemy, 7, "#ff8a45");
        addStatus(enemy.statuses, "burning", 4, 2);
      });
    for (let y = Math.max(0, landing.y - 2); y <= Math.min(next.height - 1, landing.y + 2); y += 1) {
      for (let x = Math.max(0, landing.x - 2); x <= Math.min(next.width - 1, landing.x + 2); x += 1) {
        if (next.tiles[y][x].terrain === "highGrass") next.tiles[y][x].terrain = "floor";
      }
    }
  } else if (defId === "wand_lightning" && primary) {
    const chain = [primary];
    while (chain.length < 4) {
      const last = chain[chain.length - 1];
      const candidate = next.enemies
        .filter((enemy) => !chain.includes(enemy) && distance(enemy, last) <= 4)
        .sort((a, b) => distance(a, last) - distance(b, last))[0];
      if (!candidate) break;
      chain.push(candidate);
    }
    const directDamage = new Map<string, number>();
    chain.forEach((enemy, index) =>
      directDamage.set(
        enemy.id,
        hit(enemy, Math.max(3, 8 - index), "#fff37a"),
      ),
    );
    const directlyHitIds = new Set(chain.map((enemy) => enemy.id));
    const claimedWaterTiles = new Set<string>();
    chain.forEach((enemy) =>
      conductLightningFromEnemy(
        next,
        enemy,
        directDamage.get(enemy.id) ?? 3,
        effects,
        magicVisuals,
        `wand-${defId}`,
        directlyHitIds,
        claimedWaterTiles,
      ),
    );
  } else if (defId === "wand_disintegration") {
    path.forEach((point) => {
      const enemy = next.enemies.find(
        (candidate) => candidate.x === point.x && candidate.y === point.y,
      );
      if (enemy) hit(enemy, 7, "#d09cff");
    });
  } else if (defId === "wand_prismatic_light" && primary) {
    hit(primary, 5, "#fff6b0");
    addStatus(primary.statuses, "blinded", 5, 1);
    updatePlayerFieldOfView(next);
  } else if (defId === "wand_corrosion") {
    createCloud(
      next,
      "corrosive",
      landing,
      7,
      2 + wandPowerBonus,
      3,
      2,
    );
  } else if (defId === "wand_blast_wave") {
    if (primary) {
      hit(primary, 4, "#b6d7ff");
      const dx = Math.sign(primary.x - next.player.x);
      const dy = Math.sign(primary.y - next.player.y);
      const pushed = { x: primary.x + dx, y: primary.y + dy };
      if (
        inBounds(next, pushed) &&
        isWalkable(next.tiles[pushed.y][pushed.x].terrain, false) &&
        !next.enemies.some((enemy) => enemy !== primary && mapPointKey(enemy) === mapPointKey(pushed))
      ) {
        primary.x = pushed.x;
        primary.y = pushed.y;
      }
    }
  } else if (defId === "wand_corruption" && primary) {
    primary.sleeping = false;
    primary.alerted = false;
    primary.lastSeenPlayer = null;
    addStatus(primary.statuses, "corrupted", 7, 1);
    effects.push({
      x: primary.x,
      y: primary.y,
      text: "타락!",
      color: "#c99cff",
      sourceId: `wand-${defId}`,
    });
  } else if (defId === "wand_living_earth" && primary) {
    hit(primary, 5, "#c1ad78");
    next.player.shield += 5;
    addStatus(next.player.statuses, "earthenArmor", 8, 1);
  } else if (defId === "wand_regrowth") {
    for (let y = Math.max(1, landing.y - 1); y <= Math.min(next.height - 2, landing.y + 1); y += 1) {
      for (let x = Math.max(1, landing.x - 1); x <= Math.min(next.width - 2, landing.x + 1); x += 1) {
        if (next.tiles[y][x].terrain === "floor") next.tiles[y][x].terrain = "highGrass";
      }
    }
    if (primary) addStatus(primary.statuses, "rooted", 4, 1);
  } else if (defId === "wand_transfusion" && primary) {
    hit(primary, 4, "#ff8eb8");
    next.player.hp = Math.min(next.player.maxHp, next.player.hp + 4);
    next.player.shield += 3;
    addStatus(primary.statuses, "charmed", 4, 1);
  } else if (defId === "wand_warding") {
    next.wards.push({
      id: `ward-${next.turn}-${next.rng}`,
      ...landing,
      turns: 8,
      power: 4 + wandPowerBonus,
    });
  }

  const defeatedIds = removeDefeatedEnemies(next, effects, false, `wand-${defId}`);
  const nextWand = next.player.inventoryInstances.find(
    (instance) => instance.id === itemRef,
  );
  if (nextWand) nextWand.charges = charges - 1;
  const elapsedTurns = spendPlayerTime(next, 1);
  pushLog(
    next,
    `${definition.name}을(를) 발사했습니다. 충전 ${charges - 1}/${resolved.instance.maxCharges ?? 3}`,
  );
  updatePlayerFieldOfView(next);
  return {
    state: next,
    presentationState,
    motions: [],
    effects,
    defeatedIds,
    magicVisuals,
    wandSoundId: defId,
    consumedTurn: true,
    elapsedTurns,
  };
}

const thrownItemDamage = (
  defId: string,
  instance?: InventoryInstance | null,
) => {
  const definition = ITEM_DEFS[defId];
  if (!definition) return 0;
  if (definition.category === "potion") return 0;
  const profile = equipmentStatProfile(definition, instance);
  if (profile.attack > 0) return Math.max(1, profile.attack + 1);
  if (
    definition.category === "missile" ||
    definition.category === "bomb" ||
    definition.effect === "frost" ||
    definition.effect === "blast"
  ) {
    return Math.max(2, definition.power ?? 5);
  }
  return 0;
};

const LIGHTNING_THROWABLE_IDS = new Set([
  "brew_shocking",
  "shock_bomb",
  "stone_shock",
  "seed_stormvine",
]);

const THROWN_POTION_CLOUDS: Partial<
  Record<
    string,
    {
      kind: CloudKind;
      turns: number;
      power: number;
      maxRadius: number;
      spreadPerTurn: number;
    }
  >
> = {
  potion_frost: {
    kind: "frost",
    turns: 5,
    power: 1,
    maxRadius: 3,
    spreadPerTurn: 3,
  },
  potion_snap_freeze: {
    kind: "frost",
    turns: 6,
    power: 1,
    maxRadius: 4,
    spreadPerTurn: 4,
  },
  potion_paralytic_gas: {
    kind: "paralytic",
    turns: 7,
    power: 1,
    maxRadius: 4,
    spreadPerTurn: 3,
  },
  potion_toxic_gas: {
    kind: "toxic",
    turns: 8,
    power: 2,
    maxRadius: 4,
    spreadPerTurn: 3,
  },
  potion_corrosive_gas: {
    kind: "corrosive",
    turns: 8,
    power: 2,
    maxRadius: 4,
    spreadPerTurn: 2,
  },
  potion_liquid_flame: {
    kind: "fire",
    turns: 7,
    power: 2,
    maxRadius: 4,
    spreadPerTurn: 4,
  },
  potion_dragons_breath: {
    kind: "fire",
    turns: 7,
    power: 3,
    maxRadius: 4,
    spreadPerTurn: 5,
  },
  potion_storm_clouds: {
    kind: "storm",
    turns: 8,
    power: 2,
    maxRadius: 5,
    spreadPerTurn: 3,
  },
};

export function throwItem(
  state: GameState,
  itemRef: string,
  target: Point,
): ActionResult {
  const resolved = resolveInventoryItem(state.player, itemRef);
  const { defId } = resolved;
  const definition = ITEM_DEFS[defId];
  if (
    state.gameOver ||
    !definition ||
    inventoryItemQuantity(state.player, defId) <= 0
  ) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  if (
    definition.category === "missile" &&
    (!resolved.instance ||
      throwableChargeCount(state.player, resolved.instance.id) <= 0)
  ) {
    const next = cloneGameWithoutTiles(state);
    pushLog(next, `${definition.name}의 남은 충전량이 없습니다.`);
    return { state: next, motions: [], effects: [], consumedTurn: false };
  }
  const path = projectilePath(state, target);
  if (!path.length) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const incapacitated = consumeIncapacitatedPlayerTurn(state);
  if (incapacitated) return incapacitated;

  const next = cloneGame(state);
  const presentationState = state;
  const landing = path[path.length - 1];
  const effects: CombatEffect[] = [];
  const magicVisuals: MagicVisual[] = [];
  let defeatedIds: string[] = [];
  const isPotion = definition.category === "potion";
  const enemy = next.enemies.find(
    (candidate) => candidate.x === landing.x && candidate.y === landing.y,
  );
  const damage = thrownItemDamage(defId, resolved.instance);
  const dealtDamage = Boolean(enemy && damage > 0);
  if (enemy && damage > 0) {
    const amount = Math.max(1, damage - Math.floor(enemy.defense / 2));
    enemy.hp -= amount;
    enemy.sleeping = false;
    enemy.alerted = true;
    effects.push({
      ...landing,
      text: `-${amount}`,
      color: "#ffd27c",
      kind: "damage",
      sourceId: `throw-${defId}`,
    });
    pushLog(next, `${definition.name}이(가) ${getEnemyLabel(enemy)}에게 적중했습니다.`);
    if (LIGHTNING_THROWABLE_IDS.has(defId)) {
      conductLightningFromEnemy(
        next,
        enemy,
        amount,
        effects,
        magicVisuals,
        `throw-${defId}`,
        new Set([enemy.id]),
      );
    }
    defeatedIds = removeDefeatedEnemies(
      next,
      effects,
      true,
      `throw-${defId}`,
    );
  } else if (!isPotion) {
    pushLog(next, `${definition.name}을(를) 던졌습니다.`);
  }

  let throwableBroke = false;
  if (definition.category === "missile") {
    const profile = resolveInventoryItem(next.player, itemRef).instance;
    if (profile) {
      const maximumCharges = Math.max(0, profile.maxCharges ?? 0);
      profile.charges = Math.max(
        0,
        Math.min(maximumCharges, profile.charges ?? maximumCharges) - 1,
      );
      const maximumDurability = profile.maxDurability ?? 10;
      profile.maxDurability = maximumDurability;
      if (dealtDamage) {
        profile.durability =
          (profile.durability ?? maximumDurability) - 1;
        throwableBroke = profile.durability <= 0;
        if (throwableBroke) {
          profile.maxCharges = Math.max(0, maximumCharges - 1);
          profile.charges = Math.min(
            profile.maxCharges,
            profile.charges,
          );
          profile.durability = maximumDurability;
        }
      }
    }
  }
  const removed = definition.category === "missile"
    ? { defId, instance: resolved.instance }
    : removeInventoryItem(next, itemRef);
  if (isPotion) {
    const cloud = THROWN_POTION_CLOUDS[defId];
    const created = cloud
      ? createCloud(
          next,
          cloud.kind,
          landing,
          cloud.turns,
          cloud.power,
          cloud.maxRadius,
          cloud.spreadPerTurn,
        )
      : false;
    if (cloud?.kind === "fire" && !created) {
      pushLog(next, `${definition.name}이(가) 깨졌지만 물 위에서 불꽃이 식었습니다.`);
    } else if (created) {
      pushLog(next, `${definition.name}이(가) 깨지며 장막이 퍼지기 시작했습니다.`);
    } else {
      pushLog(next, `${definition.name}이(가) 바닥에 부딪혀 깨졌습니다.`);
    }
  } else if (!throwableBroke) {
    const throwableInstance = definition.category === "missile"
      ? resolveInventoryItem(next.player, itemRef).instance
      : null;
    next.groundItems.push({
      id: `thrown-${defId}-${throwableInstance?.id ?? "loose"}-${next.turn}-${next.rng}`,
      defId,
      quantity: 1,
      recoversThrowableCharge:
        definition.category === "missile" ? true : undefined,
      recoversItemRef:
        definition.category === "missile"
          ? throwableInstance?.id
          : undefined,
      instance:
        definition.category === "missile"
          ? undefined
          : removed.instance
          ? cloneInventoryInstance(removed.instance)
          : undefined,
      lootOrigin: "carried",
      ...landing,
    });
  } else {
    const profile = resolveInventoryItem(next.player, itemRef).instance;
    pushLog(
      next,
      `${definition.name} 하나가 파손되어 이번 탐사의 최대 충전량이 ${profile?.maxCharges ?? 0}로 감소했습니다.`,
    );
  }
  triggerTrapAt(next, landing, effects, "thrown");
  const elapsedTurns = spendPlayerTime(next, 1);
  return {
    state: next,
    presentationState,
    motions: [],
    effects,
    defeatedIds,
    magicVisuals,
    throws: [{
      id: `throw-${defId}-${resolved.instance?.id ?? "stack"}`,
      defId,
      from: { x: state.player.x, y: state.player.y },
      to: landing,
      sourceId: resolved.instance?.id,
    }],
    itemBreak: isPotion || throwableBroke,
    consumedTurn: true,
    elapsedTurns,
    soundCues: isPotion || throwableBroke
      ? [{ id: "shatter", atResolution: true }]
      : [],
  };
}

export function discardItem(state: GameState, itemRef: string): ActionResult {
  const { defId } = resolveInventoryItem(state.player, itemRef);
  const definition = ITEM_DEFS[defId];
  if (
    state.gameOver ||
    !definition ||
    inventoryItemQuantity(state.player, defId) <= 0
  ) {
    return { state, motions: [], effects: [], consumedTurn: false };
  }
  const next = cloneGameWithoutTiles(state);
  const presentationState = state;
  const removed = removeInventoryItem(next, itemRef);
  next.groundItems.push({
    id: `discarded-${defId}-${removed.instance?.id ?? "stack"}-${next.turn}-${next.rng}`,
    defId,
    quantity: 1,
    instance: removed.instance
      ? cloneInventoryInstance(removed.instance)
      : undefined,
    lootOrigin: "carried",
    x: next.player.x,
    y: next.player.y,
    manualPickup: true,
  });
  pushLog(next, `${definition.name}을(를) 바닥에 내려놓았습니다.`);
  const elapsedTurns = spendPlayerTime(next, 1);
  return {
    state: next,
    presentationState,
    motions: [],
    effects: [],
    consumedTurn: true,
    elapsedTurns,
    interacted: true,
  };
}

export function developerGrantItem(
  state: GameState,
  defId: string,
  quantity?: number,
): GameState {
  const requested = quantity ?? spawnedGroundQuantity(defId);
  if (!ITEM_DEFS[defId] || requested <= 0) return state;
  const next = cloneGameWithoutTiles(state);
  const createDeveloperInstance = (seed: string) => {
    if (!isIndividualInventoryItem(defId)) return undefined;
    const instance = createEquipmentInstance(
      ITEM_DEFS[defId],
      `developer-${defId}-${seed}-${next.rng}`,
      () => random(next),
      { allowCurse: false },
    );
    if (ITEM_DEFS[defId].category === "missile") {
      instance.baseMaxCharges = requested;
      instance.maxCharges = requested;
      instance.charges = requested;
    }
    return instance;
  };
  let granted = 0;
  if (ITEM_DEFS[defId].category === "missile") {
    granted = addInventoryItem(
      next,
      defId,
      "developer-throwable",
      createDeveloperInstance("throwable"),
      requested,
    ) ? 1 : 0;
  } else {
    for (let index = 0; index < requested; index += 1) {
      if (
        addInventoryItem(
          next,
          defId,
          `developer-${index}`,
          createDeveloperInstance(String(index)),
        )
      ) granted += 1;
    }
  }
  pushLog(
    next,
    ITEM_DEFS[defId].category === "missile"
      ? `[개발자] ${ITEM_DEFS[defId].name} 장비를 충전 ${requested}으로 획득했습니다.${
          granted ? "" : " 가방이 가득 찼습니다."
        }`
      : `[개발자] ${ITEM_DEFS[defId].name} ${granted}개를 획득했습니다.${
      granted < requested ? " 가방이 가득 찼습니다." : ""
    }`,
  );
  return next;
}

export function developerSpawnEnemy(
  state: GameState,
  kind: EnemyKind,
): GameState {
  const next = cloneGameWithoutTiles(state);
  const destination = openCellCandidates(next)
    .filter((point) => distance(point, next.player) <= 5)
    .sort(
      (a, b) =>
        distance(a, next.player) - distance(b, next.player),
    )[0];
  if (!destination) {
    pushLog(next, "[개발자] 플레이어 근처에 소환할 빈 공간이 없습니다.");
    return next;
  }
  const stats = scaledEnemyStats(
    kind,
    next.floor,
    next.difficultyScale,
  );
  next.enemies.push({
    id: `developer-${kind}-${next.turn}-${next.rng}-${next.enemies.length}`,
    kind,
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
    lastSeenPlayer: { ...next.player },
    searchTurns: 0,
    statuses: [],
    drop: null,
    ...destination,
  });
  pushLog(next, `[개발자] ${ENEMY_SPRITES[kind].label} 소환 완료.`);
  return next;
}

export function developerRecruitCompanion(
  state: GameState,
  classId: CompanionClassId,
): GameState {
  const next = cloneGame(state);
  const destination = openCellCandidates(next)
    .filter((point) => distance(point, next.player) <= 4)
    .sort(
      (a, b) =>
        distance(a, next.player) - distance(b, next.player),
    )[0];
  if (!destination) {
    pushLog(next, "[개발자] 동료가 합류할 빈 공간이 없습니다.");
    return next;
  }
  const companion = createCompanion(
    classId,
    destination,
    next.companions.length,
  );
  companion.id = `companion-${classId}-${next.turn}-${next.companions.length}`;
  companion.hp = companion.maxHp;
  const weaponIds = ["rusty_sword", "shortsword", "spear"];
  const armorIds = ["cloth_armor", "leather_armor"];
  const weaponId = weaponIds[randomInt(next, 0, weaponIds.length - 1)];
  const armorId = armorIds[randomInt(next, 0, armorIds.length - 1)];
  companion.equipment.weapon = weaponId;
  companion.equipment.armor = armorId;
  companion.equipmentInstances.weapon = createEquipmentInstance(
    ITEM_DEFS[weaponId],
    `${companion.id}-starter-weapon`,
    () => random(next),
  );
  companion.equipmentInstances.armor = createEquipmentInstance(
    ITEM_DEFS[armorId],
    `${companion.id}-starter-armor`,
    () => random(next),
  );
  next.companions.push(companion);
  pushLog(next, `[개발자] ${companion.name}이(가) 동료로 합류했습니다.`);
  updatePlayerFieldOfView(next);
  return next;
}

export function pathTo(
  state: GameState,
  target: Point,
): Point[] {
  if (!inBounds(state, target)) return [];
  const pathTiles = hasStatus(state.player, "levitating")
    ? state.tiles.map((row) =>
        row.map((tile) =>
          tile.terrain === "chasm"
            ? { ...tile, terrain: "specialFloor" as const }
            : tile,
        ),
      )
    : state.tiles;

  const blocked = new Set([
    ...state.enemies.map(mapPointKey),
    ...state.objects
      .filter((object) => !object.looted)
      .map(mapPointKey),
  ]);
  const targetHasEnemy = state.enemies.some(
    (enemy) => enemy.x === target.x && enemy.y === target.y,
  );
  const targetHasObject = state.objects.some(
    (object) =>
      !object.looted &&
      object.x === target.x &&
      object.y === target.y,
  );
  const canUnlock = (state.player.inventory.iron_key ?? 0) > 0;
  if (targetHasEnemy || targetHasObject) blocked.delete(mapPointKey(target));
  if (
    targetHasEnemy ||
    targetHasObject ||
    isWalkable(pathTiles[target.y][target.x].terrain, canUnlock)
  ) {
    return findPath(
      pathTiles,
      state.player,
      target,
      blocked,
      canUnlock,
    );
  }

  let shortest: Point[] | null = null;
  for (const direction of DIRECTIONS) {
    const approach = {
      x: target.x + direction.x,
      y: target.y + direction.y,
    };
    if (
      !inBounds(state, approach) ||
      blocked.has(mapPointKey(approach)) ||
      !isWalkable(
        pathTiles[approach.y][approach.x].terrain,
        canUnlock,
      )
    ) {
      continue;
    }

    const alreadyThere =
      approach.x === state.player.x && approach.y === state.player.y;
    const path = alreadyThere
      ? []
      : findPath(
          pathTiles,
          state.player,
          approach,
          blocked,
          canUnlock,
        );
    if (!alreadyThere && !path.length) continue;
    if (shortest === null || path.length < shortest.length) shortest = path;
  }

  return shortest ?? [];
}

export function pathToPartyActor(
  state: GameState,
  actorId: string,
  target: Point,
): Point[] {
  if (actorId === PLAYER_ID) return pathTo(state, target);
  const actor = (state.companions ?? []).find(
    (companion) => companion.id === actorId && companion.hp > 0,
  );
  if (!actor || !inBounds(state, target)) return [];
  const blocked = new Set([
    mapPointKey(state.player),
    ...(state.companions ?? [])
      .filter((companion) => companion.hp > 0 && companion.id !== actorId)
      .map(mapPointKey),
    ...state.enemies.filter((enemy) => enemy.hp > 0).map(mapPointKey),
    ...state.objects
      .filter((object) => !object.looted)
      .map(mapPointKey),
  ]);
  const targetIsInteractive =
    state.enemies.some((enemy) => enemy.hp > 0 && pointEquals(enemy, target)) ||
    state.objects.some((object) => !object.looted && pointEquals(object, target)) ||
    pointEquals(state.player, target) ||
    state.companions.some(
      (companion) =>
        companion.id !== actorId &&
        companion.hp > 0 &&
        pointEquals(companion, target),
    );
  if (targetIsInteractive) blocked.delete(mapPointKey(target));
  const canUnlock = (state.player.inventory.iron_key ?? 0) > 0;
  if (
    targetIsInteractive ||
    isWalkable(state.tiles[target.y][target.x].terrain, canUnlock)
  ) {
    return findPath(state.tiles, actor, target, blocked, canUnlock);
  }
  return [];
}

export type AutoExplorePlan = {
  kind: "enemy" | "item" | "object" | "frontier";
  target: Point;
  path: Point[];
};

export function planAutoExplore(
  state: GameState,
  options: { ignoreUnpickableItems?: boolean } = {},
): AutoExplorePlan | null {
  const knownPathTo = (target: Point) => {
    const knownTiles = state.tiles.map((row, y) =>
      row.map((tile, x) =>
        tile.discovered || (x === target.x && y === target.y)
          ? tile
          : { ...tile, terrain: "wall" as const },
      ),
    );
    const blocked = new Set([
      ...state.enemies.map(mapPointKey),
      ...state.objects
        .filter((object) => !object.looted)
        .map(mapPointKey),
    ]);
    blocked.delete(mapPointKey(target));
    return findPath(
      knownTiles,
      state.player,
      target,
      blocked,
      (state.player.inventory.iron_key ?? 0) > 0,
    );
  };

  const chooseShortest = (
    kind: AutoExplorePlan["kind"],
    targets: Point[],
  ): AutoExplorePlan | null => {
    const candidates = targets.flatMap((target) => {
      const path = knownPathTo(target);
      const alreadyThere = mapPointKey(target) === mapPointKey(state.player);
      return path.length || alreadyThere ? [{ kind, target, path }] : [];
    });
    return candidates.sort(
      (a, b) =>
        a.path.length - b.path.length ||
        distance(a.target, state.player) - distance(b.target, state.player),
    )[0] ?? null;
  };

  const visibleEnemies = state.enemies.filter(
    (enemy) =>
      enemy.hp > 0 && state.tiles[enemy.y]?.[enemy.x]?.visible,
  );
  const enemyPlan = chooseShortest("enemy", visibleEnemies);
  if (enemyPlan) return enemyPlan;

  const itemPlan = chooseShortest(
    "item",
    state.groundItems.filter(
      (item) =>
        state.tiles[item.y]?.[item.x]?.discovered &&
        (!options.ignoreUnpickableItems || canPickupGroundItem(state, item)),
    ),
  );
  if (itemPlan) return itemPlan;

  const objectPlan = chooseShortest(
    "object",
    state.objects.filter(
      (object) =>
        !object.looted &&
        object.kind !== "alchemy" &&
        state.tiles[object.y]?.[object.x]?.discovered,
    ),
  );
  if (objectPlan) return objectPlan;

  const frontierTargets = state.tiles.flatMap((row, y) =>
    row.flatMap((tile, x) => {
      if (tile.discovered) return [];
      const point = { x, y };
      if (!isWalkable(tile.terrain, false)) return [];
      const touchesKnown = DIRECTIONS.some((direction) => {
        const adjacent = {
          x: x + direction.x,
          y: y + direction.y,
        };
        return (
          inBounds(state, adjacent) &&
          state.tiles[adjacent.y][adjacent.x].discovered
        );
      });
      return touchesKnown ? [point] : [];
    }),
  );
  return chooseShortest("frontier", frontierTargets);
}
