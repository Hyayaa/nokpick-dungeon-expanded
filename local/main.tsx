import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DungeonGame from "../app/components/DungeonGame";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("로컬 게임 화면을 초기화할 수 없습니다.");
}

const LOCAL_HEARTBEAT_PATH = "/__shattered_local_heartbeat";
const LOCAL_CLOSE_PATH = "/__shattered_local_close";

const sendLocalHeartbeat = () => {
  void fetch(LOCAL_HEARTBEAT_PATH, {
    method: "POST",
    cache: "no-store",
    keepalive: true,
  }).catch(() => undefined);
};

const requestLocalServerClose = (event: PageTransitionEvent) => {
  if (event.persisted) return;
  if (typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon(LOCAL_CLOSE_PATH, "close");
    return;
  }
  void fetch(LOCAL_CLOSE_PATH, {
    method: "POST",
    cache: "no-store",
    keepalive: true,
  }).catch(() => undefined);
};

sendLocalHeartbeat();
const localHeartbeat = window.setInterval(sendLocalHeartbeat, 15_000);
window.addEventListener("pageshow", sendLocalHeartbeat);
window.addEventListener("pagehide", requestLocalServerClose);
window.addEventListener("beforeunload", () => {
  window.clearInterval(localHeartbeat);
}, { once: true });

createRoot(root).render(
  <StrictMode>
    <DungeonGame />
  </StrictMode>,
);
