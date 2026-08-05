import { AugmentId, Player } from "./types";

export type AugmentGrade = "S" | "A" | "B" | "C";

export type AugmentDefinition = {
  id: AugmentId;
  name: string;
  originalTalent: string;
  description: string;
  maxRank: number;
  accent: string;
  /** Frame index in Shattered Pixel Dungeon's 16x16 talent icon atlas. */
  icon: number;
  grade: AugmentGrade;
};

export const AUGMENT_DEFS: Record<AugmentId, AugmentDefinition> = {
  ironWill: {
    id: "ironWill",
    name: "강철의 의지",
    originalTalent: "IRON WILL",
    description: "최대 생명력이 등급마다 4 증가하고 즉시 그만큼 회복합니다.",
    maxRank: 3,
    accent: "#e47963",
    icon: 3,
    grade: "A",
  },
  strongman: {
    id: "strongman",
    name: "강한 사람",
    originalTalent: "STRONGMAN",
    description: "기본 공격력이 등급마다 1 증가합니다.",
    maxRank: 3,
    accent: "#e5a45f",
    icon: 10,
    grade: "A",
  },
  preciseAssault: {
    id: "preciseAssault",
    name: "정확한 강습",
    originalTalent: "PRECISE ASSAULT",
    description: "명중이 등급마다 2 증가합니다.",
    maxRank: 3,
    accent: "#e3ca68",
    icon: 137,
    grade: "B",
  },
  liquidAgility: {
    id: "liquidAgility",
    name: "유동적인 민첩성",
    originalTalent: "LIQUID AGILITY",
    description: "회피가 등급마다 2 증가합니다.",
    maxRank: 3,
    accent: "#78c6dc",
    icon: 133,
    grade: "B",
  },
  farsight: {
    id: "farsight",
    name: "선견지명",
    originalTalent: "FARSIGHT",
    description: "영웅의 시야 반경이 등급마다 1칸 증가합니다.",
    maxRank: 3,
    accent: "#9ccbd4",
    icon: 107,
    grade: "B",
  },
  suckerPunch: {
    id: "suckerPunch",
    name: "불의의 일격",
    originalTalent: "SUCKER PUNCH",
    description: "기습 공격 피해가 등급마다 2 증가합니다.",
    maxRank: 3,
    accent: "#d388c8",
    icon: 66,
    grade: "C",
  },
  lethalMomentum: {
    id: "lethalMomentum",
    name: "치명적 가속",
    originalTalent: "LETHAL MOMENTUM",
    description: "적을 처치하면 등급만큼 생명력을 회복합니다.",
    maxRank: 3,
    accent: "#dd6a74",
    icon: 7,
    grade: "B",
  },
  naturesAid: {
    id: "naturesAid",
    name: "자연의 도움",
    originalTalent: "NATURE'S AID",
    description: "우거진 풀에 들어서면 등급만큼 회복합니다. 재사용 대기 5턴.",
    maxRank: 3,
    accent: "#79ba72",
    icon: 99,
    grade: "C",
  },
  heartyMeal: {
    id: "heartyMeal",
    name: "든든한 식사",
    originalTalent: "HEARTY MEAL",
    description: "식량의 회복 효과가 등급마다 25% 증가합니다.",
    maxRank: 3,
    accent: "#c49b66",
    icon: 0,
    grade: "C",
  },
  weaponInfusion: {
    id: "weaponInfusion",
    name: "칼날 주입",
    originalTalent: "WEAPON INFUSION",
    description:
      "선택할 때 현재 무기에 예리함 인챈트를 부여합니다. 이미 있다면 등급이 오릅니다.",
    maxRank: 3,
    accent: "#ef8e67",
    icon: 98,
    grade: "S",
  },
  armorInfusion: {
    id: "armorInfusion",
    name: "갑주 주입",
    originalTalent: "ARMOR INFUSION",
    description:
      "선택할 때 현재 갑옷에 수호 인챈트를 부여합니다. 이미 있다면 등급이 오릅니다.",
    maxRank: 3,
    accent: "#78b4d7",
    icon: 9,
    grade: "A",
  },
  ringResonance: {
    id: "ringResonance",
    name: "반지 공명",
    originalTalent: "RING RESONANCE",
    description:
      "선택할 때 장착한 반지 하나에 집중 또는 신속 인챈트를 부여합니다.",
    maxRank: 3,
    accent: "#c994e7",
    icon: 73,
    grade: "A",
  },
  runicTemper: {
    id: "runicTemper",
    name: "룬 담금질",
    originalTalent: "RUNIC TEMPER",
    description:
      "선택할 때 현재 장비 중 하나를 +1 강화하고 무작위 특성을 덧붙입니다.",
    maxRank: 3,
    accent: "#e5c36d",
    icon: 140,
    grade: "S",
  },
  royalArmory: {
    id: "royalArmory",
    name: "왕실 병기고",
    originalTalent: "ROYAL ARMORY",
    description:
      "선택할 때 무기·갑옷·반지 전체에 각각 알맞은 인챈트를 한 번씩 부여합니다.",
    maxRank: 2,
    accent: "#e9d69a",
    icon: 109,
    grade: "S",
  },
};

export const AUGMENT_IDS = Object.keys(AUGMENT_DEFS) as AugmentId[];
export const AUGMENTS_ENABLED = false;
export const AUGMENT_GRADES = ["S", "A", "B", "C"] as const;
export const AUGMENT_GRADE_WEIGHTS: Record<AugmentGrade, number> = {
  S: 0.1,
  A: 0.25,
  B: 0.35,
  C: 0.3,
};

export const augmentRank = (player: Player, id: AugmentId) =>
  AUGMENTS_ENABLED ? player.augments[id] ?? 0 : 0;

export function makeAugmentOffer(
  player: Player,
  random: () => number,
  count = 3,
) {
  if (!AUGMENTS_ENABLED) return [];
  const gradePools = AUGMENT_GRADES.map((grade) => ({
    grade,
    ids: AUGMENT_IDS.filter(
      (id) =>
        AUGMENT_DEFS[id].grade === grade &&
        augmentRank(player, id) < AUGMENT_DEFS[id].maxRank,
    ),
  }));
  const fullGradePools = gradePools.filter(({ ids }) => ids.length >= count);
  const eligibleGradePools = fullGradePools.length
    ? fullGradePools
    : gradePools.filter(({ ids }) => ids.length > 0);
  if (!eligibleGradePools.length) return [];
  const totalWeight = eligibleGradePools.reduce(
    (sum, { grade }) => sum + AUGMENT_GRADE_WEIGHTS[grade],
    0,
  );
  let gradeRoll = random() * totalWeight;
  const selectedGradePool =
    eligibleGradePools.find(({ grade }) => {
      gradeRoll -= AUGMENT_GRADE_WEIGHTS[grade];
      return gradeRoll <= 0;
    }) ?? eligibleGradePools[eligibleGradePools.length - 1];
  const pool = [...selectedGradePool.ids];
  const offer: AugmentId[] = [];
  while (pool.length && offer.length < count) {
    const index = Math.floor(random() * pool.length);
    offer.push(pool.splice(index, 1)[0]);
  }
  return offer;
}
