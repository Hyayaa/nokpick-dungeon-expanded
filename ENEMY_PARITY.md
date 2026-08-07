# Enemy parity cache

기준: `00-Evan/shattered-pixel-dungeon`의 `MobSpawner.java`와 `actors/mobs/` (2026-08-08 확인). 수치는 이 프로젝트 진행도에 맞게 조정하며, 이 표는 원본 디렉터리를 다시 전수 조사하지 않기 위한 구현 캐시다.

| Original | Region | Type | Core mechanic | Skill mapping | Telegraph | Status |
|---|---|---|---|---|---|---|
| Rat | Sewers | standard | basic melee | basic attack | - | 구현 |
| Snake | Sewers | standard | high evasion | fastMelee | - | 구현 |
| Gnoll | Sewers | standard | basic melee | basic attack | - | 구현 |
| Swarm | Sewers | standard | flying, split | splitSwarm | - | 구현 |
| Crab | Sewers | standard | fast aquatic melee | fastMelee | - | 구현 |
| Slime | Sewers | standard | large-hit mitigation | damage hook | - | 구현 |
| Albino | Sewers | rareAlt | bleed attacks | melee bleed | - | 구현 |
| GnollExile | Sewers | rareAlt | tough reach fighter | melee profile | - | 구현 |
| HermitCrab | Sewers | rareAlt | slow heavy armor | melee profile | - | 구현 |
| CausticSlime | Sewers | rareAlt | acidic ooze | melee corrosion | - | 구현 |
| Skeleton | Prison | standard | undead death burst | death burst | - | 구현 |
| Thief | Prison | standard | steal then flee | shadowStep + theft hook | - | 구현 |
| DM100 | Prison | standard | ranged lightning | lightningBolt | - | 구현 |
| Guard | Prison | standard | one-use chain pull | chainPull | 즉시 | 구현 |
| Necromancer | Prison | standard | summon/support skeleton | summonSkeleton | 1턴 | 구현 |
| Bandit | Prison | rareAlt | steal + triple debuff | shadowStep + statuses | - | 구현 |
| SpectralNecromancer | Prison | rareAlt | summon wraith | summonWraith | 1턴 | 구현 |
| NecroSkeleton | Prison | summon | owner-linked skeleton | generic summon owner | - | 구현 |
| Wraith | Prison | summon | 1 HP, extreme evasion | generic summon owner | - | 구현 |
| Bat | Caves | standard | flying lifesteal | lifeSteal | - | 구현 |
| Brute | Caves | standard | lethal rage shield | bruteRage | - | 구현 |
| Red Shaman | Caves | standard | ranged weakness | shamanBolt | - | 구현 |
| Blue Shaman | Caves | standard | ranged vulnerability | shamanBolt | - | 구현 |
| Purple Shaman | Caves | standard | ranged hex | shamanBolt | - | 구현 |
| Spinner | Caves | standard | poison + predictive web | poisonWeb | 1턴 | 구현 |
| DM200 | Caves | standard | toxic gas vent | toxicVent | 1턴 | 구현 |
| ArmoredBrute | Caves | rareAlt | armor + durable rage | bruteRage | - | 구현 |
| DM201 | Caves | rareAlt | immovable corrosive vent | corrosiveVent | 1턴 | 구현 |
| Ghoul | City | standard | group resurrection | ghoulRevive | - | 구현 |
| FireElemental | City | standard | fire bolt/burn | elementalBolt | - | 구현 |
| FrostElemental | City | standard | frost bolt/chill | elementalBolt | - | 구현 |
| ShockElemental | City | standard | shock bolt/blind | elementalBolt | - | 구현 |
| ChaosElemental | City | rareAlt | accurate chaotic magic | elementalBolt | - | 구현 |
| Warlock | City | standard | ranged degradation | darkBolt | - | 구현 |
| Monk | City | standard | focus/parry | focus behavior | - | 구현 |
| Senior | City | rareAlt | faster focus/parry | focus behavior | - | 구현 |
| Golem | City | standard | target/self teleport | teleportSelf | 1턴 | 구현 |
| Succubus | Halls | standard | blink + charm | charm | 즉시 | 구현 |
| Evil Eye | Halls | standard | fixed charged death ray | deathGaze | 2턴 선 | 구현 |
| Scorpio | Halls | standard | ranged kiting/cripple | cripplingShot | - | 구현 |
| Acidic | Halls | rareAlt | acidic ranged kiting | acidicShot | - | 구현 |
| DemonSpawner | Halls | special | immovable ripper producer | summonRipper | 1턴 | 구현 |
| RipperDemon | Halls | summon | predicted leap + bleed | shared shockLeap | 1턴 범위 | 구현 |
| Statue | Any | special | animated equipment statue | equipment-generated loadout | - | 미구현 — special-room equipment producer 필요 |
| ArmoredStatue | Any | special | armored equipment statue | equipment-generated loadout | - | 미구현 — special-room equipment producer 필요 |
| Mimic | Any | special | chest ambush | chest transform | - | 미구현 — object-to-enemy producer 필요 |
| GoldenMimic | Any | special | fast golden chest ambush | chest transform | - | 미구현 — object-to-enemy producer 필요 |
| CrystalMimic | Any | special | crystal chest ambush | chest transform | - | 미구현 — object-to-enemy producer 필요 |
| EbonyMimic | Any | miniboss | scaling mimic | chest transform | - | 미구현 — object-to-enemy producer 필요 |
| Piranha | Sewers | special | aquatic ambush | aquatic profile | - | 미구현 — water-room producer 필요 |
| PhantomPiranha | Sewers | special | spectral aquatic ambush | aquatic profile | - | 미구현 — water-room producer 필요 |
| Bee | Any | summon | ally/hostile thrown-pot summon | generic summon | - | 미구현 — honeypot item producer 필요 |
| RotHeart | Sewers | miniboss | rooted plant core | plant summon/support | - | 미구현 — wandmaker quest producer 필요 |
| RotLasher | Sewers | summon | plant tentacle | generic summon | - | 미구현 — RotHeart quest dependency |
| FetidRat | Sewers | miniboss | caustic quest rat | caustic cloud | - | 미구현 — ghost quest producer 필요 |
| GnollTrickster | Sewers | miniboss | ranged trickster | ranged profile | - | 미구현 — ghost quest producer 필요 |
| GreatCrab | Sewers | miniboss | directional defense | directional block | - | 미구현 — ghost quest producer 필요 |
| NewbornFireElemental | Prison | miniboss | charged fire burst | elemental burst | 1턴 범위 | 미구현 — wandmaker quest producer 필요 |
| TormentedSpirit | Prison | special | curse interaction | curse cleanse combat | - | 미구현 — quest/dialog dependency |
| FungalCore | Caves | miniboss | fungal encounter core | summon/support | - | 미구현 — cave quest producer 필요 |
| FungalSentry | Caves | special | rooted ranged sentry | ranged bolt | - | 미구현 — fungal encounter dependency |
| FungalSpinner | Caves | special | fungal web spinner | poisonWeb variant | 1턴 | 미구현 — fungal encounter dependency |
| GnollGuard | Caves | special | gnoll encounter guard | melee profile | - | 미구현 — gnoll quest producer 필요 |
| GnollSapper | Caves | special | explosive ranged sapper | bomb projectile | 1턴 범위 | 미구현 — gnoll quest producer 필요 |
| GnollGeomancer | Caves | miniboss | terrain geomancy | terrain skill | 범위 | 미구현 — scripted arena dependency |
| CrystalWisp | Caves | special | crystal ranged wisp | ranged bolt | - | 미구현 — crystal room producer 필요 |
| CrystalSpire | Caves | special | immovable crystal turret | line bolt | 선 | 미구현 — crystal room producer 필요 |
| CrystalGuardian | Caves | special | crystal melee guardian | melee profile | - | 미구현 — crystal room producer 필요 |
| VaultRat | Any | special | vault scaling rat | melee profile | - | 미구현 — vault producer 필요 |
| VaultMob | Any | special | vault wrapper | registry delegation | - | 미구현 — vault producer 필요 |
| Goo | Sewers | boss | pump-up + caustic arena | combat skills | 범위 | 후속 boss 작업 |
| Tengu | Prison | boss | phase traps/arena | combat skills + script | 범위 | 후속 boss 작업 |
| DM300 | Caves | boss | pylon phases | combat skills + arena | 범위 | 후속 boss 작업 |
| DwarfKing | City | boss | throne phases/summons | combat skills + script | 범위 | 후속 boss 작업 |
| YogDzewa | Halls | boss | fists/larvae phases | combat skills + summon | 범위 | 후속 boss 작업 |
| YogFist variants | Halls | boss | elemental fists | combat skills | 범위 | 후속 boss 작업 |
| Larva | Halls | summon | Yog minion | generic summon | - | 후속 boss 작업 |

Production scope: MobSpawner standard rotation + 11 rare alternates + their hostile summons, plus Halls DemonSpawner/Ripper dependency. Boss phase/arena logic remains for `feature/boss-overhaul` on the same Combat Skill, summon, status, movement, AI, and Telegraph foundation.
