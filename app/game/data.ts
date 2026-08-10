import {
  DungeonObjectKind,
  EnemyKind,
  EnemySpriteDefinition,
  ItemCategory,
  ItemDefinition,
} from "./types";
import { SHATTERED_ITEM_DEFS } from "./item-catalog";
import { ENEMY_DEFINITIONS, type EnemyDefinition } from "./enemy-definitions";

const ESSENTIAL_ITEM_DEFS: Record<string, ItemDefinition> = {
  rusty_sword: {
    id: "rusty_sword",
    name: "낡은 소검",
    category: "weapon",
    description: "많이 닳았지만 아직 믿을 만한 소검입니다. 공격력 +1.",
    sprite: 96,
    slot: "weapon",
    attack: 1,
    accent: "#d9c28a",
  },
  shortsword: {
    id: "shortsword",
    name: "균형 잡힌 숏소드",
    category: "weapon",
    description: "빠르게 휘두를 수 있는 한손검입니다. 공격력 +2.",
    sprite: 104,
    slot: "weapon",
    attack: 2,
    accent: "#e4d6a5",
  },
  spear: {
    id: "spear",
    name: "하수도 창",
    category: "weapon",
    description: "녹슨 창끝을 다시 벼린 무기입니다. 공격력 +3.",
    sprite: 106,
    slot: "weapon",
    attack: 3,
    accent: "#c8bb9d",
  },
  cloth_armor: {
    id: "cloth_armor",
    name: "천 갑옷",
    category: "armor",
    description: "가볍고 움직이기 편한 기본 방어구입니다. 방어력 +1.",
    sprite: 176,
    slot: "armor",
    defense: 1,
    accent: "#bcae91",
  },
  leather_armor: {
    id: "leather_armor",
    name: "가죽 갑옷",
    category: "armor",
    description: "기동성을 해치지 않으면서 몸을 보호합니다. 방어력 +2.",
    sprite: 177,
    slot: "armor",
    defense: 2,
    accent: "#b98256",
  },
  mail_armor: {
    id: "mail_armor",
    name: "사슬 갑옷",
    category: "armor",
    description: "무겁지만 안정적인 보호를 제공합니다. 방어력 +3.",
    sprite: 178,
    slot: "armor",
    defense: 3,
    accent: "#b9c3c9",
  },
  ring_might: {
    id: "ring_might",
    name: "완력의 반지",
    category: "ring",
    description: "손가락에 끼면 팔에 힘이 솟습니다. 공격력 +1.",
    sprite: 224,
    slot: "ring",
    attack: 1,
    accent: "#e85555",
  },
  ring_guard: {
    id: "ring_guard",
    name: "수호의 반지",
    category: "ring",
    description: "얇은 마력막이 몸을 감쌉니다. 방어력 +1.",
    sprite: 229,
    slot: "ring",
    defense: 1,
    accent: "#62aee8",
  },
  potion_healing: {
    id: "potion_healing",
    name: "치유 물약",
    category: "potion",
    description: "생명력을 크게 회복합니다.",
    sprite: 353,
    heal: 12,
    effect: "heal",
    power: 12,
    accent: "#ef5252",
  },
  potion_strength: {
    id: "potion_strength",
    name: "힘의 물약",
    category: "potion",
    description: "최대 생명력과 기본 공격력을 영구히 높입니다.",
    sprite: 352,
    effect: "strength",
    accent: "#f3a14a",
  },
  potion_invisibility: {
    id: "potion_invisibility",
    name: "투명화 물약",
    category: "potion",
    description: "5턴 동안 적이 당신을 추적하지 못합니다.",
    sprite: 359,
    effect: "invisibility",
    accent: "#d786ef",
  },
  potion_frost: {
    id: "potion_frost",
    name: "서리 물약",
    category: "potion",
    description: "주변 두 칸 안의 적에게 냉기 피해를 줍니다.",
    sprite: 355,
    effect: "frost",
    power: 8,
    accent: "#72d8ee",
  },
  scroll_mapping: {
    id: "scroll_mapping",
    name: "마법 지도의 주문서",
    category: "scroll",
    description: "현재 층의 구조를 전부 기억에 새깁니다.",
    sprite: 311,
    effect: "mapping",
    accent: "#dca94f",
  },
  scroll_teleport: {
    id: "scroll_teleport",
    name: "공간 이동의 주문서",
    category: "scroll",
    description: "현재 층의 안전한 장소로 순간이동합니다.",
    sprite: 309,
    effect: "teleport",
    accent: "#b985e8",
  },
  scroll_upgrade: {
    id: "scroll_upgrade",
    name: "강화의 주문서",
    category: "scroll",
    description: "장착 중인 무기의 힘을 영구히 높입니다.",
    sprite: 304,
    effect: "upgrade",
    accent: "#72dc77",
  },
  scroll_rage: {
    id: "scroll_rage",
    name: "분노의 주문서",
    category: "scroll",
    description: "시야 안의 모든 적에게 정신 충격을 줍니다.",
    sprite: 312,
    effect: "rage",
    power: 6,
    accent: "#df6464",
  },
  ration: {
    id: "ration",
    name: "비상 식량",
    category: "food",
    description: "간단히 먹을 수 있는 식량입니다. 생명력 대신 허기를 채웁니다.",
    sprite: 437,
    satiation: 40,
    accent: "#d2a463",
  },
  iron_key: {
    id: "iron_key",
    name: "낡은 쇠열쇠",
    category: "key",
    description: "이 층의 잠긴 문 하나를 열 수 있습니다.",
    sprite: 55,
    accent: "#d9d0a8",
  },
  crystal_key: {
    id: "crystal_key",
    name: "수정 열쇠",
    category: "key",
    description: "현재 층의 수정문 하나를 열 수 있습니다. 다음 층으로 가져갈 수 없습니다.",
    sprite: 56,
    accent: "#78d7ec",
  },
  boss_exit_key: {
    id: "boss_exit_key",
    name: "탈출구 열쇠",
    category: "key",
    description: "쓰러진 보스가 남긴 열쇠입니다. 최종층 탈출구를 열 때 소모됩니다.",
    sprite: 57,
    accent: "#d7b15c",
  },
  quest_sealed_relic: {
    id: "quest_sealed_relic",
    name: "봉인 유물",
    category: "misc",
    description: "학자 세라의 의뢰품입니다. 퀘스트 완료 전에는 원정 가방에 보관됩니다.",
    sprite: 246,
    accent: "#b79cff",
  },
};

export const ITEM_DEFS: Record<string, ItemDefinition> = {
  ...SHATTERED_ITEM_DEFS,
  ...ESSENTIAL_ITEM_DEFS,
};

export const CATEGORY_LABELS = {
  all: "전체",
  equipment: "장비",
  potion: "물약",
  scroll: "주문서",
  magic: "완드·유물",
  throwable: "투척·폭탄",
  alchemy: "연금술",
  nature: "씨앗·룬석",
  other: "기타",
} as const;

export const ENEMY_SPRITES = Object.fromEntries(
  Object.entries(ENEMY_DEFINITIONS).map(([kind, definition]) => [kind, definition.sprite]),
) as Record<EnemyKind, EnemySpriteDefinition>;

export const ENEMY_STATS = Object.fromEntries(
  Object.entries(ENEMY_DEFINITIONS).map(([kind, definition]) => [kind, {
    ...definition.baseStats,
    xp: definition.xp,
  }]),
) as Record<EnemyKind, EnemyDefinitionStats>;

type EnemyDefinitionStats = EnemyDefinition["baseStats"] & { xp: number };

export const ENEMY_DESCRIPTIONS = Object.fromEntries(
  Object.entries(ENEMY_DEFINITIONS).map(([kind, definition]) => [kind, definition.description]),
) as Record<EnemyKind, string>;

export const ENEMY_DROP_CHANCE = 0.28;

export const ENEMY_DROP_TABLE = [
  { itemId: "ration", weight: 0.72 },
  { itemId: "potion_healing", weight: 0.28 },
] as const;

export const OBJECT_SPRITES: Record<
  DungeonObjectKind,
  { sprite: number; label: string; accent: string }
> = {
  chest: { sprite: 36, label: "나무 상자", accent: "#c89961" },
  crystalChest: { sprite: 38, label: "수정 상자", accent: "#78cfe1" },
  tomb: { sprite: 34, label: "오래된 무덤", accent: "#b2b7b4" },
  alchemy: { sprite: 245, label: "연금술 작업대", accent: "#9fe0cf" },
};

export const FLOOR_EQUIPMENT_CATEGORIES = [
  "weapon",
  "wand",
  "missile",
  "armor",
] as const satisfies readonly ItemCategory[];

export const SPECIAL_SCROLL_IDS = [
  "scroll_divination",
  "scroll_sirens_song",
  "scroll_foresight",
  "scroll_prismatic_image",
  "scroll_mystical_energy",
  "scroll_antimagic",
  "scroll_challenge",
  "scroll_psionic_blast",
  "scroll_passage",
  "scroll_dread",
  "scroll_metamorphosis",
  "scroll_enchantment",
] as const;

export const SPECIAL_POTION_IDS = [
  "potion_adrenaline_surge",
  "potion_cleansing",
  "potion_corrosive_gas",
  "potion_dragons_breath",
  "potion_earthen_armor",
  "potion_holy_furor",
  "potion_magical_sight",
  "potion_shielding",
  "potion_snap_freeze",
  "potion_stamina",
  "potion_storm_clouds",
  "potion_divine_inspiration",
] as const;

export const SPECIAL_ALCHEMY_IDS = [
  "brew_caustic",
  "brew_blizzard",
  "brew_infernal",
  "brew_shocking",
  "elixir_arcane_armor",
  "elixir_aquatic_rejuvenation",
  "elixir_dragons_blood",
  "elixir_honeyed_healing",
  "elixir_icy_touch",
  "elixir_might",
  "elixir_toxic_essence",
] as const;

export const SEED_ITEM_IDS = [
  "seed_blindweed",
  "seed_dreamfoil",
  "seed_earthroot",
  "seed_fadeleaf",
  "seed_firebloom",
  "seed_icecap",
  "seed_mageroyal",
  "seed_rotberry",
  "seed_sorrowmoss",
  "seed_starflower",
  "seed_stormvine",
  "seed_sungrass",
  "seed_swiftthistle",
] as const;

const SPECIAL_FLOOR_LOOT_IDS = new Set<string>([
  ...SPECIAL_SCROLL_IDS,
  ...SPECIAL_POTION_IDS,
  ...SPECIAL_ALCHEMY_IDS,
]);
const FLOOR_LOOT_CATEGORIES = new Set<ItemCategory>([
  ...FLOOR_EQUIPMENT_CATEGORIES,
  "potion",
  "scroll",
]);

export const FLOOR_LOOT = Object.values(ITEM_DEFS)
  .filter(
    ({ id, category }) =>
      FLOOR_LOOT_CATEGORIES.has(category) &&
      !SPECIAL_FLOOR_LOOT_IDS.has(id),
  )
  .map(({ id }) => id);
