import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DungeonGame from "../app/components/DungeonGame";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("로컬 게임 화면을 초기화할 수 없습니다.");
}

createRoot(root).render(
  <StrictMode>
    <DungeonGame />
  </StrictMode>,
);
