import { COMPANION_SKILLS } from "./companion-skills";
import { hasLineOfSight } from "./map";
import { gridDistance } from "./spatial";
import { isSkillTargetableTile } from "./targeting";
import {
  CompanionSkillId,
  GameState,
  Point,
} from "./types";

export const PLAYER_ACTOR_ID = "player";

export const partyDistance = (a: Point, b: Point) =>
  gridDistance(a, b);

export const livingPartyIds = (state: GameState) => [
  ...(state.player.hp > 0 ? [PLAYER_ACTOR_ID] : []),
  ...(state.companions ?? [])
    .filter((companion) => companion.hp > 0)
    .map((companion) => companion.id),
];

export const partyActor = (state: GameState, actorId: string) =>
  actorId === PLAYER_ACTOR_ID
    ? state.player
    : (state.companions ?? []).find(
        (companion) => companion.id === actorId,
      ) ?? state.player;

export const nearestVisibleEnemy = (
  state: GameState,
  actorId: string,
  maximumRange: number,
) => {
  const actor = partyActor(state, actorId);
  return state.enemies
    .filter(
      (enemy) =>
        enemy.hp > 0 &&
        state.tiles[enemy.y]?.[enemy.x]?.visible &&
        partyDistance(actor, enemy) <= maximumRange &&
        hasLineOfSight(state.tiles, actor, enemy),
    )
    .sort(
      (a, b) =>
        partyDistance(actor, a) - partyDistance(actor, b) ||
        a.hp - b.hp,
    )[0] ?? null;
};

export const suggestedSkillTarget = (
  state: GameState,
  casterId: string,
  skillId: CompanionSkillId,
): Point | null => {
  const definition = COMPANION_SKILLS[skillId];
  const caster = partyActor(state, casterId);
  if (definition.range === 0) return { x: caster.x, y: caster.y };
  if (definition.target === "ally") {
    return [state.player, ...(state.companions ?? [])]
      .filter(
        (actor) =>
          actor.hp > 0 &&
          actor.hp < actor.maxHp &&
          isSkillTargetableTile(
            state,
            caster,
            actor,
            definition.range,
            definition.requiresLineOfFire,
          ),
      )
      .sort(
        (a, b) =>
          a.hp / Math.max(1, a.maxHp) -
            b.hp / Math.max(1, b.maxHp) ||
          partyDistance(caster, a) - partyDistance(caster, b),
      )
      .map((actor) => ({ x: actor.x, y: actor.y }))[0] ?? null;
  }
  const enemy = state.enemies
    .filter(
      (candidate) =>
        candidate.hp > 0 &&
        state.tiles[candidate.y]?.[candidate.x]?.visible &&
        isSkillTargetableTile(
          state,
          caster,
          candidate,
          definition.range,
          definition.requiresLineOfFire,
        ),
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - caster.x, a.y - caster.y) -
          Math.hypot(b.x - caster.x, b.y - caster.y) ||
        a.hp - b.hp,
    )[0] ?? null;
  return enemy ? { x: enemy.x, y: enemy.y } : null;
};
