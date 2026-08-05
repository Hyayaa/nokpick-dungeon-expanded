import { ItemCategory } from "./types";

export type AlchemyIngredient = {
  itemRef: string;
  defId: string;
  category: ItemCategory;
  upgradeable: boolean;
};

export type AlchemyFormula =
  | {
      kind: "item";
      outputDefId: string;
      quantity: number;
    }
  | {
      kind: "enchant";
      targetItemRef: string;
      upgrade: boolean;
    };

type ItemFormula = {
  ingredients: string[];
  outputDefId: string;
  quantity?: number;
};

// Intentionally data-driven: more combinations can be appended without
// touching turn handling, inventory mutation, or the alchemy interface.
export const SIMPLE_ALCHEMY_RECIPES: readonly ItemFormula[] = [
  { ingredients: ["small_ration", "small_ration"], outputDefId: "ration" },
  { ingredients: ["mystery_meat", "mystery_meat"], outputDefId: "chargrilled_meat" },
  { ingredients: ["mystery_meat", "ration"], outputDefId: "pasty" },
  { ingredients: ["seed_sungrass", "seed_sungrass"], outputDefId: "potion_healing" },
  { ingredients: ["seed_icecap", "seed_icecap"], outputDefId: "potion_frost" },
  { ingredients: ["seed_firebloom", "seed_firebloom"], outputDefId: "potion_liquid_flame" },
  { ingredients: ["potion_healing", "potion_healing"], outputDefId: "potion_shielding" },
  { ingredients: ["potion_frost", "potion_frost"], outputDefId: "brew_blizzard" },
  { ingredients: ["potion_liquid_flame", "potion_liquid_flame"], outputDefId: "brew_infernal" },
  { ingredients: ["potion_liquid_flame", "potion_toxic_gas"], outputDefId: "brew_caustic" },
  { ingredients: ["scroll_identify", "scroll_identify"], outputDefId: "scroll_mapping" },
] as const;

export const ALCHEMY_ENCHANT_CATALYST_IDS = [
  "stone_enchantment",
  "scroll_enchantment",
  "stylus",
  "arcane_resin",
  "arcane_catalyst",
  "alchemical_catalyst",
] as const;

export const ALCHEMY_ENCHANT_RECIPES = [
  { id: "enchant", catalystCount: 1, upgrade: false },
  { id: "upgrade-enchant", catalystCount: 2, upgrade: true },
] as const;

const ENCHANT_CATALYSTS = new Set<string>(
  ALCHEMY_ENCHANT_CATALYST_IDS,
);

const formulaKey = (ids: string[]) => [...ids].sort().join("+");

const ITEM_FORMULAS = new Map(
  SIMPLE_ALCHEMY_RECIPES.map((recipe) => [
    formulaKey(recipe.ingredients),
    recipe,
  ]),
);

export const resolveAlchemyFormula = (
  ingredients: AlchemyIngredient[],
): AlchemyFormula | null => {
  if (ingredients.length < 2 || ingredients.length > 3) return null;
  const equipment = ingredients.filter((ingredient) => ingredient.upgradeable);
  const enchantRecipe = ALCHEMY_ENCHANT_RECIPES.find(
    (recipe) => recipe.catalystCount === ingredients.length - 1,
  );
  if (
    enchantRecipe &&
    equipment.length === 1 &&
    ingredients
      .filter((ingredient) => ingredient !== equipment[0])
      .every((ingredient) => ENCHANT_CATALYSTS.has(ingredient.defId))
  ) {
    return {
      kind: "enchant",
      targetItemRef: equipment[0].itemRef,
      upgrade: enchantRecipe.upgrade,
    };
  }
  const recipe = ITEM_FORMULAS.get(
    formulaKey(ingredients.map((ingredient) => ingredient.defId)),
  );
  return recipe
    ? {
        kind: "item",
        outputDefId: recipe.outputDefId,
        quantity: recipe.quantity ?? 1,
      }
    : null;
};
