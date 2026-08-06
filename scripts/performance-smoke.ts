import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  createNewGame,
  assignPlayerItem,
  developerRecruitCompanion,
  pickupGroundItems,
  playerStep,
  runEnemyTurn,
  setCompanionCommand,
} from "../app/game/engine";
import { companionSkillBlueprint } from "../app/game/companion-skill-blueprints";
import { COMPANION_SKILL_IDS } from "../app/game/companion-skills";
import { COMPANION_CLASS_IDS } from "../app/game/companions";
import {
  createDungeonRenderCache,
  fogMaskBitAt,
  overlayFrameAt,
  syncDungeonRenderCache,
  terrainFrameAt,
} from "../app/presentation/render-cache";
import {
  fogMasksForTile,
  terrainVisual,
  wallOverlayVisual,
} from "../app/presentation/render";
import { retainInPlace } from "../app/presentation/animation-runtime";
import {
  createPixelEffectBuckets,
  syncPixelEffectBuckets,
} from "../app/presentation/pixel-effects";
import { createCompanionSkillEffects } from "../app/presentation/skill-particle-recipes";

const besidePlayer = (state: ReturnType<typeof createNewGame>) => {
  const dx = state.player.x + 1 < state.width ? 1 : -1;
  return {
    dx,
    dy: 0,
    x: state.player.x + dx,
    y: state.player.y,
  };
};

const animationRecords = [1, 2, 3, 4];
const animationRecordsIdentity = animationRecords;
assert.equal(retainInPlace(animationRecords, (value) => value % 2 === 0), animationRecordsIdentity);
assert.deepEqual(animationRecords, [2, 4]);
const pixelEffectBuckets = createPixelEffectBuckets();
const bucketedPixelEffects = [
  {
    id: "ground",
    kind: "particle" as const,
    layer: "ground" as const,
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    gravity: 0,
    drag: 0,
    cellSize: 1,
    color: "#fff",
    startedAt: 0,
    duration: 1,
  },
  {
    id: "overlay",
    kind: "screenFlash" as const,
    layer: "overlay" as const,
    color: "#fff",
    strength: 1,
    startedAt: 0,
    duration: 1,
  },
];
syncPixelEffectBuckets(bucketedPixelEffects, pixelEffectBuckets);
assert.equal(pixelEffectBuckets.ground[0], bucketedPixelEffects[0]);
assert.equal(pixelEffectBuckets.actor.length, 0);
assert.equal(pixelEffectBuckets.overlay[0], bucketedPixelEffects[1]);

const cacheState = createNewGame(0xcac4e);
const cache = createDungeonRenderCache();
syncDungeonRenderCache(cache, cacheState);
assert.equal(cache.tileRebuilds, 1);
assert.equal(cache.fogRevision, 1);
assert.equal(cache.terrainRebuilds, 1);
assert.equal(cache.visibilityRebuilds, 1);

for (let y = 0; y < cacheState.height; y += 1) {
  for (let x = 0; x < cacheState.width; x += 1) {
    const terrainFrame = terrainVisual(cacheState, x, y);
    const overlayFrame = wallOverlayVisual(cacheState, x, y);
    assert.equal(terrainFrameAt(cache, x, y), terrainFrame);
    assert.equal(overlayFrameAt(cache, x, y), overlayFrame);
    const masks = fogMasksForTile(
      cacheState.tiles[y][x],
      terrainFrame ?? overlayFrame,
    );
    for (let localY = 0; localY < 2; localY += 1) {
      for (let localX = 0; localX < 2; localX += 1) {
        const bit = 1 << (localX + localY * 2);
        const cellX = x * 2 + localX;
        const cellY = y * 2 + localY;
        assert.equal(
          fogMaskBitAt(cache, cellX, cellY, "visible"),
          Boolean(masks.visibleMask & bit),
        );
        assert.equal(
          fogMaskBitAt(cache, cellX, cellY, "discovered"),
          Boolean(masks.discoveredMask & bit),
        );
      }
    }
  }
}

syncDungeonRenderCache(cache, cacheState);
assert.equal(
  cache.tileRebuilds,
  1,
  "rendering the same state must not rebuild tile lookups",
);

cacheState.player.inventory.potion_healing = 1;
const autoSlotState = assignPlayerItem(
  cacheState,
  { kind: "flex", index: 2 },
  "potion_healing",
).state;
assert.equal(
  autoSlotState.tiles,
  cacheState.tiles,
  "inventory-only actions must structurally share the tile grid",
);
const fogRevisionBeforeQuickSlot = cache.fogRevision;
syncDungeonRenderCache(cache, autoSlotState);
assert.equal(cache.tileRebuilds, 1);
assert.equal(cache.fogRevision, fogRevisionBeforeQuickSlot);
assert.equal(cache.tileCacheHits, 1);

const visibilityOnlyState = {
  ...autoSlotState,
  tiles: autoSlotState.tiles.map((row) => row.map((tile) => ({ ...tile }))),
};
const visibilityTile =
  visibilityOnlyState.tiles[visibilityOnlyState.player.y][
    visibilityOnlyState.player.x
  ];
const wasVisible = Boolean(
  visibilityTile.visibleMask || visibilityTile.visible,
);
visibilityTile.visible = !wasVisible;
visibilityTile.visibleMask = wasVisible ? 0 : 15;
const terrainRebuildsBeforeVisibility = cache.terrainRebuilds;
const visibilityRebuildsBeforeVisibility = cache.visibilityRebuilds;
syncDungeonRenderCache(cache, visibilityOnlyState);
assert.equal(
  cache.terrainRebuilds,
  terrainRebuildsBeforeVisibility,
  "FOV-only state changes must not rebuild terrain atlas lookups",
);
assert.equal(
  cache.visibilityRebuilds,
  visibilityRebuildsBeforeVisibility + 1,
  "FOV-only state changes must rebuild visibility exactly once",
);

let companionSortState = developerRecruitCompanion(
  visibilityOnlyState,
  COMPANION_CLASS_IDS[0],
);
companionSortState = developerRecruitCompanion(
  companionSortState,
  COMPANION_CLASS_IDS[1],
);
companionSortState = {
  ...companionSortState,
  tiles: visibilityOnlyState.tiles,
};
companionSortState.companions[0].y = companionSortState.player.y + 1;
companionSortState.companions[1].y = companionSortState.player.y - 1;
const tileRebuildsBeforeCompanions = cache.tileRebuilds;
syncDungeonRenderCache(cache, companionSortState);
assert.equal(
  cache.tileRebuilds,
  tileRebuildsBeforeCompanions,
  "actor-only state changes must not rebuild tile caches",
);
assert.deepEqual(
  cache.sortedCompanions.map(({ id }) => id),
  [...companionSortState.companions]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map(({ id }) => id),
  "companion render order must be cached when the actor collection changes",
);

const movementState = createNewGame(0x50eed);
movementState.enemies = [];
movementState.objects = [];
const movementTarget = besidePlayer(movementState);
movementState.tiles[movementTarget.y][movementTarget.x].terrain = "floor";
const movement = playerStep(
  movementState,
  movementTarget.dx,
  movementTarget.dy,
);
assert.notEqual(
  movement.state.tiles,
  movementState.tiles,
  "movement/FOV changes must produce a new tile-grid revision",
);
syncDungeonRenderCache(cache, movement.state);
assert.equal(cache.tileRebuilds, tileRebuildsBeforeCompanions + 1);

const attackState = createNewGame(0xa77ac);
attackState.objects = [];
const attackTarget = besidePlayer(attackState);
attackState.tiles[attackTarget.y][attackTarget.x].terrain = "floor";
attackState.enemies = [
  {
    id: "performance-target",
    kind: "rat",
    x: attackTarget.x,
    y: attackTarget.y,
    hp: 1_000_000,
    maxHp: 1_000_000,
    attack: 1,
    defense: 0,
    accuracy: 1,
    evasion: 0,
    xp: 0,
    alerted: true,
    sawPlayerLastTurn: true,
    sleeping: false,
    wakeCooldown: 0,
  },
];
const attack = playerStep(attackState, attackTarget.dx, attackTarget.dy);
assert.equal(
  attack.state.tiles,
  attackState.tiles,
  "combat without terrain/FOV changes must reuse the tile grid",
);

const pickupState = createNewGame(0x91c4);
pickupState.enemies = [];
pickupState.groundItems = [
  {
    id: "performance-potion",
    defId: "potion_healing",
    quantity: 1,
    x: pickupState.player.x,
    y: pickupState.player.y,
  },
];
const pickup = pickupGroundItems(pickupState);
assert.equal(
  pickup.state.tiles,
  pickupState.tiles,
  "pickup must reuse an unchanged tile grid",
);
assert.equal(
  pickup.presentationState,
  pickupState,
  "presentation snapshots must reuse immutable input state",
);

const benchmark = (iterations: number, action: () => unknown) => {
  for (let index = 0; index < 25; index += 1) action();
  const totals = Array.from({ length: 7 }, () => {
    const startedAt = performance.now();
    for (let index = 0; index < iterations; index += 1) action();
    return performance.now() - startedAt;
  }).sort((a, b) => a - b);
  const totalMs = totals[Math.floor(totals.length / 2)];
  return {
    totalMs: Number(totalMs.toFixed(2)),
    perActionMs: Number((totalMs / iterations).toFixed(3)),
    samples: totals.length,
  };
};

const iterations = 500;
const attackTiming = benchmark(iterations, () =>
  playerStep(attackState, attackTarget.dx, attackTarget.dy),
);
const pickupTiming = benchmark(iterations, () =>
  pickupGroundItems(pickupState),
);
let companionPerformanceState = createNewGame(0xc04f);
companionPerformanceState.companions = [];
companionPerformanceState.enemies = [];
companionPerformanceState.objects = [];
for (const classId of COMPANION_CLASS_IDS) {
  companionPerformanceState = developerRecruitCompanion(
    companionPerformanceState,
    classId,
  );
}
for (const companion of companionPerformanceState.companions) {
  companionPerformanceState = setCompanionCommand(
    companionPerformanceState,
    companion.id,
    "explore",
  );
}
const companionTiming = benchmark(120, () =>
  runEnemyTurn(companionPerformanceState),
);
const skillVisuals = COMPANION_SKILL_IDS.map((skillId, index) => {
  const blueprint = companionSkillBlueprint(skillId);
  return {
    id: `particle-performance-${skillId}`,
    skillId,
    from: { x: 2, y: 2 },
    to: { x: 8, y: 6 },
    travelMode: blueprint.travelMode,
    impactMode: blueprint.impactMode,
    radius: blueprint.scalars.radius ?? 0,
    accent: blueprint.accent,
    startedAt: index,
  };
});
const particleCounts = skillVisuals.map((visual) =>
  createCompanionSkillEffects(visual, visual.startedAt, 48).length,
);
const particleTiming = benchmark(100, () => {
  for (const visual of skillVisuals) {
    createCompanionSkillEffects(visual, visual.startedAt, 48);
  }
});
assert.ok(
  Math.max(...particleCounts) <= 256,
  `one skill emitted ${Math.max(...particleCounts)} simultaneous effects`,
);
assert.ok(
  attackTiming.perActionMs < 4,
  `attack-state update regressed to ${attackTiming.perActionMs}ms/action`,
);
assert.ok(
  pickupTiming.perActionMs < 4,
  `pickup-state update regressed to ${pickupTiming.perActionMs}ms/action`,
);
assert.ok(
  companionTiming.perActionMs < 12,
  `registered-companion AI/FOV regressed to ${companionTiming.perActionMs}ms/turn`,
);
assert.ok(
  particleTiming.perActionMs < 10,
  `the complete skill-particle catalog regressed to ${particleTiming.perActionMs}ms/pass`,
);

console.log(
  JSON.stringify({
    map: `${cacheState.width}x${cacheState.height}`,
    tileRebuilds: cache.tileRebuilds,
    terrainRebuilds: cache.terrainRebuilds,
    visibilityRebuilds: cache.visibilityRebuilds,
    tileCacheHits: cache.tileCacheHits,
    companionClasses: COMPANION_CLASS_IDS.length,
    companionSkills: COMPANION_SKILL_IDS.length,
    maximumSkillEffects: Math.max(...particleCounts),
    attack500: attackTiming,
    pickup500: pickupTiming,
    companion120: companionTiming,
    particleCatalog100: particleTiming,
  }),
);
