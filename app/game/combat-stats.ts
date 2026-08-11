import type { CombatStats } from "./types";

export const DEFAULT_CRITICAL_CHANCE = 0.01;
export const DEFAULT_CRITICAL_DAMAGE_BONUS = 0.5;
export const DEFAULT_LIFE_STEAL = 0;

const finiteOr = (value: number | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const normalizeCombatStats = (
  stats: Partial<CombatStats> | null | undefined,
): CombatStats => ({
  criticalChance: Math.min(
    1,
    Math.max(0, finiteOr(stats?.criticalChance, DEFAULT_CRITICAL_CHANCE)),
  ),
  criticalDamageBonus: Math.max(
    0,
    finiteOr(stats?.criticalDamageBonus, DEFAULT_CRITICAL_DAMAGE_BONUS),
  ),
  lifeSteal: Math.max(0, finiteOr(stats?.lifeSteal, DEFAULT_LIFE_STEAL)),
});

export const resolveCriticalDamage = (
  normalDamage: number,
  attacker: Partial<CombatStats> | null | undefined,
  roll: number,
) => {
  const damage = Math.max(0, Math.round(normalDamage));
  const stats = normalizeCombatStats(attacker);
  const critical = Math.min(1, Math.max(0, roll)) < stats.criticalChance;
  return {
    damage: critical
      ? Math.round(damage * (1 + stats.criticalDamageBonus))
      : damage,
    critical,
  };
};

export const applyLifeSteal = (
  attacker: Partial<CombatStats> & { hp: number; maxHp: number },
  actualHpDamage: number,
) => {
  const { lifeSteal } = normalizeCombatStats(attacker);
  const healing = Math.min(
    Math.max(0, attacker.maxHp - attacker.hp),
    Math.floor(Math.max(0, actualHpDamage) * lifeSteal),
  );
  if (healing > 0) attacker.hp += healing;
  return healing;
};
