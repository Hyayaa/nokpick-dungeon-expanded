import { ITEM_DEFS } from "../game/data";
import { COMPANION_CLASSES } from "../game/companions";
import { Companion, CompanionClassId } from "../game/types";

export const COMPANION_FRAME_WIDTH = 12;
export const COMPANION_FRAME_HEIGHT = 15;

export const COMPANION_IDLE_FRAMES = [0, 0, 0, 1, 0, 0, 1, 1] as const;
export const COMPANION_MOVE_FRAMES = [2, 3, 4, 5, 6, 7] as const;
export const COMPANION_DEFEAT_FRAMES = [8, 9, 10, 11, 12, 11] as const;
export const COMPANION_ATTACK_FRAMES = [13, 14, 15, 0] as const;
export const COMPANION_INTERACT_FRAMES = [16, 17, 16, 17] as const;

export type CompanionVisualDefinition = {
  sprite: string;
  sheetWidth: number;
  sheetHeight: number;
  frameWidth: number;
  frameHeight: number;
  animationSet: "companion" | "adventurer";
};

const companionSprite = (
  sprite: string,
): CompanionVisualDefinition => ({
  sprite,
  sheetWidth: 256,
  sheetHeight: 128,
  frameWidth: COMPANION_FRAME_WIDTH,
  frameHeight: COMPANION_FRAME_HEIGHT,
  animationSet: "companion",
});

export const COMPANION_VISUALS: Record<
  CompanionClassId,
  CompanionVisualDefinition
> = {
  adventurer: {
    sprite: "/assets/sprites/player.png",
    sheetWidth: 128,
    sheetHeight: 72,
    frameWidth: 16,
    frameHeight: 24,
    animationSet: "adventurer",
  },
  warrior: companionSprite("/assets/sprites/companions/warrior.png"),
  huntress: companionSprite("/assets/sprites/companions/huntress.png"),
  mage: companionSprite("/assets/sprites/companions/mage.png"),
  rogue: companionSprite("/assets/sprites/companions/rogue.png"),
  duelist: companionSprite("/assets/sprites/companions/duelist.png"),
  cleric: companionSprite("/assets/sprites/companions/cleric.png"),
};

export const COMPANION_PRESENTATIONS = Object.fromEntries(
  (Object.keys(COMPANION_CLASSES) as CompanionClassId[]).map((classId) => [
    classId,
    {
      ...COMPANION_CLASSES[classId],
      ...COMPANION_VISUALS[classId],
    },
  ]),
) as {
  [ClassId in CompanionClassId]:
    (typeof COMPANION_CLASSES)[ClassId] & CompanionVisualDefinition;
};

export const companionArmorTier = (
  companion: Pick<Companion, "equipment">,
) => {
  const armor = companion.equipment.armor;
  if (!armor || armor === "cloth_armor") return 0;
  if (armor === "leather_armor") return 1;
  if (armor === "mail_armor") return 2;
  const minimumFloor = ITEM_DEFS[armor]?.minFloor ?? 1;
  return Math.max(0, Math.min(5, Math.floor((minimumFloor + 1) / 2)));
};

export const companionFrameIndex = (
  armorTier: number,
  frameWithinTier: number,
) => {
  const framesPerRow = Math.floor(256 / COMPANION_FRAME_WIDTH);
  return Math.max(0, armorTier) * framesPerRow + frameWithinTier;
};
