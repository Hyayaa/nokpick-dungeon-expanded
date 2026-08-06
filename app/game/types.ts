export type Point = {
  x: number;
  y: number;
};

export type Direction = "up" | "down" | "left" | "right";

export type Terrain =
  | "wall"
  | "floor"
  | "grass"
  | "highGrass"
  | "water"
  | "entrance"
  | "exit"
  | "door"
  | "openDoor"
  | "lockedDoor";

export type Tile = {
  terrain: Terrain;
  discovered: boolean;
  visible: boolean;
  discoveredMask: number;
  visibleMask: number;
  variant: number;
};

export type ItemCategory =
  | "weapon"
  | "armor"
  | "ring"
  | "wand"
  | "artifact"
  | "missile"
  | "potion"
  | "scroll"
  | "brew"
  | "elixir"
  | "bomb"
  | "seed"
  | "stone"
  | "food"
  | "misc"
  | "key";

export type EquipSlot = "weapon" | "armor" | "ring";

export type ItemGrade = "F" | "E" | "D" | "C" | "B" | "A" | "S";

export type CoreEquipmentSlot = "weapon" | "armor";
export type FlexSlotIndex = 0 | 1 | 2 | 3;

export type LoadoutTarget =
  | {
      kind: "equipment";
      slot: CoreEquipmentSlot;
    }
  | {
      kind: "flex";
      index: FlexSlotIndex;
    };

export type UpgradeTarget =
  | {
      kind: "inventory";
      itemRef: string;
    }
  | {
      kind: "equipment";
      slot: EquipSlot;
      ringIndex?: number;
    }
  | {
      kind: "playerAuto";
      index: FlexSlotIndex;
    }
  | {
      kind: "companionEquipment";
      companionId: string;
      slot: CoreEquipmentSlot;
    }
  | {
      kind: "companionFlex";
      companionId: string;
      index: FlexSlotIndex;
    };

export type ItemEffect =
  | "heal"
  | "strength"
  | "invisibility"
  | "frost"
  | "mapping"
  | "teleport"
  | "upgrade"
  | "rage"
  | "experience"
  | "cleanse"
  | "haste"
  | "vision"
  | "blast";

export type StatusEffectId =
  | "burning"
  | "chilled"
  | "frozen"
  | "paralyzed"
  | "poisoned"
  | "corroded"
  | "blinded"
  | "terrified"
  | "charmed"
  | "corrupted"
  | "rooted"
  | "haste"
  | "levitating"
  | "mindVision"
  | "magicSight"
  | "shielded"
  | "earthenArmor"
  | "recharging"
  | "antimagic"
  | "foresight"
  | "challenge"
  | "stamina";

export type StatusEffect = {
  id: StatusEffectId;
  turns: number;
  power: number;
};

export type CloudKind =
  | "fire"
  | "frost"
  | "paralytic"
  | "toxic"
  | "corrosive"
  | "storm";

export type CloudTile = Point & {
  remaining: number;
  intensity: number;
};

export type DungeonCloud = {
  id: string;
  kind: CloudKind;
  origin: Point;
  tiles: CloudTile[];
  maxRadius: number;
  spreadPerTurn: number;
  tileLifetime: number;
  turns: number;
  power: number;
};

export type DungeonWard = Point & {
  id: string;
  turns: number;
  power: number;
};

export type MagicVisualKind = "beam" | "bolt" | "cone" | "burst" | "cloud";

export type MagicVisual = {
  id: string;
  kind: MagicVisualKind;
  from: Point;
  to: Point;
  color: string;
  secondaryColor?: string;
  sourceId?: string;
};

export type ItemDefinition = {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  sprite: number;
  slot?: EquipSlot;
  attack?: number;
  defense?: number;
  moveSpeed?: number;
  attackSpeed?: number;
  heal?: number;
  satiation?: number;
  effect?: ItemEffect;
  power?: number;
  minFloor?: number;
  accent: string;
};

export type EquipmentTraitId =
  | "keen"
  | "guarded"
  | "swift"
  | "focused"
  | "charged"
  | "balanced";

export type EquipmentTrait = {
  id: EquipmentTraitId;
  grade: ItemGrade;
};

export type EquipmentStatRoll = {
  attack: number;
  defense: number;
  magic: number;
  speed: number;
};

export type InventoryInstance = {
  id: string;
  defId: string;
  cursed?: boolean;
  charges?: number;
  maxCharges?: number;
  baseMaxCharges?: number;
  rechargeProgress?: number;
  durability?: number;
  maxDurability?: number;
  grade?: ItemGrade;
  upgradeLevel?: number;
  statRoll?: EquipmentStatRoll;
  traits?: EquipmentTrait[];
};

export type LootOrigin = "dungeon" | "grass" | "carried" | "developer";

export type DungeonLootSource = "ground" | "object" | "enemy";

export type DungeonLootPlanEntry = {
  id: string;
  floor: number;
  source: DungeonLootSource;
  defId: string;
  quantity: number;
  objectKind?: Exclude<DungeonObjectKind, "alchemy">;
  instance?: InventoryInstance;
};

export type EnemyDrop = {
  id: string;
  defId: string;
  quantity: number;
  instance?: InventoryInstance;
  lootOrigin: LootOrigin;
};

export type GroundItem = Point & {
  id: string;
  defId: string;
  quantity?: number;
  manualPickup?: boolean;
  recoversThrowableCharge?: boolean;
  recoversItemRef?: string;
  instance?: InventoryInstance;
  lootOrigin?: LootOrigin;
  dungeonLootId?: string;
};

export type DungeonObjectKind =
  | "chest"
  | "crystalChest"
  | "tomb"
  | "alchemy";

export type DungeonObject = Point & {
  id: string;
  kind: DungeonObjectKind;
  looted: boolean;
  loot: string[];
  lootInstances?: Array<InventoryInstance | null>;
  lootOrigins?: LootOrigin[];
  lootPlanEntryIds?: Array<string | null>;
};

export type ItemPickup = Point & {
  id: string;
  defId: string;
  quantity?: number;
  itemRef?: string;
  sourceId?: string;
  lootOrigin?: LootOrigin;
  dungeonLootId?: string;
};

export type ItemThrow = {
  id: string;
  defId: string;
  from: Point;
  to: Point;
  sourceId?: string;
};

export type CompanionSkillVisual = {
  id: string;
  skillId: CompanionSkillId;
  from: Point;
  to: Point;
  accent: string;
  travelMode: "none" | "leap" | "teleport" | "charge";
  impactMode:
    | "burst"
    | "shockwave"
    | "fragments"
    | "thrust"
    | "slash"
    | "healing"
    | "sigil"
    | "drain";
  radius: number;
  footprintOrigin?: Point;
  affectedTiles?: Point[];
  rank?: number;
  variants?: string[];
  semanticOverride?: boolean;
  accentOverride?: boolean;
  paths?: Array<{ from: Point; to: Point }>;
  sourceId?: string;
};

export type EnemyKind = "rat" | "gnoll" | "snake" | "slime" | "crab" | "skeleton";

export type Enemy = Point & {
  id: string;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  accuracy: number;
  evasion: number;
  xp: number;
  alerted: boolean;
  sawPlayerLastTurn: boolean;
  sleeping: boolean;
  wakeCooldown: number;
  lastSeenPlayer: Point | null;
  searchTurns: number;
  statuses: StatusEffect[];
  drop?: EnemyDrop | null;
};

export type Equipment = {
  weapon: string | null;
  armor: string | null;
  ring: string | null;
  ring2: string | null;
  ring3: string | null;
  ring4: string | null;
};

export type EquipmentKey = keyof Equipment;

export type EquipmentInstances = Record<
  EquipmentKey,
  InventoryInstance | null
>;

export type CompanionClassId =
  | "adventurer"
  | "warrior"
  | "huntress"
  | "mage"
  | "rogue"
  | "duelist"
  | "cleric";

export type CompanionProfessionId =
  | "warrior"
  | "rogue"
  | "mage"
  | "cleric";

export type CompanionTraitId =
  | "tough"
  | "aggressive"
  | "precise"
  | "nimble"
  | "guardian"
  | "keenSight"
  | "vigorous"
  | "powerful"
  | "cautious"
  | "adaptable";

export type CompanionSkillId =
  | "shockLeap"
  | "drivingLeap"
  | "fireball"
  | "weaponThrow"
  | "arcaneDischarge"
  | "whirlwind"
  | "piercingShot"
  | "chainLightning"
  | "frostNova"
  | "toxicOrb"
  | "corrosiveFlask"
  | "entanglingRoots"
  | "shadowStep"
  | "execute"
  | "shieldCharge"
  | "fieldMedicine"
  | "wardingSigil"
  | "tripleStrike"
  | "seismicSlam"
  | "lifeDrain";

export type CompanionSkillCooldowns = Partial<
  Record<CompanionSkillId, number>
>;

export type CompanionCommand = "follow" | "explore" | "accompany" | "hold";

export type CompanionEquipment = {
  weapon: string | null;
  armor: string | null;
  ring: string | null;
  ring2: string | null;
  ring3: string | null;
  ring4: string | null;
};

export type CompanionEquipmentKey = keyof CompanionEquipment;

export type CompanionEquipmentInstances = Record<
  CompanionEquipmentKey,
  InventoryInstance | null
>;

export type CompanionAutoItem = {
  defId: string;
  quantity: number;
  instance: InventoryInstance | null;
};

export type CompanionAutoSlots = [
  CompanionAutoItem | null,
  CompanionAutoItem | null,
  CompanionAutoItem | null,
  CompanionAutoItem | null,
];

export type PlayerAutoSlots = [
  string | null,
  string | null,
  string | null,
  string | null,
];

export type Companion = Point & {
  id: string;
  name: string;
  classId: CompanionClassId;
  professionId: CompanionProfessionId;
  command: CompanionCommand;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  nextXp: number;
  traits: CompanionTraitId[];
  skills: CompanionSkillId[];
  skillCooldowns: CompanionSkillCooldowns;
  statuses: StatusEffect[];
  baseAttack: number;
  baseDefense: number;
  accuracy: number;
  evasion: number;
  viewDistance: number;
  facing: Direction;
  equipment: CompanionEquipment;
  equipmentInstances: CompanionEquipmentInstances;
  autoSlots: CompanionAutoSlots;
  priorityTarget: Point | null;
  exploreTarget: Point | null;
  commandTargetId: string | null;
  actionCooldown: number;
  recoveryProgress: number;
};

export type EquipmentOffer = {
  id: string;
  itemRef: string;
  defId: string;
  slot: EquipSlot;
  currentDefId: string | null;
  createdTurn: number;
  expiresTurn: number;
};

export type AugmentId =
  | "ironWill"
  | "strongman"
  | "preciseAssault"
  | "liquidAgility"
  | "farsight"
  | "suckerPunch"
  | "lethalMomentum"
  | "naturesAid"
  | "heartyMeal"
  | "weaponInfusion"
  | "armorInfusion"
  | "ringResonance"
  | "runicTemper"
  | "royalArmory";

export type Player = Point & {
  companionId: string;
  name: string;
  classId: CompanionClassId;
  professionId: CompanionProfessionId;
  traits: CompanionTraitId[];
  skills: CompanionSkillId[];
  skillCooldowns: CompanionSkillCooldowns;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  nextXp: number;
  baseAttack: number;
  baseDefense: number;
  accuracy: number;
  evasion: number;
  viewDistance: number;
  inventory: Record<string, number>;
  inventoryInstances: InventoryInstance[];
  inventorySlots?: Array<string | null>;
  throwableProfiles?: Record<string, InventoryInstance>;
  equipment: Equipment;
  equipmentInstances: EquipmentInstances;
  invisibleTurns: number;
  statuses: StatusEffect[];
  shield: number;
  autoSlots: PlayerAutoSlots;
  wandCharges?: Record<string, number>;
  augments: Partial<Record<AugmentId, number>>;
  natureAidCooldown: number;
  facing: Direction;
  actionProgress: number;
  hunger: number;
  hungerTurns: number;
  recoveryProgress: number;
};

export type GameState = {
  width: number;
  height: number;
  tiles: Tile[][];
  player: Player;
  companions: Companion[];
  companionTrail: Point[];
  enemies: Enemy[];
  groundItems: GroundItem[];
  objects: DungeonObject[];
  clouds: DungeonCloud[];
  wards: DungeonWard[];
  floor: number;
  dungeonId: string;
  dungeonName: string;
  maxFloor: number;
  difficultyScale: number;
  difficulty: number;
  mainDropIds: string[];
  lootPlan: DungeonLootPlanEntry[];
  turn: number;
  seed: number;
  rng: number;
  logs: string[];
  gameOver: boolean;
  pendingAugmentOffers: AugmentId[][];
  equipmentOffers: EquipmentOffer[];
};

export type MotionKind = "move" | "attack" | "interact" | "hit";

export type MotionTravelStyle = "walk" | "leap" | "teleport" | "charge";

export type Motion = {
  id: string;
  from: Point;
  to: Point;
  kind: MotionKind;
  travelStyle?: MotionTravelStyle;
};

export type CombatEffectKind =
  | "damage"
  | "blocked"
  | "defeat"
  | "healing"
  | "miss"
  | "notice";

export type CombatEffect = Point & {
  text: string;
  color: string;
  kind?: CombatEffectKind;
  sourceId?: string;
};

export type StatusSignal = Point & {
  text: string;
  color: string;
  sourceId?: string;
  holdUntilTurnEnd?: boolean;
};

export type GameSoundId =
  | "step"
  | "water"
  | "hit"
  | "hitSlash"
  | "death"
  | "levelUp"
  | "item"
  | "drink"
  | "read"
  | "eat"
  | "doorOpen"
  | "unlock"
  | "trample"
  | "teleport"
  | "shatter"
  | "descend"
  | "healthWarn"
  | "equip"
  | "uiClick"
  | "skillArrow"
  | "skillBlast"
  | "skillGas"
  | "skillHeal"
  | "skillImpact"
  | "skillLightning"
  | "skillMagic"
  | "skillNature"
  | "skillShadow";

export type GameSoundCue = {
  id: GameSoundId;
  volume?: number;
  atResolution?: boolean;
};

export type ActionInteractionKind = "default" | "pickup";

export type ActionResult = {
  state: GameState;
  motions: Motion[];
  effects: CombatEffect[];
  signals?: StatusSignal[];
  presentationState?: GameState;
  defeatedIds?: string[];
  consumedTurn: boolean;
  elapsedTurns?: number;
  pickups?: ItemPickup[];
  throws?: ItemThrow[];
  magicVisuals?: MagicVisual[];
  skillVisuals?: CompanionSkillVisual[];
  wandSoundId?: string;
  wandSoundIds?: string[];
  itemBreak?: boolean;
  interacted?: boolean;
  enchanted?: boolean;
  alchemyOpened?: boolean;
  interactionKind?: ActionInteractionKind;
  reachedExit?: boolean;
  soundCues?: GameSoundCue[];
};

export type EnemySpriteDefinition = {
  file: string;
  sheetWidth: number;
  frameWidth: number;
  frameHeight: number;
  idle: number[];
  run: number[];
  attackFrames: number[];
  label: string;
};
