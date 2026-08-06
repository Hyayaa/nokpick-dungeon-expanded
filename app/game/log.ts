import { GameState } from "./types";

export const pushLog = (state: GameState, message: string) => {
  state.logs = [...state.logs, message].slice(-18);
};
