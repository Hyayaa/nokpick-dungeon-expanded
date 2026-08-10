import assert from "node:assert/strict";
import {
  createNewGame,
  developerGrantItem,
  developerSpawnEnemy,
  playerStep,
  runEnemyTurn,
  throwItem,
  zapWand,
} from "../app/game/engine";
import type { CombatEffect, EnemyKind } from "../app/game/types";
import {
  groundItemComesFromDefeatedEnemy,
  timingSourceIdForEffect,
} from "../app/presentation/combat-feedback";
import {
  createTurnMotionTimeline,
  DEATH_EVENT_DELAY,
  DEATH_SECONDARY_EFFECT_DELAY,
  impactDelayForMotion,
  impactTimeForSource,
  presentationOffsetForCombatEffect,
  worldRevealOffsetForDefeat,
} from "../app/presentation/timing";

const loneEnemyState = (kind: EnemyKind, seed: number) => {
  const state = developerSpawnEnemy(createNewGame(seed), kind);
  const enemy = state.enemies.at(-1)!;
  state.enemies = [enemy];
  enemy.alerted = true;
  enemy.sleeping = false;
  enemy.sawPlayerLastTurn = true;
  enemy.accuracy = 1_000;
  enemy.evasion = 0;
  return { state, enemy };
};

const effectAt = (
  effects: CombatEffect[],
  x: number,
  y: number,
  kind: CombatEffect["kind"],
) => effects.find((effect) => effect.x === x && effect.y === y && effect.kind === kind)!;

{
  const { state, enemy } = loneEnemyState("skeleton", 0xd34d0001);
  const companion = state.companions[0];
  state.companions = [companion];
  enemy.x = state.player.x + 1;
  enemy.y = state.player.y;
  enemy.hp = 1;
  enemy.maxHp = 1;
  enemy.defense = 0;
  companion.x = state.player.x;
  companion.y = state.player.y + 1;
  companion.hp = 1;
  companion.baseDefense = 0;
  companion.actionCooldown = 99;
  state.player.baseAttack = 100;
  state.player.accuracy = 1_000;

  const result = playerStep(state, 1, 0);
  assert.deepEqual(result.defeatedIds, [enemy.id]);
  assert.equal(result.state.enemies.some((candidate) => candidate.id === enemy.id), false);
  assert.equal(result.state.companions[0].hp, 0);

  const primaryDamage = effectAt(result.effects, enemy.x, enemy.y, "damage");
  const skeletonDefeat = effectAt(result.effects, enemy.x, enemy.y, "defeat");
  const explosionDamage = effectAt(
    result.effects,
    companion.x,
    companion.y,
    "damage",
  );
  const companionDefeat = effectAt(
    result.effects,
    companion.x,
    companion.y,
    "defeat",
  );
  assert.equal(primaryDamage.sourceId, "player");
  assert.deepEqual(
    {
      sourceId: skeletonDefeat.sourceId,
      timingSourceId: skeletonDefeat.timingSourceId,
      depth: skeletonDefeat.deathChainDepth,
    },
    { sourceId: "player", timingSourceId: "player", depth: 0 },
  );
  assert.deepEqual(
    {
      sourceId: explosionDamage.sourceId,
      timingSourceId: explosionDamage.timingSourceId,
      depth: explosionDamage.deathChainDepth,
    },
    { sourceId: enemy.id, timingSourceId: "player", depth: 1 },
  );
  assert.deepEqual(
    {
      sourceId: companionDefeat.sourceId,
      timingSourceId: companionDefeat.timingSourceId,
      depth: companionDefeat.deathChainDepth,
    },
    { sourceId: enemy.id, timingSourceId: "player", depth: 1 },
  );

  const timeline = createTurnMotionTimeline(result.motions);
  const attack = timeline.motions.find(
    ({ motion }) => motion.id === "player" && motion.kind === "attack",
  )!;
  const impactAt = attack.delay + impactDelayForMotion(attack.motion);
  assert.equal(presentationOffsetForCombatEffect(primaryDamage), 0);
  assert.equal(
    impactAt + presentationOffsetForCombatEffect(skeletonDefeat),
    impactAt + DEATH_EVENT_DELAY,
  );
  assert.equal(
    impactAt + presentationOffsetForCombatEffect(explosionDamage),
    impactAt + DEATH_EVENT_DELAY + DEATH_SECONDARY_EFFECT_DELAY,
  );
  assert.equal(
    impactAt + presentationOffsetForCombatEffect(companionDefeat),
    impactAt + DEATH_EVENT_DELAY * 2 + DEATH_SECONDARY_EFFECT_DELAY,
  );
}

{
  const { state, enemy } = loneEnemyState("rat", 0xd34d0002);
  const companion = state.companions[0];
  state.companions = [companion];
  companion.hp = 1;
  companion.baseDefense = 0;
  companion.x = state.player.x + 1;
  companion.y = state.player.y;
  companion.actionCooldown = 99;
  enemy.x = companion.x + 1;
  enemy.y = companion.y;
  enemy.attack = 100;
  state.player.x -= 3;

  const turn = runEnemyTurn(state, { playerInvincible: false });
  const defeat = effectAt(
    turn.effects,
    companion.x,
    companion.y,
    "defeat",
  );
  const timeline = createTurnMotionTimeline(turn.motions);
  const attack = timeline.motions.find(
    ({ motion }) => motion.id === enemy.id && motion.kind === "attack",
  )!;
  assert.equal(
    attack.delay +
      impactDelayForMotion(attack.motion) +
      presentationOffsetForCombatEffect(defeat),
    attack.delay + impactDelayForMotion(attack.motion) + DEATH_EVENT_DELAY,
  );
}

{
  const { state, enemy } = loneEnemyState("rat", 0xd34d0003);
  state.companions = [];
  state.player.hp = 1;
  state.player.baseDefense = 0;
  enemy.x = state.player.x + 1;
  enemy.y = state.player.y;
  enemy.attack = 100;
  const turn = runEnemyTurn(state, { playerInvincible: false });
  assert.equal(turn.state.gameOver, true);
  const damage = effectAt(
    turn.effects,
    state.player.x,
    state.player.y,
    "damage",
  );
  const timeline = createTurnMotionTimeline(turn.motions);
  const attack = timeline.motions.find(
    ({ motion }) => motion.id === enemy.id && motion.kind === "attack",
  )!;
  const impactAt = attack.delay + impactDelayForMotion(attack.motion);
  assert.equal(
    impactAt + presentationOffsetForCombatEffect(damage) + DEATH_EVENT_DELAY,
    impactAt + DEATH_EVENT_DELAY,
  );
}

const lethalRangedTarget = (kind: "throw" | "magic") => {
  const { state: initial, enemy } = loneEnemyState(
    "rat",
    kind === "throw" ? 0xd34d0004 : 0xd34d0005,
  );
  enemy.hp = 1;
  enemy.maxHp = 1;
  enemy.defense = 0;
  return { initial, enemy };
};

{
  const { initial, enemy } = lethalRangedTarget("throw");
  const state = developerGrantItem(initial, "throwing_stone", 1);
  const item = state.player.inventoryInstances.find(
    (instance) => instance.defId === "throwing_stone",
  )!;
  const result = throwItem(state, item.id, enemy);
  const visual = result.throws![0];
  const defeat = result.effects.find((effect) => effect.kind === "defeat")!;
  const impactSchedule = new Map([
    [`throw-${visual.defId}`, 270],
    [visual.id, 270],
  ]);
  assert.equal(timingSourceIdForEffect(defeat), `throw-${visual.defId}`);
  assert.equal(
    impactTimeForSource(timingSourceIdForEffect(defeat), [impactSchedule]),
    270,
  );
}

{
  const { initial, enemy } = lethalRangedTarget("magic");
  const state = developerGrantItem(initial, "wand_magic_missile", 1);
  const wand = state.player.inventoryInstances.find(
    (instance) => instance.defId === "wand_magic_missile",
  )!;
  const result = zapWand(state, wand.id, enemy);
  const visual = result.magicVisuals![0];
  const defeat = result.effects.find((effect) => effect.kind === "defeat")!;
  assert.equal(visual.sourceId, timingSourceIdForEffect(defeat));
  assert.equal(
    impactTimeForSource(
      timingSourceIdForEffect(defeat),
      [new Map([[visual.sourceId!, 459]])],
    ),
    459,
  );
}

{
  const aoeDefeats: CombatEffect[] = [0, 1, 2].map((x) => ({
    x,
    y: 0,
    text: "처치!",
    color: "#ffd56a",
    kind: "defeat",
    sourceId: "aoe-caster",
    timingSourceId: "aoe-caster",
  }));
  assert.deepEqual(
    aoeDefeats.map(presentationOffsetForCombatEffect),
    [DEATH_EVENT_DELAY, DEATH_EVENT_DELAY, DEATH_EVENT_DELAY],
  );
}

{
  const gooDefeat: CombatEffect = {
    x: 10,
    y: 10,
    text: "처치!",
    color: "#ffd56a",
    kind: "defeat",
    sourceId: "player",
    timingSourceId: "player",
  };
  assert.equal(
    groundItemComesFromDefeatedEnemy(
      "boss-exit-key-goo-enemy",
      "goo-enemy",
    ),
    true,
  );
  assert.ok(
    worldRevealOffsetForDefeat(gooDefeat) >
      presentationOffsetForCombatEffect(gooDefeat),
  );
}

console.log(
  "death event timing smoke passed (melee, skeleton chain, companion/player defeat, projectile, magic, AoE, boss key)",
);
