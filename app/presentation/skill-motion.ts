import type { Motion, MotionTravelStyle } from "../game/types";

export type TravelMotionSample = {
  positionProgress: number;
  spriteLift: number;
  opacity: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Presentation-only sampling for semantic skill travel. Rules still emit an
 * ordinary move motion so turn ordering and save data remain unchanged.
 */
export function sampleTravelMotion(
  style: MotionTravelStyle | undefined,
  rawProgress: number,
): TravelMotionSample {
  const progress = clamp01(rawProgress);
  if (style === "leap") {
    return {
      positionProgress: progress * progress * (3 - 2 * progress),
      spriteLift: Math.sin(progress * Math.PI) * 0.42,
      opacity: 1,
    };
  }
  if (style === "teleport") {
    const opacity =
      progress < 0.42
        ? 1 - progress / 0.42
        : progress > 0.58
          ? (progress - 0.58) / 0.42
          : 0;
    return {
      positionProgress: progress < 0.5 ? 0 : 1,
      spriteLift: 0,
      opacity: clamp01(opacity),
    };
  }
  if (style === "charge") {
    return {
      positionProgress: 1 - (1 - progress) ** 2.4,
      spriteLift: 0,
      opacity: 1,
    };
  }
  return { positionProgress: progress, spriteLift: 0, opacity: 1 };
}

export const motionUsesRunFrames = (motion: Motion | null | undefined) =>
  motion?.kind === "move" &&
  (motion.travelStyle === undefined ||
    motion.travelStyle === "walk" ||
    motion.travelStyle === "charge");
