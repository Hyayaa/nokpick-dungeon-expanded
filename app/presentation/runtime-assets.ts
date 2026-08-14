const tilesSewers = new URL(
  "../../public/assets/environment/tiles_sewers.png?inline",
  import.meta.url,
).href;
const water = new URL(
  "../../public/assets/environment/water0.png?inline",
  import.meta.url,
).href;
const terrainFeatures = new URL(
  "../../public/assets/environment/terrain_features.png?inline",
  import.meta.url,
).href;
const items = new URL(
  "../../public/assets/sprites/items.png?inline",
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
const characterWarrior = new URL(
  "../../public/assets/sprites/characters/warrior.png?inline",
  import.meta.url,
).href;
const characterMage = new URL(
  "../../public/assets/sprites/characters/mage.png?inline",
  import.meta.url,
).href;
const characterRogue = new URL(
  "../../public/assets/sprites/characters/rogue.png?inline",
  import.meta.url,
).href;
const characterCleric = new URL(
  "../../public/assets/sprites/characters/cleric.png?inline",
  import.meta.url,
).href;

const RUNTIME_IMAGE_SOURCES: Readonly<Record<string, string>> = {
  "/assets/environment/tiles_sewers.png": tilesSewers,
  "/assets/environment/water0.png": water,
  "/assets/environment/terrain_features.png": terrainFeatures,
  "/assets/sprites/items.png": items,
  "/assets/sprites/rat.png": rat,
  "/assets/sprites/gnoll.png": gnoll,
  "/assets/sprites/snake.png": snake,
  "/assets/sprites/slime.png": slime,
  "/assets/sprites/crab.png": crab,
  "/assets/sprites/skeleton.png": skeleton,
  "/assets/sprites/characters/warrior.png": characterWarrior,
  "/assets/sprites/characters/mage.png": characterMage,
  "/assets/sprites/characters/rogue.png": characterRogue,
  "/assets/sprites/characters/cleric.png": characterCleric,
};

export const runtimeImageSource = (publicPath: string) => {
  const embedded = RUNTIME_IMAGE_SOURCES[publicPath];
  if (embedded || typeof window === "undefined" || !publicPath.startsWith("/")) {
    return embedded ?? publicPath;
  }
  return new URL(publicPath.slice(1), new URL("./", window.location.href)).href;
};

export const RUNTIME_IMAGE_PATHS = Object.freeze(
  Object.keys(RUNTIME_IMAGE_SOURCES),
);
