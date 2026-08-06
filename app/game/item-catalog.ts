import {
  EquipSlot,
  ItemCategory,
  ItemDefinition,
  ItemEffect,
} from "./types";

type CatalogOptions = {
  slot?: EquipSlot;
  attack?: number;
  defense?: number;
  moveSpeed?: number;
  attackSpeed?: number;
  heal?: number;
  satiation?: number;
  effect?: ItemEffect;
  power?: number;
  minFloor?: number;
  accent?: string;
  description?: string;
};

type CatalogEntry = [
  id: string,
  name: string,
  category: ItemCategory,
  sprite: number,
  options?: CatalogOptions,
];

const CATEGORY_ACCENTS: Record<ItemCategory, string> = {
  weapon: "#d6c59a",
  armor: "#aeb9bf",
  ring: "#e28a64",
  wand: "#71c7a4",
  artifact: "#d5a3e6",
  missile: "#c8b88c",
  potion: "#e66b78",
  scroll: "#d9bd72",
  brew: "#d8805d",
  elixir: "#8fd7c5",
  bomb: "#d76b52",
  seed: "#77bd72",
  stone: "#a6a2ba",
  food: "#d1a568",
  misc: "#a7b4aa",
  key: "#d9d0a8",
};

const categoryDescription = (name: string, category: ItemCategory) => {
  const summaries: Record<ItemCategory, string> = {
    weapon: `${name}. 근접 전투에 사용하는 원본 녹픽던 무기입니다.`,
    armor: `${name}. 더 깊은 층의 공격을 막아 주는 방어구입니다.`,
    ring: `${name}. 착용자의 능력에 지속적인 마법 효과를 부여합니다.`,
    wand: `${name}. 충전을 소모해 고유한 마법을 발사하는 완드입니다.`,
    artifact: `${name}. 사용과 탐험을 통해 성장하는 희귀 유물입니다.`,
    missile: `${name}. 적에게 던져 원거리 피해를 주는 투척 무기입니다.`,
    potion: `${name}. 마시거나 던져 즉시 효과를 일으키는 물약입니다.`,
    scroll: `${name}. 읽으면 강력한 마법이 발동되는 주문서입니다.`,
    brew: `${name}. 넓은 지역에 연금술 효과를 퍼뜨리는 혼합물입니다.`,
    elixir: `${name}. 오래 지속되는 강화 효과를 주는 연금술 영약입니다.`,
    bomb: `${name}. 던진 지점 주변에 폭발 효과를 일으킵니다.`,
    seed: `${name}. 밟거나 연금술에 사용하면 식물 효과가 발동합니다.`,
    stone: `${name}. 던지거나 사용해 작은 마법 효과를 일으키는 룬석입니다.`,
    food: `${name}. 먹으면 생명력 대신 허기를 채웁니다.`,
    misc: `${name}. 던전 탐사와 연금술에 쓰이는 특수 물품입니다.`,
    key: `${name}. 대응하는 문이나 보관함을 여는 열쇠입니다.`,
  };
  return summaries[category];
};

const defineItem = ([
  id,
  name,
  category,
  sprite,
  options = {},
]: CatalogEntry): ItemDefinition => ({
  id,
  name,
  category,
  sprite,
  slot: options.slot,
  attack: options.attack,
  defense: options.defense,
  moveSpeed: options.moveSpeed,
  attackSpeed: options.attackSpeed,
  heal: options.heal,
  satiation: options.satiation,
  effect: options.effect,
  power: options.power,
  minFloor: options.minFloor ?? 1,
  accent: options.accent ?? CATEGORY_ACCENTS[category],
  description: options.description ?? categoryDescription(name, category),
});

const CATALOG: CatalogEntry[] = [
  // melee weapons
  ["worn_shortsword", "낡은 소검", "weapon", 96, { slot: "weapon", attack: 1 }],
  ["gloves", "징 박힌 장갑", "weapon", 98, { slot: "weapon", attack: 1 }],
  ["dagger", "단검", "weapon", 100, { slot: "weapon", attack: 1 }],
  ["hand_axe", "손도끼", "weapon", 105, { slot: "weapon", attack: 2 }],
  ["quarterstaff", "육척봉", "weapon", 107, { slot: "weapon", attack: 2 }],
  ["dirk", "더크", "weapon", 108, { slot: "weapon", attack: 2 }],
  ["sword", "장검", "weapon", 112, { slot: "weapon", attack: 3, minFloor: 2 }],
  ["mace", "철퇴", "weapon", 113, { slot: "weapon", attack: 3, minFloor: 2 }],
  ["scimitar", "시미터", "weapon", 114, { slot: "weapon", attack: 3, minFloor: 2 }],
  ["round_shield", "원형 방패", "weapon", 115, { slot: "weapon", attack: 2, defense: 1, minFloor: 2 }],
  ["sai", "쌍차", "weapon", 116, { slot: "weapon", attack: 3, minFloor: 2 }],
  ["whip", "채찍", "weapon", 117, { slot: "weapon", attack: 3, minFloor: 2 }],
  ["longsword", "대검", "weapon", 120, { slot: "weapon", attack: 4, minFloor: 3 }],
  ["battle_axe", "전투 도끼", "weapon", 121, { slot: "weapon", attack: 4, minFloor: 3 }],
  ["flail", "도리깨", "weapon", 122, { slot: "weapon", attack: 4, minFloor: 3 }],
  ["runic_blade", "룬 검", "weapon", 123, { slot: "weapon", attack: 4, minFloor: 3 }],
  ["assassins_blade", "암살자의 칼", "weapon", 124, { slot: "weapon", attack: 4, minFloor: 3 }],
  ["crossbow", "쇠뇌", "weapon", 125, { slot: "weapon", attack: 4, minFloor: 3 }],
  ["greatsword", "특대검", "weapon", 128, { slot: "weapon", attack: 5, minFloor: 4 }],
  ["war_hammer", "전쟁 망치", "weapon", 129, { slot: "weapon", attack: 5, minFloor: 4 }],
  ["glaive", "글레이브", "weapon", 130, { slot: "weapon", attack: 5, minFloor: 4 }],
  ["greatshield", "대형 방패", "weapon", 132, { slot: "weapon", attack: 3, defense: 3, minFloor: 4 }],
  ["stone_gauntlet", "돌 건틀릿", "weapon", 133, { slot: "weapon", attack: 5, minFloor: 4 }],
  ["rapier", "레이피어", "weapon", 99, { slot: "weapon", attack: 4, minFloor: 3 }],
  ["katana", "카타나", "weapon", 126, { slot: "weapon", attack: 5, minFloor: 4 }],
  ["war_scythe", "전투 낫", "weapon", 134, { slot: "weapon", attack: 6, minFloor: 5 }],

  // armor
  ["scale_armor", "미늘 갑옷", "armor", 179, { slot: "armor", defense: 4, minFloor: 3 }],
  ["plate_armor", "판금 갑옷", "armor", 180, { slot: "armor", defense: 5, minFloor: 4 }],

  // artifacts
  ["alchemists_toolkit", "연금술사의 도구상자", "artifact", 245],
  ["chalice_of_blood", "피의 성배", "artifact", 253],
  ["cloak_of_shadows", "그림자의 망토", "artifact", 240],
  ["dried_rose", "메마른 장미", "artifact", 260],
  ["ethereal_chains", "에테르 사슬", "artifact", 248],
  ["horn_of_plenty", "풍요의 뿔", "artifact", 249],
  ["master_thieves_armband", "대도의 팔찌", "artifact", 241],
  ["sandals_of_nature", "자연의 샌들", "artifact", 256],
  ["talisman_of_foresight", "예지의 부적", "artifact", 243],
  ["timekeepers_hourglass", "시간군주의 모래시계", "artifact", 244],
  ["unstable_spellbook", "불안정한 마법책", "artifact", 246],

  // rings
  ["ring_accuracy", "정확성의 반지", "ring", 224, { slot: "ring" }],
  ["ring_arcana", "신비의 반지", "ring", 225, { slot: "ring" }],
  ["ring_elements", "원소의 반지", "ring", 226, { slot: "ring", defense: 1 }],
  ["ring_energy", "에너지의 반지", "ring", 227, { slot: "ring" }],
  ["ring_evasion", "회피의 반지", "ring", 228, { slot: "ring" }],
  ["ring_force", "완력의 반지", "ring", 229, { slot: "ring", attack: 2 }],
  ["ring_furor", "분노의 반지", "ring", 230, {
    slot: "ring",
    attack: 1,
    attackSpeed: 1.25,
    description: "착용자의 공격 속도를 25% 높이고 공격력 +1을 부여합니다.",
  }],
  ["ring_haste", "신속의 반지", "ring", 231, {
    slot: "ring",
    moveSpeed: 1.25,
    description: "착용자의 이동 속도를 25% 높입니다.",
  }],
  ["ring_sharpshooting", "저격의 반지", "ring", 232, { slot: "ring", attack: 1 }],
  ["ring_tenacity", "인내의 반지", "ring", 233, { slot: "ring", defense: 1 }],
  ["ring_wealth", "부유함의 반지", "ring", 234, { slot: "ring" }],

  // wands
  ["wand_blast_wave", "충격파의 완드", "wand", 216],
  ["wand_corruption", "타락의 완드", "wand", 217],
  ["wand_corrosion", "부식의 완드", "wand", 214],
  ["wand_disintegration", "분해의 완드", "wand", 212],
  ["wand_fireblast", "화염 폭발의 완드", "wand", 209],
  ["wand_frost", "서리의 완드", "wand", 210],
  ["wand_lightning", "번개의 완드", "wand", 211],
  ["wand_living_earth", "대지의 수호자 완드", "wand", 215],
  ["wand_magic_missile", "마탄의 완드", "wand", 208],
  ["wand_prismatic_light", "굴절광의 완드", "wand", 213],
  ["wand_regrowth", "재성장의 완드", "wand", 219],
  ["wand_transfusion", "수혈의 완드", "wand", 220],
  ["wand_warding", "수호의 완드", "wand", 218],

  // standard and exotic scrolls
  ["scroll_identify", "감정의 주문서", "scroll", 305, { effect: "vision" }],
  ["scroll_lullaby", "자장가의 주문서", "scroll", 310, { effect: "cleanse" }],
  ["scroll_mirror_image", "거울상의 주문서", "scroll", 307, { effect: "blast", power: 4 }],
  ["scroll_recharging", "충전의 주문서", "scroll", 308, { effect: "haste" }],
  ["scroll_remove_curse", "저주 해제의 주문서", "scroll", 306, { effect: "cleanse" }],
  ["scroll_retribution", "징벌의 주문서", "scroll", 313, { effect: "rage", power: 7 }],
  ["scroll_terror", "공포의 주문서", "scroll", 314, { effect: "rage", power: 5 }],
  ["scroll_transmutation", "변환의 주문서", "scroll", 315, { effect: "upgrade" }],
  ["scroll_divination", "점술의 주문서", "scroll", 321, { effect: "vision" }],
  ["scroll_sirens_song", "세이렌의 노래 주문서", "scroll", 326, { effect: "cleanse" }],
  ["scroll_foresight", "예지의 주문서", "scroll", 327, { effect: "mapping" }],
  ["scroll_prismatic_image", "굴절상의 주문서", "scroll", 323, { effect: "blast", power: 5 }],
  ["scroll_mystical_energy", "신비한 에너지의 주문서", "scroll", 324, { effect: "haste" }],
  ["scroll_antimagic", "항마의 주문서", "scroll", 322, { effect: "cleanse" }],
  ["scroll_challenge", "도전의 주문서", "scroll", 328, { effect: "rage", power: 6 }],
  ["scroll_psionic_blast", "정신 폭발의 주문서", "scroll", 329, { effect: "rage", power: 8 }],
  ["scroll_passage", "통로의 주문서", "scroll", 325, { effect: "teleport" }],
  ["scroll_dread", "두려움의 주문서", "scroll", 330, { effect: "rage", power: 5 }],
  ["scroll_metamorphosis", "변신의 주문서", "scroll", 331, { effect: "experience" }],
  ["scroll_enchantment", "마법 부여의 주문서", "scroll", 320, { effect: "upgrade" }],

  // standard and exotic potions
  ["potion_experience", "경험의 물약", "potion", 354, { effect: "experience" }],
  ["potion_haste", "신속의 물약", "potion", 356, { effect: "haste" }],
  ["potion_levitation", "부유의 물약", "potion", 357, { effect: "teleport" }],
  ["potion_liquid_flame", "액체 화염 물약", "potion", 358, { effect: "blast", power: 8 }],
  ["potion_mind_vision", "심안의 물약", "potion", 360, { effect: "vision" }],
  ["potion_paralytic_gas", "마비 가스의 물약", "potion", 361, { effect: "blast", power: 5 }],
  ["potion_purity", "정화의 물약", "potion", 362, { effect: "cleanse" }],
  ["potion_toxic_gas", "유독 가스의 물약", "potion", 363, { effect: "blast", power: 7 }],
  ["potion_adrenaline_surge", "아드레날린 촉진의 물약", "potion", 368, { effect: "strength" }],
  ["potion_cleansing", "청정의 물약", "potion", 369, { effect: "cleanse" }],
  ["potion_corrosive_gas", "부식 가스의 물약", "potion", 370, { effect: "blast", power: 9 }],
  ["potion_dragons_breath", "용의 숨결 물약", "potion", 371, { effect: "blast", power: 10 }],
  ["potion_earthen_armor", "돌 갑옷의 물약", "potion", 372, { effect: "cleanse" }],
  ["potion_holy_furor", "신성한 분노의 물약", "potion", 373, { effect: "rage", power: 9 }],
  ["potion_magical_sight", "마법 시야의 물약", "potion", 374, { effect: "vision" }],
  ["potion_shielding", "보호막의 물약", "potion", 375, { effect: "heal", power: 10 }],
  ["potion_snap_freeze", "순간 빙결의 물약", "potion", 376, { effect: "frost", power: 10 }],
  ["potion_stamina", "체력의 물약", "potion", 377, { effect: "haste" }],
  ["potion_storm_clouds", "폭풍 구름의 물약", "potion", 378, { effect: "blast", power: 8 }],
  ["potion_divine_inspiration", "신성한 영감의 물약", "potion", 379, { effect: "experience" }],

  // seeds
  ["seed_blindweed", "실명초 씨앗", "seed", 395, { effect: "blast", power: 3 }],
  ["seed_dreamfoil", "꿈풀 씨앗", "seed", 391, { effect: "cleanse" }],
  ["seed_earthroot", "뱀뿌리 씨앗", "seed", 392, { effect: "heal", power: 4 }],
  ["seed_fadeleaf", "미명초 씨앗", "seed", 394, { effect: "teleport" }],
  ["seed_firebloom", "화염초 씨앗", "seed", 385, { effect: "blast", power: 5 }],
  ["seed_icecap", "눈꽃송이 씨앗", "seed", 388, { effect: "frost", power: 5 }],
  ["seed_mageroyal", "마법풀 씨앗", "seed", 391, { effect: "cleanse" }],
  ["seed_rotberry", "썩은열매 씨앗", "seed", 384, { effect: "strength" }],
  ["seed_sorrowmoss", "슬픔이끼 씨앗", "seed", 390, { effect: "blast", power: 5 }],
  ["seed_starflower", "별꽃 씨앗", "seed", 393, { effect: "experience" }],
  ["seed_stormvine", "폭풍덩굴 씨앗", "seed", 389, { effect: "blast", power: 6 }],
  ["seed_sungrass", "태양초 씨앗", "seed", 387, { effect: "heal", power: 8 }],
  ["seed_swiftthistle", "신속엉겅퀴 씨앗", "seed", 386, { effect: "haste" }],

  // runestones
  ["stone_intuition", "직감의 돌", "stone", 346, { effect: "vision" }],
  ["stone_blink", "점멸의 돌", "stone", 340, { effect: "teleport" }],
  ["stone_blast", "폭발의 돌", "stone", 339, { effect: "blast", power: 5 }],
  ["stone_clairvoyance", "투시의 돌", "stone", 341, { effect: "mapping" }],
  ["stone_deep_sleep", "깊은 잠의 돌", "stone", 342, { effect: "cleanse" }],
  ["stone_disarming", "해체의 돌", "stone", 343, { effect: "cleanse" }],
  ["stone_enchantment", "마법 부여의 돌", "stone", 344, { effect: "upgrade" }],
  ["stone_fear", "공포의 돌", "stone", 338, { effect: "rage", power: 4 }],
  ["stone_flock", "양 떼의 돌", "stone", 345, { effect: "blast", power: 3 }],
  ["stone_shock", "충격의 돌", "stone", 347, { effect: "blast", power: 6 }],
  ["stone_aggression", "공격성의 돌", "stone", 336, { effect: "rage", power: 6 }],
  ["stone_augmentation", "증강의 돌", "stone", 337, { effect: "strength" }],

  // thrown weapons
  ["throwing_stone", "투척용 돌", "missile", 147],
  ["throwing_knife", "투척용 칼", "missile", 146],
  ["throwing_spear", "투척용 창", "missile", 151],
  ["throwing_club", "투척용 몽둥이", "missile", 150],
  ["throwing_axe", "투척용 도끼", "missile", 155],
  ["throwing_hammer", "투척용 망치", "missile", 158],
  ["bola", "볼라", "missile", 152],
  ["javelin", "투창", "missile", 154],
  ["tomahawk", "토마호크", "missile", 155],
  ["trident", "삼지창", "missile", 157],
  ["shuriken", "수리검", "missile", 149],
  ["kunai", "쿠나이", "missile", 153],
  ["dart", "다트", "missile", 160],
  ["boomerang", "부메랑", "missile", 156],
  ["fishing_spear", "낚시용 작살", "missile", 148],
  ["heavy_boomerang", "무거운 부메랑", "missile", 156],
  ["force_cube", "힘의 큐브", "missile", 159, { minFloor: 3 }],
  ["spirit_bow_arrow", "영혼의 화살", "missile", 144, { minFloor: 3 }],

  // brews, elixirs, and bombs
  ["brew_caustic", "부식성 혼합물", "brew", 403, { effect: "blast", power: 8 }],
  ["brew_blizzard", "눈보라 혼합물", "brew", 401, { effect: "frost", power: 9 }],
  ["brew_infernal", "지옥불 혼합물", "brew", 400, { effect: "blast", power: 10 }],
  ["brew_shocking", "전격 혼합물", "brew", 402, { effect: "blast", power: 9 }],
  ["elixir_arcane_armor", "신비한 갑옷의 영약", "elixir", 414, { effect: "cleanse" }],
  ["elixir_aquatic_rejuvenation", "수상 회복의 영약", "elixir", 409, { effect: "heal", power: 12 }],
  ["elixir_dragons_blood", "용의 피 영약", "elixir", 411, { effect: "strength" }],
  ["elixir_honeyed_healing", "달콤한 치유의 영약", "elixir", 408, { effect: "heal", power: 14 }],
  ["elixir_icy_touch", "차가운 손길의 영약", "elixir", 413, { effect: "frost", power: 8 }],
  ["elixir_might", "용력의 영약", "elixir", 410, { effect: "strength" }],
  ["elixir_toxic_essence", "독성 정수의 영약", "elixir", 412, { effect: "blast", power: 8 }],
  ["bomb", "폭탄", "bomb", 80, { effect: "blast", power: 7 }],
  ["firebomb", "화염 폭탄", "bomb", 82, { effect: "blast", power: 9 }],
  ["frost_bomb", "서리 폭탄", "bomb", 83, { effect: "frost", power: 9 }],
  ["holy_bomb", "신성 폭탄", "bomb", 87, { effect: "blast", power: 10 }],
  ["noisemaker", "소음 폭탄", "bomb", 89, { effect: "rage", power: 4 }],
  ["regrowth_bomb", "재성장 폭탄", "bomb", 84, { effect: "heal", power: 7 }],
  ["shrapnel_bomb", "파편 폭탄", "bomb", 91, { effect: "blast", power: 11 }],
  ["shock_bomb", "전격 폭탄", "bomb", 86, { effect: "blast", power: 10 }],
  ["woolly_bomb", "양 변이 폭탄", "bomb", 88, { effect: "blast", power: 5 }],
  ["flashbang", "섬광탄", "bomb", 86, { effect: "blast", power: 6 }],

  // food
  ["small_ration", "작은 식량", "food", 437, { satiation: 24 }],
  ["pasty", "고기 파이", "food", 438, { satiation: 50 }],
  ["mystery_meat", "수상한 고기", "food", 432, { satiation: 28 }],
  ["chargrilled_meat", "직화구이 고기", "food", 433, { satiation: 36 }],
  ["frozen_carpaccio", "얼린 생고기", "food", 436, { satiation: 36 }],
  ["blandfruit", "무미건조과", "food", 440, { satiation: 60 }],
  ["stewed_meat", "고기 스튜", "food", 434, { satiation: 48 }],
  ["phantom_meat", "유령 고기", "food", 443, { satiation: 70, minFloor: 3 }],

  // utility and quest items
  ["gold", "골드", "misc", 35, {
    accent: "#ffd35a",
    description: "원정에서 모은 금화입니다. 가방 칸을 차지하지 않고 원정대 자금에 더해집니다.",
  }],
  ["ankh", "앙크", "misc", 48],
  ["blessed_ankh", "축복받은 앙크", "misc", 48],
  ["dew_vial", "이슬병", "misc", 480],
  ["stylus", "신비한 바늘", "misc", 49],
  ["arcane_resin", "신비한 송진", "misc", 317],
  ["liquid_metal", "액체 금속", "misc", 365],
  ["energy_crystal", "에너지 결정", "misc", 19],
  ["torch", "횃불", "misc", 51],
  ["honeypot", "꿀단지", "misc", 53],
  ["shattered_honeypot", "깨진 꿀단지", "misc", 54],
  ["arcane_catalyst", "신비한 촉매", "misc", 419],
  ["alchemical_catalyst", "연금술 촉매", "misc", 420],
  ["cursed_metal_shard", "저주받은 금속 조각", "misc", 472],
  ["corpse_dust", "시체 먼지", "misc", 465],
  ["dark_gold", "어두운 금광석", "misc", 469],
  ["dwarf_token", "드워프 주화", "misc", 470],
  ["pickaxe", "곡괭이", "misc", 468],
  ["rotberry", "썩은열매", "misc", 384],
  ["emb_i_cinder", "잿불", "misc", 467],
  ["goo_blob", "구의 점액", "misc", 471],
  ["metal_shard", "금속 조각", "misc", 472],
  ["phantom_fish", "유령 물고기", "misc", 443],
  ["guidebook", "던전 탐험 안내서", "misc", 496],
];

export const SHATTERED_ITEM_DEFS: Record<string, ItemDefinition> =
  Object.fromEntries(CATALOG.map((item) => {
    const definition = defineItem(item);
    return [definition.id, definition];
  }));
