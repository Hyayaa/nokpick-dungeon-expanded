const tilesSewers = new URL(
  "../../public/assets/environment/tiles_sewers.png?inline",
  import.meta.url,
).href;
const water = new URL(
  "../../public/assets/environment/water0.png?inline",
  import.meta.url,
).href;
const items = new URL(
  "../../public/assets/sprites/items.png?inline",
  import.meta.url,
).href;
const player = new URL(
  "../../public/assets/sprites/player.png?inline",
  import.meta.url,
).href;
const rat = new URL(
  "../../public/assets/sprites/rat.png?inline",
  import.meta.url,
).href;
const gnoll = new URL(
  "../../public/assets/sprites/gnoll.png?inline",
  import.meta.url,
).href;
const snake = new URL(
  "../../public/assets/sprites/snake.png?inline",
  import.meta.url,
).href;
const slime = new URL(
  "../../public/assets/sprites/slime.png?inline",
  import.meta.url,
).href;
const crab = new URL(
  "../../public/assets/sprites/crab.png?inline",
  import.meta.url,
).href;
const skeleton = new URL(
  "../../public/assets/sprites/skeleton.png?inline",
  import.meta.url,
).href;
const warrior = new URL(
  "../../public/assets/sprites/companions/warrior.png?inline",
  import.meta.url,
).href;
const huntress = new URL(
  "../../public/assets/sprites/companions/huntress.png?inline",
  import.meta.url,
).href;
const mage = new URL(
  "../../public/assets/sprites/companions/mage.png?inline",
  import.meta.url,
).href;
const rogue = new URL(
  "../../public/assets/sprites/companions/rogue.png?inline",
  import.meta.url,
).href;
const duelist = new URL(
  "../../public/assets/sprites/companions/duelist.png?inline",
  import.meta.url,
).href;
const cleric = new URL(
  "../../public/assets/sprites/companions/cleric.png?inline",
  import.meta.url,
).href;

const RUNTIME_IMAGE_SOURCES: Readonly<Record<string, string>> = {
  "/assets/environment/tiles_sewers.png": tilesSewers,
  "/assets/environment/water0.png": water,
  "/assets/sprites/items.png": items,
  "/assets/sprites/player.png": player,
  "/assets/sprites/rat.png": rat,
  "/assets/sprites/gnoll.png": gnoll,
  "/assets/sprites/snake.png": snake,
  "/assets/sprites/slime.png": slime,
  "/assets/sprites/crab.png": crab,
  "/assets/sprites/skeleton.png": skeleton,
  "/assets/sprites/companions/warrior.png": warrior,
  "/assets/sprites/companions/huntress.png": huntress,
  "/assets/sprites/companions/mage.png": mage,
  "/assets/sprites/companions/rogue.png": rogue,
  "/assets/sprites/companions/duelist.png": duelist,
  "/assets/sprites/companions/cleric.png": cleric,
};

export const runtimeImageSource = (publicPath: string) =>
  RUNTIME_IMAGE_SOURCES[publicPath] ?? publicPath;

export const RUNTIME_IMAGE_PATHS = Object.freeze(
  Object.keys(RUNTIME_IMAGE_SOURCES),
);
