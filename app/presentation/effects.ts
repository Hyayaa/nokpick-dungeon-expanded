export type EffectTrajectory = {
  velocityX: number;
  velocityY: number;
  gravity: number;
  originOffsetX: number;
  originOffsetY: number;
};

type HoldableTurnSignal = {
  holdUntilTurnEnd?: boolean;
  releasedAt?: number;
};

export function releaseHeldSignalsAtTurnStart<
  Signal extends HoldableTurnSignal,
>(signals: Signal[], startedAt: number) {
  signals.forEach((signal) => {
    if (signal.holdUntilTurnEnd && signal.releasedAt === undefined) {
      signal.releasedAt = startedAt;
    }
  });
}

export function createEffectTrajectories(
  count: number,
  random: () => number = Math.random,
): EffectTrajectory[] {
  if (count <= 0) return [];

  const centerOffset = (random() - 0.5) * 0.34;
  const reverse = random() < 0.5;

  return Array.from({ length: count }, (_, rawIndex) => {
    const index = reverse ? count - rawIndex - 1 : rawIndex;
    const position =
      count === 1 ? random() : (index + 0.5) / Math.max(1, count);
    const angle =
      -Math.PI + 0.4 + position * (Math.PI - 0.8) + centerOffset;
    const speed = 38 + random() * 17;
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);

    return {
      velocityX: directionX * speed,
      velocityY: directionY * speed,
      gravity: 50 + random() * 16,
      originOffsetX: directionX * 4,
      originOffsetY: directionY * 4,
    };
  });
}
