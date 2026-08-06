export const CAMPAIGN_MINUTES = {
  minimum: 40,
  maximum: 90,
} as const;

export const MAX_PLAYER_LEVEL = 50;
// Balance target for the combined equipment + progression curve.
export const PLANNED_ENDGAME_POWER_MULTIPLIER = 1_000;
export const LEVEL_XP_REQUIREMENT_MULTIPLIER = 5;
export const LEVEL_XP_REQUIREMENT_GROWTH = 1.15;
export const LEVEL_STAT_GROWTH = 1.1;

// Level two keeps the established 50-XP threshold. Every later requirement is
// fifteen percent higher than the previous level's requirement.
export const experienceForNextLevel = (level: number) =>
  level >= MAX_PLAYER_LEVEL
    ? 0
    : Math.ceil(
        10 *
          LEVEL_XP_REQUIREMENT_MULTIPLIER *
          LEVEL_XP_REQUIREMENT_GROWTH ** (Math.max(1, level) - 1),
      );
