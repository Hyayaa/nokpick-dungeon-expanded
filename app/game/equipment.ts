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
  criticalChance: number;
  criticalDamageBonus: number;
  lifeSteal: number;
  armorPenetration: number;
  cooldownReduction: number;
  statusResistance: number;
  grade: ItemGrade;
  gradeMultiplier: number;
  upgradeLevel: number;
};

export type EquipmentCombatStatProfile = Pick<
  EquipmentStatProfile,
  | "criticalChance"
  | "criticalDamageBonus"
  | "lifeSteal"
  | "armorPenetration"
  | "cooldownReduction"
  | "statusResistance"
>;

export type CombatStatEquipmentTraitId =
  | "lethal"
  | "devastating"
  | "vampiric"
  | "piercing"
  | "quickened"
  | "resistant";

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
  lethal: {
    id: "lethal",
    name: "치명",
    nameEn: "Lethal",
    description: "치명타 확률이 증가합니다",
    accent: "#ee6d68",
  },
  devastating: {
    id: "devastating",
    name: "파괴",
    nameEn: "Devastating",
    description: "치명타 피해가 증가합니다",
    accent: "#e78964",
  },
  vampiric: {
    id: "vampiric",
    name: "흡혈",
    nameEn: "Vampiric",
    description: "실제 피해의 일부를 생명력으로 흡수합니다",
    accent: "#c34f68",
  },
  piercing: {
    id: "piercing",
    name: "관통",
    nameEn: "Piercing",
    description: "대상의 방어력을 일부 무시합니다",
    accent: "#d7b46a",
  },
  quickened: {
    id: "quickened",
    name: "가속",
    nameEn: "Quickened",
    description: "스킬 재사용 대기시간이 감소합니다",
    accent: "#71c9aa",
  },
  resistant: {
    id: "resistant",
    name: "불굴",
    nameEn: "Resolute",
    description: "해로운 상태이상에 저항할 확률이 증가합니다",
    accent: "#74a9df",
  },
};

export const COMBAT_STAT_ENCHANTMENT_VALUES: Record<
  CombatStatEquipmentTraitId,
  Partial<Record<ItemGrade, number>>
> = {
  lethal: { F: 0.02, E: 0.04, D: 0.06, C: 0.09, B: 0.12, A: 0.18, S: 0.25 },
  devastating: { F: 0.01, E: 0.02, D: 0.04, C: 0.08, B: 0.16, A: 0.32, S: 0.64 },
  vampiric: { B: 0.06, A: 0.09, S: 0.12 },
  piercing: { F: 0.01, E: 0.02, D: 0.04, C: 0.08, B: 0.16, A: 0.32, S: 0.64 },
  quickened: { F: 0.005, E: 0.01, D: 0.02, C: 0.04, B: 0.08, A: 0.16, S: 0.32 },
  resistant: { F: 0.01, E: 0.02, D: 0.04, C: 0.08, B: 0.16, A: 0.32, S: 0.64 },
};

const COMBAT_STAT_EQUIPMENT_TRAITS = new Set<EquipmentTraitId>(
  Object.keys(COMBAT_STAT_ENCHANTMENT_VALUES) as CombatStatEquipmentTraitId[],
);

export const isCombatStatEquipmentTrait = (
  id: EquipmentTraitId,
): id is CombatStatEquipmentTraitId => COMBAT_STAT_EQUIPMENT_TRAITS.has(id);

export const combatStatEnchantmentBonus = (
  id: EquipmentTraitId,
  grade: ItemGrade,
) => isCombatStatEquipmentTrait(id)
  ? COMBAT_STAT_ENCHANTMENT_VALUES[id][normalizeItemGrade(grade)] ?? 0
  : 0;

export const formatRatePercent = (value: number) => {
  const percent = Math.round(Math.max(0, value) * 10000) / 100;
  return `${percent.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}%`;
};

export const UPGRADEABLE_ITEM_CATEGORIES = new Set<ItemCategory>([
  "weapon",
  "armor",
  "missile",
  "wand",
  "artifact",
  "ring",
]);

export const MAX_EQUIPMENT_ENCHANTMENTS = 3;
export const UPGRADE_SCROLL_ENCHANTMENT_CHANCE = 0.2;

export type EquipmentConsumableId = "scroll_upgrade" | "scroll_identify";

export const isEquipmentConsumableId = (
  value: string,
): value is EquipmentConsumableId =>
  value === "scroll_upgrade" || value === "scroll_identify";

export const isUpgradeableEquipment = (
  definition: ItemDefinition | undefined,
) => Boolean(definition && UPGRADEABLE_ITEM_CATEGORIES.has(definition.category));

const roundStat = (value: number) => Math.round(value * 100) / 100;
const roundRate = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

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

const combatTraitBonus = (
  instance: InventoryInstance | null | undefined,
  id: CombatStatEquipmentTraitId,
) => {
  const fallback = normalizeItemGrade(instance?.grade);
  return roundRate(
    (instance?.traits ?? [])
      .filter((trait) => trait.id === id)
      .reduce(
        (total, trait) =>
          total + combatStatEnchantmentBonus(id, traitGrade(trait, fallback)),
        0,
      ),
  );
};

export function equipmentCombatStatProfile(
  instance?: InventoryInstance | null,
): EquipmentCombatStatProfile {
  return {
    criticalChance: combatTraitBonus(instance, "lethal"),
    criticalDamageBonus: combatTraitBonus(instance, "devastating"),
    lifeSteal: combatTraitBonus(instance, "vampiric"),
    armorPenetration: combatTraitBonus(instance, "piercing"),
    cooldownReduction: combatTraitBonus(instance, "quickened"),
    statusResistance: combatTraitBonus(instance, "resistant"),
  };
}

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
  const combatStats = equipmentCombatStatProfile(instance);
  const baseMoveSpeed = 1 + ((definition.moveSpeed ?? 1) - 1) * gradeMultiplier;
  const baseAttackSpeed = 1 +
    ((definition.attackSpeed ?? 1) - 1) * gradeMultiplier;
  const moveSpeed = Math.max(0.25, baseMoveSpeed);
  const attackSpeed = Math.max(0.25, baseAttackSpeed);
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
    ...combatStats,
    grade,
    gradeMultiplier,
    upgradeLevel,
  };
}

const vampiricAllowedAt = (grade: ItemGrade) => itemGradeIndex(grade) >= itemGradeIndex("B");

export const availableEquipmentTraits = (
  definition: ItemDefinition,
  grade: ItemGrade,
): EquipmentTraitId[] => {
  const candidates: EquipmentTraitId[] = (() => {
    switch (definition.category) {
    case "weapon":
      return ["keen", "balanced", "lethal", "devastating", "vampiric", "piercing"];
    case "missile":
      return ["keen", "lethal", "devastating", "vampiric", "piercing"];
    case "armor":
      return ["guarded", "balanced", "quickened", "resistant"];
    case "wand":
      return ["focused", "charged", "lethal", "devastating", "vampiric", "piercing", "quickened"];
    case "artifact":
      return ["focused", "guarded", "vampiric", "quickened", "resistant"];
    case "ring":
      return [
        "balanced", "keen", "guarded", "focused",
        "lethal", "devastating", "vampiric", "piercing", "quickened", "resistant",
      ];
    default:
      return [];
    }
  })();
  return vampiricAllowedAt(grade)
    ? candidates
    : candidates.filter((id) => id !== "vampiric");
};

const defaultTrait = (definition: ItemDefinition, grade: ItemGrade) =>
  availableEquipmentTraits(definition, grade)[0] ?? "balanced";

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

export function rollInitialEnchantmentCount(random: () => number) {
  const roll = Math.max(0, Math.min(0.999999999, random()));
  if (roll < 0.6) return 1;
  if (roll < 0.9) return 2;
  return 3;
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

type LegacyEquipmentTrait = Partial<Omit<EquipmentTrait, "id">> & {
  id?: EquipmentTraitId | "swift";
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
  const allCandidates = definition
    ? availableEquipmentTraits(definition, "S")
    : [];
  const normalizedTraits = (legacy.traits ?? []).flatMap((trait, index) => {
    if (!trait.id) return [];
    if (trait.id === "swift") return [];
    const traitGradeValue = index === 0
      ? grade
      : isItemGrade(trait.grade)
        ? trait.grade
        : legacyRankToGrade(trait.rank);
    if (trait.id === "vampiric" && !vampiricAllowedAt(traitGradeValue)) {
      return definition
        ? [{ id: defaultTrait(definition, traitGradeValue), grade: traitGradeValue } satisfies EquipmentTrait]
        : [];
    }
    if (allCandidates.length && !allCandidates.includes(trait.id)) return [];
    return [{ id: trait.id, grade: traitGradeValue } satisfies EquipmentTrait];
  }).slice(0, MAX_EQUIPMENT_ENCHANTMENTS);
  if (definition && isUpgradeableEquipment(definition) && !normalizedTraits.length) {
    normalizedTraits.push({ id: defaultTrait(definition, grade), grade });
  }
  if (normalizedTraits[0]) {
    normalizedTraits[0].grade = grade;
    if (normalizedTraits[0].id === "vampiric" && !vampiricAllowedAt(grade)) {
      if (definition) normalizedTraits[0].id = defaultTrait(definition, grade);
      else normalizedTraits.shift();
    }
  }
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
  const candidates = availableEquipmentTraits(definition, instance.grade!);
  const preferred = options.preferredFirstTrait;
  const traitId = preferred && candidates.includes(preferred)
    ? preferred
    : candidates[Math.floor(random() * candidates.length)] ?? defaultTrait(definition, instance.grade!);
  instance.traits = [{ id: traitId, grade: instance.grade! }];
  if (traitId === "charged") {
    applyChargedTrait(instance, definition, instance.grade!);
  }
  const enchantmentCount = rollInitialEnchantmentCount(random);
  while ((instance.traits?.length ?? 0) < enchantmentCount) {
    if (!enchantEquipmentInstance(instance, definition, random)) break;
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
  const traitId = defaultTrait(definition, normalizedGrade);
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
  if (traits.length >= MAX_EQUIPMENT_ENCHANTMENTS) return null;
  const grade = traits.length === 0
    ? normalizeItemGrade(instance.grade)
    : rollEnchantmentGrade(normalizeItemGrade(instance.grade), random);
  const candidates = availableEquipmentTraits(definition, grade);
  const traitId = preferred && candidates.includes(preferred)
    ? preferred
    : candidates[Math.floor(random() * candidates.length)] ?? defaultTrait(definition, grade);
  traits.push({ id: traitId, grade });
  if (traitId === "charged") applyChargedTrait(instance, definition, grade);
  return traitId;
}

export type EquipmentEnchantmentRerollResult = {
  changed: boolean;
  before: EquipmentTrait[];
  after: EquipmentTrait[];
};

const chargedTraitContribution = (
  definition: ItemDefinition,
  traits: readonly EquipmentTrait[],
) => definition.category === "wand"
  ? traits.reduce(
      (total, trait) => total + (
        trait.id === "charged" ? chargedBonus(trait.grade) : 0
      ),
      0,
    )
  : 0;

const applyChargedContributionChange = (
  instance: InventoryInstance,
  definition: ItemDefinition,
  before: readonly EquipmentTrait[],
  after: readonly EquipmentTrait[],
) => {
  if (definition.category !== "wand") return;
  const chargeDelta =
    chargedTraitContribution(definition, after) -
    chargedTraitContribution(definition, before);
  if (chargeDelta === 0) return;
  const maxCharges = Math.max(0, (instance.maxCharges ?? 3) + chargeDelta);
  instance.maxCharges = maxCharges;
  instance.charges = Math.min(
    maxCharges,
    Math.max(0, (instance.charges ?? 0) + chargeDelta),
  );
};

export function rerollEquipmentEnchantments(
  instance: InventoryInstance,
  definition: ItemDefinition,
  lockedIndexes: readonly number[] | ReadonlySet<number>,
  random: () => number,
): EquipmentEnchantmentRerollResult {
  const before = (instance.traits ?? []).map((trait) => ({ ...trait }));
  if (!isUpgradeableEquipment(definition) || before.length === 0) {
    return { changed: false, before, after: before.map((trait) => ({ ...trait })) };
  }
  const locked = new Set<number>(lockedIndexes);
  const after = before.map((trait, index) => {
    if (locked.has(index)) return { ...trait };
    const candidates = availableEquipmentTraits(definition, trait.grade);
    const alternatives = candidates.length > 1
      ? candidates.filter((candidate) => candidate !== trait.id)
      : candidates;
    const pool = alternatives.length ? alternatives : candidates;
    const roll = Math.max(0, Math.min(0.999999999, random()));
    const id = pool[Math.floor(roll * pool.length)] ?? trait.id;
    return { id, grade: trait.grade };
  });
  const changed = after.some((trait, index) => trait.id !== before[index].id);
  if (!changed) {
    return { changed: false, before, after };
  }
  instance.traits = after;
  applyChargedContributionChange(instance, definition, before, after);
  return { changed: true, before, after: after.map((trait) => ({ ...trait })) };
}

export function upgradeEquipmentInstance(
  instance: InventoryInstance,
  amount = 1,
) {
  const grade = normalizeItemGrade(instance.grade);
  instance.upgradeLevel = Math.max(0, (instance.upgradeLevel ?? 0) + amount);
  instance.grade = grade;
}

export const canApplyEquipmentConsumable = (
  consumableId: EquipmentConsumableId,
  definition: ItemDefinition | undefined,
  instance: InventoryInstance | null | undefined,
) => Boolean(
  instance &&
  isUpgradeableEquipment(definition) &&
  (consumableId === "scroll_upgrade" ||
    (instance.traits?.length ?? 0) < MAX_EQUIPMENT_ENCHANTMENTS),
);

export type EquipmentConsumableApplication = {
  changed: boolean;
  upgraded: boolean;
  traitId: EquipmentTraitId | null;
  reason: "ok" | "invalid-target" | "maximum-enchantments";
};

export function applyEquipmentConsumableToInstance(
  instance: InventoryInstance,
  definition: ItemDefinition,
  consumableId: EquipmentConsumableId,
  random: () => number,
): EquipmentConsumableApplication {
  if (!isUpgradeableEquipment(definition)) {
    return {
      changed: false,
      upgraded: false,
      traitId: null,
      reason: "invalid-target",
    };
  }
  if (
    consumableId === "scroll_identify" &&
    (instance.traits?.length ?? 0) >= MAX_EQUIPMENT_ENCHANTMENTS
  ) {
    return {
      changed: false,
      upgraded: false,
      traitId: null,
      reason: "maximum-enchantments",
    };
  }

  if (consumableId === "scroll_identify") {
    const traitId = enchantEquipmentInstance(instance, definition, random);
    return traitId
      ? { changed: true, upgraded: false, traitId, reason: "ok" }
      : {
          changed: false,
          upgraded: false,
          traitId: null,
          reason: "maximum-enchantments",
        };
  }

  upgradeEquipmentInstance(instance);
  const traitId =
    (instance.traits?.length ?? 0) < MAX_EQUIPMENT_ENCHANTMENTS &&
      random() < UPGRADE_SCROLL_ENCHANTMENT_CHANCE
      ? enchantEquipmentInstance(instance, definition, random)
      : null;
  return {
    changed: true,
    upgraded: true,
    traitId,
    reason: "ok",
  };
}

const formatPower = (value: number) =>
  value.toFixed(value % 1 ? 2 : 0).replace(/0$/, "");

const traitDescriptions = (id: EquipmentTraitId, grade: ItemGrade) => {
  if (isCombatStatEquipmentTrait(id)) {
    const value = formatRatePercent(combatStatEnchantmentBonus(id, grade));
    switch (id) {
      case "lethal":
        return { ko: `치명타 확률 +${value}`, en: `Critical chance +${value}` };
      case "devastating":
        return { ko: `치명타 피해 +${value}`, en: `Critical damage +${value}` };
      case "vampiric":
        return { ko: `피해 흡혈 +${value}`, en: `Life steal +${value}` };
      case "piercing":
        return { ko: `방어 관통 +${value}`, en: `Armor penetration +${value}` };
      case "quickened":
        return { ko: `재사용 대기시간 감소 +${value}`, en: `Cooldown reduction +${value}` };
      case "resistant":
        return { ko: `상태이상 저항 +${value}`, en: `Status resistance +${value}` };
    }
  }
  const power = enchantmentGradePower(grade);
  const value = formatPower(power);
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
      power: isCombatStatEquipmentTrait(trait.id)
        ? combatStatEnchantmentBonus(trait.id, grade)
        : enchantmentGradePower(grade),
      description: descriptions.ko,
      descriptionEn: descriptions.en,
    };
  });
};
