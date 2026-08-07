import { ENEMY_DEFINITIONS } from "./enemy-definitions";
import type { EnemyKind, EnemyRegion } from "./types";

const SHAMANS: EnemyKind[] = ["shaman_red", "shaman_blue", "shaman_purple"];
const ELEMENTALS: EnemyKind[] = ["elemental_fire", "elemental_fire", "elemental_frost", "elemental_frost", "elemental_shock"];

const ROTATIONS: Readonly<Record<EnemyRegion, readonly (readonly EnemyKind[])[]>> = {
  sewers: [
    ["rat","rat","rat","snake"],
    ["rat","rat","snake","gnoll","gnoll"],
    ["rat","snake","gnoll","gnoll","gnoll","swarm","crab"],
    ["gnoll","swarm","crab","crab","slime","slime"],
    ["gnoll","swarm","crab","crab","slime","slime"],
  ],
  prison: [
    ["skeleton","skeleton","skeleton","thief","swarm"],
    ["skeleton","skeleton","skeleton","thief","dm100","guard"],
    ["skeleton","skeleton","thief","dm100","dm100","guard","guard","necromancer"],
    ["skeleton","thief","dm100","dm100","guard","guard","necromancer","necromancer"],
    ["skeleton","thief","dm100","dm100","guard","guard","necromancer","necromancer"],
  ],
  caves: [
    ["bat","bat","bat","brute","shaman_red"],
    ["bat","bat","brute","brute","shaman_red","spinner"],
    ["bat","brute","brute","shaman_red","shaman_red","spinner","spinner","dm200"],
    ["bat","brute","shaman_red","shaman_red","spinner","spinner","dm200","dm200"],
    ["bat","brute","shaman_red","shaman_red","spinner","spinner","dm200","dm200"],
  ],
  city: [
    ["ghoul","ghoul","ghoul","elemental_fire","warlock"],
    ["ghoul","elemental_fire","elemental_fire","warlock","monk"],
    ["ghoul","elemental_fire","warlock","warlock","monk","monk","golem"],
    ["elemental_fire","warlock","warlock","monk","monk","golem","golem","golem"],
    ["elemental_fire","warlock","warlock","monk","monk","golem","golem","golem"],
  ],
  halls: [
    ["succubus","succubus","eye"],
    ["succubus","eye"],
    ["succubus","eye","eye","scorpio"],
    ["succubus","eye","eye","scorpio","scorpio","scorpio"],
    ["succubus","eye","eye","scorpio","scorpio","scorpio"],
  ],
};

export const enemyRegionForDifficulty = (difficulty: number): EnemyRegion => {
  if (difficulty <= 2) return "sewers";
  if (difficulty === 3) return "prison";
  if (difficulty === 4) return "caves";
  if (difficulty <= 6) return "city";
  return "halls";
};

export const relativeEnemyStage = (floor: number, maxFloor: number) =>
  Math.max(0, Math.min(4, Math.floor(((Math.max(1, floor) - 1) * 5) / Math.max(1, maxFloor))));

export const enemyRotation = (region: EnemyRegion, stage: number) =>
  ROTATIONS[region][Math.max(0, Math.min(4, stage))];

const choose = <T>(values: readonly T[], roll: () => number) =>
  values[Math.min(values.length - 1, Math.floor(roll() * values.length))];

export const chooseEnemyForSpawn = (
  region: EnemyRegion,
  stage: number,
  roll: () => number,
): EnemyKind => {
  let base = choose(enemyRotation(region, stage), roll);
  if (base === "shaman_red") base = choose(SHAMANS, roll);
  if (base === "elemental_fire") base = choose(ELEMENTALS, roll);

  // Shattered PD chooses a normal mob first, then rarely substitutes its alt.
  const rareAlt = ENEMY_DEFINITIONS[base].rareAlt;
  if (rareAlt && roll() < 0.02) return rareAlt;
  return base;
};

/** Fixed encounter producers replace a normal slot, preserving floor density. */
export const fixedEnemyForSpawnSlot = (
  region: EnemyRegion,
  stage: number,
  index: number,
): EnemyKind | null =>
  region === "halls" && stage >= 3 && index === 0 ? "demon_spawner" : null;

export const ENEMY_ROTATIONS = ROTATIONS;
