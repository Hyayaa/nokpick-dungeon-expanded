import { GameState } from "./types";

export const random = (state: GameState) => {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 4294967296;
};

export const randomInt = (
  state: GameState,
  min: number,
  max: number,
) => Math.floor(random(state) * (max - min + 1)) + min;
