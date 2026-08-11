import {
  equipmentCombatStatProfile,
  formatRatePercent,
} from "./equipment";
import type { CombatStats, InventoryInstance } from "./types";

export const DEFAULT_CRITICAL_CHANCE = 0.01;
export const DEFAULT_CRITICAL_DAMAGE_BONUS = 0.5;
export const DEFAULT_LIFE_STEAL = 0;
export const DEFAULT_ARMOR_PENETRATION = 0;
export const DEFAULT_COOLDOWN_REDUCTION = 0;
export const DEFAULT_STATUS_RESISTANCE = 0;

const finiteOr = (value: number | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const addRate = (base: number, bonus: number) =>
  Math.round((base + bonus) * 1_000_000) / 1_000_000;

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

const equippedCombatStatBonus = (
  actor: Partial<CombatStats> | null | undefined,
) => {
  const equipmentInstances = (
    actor as Partial<{
      equipmentInstances: Record<string, InventoryInstance | null | undefined>;
    }> | null | undefined
  )?.equipmentInstances;
  return Object.values(equipmentInstances ?? {}).reduce(
    (total, instance) => {
      const bonus = equipmentCombatStatProfile(instance);
      total.criticalChance += bonus.criticalChance;
      total.criticalDamageBonus += bonus.criticalDamageBonus;
      total.lifeSteal += bonus.lifeSteal;
      total.armorPenetration += bonus.armorPenetration;
      total.cooldownReduction += bonus.cooldownReduction;
      total.statusResistance += bonus.statusResistance;
      return total;
    },
    {
      criticalChance: 0,
      criticalDamageBonus: 0,
      lifeSteal: 0,
      armorPenetration: 0,
      cooldownReduction: 0,
      statusResistance: 0,
    } satisfies CombatStats,
  );
};

export const effectiveCombatStats = (
  actor: Partial<CombatStats> | null | undefined,
): CombatStats => {
  const base = normalizeCombatStats(actor);
  const equipment = equippedCombatStatBonus(actor);
  return normalizeCombatStats({
    criticalChance: addRate(base.criticalChance, equipment.criticalChance),
    criticalDamageBonus: addRate(
      base.criticalDamageBonus,
      equipment.criticalDamageBonus,
    ),
    lifeSteal: addRate(base.lifeSteal, equipment.lifeSteal),
    armorPenetration: addRate(
      base.armorPenetration,
      equipment.armorPenetration,
    ),
    cooldownReduction: addRate(
      base.cooldownReduction,
      equipment.cooldownReduction,
    ),
    statusResistance: addRate(
      base.statusResistance,
      equipment.statusResistance,
    ),
  });
};

export const getCriticalChance = (actor: Partial<CombatStats>) =>
  effectiveCombatStats(actor).criticalChance;

export const getCriticalDamageBonus = (actor: Partial<CombatStats>) =>
  effectiveCombatStats(actor).criticalDamageBonus;

export const getLifeSteal = (actor: Partial<CombatStats>) =>
  effectiveCombatStats(actor).lifeSteal;

export const getArmorPenetration = (actor: Partial<CombatStats>) =>
  effectiveCombatStats(actor).armorPenetration;

export const getCooldownReduction = (actor: Partial<CombatStats>) =>
  effectiveCombatStats(actor).cooldownReduction;

export const getStatusResistance = (actor: Partial<CombatStats>) =>
  effectiveCombatStats(actor).statusResistance;

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
  formatRatePercent(finiteOr(value, 0));

export const resolveCriticalDamage = (
  normalDamage: number,
  attacker: Partial<CombatStats> | null | undefined,
  roll: number,
) => {
  const damage = Math.max(0, Math.round(normalDamage));
  const stats = effectiveCombatStats(attacker);
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
