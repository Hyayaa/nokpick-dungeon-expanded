import { ITEM_DEFS } from "../game/data";

export const RING_SPRITE_OFFSET = { x: 4, y: 3 } as const;

export const itemSpriteOffset = (itemId: string) =>
  ITEM_DEFS[itemId]?.category === "ring"
    ? RING_SPRITE_OFFSET
    : { x: 0, y: 0 };
