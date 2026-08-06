import {
  ITEM_GRADES,
  ITEM_GRADE_COLORS,
  isItemGrade,
  itemGradeIndex,
  itemGradeMultiplier,
  legacyQualityToGrade,
  normalizeItemGrade,
  rollItemGrade,
} from "./item-grade";
import {
  EquipmentStatRoll,
  EquipmentTrait,
  EquipmentTraitId,
  InventoryInstance,
  ItemCategory,
  ItemDefinition,
  ItemGrade,
} from "./types";

export type EquipmentTraitDefinition = {
  id: EquipmentTraitId;
  name: string;
  nameEn: string;
  description: string;
  accent: string;
};

export type EquipmentStatProfile = {
  attack: number;
  defense: number;
  magic: number;
  speed: number;
  moveSpeed: number;
  attackSpeed: number;
  grade: ItemGrade;
  gradeMultiplier: number;
  upgradeLevel: number;
};

export type EquipmentTraitSummary = EquipmentTraitDefinition & {
  grade: ItemGrade;
  gradeColor: string;
  power: number;
  description: string;
  descriptionEn: string;
};

export const EQUIPMENT_TRAITS: Record<
  EquipmentTraitId,
  EquipmentTraitDefinition
> = {
  keen: {
    id: "keen",
    name: "예리함",
    nameEn: "Keen",
    description: "등급에 따라 공격력이 증가합니다",
    accent: "#ef9d69",
  },
  guarded: {
    id: "guarded",
    name: "수호",
    nameEn: "Guarded",
    description: "등급에 따라 방어력이 증가합니다",
    accent: "#78b8da",
  },
  swift: {
    id: "swift",
    name: "신속",
    nameEn: "Swift",
    description: "등급에 따라 이동·공격 속도가 증가합니다",
    accent: "#91d6a1",
  },
  focused: {
    id: "focused",
    name: "집중",
    nameEn: "Focused",
    description: "등급에 따라 마력이 증가합니다",
    accent: "#c69bea",
  },
  charged: {
    id: "charged",
    name: "충전",
    nameEn: "Charged",
    description: "등급에 따라 지팡이 최대 충전량이 증가합니다",
    accent: "#f1d374",
  },
  balanced: {
    id: "balanced",
    name: "균형",
    nameEn: "Balanced",
    description: "등급에 따라 공격력과 방어력이 증가합니다",
    accent: "#e5c88d",
  },
};

export const UPGRADEABLE_ITEM_CATEGORIES = new Set<ItemCategory>([
  "weapon",
  "armor",
  "missile",
  "wand",
  "artifact",
  "ring",
]);

export const isUpgradeableEquipment = (
  definition: ItemDefinition | undefined,
) => Boolean(definition && UPGRADEABLE_ITEM_CATEGORIES.has(definition.category));

const roundStat = (value: number) => Math.round(value * 100) / 100;

/** Enchantments double in strength at every F-S grade step. */
export const enchantmentGradePower = (grade: ItemGrade) =>
  2 ** itemGradeIndex(normalizeItemGrade(grade));

const legacyRankToGrade = (rank: unknown): ItemGrade => {
  const numeric = typeof rank === "number" && Number.isFinite(rank)
    ? Math.max(1, Math.min(3, Math.round(rank)))
    : 1;
  return (["F", "C", "S"] as const)[numeric - 1];
};

const traitGrade = (
  trait: Partial<EquipmentTrait> & {
    id: EquipmentTraitId;
    rank?: number;
  },
  fallback: ItemGrade,
) => isItemGrade(trait.grade)
  ? trait.grade
  : typeof trait.rank === "number"
    ? legacyRankToGrade(trait.rank)
    : fallback;

const traitPower = (
  instance: InventoryInstance | null | undefined,
  id: EquipmentTraitId,
) => {
  const fallback = normalizeItemGrade(instance?.grade);
  return (instance?.traits ?? [])
    .filter((trait) => trait.id === id)
    .reduce(
      (total, trait) =>
        total + enchantmentGradePower(traitGrade(trait, fallback)),
      0,
    );
};

const baseMagic = (definition: ItemDefinition) => {
  if (definition.category === "wand") {
    return Math.max(3, definition.power ?? 0, 2 + (definition.minFloor ?? 1));
  }
  if (definition.category === "artifact") {
    return Math.max(2, 1 + Math.ceil((definition.minFloor ?? 1) / 2));
  }
  if (definition.category === "ring") return 2;
  return definition.power ?? 0;
};

const baseAttack = (definition: ItemDefinition) => {
  if (definition.attack !== undefined) return definition.attack;
  if (definition.category === "missile") {
    return Math.max(2, 1 + (definition.minFloor ?? 1));
  }
  return 0;
};

const upgradeBonuses = (
  definition: ItemDefinition,
  upgradeLevel: number,
) => {
  if (definition.category === "armor") {
    return { attack: 0, defense: upgradeLevel, magic: 0 };
  }
  if (definition.category === "wand" || definition.category === "artifact") {
    return { attack: 0, defense: 0, magic: upgradeLevel };
  }
  if (definition.category === "ring") {
    return {
      attack: Math.ceil(upgradeLevel / 2),
      defense: Math.floor(upgradeLevel / 2),
      magic: upgradeLevel,
    };
  }
  return { attack: upgradeLevel, defense: 0, magic: 0 };
};

export function equipmentStatProfile(
  definition: ItemDefinition,
  instance?: InventoryInstance | null,
): EquipmentStatProfile {
  const roll = instance?.statRoll ?? {
    attack: 0,
    defense: 0,
    magic: 0,
    speed: 0,
  };
  const grade = instance
    ? normalizeItemGrade(instance.grade)
    : "F";
  const gradeMultiplier = itemGradeMultiplier(grade);
  const upgradeLevel = instance?.upgradeLevel ?? 0;
  const upgrades = upgradeBonuses(definition, upgradeLevel);
  const keen = traitPower(instance, "keen");
  const guarded = traitPower(instance, "guarded");
  const focused = traitPower(instance, "focused");
  const balanced = traitPower(instance, "balanced");
  const swift = traitPower(instance, "swift");
  const baseMoveSpeed = 1 + ((definition.moveSpeed ?? 1) - 1) * gradeMultiplier;
  const baseAttackSpeed = 1 +
    ((definition.attackSpeed ?? 1) - 1) * gradeMultiplier;
  const moveSpeed = Math.max(0.25, baseMoveSpeed * (1 + swift * 0.05));
  const attackSpeed = Math.max(0.25, baseAttackSpeed * (1 + swift * 0.05));
  return {
    attack: Math.max(
      0,
      roundStat(
        baseAttack(definition) * gradeMultiplier +
          roll.attack +
          upgrades.attack +
          keen +
          balanced,
      ),
    ),
    defense: Math.max(
      0,
      roundStat(
        (definition.defense ?? 0) * gradeMultiplier +
          roll.defense +
          upgrades.defense +
          guarded +
          balanced,
      ),
    ),
    magic: Math.max(
      0,
      roundStat(
        baseMagic(definition) * gradeMultiplier +
          roll.magic +
          upgrades.magic +
          focused,
      ),
    ),
    speed: Math.max(
      0,
      roundStat(
        (moveSpeed - 1) * 10 +
          (attackSpeed - 1) * 10 +
          roll.speed +
          2,
      ),
    ),
    moveSpeed: roundStat(moveSpeed),
    attackSpeed: roundStat(attackSpeed),
    grade,
    gradeMultiplier,
    upgradeLevel,
  };
}

const availableTraits = (definition: ItemDefinition): EquipmentTraitId[] => {
  switch (definition.category) {
    case "weapon":
    case "missile":
      return definition.slot
        ? ["keen", "balanced", "swift"]
        : ["keen", "swift"];
    case "armor":
      return ["guarded", "balanced", "swift"];
    case "wand":
      return ["focused", "charged", "swift"];
    case "artifact":
      return ["focused", "guarded", "swift"];
    case "ring":
      return ["balanced", "keen", "guarded", "focused", "swift"];
    default:
      return ["swift"];
  }
};

const defaultTrait = (definition: ItemDefinition) => availableTraits(definition)[0];

const emptyStatRoll = (): EquipmentStatRoll => ({
  attack: 0,
  defense: 0,
  magic: 0,
  speed: 0,
});

const S_ENCHANTMENT_CHANCE: Record<ItemGrade, number> = {
  F: 0.002,
  E: 0.005,
  D: 0.01,
  C: 0.02,
  B: 0.04,
  A: 0.07,
  S: 0.1,
};

const ENCHANTMENT_GRADE_RATIO: Record<ItemGrade, number> = {
  F: 0.35,
  E: 0.45,
  D: 0.55,
  C: 0.65,
  B: 0.75,
  A: 0.83,
  S: 0.9,
};

/**
 * Later enchantments always favor lower grades. A better item flattens that
 * curve, while the S endpoint remains exactly 0.2% on F gear and 10% on S.
 */
export function enchantmentGradeChances(
  itemGrade: ItemGrade,
): Record<ItemGrade, number> {
  const normalizedGrade = normalizeItemGrade(itemGrade);
  const sChance = S_ENCHANTMENT_CHANCE[normalizedGrade];
  const ratio = ENCHANTMENT_GRADE_RATIO[normalizedGrade];
  const ordinaryGrades = ITEM_GRADES.slice(0, -1);
  const weights = ordinaryGrades.map((_, index) => ratio ** index);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const result = {} as Record<ItemGrade, number>;
  ordinaryGrades.forEach((grade, index) => {
    result[grade] = ((1 - sChance) * weights[index]) / total;
  });
  result.S = sChance;
  return result;
}

export function rollEnchantmentGrade(
  itemGrade: ItemGrade,
  random: () => number,
): ItemGrade {
  const chances = enchantmentGradeChances(itemGrade);
  let roll = Math.max(0, Math.min(0.999999999, random()));
  for (const grade of ITEM_GRADES) {
    roll -= chances[grade];
    if (roll < 0) return grade;
  }
  return "S";
}

const chargedBonus = (grade: ItemGrade) =>
  enchantmentGradePower(grade);

const applyChargedTrait = (
  instance: InventoryInstance,
  definition: ItemDefinition,
  grade: ItemGrade,
) => {
  if (definition.category !== "wand") return;
  instance.maxCharges = (instance.maxCharges ?? 3) + chargedBonus(grade);
  instance.charges = Math.min(
    instance.maxCharges,
    (instance.charges ?? 0) + chargedBonus(grade),
  );
};

type LegacyEquipmentTrait = Partial<EquipmentTrait> & {
  id?: EquipmentTraitId;
  rank?: number;
};

type LegacyEquipmentInstance = Omit<InventoryInstance, "traits"> & {
  quality?: number;
  traits?: LegacyEquipmentTrait[];
};

export function normalizeEquipmentInstance(
  source: InventoryInstance,
  definition?: ItemDefinition,
): InventoryInstance {
  const legacy = source as unknown as LegacyEquipmentInstance;
  const grade = isItemGrade(legacy.grade)
    ? legacy.grade
    : legacyQualityToGrade(legacy.quality);
  const candidates = definition ? availableTraits(definition) : [];
  const normalizedTraits = (legacy.traits ?? []).flatMap((trait, index) => {
    if (!trait.id || (candidates.length && !candidates.includes(trait.id))) {
      return [];
    }
    const traitGradeValue = index === 0
      ? grade
      : isItemGrade(trait.grade)
        ? trait.grade
        : legacyRankToGrade(trait.rank);
    return [{ id: trait.id, grade: traitGradeValue } satisfies EquipmentTrait];
  });
  if (definition && isUpgradeableEquipment(definition) && !normalizedTraits.length) {
    normalizedTraits.push({ id: defaultTrait(definition), grade });
  }
  if (normalizedTraits[0]) normalizedTraits[0].grade = grade;
  const rest = { ...source } as InventoryInstance & { quality?: number };
  delete rest.quality;
  return {
    ...rest,
    grade,
    statRoll: source.statRoll ? { ...source.statRoll } : emptyStatRoll(),
    traits: normalizedTraits,
  };
}

const createBaseEquipmentInstance = (
  definition: ItemDefinition,
  id: string,
  grade: ItemGrade,
  cursed: boolean,
): InventoryInstance => {
  const maxCharges = definition.category === "wand" || definition.category === "missile"
    ? definition.category === "wand" ? 3 : 1
    : undefined;
  const maxDurability = definition.category === "missile" ? 10 : undefined;
  return {
    id,
    defId: definition.id,
    cursed,
    charges: maxCharges,
    maxCharges,
    baseMaxCharges:
      definition.category === "missile" ? maxCharges : undefined,
    rechargeProgress: definition.category === "wand" ? 0 : undefined,
    durability: maxDurability,
    maxDurability,
    grade,
    upgradeLevel: 0,
    statRoll: emptyStatRoll(),
    traits: [],
  };
};

export function createEquipmentInstance(
  definition: ItemDefinition,
  id: string,
  random: () => number,
  options: {
    allowCurse?: boolean;
    grade?: ItemGrade;
    preferredFirstTrait?: EquipmentTraitId;
  } = {},
): InventoryInstance {
  const grade = options.grade ?? rollItemGrade(random);
  const instance = createBaseEquipmentInstance(
    definition,
    id,
    normalizeItemGrade(grade),
    (options.allowCurse ?? true) && random() < 0.14,
  );
  const candidates = availableTraits(definition);
  const preferred = options.preferredFirstTrait;
  const traitId = preferred && candidates.includes(preferred)
    ? preferred
    : candidates[Math.floor(random() * candidates.length)] ?? defaultTrait(definition);
  instance.traits = [{ id: traitId, grade: instance.grade! }];
  if (traitId === "charged") {
    applyChargedTrait(instance, definition, instance.grade!);
  }
  return instance;
}

export function createPlainEquipmentInstance(
  definition: ItemDefinition,
  id = `plain-${definition.id}`,
  grade: ItemGrade = "C",
): InventoryInstance {
  const normalizedGrade = normalizeItemGrade(grade);
  const instance = createBaseEquipmentInstance(
    definition,
    id,
    normalizedGrade,
    false,
  );
  const traitId = defaultTrait(definition);
  instance.traits = [{ id: traitId, grade: normalizedGrade }];
  if (traitId === "charged") {
    applyChargedTrait(instance, definition, normalizedGrade);
  }
  return instance;
}

export function enchantEquipmentInstance(
  instance: InventoryInstance,
  definition: ItemDefinition,
  random: () => number,
  preferred?: EquipmentTraitId,
) {
  if (!isUpgradeableEquipment(definition)) return null;
  const normalized = normalizeEquipmentInstance(instance, definition);
  Object.assign(instance, normalized);
  const traits = instance.traits ?? (instance.traits = []);
  const candidates = availableTraits(definition);
  const traitId = preferred && candidates.includes(preferred)
    ? preferred
    : candidates[Math.floor(random() * candidates.length)] ?? defaultTrait(definition);
  const grade = traits.length === 0
    ? normalizeItemGrade(instance.grade)
    : rollEnchantmentGrade(normalizeItemGrade(instance.grade), random);
  traits.push({ id: traitId, grade });
  if (traitId === "charged") applyChargedTrait(instance, definition, grade);
  return traitId;
}

export function upgradeEquipmentInstance(
  instance: InventoryInstance,
  amount = 1,
) {
  const grade = normalizeItemGrade(instance.grade);
  instance.upgradeLevel = Math.max(0, (instance.upgradeLevel ?? 0) + amount);
  instance.grade = grade;
}

const formatPower = (value: number) =>
  value.toFixed(value % 1 ? 2 : 0).replace(/0$/, "");

const traitDescriptions = (id: EquipmentTraitId, grade: ItemGrade) => {
  const power = enchantmentGradePower(grade);
  const value = formatPower(power);
  const speed = formatPower(power * 5);
  const charges = chargedBonus(grade);
  switch (id) {
    case "keen":
      return { ko: `공격력 +${value}`, en: `Attack +${value}` };
    case "guarded":
      return { ko: `방어력 +${value}`, en: `Defense +${value}` };
    case "focused":
      return { ko: `마력 +${value}`, en: `Magic +${value}` };
    case "balanced":
      return {
        ko: `공격력·방어력 +${value}`,
        en: `Attack and defense +${value}`,
      };
    case "swift":
      return {
        ko: `이동·공격 속도 +${speed}%`,
        en: `Move and attack speed +${speed}%`,
      };
    case "charged":
      return {
        ko: `지팡이 최대 충전 +${charges}`,
        en: `Maximum wand charges +${charges}`,
      };
  }
};

export const equipmentTraitSummary = (
  instance: InventoryInstance | null | undefined,
): EquipmentTraitSummary[] => {
  const fallback = normalizeItemGrade(instance?.grade);
  return (instance?.traits ?? []).map((trait) => {
    const grade = traitGrade(trait, fallback);
    const descriptions = traitDescriptions(trait.id, grade);
    return {
      ...EQUIPMENT_TRAITS[trait.id],
      grade,
      gradeColor: ITEM_GRADE_COLORS[grade],
      power: enchantmentGradePower(grade),
      description: descriptions.ko,
      descriptionEn: descriptions.en,
    };
  });
};
