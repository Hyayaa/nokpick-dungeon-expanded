import {
  ENEMY_DROP_CHANCE,
  ENEMY_DROP_TABLE,
  FLOOR_EQUIPMENT_CATEGORIES,
  FLOOR_LOOT,
  ITEM_DEFS,
} from "./data";
import {
  COMPANION_CLASSES,
  createCompanion,
  normalizeCompanionProgression,
} from "./companions";
import {
  applyEquipmentConsumableToInstance,
  type EquipmentConsumableId,
  createEquipmentInstance,
  createPlainEquipmentInstance,
  isUpgradeableEquipment,
  normalizeEquipmentInstance,
} from "./equipment";
import {
  ITEM_GRADES,
  itemGradeIndex,
  resolveItemGrade,
} from "./item-grade";
import {
  MAX_INVENTORY_SLOTS,
  WAREHOUSE_SLOT_COUNT,
  normalizeFixedSlots,
  normalizePlayerInventorySlots,
  normalizeStorageSlots,
} from "./inventory-slots";
import {
  Companion,
  CompanionClassId,
  DungeonGoldPlanEntry,
  DungeonLootPlanEntry,
  DungeonObjectKind,
  DungeonSpecialRoomPlanEntry,
  EquipmentTraitId,
  InventoryInstance,
  ItemCategory,
  ItemPickup,
  ItemGrade,
  Player,
  ShopState,
  SpecialRoomKind,
} from "./types";
import {
  SPECIAL_ROOM_REGISTRY,
  specialRoomMetadata,
} from "./special-rooms";
import { isQuestItemDefinitionId } from "./quests";
import { normalizeSkillResources } from "./skill-resources";
import {
  normalizeCompanionSkillLevels,
  normalizeLearnedSkills,
} from "./companion-skills";
import {
  addMaterials,
  createCampaignMaterials,
  extractWarehouseMaterials,
  materialKindForItem,
  type CampaignMaterials,
} from "./campaign-materials";
import type { BossId } from "./boss-definitions";
import { normalizeCombatStats } from "./combat-stats";

export type DungeonId = string;
export type DungeonDifficulty = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type DungeonDifficultyGrade = ItemGrade;
export type DungeonOfferKind = "recommended" | "boss";

export type DungeonDefinition = {
  id: DungeonId;
  themeId: string;
  nameKo: string;
  nameEn: string;
  subtitleKo: string;
  subtitleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  difficulty: DungeonDifficulty;
  difficultyGrade: DungeonDifficultyGrade;
  difficultyLabelKo: string;
  difficultyLabelEn: string;
  floorCount: number;
  difficultyScale: number;
  offerKind?: DungeonOfferKind;
  bossId?: BossId;
  mainDropIds: string[];
  specialRoomPlan: DungeonSpecialRoomPlanEntry[];
  lootPlan: DungeonLootPlanEntry[];
  goldPlan: DungeonGoldPlanEntry[];
  completionGold: number;
  goldTarget: number;
  accent: string;
};

type DungeonTheme = Omit<
  DungeonDefinition,
  | "id"
  | "themeId"
  | "difficulty"
  | "difficultyGrade"
  | "difficultyLabelKo"
  | "difficultyLabelEn"
  | "floorCount"
  | "difficultyScale"
  | "offerKind"
  | "bossId"
  | "mainDropIds"
  | "specialRoomPlan"
  | "lootPlan"
  | "goldPlan"
  | "completionGold"
  | "goldTarget"
> & {
  themeId: string;
  lootCategories: ItemCategory[];
};

const DUNGEON_THEMES: DungeonTheme[] = [
  {
    themeId: "flooded_sewers",
    nameKo: "침수된 하수도",
    nameEn: "Flooded Sewers",
    subtitleKo: "버려진 수로",
    subtitleEn: "Abandoned Waterway",
    descriptionKo:
      "침수된 수로 곳곳에 식량과 회복 물자, 낡은 장비가 떠밀려 와 있습니다.",
    descriptionEn:
      "Food, healing supplies, and worn equipment have washed into the flooded channels.",
    lootCategories: ["potion", "food", "armor"],
    accent: "#789c86",
  },
  {
    themeId: "prison_ruins",
    nameKo: "무너진 감옥",
    nameEn: "Ruined Prison",
    subtitleKo: "녹슨 형무소",
    subtitleEn: "The Rusted Gaol",
    descriptionKo:
      "무장한 적이 순찰하는 폐허로, 무기와 주문서, 투척 장비가 감방에 남아 있습니다.",
    descriptionEn:
      "Armed enemies patrol cells that still contain weapons, scrolls, and thrown equipment.",
    lootCategories: ["weapon", "scroll", "missile"],
    accent: "#a98265",
  },
  {
    themeId: "forgotten_catacombs",
    nameKo: "잊힌 지하묘지",
    nameEn: "Forgotten Catacombs",
    subtitleKo: "봉인된 납골당",
    subtitleEn: "The Sealed Ossuary",
    descriptionKo:
      "봉인된 납골당 사이에 완드와 반지, 오래된 유물이 함께 묻혀 있습니다.",
    descriptionEn:
      "Wands, rings, and old artifacts lie buried among the sealed ossuaries.",
    lootCategories: ["wand", "ring", "artifact"],
    accent: "#8f718e",
  },
  {
    themeId: "sunken_archive",
    nameKo: "가라앉은 기록보관소",
    nameEn: "Sunken Archive",
    subtitleKo: "물에 잠긴 서고",
    subtitleEn: "The Drowned Stacks",
    descriptionKo:
      "침수된 서가 사이에 주문서와 마법 도구가 남아 있는 오래된 기록보관소입니다.",
    descriptionEn:
      "An old archive where scrolls and magical implements remain between flooded shelves.",
    lootCategories: ["scroll", "wand", "potion"],
    accent: "#678e9f",
  },
  {
    themeId: "ember_mine",
    nameKo: "꺼지지 않는 광산",
    nameEn: "Ember Mine",
    subtitleKo: "불씨가 남은 갱도",
    subtitleEn: "The Smoldering Shafts",
    descriptionKo:
      "무너진 채굴장 깊숙한 곳에 무기와 방어구, 폭발물이 함께 묻혀 있습니다.",
    descriptionEn:
      "Weapons, armor, and explosives lie buried in the depths of a collapsed mine.",
    lootCategories: ["weapon", "armor", "bomb"],
    accent: "#ad7656",
  },
  {
    themeId: "overgrown_shrine",
    nameKo: "뒤덮인 숲의 사당",
    nameEn: "Overgrown Shrine",
    subtitleKo: "뿌리에 삼켜진 성소",
    subtitleEn: "The Rootbound Sanctuary",
    descriptionKo:
      "고대 성소를 뒤덮은 식물 사이에서 씨앗과 영약, 희귀한 유물을 찾을 수 있습니다.",
    descriptionEn:
      "Seeds, elixirs, and rare artifacts hide among the roots covering an ancient sanctuary.",
    lootCategories: ["seed", "elixir", "artifact"],
    accent: "#6e9a68",
  },
  {
    themeId: "frozen_aqueduct",
    nameKo: "얼어붙은 수도교",
    nameEn: "Frozen Aqueduct",
    subtitleKo: "서리가 밴 수로",
    subtitleEn: "The Frostbound Channel",
    descriptionKo:
      "차가운 수로 곳곳에 원거리 무기와 물약, 냉기 마법 도구가 얼어붙어 있습니다.",
    descriptionEn:
      "Missiles, potions, and frost-touched implements are trapped throughout the frozen channel.",
    lootCategories: ["missile", "potion", "wand"],
    accent: "#6f9fb0",
  },
  {
    themeId: "brigand_vault",
    nameKo: "도적단의 금고",
    nameEn: "Brigand Vault",
    subtitleKo: "봉인된 약탈품 창고",
    subtitleEn: "The Sealed Hoard",
    descriptionKo:
      "약탈품을 모아 둔 금고로, 정교한 무기와 반지, 주문서가 뒤섞여 있습니다.",
    descriptionEn:
      "A sealed hoard where finely made weapons, rings, and scrolls are mixed together.",
    lootCategories: ["weapon", "ring", "scroll"],
    accent: "#a78b54",
  },
  {
    themeId: "plague_laboratory",
    nameKo: "폐쇄된 역병 연구소",
    nameEn: "Plague Laboratory",
    subtitleKo: "금지된 연금술실",
    subtitleEn: "The Forbidden Stillroom",
    descriptionKo:
      "버려진 실험실에 불안정한 혼합물과 영약, 특수 물약이 남아 있습니다.",
    descriptionEn:
      "Unstable brews, elixirs, and unusual potions remain inside an abandoned laboratory.",
    lootCategories: ["brew", "elixir", "potion"],
    accent: "#8f8b59",
  },
  {
    themeId: "shattered_watchtower",
    nameKo: "부서진 감시탑",
    nameEn: "Shattered Watchtower",
    subtitleKo: "바람 부는 초소",
    subtitleEn: "The Wind-cut Outpost",
    descriptionKo:
      "무너진 초소의 병기고에 투척 무기와 장비, 전투용 반지가 남아 있습니다.",
    descriptionEn:
      "Thrown weapons, equipment, and battle rings remain in the ruined outpost armory.",
    lootCategories: ["missile", "weapon", "ring"],
    accent: "#8b8c83",
  },
  {
    themeId: "drowned_temple",
    nameKo: "잠긴 심해 사원",
    nameEn: "Drowned Temple",
    subtitleKo: "검푸른 제단",
    subtitleEn: "The Deep-blue Altar",
    descriptionKo:
      "수몰된 제단 주변에 유물과 완드, 오래된 의식 주문서가 가라앉아 있습니다.",
    descriptionEn:
      "Artifacts, wands, and ritual scrolls rest around the submerged altar.",
    lootCategories: ["artifact", "wand", "scroll"],
    accent: "#687c9b",
  },
  {
    themeId: "crystal_cavern",
    nameKo: "메아리 수정동굴",
    nameEn: "Echoing Crystal Cavern",
    subtitleKo: "빛나는 지하 공동",
    subtitleEn: "The Resonant Hollow",
    descriptionKo:
      "마력이 응축된 공동에서 반지와 완드, 단단한 방어구를 발견할 수 있습니다.",
    descriptionEn:
      "Rings, wands, and sturdy armor can be found in a cavern dense with magical crystals.",
    lootCategories: ["ring", "wand", "armor"],
    accent: "#8a75a5",
  },
];

export const DUNGEON_DIFFICULTY_RULES: Record<
  DungeonDifficulty,
  {
    grade: DungeonDifficultyGrade;
    labelKo: string;
    labelEn: string;
    minimumFloor: number;
    maximumFloor: number;
    enemyStatMultiplier: number;
    itemTier: number;
    minimumItemGrade: ItemGrade;
    maximumItemGrade: ItemGrade;
  }
> = {
  1: {
    grade: "F",
    labelKo: "매우 쉬움",
    labelEn: "Very Easy",
    minimumFloor: 3,
    maximumFloor: 4,
    enemyStatMultiplier: 1,
    itemTier: 1,
    minimumItemGrade: "F",
    maximumItemGrade: "F",
  },
  2: {
    grade: "E",
    labelKo: "쉬움",
    labelEn: "Easy",
    minimumFloor: 3,
    maximumFloor: 5,
    enemyStatMultiplier: Number(Math.pow(50, 1 / 6).toFixed(6)),
    itemTier: 2,
    minimumItemGrade: "F",
    maximumItemGrade: "E",
  },
  3: {
    grade: "D",
    labelKo: "약간 쉬움",
    labelEn: "Slightly Easy",
    minimumFloor: 4,
    maximumFloor: 5,
    enemyStatMultiplier: Number(Math.pow(50, 2 / 6).toFixed(6)),
    itemTier: 2,
    minimumItemGrade: "E",
    maximumItemGrade: "D",
  },
  4: {
    grade: "C",
    labelKo: "보통",
    labelEn: "Normal",
    minimumFloor: 5,
    maximumFloor: 6,
    enemyStatMultiplier: Number(Math.pow(50, 3 / 6).toFixed(6)),
    itemTier: 3,
    minimumItemGrade: "D",
    maximumItemGrade: "C",
  },
  5: {
    grade: "B",
    labelKo: "약간 어려움",
    labelEn: "Slightly Hard",
    minimumFloor: 6,
    maximumFloor: 7,
    enemyStatMultiplier: Number(Math.pow(50, 4 / 6).toFixed(6)),
    itemTier: 3,
    minimumItemGrade: "C",
    maximumItemGrade: "B",
  },
  6: {
    grade: "A",
    labelKo: "어려움",
    labelEn: "Hard",
    minimumFloor: 7,
    maximumFloor: 8,
    enemyStatMultiplier: Number(Math.pow(50, 5 / 6).toFixed(6)),
    itemTier: 4,
    minimumItemGrade: "B",
    maximumItemGrade: "A",
  },
  7: {
    grade: "S",
    labelKo: "매우 어려움",
    labelEn: "Very Hard",
    minimumFloor: 8,
    maximumFloor: 9,
    enemyStatMultiplier: 50,
    itemTier: 5,
    minimumItemGrade: "S",
    maximumItemGrade: "S",
  },
};

const seededRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000;
  };
};

const shuffleWith = <T,>(values: readonly T[], random: () => number) => {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
};

const randomBetween = (
  minimum: number,
  maximum: number,
  random: () => number,
) => minimum + Math.floor(random() * (maximum - minimum + 1));

const dropCandidates = (
  category: ItemCategory | null,
  maximumTier: number,
) =>
  Object.values(ITEM_DEFS)
    .filter(
      (definition) =>
        definition.category !== "key" &&
        definition.id !== "gold" &&
        (!category || definition.category === category) &&
        (definition.minFloor ?? 1) <= maximumTier,
    )
    .map((definition) => definition.id);

const plannedItemQuantity = (defId: string) =>
  ITEM_DEFS[defId]?.category === "missile" ? 3 : 1;

const tieredFloorLootCandidates = (
  categories: readonly ItemCategory[],
  maximumTier: number,
  excludedIds: ReadonlySet<string> = new Set(),
) => {
  const categorySet = new Set(categories);
  const available = FLOOR_LOOT.filter((itemId) => {
    const definition = ITEM_DEFS[itemId];
    return Boolean(
      definition &&
        categorySet.has(definition.category) &&
        !excludedIds.has(itemId) &&
        (definition.minFloor ?? 1) <= maximumTier,
    );
  });
  if (!available.length) return [];
  const highestAvailableTier = Math.max(
    ...available.map((itemId) => ITEM_DEFS[itemId]?.minFloor ?? 1),
  );
  const preferredMinimumTier = Math.max(1, highestAvailableTier - 1);
  const preferred = available.filter(
    (itemId) =>
      (ITEM_DEFS[itemId]?.minFloor ?? 1) >= preferredMinimumTier,
  );
  return preferred.length ? preferred : available;
};

const pickTieredFloorLoot = (
  categories: readonly ItemCategory[],
  maximumTier: number,
  random: () => number,
  excludedIds?: ReadonlySet<string>,
) => {
  const pool = tieredFloorLootCandidates(
    categories,
    maximumTier,
    excludedIds,
  );
  if (!pool.length) {
    throw new Error(
      `No planned dungeon loot is available for: ${categories.join(", ")}`,
    );
  }
  return pool[Math.floor(random() * pool.length)];
};

const plannedEnemyCount = (floor: number, difficulty: DungeonDifficulty) =>
  Math.min(18 + floor * 4 + (difficulty - 1) * 2, 52);

export const DUNGEON_GOLD_TARGETS: Record<DungeonDifficulty, number> = {
  1: 1_000,
  2: 3_200,
  3: 10_000,
  4: 32_000,
  5: 100_000,
  6: 320_000,
  7: 1_000_000,
};

export const formatGold = (amount: number) => {
  const normalized = Number.isFinite(amount)
    ? Math.max(0, Math.floor(amount))
    : 0;
  return String(normalized).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const splitGoldBudget = (
  budget: number,
  slotCount: number,
  random: () => number,
) => {
  const count = Math.max(1, Math.min(Math.floor(budget), slotCount));
  const weights = Array.from({ length: count }, () => 0.7 + random() * 0.6);
  const weightTotal = weights.reduce((total, weight) => total + weight, 0);
  const distributable = budget - count;
  const amounts = weights.map(
    (weight) => 1 + Math.floor((distributable * weight) / weightTotal),
  );
  let remainder = budget - amounts.reduce((total, amount) => total + amount, 0);
  const remainderOrder = shuffleWith(
    Array.from({ length: count }, (_, index) => index),
    random,
  );
  for (let index = 0; remainder > 0; index += 1) {
    amounts[remainderOrder[index % remainderOrder.length]] += 1;
    remainder -= 1;
  }
  return amounts;
};

const createDungeonGoldPlan = ({
  planId,
  seed,
  difficulty,
  floorCount,
}: {
  planId: string;
  seed: number;
  difficulty: DungeonDifficulty;
  floorCount: number;
}) => {
  const random = seededRandom(seed ^ 0xc2b2ae35);
  const goldTarget = DUNGEON_GOLD_TARGETS[difficulty];
  const completionGold = Math.round(goldTarget * 0.2);
  const groundBudget = Math.round(goldTarget * 0.3);
  const enemyBudget = goldTarget - completionGold - groundBudget;
  const groundFloors = Array.from({ length: floorCount }, (_, index) => index + 1)
    .flatMap((floor) => [floor, ...(random() < 0.35 ? [floor] : [])]);
  const enemyFloors = Array.from({ length: floorCount }, (_, index) => index + 1)
    .flatMap((floor) =>
      Array.from(
        {
          length: Math.max(
            2,
            Math.round(plannedEnemyCount(floor, difficulty) * 0.12),
          ),
        },
        () => floor,
      ),
    );
  const groundAmounts = splitGoldBudget(
    groundBudget,
    groundFloors.length,
    random,
  );
  const enemyAmounts = splitGoldBudget(enemyBudget, enemyFloors.length, random);
  const goldPlan: DungeonGoldPlanEntry[] = [
    ...groundFloors.map((floor, index) => ({
      id: `${planId}-gold-ground-${index + 1}`,
      floor,
      source: "ground" as const,
      amount: groundAmounts[index],
    })),
    ...enemyFloors.map((floor, index) => ({
      id: `${planId}-gold-enemy-${index + 1}`,
      floor,
      source: "enemy" as const,
      amount: enemyAmounts[index],
    })),
  ];
  return { goldPlan, completionGold, goldTarget };
};

const pickEnemyDrop = (random: () => number) => {
  const roll = random();
  let accumulatedWeight = 0;
  return (
    ENEMY_DROP_TABLE.find(({ weight }) => {
      accumulatedWeight += weight;
      return roll < accumulatedWeight;
    }) ?? ENEMY_DROP_TABLE[ENEMY_DROP_TABLE.length - 1]
  ).itemId;
};

type PlannedRewardCandidate = {
  source: "ground" | "object";
  defId: string;
  priority: number;
  objectKind?: Exclude<DungeonObjectKind, "alchemy">;
};

const pickWeightedSpecial = (
  candidates: readonly typeof SPECIAL_ROOM_REGISTRY[number][],
  random: () => number,
) => {
  const total = candidates.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of candidates) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return candidates[candidates.length - 1];
};

export const createDungeonSpecialRoomPlan = ({
  planId,
  seed,
  floorCount,
}: {
  planId: string;
  seed: number;
  floorCount: number;
}): DungeonSpecialRoomPlanEntry[] => {
  const random = seededRandom(seed ^ 0x73a9c5d1);
  const eligibleFloors = shuffleWith(
    Array.from({ length: floorCount }, (_, index) => index + 1),
    random,
  );
  const potionPool = SPECIAL_ROOM_REGISTRY.filter(
    (entry) => entry.compatibilityGroup === "potion-solution",
  );
  const potionCount = Math.min(
    eligibleFloors.length,
    random() < 0.5 ? 1 : 2,
  );
  const plan: DungeonSpecialRoomPlanEntry[] = [];
  const remainingPotions = [...potionPool];
  for (let index = 0; index < potionCount; index += 1) {
    const selected = pickWeightedSpecial(remainingPotions, random);
    plan.push({
      id: `${planId}-special-${index + 1}`,
      floor: eligibleFloors[index],
      preset: selected.preset,
    });
    remainingPotions.splice(remainingPotions.indexOf(selected), 1);
  }
  const crystalFloor = eligibleFloors[potionCount];
  if (crystalFloor !== undefined && random() < 0.6) {
    const crystalPool = SPECIAL_ROOM_REGISTRY.filter(
      (entry) => entry.compatibilityGroup === "crystal-key",
    );
    const selected = pickWeightedSpecial(crystalPool, random);
    plan.push({
      id: `${planId}-special-${plan.length + 1}`,
      floor: crystalFloor,
      preset: selected.preset,
    });
  }
  return plan.sort((first, second) => first.floor - second.floor);
};

type SpecialRewardProfile = {
  categories: readonly ItemCategory[];
  tier: 1 | 2 | 3;
  objectKind?: Exclude<DungeonObjectKind, "alchemy">;
};

const specialRewardProfiles = (
  roomKind: SpecialRoomKind,
): SpecialRewardProfile[] => {
  if (roomKind === "storage") {
    return Array.from({ length: 4 }, (_, index) => ({
      categories: ["potion", "scroll", "food", "weapon", "armor"],
      tier: index === 0 ? 2 : 1,
    }));
  }
  if (roomKind === "magicalFire") {
    return Array.from({ length: 4 }, (_, index) => ({
      categories: ["potion", "scroll", "food", "wand"],
      tier: index === 0 ? 2 : 1,
    }));
  }
  if (roomKind === "toxicGas") {
    return Array.from({ length: 3 }, (_, index) => ({
      categories: index === 0
        ? ["ring", "wand", "artifact"]
        : ["potion", "scroll", "misc"],
      tier: index === 0 ? 2 : 1,
      objectKind: index === 0 ? "crystalChest" : "chest",
    }));
  }
  if (roomKind === "traps") {
    return [{
      categories: ["weapon", "armor", "wand", "ring"],
      tier: 3,
      objectKind: "crystalChest",
    }];
  }
  if (roomKind === "crystalChoice") {
    return [
      { categories: ["potion", "scroll"], tier: 2, objectKind: "chest" },
      {
        categories: ["wand", "ring", "artifact", "weapon", "armor"],
        tier: 3,
        objectKind: "crystalChest",
      },
    ];
  }
  return Array.from({ length: 6 }, (_, index) => ({
    categories: index < 2
      ? ["potion", "scroll", "food"]
      : index < 4
        ? ["potion", "scroll", "bomb", "brew"]
        : ["potion", "scroll", "wand", "artifact"],
    tier: (Math.floor(index / 2) + 1) as 1 | 2 | 3,
  }));
};

export const createDungeonLootPlan = ({
  planId,
  seed,
  difficulty,
  floorCount,
  mainDropIds,
  specialRoomPlan,
}: {
  planId: string;
  seed: number;
  difficulty: DungeonDifficulty;
  floorCount: number;
  mainDropIds: readonly string[];
  specialRoomPlan: readonly DungeonSpecialRoomPlanEntry[];
}) => {
  const rules = DUNGEON_DIFFICULTY_RULES[difficulty];
  const random = seededRandom(seed ^ 0xa511e9b3);
  const entries: DungeonLootPlanEntry[] = [];
  let entryIndex = 0;

  const appendEntry = (
    floor: number,
    source: DungeonLootPlanEntry["source"],
    defId: string,
    options: Pick<
      DungeonLootPlanEntry,
      "objectKind" | "purpose" | "roomKind" | "slotIndex"
    > = {},
  ) => {
    const id = `${planId}-loot-${entryIndex + 1}`;
    const definition = ITEM_DEFS[defId];
    const minimumGradeIndex = itemGradeIndex(rules.minimumItemGrade);
    const maximumGradeIndex = itemGradeIndex(rules.maximumItemGrade);
    const grade = ITEM_GRADES[
      minimumGradeIndex +
        Math.floor(random() * (maximumGradeIndex - minimumGradeIndex + 1))
    ];
    const instance = isUpgradeableEquipment(definition)
      ? createEquipmentInstance(definition!, `${id}-instance`, random, {
          grade,
        })
      : undefined;
    const quantity = plannedItemQuantity(defId);
    if (instance && definition?.category === "missile") {
      instance.baseMaxCharges = quantity;
      instance.maxCharges = quantity;
      instance.charges = quantity;
    }
    entries.push({
      id,
      floor,
      source,
      defId,
      quantity,
      ...options,
      instance,
    });
    entryIndex += 1;
  };

  for (let floor = 1; floor <= floorCount; floor += 1) {
    appendEntry(floor, "ground", "iron_key", { purpose: "key" });
  }

  specialRoomPlan.forEach((room) => {
    const requiredCount = room.preset === "crystalPath" ? 3 : 1;
    for (let index = 0; index < requiredCount; index += 1) {
      appendEntry(room.floor, "ground", specialRoomMetadata(room.preset).requiredItemId, {
        purpose:
          specialRoomMetadata(room.preset).compatibilityGroup === "crystal-key"
            ? "key"
            : "requiredSolution",
        roomKind: room.preset,
        slotIndex: index,
      });
    }
  });

  const potionRooms = specialRoomPlan.filter(
    (room) =>
      specialRoomMetadata(room.preset).compatibilityGroup === "potion-solution",
  );
  const majorSlots = new Map<string, Set<number>>();
  mainDropIds.slice(0, 2).forEach((defId, index) => {
    const room = potionRooms.length === 1
      ? potionRooms[0]
      : potionRooms[index % potionRooms.length];
    if (!room) return;
    const slotIndex = potionRooms.length === 1 ? index : 0;
    const occupied = majorSlots.get(room.id) ?? new Set<number>();
    occupied.add(slotIndex);
    majorSlots.set(room.id, occupied);
    appendEntry(room.floor, "specialReward", defId, {
      purpose: "majorLoot",
      roomKind: room.preset,
      slotIndex,
    });
  });

  specialRoomPlan.forEach((room) => {
    specialRewardProfiles(room.preset).forEach((profile, slotIndex) => {
      if (majorSlots.get(room.id)?.has(slotIndex)) return;
      const rolls = Array.from({ length: profile.tier }, () =>
        pickTieredFloorLoot(profile.categories, rules.itemTier, random),
      );
      const defId = rolls.sort(
        (first, second) =>
          (ITEM_DEFS[second]?.minFloor ?? 1) -
          (ITEM_DEFS[first]?.minFloor ?? 1),
      )[0];
      appendEntry(room.floor, "specialReward", defId, {
        purpose: "specialReward",
        roomKind: room.preset,
        slotIndex,
        objectKind: profile.objectKind,
      });
    });
  });

  for (let floor = 1; floor <= floorCount; floor += 1) {
    const candidates: PlannedRewardCandidate[] = [
      {
        source: "ground",
        defId: "potion_healing",
        priority: 1,
      },
    ];
    const potionCount = 1 + Math.floor(random() * 3);
    const usedPotions = new Set(["potion_healing"]);
    for (let index = 1; index < potionCount; index += 1) {
      const defId = pickTieredFloorLoot(
        ["potion"],
        rules.itemTier,
        random,
        usedPotions,
      );
      usedPotions.add(defId);
      candidates.push({ source: "ground", defId, priority: 0 });
    }

    if (random() < 0.5) {
      candidates.push({
        source: "ground",
        defId: pickTieredFloorLoot(
          FLOOR_EQUIPMENT_CATEGORIES,
          rules.itemTier,
          random,
        ),
        priority: 0,
      });
    }

    const objectCount = 1 + Math.floor(random() * 2);
    for (let index = 0; index < objectCount; index += 1) {
      const objectRoll = random();
      candidates.push({
        source: "object",
        defId: pickTieredFloorLoot(
          FLOOR_EQUIPMENT_CATEGORIES,
          rules.itemTier,
          random,
        ),
        priority: 0,
        objectKind:
          objectRoll < 0.58
            ? "chest"
            : objectRoll < 0.82
              ? "tomb"
              : "crystalChest",
      });
    }

    const featuredCount = candidates.filter(
      (candidate) => candidate.priority >= 4,
    ).length;
    const rewardCount = Math.max(
      featuredCount,
      1,
      Math.round(candidates.length / 3),
    );
    candidates
      .map((candidate) => ({ candidate, tieBreaker: random() }))
      .sort(
        (a, b) =>
          b.candidate.priority - a.candidate.priority ||
          a.tieBreaker - b.tieBreaker,
      )
      .slice(0, rewardCount)
      .forEach(({ candidate }) =>
        appendEntry(
          floor,
          candidate.source,
          candidate.defId,
          { objectKind: candidate.objectKind, purpose: "normal" },
        ),
      );

    for (
      let enemyIndex = 0;
      enemyIndex < plannedEnemyCount(floor, difficulty);
      enemyIndex += 1
    ) {
      if (random() >= ENEMY_DROP_CHANCE) continue;
      appendEntry(floor, "enemy", pickEnemyDrop(random), { purpose: "normal" });
    }
  }

  const runeRoll = random();
  const runeJitter = runeRoll < 0.25 ? -1 : runeRoll < 0.75 ? 0 : 1;
  const runeFloors = shuffleWith(
    Array.from({ length: floorCount }, (_, index) => index + 1),
    random,
  );
  if (runeJitter < 0 && runeFloors.length > 1) runeFloors.pop();
  if (runeJitter > 0 && runeFloors.length > 0) {
    runeFloors.push(runeFloors[Math.floor(random() * runeFloors.length)]);
  }
  const runestones = dropCandidates("stone", rules.itemTier);
  runeFloors.forEach((floor) =>
    appendEntry(
      floor,
      "ground",
      runestones[Math.floor(random() * runestones.length)],
      { purpose: "runeStone" },
    ),
  );

  if (!entries.some((entry) => entry.instance)) {
    appendEntry(
      Math.max(1, Math.ceil(floorCount / 2)),
      "object",
      pickTieredFloorLoot(
        FLOOR_EQUIPMENT_CATEGORIES,
        rules.itemTier,
        random,
      ),
      { objectKind: "crystalChest", purpose: "normal" },
    );
  }

  return entries;
};

const MAIN_LOOT_EXCLUDED_CATEGORIES = new Set<ItemCategory>([
  "seed",
  "potion",
  "stone",
]);

/** The hub reads the exact major-loot instances selected before geometry. */
export const selectMainLootEntries = (
  lootPlan: readonly DungeonLootPlanEntry[],
) => {
  const plannedMajorLoot = lootPlan.filter(
    (entry) => entry.purpose === "majorLoot",
  );
  if (plannedMajorLoot.length > 0) return plannedMajorLoot.slice(0, 2);

  // Older saved plans did not carry purpose metadata. Keep their previous
  // deterministic selection without rerolling any instance.
  const bestByDefinition = new Map<
    string,
    { entry: DungeonLootPlanEntry; gradeIndex: number; planIndex: number }
  >();
  lootPlan.forEach((entry, planIndex) => {
    const definition = ITEM_DEFS[entry.defId];
    if (!definition || MAIN_LOOT_EXCLUDED_CATEGORIES.has(definition.category)) {
      return;
    }
    const gradeIndex = itemGradeIndex(
      resolveItemGrade(definition, entry.instance),
    );
    const existing = bestByDefinition.get(entry.defId);
    if (!existing || gradeIndex > existing.gradeIndex) {
      bestByDefinition.set(entry.defId, { entry, gradeIndex, planIndex });
    }
  });
  return [...bestByDefinition.values()]
    .sort(
      (a, b) =>
        b.gradeIndex - a.gradeIndex ||
        (ITEM_DEFS[b.entry.defId]?.minFloor ?? 1) -
          (ITEM_DEFS[a.entry.defId]?.minFloor ?? 1) ||
        a.planIndex - b.planIndex,
    )
    .slice(0, 2)
    .map(({ entry }) => entry);
};

export const selectMainLootIds = (
  lootPlan: readonly DungeonLootPlanEntry[],
) => selectMainLootEntries(lootPlan).map((entry) => entry.defId);

export const newExpeditionPickups = (pickups: readonly ItemPickup[]) =>
  pickups.filter(
    (pickup) =>
      pickup.lootOrigin !== "carried" &&
      pickup.defId !== "gold" &&
      ITEM_DEFS[pickup.defId]?.category !== "key",
  );

export const INITIAL_DUNGEON_OFFER_SEED = 0x4d2b91a7;

export type BossDungeonStage = {
  difficulty: DungeonDifficulty;
  bossId: BossId;
  themeId: string;
  floorCount: number;
};

export const BOSS_DUNGEON_STAGES: Readonly<
  Partial<Record<DungeonDifficulty, BossDungeonStage>>
> = {
  2: {
    difficulty: 2,
    bossId: "goo",
    themeId: "flooded_sewers",
    floorCount: 2,
  },
};

export const normalizeBossDungeonClears = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;

export const bossDifficultyForClears = (
  bossDungeonClears: unknown,
): DungeonDifficulty =>
  Math.min(
    2 + normalizeBossDungeonClears(bossDungeonClears),
    7,
  ) as DungeonDifficulty;

export const maximumRecommendedDifficulty = (
  bossDungeonClears: unknown,
): DungeonDifficulty => bossDifficultyForClears(bossDungeonClears);

const selectOfferMainDrops = ({
  theme,
  rules,
  random,
  usedPrimaryDrops,
}: {
  theme: DungeonTheme;
  rules: typeof DUNGEON_DIFFICULTY_RULES[DungeonDifficulty];
  random: () => number;
  usedPrimaryDrops: Set<string>;
}) => {
  const selectedDrops: string[] = [];
  const categoryOrder = shuffleWith(theme.lootCategories, random);

  categoryOrder.forEach((category) => {
    if (selectedDrops.length >= 2) return;
    const candidates = shuffleWith(
      dropCandidates(category, rules.itemTier),
      random,
    );
    const candidate = candidates.find(
      (itemId) =>
        !selectedDrops.includes(itemId) &&
        (selectedDrops.length > 0 || !usedPrimaryDrops.has(itemId)),
    );
    if (candidate) selectedDrops.push(candidate);
  });

  if (selectedDrops.length < 2) {
    const fallbackCandidates = shuffleWith(
      dropCandidates(null, rules.itemTier),
      random,
    );
    fallbackCandidates.forEach((itemId) => {
      if (
        selectedDrops.length < 2 &&
        !selectedDrops.includes(itemId) &&
        (selectedDrops.length > 0 || !usedPrimaryDrops.has(itemId))
      ) {
        selectedDrops.push(itemId);
      }
    });
  }
  if (
    !selectedDrops.some(
      (itemId) => ITEM_DEFS[itemId]?.category === "scroll",
    )
  ) {
    const featuredScroll = shuffleWith(
      dropCandidates("scroll", rules.itemTier),
      random,
    ).find((itemId) => !selectedDrops.includes(itemId));
    if (featuredScroll) {
      if (selectedDrops.length >= 2) {
        selectedDrops[selectedDrops.length - 1] = featuredScroll;
      } else {
        selectedDrops.push(featuredScroll);
      }
    }
  }
  if (selectedDrops[0]) usedPrimaryDrops.add(selectedDrops[0]);
  return selectedDrops;
};

const createDungeonOffer = ({
  seed,
  index,
  theme,
  difficulty,
  floorCount,
  offerKind,
  bossId,
  random,
  usedPrimaryDrops,
}: {
  seed: number;
  index: number;
  theme: DungeonTheme;
  difficulty: DungeonDifficulty;
  floorCount: number;
  offerKind: DungeonOfferKind;
  bossId?: BossId;
  random: () => number;
  usedPrimaryDrops: Set<string>;
}): DungeonDefinition => {
  const rules = DUNGEON_DIFFICULTY_RULES[difficulty];
  const selectedDrops = selectOfferMainDrops({
    theme,
    rules,
    random,
    usedPrimaryDrops,
  });
  const id = `${offerKind}-${theme.themeId}-${(seed >>> 0).toString(16)}-${index + 1}`;
  const dungeonPlanSeed =
    (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  const specialRoomPlan = createDungeonSpecialRoomPlan({
    planId: id,
    seed: dungeonPlanSeed,
    floorCount,
  });
  const lootPlan = createDungeonLootPlan({
    planId: id,
    seed: dungeonPlanSeed,
    difficulty,
    floorCount,
    mainDropIds: selectedDrops,
    specialRoomPlan,
  });
  const { goldPlan, completionGold, goldTarget } = createDungeonGoldPlan({
    planId: id,
    seed: (seed ^ Math.imul(index + 1, 0x85ebca6b)) >>> 0,
    difficulty,
    floorCount,
  });
  return {
    id,
    themeId: theme.themeId,
    nameKo: theme.nameKo,
    nameEn: theme.nameEn,
    subtitleKo: theme.subtitleKo,
    subtitleEn: theme.subtitleEn,
    descriptionKo: theme.descriptionKo,
    descriptionEn: theme.descriptionEn,
    difficulty,
    difficultyGrade: rules.grade,
    difficultyLabelKo: rules.labelKo,
    difficultyLabelEn: rules.labelEn,
    floorCount,
    difficultyScale: rules.enemyStatMultiplier,
    offerKind,
    bossId,
    mainDropIds: selectMainLootIds(lootPlan),
    specialRoomPlan,
    lootPlan,
    goldPlan,
    completionGold,
    goldTarget,
    accent: theme.accent,
  };
};

export const generateRecommendedDungeonOffers = (
  seed: number,
  bossDungeonClears = 0,
): DungeonDefinition[] => {
  const random = seededRandom(seed || INITIAL_DUNGEON_OFFER_SEED);
  const bossDifficulty = bossDifficultyForClears(bossDungeonClears);
  const activeBossThemeId = BOSS_DUNGEON_STAGES[bossDifficulty]?.themeId;
  const themes = shuffleWith(
    DUNGEON_THEMES.filter((theme) => theme.themeId !== activeBossThemeId),
    random,
  ).slice(0, 5);
  const maxDifficulty = maximumRecommendedDifficulty(bossDungeonClears);
  const unlockedDifficulties = Array.from(
    { length: maxDifficulty },
    (_, index) => (index + 1) as DungeonDifficulty,
  );
  const randomDifficulties = Array.from(
    { length: 3 },
    () => unlockedDifficulties[Math.floor(random() * unlockedDifficulties.length)],
  );
  const difficulties = shuffleWith<DungeonDifficulty>(
    [1, maxDifficulty, ...randomDifficulties],
    random,
  );
  const usedPrimaryDrops = new Set<string>();
  let firstEasyOfferAssigned = false;

  return themes.map((theme, index) => {
    const difficulty = difficulties[index];
    const rules = DUNGEON_DIFFICULTY_RULES[difficulty];
    let floorCount = randomBetween(
      rules.minimumFloor,
      rules.maximumFloor,
      random,
    );
    if (difficulty === 1 && !firstEasyOfferAssigned) {
      floorCount = 3;
      firstEasyOfferAssigned = true;
    }
    return createDungeonOffer({
      seed,
      index,
      theme,
      difficulty,
      floorCount,
      offerKind: "recommended",
      random,
      usedPrimaryDrops,
    });
  });
};

export const createBossDungeonOffer = (
  seed: number,
  bossDungeonClears = 0,
): DungeonDefinition => {
  const difficulty = bossDifficultyForClears(bossDungeonClears);
  const rules = DUNGEON_DIFFICULTY_RULES[difficulty];
  const stage = BOSS_DUNGEON_STAGES[difficulty];
  if (!stage) {
    return {
      id: `boss-pending-${difficulty}-${(seed >>> 0).toString(16)}`,
      themeId: "boss_progression_pending",
      nameKo: "다음 보스 준비 중",
      nameEn: "Next Boss Coming Soon",
      subtitleKo: "보스 던전",
      subtitleEn: "Boss Dungeon",
      descriptionKo: "다음 단계의 보스 던전이 아직 준비되지 않았습니다.",
      descriptionEn: "The next boss dungeon is not yet available.",
      difficulty,
      difficultyGrade: rules.grade,
      difficultyLabelKo: rules.labelKo,
      difficultyLabelEn: rules.labelEn,
      floorCount: 0,
      difficultyScale: rules.enemyStatMultiplier,
      offerKind: "boss",
      mainDropIds: [],
      specialRoomPlan: [],
      lootPlan: [],
      goldPlan: [],
      completionGold: 0,
      goldTarget: 0,
      accent: "#786f86",
    };
  }

  const theme = DUNGEON_THEMES.find(
    (candidate) => candidate.themeId === stage.themeId,
  );
  if (!theme) {
    throw new Error(`Unknown boss dungeon theme: ${stage.themeId}`);
  }
  return createDungeonOffer({
    seed: (seed ^ 0xb055da7a) >>> 0,
    index: 5,
    theme,
    difficulty,
    floorCount: stage.floorCount,
    offerKind: "boss",
    bossId: stage.bossId,
    random: seededRandom((seed ^ 0x600db055) >>> 0),
    usedPrimaryDrops: new Set<string>(),
  });
};

export const generateDungeonOffers = (
  seed: number,
  bossDungeonClears = 0,
): DungeonDefinition[] => [
  ...generateRecommendedDungeonOffers(seed, bossDungeonClears),
  createBossDungeonOffer(seed, bossDungeonClears),
];

export const DUNGEON_DEFINITIONS = generateDungeonOffers(
  INITIAL_DUNGEON_OFFER_SEED,
);

export const dungeonById = (
  id: DungeonId,
  offers: readonly DungeonDefinition[] = DUNGEON_DEFINITIONS,
) => offers.find((dungeon) => dungeon.id === id) ?? offers[0];

export type WarehouseState = {
  stacks: Record<string, number>;
  instances: InventoryInstance[];
  throwableProfiles: Record<string, InventoryInstance>;
  slots: Array<string | null>;
};

export type ExpeditionLoadout = {
  stacks: Record<string, number>;
  instanceIds: string[];
  slotRefs: Array<string | null>;
};

export type ExpeditionLootEntry = {
  itemId: string;
  quantity: number;
};

export type ExpeditionOutcome = "completed" | "retreated" | "defeated";

export const bossDungeonClearsAfterOutcome = (
  currentClears: unknown,
  dungeon: Pick<DungeonDefinition, "offerKind">,
  outcome: ExpeditionOutcome,
) =>
  normalizeBossDungeonClears(currentClears) +
  (dungeon.offerKind === "boss" && outcome === "completed" ? 1 : 0);

export type ExpeditionStats = {
  enemiesDefeated: number;
  experienceEarned: number;
  itemsFound: number;
  deepestFloor: number;
  turns: number;
  elapsedSeconds: number;
  recoveredItems: number;
  goldFound: number;
  completionGold: number;
  loot: ExpeditionLootEntry[];
};

export type CampaignSave = {
  version: 8;
  warehouse: WarehouseState;
  materials: CampaignMaterials;
  companions: Companion[];
  expeditions: number;
  completedExpeditions: number;
  bossDungeonClears: number;
  gold: number;
  offerSeed: number;
  shop: ShopState;
};

const cloneInstance = (instance: InventoryInstance): InventoryInstance =>
  normalizeEquipmentInstance(
    {
      ...instance,
      statRoll: instance.statRoll ? { ...instance.statRoll } : undefined,
      traits: (instance.traits ?? []).map((trait) => ({ ...trait })),
    },
    ITEM_DEFS[instance.defId],
  );

const createThrowableBundleInstance = (
  defId: string,
  id: string,
  capacity: number,
  source?: InventoryInstance,
) => {
  const safeCapacity = Math.max(1, Math.floor(capacity));
  const instance = source
    ? cloneInstance(source)
    : createPlainEquipmentInstance(ITEM_DEFS[defId], id);
  instance.id = id;
  instance.defId = defId;
  instance.baseMaxCharges = safeCapacity;
  instance.maxCharges = safeCapacity;
  instance.charges = safeCapacity;
  instance.maxDurability = source?.maxDurability ?? 10;
  instance.durability = instance.maxDurability;
  return instance;
};

export const cloneWarehouse = (warehouse: WarehouseState): WarehouseState => {
  const stacks = { ...(warehouse.stacks ?? {}) };
  const instances = (warehouse.instances ?? []).map(cloneInstance);
  const occupiedIds = new Set(instances.map((instance) => instance.id));

  // Version 2 stored every throwable type as one stack plus a shared profile.
  // Convert that legacy shape once into an independently owned equipment
  // instance. Newly found equipment of the same definition then receives its
  // own id, rolls, charges, and durability instead of merging here.
  Object.entries(stacks).forEach(([defId, quantity]) => {
    if (quantity <= 0 || ITEM_DEFS[defId]?.category !== "missile") return;
    const legacy = warehouse.throwableProfiles?.[defId];
    const baseId = legacy?.id && !occupiedIds.has(legacy.id)
      ? legacy.id
      : `warehouse-${defId}-legacy`;
    let id = baseId;
    let suffix = 1;
    while (occupiedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    instances.push(
      createThrowableBundleInstance(defId, id, quantity, legacy),
    );
    occupiedIds.add(id);
    delete stacks[defId];
  });

  const next: WarehouseState = {
    stacks,
    instances,
    throwableProfiles: {},
    slots: [],
  };
  next.slots = normalizeStorageSlots(
    { ...next, slots: warehouse.slots ?? [] },
    WAREHOUSE_SLOT_COUNT,
  );
  return next;
};

export const createInitialWarehouse = (): WarehouseState => {
  const starterThrowable = createThrowableBundleInstance(
    "throwing_knife",
    "warehouse-throwing-knife-starter",
    4,
  );
  const warehouse: WarehouseState = {
    stacks: {
      ration: 4,
      scroll_mapping: 1,
    },
    instances: [starterThrowable],
    throwableProfiles: {},
    slots: [],
  };
  warehouse.slots = normalizeStorageSlots(warehouse, WAREHOUSE_SLOT_COUNT);
  return warehouse;
};

const companionStarterGear: Record<
  CompanionClassId,
  { weapon: string; armor: string }
> = {
  adventurer: { weapon: "rusty_sword", armor: "cloth_armor" },
  warrior: { weapon: "shortsword", armor: "leather_armor" },
  huntress: { weapon: "spear", armor: "cloth_armor" },
  mage: { weapon: "quarterstaff", armor: "cloth_armor" },
  rogue: { weapon: "dagger", armor: "cloth_armor" },
  duelist: { weapon: "rapier", armor: "leather_armor" },
  cleric: { weapon: "mace", armor: "cloth_armor" },
};

export const createStarterCompanionRoster = (
  classIds: readonly CompanionClassId[],
) =>
  classIds.map((classId, index) => {
    const companion = createCompanion(classId, { x: 0, y: 0 }, index);
    const gear = companionStarterGear[classId];
    companion.equipment.weapon = gear.weapon;
    companion.equipment.armor = gear.armor;
    companion.equipmentInstances.weapon = createPlainEquipmentInstance(
      ITEM_DEFS[gear.weapon],
      `roster-${classId}-weapon`,
      "F",
    );
    companion.equipmentInstances.armor = createPlainEquipmentInstance(
      ITEM_DEFS[gear.armor],
      `roster-${classId}-armor`,
      "F",
    );
    return companion;
  });

export const normalizeHeroForHub = (player: Player): Player => ({
  ...player,
  ...normalizeCombatStats(player),
  ...normalizeSkillResources(player),
  traits: [...(player.traits ?? [])],
  learnedSkills: [...(player.learnedSkills ?? player.skills ?? [])],
  skillLevels: normalizeCompanionSkillLevels(
    normalizeLearnedSkills(
      player.professionId,
      player.learnedSkills,
      player.skills,
    ),
    player.skillLevels,
  ),
  skills: [...(player.skills ?? [])],
  skillCooldowns: {},
  x: 0,
  y: 0,
  hp: player.maxHp,
  inventory: {},
  inventoryInstances: [],
  inventorySlots: Array.from({ length: MAX_INVENTORY_SLOTS }, () => null),
  throwableProfiles: {},
  equipment: { ...player.equipment },
  equipmentInstances: Object.fromEntries(
    Object.entries(player.equipmentInstances).map(([slot, instance]) => [
      slot,
      instance ? cloneInstance(instance) : null,
    ]),
  ) as Player["equipmentInstances"],
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
});

const COMPANION_FLEX_KEYS = ["ring", "ring2", "ring3", "ring4"] as const;

export type NormalizedCompanionLoadout = {
  companion: Companion;
  releasedInstances: InventoryInstance[];
};

export const normalizeCompanionForHubWithReleasedItems = (
  companion: Companion,
): NormalizedCompanionLoadout => {
  const progressed = normalizeCompanionProgression(companion);
  const equipment = {
    weapon: companion.equipment?.weapon ?? null,
    armor: companion.equipment?.armor ?? null,
    ring: companion.equipment?.ring ?? null,
    ring2: companion.equipment?.ring2 ?? null,
    ring3: companion.equipment?.ring3 ?? null,
    ring4: companion.equipment?.ring4 ?? null,
  } satisfies Companion["equipment"];
  const equipmentInstances = Object.fromEntries(
    (Object.keys(equipment) as Array<keyof Companion["equipment"]>).map(
      (slot) => [
        slot,
        companion.equipmentInstances?.[slot]
          ? cloneInstance(companion.equipmentInstances[slot]!)
          : null,
      ],
    ),
  ) as Companion["equipmentInstances"];
  const legacyAutoSlots = [
    ...(companion.autoSlots ?? [null, null, null, null]),
  ].slice(0, 4) as Companion["autoSlots"];
  const passiveEntries = COMPANION_FLEX_KEYS.flatMap((slot) => {
    const defId = equipment[slot];
    const definition = defId ? ITEM_DEFS[defId] : null;
    return definition &&
        (definition.category === "ring" || definition.category === "artifact")
      ? [{
          defId,
          instance:
            equipmentInstances[slot] ??
            createPlainEquipmentInstance(
              definition,
              `restored-${companion.id}-${slot}`,
            ),
        }]
      : [];
  });
  const activeEntries = legacyAutoSlots.flatMap((slot) => {
    if (!slot) return [];
    const definition = ITEM_DEFS[slot.defId];
    if (!definition) return [];
    if (definition.category === "ring" || definition.category === "artifact") {
      passiveEntries.push({
        defId: slot.defId,
        instance:
          slot.instance ??
          createPlainEquipmentInstance(
            definition,
            `restored-${companion.id}-passive-${passiveEntries.length}`,
          ),
      });
      return [];
    }
    if (["wand", "missile"].includes(definition.category) && !slot.instance) {
      return [];
    }
    return [{
      ...slot,
      instance: slot.instance ? cloneInstance(slot.instance) : null,
    }];
  });
  const keptPassives = passiveEntries.slice(0, 2);
  const keptActives = activeEntries.slice(0, 2);
  const releasedInstances = [
    ...passiveEntries.slice(2).map((entry) => cloneInstance(entry.instance)),
    ...activeEntries.slice(2).flatMap((entry) =>
      entry.instance ? [cloneInstance(entry.instance)] : [],
    ),
  ];
  COMPANION_FLEX_KEYS.forEach((slot) => {
    equipment[slot] = null;
    equipmentInstances[slot] = null;
  });
  keptPassives.forEach((entry, index) => {
    const slot = COMPANION_FLEX_KEYS[index];
    equipment[slot] = entry.defId;
    equipmentInstances[slot] = cloneInstance(entry.instance);
  });

  const normalized: Companion = {
    ...progressed,
    x: 0,
    y: 0,
    hp: progressed.maxHp,
    skillCooldowns: {},
    statuses: [],
    command: "follow",
    equipment,
    equipmentInstances,
    autoSlots: [
      null,
      null,
      keptActives[0] ?? null,
      keptActives[1] ?? null,
    ] as Companion["autoSlots"],
    priorityTarget: null,
    exploreTarget: null,
    commandTargetId: null,
    actionCooldown: 0,
    recoveryProgress: 0,
  };
  return { companion: normalized, releasedInstances };
};

export const normalizeCompanionForHub = (companion: Companion): Companion =>
  normalizeCompanionForHubWithReleasedItems(companion).companion;

export const companionToPlayer = (companion: Companion): Player => {
  const normalized = normalizeCompanionForHub(companion);
  const autoSlotInstances = normalized.autoSlots.flatMap((item) =>
    item?.instance ? [cloneInstance(item.instance)] : [],
  );
  return {
    ...normalizeSkillResources(normalized),
    ...normalizeCombatStats(normalized),
    companionId: normalized.id,
    name: normalized.name,
    classId: normalized.classId,
    professionId: normalized.professionId,
    traits: [...normalized.traits],
    learnedSkills: [...normalized.learnedSkills],
    skillLevels: { ...normalized.skillLevels },
    skills: [...normalized.skills],
    skillCooldowns: {},
    x: 0,
    y: 0,
    hp: normalized.hp,
    maxHp: normalized.maxHp,
    level: normalized.level,
    xp: normalized.xp,
    nextXp: normalized.nextXp,
    baseAttack: normalized.baseAttack,
    baseDefense: normalized.baseDefense,
    accuracy: normalized.accuracy,
    evasion: normalized.evasion,
    viewDistance: normalized.viewDistance,
    inventory: {},
    // Unique quick-slot equipment stays owned by the character while being
    // hidden from the backpack UI. Keeping it in this runtime collection lets
    // the controlled character resolve and use the same wand/throwable id.
    inventoryInstances: autoSlotInstances,
    inventorySlots: Array.from({ length: MAX_INVENTORY_SLOTS }, () => null),
    throwableProfiles: {},
    equipment: { ...normalized.equipment },
    equipmentInstances: Object.fromEntries(
      Object.entries(normalized.equipmentInstances).map(([slot, instance]) => [
        slot,
        instance ? cloneInstance(instance) : null,
      ]),
    ) as Player["equipmentInstances"],
    invisibleTurns: 0,
    statuses: (normalized.statuses ?? []).map((status) => ({ ...status })),
    shield: 0,
    autoSlots: normalized.autoSlots.map((item) =>
      item ? item.instance?.id ?? item.defId : null,
    ) as Player["autoSlots"],
    wandCharges: {},
    augments: {},
    natureAidCooldown: 0,
    facing: "down",
    actionProgress: 0,
    hunger: 100,
    hungerTurns: 0,
    recoveryProgress: normalized.recoveryProgress,
  };
};

export const playerToCompanion = (player: Player): Companion => {
  const definition = COMPANION_CLASSES[player.classId];
  const equipmentInstances = Object.fromEntries(
    Object.entries(player.equipmentInstances).map(([slot, instance]) => [
      slot,
      instance ? cloneInstance(instance) : null,
    ]),
  ) as Companion["equipmentInstances"];
  const autoSlots = player.autoSlots.map((itemRef) => {
    if (!itemRef) return null;
    const instance = player.inventoryInstances.find(
      (candidate) => candidate.id === itemRef,
    ) ?? null;
    return {
      defId: instance?.defId ?? itemRef,
      quantity: 0,
      instance: instance ? cloneInstance(instance) : null,
    };
  }) as Companion["autoSlots"];
  return normalizeCompanionForHub({
    ...normalizeSkillResources(player),
    ...normalizeCombatStats(player),
    id: player.companionId,
    name: player.name || definition.defaultNameKo,
    classId: player.classId,
    professionId: player.professionId,
    command: "follow",
    x: 0,
    y: 0,
    hp: player.hp,
    maxHp: player.maxHp,
    level: player.level,
    xp: player.xp,
    nextXp: player.nextXp,
    traits: [...(player.traits ?? [])],
    learnedSkills: [...(player.learnedSkills ?? player.skills ?? [])],
    skillLevels: normalizeCompanionSkillLevels(
      normalizeLearnedSkills(
        player.professionId,
        player.learnedSkills,
        player.skills,
      ),
      player.skillLevels,
    ),
    skills: [...(player.skills ?? [])],
    skillCooldowns: {},
    statuses: (player.statuses ?? []).map((status) => ({ ...status })),
    baseAttack: player.baseAttack,
    baseDefense: player.baseDefense,
    accuracy: player.accuracy ?? definition.accuracy,
    evasion: player.evasion ?? definition.evasion,
    viewDistance: player.viewDistance ?? definition.viewDistance,
    facing: player.facing,
    equipment: { ...player.equipment },
    equipmentInstances,
    autoSlots,
    priorityTarget: null,
    exploreTarget: null,
    commandTargetId: null,
    actionCooldown: 0,
    recoveryProgress: player.recoveryProgress ?? 0,
  });
};

export const selectedLoadoutSlotCount = (loadout: ExpeditionLoadout) =>
  Object.values(loadout.stacks).filter((quantity) => quantity > 0).length +
  loadout.instanceIds.length;

export const warehouseItemCount = (warehouse: WarehouseState) =>
  Object.entries(warehouse.stacks).reduce(
    (total, [itemId, quantity]) =>
      ITEM_DEFS[itemId]?.category === "key" || isQuestItemDefinitionId(itemId)
        ? total
        : total + quantity,
    warehouse.instances.length,
  );

export type WarehouseEquipmentConsumableResult = {
  campaign: CampaignSave;
  changed: boolean;
  reason:
    | "ok"
    | "missing-scroll"
    | "missing-target"
    | "invalid-target"
    | "maximum-enchantments";
  itemId: string | null;
  traitId: EquipmentTraitId | null;
  upgradeLevel: number | null;
};

const campaignEquipmentActionSeed = (
  campaign: CampaignSave,
  consumableId: EquipmentConsumableId,
  instance: InventoryInstance,
) => {
  const source = [
    campaign.offerSeed >>> 0,
    consumableId,
    instance.id,
    instance.defId,
    instance.upgradeLevel ?? 0,
    instance.traits?.length ?? 0,
    campaign.warehouse.stacks[consumableId] ?? 0,
  ].join(":");
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export function applyWarehouseEquipmentConsumable(
  campaign: CampaignSave,
  consumableId: EquipmentConsumableId,
  targetInstanceId: string,
): WarehouseEquipmentConsumableResult {
  if ((campaign.warehouse.stacks[consumableId] ?? 0) <= 0) {
    return {
      campaign,
      changed: false,
      reason: "missing-scroll",
      itemId: null,
      traitId: null,
      upgradeLevel: null,
    };
  }
  const sourceInstance = campaign.warehouse.instances.find(
    (instance) => instance.id === targetInstanceId,
  );
  if (!sourceInstance) {
    return {
      campaign,
      changed: false,
      reason: "missing-target",
      itemId: null,
      traitId: null,
      upgradeLevel: null,
    };
  }
  const definition = ITEM_DEFS[sourceInstance.defId];
  if (!isUpgradeableEquipment(definition)) {
    return {
      campaign,
      changed: false,
      reason: "invalid-target",
      itemId: sourceInstance.defId,
      traitId: null,
      upgradeLevel: sourceInstance.upgradeLevel ?? 0,
    };
  }

  const warehouse = cloneWarehouse(campaign.warehouse);
  const target = warehouse.instances.find(
    (instance) => instance.id === targetInstanceId,
  )!;
  const random = seededRandom(
    campaignEquipmentActionSeed(campaign, consumableId, target) || 0x9e3779b9,
  );
  const application = applyEquipmentConsumableToInstance(
    target,
    definition,
    consumableId,
    random,
  );
  if (!application.changed) {
    return {
      campaign,
      changed: false,
      reason: application.reason,
      itemId: target.defId,
      traitId: null,
      upgradeLevel: target.upgradeLevel ?? 0,
    };
  }

  const remaining = (warehouse.stacks[consumableId] ?? 0) - 1;
  if (remaining > 0) warehouse.stacks[consumableId] = remaining;
  else delete warehouse.stacks[consumableId];
  warehouse.slots = normalizeStorageSlots(warehouse, WAREHOUSE_SLOT_COUNT);
  return {
    campaign: { ...campaign, warehouse },
    changed: true,
    reason: "ok",
    itemId: target.defId,
    traitId: application.traitId,
    upgradeLevel: target.upgradeLevel ?? 0,
  };
}

export const takeLoadoutFromWarehouse = (
  warehouse: WarehouseState,
  requested: ExpeditionLoadout,
) => {
  const next = cloneWarehouse(warehouse);
  const loadout: ExpeditionLoadout = {
    stacks: {},
    instanceIds: [],
    slotRefs: [],
  };
  for (const [itemId, requestedQuantity] of Object.entries(requested.stacks)) {
    if (materialKindForItem(ITEM_DEFS[itemId])) continue;
    const available = Math.max(0, next.stacks[itemId] ?? 0);
    const quantity = Math.max(0, Math.min(available, requestedQuantity));
    if (quantity <= 0) continue;
    loadout.stacks[itemId] = quantity;
    next.stacks[itemId] = available - quantity;
    if (next.stacks[itemId] <= 0) delete next.stacks[itemId];
  }
  const requestedIds = new Set(requested.instanceIds);
  const selectedInstances = next.instances.filter((instance) =>
    requestedIds.has(instance.id),
  );
  loadout.instanceIds = selectedInstances.map((instance) => instance.id);
  const selectedIdSet = new Set(loadout.instanceIds);
  next.instances = next.instances.filter(
    (instance) => !selectedIdSet.has(instance.id),
  );
  const liveLoadoutRefs = [
    ...Object.keys(loadout.stacks),
    ...loadout.instanceIds,
  ];
  loadout.slotRefs = normalizeFixedSlots(
    requested.slotRefs,
    liveLoadoutRefs,
    MAX_INVENTORY_SLOTS,
  );
  next.slots = normalizeStorageSlots(next, WAREHOUSE_SLOT_COUNT);
  return { warehouse: next, loadout, instances: selectedInstances.map(cloneInstance) };
};

export const applyLoadoutToPlayer = (
  player: Player,
  loadout: ExpeditionLoadout,
  instances: InventoryInstance[],
): Player => {
  const equippedAutoRefs = new Set(
    (player.autoSlots ?? []).filter(
      (itemRef): itemRef is string => Boolean(itemRef),
    ),
  );
  const equippedAutoInstances = (player.inventoryInstances ?? [])
    .filter((instance) => equippedAutoRefs.has(instance.id))
    .map(cloneInstance);
  const instanceIds = new Set(equippedAutoInstances.map((instance) => instance.id));
  const next: Player = {
    ...normalizeHeroForHub(player),
    inventory: Object.fromEntries(
      Object.entries(loadout.stacks).filter(([, quantity]) => quantity > 0),
    ),
    inventoryInstances: [
      ...equippedAutoInstances,
      ...instances
        .filter((instance) => !instanceIds.has(instance.id))
        .map(cloneInstance),
    ],
    inventorySlots: [...loadout.slotRefs],
    autoSlots: [...(player.autoSlots ?? [null, null, null, null])] as Player["autoSlots"],
    throwableProfiles: {},
  };
  next.inventorySlots = normalizePlayerInventorySlots(next);
  return next;
};

export const depositPlayerInventory = (
  warehouse: WarehouseState,
  player: Player,
  materials: CampaignMaterials = createCampaignMaterials(),
) => {
  const extractedWarehouse = extractWarehouseMaterials(cloneWarehouse(warehouse));
  const next = extractedWarehouse.warehouse;
  let recoveredItems = 0;
  const materialsGained = createCampaignMaterials();
  for (const [itemId, quantity] of Object.entries(player.inventory)) {
    if (
      quantity <= 0 ||
      ITEM_DEFS[itemId]?.category === "key" ||
      isQuestItemDefinitionId(itemId)
    ) continue;
    const materialKind = materialKindForItem(ITEM_DEFS[itemId]);
    if (materialKind) {
      materialsGained[materialKind] += quantity;
    } else {
      next.stacks[itemId] = (next.stacks[itemId] ?? 0) + quantity;
    }
    recoveredItems += quantity;
  }
  const equippedAutoRefs = new Set(
    (player.autoSlots ?? []).filter(
      (itemRef): itemRef is string => Boolean(itemRef),
    ),
  );
  for (const instance of player.inventoryInstances ?? []) {
    const definition = ITEM_DEFS[instance.defId];
    if (
      definition?.category === "key" ||
      equippedAutoRefs.has(instance.id)
    ) {
      continue;
    }
    const stored = cloneInstance(instance);
    if (definition?.category === "missile") {
      const baseMaximum = Math.max(
        1,
        stored.baseMaxCharges ?? stored.maxCharges ?? 1,
      );
      const currentMaximum = Math.max(
        0,
        Math.min(baseMaximum, stored.maxCharges ?? baseMaximum),
      );
      const currentCharges = Math.max(
        0,
        Math.min(currentMaximum, stored.charges ?? currentMaximum),
      );
      stored.baseMaxCharges = baseMaximum;
      stored.maxCharges = baseMaximum;
      stored.charges = Math.min(
        baseMaximum,
        currentCharges + (baseMaximum - currentMaximum),
      );
      stored.maxDurability = stored.maxDurability ?? 10;
      stored.durability = stored.maxDurability;
    }
    next.instances.push(stored);
    recoveredItems += 1;
  }
  next.slots = normalizeStorageSlots(next, WAREHOUSE_SLOT_COUNT);
  return {
    warehouse: next,
    materials: addMaterials(
      addMaterials(materials, extractedWarehouse.materialsGained),
      materialsGained,
    ),
    materialsGained,
    recoveredItems,
  };
};

export const mergeReturningCompanions = (
  roster: Companion[],
  returning: Companion[],
) => {
  const returnedById = new Map(
    returning.map((companion) => [companion.id, normalizeCompanionForHub(companion)]),
  );
  return roster.map((companion) =>
    returnedById.get(companion.id) ?? normalizeCompanionForHub(companion),
  );
};

export const formatElapsedTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};
