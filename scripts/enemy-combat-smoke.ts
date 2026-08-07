import assert from "node:assert/strict";
import { createDeveloperTestMap } from "../app/game/developer-test-map";
import { createNewGame, runEnemyTurn } from "../app/game/engine";
import { ENEMY_STATS } from "../app/game/data";
import { cloneGame } from "../app/game/state";
import type { Enemy, EnemyKind, GameState, Point } from "../app/game/types";

const makeEnemy = (kind: EnemyKind, id: string, point: Point): Enemy => {
  const stats = ENEMY_STATS[kind];
  return {
    id, kind, ...point, hp:stats.hp, maxHp:stats.hp, attack:stats.attack,
    defense:stats.defense, accuracy:stats.accuracy, evasion:stats.evasion, xp:stats.xp,
    alerted:true, sawPlayerLastTurn:true, sleeping:false, wakeCooldown:0,
    lastSeenPlayer:null, searchTurns:0, statuses:[], skillCooldowns:{}, skillUses:{},
    pendingSkill:null, faction:"hostile", drop:null,
  };
};
const arena = () => {
  const state = createDeveloperTestMap(createNewGame(0xe11e7e57));
  state.companions = [];
  state.enemies = [];
  state.player.statuses = [];
  state.player.hp = state.player.maxHp;
  state.tiles.forEach((row) => row.forEach((tile) => {
    tile.visible = true;
    tile.visibleMask = 15;
  }));
  return state;
};
const act = (state: GameState) => runEnemyTurn(state, { playerInvincible:false }).state;

let state = arena();
state.player.x = 29; state.player.y = 80;
state.enemies = [makeEnemy("guard", "guard", {x:26,y:80})];
let turn = runEnemyTurn(state, { playerInvincible:false });
assert.equal(turn.magicVisuals?.[0]?.kind, "chain");
state = turn.state;
assert.deepEqual({x:state.player.x,y:state.player.y}, {x:27,y:80});
assert.ok(state.player.statuses.some((status) => status.id === "crippled"));
assert.equal(state.enemies[0].skillUses?.chainPull, 1);
state.player.x = 29; state.player.y = 80;
state = act(state);
assert.equal(state.enemies[0].skillUses?.chainPull, 1, "guard chain is one-use");

state = arena();
state.player.x = 30; state.player.y = 82;
state.enemies = [makeEnemy("necromancer", "necro", {x:32,y:85})];
state = act(state);
assert.equal(state.enemies[0].pendingSkill?.skillId, "summonSkeleton");
const saved = JSON.parse(JSON.stringify(state)) as GameState;
const cloned = cloneGame(saved);
assert.deepEqual(cloned.enemies[0].pendingSkill, state.enemies[0].pendingSkill, "windup survives save/reload clone");
state = act(cloned);
assert.ok(state.enemies.some((enemy) => enemy.kind === "necro_skeleton" && enemy.summonOwnerId === "necro"));
assert.equal(state.enemies.find((enemy) => enemy.id === "necro")?.summonIds?.length, 1);

state = arena();
state.player.x = 30; state.player.y = 82;
state.enemies = [makeEnemy("necromancer", "necro-visual", {x:32,y:85})];
state = act(state);
turn = runEnemyTurn(state, { playerInvincible:false });
assert.equal(turn.magicVisuals?.some((visual) => visual.kind === "summon"), true);

state = arena();
state.player.x = 113; state.player.y = 86;
state.enemies = [makeEnemy("eye", "eye", {x:116,y:86})];
state = act(state);
const lockedEyePoint = { ...state.enemies[0].pendingSkill!.targetPoint };
const lockedEyeTiles = state.enemies[0].pendingSkill!.affectedTiles.map((point) => ({ ...point }));
assert.equal(state.enemies[0].pendingSkill?.remainingWindupTurns, 2);
state.player.x = 113; state.player.y = 84;
const eyeHpBefore = state.player.hp;
state = act(state);
assert.deepEqual(state.enemies[0].pendingSkill?.targetPoint, lockedEyePoint);
turn = runEnemyTurn(state, { playerInvincible:false });
assert.equal(turn.magicVisuals?.[0]?.kind, "beam");
assert.deepEqual(turn.magicVisuals?.[0]?.affectedTiles, lockedEyeTiles);
state = turn.state;
assert.equal(state.enemies[0].pendingSkill, null);
assert.equal(state.player.hp, eyeHpBefore, "fixed death-gaze line can be dodged");

state = arena();
state.player.x = 113; state.player.y = 80;
state.enemies = [makeEnemy("training_leaper", "leaper", {x:110,y:80})];
state = act(state);
const lockedLeapPoint = { ...state.enemies[0].pendingSkill!.targetPoint };
assert.equal(state.enemies[0].pendingSkill?.remainingWindupTurns, 2);
state.player.x = 113; state.player.y = 78;
state = act(state);
turn = runEnemyTurn(state, { playerInvincible:false });
assert.equal(turn.magicVisuals?.some((visual) => visual.kind === "burst"), true);
state = turn.state;
assert.deepEqual({x:state.enemies[0].x,y:state.enemies[0].y}, lockedLeapPoint);
assert.equal(state.player.hp, state.player.maxHp, "telegraphed leap hits its original area");

state = arena();
state.player.x = 46; state.player.y = 80;
state.enemies = [makeEnemy("shaman_red", "shaman", {x:43,y:80})];
turn = runEnemyTurn(state, { playerInvincible:false });
assert.equal(turn.magicVisuals?.[0]?.kind, "bolt");
assert.equal(turn.magicVisuals?.[0]?.from.x, 43);
assert.equal(turn.magicVisuals?.[0]?.to.x, 46);

state = arena();
state.player.x = 80; state.player.y = 85;
state.enemies = [makeEnemy("scorpio", "scorpio", {x:83,y:85})];
turn = runEnemyTurn(state, { playerInvincible:false });
assert.equal(turn.magicVisuals?.[0]?.kind, "projectile");

console.log("enemy skill/telegraph visual smoke passed (chain, summon, bolt, projectile, gaze, leap, save/reload)");
