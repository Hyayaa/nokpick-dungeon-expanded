import { executeCombatSkillCore, resolveCombatSkillAffectedTiles } from "./combat-skills";
import { ENEMY_DEFINITIONS, enemyDefinition } from "./enemy-definitions";
import {
  enemySkill,
  type EnemySkillUseRule,
  type EnemySkillVisualProfile,
  type EnemyTargetPolicy,
} from "./enemy-skills";
import { hasLineOfSight, isWalkable, mapPointKey } from "./map";
import { random, randomInt } from "./random";
import {
  applyBossMeleeIdentity,
  syncBossPhaseInPlace,
} from "./boss-behaviors";
import type {
  CombatEffect, Companion, Enemy, EnemyKind, EnemySkillId, GameState, MagicVisual,
  Motion, Player, Point, StatusEffect, StatusSignal,
} from "./types";

type PartyTarget = Player | Companion;
type SkillTurnOutput = {
  motions: Motion[];
  effects: CombatEffect[];
  signals: StatusSignal[];
  magicVisuals: MagicVisual[];
  playerInvincible?: boolean;
};

const distance = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const addStatus = (statuses: StatusEffect[], id: StatusEffect["id"], turns: number, power = 1) => {
  const current = statuses.find((status) => status.id === id);
  if (current) {
    current.turns = Math.max(current.turns, turns);
    current.power = Math.max(current.power, power);
  } else statuses.push({ id, turns, power });
};
const partyTargets = (state: GameState) => [state.player, ...(state.companions ?? []).filter((ally) => ally.hp > 0)];
const targetId = (state: GameState, target: PartyTarget) =>
  target === state.player ? "player" : "id" in target ? target.id : "player";
const targetById = (state: GameState, id: string | null): PartyTarget | null => {
  if (id === "player") return state.player;
  return (state.companions ?? []).find((ally) => ally.id === id && ally.hp > 0) ?? null;
};
const targetAt = (state: GameState, point: Point) => partyTargets(state).find((target) => target.x === point.x && target.y === point.y) ?? null;
const visibleTargets = (state: GameState, enemy: Enemy) => partyTargets(state).filter(
  (target) =>
    !(target === state.player && state.player.invisibleTurns > 0) &&
    distance(enemy, target) <= 10 &&
    hasLineOfSight(state.tiles, enemy, target),
);

const chooseTarget = (state: GameState, enemy: Enemy, policy: EnemyTargetPolicy = "nearest") => {
  const candidates = visibleTargets(state, enemy);
  if (!candidates.length) return null;
  if (policy === "lowestHP") {
    return candidates.sort((a, b) => a.hp / Math.max(1, a.maxHp) - b.hp / Math.max(1, b.maxHp))[0];
  }
  if (policy === "rangedPriority") {
    return candidates.sort((a, b) => distance(b, enemy) - distance(a, enemy))[0];
  }
  const last = enemy.lastSeenPlayer;
  if (policy === "currentAggro" && last) {
    const current = candidates.find((candidate) => candidate.x === last.x && candidate.y === last.y);
    if (current) return current;
  }
  return candidates.sort((a, b) => distance(a, enemy) - distance(b, enemy))[0];
};

const occupied = (state: GameState, ignoredEnemyId?: string) => new Set([
  mapPointKey(state.player),
  ...(state.companions ?? []).filter((ally) => ally.hp > 0).map(mapPointKey),
  ...state.enemies.filter((enemy) => enemy.hp > 0 && enemy.id !== ignoredEnemyId).map(mapPointKey),
  ...(state.questNpcs ?? []).map(mapPointKey),
]);
export const canEnemyOccupy = (state: GameState, point: Point, kind: EnemyKind, ignoredEnemyId?: string) => {
  const tile = state.tiles[point.y]?.[point.x];
  if (!tile || occupied(state, ignoredEnemyId).has(mapPointKey(point))) return false;
  const flying = ENEMY_DEFINITIONS[kind].properties.includes("flying");
  return flying ? tile.terrain !== "wall" && tile.terrain !== "crystalDoor" && tile.terrain !== "barricade" : isWalkable(tile.terrain, false);
};

/** Strict placement validation for actors created after floor generation. */
export const canEnemySpawnAt = (
  state: GameState,
  point: Point,
  kind: EnemyKind,
) => {
  const tile = state.tiles[point.y]?.[point.x];
  if (!tile || !canEnemyOccupy(state, point, kind)) return false;
  if (
    [
      "door",
      "openDoor",
      "lockedDoor",
      "crystalDoor",
      "barricade",
      "entrance",
      "exit",
      "chasm",
    ].includes(tile.terrain)
  ) return false;
  if (state.groundItems.some((item) => mapPointKey(item) === mapPointKey(point))) return false;
  if (state.objects.some((object) => !object.looted && mapPointKey(object) === mapPointKey(point))) return false;
  if ((state.traps ?? []).some((trap) => trap.active && mapPointKey(trap) === mapPointKey(point))) return false;
  if (
    (state.specialRooms ?? []).some(
      (room) =>
        point.x >= room.left &&
        point.x <= room.right &&
        point.y >= room.top &&
        point.y <= room.bottom,
    )
  ) return false;
  return !(state.clouds ?? []).some(
    (cloud) =>
      (cloud.variant === "magicalFire" || cloud.power > 0) &&
      cloud.tiles.some((cloudTile) => mapPointKey(cloudTile) === mapPointKey(point)),
  );
};

const scaledSummon = (state: GameState, owner: Enemy, kind: EnemyKind, point: Point): Enemy => {
  const definition = enemyDefinition(kind);
  const scale = Math.max(1, owner.maxHp / Math.max(1, enemyDefinition(owner.kind).baseStats.hp));
  const stat = (value: number) => Math.max(1, Math.round(value * scale));
  return {
    id: `summon-${owner.id}-${state.turn}-${randomInt(state, 0, 0xffff)}`,
    kind,
    ...point,
    hp: stat(definition.baseStats.hp), maxHp: stat(definition.baseStats.hp),
    attack: stat(definition.baseStats.attack), defense: stat(definition.baseStats.defense),
    accuracy: stat(definition.baseStats.accuracy), evasion: stat(definition.baseStats.evasion),
    xp: definition.xp, alerted: true, sawPlayerLastTurn: true, sleeping: false,
    wakeCooldown: 0, lastSeenPlayer: { x: state.player.x, y: state.player.y }, searchTurns: 0,
    statuses: [], skillCooldowns: {}, skillUses: {}, pendingSkill: null,
    summonOwnerId: owner.id, faction: owner.faction ?? "hostile", drop: null,
  };
};

const summonKindForSkill = (skillId: EnemySkillId): EnemyKind | null =>
  skillId === "summonSkeleton" ? "necro_skeleton"
    : skillId === "summonWraith" ? "wraith"
      : skillId === "summonRipper" ? "ripper_demon" : null;

const createCloud = (state: GameState, kind: "toxic" | "corrosive", tiles: readonly Point[], power: number) => {
  const valid = tiles.filter((point) => state.tiles[point.y]?.[point.x] && state.tiles[point.y][point.x].terrain !== "wall");
  if (!valid.length) return;
  state.clouds.push({
    id: `enemy-cloud-${kind}-${state.turn}-${state.clouds.length}`,
    kind, origin: { ...valid[0] },
    tiles: valid.map((point) => ({ ...point, remaining: 5, intensity: 1 })),
    maxRadius: 0, spreadPerTurn: 0, tileLifetime: 5, turns: 5, power,
  });
};

const damageTarget = (state: GameState, enemy: Enemy, target: PartyTarget, amount: number, output: SkillTurnOutput) => {
  const damage = output.playerInvincible && target === state.player ? 0 : Math.max(1, Math.round(amount - Math.max(0, target.baseDefense ?? 0) * 0.35));
  target.hp = Math.max(0, target.hp - damage);
  output.effects.push({ x: target.x, y: target.y, text: damage ? `-${damage}` : "무효", color: damage ? "#ff6969" : "#8ce7ff", kind: damage ? "damage" : "blocked", sourceId: enemy.id });
};

const applySkillStatus = (enemy: Enemy, target: PartyTarget, skillId: EnemySkillId) => {
  if (skillId === "chainPull" || skillId === "cripplingShot") addStatus(target.statuses, "crippled", skillId === "chainPull" ? 4 : 3);
  if (skillId === "acidicShot" || skillId === "corrosiveVent") addStatus(target.statuses, "corroded", 4, 1);
  if (skillId === "darkBolt") addStatus(target.statuses, "degraded", 5);
  if (skillId === "poisonWeb") { addStatus(target.statuses, "rooted", 2); addStatus(target.statuses, "poisoned", 5, 1); }
  if (skillId === "charm") addStatus(target.statuses, "charmed", 4);
  if (skillId === "shamanBolt") {
    addStatus(target.statuses, enemy.kind === "shaman_red" ? "weakened" : enemy.kind === "shaman_blue" ? "vulnerable" : "hexed", 4);
  }
  if (skillId === "elementalBolt") {
    if (enemy.kind === "elemental_fire") addStatus(target.statuses, "burning", 6, 1);
    if (enemy.kind === "elemental_frost") addStatus(target.statuses, "chilled", 4, 1);
    if (enemy.kind === "elemental_shock") addStatus(target.statuses, "blinded", 3, 1);
    if (enemy.kind === "elemental_chaos") addStatus(target.statuses, "hexed", 3, 1);
  }
  if (skillId === "shockLeap" && enemy.kind === "ripper_demon") {
    addStatus(target.statuses, "bleeding", 5, 1);
  }
};

const identityVisualColors = (
  enemy: Enemy,
  profile: EnemySkillVisualProfile,
) => {
  if (enemy.kind === "shaman_red") return { color: "#ef6b65", secondaryColor: "#ffd0a8" };
  if (enemy.kind === "shaman_blue") return { color: "#62aee8", secondaryColor: "#ccecff" };
  if (enemy.kind === "shaman_purple") return { color: "#a66bd3", secondaryColor: "#f0d2ff" };
  if (enemy.kind === "elemental_frost") return { color: "#72d8ee", secondaryColor: "#e8fbff" };
  if (enemy.kind === "elemental_shock") return { color: "#fff37a", secondaryColor: "#8bdcff" };
  if (enemy.kind === "elemental_chaos") return { color: "#c879d8", secondaryColor: "#82e0b3" };
  return { color: profile.color, secondaryColor: profile.secondaryColor };
};

const emitSkillVisual = (
  state: GameState,
  enemy: Enemy,
  skillId: EnemySkillId,
  from: Point,
  to: Point,
  affectedTiles: readonly Point[],
  output: SkillTurnOutput,
) => {
  const profile = enemySkill(skillId)?.visual;
  if (!profile || profile.kind === "none") return;
  const visiblePoints = [from, to, ...affectedTiles];
  if (!visiblePoints.some((point) => state.tiles[point.y]?.[point.x]?.visible)) return;
  const kind: MagicVisual["kind"] = profile.kind === "magicBolt"
    ? "bolt"
    : profile.kind;
  const colors = identityVisualColors(enemy, profile);
  output.magicVisuals.push({
    id: `enemy-skill-${enemy.id}-${skillId}-${state.turn}-${output.magicVisuals.length}`,
    kind,
    from: { ...from },
    to: { ...to },
    affectedTiles: affectedTiles.map((point) => ({ ...point })),
    color: colors.color,
    secondaryColor: colors.secondaryColor,
    width: profile.width,
    durationMs: profile.durationMs,
    impactStyle: profile.impactStyle,
    sourceId: enemy.id,
  });
};

const executeSkill = (state: GameState, enemy: Enemy, skillId: EnemySkillId, targetIdValue: string | null, targetPoint: Point, affectedTiles: readonly Point[], output: SkillTurnOutput) => {
  const blueprint = enemySkill(skillId);
  if (!blueprint) return;
  const casterPoint = { x: enemy.x, y: enemy.y };
  if (blueprint.travelMode === "none") {
    output.motions.push({
      id: enemy.id,
      from: { x: enemy.x, y: enemy.y },
      to: { ...targetPoint },
      kind: "attack",
      special: Boolean(enemyDefinition(enemy.kind).sprite.specialFrames?.length),
    });
  }
  const directTarget = targetById(state, targetIdValue) ?? targetAt(state, targetPoint);
  const summonKind = summonKindForSkill(skillId);
  if (summonKind) {
    const points: Point[] = [];
    for (let radius = 1; radius <= 2; radius += 1) {
      for (let y = targetPoint.y - radius; y <= targetPoint.y + radius; y += 1) {
        for (let x = targetPoint.x - radius; x <= targetPoint.x + radius; x += 1) points.push({ x, y });
      }
    }
    const point = points.find((candidate) => canEnemyOccupy(state, candidate, summonKind));
    if (point) {
      const summon = scaledSummon(state, enemy, summonKind, point);
      state.enemies.push(summon);
      enemy.summonIds = [...(enemy.summonIds ?? []).filter((id) => state.enemies.some((candidate) => candidate.id === id && candidate.hp > 0)), summon.id];
      output.signals.push({ ...point, text:"소환!", color:"#c9a0ff", sourceId:enemy.id });
      emitSkillVisual(state, enemy, skillId, casterPoint, point, [point], output);
    }
    return;
  }
  if (skillId === "chainPull" && directTarget) {
    emitSkillVisual(
      state,
      enemy,
      skillId,
      casterPoint,
      { x: directTarget.x, y: directTarget.y },
      affectedTiles,
      output,
    );
    const landing = affectedTiles.slice(0, -1).find((point) => canEnemyOccupy(state, point, "rat"));
    if (landing) {
      const from = { x: directTarget.x, y: directTarget.y };
      directTarget.x = landing.x; directTarget.y = landing.y;
      output.motions.push({ id: targetId(state, directTarget), from, to: landing, kind:"move", travelStyle:"charge" });
      applySkillStatus(enemy, directTarget, skillId);
    }
    return;
  }
  if (skillId === "teleportSelf" || skillId === "charm") {
    const destination = affectedTiles
      .flatMap((point) => [{x:point.x+1,y:point.y},{x:point.x-1,y:point.y},{x:point.x,y:point.y+1},{x:point.x,y:point.y-1}])
      .find((point) => canEnemyOccupy(state, point, enemy.kind, enemy.id));
    if (destination) {
      const from = { x: enemy.x, y: enemy.y };
      enemy.x = destination.x; enemy.y = destination.y;
      output.motions.push({ id:enemy.id, from, to:destination, kind:"move", travelStyle:"teleport" });
      emitSkillVisual(state, enemy, skillId, from, destination, [destination], output);
    }
    if (directTarget && skillId === "charm") applySkillStatus(enemy, directTarget, skillId);
    return;
  }
  let impactTiles = [...affectedTiles];
  if (skillId === "shockLeap" || skillId === "drivingLeap") {
    executeCombatSkillCore(
      blueprint,
      { x: enemy.x, y: enemy.y },
      targetPoint,
      {
        onMove: (destination, travelMode) => {
          if (!canEnemyOccupy(state, destination, enemy.kind, enemy.id)) return;
          const from = { x: enemy.x, y: enemy.y };
          enemy.x = destination.x; enemy.y = destination.y;
          output.motions.push({
            id: enemy.id,
            from,
            to: destination,
            kind: "move",
            travelStyle: travelMode === "none" ? "walk" : travelMode,
            special: Boolean(enemyDefinition(enemy.kind).sprite.specialFrames?.length),
          });
        },
        onImpact: (tiles) => { impactTiles = [...tiles]; },
      },
      affectedTiles,
    );
  }
  if (skillId === "toxicVent") createCloud(state, "toxic", affectedTiles, 2);
  if (skillId === "corrosiveVent") createCloud(state, "corrosive", affectedTiles, 2);
  const visualTarget = blueprint.footprint === "line"
    ? affectedTiles.at(-1) ?? targetPoint
    : targetPoint;
  emitSkillVisual(
    state,
    enemy,
    skillId,
    casterPoint,
    visualTarget,
    impactTiles,
    output,
  );
  const victims = partyTargets(state).filter((target) => impactTiles.some((point) => point.x === target.x && point.y === target.y));
  for (const target of victims) {
    const power = blueprint.scalars.power ?? 1;
    damageTarget(state, enemy, target, enemy.attack * power + randomInt(state, -2, 2), output);
    applySkillStatus(enemy, target, skillId);
  }
};

const cooldownReady = (enemy: Enemy, ruleValue: EnemySkillUseRule) => (enemy.skillCooldowns?.[ruleValue.skillId] ?? 0) <= 0;
const usesReady = (enemy: Enemy, ruleValue: EnemySkillUseRule) => ruleValue.maxUses === undefined || (enemy.skillUses?.[ruleValue.skillId] ?? 0) < ruleValue.maxUses;
const usableRule = (state: GameState, enemy: Enemy, ruleValue: EnemySkillUseRule) => {
  if (!cooldownReady(enemy, ruleValue) || !usesReady(enemy, ruleValue)) return null;
  if (ruleValue.hpThreshold !== undefined && enemy.hp / Math.max(1, enemy.maxHp) > ruleValue.hpThreshold) return null;
  if (ruleValue.requiresMinionAbsent && (enemy.summonIds ?? []).some((id) => state.enemies.some((candidate) => candidate.id === id && candidate.hp > 0))) return null;
  if (
    ruleValue.maxActiveSummons !== undefined &&
    (enemy.summonIds ?? []).filter((id) =>
      state.enemies.some((candidate) => candidate.id === id && candidate.hp > 0),
    ).length >= ruleValue.maxActiveSummons
  ) return null;
  const target = chooseTarget(state, enemy, ruleValue.targetPolicy);
  if (!target) return null;
  const range = distance(enemy, target);
  if (range < (ruleValue.minRange ?? 0) || range > (ruleValue.maxRange ?? enemySkill(ruleValue.skillId)?.range ?? 1)) return null;
  if (ruleValue.requiresLineOfSight && !hasLineOfSight(state.tiles, enemy, target)) return null;
  return target;
};

export const cancelInterruptibleEnemyWindup = (enemy: Enemy) => {
  if (!enemy.pendingSkill?.interruptible) return false;
  enemy.pendingSkill = null;
  return true;
};

export const runEnemySkillTurn = (state: GameState, enemy: Enemy, output: SkillTurnOutput) => {
  enemy.summonIds = (enemy.summonIds ?? []).filter((id) =>
    state.enemies.some((candidate) => candidate.id === id && candidate.hp > 0),
  );
  const supportCooldown = Math.max(
    0,
    Number(enemy.behaviorState?.supportCooldown ?? 0) - 1,
  );
  enemy.behaviorState = { ...(enemy.behaviorState ?? {}), supportCooldown };
  if (enemy.kind === "monk" || enemy.kind === "senior") {
    const cooldown = Number(enemy.behaviorState?.focusCooldown ?? 0);
    enemy.behaviorState = {
      ...(enemy.behaviorState ?? {}),
      focusCooldown: Math.max(0, cooldown - (enemy.kind === "senior" ? 2 : 1)),
      focused: cooldown <= (enemy.kind === "senior" ? 2 : 1),
    };
  }
  enemy.skillCooldowns = Object.fromEntries(Object.entries(enemy.skillCooldowns ?? {}).map(([id, turns]) => [id, Math.max(0, (turns ?? 0) - 1)]));
  const pending = enemy.pendingSkill;
  if (pending) {
    if (pending.targetLockMode === "tracking") {
      const tracked = targetById(state, pending.targetId);
      const blueprint = enemySkill(pending.skillId);
      if (tracked && blueprint) {
        pending.targetPoint = { x: tracked.x, y: tracked.y };
        pending.affectedTiles = resolveCombatSkillAffectedTiles(blueprint, enemy, pending.targetPoint)
          .filter((point) => state.tiles[point.y]?.[point.x]);
      }
    }
    if (pending.remainingWindupTurns > 1) {
      pending.remainingWindupTurns -= 1;
      return true;
    }
    executeSkill(state, enemy, pending.skillId, pending.targetId, pending.targetPoint, pending.affectedTiles, output);
    enemy.skillCooldowns[pending.skillId] = enemySkill(pending.skillId)?.cooldown ?? 1;
    enemy.skillUses = { ...(enemy.skillUses ?? {}), [pending.skillId]: (enemy.skillUses?.[pending.skillId] ?? 0) + 1 };
    enemy.pendingSkill = null;
    return true;
  }

  const definition = enemyDefinition(enemy.kind);
  if (
    definition.skills.some(
      (skillId) => skillId === "summonSkeleton" || skillId === "summonWraith",
    ) &&
    enemy.summonIds.length > 0 &&
    supportCooldown <= 0
  ) {
    const summon = enemy.summonIds
      .map((id) => state.enemies.find((candidate) => candidate.id === id && candidate.hp > 0))
      .filter((candidate): candidate is Enemy => Boolean(candidate))
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (summon && summon.hp < summon.maxHp) {
      const healing = Math.max(1, Math.round(summon.maxHp * 0.2));
      summon.hp = Math.min(summon.maxHp, summon.hp + healing);
      enemy.behaviorState.supportCooldown = 2;
      output.effects.push({
        x: summon.x, y: summon.y, text: `+${healing}`,
        color: "#b996ff", kind: "healing", sourceId: enemy.id,
      });
      return true;
    }
  }
  const candidates = definition.skillRules
    .map((candidate) => ({ rule: candidate, target: usableRule(state, enemy, candidate) }))
    .filter((candidate): candidate is { rule: EnemySkillUseRule; target: PartyTarget } => Boolean(candidate.target))
    .sort((a, b) => b.rule.priority - a.rule.priority);
  const chosen = candidates[0];
  if (!chosen) return false;
  const blueprint = enemySkill(chosen.rule.skillId);
  if (!blueprint) return false;
  const chosenPoint = blueprint.areaAnchor === "caster"
    ? { x: enemy.x, y: enemy.y }
    : { x: chosen.target.x, y: chosen.target.y };
  const affectedTiles = resolveCombatSkillAffectedTiles(blueprint, enemy, chosenPoint)
    .filter((point) => state.tiles[point.y]?.[point.x]);
  const windupTurns = Math.max(0, chosen.rule.windupTurns ?? 0);
  if (windupTurns > 0) {
    enemy.pendingSkill = {
      skillId: chosen.rule.skillId, casterId: enemy.id,
      targetId: targetId(state, chosen.target), targetPoint: chosenPoint, affectedTiles,
      remainingWindupTurns: windupTurns, startedTurn: state.turn,
      interruptible: chosen.rule.interruptible ?? true,
      targetLockMode: chosen.rule.targetLockMode ?? "fixed",
    };
    output.signals.push({ x:enemy.x, y:enemy.y, text:`${blueprint.name} 준비`, color:"#ff7a70", sourceId:enemy.id, holdUntilTurnEnd:true });
    return true;
  }
  executeSkill(state, enemy, chosen.rule.skillId, targetId(state, chosen.target), chosenPoint, affectedTiles, output);
  enemy.skillCooldowns[chosen.rule.skillId] = chosen.rule.cooldown ?? blueprint.cooldown;
  enemy.skillUses = { ...(enemy.skillUses ?? {}), [chosen.rule.skillId]: (enemy.skillUses?.[chosen.rule.skillId] ?? 0) + 1 };
  return true;
};

export const applyEnemyMeleeIdentity = (state: GameState, enemy: Enemy, target: PartyTarget, damage: number) => {
  applyBossMeleeIdentity(state, enemy, target);
  if (enemy.kind === "bat") enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.max(0, damage - 4));
  if (enemy.kind === "albino" && random(state) < 0.5) addStatus(target.statuses, "bleeding", 4, 1);
  if (enemy.kind === "caustic_slime" && random(state) < 0.5) addStatus(target.statuses, "corroded", 4, 1);
  if (enemy.kind === "spinner" && random(state) < 0.5) addStatus(target.statuses, "poisoned", 7, 1);
  if (enemy.kind === "succubus" && random(state) < 1 / 3) addStatus(target.statuses, "charmed", 4);
  if (enemy.kind === "bandit") {
    addStatus(target.statuses, "blinded", 3); addStatus(target.statuses, "poisoned", 5); addStatus(target.statuses, "crippled", 3);
  }
  if (enemy.kind === "thief" || enemy.kind === "bandit") {
    const stolen = Math.min(state.goldCollected, randomInt(state, 8, 20));
    state.goldCollected -= stolen; enemy.goldDrop = (enemy.goldDrop ?? 0) + stolen;
    enemy.behaviorState = { ...(enemy.behaviorState ?? {}), fleeing: true };
  }
};

export const applyEnemyIncomingDamage = (
  state: GameState,
  enemy: Enemy,
  rawDamage: number,
  ranged = false,
) => {
  let damage = Math.max(0, Math.round(rawDamage));
  enemy.behaviorState = { ...(enemy.behaviorState ?? {}), provoked: true };
  if (enemy.pendingSkill?.skillId === "deathGaze") {
    damage = Math.max(1, Math.floor(damage / 4));
  }
  if (enemy.kind === "slime" || enemy.kind === "caustic_slime") {
    damage = damage < 5 ? damage : Math.round(4 + (Math.sqrt(8 * (damage - 4) + 1) - 1) / 2);
  }
  if (enemy.kind === "dm201" && ranged) damage = Math.max(1, Math.floor(damage / 2));
  if ((enemy.kind === "monk" || enemy.kind === "senior") && enemy.behaviorState?.focused !== false) {
    enemy.behaviorState = {
      ...(enemy.behaviorState ?? {}),
      focused: false,
      focusCooldown: enemy.kind === "senior" ? 4 : 7,
    };
    return 0;
  }
  enemy.hp -= damage;
  syncBossPhaseInPlace(state, enemy);
  if (enemy.kind === "swarm" && enemy.hp > 1 && damage > 0) {
    const points = [
      {x:enemy.x+1,y:enemy.y},{x:enemy.x-1,y:enemy.y},
      {x:enemy.x,y:enemy.y+1},{x:enemy.x,y:enemy.y-1},
    ];
    const point = points.find((candidate) => canEnemyOccupy(state, candidate, "swarm"));
    if (point) {
      const splitHp = Math.max(1, Math.floor(enemy.hp / 2));
      enemy.hp -= splitHp;
      const child = scaledSummon(state, enemy, "swarm", point);
      child.hp = splitHp; child.maxHp = splitHp; child.xp = 0; child.summonOwnerId = undefined;
      state.enemies.push(child);
    }
  }
  return damage;
};

/** Generic summon ownership cleanup and death mechanics, called before removal. */
export const resolveEnemyDeathMechanics = (state: GameState, enemy: Enemy, effects: CombatEffect[]) => {
  if (enemy.hp > 0) return false;
  if ((enemy.kind === "brute" || enemy.kind === "armored_brute") && !enemy.behaviorState?.raged) {
    enemy.hp = Math.max(1, Math.round(enemy.maxHp / 2));
    enemy.attack = Math.round(enemy.attack * 1.45);
    enemy.behaviorState = { ...(enemy.behaviorState ?? {}), raged:true };
    addStatus(enemy.statuses, "shielded", enemy.kind === "armored_brute" ? 10 : 5, Math.round(enemy.maxHp / 2));
    return true;
  }
  if (enemy.kind === "ghoul" && state.enemies.some((candidate) => candidate.id !== enemy.id && candidate.kind === "ghoul" && candidate.hp > 0)) {
    enemy.hp = Math.max(1, Math.round(enemy.maxHp * 0.1));
    addStatus(enemy.statuses, "paralyzed", 5);
    return true;
  }
  if (enemy.kind === "skeleton" || enemy.kind === "necro_skeleton") {
    for (const target of partyTargets(state).filter((candidate) => distance(candidate, enemy) <= 1)) {
      damageTarget(state, enemy, target, Math.max(2, Math.round(enemy.attack * 0.7)), { effects, motions:[], signals:[] });
    }
  }
  for (const summonId of enemy.summonIds ?? []) {
    const summon = state.enemies.find((candidate) => candidate.id === summonId);
    if (summon) summon.hp = 0;
  }
  return false;
};
