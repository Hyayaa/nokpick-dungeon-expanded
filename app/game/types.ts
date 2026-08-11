export type Point = {
  x: number;
  y: number;
};

export type CombatStats = {
  criticalChance: number;
  criticalDamageBonus: number;
  lifeSteal: number;
};

export type Direction = "up" | "down" | "left" | "right";

export type Terrain =
  | "wall"
  | "floor"
  | "specialFloor"
  | "chasm"
  | "grass"
  | "highGrass"
  | "water"
  | "entrance"
  | "exit"
  | "door"
  | "openDoor"
  | "lockedDoor"
  | "crystalDoor"
  | "barricade";

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
  | "bleeding"
  | "crippled"
  | "weakened"
  | "vulnerable"
  | "hexed"
  | "degraded"
  | "haste"
  | "levitating"
  | "purified"
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
  variant?: "magicalFire";
  roomId?: string;
};

export type DungeonWard = Point & {
  id: string;
  turns: number;
  power: number;
};

export type DungeonTrapKind =
  | "gripping"
  | "poisonDart"
  | "explosive"
  | "teleportation"
  | "flashing"
  | "toxicVent";

export type DungeonTrap = Point & {
  id: string;
  kind: DungeonTrapKind;
  active: boolean;
  hidden: boolean;
  revealed: boolean;
  triggered: boolean;
};

export type SpecialRoomKind =
  | "storage"
  | "magicalFire"
  | "toxicGas"
  | "traps"
  | "crystalChoice"
  | "crystalPath";

export type GuaranteedFloorSpawn = {
  id: string;
  defId: string;
  roomKind: SpecialRoomKind;
};

export type DungeonSpecialRoom = {
  id: string;
  kind: SpecialRoomKind;
  left: number;
  top: number;
  right: number;
  bottom: number;
  requiredItemId?: string;
};

export type DungeonSpecialRoomPlanEntry = {
  id: string;
  floor: number;
  preset: SpecialRoomKind;
};

export type MagicVisualKind =
  | "beam"
  | "bolt"
  | "projectile"
  | "chain"
  | "cone"
  | "burst"
  | "summon"
  | "cloud";

export type MagicVisual = {
  id: string;
  kind: MagicVisualKind;
  from: Point;
  to: Point;
  color: string;
  secondaryColor?: string;
  affectedTiles?: Point[];
  width?: number;
  durationMs?: number;
  impactStyle?: "none" | "burst" | "shockwave" | "web" | "cloud";
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

export type ShopListing = {
  id: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  instance: InventoryInstance | null;
};

export type ShopState = {
  version: 1;
  refreshSeed: number;
  nextListingSerial: number;
  stock: ShopListing[];
  buyback: ShopListing[];
};

export type LootOrigin = "dungeon" | "grass" | "carried" | "developer";

export type DungeonLootSource =
  | "ground"
  | "object"
  | "enemy"
  | "specialReward";

export type DungeonLootPurpose =
  | "normal"
  | "majorLoot"
  | "requiredSolution"
  | "specialReward"
  | "key"
  | "runeStone";

export type DungeonLootPlanEntry = {
  id: string;
  floor: number;
  source: DungeonLootSource;
  defId: string;
  quantity: number;
  objectKind?: Exclude<DungeonObjectKind, "alchemy">;
  instance?: InventoryInstance;
  purpose?: DungeonLootPurpose;
  roomKind?: SpecialRoomKind;
  slotIndex?: number;
};

export type DungeonGoldSource = "ground" | "enemy";

export type DungeonGoldPlanEntry = {
  id: string;
  floor: number;
  source: DungeonGoldSource;
  amount: number;
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
  questId?: string;
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

export type EnemyRegion = "sewers" | "prison" | "caves" | "city" | "halls";

export type EnemyKind =
  | "rat" | "snake" | "gnoll" | "swarm" | "crab" | "slime"
  | "albino" | "gnoll_exile" | "hermit_crab" | "caustic_slime"
  | "skeleton" | "thief" | "dm100" | "guard" | "necromancer"
  | "bandit" | "spectral_necromancer" | "necro_skeleton" | "wraith"
  | "bat" | "brute" | "shaman_red" | "shaman_blue" | "shaman_purple"
  | "spinner" | "dm200" | "armored_brute" | "dm201"
  | "ghoul" | "elemental_fire" | "elemental_frost" | "elemental_shock"
  | "elemental_chaos" | "warlock" | "monk" | "senior" | "golem"
  | "succubus" | "eye" | "scorpio" | "acidic"
  | "demon_spawner" | "ripper_demon" | "goo_boss" | "training_leaper";

export type EnemySkillId =
  | CompanionSkillId
  | "chainPull" | "summonSkeleton" | "summonWraith" | "summonRipper"
  | "lightningBolt" | "shamanBolt" | "poisonWeb" | "toxicVent"
  | "corrosiveVent" | "elementalBolt" | "darkBolt" | "teleportSelf"
  | "charm" | "deathGaze" | "cripplingShot" | "acidicShot"
  | "splitSwarm" | "lifeSteal" | "bruteRage" | "ghoulRevive"
  | "gooSlam";

export type EnemyPendingSkill = {
  skillId: EnemySkillId;
  casterId: string;
  targetId: string | null;
  targetPoint: Point;
  affectedTiles: Point[];
  remainingWindupTurns: number;
  startedTurn: number;
  interruptible: boolean;
  targetLockMode: "fixed" | "tracking";
};

export type Enemy = Point & CombatStats & {
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
  skillCooldowns?: Partial<Record<EnemySkillId, number>>;
  skillUses?: Partial<Record<EnemySkillId, number>>;
  pendingSkill?: EnemyPendingSkill | null;
  summonOwnerId?: string;
  summonIds?: string[];
  faction?: "hostile" | "corrupted";
  behaviorState?: Record<string, number | string | boolean | null>;
  drop?: EnemyDrop | null;
  goldDrop?: number;
  questId?: string;
  uniqueName?: string;
};

export type BossRoom = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  center: Point;
};

export type BossEncounterState = {
  bossId: import("./boss-definitions").BossId;
  room: BossRoom;
  bossEnemyId: string;
  minionIds: string[];
  activated: boolean;
  defeated: boolean;
  phase: 1 | 2;
  exitKeyDropped: boolean;
  exitKeyCollected: boolean;
  bossDeathPoint?: Point;
};

export type QuestKind = "uniqueEnemy" | "recoverItem";

export type QuestStatus =
  | "available"
  | "active"
  | "readyToTurnIn"
  | "completed";

export type QuestDefinition = {
  id: string;
  kind: QuestKind;
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  objectiveKo: string;
  objectiveEn: string;
  npcNameKo: string;
  npcNameEn: string;
  npcClassId: CompanionClassId;
  targetEnemyKind?: EnemyKind;
  targetNameKo?: string;
  targetNameEn?: string;
  questItemId?: string;
  rewardItemId: string;
  rewardQuantity: number;
  floor: number;
};

export type QuestState = {
  questId: string;
  status: QuestStatus;
  progress: number;
  required: number;
  contentPoint?: Point;
  contentSpawned?: boolean;
  pendingContentSpawn?: boolean;
  targetId?: string;
  acceptedAtTurn?: number;
  readyAtTurn?: number;
  completedAtTurn?: number;
  roomEnteredAtTurn?: number;
};

export type QuestNpc = Point & {
  id: string;
  questId: string;
  nameKo: string;
  nameEn: string;
  classId: CompanionClassId;
};

export type QuestRoom = {
  id: string;
  questId: string;
  kind: QuestKind;
  left: number;
  top: number;
  right: number;
  bottom: number;
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

export type SkillResourceType = "stamina" | "mana";
export type CampaignMaterialKind = "potion" | "seed" | "runestone";
export type CampaignMaterials = Record<CampaignMaterialKind, number>;
export type CampaignMaterialCost = Partial<CampaignMaterials>;

export type SkillResourceState = {
  currentStamina: number;
  maxStamina: number;
  staminaRegen: number;
  currentMana: number;
  maxMana: number;
  manaRegen: number;
};

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

export type Companion = Point & SkillResourceState & CombatStats & {
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
  learnedSkills: CompanionSkillId[];
  skillLevels: Partial<Record<CompanionSkillId, number>>;
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

export type Player = Point & SkillResourceState & CombatStats & {
  companionId: string;
  name: string;
  classId: CompanionClassId;
  professionId: CompanionProfessionId;
  traits: CompanionTraitId[];
  learnedSkills: CompanionSkillId[];
  skillLevels: Partial<Record<CompanionSkillId, number>>;
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
  traps?: DungeonTrap[];
  specialRooms?: DungeonSpecialRoom[];
  requiredFloorSpawns?: GuaranteedFloorSpawn[];
  quests?: QuestState[];
  questNpcs?: QuestNpc[];
  questRooms?: QuestRoom[];
  floor: number;
  dungeonId: string;
  dungeonName: string;
  maxFloor: number;
  difficultyScale: number;
  difficulty: number;
  enemyRegion?: EnemyRegion;
  bossId?: import("./boss-definitions").BossId;
  bossEncounter?: BossEncounterState;
  mainDropIds: string[];
  specialRoomPlan: DungeonSpecialRoomPlanEntry[];
  lootPlan: DungeonLootPlanEntry[];
  goldPlan: DungeonGoldPlanEntry[];
  goldCollected: number;
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
  special?: boolean;
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
  critical?: boolean;
  sourceId?: string;
  /** Visual action whose impact starts this effect's presentation timeline. */
  timingSourceId?: string;
  /** Number of on-death links between the visual action and this effect. */
  deathChainDepth?: number;
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
  resourceRegenExcludedActorIds?: string[];
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
  questInteraction?: {
    npcId: string;
    questId: string;
    status: QuestStatus;
  };
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
  specialFrames?: number[];
  chargeFrames?: number[];
  label: string;
};
