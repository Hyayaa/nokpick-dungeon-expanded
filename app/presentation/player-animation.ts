export const PLAYER_IDLE_FRAMES = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export const PLAYER_ATTACK_FRAMES = [8, 9, 10, 11] as const;
export const PLAYER_INTERACT_FRAMES = [12, 13, 14, 15] as const;
export const PLAYER_MOVE_FRAMES = [
  16, 17, 18, 19, 20, 21, 22, 23,
] as const;

export const CHARACTER_IDLE_FRAME_DURATION = 150;
export const CHARACTER_MOVE_FRAME_DURATION = 64;
export const CHARACTER_MOVE_CONTINUITY_GRACE = 48;

export type CharacterAnimationKind =
  | "idle"
  | "move"
  | "attack"
  | "interact"
  | "defeat";

export type CharacterMoveCycle = {
  startedAt: number;
  endsAt: number;
};

export type CharacterMoveCycleRuntime = Map<string, CharacterMoveCycle>;

export const registerCharacterMotionCycle = ({
  runtime,
  actorId,
  now,
  delay,
  duration,
  walking,
}: {
  runtime: CharacterMoveCycleRuntime;
  actorId: string;
  now: number;
  delay: number;
  duration: number;
  walking: boolean;
}) => {
  let motionStartedAt = now + delay;
  if (!walking) {
    runtime.delete(actorId);
    return motionStartedAt;
  }

  const previous = runtime.get(actorId);
  const continuesPreviousMove =
    previous !== undefined &&
    motionStartedAt >= previous.endsAt - CHARACTER_MOVE_CONTINUITY_GRACE &&
    motionStartedAt <= previous.endsAt + CHARACTER_MOVE_CONTINUITY_GRACE;
  if (continuesPreviousMove) {
    // Keep both interpolation and animation anchored to the prior tile's end.
    motionStartedAt = previous.endsAt;
  }
  runtime.set(actorId, {
    startedAt: continuesPreviousMove
      ? previous.startedAt
      : motionStartedAt,
    endsAt: motionStartedAt + duration,
  });
  return motionStartedAt;
};

const progressFrame = (
  frames: readonly number[],
  progress: number,
) =>
  frames[
    Math.min(
      frames.length - 1,
      Math.floor(Math.max(0, progress) * frames.length) % frames.length,
    )
  ] ?? frames[0];

export const resolveCharacterAnimationFrame = ({
  kind,
  now,
  progress = 0,
  moveCycleStartedAt = null,
}: {
  kind: CharacterAnimationKind;
  now: number;
  progress?: number;
  moveCycleStartedAt?: number | null;
}) => {
  if (kind === "defeat") return PLAYER_IDLE_FRAMES[0];
  if (kind === "attack") {
    return progressFrame(PLAYER_ATTACK_FRAMES, progress);
  }
  if (kind === "interact") {
    return progressFrame(PLAYER_INTERACT_FRAMES, progress);
  }
  if (kind === "move") {
    const cycleStartedAt =
      moveCycleStartedAt ?? now - progress * CHARACTER_MOVE_FRAME_DURATION;
    const frameProgress =
      Math.max(0, now - cycleStartedAt) / CHARACTER_MOVE_FRAME_DURATION;
    return PLAYER_MOVE_FRAMES[
      Math.floor(frameProgress) % PLAYER_MOVE_FRAMES.length
    ];
  }
  return PLAYER_IDLE_FRAMES[
    Math.floor(now / CHARACTER_IDLE_FRAME_DURATION) %
      PLAYER_IDLE_FRAMES.length
  ];
};
