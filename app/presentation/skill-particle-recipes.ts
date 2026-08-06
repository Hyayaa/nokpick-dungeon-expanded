import type {
  CompanionSkillId,
  CompanionSkillVisual,
  Point,
} from "../game/types";
import type { PixelEffect } from "./pixel-effect-types";
import {
  createFootprintFragmentParticles,
  createFragmentParticles,
  createLeapParticles,
  createShockwaveParticles,
  createSlashParticles,
  createTeleportParticles,
  createThrustParticles,
  particleDirectionBetween,
  type ParticleEmitterContext,
} from "./pixel-particle-emitters";
import {
  ATTACK_SEQUENCE_GAP,
  ATTACK_START_DELAY,
  COMPANION_ATTACK_DURATION,
  PLAYER_ATTACK_DURATION,
  SKILL_CHARGE_DURATION,
  SKILL_LEAP_DURATION,
  SKILL_TELEPORT_DURATION,
} from "./timing";

export type SkillParticleRecipe = (
  visual: CompanionSkillVisual,
  startedAt: number,
  tileSize: number,
  random: () => number,
) => PixelEffect[];

const SKILL_PALETTES: Readonly<
  Record<CompanionSkillId, readonly [string, string, string, string]>
> = {
  shockLeap: ["#ffffff", "#fff0a0", "#e4b65e", "#8f6737"],
  drivingLeap: ["#fff5d7", "#ffbf82", "#cf795f", "#724437"],
  fireball: ["#fff4bd", "#ffd45f", "#ff8246", "#d9452f"],
  weaponThrow: ["#ffffff", "#f4d28f", "#b18a56", "#67513a"],
  arcaneDischarge: ["#ffffff", "#dfc5ff", "#a986d8", "#7056a8"],
  whirlwind: ["#ffffff", "#ffe4a8", "#d6c477", "#857240"],
  piercingShot: ["#ffffff", "#e9f6bd", "#87b68a", "#4d7353"],
  chainLightning: ["#ffffff", "#fff69b", "#aeeaff", "#6bbde7"],
  frostNova: ["#ffffff", "#d9f8ff", "#8ee9ff", "#67aeca"],
  toxicOrb: ["#e4f29b", "#a9d56e", "#79ae58", "#426d3d"],
  corrosiveFlask: ["#f1ec9c", "#c8d95e", "#8db542", "#57712f"],
  entanglingRoots: ["#d6e59a", "#9bc878", "#6d9f62", "#4d6f3e"],
  shadowStep: ["#f1e9ff", "#c7a8ff", "#776c9b", "#3d355d"],
  execute: ["#fff0e6", "#ff9387", "#b95f5b", "#642d32"],
  shieldCharge: ["#ffffff", "#d6edf4", "#8196a4", "#4f5d68"],
  fieldMedicine: ["#ffffff", "#baf7c7", "#69cf85", "#3c8f57"],
  wardingSigil: ["#ffffff", "#ddc9ff", "#a98bd0", "#6f519a"],
  tripleStrike: ["#ffffff", "#ffe5ac", "#d3a45f", "#845e36"],
  seismicSlam: ["#fff0c4", "#dfbd83", "#aa875d", "#6f5137"],
  lifeDrain: ["#ffe0f8", "#d68bc9", "#a66a9f", "#643c67"],
};

const seededSkillRandom = (seed: string) => {
  let value = 0x811c9dc5;
  for (const character of seed) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 0x01000193);
  }
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000;
  };
};

const pathLength = (from: Point, to: Point) =>
  Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));

const projectileImpactDelay = (
  visual: CompanionSkillVisual,
  options: { leadMs?: number; perTileMs?: number; settleMs?: number } = {},
) =>
  (options.leadMs ?? 30) +
  pathLength(visual.from, visual.to) * (options.perTileMs ?? 24) +
  (options.settleMs ?? 70);

const attackImpactDelay = (visual: CompanionSkillVisual) =>
  visual.sourceId?.startsWith("companion-") ? 190 : 100;

const attackSequenceImpactDelays = (
  visual: CompanionSkillVisual,
  count: number,
) => {
  const duration = visual.sourceId?.startsWith("companion-")
    ? COMPANION_ATTACK_DURATION
    : PLAYER_ATTACK_DURATION;
  const firstImpact = ATTACK_START_DELAY + duration * 0.52;
  return Array.from(
    { length: count },
    (_, index) => firstImpact + index * (duration + ATTACK_SEQUENCE_GAP),
  );
};

const paletteForVisual = (
  visual: CompanionSkillVisual,
): readonly [string, string, string, string] =>
  visual.variants?.length
    ? ["#ffffff", visual.accent, visual.accent, "#40384c"]
    : SKILL_PALETTES[visual.skillId];

const emitterContext = (
  visual: CompanionSkillVisual,
  point: Point,
  startedAt: number,
  tileSize: number,
  random: () => number,
  suffix: string,
  clip: ParticleEmitterContext["clip"] = "none",
): ParticleEmitterContext => ({
  idPrefix: `${visual.id}-${suffix}`,
  point,
  startedAt,
  palette: paletteForVisual(visual),
  tileSize,
  random,
  clip,
});

const createAreaFragments = (
  visual: CompanionSkillVisual,
  startedAt: number,
  tileSize: number,
  random: () => number,
  options: {
    center?: Point;
    radiusTiles?: number;
    includeCenter?: boolean;
    countPerTile?: number;
    gravityPixels?: number;
    upwardBiasPixels?: number;
    maxParticles?: number;
  } = {},
) => {
  const center = options.center ?? visual.footprintOrigin ?? visual.to;
  const explicitFootprintOverride =
    options.center !== undefined || options.radiusTiles !== undefined;
  return createFootprintFragmentParticles(
    emitterContext(
      visual,
      center,
      startedAt,
      tileSize,
      random,
      "area",
      "none",
    ),
    {
      tiles: explicitFootprintOverride ? undefined : visual.affectedTiles,
      radiusTiles: Math.max(
        0,
        Math.min(4, Math.floor(options.radiusTiles ?? visual.radius)),
      ),
      includeCenter: options.includeCenter,
      countPerTile: options.countPerTile ?? 4,
      delayPerTileMs: 42,
      maxParticles: options.maxParticles ?? 144,
      speedPixels: [4, 12],
      gravityPixels: options.gravityPixels ?? 7,
      upwardBiasPixels: options.upwardBiasPixels ?? 2,
      durationMs: [260, 460],
    },
  );
};

const createCastFragments = (
  visual: CompanionSkillVisual,
  startedAt: number,
  tileSize: number,
  random: () => number,
  count = 10,
) => createFragmentParticles(
  emitterContext(
    visual,
    visual.from,
    startedAt,
    tileSize,
    random,
    "cast",
    "tile",
  ),
  {
    count,
    speedPixels: [4, 11],
    gravityPixels: -2,
    durationMs: [220, 380],
  },
);

const recipes = {
  shockLeap: (visual, startedAt, tileSize, random) => [
    ...createLeapParticles({
      idPrefix: visual.id,
      from: visual.from,
      to: visual.to,
      startedAt,
      palette: SKILL_PALETTES.shockLeap,
      tileSize,
      random,
      clip: "none",
    }, {
      impactDelayMs: SKILL_LEAP_DURATION - 10,
      impactRadiusTiles: visual.radius,
    }),
    ...createAreaFragments(
      visual,
      startedAt + SKILL_LEAP_DURATION - 10,
      tileSize,
      random,
      {
      countPerTile: 4,
      gravityPixels: 11,
      },
    ),
  ],
  drivingLeap: (visual, startedAt, tileSize, random) =>
    createLeapParticles({
      idPrefix: visual.id,
      from: visual.from,
      to: visual.to,
      startedAt,
      palette: SKILL_PALETTES.drivingLeap,
      tileSize,
      random,
      clip: "none",
    }, {
      directionalImpact: true,
      impactDelayMs: SKILL_LEAP_DURATION - 10,
    }),
  fireball: (visual, startedAt, tileSize, random) => [
    ...createCastFragments(visual, startedAt, tileSize, random),
    ...createThrustParticles({
      idPrefix: `${visual.id}-projectile`,
      from: visual.from,
      to: visual.to,
      startedAt: startedAt + 35,
      palette: SKILL_PALETTES.fireball,
      tileSize,
      random,
    }, { densityPerTile: 4, widthPixels: 4 }),
    ...createShockwaveParticles(
      emitterContext(
        visual,
        visual.to,
        startedAt + projectileImpactDelay(visual),
        tileSize,
        random,
        "impact",
      ),
      {
        fronts: 2,
        endRadiusTiles: Math.max(0.5, visual.radius + 0.2),
      },
    ),
    ...createAreaFragments(
      visual,
      startedAt + projectileImpactDelay(visual),
      tileSize,
      random,
    ),
  ],
  weaponThrow: (visual, startedAt, tileSize, random) => {
    const direction = particleDirectionBetween(visual.from, visual.to);
    return [
      ...createThrustParticles({
        idPrefix: `${visual.id}-wake`,
        from: visual.from,
        to: visual.to,
        startedAt,
        palette: SKILL_PALETTES.weaponThrow,
        tileSize,
        random,
      }, { densityPerTile: 2, widthPixels: 2 }),
      ...createFragmentParticles(
        emitterContext(visual, visual.to, startedAt + 270, tileSize, random, "metal"),
        { direction, spreadRadians: Math.PI * 0.55, count: 18, gravityPixels: 12 },
      ),
      ...createShockwaveParticles(
        emitterContext(visual, visual.to, startedAt + 270, tileSize, random, "impact"),
        { direction, sweepRadians: Math.PI * 0.65, fronts: 1 },
      ),
    ];
  },
  arcaneDischarge: (visual, startedAt, tileSize, random) => [
    ...createCastFragments(visual, startedAt, tileSize, random, 18),
    ...createThrustParticles({
      idPrefix: `${visual.id}-beam`,
      from: visual.from,
      to: visual.to,
      startedAt: startedAt + 45,
      palette: SKILL_PALETTES.arcaneDischarge,
      tileSize,
      random,
    }, { densityPerTile: 8, widthPixels: 5, durationMs: 280 }),
    ...createShockwaveParticles(
      emitterContext(
        visual,
        visual.to,
        startedAt + projectileImpactDelay(visual, {
          leadMs: 45,
          perTileMs: 12,
          settleMs: 35,
        }),
        tileSize,
        random,
        "impact",
      ),
      { fronts: 2 },
    ),
  ],
  whirlwind: (visual, startedAt, tileSize, random) => [
    ...createSlashParticles(
      emitterContext(visual, visual.from, startedAt, tileSize, random, "clockwise"),
      {
        sweepRadians: Math.PI * 1.85,
        repetitions: 2,
        delayBetweenMs: 80,
        radiusTiles: Math.max(0.5, visual.radius + 0.25),
      },
    ),
    ...createSlashParticles(
      emitterContext(visual, visual.from, startedAt + 45, tileSize, random, "counter"),
      {
        sweepRadians: Math.PI * 1.65,
        clockwise: false,
        radiusTiles: Math.max(0.5, visual.radius + 0.25),
      },
    ),
    ...createAreaFragments(visual, startedAt + 45, tileSize, random, {
      includeCenter: false,
      countPerTile: 5,
      gravityPixels: 3,
      upwardBiasPixels: 1,
    }),
  ],
  piercingShot: (visual, startedAt, tileSize, random) => {
    const direction = particleDirectionBetween(visual.from, visual.to);
    return [
      ...createThrustParticles({
        idPrefix: visual.id,
        from: visual.from,
        to: visual.to,
        startedAt,
        palette: SKILL_PALETTES.piercingShot,
        tileSize,
        random,
      }, { densityPerTile: 7, widthPixels: 2 }),
      ...createFragmentParticles(
        emitterContext(
          visual,
          visual.to,
          startedAt + projectileImpactDelay(visual, {
            leadMs: 0,
            perTileMs: 18,
            settleMs: 35,
          }),
          tileSize,
          random,
          "exit",
        ),
        { direction, spreadRadians: Math.PI * 0.35, count: 16, gravityPixels: 2 },
      ),
    ];
  },
  chainLightning: (visual, startedAt, tileSize, random) =>
    (visual.paths?.length
      ? visual.paths
      : [{ from: visual.from, to: visual.to }]
    ).slice(0, 8).flatMap((path, index) => {
      const direction = particleDirectionBetween(path.from, path.to);
      const segmentVisual = { ...visual, from: path.from, to: path.to };
      const segmentStart = startedAt + index * 55;
      const impactAt = segmentStart + projectileImpactDelay(segmentVisual, {
        leadMs: 0,
        perTileMs: 16,
        settleMs: 35,
      });
      return [
        ...createThrustParticles({
          idPrefix: `${visual.id}-chain-${index}`,
          from: path.from,
          to: path.to,
          startedAt: segmentStart,
          palette: SKILL_PALETTES.chainLightning,
          tileSize,
          random,
          clip: "none",
        }, { densityPerTile: 4, widthPixels: 4, delayPerTileMs: 16 }),
        ...createFragmentParticles(
          emitterContext(
            visual,
            path.to,
            impactAt,
            tileSize,
            random,
            `sparks-${index}`,
            "none",
          ),
          { direction, spreadRadians: Math.PI * 0.9, count: 12, gravityPixels: 0 },
        ),
        ...createShockwaveParticles(
          emitterContext(
            visual,
            path.to,
            impactAt,
            tileSize,
            random,
            `shock-${index}`,
            "none",
          ),
          { fronts: 1 },
        ),
      ];
    }),
  frostNova: (visual, startedAt, tileSize, random) => [
    ...createShockwaveParticles(
      emitterContext(visual, visual.to, startedAt + 90, tileSize, random, "nova"),
      {
        fronts: 3,
        endRadiusTiles: Math.max(0.5, visual.radius + 0.2),
      },
    ),
    ...createAreaFragments(visual, startedAt + 90, tileSize, random, {
      countPerTile: 5,
      gravityPixels: 2,
      upwardBiasPixels: 1,
    }),
  ],
  toxicOrb: (visual, startedAt, tileSize, random) => [
    ...createThrustParticles({
      idPrefix: `${visual.id}-orb`,
      from: visual.from,
      to: visual.to,
      startedAt,
      palette: SKILL_PALETTES.toxicOrb,
      tileSize,
      random,
    }, { densityPerTile: 2, widthPixels: 3 }),
    ...createFragmentParticles(
      emitterContext(
        visual,
        visual.to,
        startedAt + projectileImpactDelay(visual),
        tileSize,
        random,
        "splash",
        "none",
      ),
      { count: 28, speedPixels: [5, 16], gravityPixels: 14 },
    ),
    ...createShockwaveParticles(
      emitterContext(
        visual,
        visual.to,
        startedAt + projectileImpactDelay(visual),
        tileSize,
        random,
        "splash-wave",
        "none",
      ),
      { fronts: 1, aspectY: 0.45 },
    ),
  ],
  corrosiveFlask: (visual, startedAt, tileSize, random) => [
    ...createThrustParticles({
      idPrefix: `${visual.id}-flask`,
      from: visual.from,
      to: visual.to,
      startedAt,
      palette: SKILL_PALETTES.corrosiveFlask,
      tileSize,
      random,
    }, { densityPerTile: 2, widthPixels: 4 }),
    ...createFragmentParticles(
      emitterContext(
        visual,
        visual.to,
        startedAt + projectileImpactDelay(visual),
        tileSize,
        random,
        "glass",
        "none",
      ),
      { count: 32, speedPixels: [7, 20], gravityPixels: 16 },
    ),
    ...createShockwaveParticles(
      emitterContext(
        visual,
        visual.to,
        startedAt + projectileImpactDelay(visual),
        tileSize,
        random,
        "acid-wave",
        "none",
      ),
      { fronts: 1, aspectY: 0.4 },
    ),
  ],
  entanglingRoots: (visual, startedAt, tileSize, random) => [
    ...createShockwaveParticles(
      emitterContext(visual, visual.to, startedAt + 80, tileSize, random, "ground"),
      {
        fronts: 2,
        aspectY: 0.38,
        endRadiusTiles: Math.max(0.5, visual.radius + 0.2),
      },
    ),
    ...createAreaFragments(visual, startedAt + 80, tileSize, random, {
      countPerTile: 4,
      gravityPixels: -5,
      upwardBiasPixels: 5,
    }),
  ],
  shadowStep: (visual, startedAt, tileSize, random) => [
    ...createTeleportParticles({
      idPrefix: visual.id,
      from: visual.from,
      to: visual.to,
      startedAt,
      palette: SKILL_PALETTES.shadowStep,
      tileSize,
      random,
      clip: "none",
    }),
    ...createSlashParticles(
      emitterContext(visual, visual.to, startedAt + 165, tileSize, random, "ambush"),
      {
        direction: particleDirectionBetween(visual.from, visual.to),
        sweepRadians: Math.PI * 0.75,
        repetitions: 2,
        delayBetweenMs: 55,
        radiusTiles: Math.max(0.5, visual.radius + 0.15),
      },
    ),
    ...createAreaFragments(visual, startedAt + 165, tileSize, random, {
      includeCenter: false,
      countPerTile: 4,
      gravityPixels: 2,
      upwardBiasPixels: 1,
    }),
  ],
  execute: (visual, startedAt, tileSize, random) => [
    ...createSlashParticles(
      emitterContext(
        visual,
        visual.to,
        startedAt + attackImpactDelay(visual),
        tileSize,
        random,
        "heavy",
      ),
      {
        direction: particleDirectionBetween(visual.from, visual.to),
        sweepRadians: Math.PI * 0.82,
        radiusPixels: 7.5,
      },
    ),
    ...createShockwaveParticles(
      emitterContext(
        visual,
        visual.to,
        startedAt + attackImpactDelay(visual) + 35,
        tileSize,
        random,
        "finish",
      ),
      { fronts: 1, endRadiusPixels: 6 },
    ),
  ],
  shieldCharge: (visual, startedAt, tileSize, random) => {
    const direction = particleDirectionBetween(visual.from, visual.to);
    return [
      ...createFragmentParticles(
        emitterContext(visual, visual.from, startedAt, tileSize, random, "dust"),
        {
          direction: { x: -direction.x, y: -direction.y },
          spreadRadians: Math.PI * 0.7,
          count: 16,
          gravityPixels: 13,
        },
      ),
      ...createThrustParticles({
        idPrefix: `${visual.id}-charge`,
        from: visual.from,
        to: visual.to,
        startedAt,
        palette: SKILL_PALETTES.shieldCharge,
        tileSize,
        random,
      }, { densityPerTile: 4, widthPixels: 5 }),
      ...createShockwaveParticles(
        emitterContext(
          visual,
          visual.to,
          startedAt + SKILL_CHARGE_DURATION - 10,
          tileSize,
          random,
          "bash",
          "none",
        ),
        { direction, sweepRadians: Math.PI * 0.85, fronts: 2 },
      ),
      ...createFragmentParticles(
        emitterContext(
          visual,
          visual.to,
          startedAt + SKILL_CHARGE_DURATION - 10,
          tileSize,
          random,
          "debris",
          "none",
        ),
        { direction, spreadRadians: Math.PI * 0.75, count: 22, gravityPixels: 12 },
      ),
    ];
  },
  fieldMedicine: (visual, startedAt, tileSize, random) => [
    ...createShockwaveParticles(
      emitterContext(visual, visual.to, startedAt + 45, tileSize, random, "heal"),
      { fronts: 3, startRadiusPixels: 7, endRadiusPixels: 1.5, durationMs: 420 },
    ),
    ...createFragmentParticles(
      emitterContext(visual, visual.to, startedAt + 45, tileSize, random, "rise"),
      {
        count: 30,
        speedPixels: [3, 10],
        gravityPixels: -7,
        upwardBiasPixels: 5,
        durationMs: [360, 620],
      },
    ),
  ],
  wardingSigil: (visual, startedAt, tileSize, random) => [
    ...createShockwaveParticles(
      emitterContext(visual, visual.to, startedAt + 60, tileSize, random, "sigil"),
      { fronts: 3, startRadiusPixels: 7, endRadiusPixels: 2, aspectY: 0.45, durationMs: 480 },
    ),
    ...createFragmentParticles(
      emitterContext(visual, visual.to, startedAt + 60, tileSize, random, "settle"),
      { count: 26, speedPixels: [2, 8], gravityPixels: 4, durationMs: [420, 680] },
    ),
  ],
  tripleStrike: (visual, startedAt, tileSize, random) => {
    const direction = particleDirectionBetween(visual.from, visual.to);
    const [firstImpact, secondImpact, thirdImpact] =
      attackSequenceImpactDelays(visual, 3);
    return [
      ...createSlashParticles(
        emitterContext(
          visual,
          visual.to,
          startedAt + firstImpact,
          tileSize,
          random,
          "one",
        ),
        { direction, sweepRadians: Math.PI * 0.72, clockwise: true },
      ),
      ...createSlashParticles(
        emitterContext(
          visual,
          visual.to,
          startedAt + secondImpact,
          tileSize,
          random,
          "two",
        ),
        { direction, sweepRadians: Math.PI * 0.72, clockwise: false },
      ),
      ...createThrustParticles({
        idPrefix: `${visual.id}-three`,
        from: visual.from,
        to: visual.to,
        startedAt: startedAt + thirdImpact,
        palette: SKILL_PALETTES.tripleStrike,
        tileSize,
        random,
        clip: "none",
      }, { densityPerTile: 7, widthPixels: 2 }),
    ];
  },
  seismicSlam: (visual, startedAt, tileSize, random) => [
    ...createThrustParticles({
      idPrefix: `${visual.id}-slam`,
      from: visual.from,
      to: visual.to,
      startedAt,
      palette: SKILL_PALETTES.seismicSlam,
      tileSize,
      random,
    }, { densityPerTile: 5, widthPixels: 5 }),
    ...createShockwaveParticles(
      emitterContext(
        visual,
        visual.to,
        startedAt + attackImpactDelay(visual),
        tileSize,
        random,
        "quake",
        "none",
      ),
      {
        fronts: 3,
        aspectY: 0.34,
        endRadiusTiles: Math.max(0.5, visual.radius + 0.2),
      },
    ),
    ...createAreaFragments(
      visual,
      startedAt + attackImpactDelay(visual),
      tileSize,
      random,
      {
      countPerTile: 5,
      gravityPixels: 17,
      upwardBiasPixels: 7,
      },
    ),
  ],
  lifeDrain: (visual, startedAt, tileSize, random) => [
    ...createThrustParticles({
      idPrefix: `${visual.id}-return`,
      from: visual.to,
      to: visual.from,
      startedAt: startedAt + 35,
      palette: SKILL_PALETTES.lifeDrain,
      tileSize,
      random,
    }, { densityPerTile: 6, widthPixels: 5, delayPerTileMs: 18, durationMs: 340 }),
    ...createShockwaveParticles(
      emitterContext(visual, visual.to, startedAt, tileSize, random, "drain"),
      { fronts: 2, startRadiusPixels: 7, endRadiusPixels: 1, durationMs: 360 },
    ),
    ...createFragmentParticles(
      emitterContext(visual, visual.from, startedAt + 170, tileSize, random, "absorb"),
      { count: 24, speedPixels: [-14, -5], spawnRadiusPixels: 6, gravityPixels: 0 },
    ),
  ],
} satisfies Record<CompanionSkillId, SkillParticleRecipe>;

const createSemanticDerivedEffects: SkillParticleRecipe = (
  visual,
  startedAt,
  tileSize,
  random,
) => {
  const palette = paletteForVisual(visual);
  const direction = particleDirectionBetween(visual.from, visual.to);
  const impactPoint = visual.footprintOrigin ?? visual.to;
  const rank = Math.max(1, Math.min(4, Math.floor(visual.rank ?? 1)));
  const impactAt = startedAt + (
    visual.travelMode === "leap"
      ? SKILL_LEAP_DURATION - 10
      : visual.travelMode === "teleport"
        ? Math.round(SKILL_TELEPORT_DURATION * 0.62)
        : visual.travelMode === "charge"
          ? SKILL_CHARGE_DURATION - 10
          : visual.impactMode === "slash"
            ? attackImpactDelay(visual)
            : projectileImpactDelay(visual)
  );
  const atTarget = (suffix: string): ParticleEmitterContext => ({
    idPrefix: `${visual.id}-derived-${suffix}`,
    point: impactPoint,
    startedAt: impactAt,
    palette,
    tileSize,
    random,
    clip: "none",
  });
  const effects: PixelEffect[] = [];

  if (visual.travelMode === "leap") {
    effects.push(...createLeapParticles({
      idPrefix: `${visual.id}-derived-travel`,
      from: visual.from,
      to: visual.to,
      startedAt,
      palette,
      tileSize,
      random,
      clip: "none",
    }, {
      impactDelayMs: SKILL_LEAP_DURATION - 10,
      includeLandingImpact: false,
    }));
  } else if (visual.travelMode === "teleport") {
    effects.push(...createTeleportParticles({
      idPrefix: `${visual.id}-derived-travel`,
      from: visual.from,
      to: visual.to,
      startedAt,
      palette,
      tileSize,
      random,
      clip: "none",
    }, {
      arrivalDelayMs: Math.round(SKILL_TELEPORT_DURATION * 0.62),
      includeArrivalBurst: false,
    }));
  } else if (visual.travelMode === "charge") {
    effects.push(...createThrustParticles({
      idPrefix: `${visual.id}-derived-charge`,
      from: visual.from,
      to: visual.to,
      startedAt,
      palette,
      tileSize,
      random,
      clip: "none",
    }, {
      densityPerTile: 2 + rank,
      widthPixels: 3 + rank,
      delayPerTileMs: 12,
      durationMs: SKILL_CHARGE_DURATION,
    }));
  } else if (
    visual.impactMode !== "healing" &&
    visual.impactMode !== "sigil"
  ) {
    effects.push(...createFragmentParticles({
      idPrefix: `${visual.id}-derived-cast`,
      point: visual.from,
      startedAt,
      palette,
      tileSize,
      random,
      clip: "none",
    }, {
      count: 5 + rank * 2,
      speedPixels: [3, 9 + rank],
      gravityPixels: -2,
    }));
  }

  if (visual.paths?.length) {
    visual.paths.slice(0, 8).forEach((path, index) => {
      const pathStartedAt = startedAt + index * 55;
      effects.push(
        ...createThrustParticles({
          idPrefix: `${visual.id}-derived-path-${index}`,
          from: path.from,
          to: path.to,
          startedAt: pathStartedAt,
          palette,
          tileSize,
          random,
          clip: "none",
        }, {
          densityPerTile: 3,
          widthPixels: 4,
          delayPerTileMs: 16,
        }),
        ...createFragmentParticles({
          idPrefix: `${visual.id}-derived-path-impact-${index}`,
          point: path.to,
          startedAt:
            pathStartedAt +
            pathLength(path.from, path.to) * 16 +
            35,
          palette,
          tileSize,
          random,
          clip: "none",
        }, {
          direction: particleDirectionBetween(path.from, path.to),
          spreadRadians: Math.PI * 0.75,
          count: 7,
          gravityPixels: 0,
        }),
      );
    });
  }

  if (visual.impactMode === "shockwave") {
    effects.push(...createShockwaveParticles(atTarget("shockwave"), {
      direction: visual.travelMode === "charge" ? direction : undefined,
      sweepRadians: visual.travelMode === "charge" ? Math.PI * 0.85 : undefined,
      fronts: Math.min(3, 1 + rank),
      endRadiusTiles: Math.max(0.5, Math.min(4, visual.radius) + 0.2),
    }));
    if (visual.radius > 0) {
      effects.push(...createAreaFragments(
        visual,
        impactAt,
        tileSize,
        random,
        { countPerTile: Math.min(5, 2 + rank) },
      ));
    }
  } else if (visual.impactMode === "fragments") {
    if (visual.radius > 0) {
      effects.push(...createAreaFragments(
        visual,
        impactAt,
        tileSize,
        random,
        { countPerTile: Math.min(5, 2 + rank) },
      ));
    } else {
      effects.push(...createFragmentParticles(atTarget("fragments"), {
        direction,
        spreadRadians: Math.PI * 0.85,
        count: 10 + rank * 4,
        gravityPixels: 10,
      }));
    }
  } else if (visual.impactMode === "thrust") {
    effects.push(
      ...createThrustParticles({
        idPrefix: `${visual.id}-derived-thrust`,
        from: visual.from,
        to: visual.to,
        startedAt,
        palette,
        tileSize,
        random,
        clip: "none",
      }, { densityPerTile: 3 + rank, widthPixels: 2 + rank }),
      ...createFragmentParticles(atTarget("thrust-impact"), {
        direction,
        spreadRadians: Math.PI * 0.45,
        count: 8 + rank * 3,
        gravityPixels: 4,
      }),
    );
  } else if (visual.impactMode === "slash") {
    effects.push(...createSlashParticles(atTarget("slash"), {
      direction,
      sweepRadians: Math.PI * (0.62 + rank * 0.08),
      repetitions: Math.min(3, rank),
      delayBetweenMs: 70,
      radiusTiles: visual.radius > 0 ? visual.radius + 0.15 : undefined,
    }));
    if (visual.radius > 0) {
      effects.push(...createAreaFragments(
        visual,
        impactAt,
        tileSize,
        random,
        { countPerTile: Math.min(5, 2 + rank) },
      ));
    }
  } else if (visual.impactMode === "burst") {
    effects.push(...createShockwaveParticles(atTarget("burst-wave"), {
      fronts: Math.min(3, 1 + rank),
      endRadiusTiles: Math.max(0.5, Math.min(4, visual.radius) + 0.2),
    }));
    if (visual.radius > 0) {
      effects.push(...createAreaFragments(
        visual,
        impactAt,
        tileSize,
        random,
        { countPerTile: Math.min(5, 2 + rank) },
      ));
    } else {
      effects.push(...createFragmentParticles(atTarget("burst"), {
        count: 12 + rank * 4,
        speedPixels: [6, 16 + rank * 2],
        gravityPixels: 8,
      }));
    }
  } else if (visual.impactMode === "healing") {
    effects.push(
      ...createShockwaveParticles(atTarget("healing"), {
        fronts: Math.min(3, 1 + rank),
        startRadiusPixels: 7 + rank,
        endRadiusPixels: 1,
        durationMs: 430,
      }),
      ...createFragmentParticles(atTarget("healing-rise"), {
        count: 12 + rank * 4,
        speedPixels: [3, 9],
        gravityPixels: -7,
        upwardBiasPixels: 4,
      }),
    );
  } else if (visual.impactMode === "sigil") {
    effects.push(...createShockwaveParticles(atTarget("sigil"), {
      fronts: Math.min(4, 2 + rank),
      startRadiusPixels: 8,
      endRadiusPixels: 2,
      aspectY: 0.45,
      durationMs: 500,
    }));
  } else {
    effects.push(
      ...createThrustParticles({
        idPrefix: `${visual.id}-derived-drain`,
        from: visual.to,
        to: visual.from,
        startedAt,
        palette,
        tileSize,
        random,
        clip: "none",
      }, { densityPerTile: 3 + rank, widthPixels: 3 }),
      ...createShockwaveParticles(atTarget("drain"), {
        fronts: 2,
        startRadiusPixels: 7,
        endRadiusPixels: 1,
      }),
    );
  }
  return effects;
};

const createUpgradeAccentEffects: SkillParticleRecipe = (
  visual,
  startedAt,
  tileSize,
  random,
) => {
  if (!visual.variants?.length) return [];
  const rank = Math.max(1, Math.min(4, Math.floor(visual.rank ?? 1)));
  const delay = visual.travelMode === "leap"
    ? SKILL_LEAP_DURATION - 10
    : visual.travelMode === "teleport"
      ? Math.round(SKILL_TELEPORT_DURATION * 0.62)
      : visual.travelMode === "charge"
        ? SKILL_CHARGE_DURATION - 10
        : visual.impactMode === "slash"
          ? attackImpactDelay(visual)
          : projectileImpactDelay(visual);
  return createFragmentParticles({
    idPrefix: `${visual.id}-upgrade-${visual.variants.join("-")}`,
    point: visual.to,
    startedAt: startedAt + delay,
    palette: paletteForVisual(visual),
    tileSize,
    random,
    clip: "none",
  }, {
    count: 3 + rank * 2,
    speedPixels: [3, 8 + rank],
    gravityPixels: 2,
    durationMs: [220, 360],
  });
};

export const SKILL_PARTICLE_RECIPES: Readonly<
  Record<CompanionSkillId, SkillParticleRecipe>
> = recipes;

export const MAX_SKILL_PIXEL_EFFECTS = 256;

const limitSkillPixelEffects = (effects: PixelEffect[]) => {
  if (effects.length <= MAX_SKILL_PIXEL_EFFECTS) return effects;
  const selected = new Set<PixelEffect>();
  const representedFootprintTiles = new Set<string>();
  for (const effect of effects) {
    if (effect.kind !== "particle") continue;
    const footprintTile = effect.id.match(
      /^(.*-footprint-\d+)-fragment-\d+$/,
    )?.[1];
    if (!footprintTile || representedFootprintTiles.has(footprintTile)) {
      continue;
    }
    representedFootprintTiles.add(footprintTile);
    selected.add(effect);
  }
  for (const effect of effects) {
    if (selected.size >= MAX_SKILL_PIXEL_EFFECTS) break;
    selected.add(effect);
  }
  return effects.filter((effect) => selected.has(effect));
};

export function createCompanionSkillEffects(
  visual: CompanionSkillVisual,
  startedAt: number,
  tileSize = 48,
): PixelEffect[] {
  const random = seededSkillRandom([
    visual.id,
    visual.skillId,
    visual.travelMode,
    visual.impactMode,
    visual.rank ?? 1,
    ...(visual.variants ?? []),
  ].join(":"));
  const recipe = visual.semanticOverride
    ? createSemanticDerivedEffects
    : SKILL_PARTICLE_RECIPES[visual.skillId];
  let effects = recipe(
    visual,
    startedAt,
    tileSize,
    random,
  );
  if (visual.accentOverride && !visual.semanticOverride) {
    const palette = paletteForVisual(visual);
    effects = effects.map((effect, index) => ({
      ...effect,
      color: palette[index % palette.length] ?? visual.accent,
    }));
  }
  if (visual.variants?.length && !visual.semanticOverride) {
    effects.push(...createUpgradeAccentEffects(
      visual,
      startedAt,
      tileSize,
      random,
    ));
  }
  return limitSkillPixelEffects(effects);
}
