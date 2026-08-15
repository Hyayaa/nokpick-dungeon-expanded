import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createNewGame,
  getPlayerMoveSpeed,
  isFormationAligned,
  playerStep,
  runEnemyTurn,
} from "../app/game/engine";
import { getCompanionMoveSpeed } from "../app/game/companions";
import type { GameState } from "../app/game/types";
import {
  type CharacterMoveCycleRuntime,
  CHARACTER_MOVE_FRAME_DURATION,
  PLAYER_ATTACK_FRAMES,
  PLAYER_IDLE_FRAMES,
  PLAYER_INTERACT_FRAMES,
  PLAYER_MOVE_FRAMES,
  registerCharacterMotionCycle,
  resolveCharacterAnimationFrame,
} from "../app/presentation/player-animation";
import {
  characterMoveDuration,
  COMPANION_ATTACK_DURATION,
  COMPANION_MOVE_DURATION,
  DEFAULT_CHARACTER_MOVE_ANIMATION_SPEED,
  ENEMY_MOVE_DURATION,
  MAX_CHARACTER_MOVE_ANIMATION_SPEED,
  MIN_CHARACTER_MOVE_ANIMATION_SPEED,
  normalizeCharacterMoveAnimationSpeed,
  PLAYER_ATTACK_DURATION,
  PLAYER_MOVE_DURATION,
  durationForMotion,
  createTurnMotionTimeline,
} from "../app/presentation/timing";

const registerWalk = (
  runtime: CharacterMoveCycleRuntime,
  actorId: string,
  now: number,
) =>
  registerCharacterMotionCycle({
    runtime,
    actorId,
    now,
    delay: 0,
    duration: PLAYER_MOVE_DURATION,
    walking: true,
  });

const runtime: CharacterMoveCycleRuntime = new Map();
let segmentNow = 1_000;
const playerFrames: number[] = [];
const companionFrames: number[] = [];
for (let tile = 0; tile < 5; tile += 1) {
  const playerSegmentStart = registerWalk(runtime, "player", segmentNow);
  const companionSegmentStart = registerWalk(
    runtime,
    "companion-a",
    segmentNow,
  );
  playerFrames.push(
    resolveCharacterAnimationFrame({
      kind: "move",
      now: playerSegmentStart,
      moveCycleStartedAt: runtime.get("player")?.startedAt,
    }),
  );
  companionFrames.push(
    resolveCharacterAnimationFrame({
      kind: "move",
      now: companionSegmentStart,
      moveCycleStartedAt: runtime.get("companion-a")?.startedAt,
    }),
  );
  segmentNow = playerSegmentStart + PLAYER_MOVE_DURATION + 8;
}
assert.deepEqual(companionFrames, playerFrames);
assert.equal(playerFrames[0], PLAYER_MOVE_FRAMES[0]);
assert.notEqual(
  playerFrames[1],
  PLAYER_MOVE_FRAMES[0],
  "the second tile must continue the run cycle instead of resetting",
);
assert.ok(
  new Set(companionFrames).size > 2,
  "five consecutive tiles must advance through the run frames",
);

const independentRuntime: CharacterMoveCycleRuntime = new Map();
registerWalk(independentRuntime, "companion-a", 2_000);
registerWalk(independentRuntime, "companion-b", 2_096);
assert.notEqual(
  resolveCharacterAnimationFrame({
    kind: "move",
    now: 2_160,
    moveCycleStartedAt: independentRuntime.get("companion-a")?.startedAt,
  }),
  resolveCharacterAnimationFrame({
    kind: "move",
    now: 2_160,
    moveCycleStartedAt: independentRuntime.get("companion-b")?.startedAt,
  }),
  "companions must keep independent move cycles",
);

for (const action of ["attack", "interact"] as const) {
  registerWalk(independentRuntime, "companion-a", 2_200);
  registerCharacterMotionCycle({
    runtime: independentRuntime,
    actorId: "companion-a",
    now: 2_240,
    delay: 0,
    duration: 240,
    walking: false,
  });
  assert.equal(independentRuntime.has("companion-a"), false, `${action} clears run`);
  const restartedAt = registerWalk(independentRuntime, "companion-a", 3_000);
  assert.equal(
    resolveCharacterAnimationFrame({
      kind: "move",
      now: restartedAt,
      moveCycleStartedAt: independentRuntime.get("companion-a")?.startedAt,
    }),
    PLAYER_MOVE_FRAMES[0],
  );
}

assert.deepEqual(
  PLAYER_MOVE_FRAMES.map((_, index) =>
    resolveCharacterAnimationFrame({
      kind: "move",
      now: 4_000 + index * CHARACTER_MOVE_FRAME_DURATION,
      moveCycleStartedAt: 4_000,
    }),
  ),
  [...PLAYER_MOVE_FRAMES],
);
assert.equal(resolveCharacterAnimationFrame({ kind: "idle", now: 0 }), PLAYER_IDLE_FRAMES[0]);
assert.equal(resolveCharacterAnimationFrame({ kind: "attack", now: 0, progress: 0 }), PLAYER_ATTACK_FRAMES[0]);
assert.equal(resolveCharacterAnimationFrame({ kind: "interact", now: 0, progress: 0 }), PLAYER_INTERACT_FRAMES[0]);
assert.equal(COMPANION_ATTACK_DURATION, PLAYER_ATTACK_DURATION);
assert.equal(DEFAULT_CHARACTER_MOVE_ANIMATION_SPEED, 1);
assert.equal(MIN_CHARACTER_MOVE_ANIMATION_SPEED, 0.25);
assert.equal(MAX_CHARACTER_MOVE_ANIMATION_SPEED, 1);
assert.equal(PLAYER_MOVE_DURATION, 123);
assert.equal(COMPANION_MOVE_DURATION, PLAYER_MOVE_DURATION);
assert.equal(ENEMY_MOVE_DURATION, 100);
assert.equal(characterMoveDuration(0.5), 246);
assert.equal(characterMoveDuration(0.25), 492);
assert.equal(normalizeCharacterMoveAnimationSpeed(Number.NaN), 1);
assert.equal(normalizeCharacterMoveAnimationSpeed(0.2), 1);
assert.equal(normalizeCharacterMoveAnimationSpeed(1.1), 1);

const playerWalkMotion = {
  id: "player",
  kind: "move" as const,
  from: { x: 0, y: 0 },
  to: { x: 1, y: 0 },
};
const companionWalkMotion = {
  ...playerWalkMotion,
  id: "companion-speed-check",
};
const enemyWalkMotion = {
  ...playerWalkMotion,
  id: "enemy-speed-check",
};
assert.equal(durationForMotion(playerWalkMotion, 0.25), 492);
assert.equal(durationForMotion(companionWalkMotion, 0.25), 492);
assert.equal(durationForMotion(enemyWalkMotion, 0.25), ENEMY_MOVE_DURATION);
assert.equal(
  durationForMotion({ ...playerWalkMotion, kind: "attack" }, 0.25),
  PLAYER_ATTACK_DURATION,
);
for (const travelStyle of ["leap", "teleport", "charge"] as const) {
  assert.equal(
    durationForMotion({ ...playerWalkMotion, travelStyle }, 0.25),
    durationForMotion({ ...playerWalkMotion, travelStyle }, 1),
    `${travelStyle} duration must ignore the character walk setting`,
  );
}

const prepareFollowGame = (seed: number): GameState => {
  const state = createNewGame(seed);
  state.enemies = [];
  state.objects = [];
  state.groundItems = [];
  state.questNpcs = [];
  state.tiles.forEach((row) =>
    row.forEach((tile) => {
      tile.terrain = "floor";
      tile.discovered = true;
      tile.visible = true;
    }),
  );
  const third = structuredClone(state.companions[0]);
  third.id = "companion-follow-third";
  third.name = "Third";
  state.companions = [state.companions[0], state.companions[1], third];
  state.player.x = 10;
  state.player.y = 10;
  state.player.facing = "right";
  state.companions.forEach((companion, index) => {
    companion.x = 9 - index;
    companion.y = 10;
    companion.actionCooldown = 0;
  });
  state.companionTrail = [
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 },
  ];
  return state;
};

const followSteps = (
  initial: GameState,
  directions: readonly { x: number; y: number }[],
) => {
  let state = initial;
  const playerHistory = (state.companionTrail ?? []).map(({ x, y }) => ({
    x,
    y,
  }));
  for (const direction of directions) {
    const playerTurn = playerStep(state, direction.x, direction.y);
    assert.equal(playerTurn.consumedTurn, true);
    playerHistory.unshift({ x: state.player.x, y: state.player.y });
    assert.equal(
      new Set(
        playerTurn.state.companions.map(({ x, y }) => `${x},${y}`),
      ).size,
      playerTurn.state.companions.length,
      "followers must reserve distinct destinations",
    );
    playerTurn.state.companions.forEach((companion, index) => {
      assert.deepEqual(
        { x: companion.x, y: companion.y },
        playerHistory[index],
        "followers must preserve order along the player's trail",
      );
      assert.ok(
        playerTurn.motions.some(
          (motion) => motion.id === companion.id && motion.kind === "move",
        ),
        "each follower must move at the player's tile cadence",
      );
    });
    state = playerTurn.state;
  }
  return state;
};

const straightFollow = followSteps(
  prepareFollowGame(0xf0110a),
  Array.from({ length: 20 }, () => ({ x: 1, y: 0 })),
);
assert.deepEqual(
  straightFollow.companions.map(({ x, y }) => ({ x, y })),
  [
    { x: 29, y: 10 },
    { x: 28, y: 10 },
    { x: 27, y: 10 },
  ],
);

followSteps(prepareFollowGame(0xf0110b), [
  { x: 1, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
]);

let backtrackingGame = prepareFollowGame(0xf0110e);
const originalFollowerIds = backtrackingGame.companions.map(({ id }) => id);
for (let step = 0; step < 3; step += 1) {
  const reversalTurn = playerStep(backtrackingGame, -1, 0);
  assert.ok(
    reversalTurn.motions.some(
      (motion) => motion.id !== "player" && motion.kind === "move",
    ),
    "each reversal step must swap the player through the physical chain",
  );
  backtrackingGame = reversalTurn.state;
  assert.equal(
    new Set([
      `${backtrackingGame.player.x},${backtrackingGame.player.y}`,
      ...backtrackingGame.companions.map(({ x, y }) => `${x},${y}`),
    ]).size,
    backtrackingGame.companions.length + 1,
    "backtracking must preserve party occupancy",
  );
}
assert.equal(
  isFormationAligned(backtrackingGame),
  true,
  "the chain must be aligned after the player passes all three followers",
);
assert.deepEqual(
  [...backtrackingGame.companions]
    .sort((left, right) => left.x - right.x)
    .map(({ id }) => id),
  [...originalFollowerIds].reverse(),
  "a 180-degree reversal may adopt the reversed physical follower order",
);
for (let step = 0; step < 7; step += 1) {
  backtrackingGame = playerStep(backtrackingGame, -1, 0).state;
  assert.equal(
    isFormationAligned(backtrackingGame),
    true,
    "the reversed chain must remain aligned while moving away",
  );
}
assert.ok(
  backtrackingGame.companionTrail.filter(({ x, y }) => x === 9 && y === 10)
    .length >= 2,
  "breadcrumbs must preserve repeated coordinates while backtracking",
);

let corridorReversal = prepareFollowGame(0xf01112);
corridorReversal.tiles.forEach((row) =>
  row.forEach((tile) => {
    tile.terrain = "wall";
  }),
);
for (let x = 3; x <= 15; x += 1) {
  corridorReversal.tiles[10][x].terrain = "floor";
}
for (let step = 0; step < 8; step += 1) {
  corridorReversal = playerStep(corridorReversal, -1, 0).state;
  if (step >= 2) {
    assert.equal(
      isFormationAligned(corridorReversal),
      true,
      "a one-tile corridor reversal must recover into one contiguous line",
    );
  }
}

const corridorGame = prepareFollowGame(0xf0110f);
corridorGame.tiles.forEach((row) =>
  row.forEach((tile) => {
    tile.terrain = "wall";
  }),
);
for (let x = 7; x <= 35; x += 1) corridorGame.tiles[10][x].terrain = "floor";
followSteps(
  corridorGame,
  Array.from({ length: 20 }, () => ({ x: 1, y: 0 })),
);

const fasterPlayerGame = prepareFollowGame(0xf01110);
fasterPlayerGame.player.statuses.push(
  { id: "haste", turns: 30, power: 1 },
  { id: "stamina", turns: 30, power: 1 },
);
fasterPlayerGame.companions.forEach((companion) => {
  companion.statuses.push({ id: "crippled", turns: 30, power: 1 });
});
assert.ok(getPlayerMoveSpeed(fasterPlayerGame.player) > 1.5);
assert.equal(getCompanionMoveSpeed(fasterPlayerGame.companions[0]), 0.5);
followSteps(
  fasterPlayerGame,
  Array.from({ length: 12 }, () => ({ x: 1, y: 0 })),
);

const catchUpGame = prepareFollowGame(0xf01111);
catchUpGame.companionTrail = Array.from({ length: 9 }, (_, index) => ({
  x: 9 - index,
  y: 10,
}));
catchUpGame.companions.forEach((companion, index) => {
  companion.x = 5 - index;
  companion.y = 10;
});
const catchUpTurn = playerStep(catchUpGame, 1, 0);
const leadCatchUpMotions = catchUpTurn.motions.filter(
  (motion) => motion.id === catchUpGame.companions[0].id,
);
assert.deepEqual(
  leadCatchUpMotions.map(({ from, to }) => ({ from, to })),
  [
    { from: { x: 5, y: 10 }, to: { x: 6, y: 10 } },
    { from: { x: 6, y: 10 }, to: { x: 7, y: 10 } },
  ],
  "catch-up must use two sequential breadcrumb steps without teleporting",
);
const catchUpTimeline = createTurnMotionTimeline(catchUpTurn.motions);
const scheduledLeadCatchUp = catchUpTimeline.motions.filter(
  ({ motion }) => motion.id === catchUpGame.companions[0].id,
);
assert.deepEqual(
  scheduledLeadCatchUp.map(({ delay }) => delay),
  [0, PLAYER_MOVE_DURATION],
  "same-actor catch-up motions must play sequentially",
);
const queuedCycleRuntime: CharacterMoveCycleRuntime = new Map();
scheduledLeadCatchUp.forEach(({ motion, delay, duration }) => {
  registerCharacterMotionCycle({
    runtime: queuedCycleRuntime,
    actorId: motion.id,
    now: 5_000,
    delay,
    duration,
    walking: true,
  });
});
assert.equal(
  queuedCycleRuntime.get(catchUpGame.companions[0].id)?.startedAt,
  5_000,
  "catch-up motion segments must preserve one continuous animation cycle",
);
let recoveredFormation = catchUpTurn.state;
for (let step = 0; step < 8 && !isFormationAligned(recoveredFormation); step += 1) {
  recoveredFormation = playerStep(recoveredFormation, 1, 0).state;
}
assert.equal(
  isFormationAligned(recoveredFormation),
  true,
  "a broken formation must converge to one contiguous chain",
);

let waitingCatchUpGame = structuredClone(catchUpGame);
const waitingCatchUp = runEnemyTurn(waitingCatchUpGame);
assert.equal(
  waitingCatchUp.motions.filter(
    (motion) => motion.id === waitingCatchUpGame.companions[0].id,
  ).length,
  2,
  "waiting must give lagging followers a bounded catch-up update",
);
waitingCatchUpGame = waitingCatchUp.state;
for (let turn = 0; turn < 8 && !isFormationAligned(waitingCatchUpGame); turn += 1) {
  waitingCatchUpGame = runEnemyTurn(waitingCatchUpGame).state;
}
assert.equal(
  isFormationAligned(waitingCatchUpGame),
  true,
  "waiting recovery must finish with no gaps in the chain",
);

for (const statusId of ["rooted", "frozen", "paralyzed"] as const) {
  const blockedGame = prepareFollowGame(0xf01120);
  blockedGame.companions[0].statuses.push({
    id: statusId,
    turns: 2,
    power: 1,
  });
  const blockedTurn = playerStep(blockedGame, 1, 0);
  assert.deepEqual(
    {
      x: blockedTurn.state.companions[0].x,
      y: blockedTurn.state.companions[0].y,
    },
    { x: 9, y: 10 },
    `${statusId} must block forced formation movement`,
  );
}

const doorGame = prepareFollowGame(0xf0110c);
doorGame.tiles.forEach((row) => row.forEach((tile) => { tile.terrain = "wall"; }));
for (let x = 7; x <= 15; x += 1) doorGame.tiles[10][x].terrain = "floor";
doorGame.tiles[10][10].terrain = "door";
doorGame.player.x = 13;
doorGame.companions[0].x = 9;
doorGame.companions[1].x = 8;
doorGame.companions[2].x = 7;
doorGame.companionTrail = [
  { x: 12, y: 10 },
  { x: 11, y: 10 },
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
];
const doorFollow = runEnemyTurn(doorGame);
assert.equal(doorFollow.state.companions[0].x, 11);
assert.equal(doorFollow.state.tiles[10][10].terrain, "openDoor");
assert.equal(
  new Set(doorFollow.state.companions.map(({ x, y }) => `${x},${y}`)).size,
  3,
);

const combatGame = structuredClone(straightFollow);
const lead = combatGame.companions[0];
combatGame.enemies = [{
  id: "follow-transition-rat",
  kind: "rat",
  x: lead.x,
  y: lead.y + 1,
  hp: 7,
  maxHp: 7,
  attack: 2,
  defense: 0,
  accuracy: 0,
  evasion: 999,
  xp: 0,
  alerted: true,
  sawPlayerLastTurn: false,
  sleeping: false,
  wakeCooldown: 0,
  lastSeenPlayer: null,
  searchTurns: 0,
  statuses: [],
}];
const combatTurn = runEnemyTurn(combatGame);
assert.ok(
  combatTurn.motions.some(
    (motion) => motion.id === lead.id && motion.kind === "attack",
  ),
  "a follower must retain combat targeting after trail movement",
);
const movementDuringCombat = playerStep(combatGame, 0, -1);
assert.equal(
  movementDuringCombat.motions.some(
    (motion) => motion.id !== "player" && motion.kind === "move",
  ),
  false,
  "formation enforcement must stop immediately during combat",
);
movementDuringCombat.state.enemies = [];
const postCombatCatchUp = playerStep(movementDuringCombat.state, 0, -1);
assert.equal(
  postCombatCatchUp.motions.filter(
    (motion) =>
      motion.id === movementDuringCombat.state.companions[0].id &&
      motion.kind === "move",
  ).length,
  2,
  "formation catch-up must resume after combat ends",
);
assert.equal(
  isFormationAligned(postCombatCatchUp.state),
  true,
  "post-combat recovery must restore a contiguous chain",
);

const retreatGame = prepareFollowGame(0xf0110d);
retreatGame.companions.slice(1).forEach((companion) => { companion.hp = 0; });
const retreating = retreatGame.companions[0];
retreating.x = 10;
retreating.hp = 1;
retreating.maxHp = 100;
retreatGame.player.x = 8;
retreatGame.companionTrail = [{ x: 9, y: 10 }];
retreatGame.enemies = [{ ...combatGame.enemies[0], x: 12, y: 10 }];
const retreatTurn = runEnemyTurn(retreatGame);
assert.deepEqual(
  { x: retreatTurn.state.companions[0].x, y: retreatTurn.state.companions[0].y },
  { x: 9, y: 10 },
  "a low-health follower must not advance toward a non-adjacent enemy",
);

const rendererSource = readFileSync("app/presentation/dungeon-renderer.ts", "utf8");
assert.match(rendererSource, /TILE_SIZE\s*-\s*3\s*-\s*visual\.spriteLift/);
assert.match(rendererSource, /TILE_SIZE\s*-\s*2\s*-\s*playerVisual\.spriteLift/);
assert.match(rendererSource, /playerCenterX - playerWidth \/ 2/);

const dungeonUiSource = readFileSync("app/components/DungeonGame.tsx", "utf8");
assert.match(
  dungeonUiSource,
  /shattered-web-character-move-animation-speed/,
  "the movement animation setting must use its own persistent key",
);
assert.match(
  dungeonUiSource,
  /type="range"[\s\S]*min=\{MIN_CHARACTER_MOVE_ANIMATION_SPEED\}[\s\S]*max=\{MAX_CHARACTER_MOVE_ANIMATION_SPEED\}[\s\S]*step=\{0\.05\}/,
  "settings must expose the requested 0.25x-to-1x range slider",
);
assert.match(
  dungeonUiSource,
  /setCharacterMoveAnimationSpeed\([\s\S]*normalizeCharacterMoveAnimationSpeed\([\s\S]*savedCharacterMoveAnimationSpeed/,
  "invalid persisted movement speeds must normalize to the 1x default",
);
assert.ok(
  (dungeonUiSource.match(/characterMoveAnimationSpeed=\{characterMoveAnimationSpeed\}/g) ?? [])
    .length >= 3,
  "hub settings, dungeon settings, and DungeonRun must share one top-level speed value",
);
assert.match(
  dungeonUiSource,
  /createTurnMotionTimeline\([\s\S]*characterMoveAnimationSpeedRef\.current/,
  "motion scheduling must read the latest runtime setting",
);

console.log("character animation and companion follow smoke checks passed");
