import { InventoryInstance, Player } from "./types";

export const MAX_INVENTORY_SLOTS = 20;
export const WAREHOUSE_SLOT_COUNT = 60;

export type ItemSlotRef = string | null;

type StackAndInstanceInventory = {
  stacks: Record<string, number>;
  instances: InventoryInstance[];
  slots?: ItemSlotRef[];
};

const uniqueLiveRefs = (refs: readonly string[]) => {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref)) return false;
    seen.add(ref);
    return true;
  });
};

export const normalizeFixedSlots = (
  existing: readonly ItemSlotRef[] | undefined,
  liveRefs: readonly string[],
  capacity: number,
) => {
  const live = uniqueLiveRefs(liveRefs).slice(0, capacity);
  const liveSet = new Set(live);
  const placed = new Set<string>();
  const slots: ItemSlotRef[] = Array.from({ length: capacity }, () => null);

  (existing ?? []).slice(0, capacity).forEach((ref, index) => {
    if (!ref || !liveSet.has(ref) || placed.has(ref)) return;
    slots[index] = ref;
    placed.add(ref);
  });

  live.forEach((ref) => {
    if (placed.has(ref)) return;
    const emptyIndex = slots.indexOf(null);
    if (emptyIndex < 0) return;
    slots[emptyIndex] = ref;
    placed.add(ref);
  });

  return slots;
};

export const swapFixedSlots = (
  slots: readonly ItemSlotRef[],
  fromIndex: number,
  toIndex: number,
) => {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= slots.length ||
    toIndex >= slots.length
  ) {
    return [...slots];
  }
  const next = [...slots];
  [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
  return next;
};

export const playerInventoryRefs = (player: Player) => {
  const registeredInstances = new Set(
    (player.autoSlots ?? []).filter(
      (itemRef): itemRef is string =>
        Boolean(
          itemRef &&
            player.inventoryInstances.some(
              (instance) => instance.id === itemRef,
            ),
        ),
    ),
  );
  return [
    ...Object.entries(player.inventory)
      .filter(([, quantity]) => quantity > 0)
      .map(([itemId]) => itemId),
    ...(player.inventoryInstances ?? [])
      .map((instance) => instance.id)
      .filter((itemRef) => !registeredInstances.has(itemRef)),
  ];
};

export const normalizePlayerInventorySlots = (player: Player) =>
  normalizeFixedSlots(
    player.inventorySlots,
    playerInventoryRefs(player),
    MAX_INVENTORY_SLOTS,
  );

export const storageInventoryRefs = (
  inventory: Pick<StackAndInstanceInventory, "stacks" | "instances">,
) => [
  ...Object.entries(inventory.stacks)
    .filter(([, quantity]) => quantity > 0)
    .map(([itemId]) => itemId),
  ...inventory.instances.map((instance) => instance.id),
];

export const normalizeStorageSlots = (
  inventory: StackAndInstanceInventory,
  capacity = WAREHOUSE_SLOT_COUNT,
) =>
  normalizeFixedSlots(
    inventory.slots,
    storageInventoryRefs(inventory),
    capacity,
  );

export const itemDefinitionIdForRef = (
  stacks: Record<string, number>,
  instances: readonly InventoryInstance[],
  itemRef: string,
) => instances.find((instance) => instance.id === itemRef)?.defId ??
  (stacks[itemRef] > 0 ? itemRef : null);
