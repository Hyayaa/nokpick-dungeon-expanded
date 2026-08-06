import { CombatEffect } from "../game/types";

export const isDamageEffect = (effect: CombatEffect) =>
  effect.kind === "damage";

export const isImpactEffect = (effect: CombatEffect) =>
  effect.kind === "damage" || effect.kind === "blocked";

export const isDefeatEffect = (effect: CombatEffect) =>
  effect.kind === "defeat";
