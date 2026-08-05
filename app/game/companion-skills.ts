import {
  CompanionSkillCooldowns,
  CompanionSkillId,
} from "./types";

export type CompanionSkillTarget = "tile" | "enemy" | "ally";

export type CompanionSkillDefinition = {
  id: CompanionSkillId;
  nameKo: string;
  nameEn: string;
  shortKo: string;
  shortEn: string;
  descriptionKo: string;
  descriptionEn: string;
  target: CompanionSkillTarget;
  range: number;
  cooldown: number;
  requiresLineOfSight: boolean;
  accent: string;
};

export const COMPANION_SKILLS: Record<
  CompanionSkillId,
  CompanionSkillDefinition
> = {
  shockLeap: {
    id: "shockLeap",
    nameKo: "충격 도약",
    nameEn: "Shock Leap",
    shortKo: "도약",
    shortEn: "LEAP",
    descriptionKo:
      "6칸 안의 빈 타일로 도약하고, 착지점 주위 1칸의 적에게 공격력 160% 피해를 줍니다.",
    descriptionEn:
      "Leap to an empty tile within 6 and deal 160% attack damage to enemies within 1 tile.",
    target: "tile",
    range: 6,
    cooldown: 5,
    requiresLineOfSight: true,
    accent: "#d7a85f",
  },
  drivingLeap: {
    id: "drivingLeap",
    nameKo: "쇄도 도약",
    nameEn: "Driving Leap",
    shortKo: "쇄도",
    shortEn: "DRIVE",
    descriptionKo:
      "6칸 안의 적에게 도약해 공격력 130% 피해를 주고, 도약 방향으로 최대 2칸 밀어냅니다.",
    descriptionEn:
      "Leap at an enemy within 6, deal 130% attack damage, and push it up to 2 tiles.",
    target: "enemy",
    range: 6,
    cooldown: 6,
    requiresLineOfSight: true,
    accent: "#cf795f",
  },
  fireball: {
    id: "fireball",
    nameKo: "파이어볼",
    nameEn: "Fireball",
    shortKo: "화염",
    shortEn: "FIRE",
    descriptionKo:
      "10칸 안의 타일에 화염구를 발사해 주위 1칸에 피해를 주고 불장판을 만듭니다.",
    descriptionEn:
      "Launch a fireball at a tile within 10, damaging a 1-tile area and creating burning ground.",
    target: "tile",
    range: 10,
    cooldown: 7,
    requiresLineOfSight: true,
    accent: "#e36d45",
  },
  weaponThrow: {
    id: "weaponThrow",
    nameKo: "무기 투척",
    nameEn: "Weapon Throw",
    shortKo: "투척",
    shortEn: "HURL",
    descriptionKo:
      "장착 무기를 8칸 안의 적에게 던져 무기 공격력의 5배 피해를 줍니다. 투척한 무기는 착탄 타일 바닥에 떨어집니다.",
    descriptionEn:
      "Throw the equipped weapon at an enemy within 8 for five times its weapon damage. The weapon lands on the target tile.",
    target: "enemy",
    range: 8,
    cooldown: 8,
    requiresLineOfSight: true,
    accent: "#c8a66b",
  },
  arcaneDischarge: {
    id: "arcaneDischarge",
    nameKo: "마력 방출",
    nameEn: "Arcane Discharge",
    shortKo: "방출",
    shortEn: "BURST",
    descriptionKo:
      "10칸 안의 적을 겨냥해 보유한 지팡이 하나의 남은 충전을 전부 소비하고 충전량에 비례한 피해를 줍니다.",
    descriptionEn:
      "Consume every remaining charge in one carried wand to damage an enemy within 10 in proportion to charges spent.",
    target: "enemy",
    range: 10,
    cooldown: 4,
    requiresLineOfSight: true,
    accent: "#a986d8",
  },
  whirlwind: {
    id: "whirlwind",
    nameKo: "회전 베기",
    nameEn: "Whirlwind",
    shortKo: "회전",
    shortEn: "SPIN",
    descriptionKo:
      "자기 타일을 선택해 주위 1칸의 모든 적에게 공격력 140% 피해를 줍니다.",
    descriptionEn:
      "Select your own tile to deal 140% attack damage to every adjacent enemy.",
    target: "tile",
    range: 0,
    cooldown: 4,
    requiresLineOfSight: false,
    accent: "#d6c477",
  },
  piercingShot: {
    id: "piercingShot",
    nameKo: "관통 사격",
    nameEn: "Piercing Shot",
    shortKo: "관통",
    shortEn: "PIERCE",
    descriptionKo:
      "10칸 안의 적을 향해 일직선으로 공격하여 경로 위 모든 적에게 공격력 180% 피해를 줍니다.",
    descriptionEn:
      "Strike in a straight line toward an enemy within 10, dealing 180% attack damage to every enemy along it.",
    target: "enemy",
    range: 10,
    cooldown: 6,
    requiresLineOfSight: true,
    accent: "#87b68a",
  },
  chainLightning: {
    id: "chainLightning",
    nameKo: "연쇄 번개",
    nameEn: "Chain Lightning",
    shortKo: "연쇄",
    shortEn: "CHAIN",
    descriptionKo:
      "8칸 안의 적을 감전시키고, 3칸 안의 가까운 적 둘에게 연쇄됩니다. 물 위의 적을 맞히면 같은 물웅덩이의 모든 개체가 피해를 받습니다.",
    descriptionEn:
      "Shock an enemy within 8, then arc to two nearby enemies. A hit on water conducts through the whole connected puddle.",
    target: "enemy",
    range: 8,
    cooldown: 7,
    requiresLineOfSight: true,
    accent: "#d9d86d",
  },
  frostNova: {
    id: "frostNova",
    nameKo: "서리 폭발",
    nameEn: "Frost Nova",
    shortKo: "서리",
    shortEn: "FROST",
    descriptionKo:
      "8칸 안의 타일 주위 1칸에 냉기 피해를 주고 적을 빙결시킵니다.",
    descriptionEn:
      "Blast a 1-tile area within 8 with frost damage and freeze affected enemies.",
    target: "tile",
    range: 8,
    cooldown: 7,
    requiresLineOfSight: true,
    accent: "#75c9d8",
  },
  toxicOrb: {
    id: "toxicOrb",
    nameKo: "맹독 구체",
    nameEn: "Toxic Orb",
    shortKo: "맹독",
    shortEn: "TOXIN",
    descriptionKo:
      "8칸 안의 타일에 독 구체를 던져 최대 반경 2칸의 맹독 장판을 만듭니다.",
    descriptionEn:
      "Throw an orb within 8 that spreads toxic ground up to a 2-tile radius.",
    target: "tile",
    range: 8,
    cooldown: 7,
    requiresLineOfSight: true,
    accent: "#79ae58",
  },
  corrosiveFlask: {
    id: "corrosiveFlask",
    nameKo: "부식성 플라스크",
    nameEn: "Corrosive Flask",
    shortKo: "부식",
    shortEn: "ACID",
    descriptionKo:
      "8칸 안의 타일에 플라스크를 던져 최대 반경 2칸의 부식 장판을 만듭니다.",
    descriptionEn:
      "Throw a flask within 8 that spreads corrosive ground up to a 2-tile radius.",
    target: "tile",
    range: 8,
    cooldown: 8,
    requiresLineOfSight: true,
    accent: "#a5bd50",
  },
  entanglingRoots: {
    id: "entanglingRoots",
    nameKo: "속박의 뿌리",
    nameEn: "Entangling Roots",
    shortKo: "속박",
    shortEn: "ROOT",
    descriptionKo:
      "8칸 안의 타일 주위 2칸에 뿌리를 솟게 해 적에게 피해를 주고 3턴간 속박합니다.",
    descriptionEn:
      "Raise roots in a 2-tile area within 8, damaging enemies and rooting them for 3 turns.",
    target: "tile",
    range: 8,
    cooldown: 8,
    requiresLineOfSight: true,
    accent: "#6d9f62",
  },
  shadowStep: {
    id: "shadowStep",
    nameKo: "그림자 이동",
    nameEn: "Shadow Step",
    shortKo: "그림자",
    shortEn: "SHADE",
    descriptionKo:
      "8칸 안의 빈 타일로 순간이동하고, 착지점 주위 1칸의 적에게 기습 피해를 줍니다.",
    descriptionEn:
      "Teleport to an empty tile within 8 and ambush adjacent enemies on arrival.",
    target: "tile",
    range: 8,
    cooldown: 6,
    requiresLineOfSight: false,
    accent: "#776c9b",
  },
  execute: {
    id: "execute",
    nameKo: "처형",
    nameEn: "Execute",
    shortKo: "처형",
    shortEn: "EXEC",
    descriptionKo:
      "인접한 적을 공격합니다. 생명력이 40% 이하인 적에게 공격력 400% 피해를 줍니다.",
    descriptionEn:
      "Strike an adjacent enemy, dealing 400% attack damage if it is at or below 40% health.",
    target: "enemy",
    range: 1,
    cooldown: 6,
    requiresLineOfSight: false,
    accent: "#b95f5b",
  },
  shieldCharge: {
    id: "shieldCharge",
    nameKo: "방패 돌진",
    nameEn: "Shield Charge",
    shortKo: "돌진",
    shortEn: "BASH",
    descriptionKo:
      "4칸 안의 적에게 돌진해 방어력 기반 피해를 주고 최대 3칸 밀어낸 뒤 마비시킵니다.",
    descriptionEn:
      "Charge an enemy within 4, deal defense-based damage, push it up to 3 tiles, and paralyze it.",
    target: "enemy",
    range: 4,
    cooldown: 7,
    requiresLineOfSight: true,
    accent: "#8196a4",
  },
  fieldMedicine: {
    id: "fieldMedicine",
    nameKo: "응급 치료",
    nameEn: "Field Medicine",
    shortKo: "치료",
    shortEn: "HEAL",
    descriptionKo:
      "6칸 안의 원정대원 한 명을 최대 생명력의 50%만큼 회복합니다. 자신도 선택할 수 있습니다.",
    descriptionEn:
      "Heal one party member within 6 for 50% of maximum health. The caster may target themself.",
    target: "ally",
    range: 6,
    cooldown: 9,
    requiresLineOfSight: true,
    accent: "#69b77d",
  },
  wardingSigil: {
    id: "wardingSigil",
    nameKo: "수호의 결계",
    nameEn: "Warding Sigil",
    shortKo: "결계",
    shortEn: "WARD",
    descriptionKo:
      "6칸 안의 타일에 6턴간 유지되며 매 턴 가까운 적을 공격하는 결계를 설치합니다.",
    descriptionEn:
      "Place a sigil within 6 that lasts 6 turns and attacks a nearby enemy each turn.",
    target: "tile",
    range: 6,
    cooldown: 9,
    requiresLineOfSight: true,
    accent: "#a98bd0",
  },
  tripleStrike: {
    id: "tripleStrike",
    nameKo: "삼연격",
    nameEn: "Triple Strike",
    shortKo: "삼연",
    shortEn: "TRI",
    descriptionKo:
      "인접한 적을 빠르게 세 번 공격해 매 타격마다 공격력 75% 피해를 줍니다.",
    descriptionEn:
      "Hit an adjacent enemy three times, each strike dealing 75% attack damage.",
    target: "enemy",
    range: 1,
    cooldown: 5,
    requiresLineOfSight: false,
    accent: "#d3a45f",
  },
  seismicSlam: {
    id: "seismicSlam",
    nameKo: "대지 강타",
    nameEn: "Seismic Slam",
    shortKo: "대지",
    shortEn: "QUAKE",
    descriptionKo:
      "2칸 안의 타일을 내리쳐 주위 2칸의 적에게 피해를 주고 1턴간 마비시킵니다.",
    descriptionEn:
      "Slam a tile within 2, damaging enemies in a 2-tile area and paralyzing them for 1 turn.",
    target: "tile",
    range: 2,
    cooldown: 8,
    requiresLineOfSight: false,
    accent: "#aa875d",
  },
  lifeDrain: {
    id: "lifeDrain",
    nameKo: "생명력 흡수",
    nameEn: "Life Drain",
    shortKo: "흡수",
    shortEn: "DRAIN",
    descriptionKo:
      "6칸 안의 적에게 마력 피해를 주고 실제로 준 피해의 절반만큼 자신을 회복합니다.",
    descriptionEn:
      "Deal arcane damage to an enemy within 6 and heal the caster for half the damage actually dealt.",
    target: "enemy",
    range: 6,
    cooldown: 7,
    requiresLineOfSight: true,
    accent: "#a66a9f",
  },
};

export const COMPANION_SKILL_IDS = Object.keys(
  COMPANION_SKILLS,
) as CompanionSkillId[];

const stableSkillRandom = (seedKey: string) => {
  let value = 0x9e3779b9;
  for (const character of seedKey) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 0x85ebca6b);
  }
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000;
  };
};

export const createCompanionSkills = (seedKey: string) => {
  const random = stableSkillRandom(`skills:${seedKey}`);
  const shuffled = [...COMPANION_SKILL_IDS];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled.slice(0, 2);
};

export const normalizeCompanionSkills = (
  seedKey: string,
  skillIds: readonly CompanionSkillId[] | undefined,
) => {
  const valid = [...new Set(skillIds ?? [])].filter(
    (id): id is CompanionSkillId => id in COMPANION_SKILLS,
  );
  for (const generated of createCompanionSkills(seedKey)) {
    if (valid.length >= 2) break;
    if (!valid.includes(generated)) valid.push(generated);
  }
  for (const fallback of COMPANION_SKILL_IDS) {
    if (valid.length >= 2) break;
    if (!valid.includes(fallback)) valid.push(fallback);
  }
  return valid.slice(0, 2);
};

export const normalizeSkillCooldowns = (
  cooldowns: CompanionSkillCooldowns | undefined,
): CompanionSkillCooldowns =>
  Object.fromEntries(
    Object.entries(cooldowns ?? {}).flatMap(([id, turns]) =>
      id in COMPANION_SKILLS && Number.isFinite(turns) && Number(turns) > 0
        ? [[id, Math.max(1, Math.floor(Number(turns)))]]
        : [],
    ),
  ) as CompanionSkillCooldowns;
