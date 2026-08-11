import type { CombatStats } from "./types";

export const DEFAULT_CRITICAL_CHANCE = 0.01;
export const DEFAULT_CRITICAL_DAMAGE_BONUS = 0.5;
export const DEFAULT_LIFE_STEAL = 0;
export const DEFAULT_ARMOR_PENETRATION = 0;
export const DEFAULT_COOLDOWN_REDUCTION = 0;
export const DEFAULT_STATUS_RESISTANCE = 0;

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
  armorPenetration: Math.min(
    1,
    Math.max(0, finiteOr(stats?.armorPenetration, DEFAULT_ARMOR_PENETRATION)),
  ),
  cooldownReduction: Math.min(
    1,
    Math.max(0, finiteOr(stats?.cooldownReduction, DEFAULT_COOLDOWN_REDUCTION)),
  ),
  statusResistance: Math.min(
    1,
    Math.max(0, finiteOr(stats?.statusResistance, DEFAULT_STATUS_RESISTANCE)),
  ),
});

export const getCriticalChance = (actor: Partial<CombatStats>) =>
  normalizeCombatStats(actor).criticalChance;

export const getCriticalDamageBonus = (actor: Partial<CombatStats>) =>
  normalizeCombatStats(actor).criticalDamageBonus;

export const getLifeSteal = (actor: Partial<CombatStats>) =>
  normalizeCombatStats(actor).lifeSteal;

export const getArmorPenetration = (actor: Partial<CombatStats>) =>
  normalizeCombatStats(actor).armorPenetration;

export const getCooldownReduction = (actor: Partial<CombatStats>) =>
  normalizeCombatStats(actor).cooldownReduction;

export const getStatusResistance = (actor: Partial<CombatStats>) =>
  normalizeCombatStats(actor).statusResistance;

export const effectiveDefense = (
  targetDefense: number,
  attacker: Partial<CombatStats> | null | undefined,
) => Math.max(0, finiteOr(targetDefense, 0)) * (1 - getArmorPenetration(attacker ?? {}));

export const effectiveCooldown = (
  baseCooldown: number,
  actor: Partial<CombatStats> | null | undefined,
) => Math.max(0, finiteOr(baseCooldown, 0)) * (1 - getCooldownReduction(actor ?? {}));

export const remainingCooldownTurns = (remainingCooldown: number) =>
  Math.max(0, Math.ceil(finiteOr(remainingCooldown, 0)));

export const formatCombatPercent = (value: number) =>
  `${Math.round(Math.max(0, finiteOr(value, 0)) * 100)}%`;

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
  const lifeSteal = getLifeSteal(attacker);
  const healing = Math.min(
    Math.max(0, attacker.maxHp - attacker.hp),
    Math.floor(Math.max(0, actualHpDamage) * lifeSteal),
  );
  if (healing > 0) attacker.hp += healing;
  return healing;
};
