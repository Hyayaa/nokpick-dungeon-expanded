import { getStatusResistance } from "./combat-stats";
import { random } from "./random";
import type {
  CombatStats,
  GameState,
  Point,
  StatusEffect,
  StatusEffectId,
} from "./types";

export const HARMFUL_STATUS_IDS = new Set<StatusEffectId>([
  "burning",
  "chilled",
  "frozen",
  "paralyzed",
  "poisoned",
  "corroded",
  "blinded",
  "terrified",
  "charmed",
  "corrupted",
  "rooted",
  "bleeding",
  "crippled",
  "weakened",
  "vulnerable",
  "hexed",
  "degraded",
]);

export const isHarmfulStatus = (id: StatusEffectId) =>
  HARMFUL_STATUS_IDS.has(id);

type StatusTarget = Point & Partial<CombatStats> & {
  statuses: StatusEffect[];
};

export type StatusApplicationResult = {
  applied: boolean;
  resisted: boolean;
};

export const tryApplyStatus = (
  state: GameState,
  target: StatusTarget,
  id: StatusEffectId,
  turns: number,
  power = 1,
): StatusApplicationResult => {
  if (isHarmfulStatus(id)) {
    const resistance = getStatusResistance(target);
    if (resistance >= 1) return { applied: false, resisted: true };
    if (resistance > 0 && random(state) < resistance) {
      return { applied: false, resisted: true };
    }
  }

  const existing = target.statuses.find((status) => status.id === id);
  if (existing) {
    existing.turns = Math.max(existing.turns, turns);
    existing.power = Math.max(existing.power, power);
  } else {
    target.statuses.push({ id, turns, power });
  }
  return { applied: true, resisted: false };
};
