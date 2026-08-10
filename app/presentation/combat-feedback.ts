import { CombatEffect } from "../game/types";

export const isDamageEffect = (effect: CombatEffect) =>
  effect.kind === "damage";

export const isImpactEffect = (effect: CombatEffect) =>
  effect.kind === "damage" || effect.kind === "blocked";

export const isDefeatEffect = (effect: CombatEffect) =>
  effect.kind === "defeat";

export const timingSourceIdForEffect = (effect: CombatEffect) =>
  effect.timingSourceId ?? effect.sourceId;

export const groundItemComesFromDefeatedEnemy = (
  itemId: string,
  enemyId: string,
) =>
  itemId === `gold-drop-${enemyId}` ||
  itemId === `drop-${enemyId}` ||
  itemId.startsWith(`drop-${enemyId}-`) ||
  itemId === `boss-exit-key-${enemyId}`;
