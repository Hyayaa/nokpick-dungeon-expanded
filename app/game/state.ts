import { cloneCompanionInstance } from "./companions";
import { ITEM_DEFS } from "./data";
import { normalizeEquipmentInstance } from "./equipment";
import {
  normalizeCompanionProfession,
  normalizeCompanionSkills,
  normalizeCompanionSkillLevels,
  normalizeLearnedSkills,
  normalizeSkillCooldowns,
} from "./companion-skills";
import { normalizePlayerInventorySlots } from "./inventory-slots";
import { FLEX_EQUIPMENT_KEYS as RING_EQUIPMENT_KEYS } from "./loadout";
import { normalizeSkillResources } from "./skill-resources";
import { normalizeCombatStats } from "./combat-stats";
import type {
  Direction,
  GameState,
  InventoryInstance,
  Player,
} from "./types";

export const cloneInventoryInstance = (instance: InventoryInstance) =>
  normalizeEquipmentInstance(
    {
      ...instance,
      statRoll: instance.statRoll ? { ...instance.statRoll } : undefined,
      traits: (instance.traits ?? []).map((trait) => ({ ...trait })),
    },
    ITEM_DEFS[instance.defId],
  );

type CloneGameOptions = {
  copyTiles?: boolean;
};

export const cloneGame = (
  state: GameState,
  { copyTiles = true }: CloneGameOptions = {},
): GameState => ({
  ...state,
  // Terrain/FOV is by far the largest part of a game state. Inventory-only
  // actions share this immutable grid and copy it only when an action can
  // actually mutate terrain or visibility.
  tiles: copyTiles
    ? state.tiles.map((row) => row.map((tile) => ({ ...tile })))
    : state.tiles,
  player: {
    ...state.player,
    ...normalizeCombatStats(state.player),
    ...normalizeSkillResources(state.player),
    professionId: normalizeCompanionProfession(
      state.player.classId,
      state.player.professionId,
    ),
    traits: [...(state.player.traits ?? [])],
    learnedSkills: normalizeLearnedSkills(
      normalizeCompanionProfession(
        state.player.classId,
        state.player.professionId,
      ),
      state.player.learnedSkills,
      state.player.skills,
    ),
    skillLevels: normalizeCompanionSkillLevels(
      normalizeLearnedSkills(
        normalizeCompanionProfession(
          state.player.classId,
          state.player.professionId,
        ),
        state.player.learnedSkills,
        state.player.skills,
      ),
      state.player.skillLevels,
    ),
    skills: normalizeCompanionSkills(
      normalizeCompanionProfession(
        state.player.classId,
        state.player.professionId,
      ),
      state.player.companionId,
      state.player.skills,
      normalizeLearnedSkills(
        normalizeCompanionProfession(
          state.player.classId,
          state.player.professionId,
        ),
        state.player.learnedSkills,
        state.player.skills,
      ),
    ),
    skillCooldowns: normalizeSkillCooldowns(state.player.skillCooldowns),
    inventory: { ...state.player.inventory },
    inventoryInstances: (state.player.inventoryInstances ?? []).map(
      cloneInventoryInstance,
    ),
    inventorySlots: normalizePlayerInventorySlots(state.player),
    throwableProfiles: Object.fromEntries(
      Object.entries(state.player.throwableProfiles ?? {}).map(
        ([defId, instance]) => [defId, cloneInventoryInstance(instance)],
      ),
    ),
    equipment: {
      ...state.player.equipment,
      ring2: state.player.equipment.ring2 ?? null,
      ring3: state.player.equipment.ring3 ?? null,
      ring4: state.player.equipment.ring4 ?? null,
    },
    equipmentInstances: {
      weapon: state.player.equipmentInstances?.weapon
        ? cloneInventoryInstance(state.player.equipmentInstances.weapon)
        : null,
      armor: state.player.equipmentInstances?.armor
        ? cloneInventoryInstance(state.player.equipmentInstances.armor)
        : null,
      ring: state.player.equipmentInstances?.ring
        ? cloneInventoryInstance(state.player.equipmentInstances.ring)
        : null,
      ring2: state.player.equipmentInstances?.ring2
        ? cloneInventoryInstance(state.player.equipmentInstances.ring2)
        : null,
      ring3: state.player.equipmentInstances?.ring3
        ? cloneInventoryInstance(state.player.equipmentInstances.ring3)
        : null,
      ring4: state.player.equipmentInstances?.ring4
        ? cloneInventoryInstance(state.player.equipmentInstances.ring4)
        : null,
    },
    statuses: (state.player.statuses ?? []).map((status) => ({ ...status })),
    autoSlots: [
      ...(state.player.autoSlots ?? [null, null, null, null]),
    ].slice(0, 4) as Player["autoSlots"],
    wandCharges: { ...(state.player.wandCharges ?? {}) },
    augments: { ...state.player.augments },
  },
  companions: (state.companions ?? []).map((companion) => ({
    ...companion,
    ...normalizeCombatStats(companion),
    ...normalizeSkillResources(companion),
    professionId: normalizeCompanionProfession(
      companion.classId,
      companion.professionId,
    ),
    traits: [...(companion.traits ?? [])],
    learnedSkills: normalizeLearnedSkills(
      normalizeCompanionProfession(
        companion.classId,
        companion.professionId,
      ),
      companion.learnedSkills,
      companion.skills,
    ),
    skillLevels: normalizeCompanionSkillLevels(
      normalizeLearnedSkills(
        normalizeCompanionProfession(
          companion.classId,
          companion.professionId,
        ),
        companion.learnedSkills,
        companion.skills,
      ),
      companion.skillLevels,
    ),
    skills: normalizeCompanionSkills(
      normalizeCompanionProfession(
        companion.classId,
        companion.professionId,
      ),
      companion.id,
      companion.skills,
      normalizeLearnedSkills(
        normalizeCompanionProfession(
          companion.classId,
          companion.professionId,
        ),
        companion.learnedSkills,
        companion.skills,
      ),
    ),
    skillCooldowns: normalizeSkillCooldowns(companion.skillCooldowns),
    statuses: (companion.statuses ?? []).map((status) => ({ ...status })),
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
    priorityTarget: companion.priorityTarget
      ? { ...companion.priorityTarget }
      : null,
    exploreTarget: companion.exploreTarget
      ? { ...companion.exploreTarget }
      : null,
    commandTargetId: companion.commandTargetId ?? null,
    recoveryProgress: companion.recoveryProgress ?? 0,
  })),
  companionTrail: (state.companionTrail ?? []).map((point) => ({ ...point })),
  enemies: state.enemies.map((enemy) => ({
    ...enemy,
    ...normalizeCombatStats(enemy),
    statuses: (enemy.statuses ?? []).map((status) => ({ ...status })),
    skillCooldowns: { ...(enemy.skillCooldowns ?? {}) },
    skillUses: { ...(enemy.skillUses ?? {}) },
    pendingSkill: enemy.pendingSkill
      ? {
          ...enemy.pendingSkill,
          targetPoint: { ...enemy.pendingSkill.targetPoint },
          affectedTiles: enemy.pendingSkill.affectedTiles.map((point) => ({ ...point })),
        }
      : null,
    summonIds: [...(enemy.summonIds ?? [])],
    behaviorState: { ...(enemy.behaviorState ?? {}) },
    drop: enemy.drop
      ? {
          ...enemy.drop,
          instance: enemy.drop.instance
            ? cloneInventoryInstance(enemy.drop.instance)
            : undefined,
        }
      : enemy.drop,
  })),
  groundItems: state.groundItems.map((item) => ({
    ...item,
    instance: item.instance
      ? cloneInventoryInstance(item.instance)
      : undefined,
  })),
  objects: state.objects.map((object) => ({
    ...object,
    loot: [...object.loot],
    lootInstances: object.lootInstances?.map((instance) =>
      instance ? cloneInventoryInstance(instance) : null,
    ),
    lootOrigins: object.lootOrigins ? [...object.lootOrigins] : undefined,
    lootPlanEntryIds: object.lootPlanEntryIds
      ? [...object.lootPlanEntryIds]
      : undefined,
  })),
  clouds: (state.clouds ?? []).map((cloud) => ({
    ...cloud,
    origin: { ...cloud.origin },
    tiles: cloud.tiles.map((tile) => ({ ...tile })),
    tileLifetime:
      cloud.tileLifetime ??
      Math.max(3, cloud.turns, ...cloud.tiles.map((tile) => tile.remaining)),
  })),
  wards: (state.wards ?? []).map((ward) => ({ ...ward })),
  traps: (state.traps ?? []).map((trap) => ({ ...trap })),
  specialRooms: (state.specialRooms ?? []).map((room) => ({ ...room })),
  requiredFloorSpawns: (state.requiredFloorSpawns ?? []).map((spawn) => ({ ...spawn })),
  quests: (state.quests ?? []).map((quest) => ({
    ...quest,
    contentPoint: quest.contentPoint ? { ...quest.contentPoint } : undefined,
  })),
  questNpcs: (state.questNpcs ?? []).map((npc) => ({ ...npc })),
  questRooms: (state.questRooms ?? []).map((room) => ({ ...room })),
  bossEncounter: state.bossEncounter
    ? {
        ...state.bossEncounter,
        room: {
          ...state.bossEncounter.room,
          center: { ...state.bossEncounter.room.center },
        },
        minionIds: [...state.bossEncounter.minionIds],
        bossDeathPoint: state.bossEncounter.bossDeathPoint
          ? { ...state.bossEncounter.bossDeathPoint }
          : undefined,
      }
    : undefined,
  specialRoomPlan: (state.specialRoomPlan ?? []).map((entry) => ({ ...entry })),
  logs: [...state.logs],
  // The expedition loot plan is immutable after the contract is accepted.
  // Floor placement clones an entry's instance before gameplay can mutate it,
  // so ordinary actions can safely share this potentially large list.
  lootPlan: state.lootPlan ?? [],
  goldPlan: state.goldPlan ?? [],
  pendingAugmentOffers: state.pendingAugmentOffers.map((offer) => [...offer]),
  equipmentOffers: (state.equipmentOffers ?? []).map((offer) => ({ ...offer })),
});

export const cloneGameWithoutTiles = (state: GameState) =>
  cloneGame(state, { copyTiles: false });

export const presentationStateWithFacing = (
  state: GameState,
  facing: Direction,
): GameState =>
  state.player.facing === facing
    ? state
    : {
        ...state,
        player: {
          ...state.player,
          facing,
        },
      };
