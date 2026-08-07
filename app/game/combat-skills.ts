import { linePoints } from "./targeting";
import type { Point, StatusEffectId } from "./types";

export type CombatSkillTravelMode = "none" | "leap" | "teleport" | "charge";
export type CombatSkillImpactMode =
  | "burst" | "shockwave" | "fragments" | "thrust"
  | "slash" | "healing" | "sigil" | "drain";
export type CombatSkillAreaAnchor = "caster" | "target";
export type CombatSkillMechanicTag =
  | "area" | "chain" | "cloud" | "conductive" | "equipment"
  | "healing" | "line" | "movement" | "push" | "status"
  | "summon" | "threshold" | "weapon";
export type CombatSkillScalarKey =
  | "power" | "secondaryPower" | "radius" | "pushDistance"
  | "statusTurns" | "durationTurns" | "hitCount" | "targetCount"
  | "chainRange" | "thresholdRatio" | "healRatio";
export type CombatSkillScalars = Readonly<Partial<Record<CombatSkillScalarKey, number>>>;
export type CombatSkillSpecialEffect =
  | { id: string; kind: "damage"; target: "target" | "area"; power: number; radius?: number }
  | { id: string; kind: "status"; target: "target" | "area"; statusId: StatusEffectId; turns: number; potency?: number; radius?: number }
  | { id: string; kind: "healing"; target: "caster"; ratio: number };

export type CombatSkillBlueprint<SkillId extends string = string> = {
  id: SkillId;
  name: string;
  description: string;
  range: number;
  cooldown: number;
  accent: string;
  travelMode: CombatSkillTravelMode;
  impactMode: CombatSkillImpactMode;
  areaAnchor: CombatSkillAreaAnchor;
  mechanics: readonly CombatSkillMechanicTag[];
  scalars: CombatSkillScalars;
  specialEffects: readonly CombatSkillSpecialEffect[];
  footprint: "target" | "burst" | "line" | "path";
};

const uniquePoints = (points: readonly Point[]) => {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** The single source of truth for telegraph previews and skill impact tiles. */
export const resolveCombatSkillAffectedTiles = (
  blueprint: Pick<CombatSkillBlueprint, "footprint" | "scalars">,
  caster: Point,
  target: Point,
): Point[] => {
  if (blueprint.footprint === "line" || blueprint.footprint === "path") {
    return linePoints(caster, target).slice(blueprint.footprint === "line" ? 1 : 0);
  }
  if (blueprint.footprint !== "burst") return [{ ...target }];
  const radius = Math.max(0, Math.floor(blueprint.scalars.radius ?? 1));
  const tiles: Point[] = [];
  for (let y = target.y - radius; y <= target.y + radius; y += 1) {
    for (let x = target.x - radius; x <= target.x + radius; x += 1) {
      if (Math.max(Math.abs(x - target.x), Math.abs(y - target.y)) <= radius) {
        tiles.push({ x, y });
      }
    }
  }
  return uniquePoints(tiles);
};

export type CombatSkillExecutionAdapter = {
  onMove?: (destination: Point, travelMode: CombatSkillTravelMode) => void;
  onImpact: (affectedTiles: readonly Point[]) => void;
};

/** Shared execution kernel. Actor-specific state mutation stays in adapters. */
export const executeCombatSkillCore = (
  blueprint: CombatSkillBlueprint,
  caster: Point,
  target: Point,
  adapter: CombatSkillExecutionAdapter,
  lockedAffectedTiles?: readonly Point[],
) => {
  const affectedTiles = lockedAffectedTiles
    ? lockedAffectedTiles.map((point) => ({ ...point }))
    : resolveCombatSkillAffectedTiles(blueprint, caster, target);
  if (blueprint.travelMode !== "none") {
    adapter.onMove?.({ ...target }, blueprint.travelMode);
  }
  adapter.onImpact(affectedTiles);
  return affectedTiles;
};
