import { ITEM_DEFS } from "./data";
import { normalizePlayerInventorySlots, swapFixedSlots } from "./inventory-slots";
import {
  isPartyQuickslotTarget,
  loadoutEquipmentKey,
} from "./loadout";
import { pushLog } from "./log";
import { PLAYER_ACTOR_ID } from "./party";
import { cloneGameWithoutTiles } from "./state";
import {
  GameState,
  InventoryInstance,
  LoadoutTarget,
} from "./types";

export type PartyLoadoutAddress = {
  ownerId: string;
  target: LoadoutTarget;
};

type GearEntry = {
  defId: string;
  instance: InventoryInstance | null;
};

const ownerAt = (state: GameState, address: PartyLoadoutAddress) =>
  address.ownerId === PLAYER_ACTOR_ID
    ? state.player
    : state.companions.find(
        (companion) => companion.id === address.ownerId,
      ) ?? null;

const readGear = (
  state: GameState,
  address: PartyLoadoutAddress,
): GearEntry | null => {
  const owner = ownerAt(state, address);
  if (!owner) return null;
  const key = loadoutEquipmentKey(address.target);
  const defId = owner.equipment[key];
  return defId
    ? { defId, instance: owner.equipmentInstances[key] ?? null }
    : null;
};

const acceptsGear = (defId: string, address: PartyLoadoutAddress) =>
  address.target.kind === "equipment"
    ? ITEM_DEFS[defId]?.slot === address.target.slot
    : !isPartyQuickslotTarget(address.target) &&
      ["ring", "artifact"].includes(ITEM_DEFS[defId]?.category ?? "");

export const reorderDungeonInventory = (
  state: GameState,
  sourceIndex: number,
  targetIndex: number,
  expectedItemRef: string,
) => {
  const slots = normalizePlayerInventorySlots(state.player);
  if (slots[sourceIndex] !== expectedItemRef) return state;
  return {
    ...state,
    player: {
      ...state.player,
      inventorySlots: swapFixedSlots(slots, sourceIndex, targetIndex),
    },
  };
};

export const placeReturnedItemInInventorySlot = (
  state: GameState,
  returnedItemRef: string,
  targetIndex: number,
) => {
  const slots = normalizePlayerInventorySlots(state.player);
  const sourceIndex = slots.indexOf(returnedItemRef);
  if (sourceIndex < 0 || sourceIndex === targetIndex) return state;
  return {
    ...state,
    player: {
      ...state.player,
      inventorySlots: swapFixedSlots(slots, sourceIndex, targetIndex),
    },
  };
};

export type PartyLoadoutSwapResult = {
  state: GameState;
  changed: boolean;
  reason?: "missing" | "cursed" | "incompatible";
};

export const swapPartyLoadout = (
  state: GameState,
  source: PartyLoadoutAddress,
  target: PartyLoadoutAddress,
): PartyLoadoutSwapResult => {
  const sourceGear = readGear(state, source);
  const targetGear = readGear(state, target);
  if (!sourceGear) return { state, changed: false, reason: "missing" };
  if (sourceGear.instance?.cursed || targetGear?.instance?.cursed) {
    const next = cloneGameWithoutTiles(state);
    pushLog(next, "저주받은 장비는 위치를 바꾸거나 해제할 수 없습니다.");
    return { state: next, changed: false, reason: "cursed" };
  }
  if (
    !acceptsGear(sourceGear.defId, target) ||
    (targetGear && !acceptsGear(targetGear.defId, source))
  ) {
    return { state, changed: false, reason: "incompatible" };
  }

  const next = cloneGameWithoutTiles(state);
  const writeGear = (address: PartyLoadoutAddress, gear: GearEntry | null) => {
    const owner = ownerAt(next, address);
    if (!owner) return;
    const key = loadoutEquipmentKey(address.target);
    owner.equipment[key] = gear?.defId ?? null;
    owner.equipmentInstances[key] = gear?.instance ?? null;
  };
  writeGear(source, targetGear);
  writeGear(target, sourceGear);
  pushLog(next, "드래그로 장비 위치를 교체했습니다.");
  return { state: next, changed: true };
};
