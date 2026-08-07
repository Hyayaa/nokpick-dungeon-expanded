import type { EnemySkillUseRule } from "./enemy-skills";
import type { Enemy, EnemyKind, EnemyRegion, EnemySkillId, EnemySpriteDefinition, Point } from "./types";

export type EnemyProperty = "flying" | "undead" | "demonic" | "large" | "immovable" | "inorganic" | "aquatic";
export type EnemyAiProfile = "melee" | "fastMelee" | "ranged" | "skirmisher" | "summoner" | "support" | "charger";
export type EnemyRosterType = "standard" | "rareAlt" | "summon" | "special" | "dev";
export type EnemyDefinition = {
  id: EnemyKind;
  name: string;
  region: EnemyRegion;
  type: EnemyRosterType;
  baseStats: { hp: number; attack: number; defense: number; accuracy: number; evasion: number };
  xp: number;
  properties: readonly EnemyProperty[];
  sprite: EnemySpriteDefinition;
  skills: readonly EnemySkillId[];
  skillRules: readonly EnemySkillUseRule[];
  aiProfile: EnemyAiProfile;
  description: string;
  dropProfile: "standard" | "none" | "gold" | "thief";
  spawnWeight: number;
  rareAlt?: EnemyKind;
  production: boolean;
  initialDisposition?: "hostile" | "passive";
  meleeRange?: number;
};

const frames = (
  file: string, sheetWidth: number, frameWidth: number, frameHeight: number,
  idle: number[], run: number[], attackFrames: number[], label: string,
  specialFrames?: number[],
): EnemySpriteDefinition => ({ file: `/assets/sprites/${file}.png`, sheetWidth, frameWidth, frameHeight, idle, run, attackFrames, specialFrames, label });

const rule = (skillId: EnemySkillId, options: Partial<Omit<EnemySkillUseRule, "skillId">> = {}): EnemySkillUseRule => ({ skillId, priority: 10, ...options });
const d = (definition: EnemyDefinition) => definition;

export const ENEMY_DEFINITIONS: Readonly<Record<EnemyKind, EnemyDefinition>> = {
  rat: d({ id:"rat", name:"화난 쥐", region:"sewers", type:"standard", baseStats:{hp:7,attack:3,defense:0,accuracy:8,evasion:2}, xp:4, properties:[], sprite:frames("rat",256,16,15,[0,0,1],[6,7,8,9,10],[2,3,4,5],"화난 쥐"), skills:[], skillRules:[], aiProfile:"melee", description:"가장 기본적인 하수도 근접 적입니다.", dropProfile:"standard", spawnWeight:3, rareAlt:"albino", production:true }),
  snake: d({ id:"snake", name:"하수도 뱀", region:"sewers", type:"standard", baseStats:{hp:8,attack:5,defense:0,accuracy:10,evasion:10}, xp:5, properties:[], sprite:frames("snake",256,12,11,[0,0,1,2],[4,5,6,7],[8,9,10],"하수도 뱀"), skills:[], skillRules:[], aiProfile:"melee", description:"방어력은 낮지만 매우 민첩합니다.", dropProfile:"standard", spawnWeight:2, production:true }),
  gnoll: d({ id:"gnoll", name:"놀 정찰병", region:"sewers", type:"standard", baseStats:{hp:10,attack:4,defense:1,accuracy:10,evasion:4}, xp:6, properties:[], sprite:frames("gnoll",256,12,15,[0,0,1],[4,5,6,7],[2,3],"놀 정찰병"), skills:[], skillRules:[], aiProfile:"melee", description:"하수도 통로를 순찰하는 놀 전사입니다.", dropProfile:"standard", spawnWeight:3, rareAlt:"gnoll_exile", production:true }),
  swarm: d({ id:"swarm", name:"파리떼", region:"sewers", type:"standard", baseStats:{hp:10,attack:4,defense:0,accuracy:9,evasion:8}, xp:5, properties:["flying"], sprite:frames("swarm",256,16,16,[0,1,2,3,4,5],[0,1,2,3,4,5],[6,7,8,9],"파리떼"), skills:["splitSwarm"], skillRules:[], aiProfile:"melee", description:"비치명적 피해를 받으면 체력을 나눠 증식합니다.", dropProfile:"standard", spawnWeight:2, production:true }),
  crab: d({ id:"crab", name:"하수도 게", region:"sewers", type:"standard", baseStats:{hp:16,attack:6,defense:2,accuracy:12,evasion:5}, xp:10, properties:["aquatic"], sprite:frames("crab",256,16,16,[0,1,0,2],[3,4,5,6],[7,8,9],"하수도 게"), skills:[], skillRules:[], aiProfile:"fastMelee", description:"빠르고 단단한 수생 근접 적입니다.", dropProfile:"standard", spawnWeight:2, rareAlt:"hermit_crab", production:true }),
  slime: d({ id:"slime", name:"슬라임", region:"sewers", type:"standard", baseStats:{hp:13,attack:5,defense:1,accuracy:12,evasion:5}, xp:8, properties:[], sprite:frames("slime",128,14,12,[0,1,1,0],[0,2,3,2],[2,3,4,6,5],"슬라임"), skills:[], skillRules:[], aiProfile:"melee", description:"큰 피해를 점액질 몸으로 완화합니다.", dropProfile:"standard", spawnWeight:2, rareAlt:"caustic_slime", production:true }),
  albino: d({ id:"albino", name:"알비노 쥐", region:"sewers", type:"rareAlt", baseStats:{hp:15,attack:5,defense:0,accuracy:10,evasion:3}, xp:9, properties:[], sprite:frames("rat",256,16,15,[16,16,17],[22,23,24,25,26],[18,19,20,21],"알비노 쥐"), skills:[], skillRules:[], aiProfile:"melee", description:"공격이 출혈을 일으킬 수 있는 희귀 쥐입니다.", dropProfile:"standard", spawnWeight:0, production:true }),
  gnoll_exile: d({ id:"gnoll_exile", name:"추방된 놀", region:"sewers", type:"rareAlt", baseStats:{hp:24,attack:7,defense:2,accuracy:13,evasion:5}, xp:14, properties:[], sprite:frames("gnoll",256,12,15,[21,21,22],[25,26,27,28],[23,24],"추방된 놀"), skills:[], skillRules:[], aiProfile:"melee", description:"공격받기 전에는 중립적이며 사거리가 긴 희귀 놀입니다.", dropProfile:"gold", spawnWeight:0, production:true, initialDisposition:"passive", meleeRange:2 }),
  hermit_crab: d({ id:"hermit_crab", name:"소라게", region:"sewers", type:"rareAlt", baseStats:{hp:27,attack:7,defense:5,accuracy:12,evasion:3}, xp:15, properties:["aquatic"], sprite:frames("crab",256,16,16,[16,17,16,18],[19,20,21,22],[23,24,25],"소라게"), skills:[], skillRules:[], aiProfile:"melee", description:"느리지만 껍데기의 방어력이 높은 희귀 게입니다.", dropProfile:"standard", spawnWeight:0, production:true }),
  caustic_slime: d({ id:"caustic_slime", name:"산성 슬라임", region:"sewers", type:"rareAlt", baseStats:{hp:18,attack:7,defense:1,accuracy:13,evasion:5}, xp:14, properties:[], sprite:frames("slime",128,14,12,[9,10,10,9],[9,11,12,11],[11,12,13,15,14],"산성 슬라임"), skills:[], skillRules:[], aiProfile:"melee", description:"공격 시 부식성 점액을 묻힙니다.", dropProfile:"standard", spawnWeight:0, production:true }),

  skeleton: d({ id:"skeleton", name:"해골 병사", region:"prison", type:"standard", baseStats:{hp:19,attack:7,defense:2,accuracy:12,evasion:9}, xp:12, properties:["undead","inorganic"], sprite:frames("skeleton",256,12,15,[0,0,1,2,3],[4,5,6,7,8,9],[14,15,16],"해골 병사"), skills:[], skillRules:[], aiProfile:"melee", description:"죽을 때 주변에 뼛조각 피해를 줍니다.", dropProfile:"standard", spawnWeight:3, production:true }),
  thief: d({ id:"thief", name:"미친 도적", region:"prison", type:"standard", baseStats:{hp:20,attack:7,defense:1,accuracy:13,evasion:10}, xp:13, properties:[], sprite:frames("thief",256,12,13,[0,0,0,1],[0,0,2,3,3,4],[10,11,12,0],"미친 도적"), skills:["shadowStep"], skillRules:[rule("shadowStep",{priority:2,minRange:4,maxRange:7,cooldown:8})], aiProfile:"skirmisher", description:"공격 후 물건을 훔쳐 달아나려 합니다.", dropProfile:"thief", spawnWeight:2, rareAlt:"bandit", production:true }),
  dm100: d({ id:"dm100", name:"DM-100", region:"prison", type:"standard", baseStats:{hp:22,attack:8,defense:2,accuracy:14,evasion:8}, xp:14, properties:["inorganic"], sprite:frames("dm100",256,16,14,[0,1],[6,7,8,9],[2,3,4,0],"DM-100",[5,5,1]), skills:["lightningBolt"], skillRules:[rule("lightningBolt",{minRange:2,maxRange:7,cooldown:1,requiresLineOfSight:true})], aiProfile:"ranged", description:"직선 시야가 확보되면 번개 화살을 발사합니다.", dropProfile:"standard", spawnWeight:2, production:true }),
  guard: d({ id:"guard", name:"감옥 경비병", region:"prison", type:"standard", baseStats:{hp:30,attack:9,defense:4,accuracy:15,evasion:7}, xp:18, properties:[], sprite:frames("guard",256,12,16,[0,0,0,1,0,0,1,1],[2,3,4,5,6,7],[8,9,10],"감옥 경비병"), skills:["chainPull"], skillRules:[rule("chainPull",{minRange:2,maxRange:4,maxUses:1,requiresLineOfSight:true,targetPolicy:"nearest"})], aiProfile:"melee", description:"전투당 한 번 사슬로 대상을 끌어당기고 둔화시킵니다.", dropProfile:"standard", spawnWeight:2, production:true }),
  necromancer: d({ id:"necromancer", name:"강령술사", region:"prison", type:"standard", baseStats:{hp:28,attack:5,defense:2,accuracy:15,evasion:8}, xp:20, properties:[], sprite:frames("necromancer",256,16,16,[0,0,0,1,0,0,0,0,1],[0,0,0,2,3,4],[5,6,7,8],"강령술사",[7,8]), skills:["summonSkeleton"], skillRules:[rule("summonSkeleton",{maxRange:8,cooldown:2,windupTurns:1,requiresMinionAbsent:true,targetPolicy:"nearest"})], aiProfile:"summoner", description:"연결된 해골을 소환하고 유지·강화합니다.", dropProfile:"standard", spawnWeight:2, rareAlt:"spectral_necromancer", production:true }),
  bandit: d({ id:"bandit", name:"미친 강도", region:"prison", type:"rareAlt", baseStats:{hp:26,attack:9,defense:2,accuracy:15,evasion:12}, xp:21, properties:[], sprite:frames("thief",256,12,13,[21,21,21,22],[21,21,23,24,24,25],[31,32,33,21],"미친 강도"), skills:["shadowStep"], skillRules:[rule("shadowStep",{priority:2,minRange:3,maxRange:7,cooldown:6})], aiProfile:"skirmisher", description:"도둑질과 함께 실명·중독·둔화를 겁니다.", dropProfile:"thief", spawnWeight:0, production:true }),
  spectral_necromancer: d({ id:"spectral_necromancer", name:"망령 강령술사", region:"prison", type:"rareAlt", baseStats:{hp:34,attack:6,defense:3,accuracy:16,evasion:10}, xp:25, properties:["undead"], sprite:frames("necromancer",256,16,16,[16,16,16,17,16,16,16,16,17],[16,16,16,18,19,20],[21,22,23,24],"망령 강령술사",[23,24]), skills:["summonWraith"], skillRules:[rule("summonWraith",{maxRange:8,cooldown:2,windupTurns:1,maxActiveSummons:3})], aiProfile:"summoner", description:"해골 대신 회피력이 높은 망령을 소환합니다.", dropProfile:"standard", spawnWeight:0, production:true }),
  necro_skeleton: d({ id:"necro_skeleton", name:"소환된 해골", region:"prison", type:"summon", baseStats:{hp:22,attack:8,defense:2,accuracy:13,evasion:8}, xp:0, properties:["undead","inorganic"], sprite:frames("skeleton",256,12,15,[0,0,1,2,3],[4,5,6,7,8,9],[14,15,16],"소환된 해골"), skills:[], skillRules:[], aiProfile:"melee", description:"강령술사와 생명력이 연결된 소환수입니다.", dropProfile:"none", spawnWeight:0, production:true }),
  wraith: d({ id:"wraith", name:"망령", region:"prison", type:"summon", baseStats:{hp:1,attack:7,defense:0,accuracy:14,evasion:24}, xp:0, properties:["flying","undead","inorganic"], sprite:frames("wraith",128,14,15,[0,1],[0,1],[0,2,3],"망령"), skills:[], skillRules:[], aiProfile:"melee", description:"체력은 하나뿐이지만 공격을 맞히기 매우 어렵습니다.", dropProfile:"none", spawnWeight:0, production:true }),

  bat: d({ id:"bat", name:"흡혈 박쥐", region:"caves", type:"standard", baseStats:{hp:24,attack:9,defense:1,accuracy:15,evasion:14}, xp:16, properties:["flying"], sprite:frames("bat",128,15,15,[0,1],[0,1],[2,3,0,1],"흡혈 박쥐"), skills:["lifeSteal"], skillRules:[], aiProfile:"fastMelee", description:"빠르게 날아들어 공격 피해 일부를 회복합니다.", dropProfile:"standard", spawnWeight:3, production:true }),
  brute: d({ id:"brute", name:"놀 광전사", region:"caves", type:"standard", baseStats:{hp:34,attack:11,defense:3,accuracy:16,evasion:8}, xp:20, properties:[], sprite:frames("brute",256,12,16,[0,0,1],[4,5,6,7],[2,3],"놀 광전사"), skills:["bruteRage"], skillRules:[], aiProfile:"melee", description:"치명상을 받으면 보호막과 광폭화를 얻습니다.", dropProfile:"standard", spawnWeight:2, rareAlt:"armored_brute", production:true }),
  shaman_red: d({ id:"shaman_red", name:"붉은 놀 주술사", region:"caves", type:"standard", baseStats:{hp:28,attack:10,defense:2,accuracy:17,evasion:9}, xp:20, properties:[], sprite:frames("shaman",256,12,15,[0,0,1],[4,5,6,7],[2,3,0],"붉은 놀 주술사"), skills:["shamanBolt"], skillRules:[rule("shamanBolt",{minRange:2,maxRange:7,cooldown:1,requiresLineOfSight:true})], aiProfile:"ranged", description:"원거리 화살로 약화 효과를 겁니다.", dropProfile:"standard", spawnWeight:1, production:true }),
  shaman_blue: d({ id:"shaman_blue", name:"푸른 놀 주술사", region:"caves", type:"standard", baseStats:{hp:28,attack:10,defense:2,accuracy:17,evasion:9}, xp:20, properties:[], sprite:frames("shaman",256,12,15,[21,21,22],[25,26,27,28],[23,24,21],"푸른 놀 주술사"), skills:["shamanBolt"], skillRules:[rule("shamanBolt",{minRange:2,maxRange:7,cooldown:1,requiresLineOfSight:true})], aiProfile:"ranged", description:"원거리 화살로 취약 효과를 겁니다.", dropProfile:"standard", spawnWeight:1, production:true }),
  shaman_purple: d({ id:"shaman_purple", name:"보라 놀 주술사", region:"caves", type:"standard", baseStats:{hp:28,attack:10,defense:2,accuracy:17,evasion:9}, xp:20, properties:[], sprite:frames("shaman",256,12,15,[42,42,43],[46,47,48,49],[44,45,42],"보라 놀 주술사"), skills:["shamanBolt"], skillRules:[rule("shamanBolt",{minRange:2,maxRange:7,cooldown:1,requiresLineOfSight:true})], aiProfile:"ranged", description:"원거리 화살로 주박 효과를 겁니다.", dropProfile:"standard", spawnWeight:1, production:true }),
  spinner: d({ id:"spinner", name:"동굴 거미", region:"caves", type:"standard", baseStats:{hp:30,attack:10,defense:2,accuracy:17,evasion:12}, xp:21, properties:[], sprite:frames("spinner",256,16,16,[0,1],[0,2,0,3],[0,4,5,0],"동굴 거미"), skills:["poisonWeb"], skillRules:[rule("poisonWeb",{minRange:2,maxRange:6,cooldown:8,windupTurns:1,requiresLineOfSight:true})], aiProfile:"skirmisher", description:"대상의 이동을 예측해 독 거미줄을 펼칩니다.", dropProfile:"standard", spawnWeight:2, production:true }),
  dm200: d({ id:"dm200", name:"DM-200", region:"caves", type:"standard", baseStats:{hp:42,attack:12,defense:5,accuracy:17,evasion:6}, xp:26, properties:["large","inorganic"], sprite:frames("dm200",256,21,18,[0,1],[2,3],[4,5,6],"DM-200",[7,8,8,7]), skills:["toxicVent"], skillRules:[rule("toxicVent",{minRange:2,maxRange:6,cooldown:7,windupTurns:1,requiresLineOfSight:true})], aiProfile:"ranged", description:"시야를 따라 독가스를 분출하는 대형 기계입니다.", dropProfile:"standard", spawnWeight:2, rareAlt:"dm201", production:true }),
  armored_brute: d({ id:"armored_brute", name:"갑옷 입은 광전사", region:"caves", type:"rareAlt", baseStats:{hp:48,attack:13,defense:7,accuracy:17,evasion:6}, xp:30, properties:["large"], sprite:frames("brute",256,12,16,[21,21,22],[25,26,27,28],[23,24],"갑옷 입은 광전사"), skills:["bruteRage"], skillRules:[], aiProfile:"melee", description:"강한 방어와 오래 유지되는 광폭 보호막을 지녔습니다.", dropProfile:"standard", spawnWeight:0, production:true }),
  dm201: d({ id:"dm201", name:"DM-201", region:"caves", type:"rareAlt", baseStats:{hp:58,attack:13,defense:7,accuracy:18,evasion:3}, xp:34, properties:["large","immovable","inorganic"], sprite:frames("dm200",256,21,18,[12,13],[14,15],[16,17,18],"DM-201",[19,20,20,19]), skills:["corrosiveVent"], skillRules:[rule("corrosiveVent",{minRange:1,maxRange:6,cooldown:7,windupTurns:1,requiresLineOfSight:true})], aiProfile:"ranged", description:"움직이지 않고 부식 가스를 살포하며 원거리 피해를 줄입니다.", dropProfile:"standard", spawnWeight:0, production:true }),

  ghoul: d({ id:"ghoul", name:"구울", region:"city", type:"standard", baseStats:{hp:38,attack:13,defense:4,accuracy:18,evasion:9}, xp:24, properties:["undead"], sprite:frames("ghoul",256,12,14,[0,0,0,1],[2,3,4,5,6,7],[0,8,9],"구울"), skills:["ghoulRevive"], skillRules:[], aiProfile:"melee", description:"다른 구울이 남아 있으면 쓰러진 뒤 다시 일어납니다.", dropProfile:"standard", spawnWeight:3, production:true }),
  elemental_fire: d({ id:"elemental_fire", name:"불의 정령", region:"city", type:"standard", baseStats:{hp:36,attack:13,defense:3,accuracy:18,evasion:12}, xp:25, properties:["flying"], sprite:frames("elemental",512,12,14,[0,1,2],[0,1,3],[4,5,6],"불의 정령"), skills:["elementalBolt"], skillRules:[rule("elementalBolt",{minRange:2,maxRange:7,cooldown:2,requiresLineOfSight:true})], aiProfile:"ranged", description:"화상을 남기는 원소 화살을 던집니다.", dropProfile:"standard", spawnWeight:2, production:true }),
  elemental_frost: d({ id:"elemental_frost", name:"서리 정령", region:"city", type:"standard", baseStats:{hp:36,attack:13,defense:3,accuracy:18,evasion:12}, xp:25, properties:["flying"], sprite:frames("elemental",512,12,14,[28,29,30],[28,29,31],[32,33,34],"서리 정령"), skills:["elementalBolt"], skillRules:[rule("elementalBolt",{minRange:2,maxRange:7,cooldown:2,requiresLineOfSight:true})], aiProfile:"ranged", description:"냉기를 남기는 원소 화살을 던집니다.", dropProfile:"standard", spawnWeight:2, production:true }),
  elemental_shock: d({ id:"elemental_shock", name:"전격 정령", region:"city", type:"standard", baseStats:{hp:36,attack:13,defense:3,accuracy:18,evasion:12}, xp:25, properties:["flying"], sprite:frames("elemental",512,12,14,[42,43,44],[42,43,45],[46,47,48],"전격 정령"), skills:["elementalBolt"], skillRules:[rule("elementalBolt",{minRange:2,maxRange:7,cooldown:2,requiresLineOfSight:true})], aiProfile:"ranged", description:"실명과 연쇄 전격을 일으키는 화살을 던집니다.", dropProfile:"standard", spawnWeight:1, production:true }),
  elemental_chaos: d({ id:"elemental_chaos", name:"혼돈 정령", region:"city", type:"rareAlt", baseStats:{hp:45,attack:16,defense:4,accuracy:22,evasion:14}, xp:34, properties:["flying"], sprite:frames("elemental",512,12,14,[56,57,58],[56,57,59],[60,61,62],"혼돈 정령"), skills:["elementalBolt"], skillRules:[rule("elementalBolt",{minRange:1,maxRange:7,cooldown:1,requiresLineOfSight:true})], aiProfile:"ranged", description:"명중률이 높은 예측 불가능한 혼돈 마법을 사용합니다.", dropProfile:"standard", spawnWeight:0, production:true }),
  warlock: d({ id:"warlock", name:"드워프 흑마법사", region:"city", type:"standard", baseStats:{hp:40,attack:14,defense:3,accuracy:19,evasion:10}, xp:27, properties:[], sprite:frames("warlock",256,12,15,[0,0,0,1],[0,2,3,4],[0,5,6],"드워프 흑마법사"), skills:["darkBolt"], skillRules:[rule("darkBolt",{minRange:2,maxRange:7,cooldown:2,requiresLineOfSight:true})], aiProfile:"ranged", description:"암흑 화살로 장비 효율을 약화시킵니다.", dropProfile:"standard", spawnWeight:2, production:true }),
  monk: d({ id:"monk", name:"드워프 수도승", region:"city", type:"standard", baseStats:{hp:42,attack:14,defense:4,accuracy:20,evasion:14}, xp:28, properties:[], sprite:frames("monk",256,15,14,[1,0,1,2],[11,12,13,14,15,16],[3,4,3,4],"드워프 수도승"), skills:[], skillRules:[], aiProfile:"melee", description:"집중을 모아 다음 공격을 한 번 완전히 막아냅니다.", dropProfile:"standard", spawnWeight:2, rareAlt:"senior", production:true }),
  senior: d({ id:"senior", name:"고위 수도승", region:"city", type:"rareAlt", baseStats:{hp:55,attack:17,defense:5,accuracy:22,evasion:16}, xp:38, properties:[], sprite:frames("monk",256,15,14,[18,17,18,19],[28,29,30,31,32,33],[20,21,20,21],"고위 수도승"), skills:[], skillRules:[], aiProfile:"melee", description:"더 빠르게 집중을 회복하는 희귀 수도승입니다.", dropProfile:"standard", spawnWeight:0, production:true }),
  golem: d({ id:"golem", name:"골렘", region:"city", type:"standard", baseStats:{hp:58,attack:17,defense:8,accuracy:19,evasion:6}, xp:35, properties:["large","inorganic"], sprite:frames("golem",256,17,19,[0,1],[2,3,4,5],[6,7,8],"골렘"), skills:["teleportSelf"], skillRules:[rule("teleportSelf",{priority:8,minRange:3,maxRange:8,cooldown:8,windupTurns:1,requiresLineOfSight:true})], aiProfile:"charger", description:"막힌 길을 전이하거나 대상을 자신에게서 떨어뜨립니다.", dropProfile:"standard", spawnWeight:3, production:true }),

  succubus: d({ id:"succubus", name:"서큐버스", region:"halls", type:"standard", baseStats:{hp:48,attack:17,defense:5,accuracy:21,evasion:15}, xp:32, properties:["demonic"], sprite:frames("succubus",256,12,15,[0,0,1,2],[3,4,5,6,7,8],[9,10,11],"서큐버스"), skills:["charm"], skillRules:[rule("charm",{priority:8,minRange:2,maxRange:6,cooldown:5,requiresLineOfSight:true})], aiProfile:"skirmisher", description:"대상을 매혹하고 순간이동으로 거리를 좁힙니다.", dropProfile:"standard", spawnWeight:2, production:true }),
  eye: d({ id:"eye", name:"악마의 눈", region:"halls", type:"standard", baseStats:{hp:56,attack:20,defense:5,accuracy:22,evasion:11}, xp:38, properties:["flying","demonic"], sprite:frames("eye",256,16,18,[0,1,2],[5,6],[4,3],"악마의 눈",[3,4]), skills:["deathGaze"], skillRules:[rule("deathGaze",{minRange:2,maxRange:10,cooldown:5,windupTurns:2,requiresLineOfSight:true,interruptible:false,targetLockMode:"fixed"})], aiProfile:"ranged", description:"2턴 동안 고정된 선을 예고한 뒤 죽음의 광선을 발사합니다.", dropProfile:"standard", spawnWeight:2, production:true }),
  scorpio: d({ id:"scorpio", name:"전갈", region:"halls", type:"standard", baseStats:{hp:52,attack:18,defense:5,accuracy:22,evasion:14}, xp:36, properties:["demonic"], sprite:frames("scorpio",256,17,17,[0,0,1,2],[5,5,6,6],[0,3,4],"전갈"), skills:["cripplingShot"], skillRules:[rule("cripplingShot",{minRange:2,maxRange:8,cooldown:1,requiresLineOfSight:true})], aiProfile:"skirmisher", description:"근접을 피하면서 둔화 독침을 발사합니다.", dropProfile:"standard", spawnWeight:3, rareAlt:"acidic", production:true }),
  acidic: d({ id:"acidic", name:"산성 전갈", region:"halls", type:"rareAlt", baseStats:{hp:64,attack:21,defense:6,accuracy:23,evasion:15}, xp:46, properties:["demonic"], sprite:frames("scorpio",256,17,17,[15,15,16,17],[20,21],[15,18,19],"산성 전갈"), skills:["acidicShot"], skillRules:[rule("acidicShot",{minRange:2,maxRange:8,cooldown:1,requiresLineOfSight:true})], aiProfile:"skirmisher", description:"산성 독침과 근접 반격성 점액을 사용합니다.", dropProfile:"standard", spawnWeight:0, production:true }),
  demon_spawner: d({ id:"demon_spawner", name:"악마 생성기", region:"halls", type:"special", baseStats:{hp:80,attack:0,defense:7,accuracy:1,evasion:0}, xp:45, properties:["immovable","demonic"], sprite:frames("spawner",256,16,16,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],[0,1,2],[0,1,2],"악마 생성기"), skills:["summonRipper"], skillRules:[rule("summonRipper",{maxRange:6,cooldown:12,windupTurns:1,maxActiveSummons:2})], aiProfile:"summoner", description:"주기적으로 리퍼 악마를 생성하는 고정형 악마 둥지입니다.", dropProfile:"none", spawnWeight:1, production:true }),
  ripper_demon: d({ id:"ripper_demon", name:"리퍼 악마", region:"halls", type:"summon", baseStats:{hp:42,attack:18,defense:4,accuracy:22,evasion:15}, xp:0, properties:["demonic","undead"], sprite:frames("ripper",256,15,14,[1,0,1,2],[3,4,5,6,7,8],[0,9,10,9],"리퍼 악마",[9,12]), skills:["shockLeap"], skillRules:[rule("shockLeap",{minRange:3,maxRange:6,cooldown:5,windupTurns:1,requiresLineOfSight:true,targetLockMode:"fixed"})], aiProfile:"charger", description:"고정된 착지점을 예고한 뒤 도약해 출혈을 일으킵니다.", dropProfile:"none", spawnWeight:0, production:true }),
  training_leaper: d({ id:"training_leaper", name:"훈련용 도약체", region:"halls", type:"dev", baseStats:{hp:999,attack:8,defense:4,accuracy:30,evasion:0}, xp:0, properties:[], sprite:frames("ripper",256,15,14,[1,0,1,2],[3,4,5,6,7,8],[0,9,10,9],"훈련용 도약체",[9,12]), skills:["shockLeap"], skillRules:[rule("shockLeap",{minRange:2,maxRange:7,cooldown:4,windupTurns:2,requiresLineOfSight:true,targetLockMode:"fixed"})], aiProfile:"charger", description:"개발자 Arena에서 2턴 Telegraph를 검증하는 전용 적입니다.", dropProfile:"none", spawnWeight:0, production:false }),
};

export const PRODUCTION_ENEMY_KINDS = (Object.keys(ENEMY_DEFINITIONS) as EnemyKind[])
  .filter((kind) => ENEMY_DEFINITIONS[kind].production);
export const enemyDefinition = (kind: EnemyKind) => ENEMY_DEFINITIONS[kind];

export type EnemyFactoryStats = EnemyDefinition["baseStats"] & { xp: number };

/** Registry-backed construction shared by production, quest, and summon actors. */
export const createEnemyFromDefinition = (
  kind: EnemyKind,
  id: string,
  point: Point,
  stats: EnemyFactoryStats,
  overrides: Partial<Enemy> = {},
): Enemy => {
  const definition = enemyDefinition(kind);
  return {
    id,
    kind,
    ...point,
    hp: stats.hp,
    maxHp: stats.hp,
    attack: stats.attack,
    defense: stats.defense,
    accuracy: stats.accuracy,
    evasion: stats.evasion,
    xp: stats.xp,
    alerted: false,
    sawPlayerLastTurn: false,
    sleeping: true,
    wakeCooldown: 0,
    lastSeenPlayer: null,
    searchTurns: 0,
    statuses: [],
    skillCooldowns: {},
    skillUses: {},
    pendingSkill: null,
    faction: "hostile",
    drop: definition.dropProfile === "none" ? null : undefined,
    ...overrides,
    id,
    kind,
    ...point,
  };
};
