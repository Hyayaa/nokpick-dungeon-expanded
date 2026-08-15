import type {
  ActionInteractionKind,
  CombatEffect,
  Motion,
} from "../game/types";

export const MIN_ACTION_DURATION = 112;
// 160ms / 1.3: faster presentation only; the movement-speed stat is unchanged.
export const PLAYER_MOVE_DURATION = 123;
export const ENEMY_MOVE_DURATION = 100;
export const PLAYER_ATTACK_DURATION = 60;
export const ENEMY_ATTACK_DURATION = 160;
// Allies share the player's travel cadence so a 180ms follower animation does
// not leave the player standing still for 57ms at the end of every tile.
export const COMPANION_MOVE_DURATION = PLAYER_MOVE_DURATION;
// Playable companions use the same four-frame character attack cycle.
export const COMPANION_ATTACK_DURATION = PLAYER_ATTACK_DURATION;
export const SKILL_LEAP_DURATION = 260;
export const SKILL_TELEPORT_DURATION = 220;
export const SKILL_CHARGE_DURATION = 160;
export const PLAYER_INTERACTION_DURATION = 360;
export const PLAYER_PICKUP_DURATION = 50;
export const ATTACK_START_DELAY = 70;
export const ATTACK_SEQUENCE_GAP = 45;
export const DEATH_EVENT_DELAY = 40;
export const DEATH_SECONDARY_EFFECT_DELAY = 80;

export const durationForInteraction = (
  kind: ActionInteractionKind | undefined,
) => kind === "pickup"
  ? PLAYER_PICKUP_DURATION
  : PLAYER_INTERACTION_DURATION;

export type ScheduledMotion = {
  motion: Motion;
  delay: number;
  duration: number;
};

export type TurnMotionTimeline = {
  motions: ScheduledMotion[];
  totalDuration: number;
};

export const durationForMotion = (motion: Motion) => {
  if (motion.kind === "attack") {
    if (motion.id.startsWith("companion-")) {
      return COMPANION_ATTACK_DURATION;
    }
    return motion.id === "player"
      ? PLAYER_ATTACK_DURATION
      : ENEMY_ATTACK_DURATION;
  }
  if (motion.kind === "move") {
    if (motion.travelStyle === "leap") return SKILL_LEAP_DURATION;
    if (motion.travelStyle === "teleport") return SKILL_TELEPORT_DURATION;
    if (motion.travelStyle === "charge") return SKILL_CHARGE_DURATION;
    if (motion.id.startsWith("companion-")) {
      return COMPANION_MOVE_DURATION;
    }
    return motion.id === "player"
      ? PLAYER_MOVE_DURATION
      : ENEMY_MOVE_DURATION;
  }
  if (motion.kind === "interact") {
    return PLAYER_INTERACTION_DURATION;
  }
  return MIN_ACTION_DURATION;
};

export const impactDelayForMotion = (motion: Motion) => {
  const duration = durationForMotion(motion);
  if (motion.kind !== "move") return duration * 0.52;
  if (motion.travelStyle === "teleport") return duration * 0.62;
  if (
    motion.travelStyle === "leap" ||
    motion.travelStyle === "charge"
  ) {
    return Math.max(0, duration - 10);
  }
  return duration;
};

export const presentationOffsetForCombatEffect = (effect: CombatEffect) => {
  const deathChainDepth = Math.max(0, effect.deathChainDepth ?? 0);
  const causalOffset =
    deathChainDepth *
    (DEATH_EVENT_DELAY + DEATH_SECONDARY_EFFECT_DELAY);
  return causalOffset + (effect.kind === "defeat" ? DEATH_EVENT_DELAY : 0);
};

export const impactTimeForSource = (
  sourceId: string | undefined,
  schedules: readonly ReadonlyMap<string, number>[],
  fallback = 0,
) => {
  if (!sourceId) return fallback;
  for (const schedule of schedules) {
    const impactAt = schedule.get(sourceId);
    if (impactAt !== undefined) return impactAt;
  }
  return fallback;
};

export const worldRevealOffsetForDefeat = (effect: CombatEffect) =>
  presentationOffsetForCombatEffect(effect) +
  DEATH_SECONDARY_EFFECT_DELAY +
  DEATH_EVENT_DELAY;

export function createTurnMotionTimeline(
  motions: Motion[],
  initialPhaseEnd = 0,
): TurnMotionTimeline {
  const movement = motions.filter((motion) => motion.kind !== "attack");
  const attacks = motions.filter((motion) => motion.kind === "attack");
  const scheduled: ScheduledMotion[] = movement.map((motion) => ({
    motion,
    delay: 0,
    duration: durationForMotion(motion),
  }));
  const movementEnd = movement.reduce(
    (latest, motion) => Math.max(latest, durationForMotion(motion)),
    0,
  );

  let cursor = Math.max(initialPhaseEnd, movementEnd);
  if (attacks.length) cursor += ATTACK_START_DELAY;

  attacks.forEach((motion, index) => {
    const duration = durationForMotion(motion);
    scheduled.push({ motion, delay: cursor, duration });
    cursor += duration;
    if (index < attacks.length - 1) cursor += ATTACK_SEQUENCE_GAP;
  });

  return {
    motions: scheduled,
    totalDuration: Math.max(
      MIN_ACTION_DURATION,
      initialPhaseEnd,
      movementEnd,
      cursor,
    ),
  };
}
