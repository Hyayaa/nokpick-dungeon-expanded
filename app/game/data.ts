import {
  DungeonObjectKind,
  EnemyKind,
  EnemySpriteDefinition,
  ItemCategory,
  ItemDefinition,
} from "./types";
import { SHATTERED_ITEM_DEFS } from "./item-catalog";

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

export const ENEMY_SPRITES: Record<EnemyKind, EnemySpriteDefinition> = {
  rat: {
    file: "/assets/sprites/rat.png",
    sheetWidth: 256,
    frameWidth: 16,
    frameHeight: 15,
    idle: [0, 0, 1],
    run: [6, 7, 8, 9, 10],
    attackFrames: [2, 3, 4, 5],
    label: "화난 쥐",
  },
  gnoll: {
    file: "/assets/sprites/gnoll.png",
    sheetWidth: 256,
    frameWidth: 12,
    frameHeight: 15,
    idle: [0, 0, 1],
    run: [4, 5, 6, 7],
    attackFrames: [2, 3],
    label: "놀 정찰병",
  },
  snake: {
    file: "/assets/sprites/snake.png",
    sheetWidth: 256,
    frameWidth: 12,
    frameHeight: 11,
    idle: [0, 0, 1, 2],
    run: [4, 5, 6, 7],
    attackFrames: [8, 9, 10],
    label: "하수도 뱀",
  },
  slime: {
    file: "/assets/sprites/slime.png",
    sheetWidth: 128,
    frameWidth: 14,
    frameHeight: 12,
    idle: [0, 1, 1, 0],
    run: [0, 2, 3, 2],
    attackFrames: [2, 3, 4, 6, 5],
    label: "부식성 슬라임",
  },
  crab: {
    file: "/assets/sprites/crab.png",
    sheetWidth: 256,
    frameWidth: 16,
    frameHeight: 16,
    idle: [0, 1, 0, 2],
    run: [3, 4, 5, 6],
    attackFrames: [7, 8, 9],
    label: "동굴 게",
  },
  skeleton: {
    file: "/assets/sprites/skeleton.png",
    sheetWidth: 256,
    frameWidth: 12,
    frameHeight: 15,
    idle: [0, 0, 1, 2, 3],
    run: [4, 5, 6, 7, 8, 9],
    attackFrames: [14, 15, 16],
    label: "해골 병사",
  },
};

export const ENEMY_STATS: Record<
  EnemyKind,
  {
    hp: number;
    attack: number;
    defense: number;
    accuracy: number;
    evasion: number;
    xp: number;
  }
> = {
  rat: {
    hp: 7,
    attack: 3,
    defense: 0,
    accuracy: 8,
    evasion: 2,
    xp: 4,
  },
  gnoll: {
    hp: 10,
    attack: 4,
    defense: 1,
    accuracy: 10,
    evasion: 4,
    xp: 6,
  },
  snake: {
    hp: 8,
    attack: 5,
    defense: 0,
    accuracy: 10,
    evasion: 10,
    xp: 5,
  },
  slime: {
    hp: 13,
    attack: 5,
    defense: 1,
    accuracy: 12,
    evasion: 5,
    xp: 8,
  },
  crab: {
    hp: 16,
    attack: 6,
    defense: 2,
    accuracy: 12,
    evasion: 5,
    xp: 10,
  },
  skeleton: {
    hp: 19,
    attack: 7,
    defense: 2,
    accuracy: 12,
    evasion: 9,
    xp: 12,
  },
};

export const ENEMY_DESCRIPTIONS: Record<EnemyKind, string> = {
  rat: "하수도의 먹이를 두고 사나워진 설치류입니다. 약하지만 무리를 이루면 위협적입니다.",
  gnoll: "지하 통로를 순찰하는 작은 놀 전사입니다. 쥐보다 단단하고 공격도 정확합니다.",
  snake: "낮은 방어력 대신 민첩한 회피를 지닌 뱀입니다. 기습으로 회피를 무시할 수 있습니다.",
  slime: "산성 점액으로 뒤덮인 덩어리입니다. 체력이 높고 꾸준한 피해를 줍니다.",
  crab: "단단한 껍질과 집게를 지닌 동굴 게입니다. 방어와 체력이 모두 뛰어납니다.",
  skeleton: "오래된 장비를 들고 움직이는 병사의 유해입니다. 깊은 층에서 강한 공격을 가합니다.",
};

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
