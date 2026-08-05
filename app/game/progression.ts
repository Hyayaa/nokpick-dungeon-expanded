export const CAMPAIGN_MINUTES = {
  minimum: 40,
  maximum: 90,
} as const;

export const MAX_PLAYER_LEVEL = 50;
// Balance target for the combined equipment + augment progression. Levels
// unlock augment choices, but never multiply actor statistics on their own.
export const PLANNED_ENDGAME_POWER_MULTIPLIER = 1_000;
export const LEVEL_XP_REQUIREMENT_MULTIPLIER = 5;

// Levels grant augment choices rather than raw statistics. The fivefold
// requirement spaces those choices across a full 40–90 minute run instead of
// clustering them near the entrance floors.
export const experienceForNextLevel = (level: number) =>
  level >= MAX_PLAYER_LEVEL
    ? 0
    : (10 + Math.floor(Math.max(1, level) / 4)) *
      LEVEL_XP_REQUIREMENT_MULTIPLIER;
