import type { InventoryInstance, ItemDefinition, ItemGrade } from "./types";

export const ITEM_GRADES = ["F", "E", "D", "C", "B", "A", "S"] as const;

export const ITEM_GRADE_COLORS: Record<ItemGrade, string> = {
  F: "#8b5a2b",
  E: "#ffffff",
  D: "#ffffff",
  C: "#3b82f6",
  B: "#22c55e",
  A: "#ef4444",
  S: "#ffffff",
};

const DEFAULT_GRADE: ItemGrade = "C";

export const isItemGrade = (value: unknown): value is ItemGrade =>
  typeof value === "string" && ITEM_GRADES.includes(value as ItemGrade);

export const normalizeItemGrade = (
  value: unknown,
  fallback: ItemGrade = DEFAULT_GRADE,
): ItemGrade => (isItemGrade(value) ? value : fallback);

export const itemGradeIndex = (grade: ItemGrade) =>
  ITEM_GRADES.indexOf(normalizeItemGrade(grade));

/** Every step is exactly twenty percent stronger than the previous grade. */
export const itemGradeMultiplier = (grade: ItemGrade) =>
  1.2 ** itemGradeIndex(grade);

/** Maps the retired 1-5 quality scale evenly onto the seven grade steps. */
export const legacyQualityToGrade = (quality: unknown): ItemGrade => {
  const numeric = typeof quality === "number" && Number.isFinite(quality)
    ? Math.max(1, Math.min(5, Math.round(quality)))
    : 3;
  const index = Math.round(((numeric - 1) * (ITEM_GRADES.length - 1)) / 4);
  return ITEM_GRADES[index];
};

const NATURAL_GRADE_WEIGHTS: Record<ItemGrade, number> = {
  F: 34,
  E: 24,
  D: 17,
  C: 11,
  B: 7,
  A: 4.5,
  S: 2.5,
};

export function rollItemGrade(
  random: () => number,
  minimum: ItemGrade = "F",
  maximum: ItemGrade = "S",
): ItemGrade {
  const start = Math.min(itemGradeIndex(minimum), itemGradeIndex(maximum));
  const end = Math.max(itemGradeIndex(minimum), itemGradeIndex(maximum));
  const candidates = ITEM_GRADES.slice(start, end + 1);
  const total = candidates.reduce(
    (sum, grade) => sum + NATURAL_GRADE_WEIGHTS[grade],
    0,
  );
  let roll = Math.max(0, Math.min(0.999999999, random())) * total;
  for (const grade of candidates) {
    roll -= NATURAL_GRADE_WEIGHTS[grade];
    if (roll < 0) return grade;
  }
  return candidates[candidates.length - 1] ?? minimum;
}

/**
 * Equipment owns a persisted grade. Stackable items receive a stable display
 * grade from their category/floor so every occupied slot uses the same F-S
 * color language without inventing per-stack instances.
 */
export function resolveItemGrade(
  definition: ItemDefinition | undefined,
  instance?: InventoryInstance | null,
): ItemGrade {
  if (instance?.grade) return normalizeItemGrade(instance.grade);
  const legacyQuality = (instance as InventoryInstance & { quality?: number } | null)
    ?.quality;
  if (legacyQuality !== undefined) return legacyQualityToGrade(legacyQuality);
  if (!definition) return "F";
  if (definition.category === "artifact") return "S";
  if (definition.category === "scroll" || definition.category === "elixir") {
    return "B";
  }
  if (definition.category === "wand" || definition.category === "ring") {
    const floor = definition.minFloor ?? 1;
    return ITEM_GRADES[Math.max(2, Math.min(5, Math.ceil(floor / 2) + 1))];
  }
  if ((definition.minFloor ?? 1) >= 6) return "A";
  if ((definition.minFloor ?? 1) >= 3) return "C";
  if (["brew", "bomb", "stone", "missile"].includes(definition.category)) {
    return "E";
  }
  return "F";
}
