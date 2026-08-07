import {
  COMPANION_SKILLS,
  type CompanionSkillDefinition,
} from "./companion-skills";
import type { CompanionSkillId } from "./types";
import type {
  CombatSkillAreaAnchor,
  CombatSkillBlueprint,
  CombatSkillImpactMode,
  CombatSkillMechanicTag,
  CombatSkillScalarKey,
  CombatSkillScalars,
  CombatSkillSpecialEffect,
  CombatSkillTravelMode,
} from "./combat-skills";

export type CompanionSkillTravelMode = CombatSkillTravelMode;

export type CompanionSkillImpactMode = CombatSkillImpactMode;

export type CompanionSkillAreaAnchor = CombatSkillAreaAnchor;

export type CompanionSkillMechanicTag = CombatSkillMechanicTag;

export type CompanionSkillScalarKey = CombatSkillScalarKey;

export type CompanionSkillScalars = CombatSkillScalars;

export type CompanionSkillSpecialEffect = CombatSkillSpecialEffect;

export type CompanionSkillBlueprint = CompanionSkillDefinition &
  Omit<CombatSkillBlueprint<CompanionSkillId>, keyof CompanionSkillDefinition | "footprint" | "name" | "description">;

export type CompanionSkillScalarModifier = {
  add?: number;
  multiply?: number;
  set?: number;
};

/**
 * A data-only modifier used by future skill ranks, equipment bonuses, and
 * derived skills. Game state can keep storing the stable base skill id while
 * callers compose one or more modifiers for the current execution.
 */
export type CompanionSkillModifier = {
  id: string;
  scalarChanges?: Readonly<
    Partial<Record<CompanionSkillScalarKey, CompanionSkillScalarModifier>>
  >;
  addMechanics?: readonly CompanionSkillMechanicTag[];
  removeMechanics?: readonly CompanionSkillMechanicTag[];
  travelMode?: CompanionSkillTravelMode;
  impactMode?: CompanionSkillImpactMode;
  areaAnchor?: CompanionSkillAreaAnchor;
  accent?: string;
  addSpecialEffects?: readonly CompanionSkillSpecialEffect[];
  removeSpecialEffectIds?: readonly string[];
};

type CompanionSkillBehavior = Pick<
  CompanionSkillBlueprint,
  "travelMode" | "impactMode" | "mechanics" | "scalars"
> & { areaAnchor?: CompanionSkillAreaAnchor };

const COMPANION_SKILL_BEHAVIORS: Readonly<
  Record<CompanionSkillId, CompanionSkillBehavior>
> = {
  shockLeap: {
    travelMode: "leap",
    impactMode: "shockwave",
    mechanics: ["movement", "area", "conductive"],
    scalars: { power: 1.6, radius: 1 },
  },
  drivingLeap: {
    travelMode: "leap",
    impactMode: "shockwave",
    mechanics: ["movement", "push"],
    scalars: { power: 1.3, pushDistance: 2 },
  },
  fireball: {
    travelMode: "none",
    impactMode: "burst",
    mechanics: ["area", "cloud", "status"],
    scalars: { power: 1.2, radius: 1, statusTurns: 4, durationTurns: 5 },
  },
  weaponThrow: {
    travelMode: "none",
    impactMode: "thrust",
    mechanics: ["weapon", "equipment"],
    scalars: { power: 5 },
  },
  arcaneDischarge: {
    travelMode: "none",
    impactMode: "thrust",
    mechanics: ["equipment"],
    scalars: { power: 1 },
  },
  whirlwind: {
    travelMode: "none",
    impactMode: "slash",
    areaAnchor: "caster",
    mechanics: ["area"],
    scalars: { power: 1.4, radius: 1 },
  },
  piercingShot: {
    travelMode: "none",
    impactMode: "thrust",
    mechanics: ["line"],
    scalars: { power: 1.8 },
  },
  chainLightning: {
    travelMode: "none",
    impactMode: "fragments",
    mechanics: ["chain", "conductive"],
    scalars: { power: 1.5, secondaryPower: 1, targetCount: 3, chainRange: 3 },
  },
  frostNova: {
    travelMode: "none",
    impactMode: "shockwave",
    mechanics: ["area", "cloud", "status"],
    scalars: { power: 1.1, radius: 1, statusTurns: 2, durationTurns: 4 },
  },
  toxicOrb: {
    travelMode: "none",
    impactMode: "fragments",
    mechanics: ["cloud", "status"],
    scalars: { radius: 2, durationTurns: 6 },
  },
  corrosiveFlask: {
    travelMode: "none",
    impactMode: "fragments",
    mechanics: ["cloud", "status"],
    scalars: { radius: 2, durationTurns: 6 },
  },
  entanglingRoots: {
    travelMode: "none",
    impactMode: "fragments",
    mechanics: ["area", "status"],
    scalars: { power: 0.8, radius: 2, statusTurns: 3 },
  },
  shadowStep: {
    travelMode: "teleport",
    impactMode: "fragments",
    mechanics: ["movement", "area"],
    scalars: { power: 1.7, radius: 1 },
  },
  execute: {
    travelMode: "none",
    impactMode: "slash",
    mechanics: ["threshold"],
    scalars: { power: 1.5, secondaryPower: 4, thresholdRatio: 0.4 },
  },
  shieldCharge: {
    travelMode: "charge",
    impactMode: "shockwave",
    mechanics: ["movement", "push", "status"],
    scalars: { power: 1, secondaryPower: 1.8, pushDistance: 3, statusTurns: 2 },
  },
  fieldMedicine: {
    travelMode: "none",
    impactMode: "healing",
    mechanics: ["healing"],
    scalars: { healRatio: 0.5 },
  },
  wardingSigil: {
    travelMode: "none",
    impactMode: "sigil",
    mechanics: ["summon"],
    scalars: { durationTurns: 6 },
  },
  tripleStrike: {
    travelMode: "none",
    impactMode: "slash",
    mechanics: [],
    scalars: { power: 0.75, hitCount: 3 },
  },
  seismicSlam: {
    travelMode: "none",
    impactMode: "shockwave",
    mechanics: ["area", "status"],
    scalars: { power: 1.25, radius: 2, statusTurns: 1 },
  },
  lifeDrain: {
    travelMode: "none",
    impactMode: "drain",
    mechanics: ["healing"],
    scalars: { power: 1.5, healRatio: 0.5 },
  },
};

export const companionSkillScalar = (
  blueprint: Pick<CompanionSkillBlueprint, "scalars">,
  key: CompanionSkillScalarKey,
  fallback = 0,
) => blueprint.scalars[key] ?? fallback;

export const companionSkillBlueprint = (
  skillId: CompanionSkillId,
): CompanionSkillBlueprint => {
  const behavior = COMPANION_SKILL_BEHAVIORS[skillId];
  return {
    ...COMPANION_SKILLS[skillId],
    ...behavior,
    areaAnchor: behavior.areaAnchor ?? "target",
    mechanics: [...behavior.mechanics],
    scalars: { ...behavior.scalars },
    specialEffects: [],
  };
};

const modifyScalar = (
  current: number,
  modifier: CompanionSkillScalarModifier,
) => {
  if (modifier.set !== undefined) return modifier.set;
  return (current + (modifier.add ?? 0)) * (modifier.multiply ?? 1);
};

export const deriveCompanionSkill = (
  skillId: CompanionSkillId,
  modifiers: readonly CompanionSkillModifier[],
): CompanionSkillBlueprint => {
  const derived = companionSkillBlueprint(skillId);
  const mechanics = new Set(derived.mechanics);
  const scalars: Partial<Record<CompanionSkillScalarKey, number>> = {
    ...derived.scalars,
  };
  const specialEffects = new Map(
    derived.specialEffects.map((effect) => [effect.id, effect]),
  );
  let travelMode = derived.travelMode;
  let impactMode = derived.impactMode;
  let areaAnchor = derived.areaAnchor;
  let accent = derived.accent;

  for (const modifier of modifiers) {
    modifier.removeMechanics?.forEach((tag) => mechanics.delete(tag));
    modifier.addMechanics?.forEach((tag) => mechanics.add(tag));
    if (modifier.travelMode) travelMode = modifier.travelMode;
    if (modifier.impactMode) impactMode = modifier.impactMode;
    if (modifier.areaAnchor) areaAnchor = modifier.areaAnchor;
    if (modifier.accent) accent = modifier.accent;
    modifier.removeSpecialEffectIds?.forEach((id) => specialEffects.delete(id));
    modifier.addSpecialEffects?.forEach((effect) => {
      specialEffects.set(effect.id, effect);
    });
    for (const [key, change] of Object.entries(
      modifier.scalarChanges ?? {},
    ) as [CompanionSkillScalarKey, CompanionSkillScalarModifier][]) {
      scalars[key] = modifyScalar(scalars[key] ?? 0, change);
    }
  }

  return {
    ...derived,
    travelMode,
    impactMode,
    areaAnchor,
    accent,
    mechanics: [...mechanics],
    scalars,
    specialEffects: [...specialEffects.values()],
  };
};
