import { advanceExpeditionFloor, runEnemyTurn } from "./engine";
import { syncBossEncounterInPlace } from "./boss-encounter";
import { ActionResult, GameState } from "./types";

export type GameSessionOptions = {
  playerInvincible?: boolean;
  manualParty?: boolean;
};

export type TurnSessionResolution = {
  kind: "turn";
  action: ActionResult;
  elapsedTurns: number;
  enemyTurnStarts: GameState[];
  enemyTurns: ActionResult[];
  state: GameState;
};

export type FloorExitSessionResolution = {
  kind: "floorExit";
  action: ActionResult;
};

export type GameSessionResolution =
  | TurnSessionResolution
  | FloorExitSessionResolution;

/**
 * Completes the rule-side consequences of one player action.
 *
 * Presentation can delay when the returned snapshots become visible, but it
 * no longer decides how many enemy turns run or whether an exit completes the
 * expedition. The function is synchronous and deterministic for a given
 * state/action pair.
 */
export function resolveGameSession(
  action: ActionResult,
  options: GameSessionOptions = {},
): GameSessionResolution {
  syncBossEncounterInPlace(action.state);
  if (action.reachedExit && !action.state.gameOver) {
    return {
      kind: "floorExit",
      action,
    };
  }

  const elapsedTurns =
    action.elapsedTurns ?? (action.consumedTurn ? 1 : 0);
  const enemyTurns: ActionResult[] = [];
  const enemyTurnStarts: GameState[] = [];
  let state = action.state;
  for (
    let index = 0;
    index < elapsedTurns && !state.gameOver;
    index += 1
  ) {
    enemyTurnStarts.push(state);
    const enemyTurn = runEnemyTurn(state, options);
    enemyTurns.push(enemyTurn);
    state = enemyTurn.state;
  }
  return {
    kind: "turn",
    action,
    elapsedTurns,
    enemyTurnStarts,
    enemyTurns,
    state,
  };
}

export const completeFloorExit = (
  resolution: FloorExitSessionResolution,
) => advanceExpeditionFloor(resolution.action.state);
