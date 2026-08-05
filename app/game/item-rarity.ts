import { InventoryInstance, ItemDefinition } from "./types";

export type ItemRarity = 1 | 2 | 3 | 4 | 5;

const clampRarity = (value: number): ItemRarity =>
  Math.max(1, Math.min(5, Math.round(value))) as ItemRarity;

/**
 * Equipment keeps its persisted 1-5 quality as rarity. Stackable items do not
 * have a quality roll, so their category and first appearance floor provide a
 * stable fallback that remains unchanged when a save is reloaded.
 */
export function resolveItemRarity(
  definition: ItemDefinition | undefined,
  instance?: InventoryInstance | null,
): ItemRarity {
  if (instance?.quality !== undefined) {
    return clampRarity(instance.quality);
  }
  if (!definition) return 1;
  if (definition.category === "artifact") return 5;
  if (definition.category === "scroll" || definition.category === "elixir") {
    return 4;
  }
  if (definition.category === "wand" || definition.category === "ring") {
    return Math.max(3, clampRarity(Math.ceil((definition.minFloor ?? 1) / 2)));
  }
  if ((definition.minFloor ?? 1) >= 6) return 4;
  if ((definition.minFloor ?? 1) >= 3) return 3;
  if (["brew", "bomb", "stone", "missile"].includes(definition.category)) {
    return 2;
  }
  return 1;
}
