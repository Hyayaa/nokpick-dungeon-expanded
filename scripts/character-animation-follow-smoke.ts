import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createNewGame,
  playerStep,
  runEnemyTurn,
} from "../app/game/engine";
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
  COMPANION_ATTACK_DURATION,
  PLAYER_ATTACK_DURATION,
  PLAYER_MOVE_DURATION,
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
    const followTurn = runEnemyTurn(playerTurn.state);
    assert.equal(
      new Set(
        followTurn.state.companions.map(({ x, y }) => `${x},${y}`),
      ).size,
      followTurn.state.companions.length,
      "followers must reserve distinct destinations",
    );
    followTurn.state.companions.forEach((companion, index) => {
      assert.deepEqual(
        { x: companion.x, y: companion.y },
        playerHistory[index],
        "followers must preserve order along the player's trail",
      );
      assert.ok(
        followTurn.motions.some(
          (motion) => motion.id === companion.id && motion.kind === "move",
        ),
        "each follower must continue moving",
      );
    });
    state = followTurn.state;
  }
  return state;
};

const straightFollow = followSteps(
  prepareFollowGame(0xf0110a),
  Array.from({ length: 5 }, () => ({ x: 1, y: 0 })),
);
assert.deepEqual(
  straightFollow.companions.map(({ x, y }) => ({ x, y })),
  [
    { x: 14, y: 10 },
    { x: 13, y: 10 },
    { x: 12, y: 10 },
  ],
);

followSteps(prepareFollowGame(0xf0110b), [
  { x: 1, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]);

const doorGame = prepareFollowGame(0xf0110c);
doorGame.tiles.forEach((row) => row.forEach((tile) => { tile.terrain = "wall"; }));
for (let x = 7; x <= 15; x += 1) doorGame.tiles[10][x].terrain = "floor";
doorGame.tiles[10][10].terrain = "door";
doorGame.player.x = 13;
doorGame.companions[0].x = 9;
doorGame.companions[1].x = 8;
doorGame.companions[2].x = 7;
doorGame.companionTrail = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
];
const doorFollow = runEnemyTurn(doorGame);
assert.equal(doorFollow.state.companions[0].x, 10);
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

console.log("character animation and companion follow smoke checks passed");
