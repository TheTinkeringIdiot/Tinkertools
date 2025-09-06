/**
 * TinkerTools Game Data Constants
 * 
 * Static game data constants converted from Python utilities.
 * This serves as the "Rosetta Stone" for translating between human-readable names
 * and numeric database IDs used in Anarchy Online.
 */

// ============================================================================
// Core Game Constants
// ============================================================================

/**
 * List of stats that require interpolation
 */
export const INTERP_STATS = [
  1, 2, 3, 8, 16, 17, 18, 19, 20, 21, 22, 27, 29, 36, 37, 54, 61, 71, 74, 90, 91, 92, 93, 94, 95, 96, 97, 100, 101, 102, 103, 104, 105,
  106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133,
  134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161,
  162, 163, 164, 165, 166, 167, 168, 201, 204, 205, 206, 207, 208, 214, 216, 217, 218, 219, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234,
  238, 239, 240, 241, 242, 243, 244, 245, 276, 277, 278, 279, 280, 281, 282, 284, 285, 286, 287, 294, 311, 315, 316, 317, 318, 319, 343, 364,
  374, 375, 379, 380, 381, 382, 383, 475, 476, 477, 478, 479, 480, 481, 482, 483
] as const;

/**
 * Stat ID to human-readable name mapping
 */
export const STAT = {
  0: 'None',
  1: 'MaxHealth',
  2: 'Mass',
  3: 'AttackSpeed',
  4: 'Breed',
  5: 'Organization',
  6: 'Team',
  7: 'State',
  8: 'Duration',
  9: 'MapFlags',
  10: 'ProfessionLevel',
  11: 'PreviousHealth',
  12: 'Mesh',
  13: 'Anim',
  14: 'Name',
  15: 'Info',
  16: 'Strength',
  17: 'Agility',
  18: 'Stamina',
  19: 'Intelligence',
  20: 'Sense',
  21: 'Psychic',
  22: 'AMS',
  23: 'StaticInstance',
  24: 'MaxMass',
  25: 'StaticType',
  26: 'Energy',
  27: 'Health',
  28: 'Height',
  29: 'DMS',
  30: 'Can',
  31: 'Face',
  32: 'HairMesh',
  33: 'Faction',
  34: 'DeadTimer',
  35: 'AccessCount',
  36: 'AttackCount',
  37: 'TitleLevel',
  38: 'BackMesh',
  39: 'ShoulderMesh',
  40: 'AlienXP',
  41: 'FabricType',
  42: 'CATMesh',
  43: 'ParentType',
  44: 'ParentInstance',
  45: 'BeltSlots',
  46: 'BandolierSlots',
  47: 'Girth',
  48: 'ClanLevel',
  49: 'InsuranceTime',
  50: 'InventoryTimeout',
  51: 'AggDef',
  52: 'XP',
  53: 'IP',
  54: 'Level',
  55: 'InventoryId',
  56: 'TimeSinceCreation',
  57: 'LastXP',
  58: 'Age',
  59: 'Gender',
  60: 'Profession',
  61: 'Credits',
  62: 'Alignment',
  63: 'Attitude',
  64: 'HeadMesh',
  65: 'HairTexture',
  66: 'ShoulderTexture',
  67: 'HairColourRGB',
  68: 'NumConstructedQuest',
  69: 'MaxConstructedQuest',
  70: 'SpeedPenalty',
  71: 'TotalMass',
  72: 'ItemType',
  73: 'RepairDifficulty',
  74: 'Value',
  75: 'NanoStrain',
  76: 'ItemClass',
  77: 'RepairSkill',
  78: 'CurrentMass',
  79: 'Icon',
  80: 'PrimaryItemType',
  81: 'PrimaryItemInstance',
  82: 'SecondaryItemType',
  83: 'SecondaryItemInstance',
  84: 'UserType',
  85: 'UserInstance',
  86: 'AreaType',
  87: 'AreaInstance',
  88: 'DefaultSlot',
  89: 'Breed2',
  90: 'ProjectileAC',
  91: 'MeleeAC',
  92: 'EnergyAC',
  93: 'ChemicalAC',
  94: 'RadiationAC',
  95: 'ColdAC',
  96: 'PoisonAC',
  97: 'FireAC',
  98: 'StateAction',
  99: 'ItemAnim',
  100: 'MartialArts',
  101: 'MultiMelee',
  102: '1hBlunt',
  103: '1hEdged',
  104: 'MeleeEnergy',
  105: '2hEdged',
  106: 'Piercing',
  107: '2hBlunt',
  108: 'SharpObjects',
  109: 'Grenade',
  110: 'HeavyWeapons',
  111: 'Bow',
  112: 'Pistol',
  113: 'Rifle',
  114: 'MG_SMG',
  115: 'Shotgun',
  116: 'AssaultRifle',
  117: 'VehicleWater',
  118: 'MeleeInit',
  119: 'RangedInit',
  120: 'PhysicalInit',
  121: 'BowSpecialAttack',
  122: 'SensoryImprovement',
  123: 'FirstAid',
  124: 'Treatment',
  125: 'MechanicalEngineering',
  126: 'ElectricalEngineering',
  127: 'MaterialMetamorphose',
  128: 'BiologicalMetamorphose',
  129: 'PsychologicalModification',
  130: 'MaterialCreation',
  131: 'SpaceTime',
  132: 'NanoPool',
  133: 'RangedEnergy',
  134: 'MultiRanged',
  135: 'TrapDisarm',
  136: 'Perception',
  137: 'Adventuring',
  138: 'Swimming',
  139: 'VehicleAir',
  140: 'MapNavigation',
  141: 'Tutoring',
  142: 'Brawl',
  143: 'Riposte',
  144: 'Dimach',
  145: 'Parry',
  146: 'SneakAttack',
  147: 'FastAttack',
  148: 'Burst',
  149: 'NanoInit',
  150: 'FlingShot',
  151: 'AimedShot',
  152: 'BodyDevelopment',
  153: 'DuckExplosions',
  154: 'DodgeRanged',
  155: 'EvadeClose',
  156: 'RunSpeed',
  157: 'QuantumFT',
  158: 'WeaponSmithing',
  159: 'Pharmaceuticals',
  160: 'NanoProgramming',
  161: 'ComputerLiteracy',
  162: 'Psychology',
  163: 'Chemistry',
  164: 'Concealment',
  165: 'BreakingEntry',
  166: 'VehicleGround',
  167: 'FullAuto',
  168: 'NanoResist',
  169: 'AlienLevel',
  170: 'HealthChangeBest',
  171: 'HealthChangeWorst',
  172: 'HealthChange',
  173: 'CurrentMovementMode',
  174: 'PrevMovementMode',
  175: 'AutoLockTimeDefault',
  176: 'AutoUnlockTimeDefault',
  177: 'MoreFlags',
  178: 'AlienNextXP',
  179: 'NPCFlags',
  180: 'CurrentNCU',
  181: 'MaxNCU',
  182: 'Specialization',
  183: 'EffectIcon',
  184: 'BuildingType',
  185: 'BuildingInstance',
  186: 'CardOwnerType',
  187: 'CardOwnerInstance',
  188: 'BuildingComplexInst',
  189: 'ExitInstance',
  190: 'NextDoorInBuilding',
  191: 'LastConcretePlayfieldInstance',
  192: 'ExtenalPlayfieldInstance',
  193: 'ExtenalDoorInstance',
  194: 'InPlay',
  195: 'AccessKey',
  196: 'ConflictReputation',
  197: 'OrientationMode',
  198: 'SessionTime',
  199: 'ResetPoints',
  200: 'Conformity',
  201: 'Aggressiveness',
  202: 'Stability',
  203: 'Extroverty',
  204: 'Taunt',
  205: 'ReflectProjectileAC',
  206: 'ReflectMeleeAC',
  207: 'ReflectEnergyAC',
  208: 'ReflectChemicalAC',
  209: 'WeaponMesh',
  210: 'RechargeDelay',
  211: 'EquipDelay',
  212: 'MaxEnergy',
  213: 'TeamFaction',
  214: 'CurrentNano',
  215: 'GmLevel',
  216: 'ReflectRadiationAC',
  217: 'ReflectColdAC',
  218: 'ReflectNanoAC',
  219: 'ReflectFireAC',
  220: 'CurrBodyLocation',
  221: 'MaxNanoEnergy',
  222: 'AccumulatedDamage',
  223: 'CanChangeClothes',
  224: 'Features',
  225: 'ReflectPoisonAC',
  226: 'ShieldProjectileAC',
  227: 'ShieldMeleeAC',
  228: 'ShieldEnergyAC',
  229: 'ShieldChemicalAC',
  230: 'ShieldRadiationAC',
  231: 'ShieldColdAC',
  232: 'ShieldNanoAC',
  233: 'ShieldFireAC',
  234: 'ShieldPoisonAC',
  235: 'BerserkMode',
  236: 'InsurancePercentage',
  237: 'ChangeSideCount',
  238: 'AbsorbProjectileAC',
  239: 'AbsorbMeleeAC',
  240: 'AbsorbEnergyAC',
  241: 'AbsorbChemicalAC',
  242: 'AbsorbRadiationAC',
  243: 'AbsorbColdAC',
  244: 'AbsorbFireAC',
  245: 'AbsorbPoisonAC',
  246: 'AbsorbNanoAC',
  247: 'TemporarySkillReduction',
  248: 'BirthDate',
  249: 'LastSaved',
  250: 'SoundVolume',
  251: 'CheckPetType',
  252: 'MetersWalked',
  253: 'QuestLevelsSolved',
  254: 'MonsterLevelsKilled',
  255: 'PvPLevelsKilled',
  256: 'MissionBits1',
  257: 'MissionBits2',
  258: 'AccessGrant',
  259: 'DoorFlags',
  260: 'ClanHierarchy',
  261: 'QuestStat',
  262: 'ClientActivated',
  263: 'PersonalResearchLevel',
  264: 'GlobalResearchLevel',
  265: 'PersonalResearchGoal',
  266: 'GlobalResearchGoal',
  267: 'TurnSpeed',
  268: 'LiquidType',
  269: 'GatherSound',
  270: 'CastSound',
  271: 'TravelSound',
  272: 'HitSound',
  273: 'SecondaryItemTemplate',
  274: 'EquippedWeapons',
  275: 'XPKillRange',
  276: 'AddAllOffense',
  277: 'AddAllDefense',
  278: 'ProjectileDamageModifier',
  279: 'MeleeDamageModifier',
  280: 'EnergyDamageModifier',
  281: 'ChemicalDamageModifier',
  282: 'RadiationDamageModifier',
  283: 'ItemHateValue',
  284: 'CriticalBonus',
  285: 'MaxDamage',
  286: 'MinDamage',
  287: 'AttackRange',
  288: 'HateValueModifier',
  289: 'TrapDifficulty',
  290: 'StatOne',
  291: 'NumAttackEffects',
  292: 'DefaultAttackType',
  293: 'ItemSkill',
  294: 'AttackDelay',
  295: 'ItemOpposedSkill',
  296: 'ItemSIS',
  297: 'InteractionRadius',
  298: 'Slot',
  299: 'LockDifficulty',
  300: 'Members',
  301: 'MinMembers',
  302: 'ClanPrice',
  303: 'ClanUpkeep',
  304: 'ClanType',
  305: 'ClanInstance',
  306: 'VoteCount',
  307: 'MemberType',
  308: 'MemberInstance',
  309: 'GlobalClanType',
  310: 'GlobalClanInstance',
  311: 'ColdDamageModifier',
  312: 'ClanUpkeepInterval',
  313: 'TimeSinceUpkeep',
  314: 'ClanFinalized',
  315: 'NanoDamageModifier',
  316: 'FireDamageModifier',
  317: 'PoisonDamageModifier',
  318: 'NanoCost',
  319: 'XPModifier',
  320: 'BreedLimit',
  321: 'GenderLimit',
  322: 'LevelLimit',
  323: 'PlayerKilling',
  324: 'TeamAllowed',
  325: 'WeaponDisallowedType',
  326: 'WeaponDisallowedInstance',
  327: 'Taboo',
  328: 'Compulsion',
  329: 'SkillDisabled',
  330: 'ClanItemType',
  331: 'ClanItemInstance',
  332: 'DebuffFormula',
  333: 'PvPRating',
  334: 'SavedXP',
  335: 'DoorBlockTime',
  336: 'OverrideTexture',
  337: 'OverrideMaterial',
  338: 'DeathReason',
  339: 'DamageType',
  340: 'BrainType',
  341: 'XPBonus',
  342: 'HealInterval',
  343: 'HealDelta',
  344: 'MonsterTexture',
  345: 'HasAlwaysLootable',
  346: 'TradeLimit',
  347: 'FaceTexture',
  348: 'SpecialCondition',
  349: 'AutoAttackFlags',
  350: 'NextXP',
  351: 'TeleportPauseMilliSeconds',
  352: 'SISCap',
  353: 'AnimSet',
  354: 'AttackType',
  355: 'WornItem',
  356: 'NPCHash',
  357: 'CollisionRadius',
  358: 'OuterRadius',
  359: 'ShapeShift',
  360: 'Scale',
  361: 'HitEffectType',
  362: 'ResurrectDestination',
  363: 'NanoInterval',
  364: 'NanoDelta',
  365: 'ReclaimItem',
  366: 'GatherEffectType',
  367: 'VisualBreed',
  368: 'VisualProfession',
  369: 'VisualGender',
  370: 'RitualTargetInst',
  371: 'SkillTimeOnSelectedTarget',
  372: 'LastSaveXP',
  373: 'ExtendedTime',
  374: 'BurstRecharge',
  375: 'FullAutoRecharge',
  376: 'GatherAbstractAnim',
  377: 'CastTargetAbstractAnim',
  378: 'CastSelfAbstractAnim',
  379: 'CriticalIncrease',
  380: 'WeaponRange',
  381: 'NanoRange',
  382: 'SkillLockModifier',
  383: 'NanoInterruptModifier',
  384: 'EntranceStyles',
  385: 'ChanceOfBreakOnSpellAttack',
  386: 'ChanceOfBreakOnDebuff',
  387: 'DieAnim',
  388: 'TowerType',
  389: 'Expansion',
  390: 'LowresMesh',
  391: 'CriticalResistance',
  392: 'OldTimeExist',
  393: 'ResistModifier',
  394: 'ChestFlags',
  395: 'PrimaryTemplateID',
  396: 'NumberOfItems',
  397: 'SelectedTargetType',
  398: 'CorpseHash',
  399: 'AmmoName',
  400: 'Rotation',
  401: 'CATAnim',
  402: 'CATAnimFlags',
  403: 'DisplayCATAnim',
  404: 'DisplayCATMesh',
  405: 'NanoSchool',
  406: 'NanoSpeed',
  407: 'NanoPoints',
  408: 'TrainSkill',
  409: 'TrainSkillCost',
  410: 'InFight',
  411: 'NextFormula',
  412: 'MultipleCount',
  413: 'EffectType',
  414: 'ImpactEffectType',
  415: 'CorpseType',
  416: 'CorpseInstance',
  417: 'CorpseAnimKey',
  418: 'UnarmedTemplateInstance',
  419: 'TracerEffectType',
  420: 'AmmoType',
  421: 'CharRadius',
  422: 'ChanceOfBreakOnAttack',
  423: 'CurrentState',
  424: 'ArmorType',
  425: 'RestModifier',
  426: 'BuyModifier',
  427: 'SellModifier',
  428: 'CastEffectType',
  429: 'NPCBrainState',
  430: 'WaitState',
  431: 'SelectedTarget',
  432: 'ErrorCode',
  433: 'OwnerInstance',
  434: 'CharState',
  435: 'ReadOnly',
  436: 'DamageType2',
  437: 'CollideCheckInterval',
  438: 'PlayfieldType',
  439: 'NPCCommand',
  440: 'InitiativeType',
  441: 'CharTmp1',
  442: 'CharTmp2',
  443: 'CharTmp3',
  444: 'CharTmp4',
  445: 'NPCCommandArg',
  446: 'NameTemplate',
  447: 'DesiredTargetDistance',
  448: 'VicinityRange',
  449: 'NPCIsSurrendering',
  450: 'StateMachine',
  451: 'NPCSurrenderInstance',
  452: 'NPCHasPatrolList',
  453: 'NPCVicinityChars',
  454: 'ProximityRangeOutdoors',
  455: 'NPCFamily',
  456: 'CommandRange',
  457: 'NPCHatelistSize',
  458: 'NPCNumPets',
  459: 'ODMinSizeAdd',
  460: 'EffectRed',
  461: 'EffectGreen',
  462: 'EffectBlue',
  463: 'ODMaxSizeAdd',
  464: 'DurationModifier',
  465: 'NPCCryForHelpRange',
  466: 'LOSHeight',
  467: 'SLZoneProtection',
  468: 'PetReq2',
  469: 'PetReq3',
  470: 'MapUpgrades',
  471: 'MapFlags1',
  472: 'MapFlags2',
  473: 'FixtureFlags',
  474: 'FallDamage',
  475: 'MaxReflectedProjectileAC',
  476: 'MaxReflectedMeleeAC',
  477: 'MaxReflectedEnergyAC',
  478: 'MaxReflectedChemicalAC',
  479: 'MaxReflectedRadiationAC',
  480: 'MaxReflectedColdAC',
  481: 'MaxReflectedNanoAC',
  482: 'MaxReflectedFireAC',
  483: 'MaxReflectedPoisonAC',
  484: 'ProximityRangeIndoors',
  485: 'PetReqVal1',
  486: 'PetReqVal2',
  487: 'PetReqVal3',
  488: 'TargetFacing',
  489: 'Backstab',
  490: 'OriginatorType',
  491: 'QuestInstance',
  492: 'QuestIndex1',
  493: 'QuestIndex2',
  494: 'QuestIndex3',
  495: 'QuestIndex4',
  496: 'QuestIndex5',
  497: 'QTDungeonInstance',
  498: 'QTNumMonsters',
  499: 'QTKilledMonsters',
  500: 'AnimPos',
  501: 'AnimPlay',
  502: 'AnimSpeed',
  503: 'QTKillNumMonsterID1',
  504: 'QTKillNumMonsterCount1',
  505: 'QTKillNumMonsterID2',
  506: 'QTKillNumMonsterCount2',
  507: 'QTKillNumMonsterID3',
  508: 'QTKillNumMonsterCount3',
  509: 'QuestIndex0',
  510: 'QuestTimeout',
  511: 'TowerNPCHash',
  512: 'PetType',
  513: 'OnTowerCreation',
  514: 'OwnedTowers',
  515: 'TowerInstance',
  516: 'AttackShield',
  517: 'SpecialAttackShield',
  518: 'NPCVicinityPlayers',
  519: 'NPCUseFightModeRegenRate',
  520: 'RandomNumberRoll',
  521: 'SocialStatus',
  522: 'LastRnd',
  523: 'AttackDelayCap',
  524: 'RechargeDelayCap',
  525: 'RemainingHealth',
  526: 'RemainingNano',
  527: 'TargetDistance',
  528: 'TeamLevel',
  529: 'NumberOnHateList',
  530: 'ConditionState',
  531: 'ExpansionPlayfield',
  532: 'ShadowBreed',
  533: 'NPCFovStatus',
  534: 'DudChance',
  535: 'HealModifier',
  536: 'NanoDamage',
  537: 'NanoVulnerability',
  538: 'MaxBeneficialSkill',
  539: 'ProcInitiative1',
  540: 'ProcInitiative2',
  541: 'ProcInitiative3',
  542: 'ProcInitiative4',
  543: 'FactionModifier',
  545: 'Flag265',
  546: 'StackingLine2',
  547: 'StackingLine3',
  548: 'StackingLine4',
  549: 'StackingLine5',
  550: 'StackingLine6',
  551: 'StackingOrder',
  552: 'ProcNano1',
  553: 'ProcNano2',
  554: 'ProcNano3',
  555: 'ProcNano4',
  556: 'ProcChance1',
  557: 'ProcChance2',
  558: 'ProcChance3',
  559: 'ProcChance4',
  560: 'OTArmedForces',
  561: 'ClanSentinels',
  562: 'OTMed',
  563: 'ClanGaia',
  564: 'OTTrans',
  565: 'ClanVanguards',
  566: 'GaurdianOfShadows',
  567: 'OTFollowers',
  568: 'OTOperator',
  569: 'OTUnredeemed',
  570: 'ClanDevoted',
  571: 'ClanConserver',
  572: 'ClanRedeemed',
  573: 'SK',
  574: 'LastSK',
  575: 'NextSK',
  576: 'PlayerOptions',
  577: 'LastPerkResetTime',
  578: 'CurrentTime',
  579: 'ShadowBreedTemplate',
  580: 'NPCVicinityFamily',
  581: 'NPCScriptAMSScale',
  582: 'ApartmentsAllowed',
  583: 'ApartmentsOwned',
  584: 'ApartmentAccessCard',
  585: 'MapFlags3',
  586: 'MapFlags4',
  587: 'NumberOfTeamMembers',
  588: 'ActionCategory',
  589: 'CurrentPlayfield',
  590: 'DistrictNano',
  591: 'DistrictNanoInterval',
  592: 'UnsavedXP',
  593: 'RegainXP',
  594: 'TempSaveTeamID',
  595: 'TempSavePlayfield',
  596: 'TempSaveX',
  597: 'TempSaveY',
  598: 'ExtendedFlags',
  599: 'ShopPrice',
  600: 'NewbieHP',
  601: 'HPLevelUp',
  602: 'HPPerSkill',
  603: 'NewbieNP',
  604: 'NPLevelUp',
  605: 'NPPerSkill',
  606: 'MaxShopItems',
  607: 'PlayerID',
  608: 'ShopRent',
  609: 'SynergyHash',
  610: 'ShopFlags',
  611: 'ShopLastUsed',
  612: 'ShopType',
  613: 'LockDownTime',
  614: 'LeaderLockDownTime',
  615: 'InvadersKilled',
  616: 'KilledByInvaders',
  618: 'Flag323',
  620: 'HouseTemplate',
  621: 'FireDamage',
  622: 'ColdDamage',
  623: 'MeleeDamage',
  624: 'ProjectileDamage',
  625: 'PoisonDamage',
  626: 'RadiationDamage',
  627: 'EnergyDamage',
  628: 'ChemicalDamage',
  629: 'TotalDamage',
  630: 'TrackProjectileDamage',
  631: 'TrackMeleeDamage',
  632: 'TrackEnergyDamage',
  633: 'TrackChemicalDamage',
  634: 'TrackRadiationDamage',
  635: 'TrackColdDamage',
  636: 'TrackPoisonDamage',
  637: 'TrackFireDamage',
  638: 'NPCSpellArg1',
  639: 'NPCSpellRet1',
  640: 'CityInstance',
  641: 'DistanceToSpawnpoint',
  642: 'CityTerminalRechargePercent',
  643: 'CooldownTime1',
  644: 'CooldownTime2',
  645: 'CooldownTime3',
  646: 'CooldownTime4',
  647: 'CooldownTime5',
  648: 'CooldownTime6',
  651: 'AdvantageHash1',
  652: 'AdvantageHash2',
  653: 'AdvantageHash3',
  654: 'AdvantageHash4',
  655: 'AdvantageHash5',
  656: 'ShopIndex',
  657: 'ShopID',
  658: 'IsVehicle',
  659: 'DamageToNano',
  660: 'AccountFlags',
  661: 'DamageToNano2',
  662: 'MechData',
  663: 'PointValue',
  664: 'VehicleAC',
  665: 'VehicleDamage',
  666: 'VehicleHealth',
  667: 'VehicleSpeed',
  668: 'BattlestationFaction',
  669: 'VictoryPoints',
  670: 'BattlestationRep',
  671: 'PetState',
  672: 'PaidPoints',
  674: 'PvpDuelKills',
  675: 'PvpDuelDeaths',
  676: 'PvpProfessionDuelKills',
  677: 'PvpProfessionDuelDeaths',
  682: 'PvpSoloScore',
  683: 'PvpTeamScore',
  684: 'PvpDuelScore',
  685: 'MissionBits14',
  686: 'MissionBits15',
  687: 'ConfirmUseTextInstance',
  688: 'ItemRarity',
  689: 'HealReactivityMultiplier',
  690: 'RHandWeaponType',
  691: 'FullIPR',
  695: 'IccCommendations',
  696: 'FreelancersIncTokens',
  700: 'ItemSeed',
  701: 'ItemLevel',
  702: 'ItemTemplateID',
  703: 'ItemTemplateID2',
  704: 'ItemCategoryID',
  768: 'HasKnubotData',
  800: 'QuestBoothDifficulty',
  801: 'QuestASMinimumRange',
  802: 'QuestASMaximumRange',
  888: 'VisualLODLevel',
  889: 'TargetDistanceChange',
  900: 'TideRequiredDynelID',
  999: 'StreamCheckMagic',
  1001: 'Type',
  1002: 'Instance',
  1003: 'NanoSubStrain',
  649: 'Unknown649',
  10207: 'Unknown10207'
} as const;

/**
 * Requirements mapping - used for item and nano requirements
 */
export const REQUIREMENTS = {
  '-1': 'Any',
  102: '1hBlunt',
  103: '1hEdged',
  107: '2hBlunt',
  105: '2hEdged',
  22: 'AMS',
  660: 'AccountFlags',
  137: 'Adventuring',
  51: 'AggDef',
  17: 'Agility',
  151: 'AimedShot',
  169: 'AlienLevel',
  62: 'Alignment',
  582: 'ApartmentsAllowed',
  583: 'ApartmentsOwned',
  116: 'AssaultRifle',
  354: 'AttackType',
  349: 'AutoAttackFlags',
  668: 'BattlestationFaction',
  128: 'BiologicalMetamorphose',
  152: 'BodyDevelopment',
  111: 'Bow',
  121: 'BowSpecialAttack',
  142: 'Brawl',
  165: 'BreakingEntry',
  4: 'Breed',
  148: 'Burst',
  434: 'CharState',
  441: 'CharTmp1',
  251: 'CheckPetType',
  93: 'ChemicalAC',
  628: 'ChemicalDamage',
  163: 'Chemistry',
  571: 'ClanConserver',
  570: 'ClanDevoted',
  48: 'ClanLevel',
  572: 'ClanRedeemed',
  95: 'ColdAC',
  622: 'ColdDamage',
  161: 'ComputerLiteracy',
  164: 'Concealment',
  61: 'Credits',
  173: 'CurrentMovementMode',
  214: 'CurrentNano',
  589: 'CurrentPlayfield',
  144: 'Dimach',
  154: 'DodgeRanged',
  153: 'DuckExplosions',
  126: 'ElectricalEngineering',
  92: 'EnergyAC',
  627: 'EnergyDamage',
  280: 'EnergyDamageModifier',
  274: 'EquippedWeapons',
  155: 'EvadeClose',
  389: 'Expansion',
  531: 'ExpansionPlayfield',
  33: 'Faction',
  147: 'FastAttack',
  224: 'Features',
  97: 'FireAC',
  621: 'FireDamage',
  123: 'FirstAid',
  618: 'Flag323',
  150: 'FlingShot',
  167: 'FullAuto',
  566: 'GaurdianOfShadows',
  59: 'Gender',
  47: 'Girth',
  215: 'GmLevel',
  109: 'Grenade',
  67: 'HairColourRGB',
  65: 'HairTexture',
  64: 'HeadMesh',
  27: 'Health',
  110: 'HeavyWeapons',
  410: 'InFight',
  19: 'Intelligence',
  702: 'ItemTemplateID',
  522: 'LastRnd',
  54: 'Level',
  114: 'MG_SMG',
  471: 'MapFlags1',
  472: 'MapFlags2',
  586: 'MapFlags4',
  140: 'MapNavigation',
  470: 'MapUpgrades',
  100: 'MartialArts',
  130: 'MaterialCreation',
  127: 'MaterialMetamorphose',
  1: 'MaxHealth',
  221: 'MaxNanoEnergy',
  662: 'MechData',
  125: 'MechanicalEngineering',
  91: 'MeleeAC',
  623: 'MeleeDamage',
  104: 'MeleeEnergy',
  118: 'MeleeInit',
  300: 'Members',
  12: 'Mesh',
  301: 'MinMembers',
  685: 'MissionBits14',
  686: 'MissionBits15',
  257: 'MissionBits2',
  101: 'MultiMelee',
  134: 'MultiRanged',
  455: 'NPCFamily',
  457: 'NPCHatelistSize',
  132: 'NanoPool',
  160: 'NanoProgramming',
  168: 'NanoResist',
  75: 'NanoStrain',
  0: 'None',
  587: 'NumberOfTeamMembers',
  567: 'OTFollowers',
  568: 'OTOperator',
  569: 'OTUnredeemed',
  5: 'Organization',
  145: 'Parry',
  136: 'Perception',
  159: 'Pharmaceuticals',
  106: 'Piercing',
  112: 'Pistol',
  438: 'PlayfieldType',
  96: 'PoisonAC',
  625: 'PoisonDamage',
  60: 'Profession',
  10: 'ProfessionLevel',
  90: 'ProjectileAC',
  624: 'ProjectileDamage',
  21: 'Psychic',
  129: 'PsychologicalModification',
  162: 'Psychology',
  157: 'QuantumFT',
  690: 'RHandWeaponType',
  94: 'RadiationAC',
  626: 'RadiationDamage',
  520: 'RandomNumberRoll',
  133: 'RangedEnergy',
  119: 'RangedInit',
  208: 'ReflectChemicalAC',
  217: 'ReflectColdAC',
  207: 'ReflectEnergyAC',
  219: 'ReflectFireAC',
  206: 'ReflectMeleeAC',
  205: 'ReflectProjectileAC',
  216: 'ReflectRadiationAC',
  525: 'RemainingHealth',
  526: 'RemainingNano',
  113: 'Rifle',
  143: 'Riposte',
  156: 'RunSpeed',
  467: 'SLZoneProtection',
  360: 'Scale',
  83: 'SecondaryItemInstance',
  273: 'SecondaryItemTemplate',
  82: 'SecondaryItemType',
  431: 'SelectedTarget',
  397: 'SelectedTargetType',
  20: 'Sense',
  122: 'SensoryImprovement',
  198: 'SessionTime',
  579: 'ShadowBreedTemplate',
  359: 'ShapeShift',
  108: 'SharpObjects',
  229: 'ShieldChemicalAC',
  231: 'ShieldColdAC',
  228: 'ShieldEnergyAC',
  233: 'ShieldFireAC',
  227: 'ShieldMeleeAC',
  234: 'ShieldPoisonAC',
  226: 'ShieldProjectileAC',
  230: 'ShieldRadiationAC',
  115: 'Shotgun',
  146: 'SneakAttack',
  521: 'SocialStatus',
  131: 'SpaceTime',
  182: 'Specialization',
  18: 'Stamina',
  16: 'Strength',
  527: 'TargetDistance',
  889: 'TargetDistanceChange',
  488: 'TargetFacing',
  204: 'Taunt',
  6: 'Team',
  213: 'TeamFaction',
  247: 'TemporarySkillReduction',
  37: 'TitleLevel',
  124: 'Treatment',
  141: 'Tutoring',
  139: 'VehicleAir',
  166: 'VehicleGround',
  117: 'VehicleWater',
  669: 'VictoryPoints',
  368: 'VisualProfession',
  430: 'WaitState',
  158: 'WeaponSmithing',
  355: 'WornItem',
  52: 'XP',
  319: 'XPModifier'
} as const;

/**
 * Spell modified stats - stats that can be modified by spells/nanos
 */
export const SPELL_MODIFIED_STATS = {
  '-1': 'Any',
  102: '1hBlunt',
  103: '1hEdged',
  107: '2hBlunt',
  105: '2hEdged',
  22: 'AMS',
  241: 'AbsorbChemicalAC',
  243: 'AbsorbColdAC',
  240: 'AbsorbEnergyAC',
  244: 'AbsorbFireAC',
  239: 'AbsorbMeleeAC',
  245: 'AbsorbPoisonAC',
  238: 'AbsorbProjectileAC',
  242: 'AbsorbRadiationAC',
  35: 'AccessCount',
  277: 'AddAllDefense',
  276: 'AddAllOffense',
  137: 'Adventuring',
  51: 'AggDef',
  201: 'Aggressiveness',
  17: 'Agility',
  151: 'AimedShot',
  169: 'AlienLevel',
  40: 'AlienXP',
  62: 'Alignment',
  583: 'ApartmentsOwned',
  116: 'AssaultRifle',
  516: 'AttackShield',
  45: 'BeltSlots',
  128: 'BiologicalMetamorphose',
  152: 'BodyDevelopment',
  111: 'Bow',
  121: 'BowSpecialAttack',
  142: 'Brawl',
  165: 'BreakingEntry',
  148: 'Burst',
  251: 'CheckPetType',
  93: 'ChemicalAC',
  281: 'ChemicalDamageModifier',
  163: 'Chemistry',
  571: 'ClanConserver',
  570: 'ClanDevoted',
  302: 'ClanPrice',
  572: 'ClanRedeemed',
  95: 'ColdAC',
  311: 'ColdDamageModifier',
  161: 'ComputerLiteracy',
  164: 'Concealment',
  61: 'Credits',
  379: 'CriticalIncrease',
  391: 'CriticalResistance',
  180: 'CurrentNCU',
  214: 'CurrentNano',
  659: 'DamageToNano',
  661: 'DamageToNano2',
  339: 'DamageType',
  144: 'Dimach',
  154: 'DodgeRanged',
  153: 'DuckExplosions',
  126: 'ElectricalEngineering',
  26: 'Energy',
  92: 'EnergyAC',
  280: 'EnergyDamageModifier',
  155: 'EvadeClose',
  147: 'FastAttack',
  224: 'Features',
  97: 'FireAC',
  316: 'FireDamageModifier',
  123: 'FirstAid',
  545: 'Flag265',
  618: 'Flag323',
  150: 'FlingShot',
  696: 'FreelancersIncTokens',
  167: 'FullAuto',
  691: 'FullIPR',
  566: 'GaurdianOfShadows',
  47: 'Girth',
  215: 'GmLevel',
  109: 'Grenade',
  65: 'HairTexture',
  343: 'HealDelta',
  342: 'HealInterval',
  535: 'HealModifier',
  689: 'HealReactivityMultiplier',
  27: 'Health',
  110: 'HeavyWeapons',
  53: 'IP',
  695: 'IccCommendations',
  410: 'InFight',
  236: 'InsurancePercentage',
  19: 'Intelligence',
  54: 'Level',
  114: 'MG_SMG',
  471: 'MapFlags1',
  472: 'MapFlags2',
  585: 'MapFlags3',
  586: 'MapFlags4',
  140: 'MapNavigation',
  470: 'MapUpgrades',
  100: 'MartialArts',
  130: 'MaterialCreation',
  127: 'MaterialMetamorphose',
  1: 'MaxHealth',
  181: 'MaxNCU',
  221: 'MaxNanoEnergy',
  478: 'MaxReflectedChemicalAC',
  480: 'MaxReflectedColdAC',
  477: 'MaxReflectedEnergyAC',
  482: 'MaxReflectedFireAC',
  476: 'MaxReflectedMeleeAC',
  481: 'MaxReflectedNanoAC',
  483: 'MaxReflectedPoisonAC',
  475: 'MaxReflectedProjectileAC',
  479: 'MaxReflectedRadiationAC',
  125: 'MechanicalEngineering',
  91: 'MeleeAC',
  279: 'MeleeDamageModifier',
  104: 'MeleeEnergy',
  118: 'MeleeInit',
  301: 'MinMembers',
  256: 'MissionBits1',
  686: 'MissionBits15',
  257: 'MissionBits2',
  101: 'MultiMelee',
  134: 'MultiRanged',
  465: 'NPCCryForHelpRange',
  179: 'NPCFlags',
  318: 'NanoCost',
  536: 'NanoDamage',
  315: 'NanoDamageModifier',
  364: 'NanoDelta',
  149: 'NanoInit',
  383: 'NanoInterruptModifier',
  363: 'NanoInterval',
  407: 'NanoPoints',
  132: 'NanoPool',
  160: 'NanoProgramming',
  381: 'NanoRange',
  168: 'NanoResist',
  75: 'NanoStrain',
  537: 'NanoVulnerability',
  0: 'None',
  567: 'OTFollowers',
  568: 'OTOperator',
  569: 'OTUnredeemed',
  145: 'Parry',
  136: 'Perception',
  468: 'PetReq2',
  469: 'PetReq3',
  485: 'PetReqVal1',
  486: 'PetReqVal2',
  487: 'PetReqVal3',
  512: 'PetType',
  159: 'Pharmaceuticals',
  120: 'PhysicalInit',
  106: 'Piercing',
  112: 'Pistol',
  96: 'PoisonAC',
  317: 'PoisonDamageModifier',
  556: 'ProcChance1',
  557: 'ProcChance2',
  539: 'ProcInitiative1',
  540: 'ProcInitiative2',
  552: 'ProcNano1',
  553: 'ProcNano2',
  90: 'ProjectileAC',
  278: 'ProjectileDamageModifier',
  454: 'ProximityRangeOutdoors',
  21: 'Psychic',
  129: 'PsychologicalModification',
  162: 'Psychology',
  682: 'PvpSoloScore',
  683: 'PvpTeamScore',
  157: 'QuantumFT',
  94: 'RadiationAC',
  282: 'RadiationDamageModifier',
  133: 'RangedEnergy',
  119: 'RangedInit',
  208: 'ReflectChemicalAC',
  217: 'ReflectColdAC',
  207: 'ReflectEnergyAC',
  219: 'ReflectFireAC',
  206: 'ReflectMeleeAC',
  218: 'ReflectNanoAC',
  225: 'ReflectPoisonAC',
  205: 'ReflectProjectileAC',
  216: 'ReflectRadiationAC',
  593: 'RegainXP',
  199: 'ResetPoints',
  113: 'Rifle',
  143: 'Riposte',
  156: 'RunSpeed',
  467: 'SLZoneProtection',
  360: 'Scale',
  20: 'Sense',
  122: 'SensoryImprovement',
  198: 'SessionTime',
  532: 'ShadowBreed',
  359: 'ShapeShift',
  108: 'SharpObjects',
  229: 'ShieldChemicalAC',
  231: 'ShieldColdAC',
  228: 'ShieldEnergyAC',
  233: 'ShieldFireAC',
  227: 'ShieldMeleeAC',
  232: 'ShieldNanoAC',
  234: 'ShieldPoisonAC',
  226: 'ShieldProjectileAC',
  230: 'ShieldRadiationAC',
  115: 'Shotgun',
  39: 'ShoulderMesh',
  382: 'SkillLockModifier',
  146: 'SneakAttack',
  131: 'SpaceTime',
  517: 'SpecialAttackShield',
  18: 'Stamina',
  16: 'Strength',
  138: 'Swimming',
  135: 'TrapDisarm',
  124: 'Treatment',
  141: 'Tutoring',
  139: 'VehicleAir',
  166: 'VehicleGround',
  117: 'VehicleWater',
  669: 'VictoryPoints',
  368: 'VisualProfession',
  380: 'WeaponRange',
  158: 'WeaponSmithing',
  355: 'WornItem',
  52: 'XP',
  319: 'XPModifier'
} as const;

/**
 * Profession IDs and names
 */
export const PROFESSION = {
  0: 'Unknown',
  1: 'Soldier',
  2: 'MartialArtist',
  3: 'Engineer',
  4: 'Fixer',
  5: 'Agent',
  6: 'Adventurer',
  7: 'Trader',
  8: 'Bureaucrat',
  9: 'Enforcer',
  10: 'Doctor',
  11: 'NanoTechnician',
  12: 'MetaPhysicist',
  13: 'Monster',
  14: 'Keeper',
  15: 'Shade'
} as const;

/**
 * Ammo types
 */
export const AMMOTYPE = {
  0: 'None',
  1: 'Energy',
  2: 'Bullets',
  3: 'FlameThrower',
  4: 'ShotgunShells',
  5: 'Arrows',
  6: 'LauncherGrenades',
  7: 'Rockets',
  8: 'Missiles',
  10: 'Infinite'
} as const;

/**
 * Texture location mapping
 */
export const TEXTURELOCATION = {
  0: 'Hands',
  1: 'Body',
  2: 'Feet',
  3: 'Arms',
  4: 'Legs'
} as const;

/**
 * Nano school classifications
 */
export const NANOSCHOOL = {
  1: 'Combat',
  2: 'Medical',
  3: 'Protection',
  4: 'Psi',
  5: 'Space'
} as const;

/**
 * NPC family classifications
 */
export const NPCFAMILY = {
  0: 'Human',
  95: 'RoboticPet',
  96: 'HealingConstruct',
  97: 'AttackConstruct',
  98: 'MesmerizingConstruct',
  157: 'ControlTower'
} as const;

/**
 * Faction types
 */
export const FACTION = {
  0: 'Neutral',
  1: 'Clan',
  2: 'Omni'
} as const;

/**
 * Gender types
 */
export const GENDER = {
  0: 'Unknown',
  1: 'Uni',
  2: 'Male',
  3: 'Female'
} as const;

/**
 * Breed types
 */
export const BREED = {
  0: 'Unknown',
  1: 'Solitus',
  2: 'Opifex',
  3: 'Nanomage',
  4: 'Atrox',
  7: 'HumanMonster'
} as const;

// Arrays for backwards compatibility with ip-calculator
export const PROFESSION_NAMES = Object.values(PROFESSION);
export const BREED_NAMES = Object.values(BREED);

/**
 * Expansion playfield types
 */
export const EXPANSION_PLAYFIELD = {
  0: 'Rubika',
  1: 'Shadowlands'
} as const;

/**
 * Target types for spells and effects
 */
export const TARGET = {
  1: 'Self',
  2: 'User',
  3: 'Target',
  4: 'Item',
  5: 'Transfer',
  6: 'Ground',
  7: 'PersonSpotted',
  8: 'Attacker',
  9: 'Victim',
  10: 'Master',
  11: 'EnemyHealer',
  12: 'FriendAttacker',
  13: 'CommandTarget',
  14: 'FightTarget',
  15: 'ScaryEnemy',
  16: 'FollowTarget',
  17: 'LastOpponent',
  18: 'PersonLeaving',
  19: 'PersonLost',
  20: 'Pet',
  21: 'Area',
  22: 'Commander',
  23: 'SelectedTarget',
  24: 'LastFollowTarget'
} as const;

/**
 * Weapon slot positions
 */
export const WEAPON_SLOT_POSITIONS = {
  0: 'None',
  1: 'Hud1',
  2: 'Hud3',
  3: 'Utils1',
  4: 'Utils2',
  5: 'Utils3',
  6: 'RightHand',
  7: 'Deck',
  8: 'LeftHand',
  9: 'Deck1',
  10: 'Deck2',
  11: 'Deck3',
  12: 'Deck4',
  13: 'Deck5',
  14: 'Deck6',
  15: 'Hud2'
} as const;

/**
 * Armor slot positions
 */
export const ARMOR_SLOT_POSITION = {
  0: 'None',
  1: 'Neck',
  2: 'Head',
  3: 'Back',
  4: 'RightShoulder',
  5: 'Chest',
  6: 'LeftShoulder',
  7: 'RightArm',
  8: 'Hands',
  9: 'LeftArm',
  10: 'RightWrist',
  11: 'Legs',
  12: 'LeftWrist',
  13: 'RightFinger',
  14: 'Feet',
  15: 'LeftFinger'
} as const;

/**
 * Implant slot positions
 */
export const IMPLANT_SLOT_POSITION = {
  0: 'None',
  1: 'Eyes',
  2: 'Head',
  3: 'Ears',
  4: 'RightArm',
  5: 'Chest',
  6: 'LeftArm',
  7: 'RightWrist',
  8: 'Waist',
  9: 'LeftWrist',
  10: 'RightHand',
  11: 'Legs',
  12: 'LeftHand',
  13: 'Feet'
} as const;

/**
 * Tower types
 */
export const TOWER_TYPE = {
  0: 'None',
  1: 'Control',
  2: 'Offensive',
  3: 'Stun',
  4: 'Support',
  5: 'AntiAir',
  6: 'Pulse'
} as const;

/**
 * Item classes
 */
export const ITEM_CLASS = {
  0: 'None',
  1: 'Weapon',
  2: 'Armor',
  3: 'Implant',
  4: 'Monster',
  5: 'Spirit'
} as const;

/**
 * Grouping operators for requirements
 */
export const GROUPING_OPERATOR = {
  3: 'Or',
  4: 'And',
  42: 'Not'
} as const;

/**
 * Function operators for requirements
 */
export const FUNCTION_OPERATOR = {
  15: 'Unknown15',
  31: 'ItemWorn',
  32: 'ItemNotWorn',
  33: 'ItemWielded',
  34: 'ItemNotWielded',
  35: 'OwnsNano',
  36: 'NotOwnsNano',
  50: 'IsSameAs',
  88: 'UseLocation',
  91: 'RunningNano',
  92: 'RunningNanoLine',
  93: 'PerkTrained',
  94: 'PerkLocked',
  97: 'PerkNotLocked',
  98: 'True',
  99: 'False',
  101: 'NotRunningNano',
  102: 'NotRunningNanoLine',
  103: 'PerkNotTrained',
  104: 'SpawnedFromHash',
  106: 'NeedFreeInventorySlots',
  108: 'OwnsItem',
  109: 'NotOwnsItem',
  117: 'HasQuestHash',
  127: 'CheckNcu',
  85: 'StatSameAsSelectedTarget',
  130: 'StatEqualStat',
  131: 'StatLessThanStat',
  132: 'StatGreaterThanStat',
  133: 'StatNotEqualStat'
} as const;

/**
 * Use on operators
 */
export const USE_ON_OPERATOR = {
  18: 'Target',
  19: 'Self',
  21: 'SecondaryItem',
  26: 'User',
  100: 'Caster',
  110: 'FightingTarget'
} as const;

/**
 * State operators
 */
export const STATE_OPERATOR = {
  44: 'IsNpc',
  45: 'IsFighting',
  134: 'IsNotFighting',
  66: 'HaveNoRegularPets',
  70: 'IsFlying',
  80: 'IsTowerCreateAllowed',
  83: 'CanDisableDefenseShield',
  86: 'IsPlayerOrPlayerControlledPet',
  89: 'IsFalling',
  111: 'NotInVehicle',
  112: 'FlyingAllowed',
  114: 'IsLandmineArmed',
  115: 'CanPlaceLandmine',
  116: 'IsInOrganization',
  118: 'IsOwnPet',
  119: 'InGracePeriod',
  120: 'InLcaLevelRange',
  121: 'IsInRaid',
  122: 'IsBossNpc',
  123: 'IsInDuel',
  124: 'CanTeleport',
  125: 'HasNotAnythingWorn',
  129: 'UnknownOperator129',
  135: 'AlliesInCombat',
  136: 'AlliesNotInCombat',
  138: 'InTeamWith'
} as const;

/**
 * Stat operators for comparisons
 */
export const STAT_OPERATOR = {
  0: 'Equal',
  1: 'LessThan',
  2: 'GreaterThan',
  22: 'BitSet',
  24: 'NotEqual',
  107: 'BitNotSet'
} as const;

/**
 * Combined operator mapping
 */
export const OPERATOR = {
  0: 'StatEqual',
  1: 'StatLessThan',
  2: 'StatGreaterThan',
  22: 'StatBitSet',
  24: 'StatNotEqual',
  107: 'StatBitNotSet',
  3: 'Or',
  4: 'And',
  42: 'Not',
  44: 'StateIsNpc',
  45: 'StateIsFighting',
  134: 'StateIsNotFighting',
  66: 'StateHaveNoRegularPets',
  70: 'StateIsFlying',
  80: 'StateIsTowerCreateAllowed',
  83: 'StateCanDisableDefenseShield',
  86: 'StateIsPlayerOrPlayerControlledPet',
  89: 'StateIsFalling',
  111: 'StateNotInVehicle',
  112: 'StateFlyingAllowed',
  114: 'StateIsLandmineArmed',
  115: 'StateCanPlaceLandmine',
  116: 'StateIsInOrganization',
  118: 'StateIsOwnPet',
  119: 'StateInGracePeriod',
  120: 'StateInLcaLevelRange',
  121: 'StateIsInRaid',
  122: 'StateIsBossNpc',
  123: 'StateIsInDuel',
  124: 'StateCanTeleport',
  125: 'StateHasNotAnythingWorn',
  135: 'Unknown135',
  136: 'StateAlliesNotInCombat',
  138: 'StateInTeamWith',
  15: 'Unknown15',
  31: 'ItemWorn',
  32: 'ItemNotWorn',
  33: 'ItemWielded',
  34: 'ItemNotWielded',
  35: 'OwnsNano',
  36: 'NotOwnsNano',
  50: 'IsSameAs',
  88: 'UseLocation',
  91: 'RunningNano',
  92: 'RunningNanoLine',
  93: 'PerkTrained',
  94: 'PerkLocked',
  97: 'PerkNotLocked',
  98: 'True',
  99: 'False',
  101: 'NotRunningNano',
  102: 'NotRunningNanoLine',
  103: 'PerkNotTrained',
  104: 'SpawnedFromHash',
  106: 'NeedFreeInventorySlots',
  108: 'OwnsItem',
  109: 'NotOwnsItem',
  117: 'HasQuestHash',
  127: 'CheckNcu',
  128: 'Unknown128',
  85: 'StatSameAsSelectedTarget',
  130: 'StatEqualStat',
  131: 'StatLessThanStat',
  132: 'StatGreaterThanStat',
  133: 'StatNotEqualStat',
  18: 'OnTarget',
  19: 'OnSelf',
  21: 'OnSecondaryItem',
  26: 'OnUser',
  100: 'OnCaster',
  110: 'OnFightingTarget',
  129: 'UnknownOperator129'
} as const;

/**
 * Item class mapping
 */
export const ITEMCLASS = {
  0: 'None',
  1: 'Weapon',
  2: 'Armor',
  3: 'Implant'
} as const;

/**
 * Template events
 */
export const TEMPLATE_EVENT = {
  0: 'Use',
  1: 'Repair',
  2: 'Wield',
  3: 'TargetInVicinity',
  4: 'UseItemOnTarget',
  5: 'Hit',
  6: 'NPCWear',
  7: 'Create',
  8: 'Effects',
  9: 'Run',
  10: 'Activate',
  12: 'StartEffect',
  13: 'EndEffect',
  14: 'Wear',
  15: 'UseFailed',
  16: 'Enter',
  18: 'Open',
  19: 'Close',
  20: 'Terminate',
  21: 'Unknown',
  23: 'EndCollide',
  24: 'FriendlyInVicinity',
  25: 'EnemyInVicinity',
  26: 'PersonalModifier',
  27: 'Failure',
  28: 'Cancellation',
  37: 'Trade'
} as const;

/**
 * Template actions
 */
export const TEMPLATE_ACTION = {
  0: 'Any',
  1: 'Get',
  3: 'Use',
  5: 'UseItemOnItem',
  6: 'Wear',
  7: 'Remove',
  8: 'Wield',
  15: 'Idle',
  32: 'UseItemOnItem2',
  111: 'TriggerTargetInVicinity',
  136: 'PlayshiftRequirements'
} as const;

/**
 * Nano strain mappings - complete set of 1089 entries from 0 to 99999
 * This maps nano strain IDs to human-readable descriptions
 */
export const NANO_STRAIN = {
  0: "Perk Effect",
  1: "Damage Shields",
  2: "Reflect Shield",
  3: "Armor Buff",
  4: "Damage Buffs - Line A",
  5: "Challenger",
  6: "DOT - Line A",
  7: "DOT - Line B",
  8: "DOT Nanotechnician Strain A",
  9: "DOT Agent Strain A",
  10: "DOT Nanotechnician Strain B",
  11: "Halo Nano Debuff",
  12: "Heal Over Time",
  13: "AAO Debuffs",
  14: "Nano Over Time - Line A",
  15: "XP Bonus",
  16: "General 1Hand Blunt Buff",
  17: "General 1Hand Blunt Debuff",
  18: "General Aimed Shot Buff",
  19: "General Aimed Shot Debuff",
  20: "General Air Transport Buff",
  21: "General 1H Edged Buff",
  22: "General 1H Edged Debuff",
  23: "General 2H Blunt Buff",
  24: "General 2H Blunt Debuff",
  25: "General 2H Edged Buff",
  26: "General 2H Edged Debuff",
  27: "General Assault Rifle Buff",
  28: "General Assault Rifle Debuff",
  29: "General Agility Buff",
  30: "General Intelligence Buff",
  31: "General Psychic Buff",
  32: "General Sense Buff",
  33: "General Stamina Buff",
  34: "General Strength Buff",
  35: "General BioMet Buff",
  36: "General BioMet Debuff",
  37: "General Bow Buff",
  38: "General Bow Debuff",
  39: "General Bow Special Buff",
  40: "General Bow Special Debuff",
  41: "General Brawl Buff",
  42: "General Brawl Debuff",
  43: "General Break Entry Buff",
  44: "General Burst Buff",
  45: "General Burst Debuff",
  46: "General Chemical AC Buff",
  47: "General Chemistry Buff",
  48: "General Climb Buff",
  49: "General Cold AC Buff",
  50: "General Computer Literacy Buff",
  51: "General Concealment Buff",
  52: "General Dimach Debuff",
  53: "General Agility Debuff",
  54: "General Intelligence Debuff",
  55: "General Psychic Debuff",
  56: "General Sense Debuff",
  57: "General Stamina Debuff",
  58: "General Strength Debuff",
  59: "General Disarm Traps Buff",
  60: "General Electrical Engineering Buff",
  61: "General Energy Melee Buff",
  62: "General Energy Melee Debuff",
  63: "General Energy AC Buff",
  64: "General LR Energy Weapon Buff",
  65: "General LR Energy Weapon Debuff",
  66: "General Fast Attack Buff",
  67: "General Fast Attack Debuff",
  68: "General Field Quantum Physics Buff",
  69: "General Fire AC Buff",
  70: "General First Aid Buff",
  71: "General Fling Shot Buff",
  72: "General Fling Shot Debuff",
  73: "General Full Auto Buff",
  74: "General Full Auto Debuff",
  75: "General Thrown Grappling Buff",
  76: "General Thrown Grappling Debuff",
  77: "General Grenade Buff",
  78: "General Grenade Debuff",
  79: "General Ground Transport Buff",
  80: "General Max Health Buff",
  81: "General Knife Buff",
  82: "General Knife Debuff",
  83: "General SMG Buff",
  84: "General SMG Debuff",
  85: "General Martial Arts Buff",
  86: "General Martial Arts Debuff",
  87: "General MatCrea Buff",
  88: "General MatCrea Debuff",
  89: "General MatLoc Buff",
  90: "General MatLoc Debuff",
  91: "General MatMet Buff",
  92: "General MatMet Debuff",
  93: "General Mechanical Engineering Buff",
  94: "General Melee AC Buff",
  95: "General Nano Programming Buff",
  96: "General Nano AC Buff",
  97: "General NP Regeneration",
  98: "General Deflect Buff",
  99: "General Deflect Debuff",
  100: "General Pharmaceutical Buff",
  101: "General Piercing Buff",
  102: "General Piercing Debuff",
  103: "General Pistol Buff",
  104: "General Pisto Debuff",
  105: "General Poison AC Buff",
  106: "General Projectile AC Buff",
  107: "General Psychology Buff",
  108: "General PsyMod Buff",
  109: "General PsyMod Debuff",
  110: "General Radiation AC Buff",
  111: "General HP Regeneration",
  112: "General Rifle Buff",
  113: "General Rifle Debuff",
  114: "General Riposte Buff",
  115: "General Riposte Debuff",
  116: "General SenseImp Buff",
  117: "General SenseImp Debuff",
  118: "General Shotgun Buff",
  119: "General Shotgun Debuff",
  120: "General Sneak Attack Buff",
  121: "General Sneak Attack Debuff",
  122: "General Nano AC Debuff",
  123: "General Poison AC Debuff",
  124: "General Swim Buff",
  125: "General Treatment Buff",
  126: "General Tutoring Buff",
  127: "General Chemical AC Debuff",
  128: "General Cold AC Debuff",
  129: "General Energy AC Debuff",
  130: "General Fire AC Debuff",
  131: "General Melee AC Debuff",
  132: "Inefficient Initiative Debuff",
  133: "Wasteful Initiative Debuff",
  134: "General Weapon Smithing Buff",
  135: "Trader Skill Transfer Target Debuff (Deprive)",
  136: "Trader Skill Transfer Target Debuff (Ransack)",
  137: "Trader Skill Transfer Caster Buff (Deprive)",
  138: "Trader Skill Transfer Caster Buff (Ransack)",
  139: "Trader AC Transfer Target Debuff (Siphon)",
  140: "Trader AC Transfer Target Debuff (Draw)",
  141: "Trader AC Transfer Caster Buff (Siphon)",
  142: "Trader AC Transfer Caster Buff (Draw)",
  143: "Trader AC Transfer Target Buff (Redeem)",
  144: "Major Evasion Buffs",
  145: "Snare",
  146: "Root",
  147: "Mezz",
  148: "NP Cost Buff",
  149: "General Runspeed Buffs",
  150: "Runspeed Buffs",
  151: "HP Buff",
  152: "Initiative Buffs",
  153: "2HEdged Buff",
  154: "Brawl Buff",
  155: "RiposteBuff",
  156: "Strength Buff",
  157: "MatMet Buff",
  158: "MatMet Debuff",
  159: "MatCrea Buff",
  160: "MatCrea Debuff",
  161: "MatLoc Buff",
  162: "MatLoc Debuff",
  163: "BioMet Buff",
  164: "BioMet Debuff",
  165: "SenseImp Buff",
  166: "SenseImp Debuff",
  167: "PsyMod Buff",
  168: "PsyMod Debuff",
  169: "Psychic Debuff",
  170: "IntelligenceDebuff",
  171: "Break & Entry Buffs",
  172: "Electrical Engineering Buff",
  173: "Field Quantum Physics Buff",
  174: "Mechanical Engineering Buff",
  175: "Pharmaceuticals Buff",
  176: "Weapon Smithing Buff",
  177: "Computer Literacy Buff",
  178: "NP Buff",
  179: "1H Blunt Buff",
  180: "Melee Weapon Buff Line",
  181: "NF Range Buff",
  182: "Critical Increase Buff",
  183: "Interrupt Modifier",
  184: "Doctor HP Buffs",
  185: "Doctor Short HP Buffs",
  186: "Initiative Debuffs",
  187: "MetaPhysicist Damage Debuff",
  188: "Mongo Buff",
  189: "Rage",
  190: "First Aid And Treatment Buff",
  191: "Perception Buffs",
  192: "Sense Buff",
  193: "Concealment Buff",
  194: "Rifle Buffs",
  195: "Agility Buff",
  196: "Chemistry/Pharm Buff",
  197: "Evasion Debuffs",
  198: "Aimed Shot Buffs",
  199: "Pistol Buff",
  200: "Psychology Buff",
  201: "Nano Delta Buffs",
  202: "Charm Other",
  203: "Heal Delta Buff",
  204: "Nano Resistance Buffs",
  205: "Shield AC Clusters",
  206: "Breaking & Entry/Disarm Traps Buff",
  207: "Grenade Buffs",
  208: "Sneak Attack Buffs",
  209: "Martial Arts Buff",
  210: "Nano Programming Buff",
  211: "NP Cost Debuff",
  212: "Assault Rifle Buffs",
  213: "Ranged Energy Weapon Buffs",
  214: "Burst Buff",
  215: "Nano Drain - Line A",
  216: "MP Pet Damage Buffs",
  217: "MP Pet Initiative Buffs",
  218: "False Profession",
  219: "Absorb AC Buff",
  220: "Trader Team Skill Wrangler Buff",
  221: "Metaphysicist Mind Damage Nano Debuffs",
  222: "Controlled Destruction Buff",
  223: "Polymorph",
  224: "Fortify",
  225: "Pet Short Term Damage Buffs",
  226: "Elian Soul",
  227: "Engineer Auras",
  228: "Engineer Aura-Armour",
  229: "Engineer Aura-Damage Buff",
  230: "Engineer Aura-Damage Shield Buff",
  231: "Engineer Aura-Reflection Damage Buff",
  232: "Pet Taunt Buff",
  233: "Speech Line",
  234: "Motivational SpeechEffect",
  235: "Disarm Trap Buff",
  236: "Engineer Debuff Auras",
  237: "Motivational Speech Nano Resist Buff",
  238: "Demotivational Speeches",
  239: "Nano Shutdown Debuff",
  240: "Concentration Critical Line",
  241: "Sureshot Critical Line",
  242: "Executioner Buff",
  243: "Damage Shield Upgrades",
  244: "1HEdged Buff",
  245: "Multiwield Buff",
  246: "Controlled Rage Buff",
  247: "Kin of Tarasque",
  248: "Morph Heal",
  249: "Pack Hunter Base",
  250: "Pack Hunter Buff",
  251: "Adventurer Morph Buff",
  252: "Damage Buff - Line C",
  253: "Fixer Suppressor Buff",
  254: "Chest Buff Line",
  255: "Fixer Long HoT",
  256: "Fear",
  257: "Fixer NCU Buff",
  258: "Trader Team Heals 1",
  259: "Trader Team Heals 2",
  260: "Trader Team Heals 3",
  261: "Trader Team Heals 4",
  262: "Trader Team Heals 5",
  263: "Trader Team Heals 6",
  264: "Trader Team Heals 7",
  265: "Trader Team Heals 8",
  266: "Trader Team Heals 9",
  267: "Trader Team Heals 10",
  268: "Trader Team Heals 11",
  269: "Trader Team Heals 12",
  270: "Trader Team Heals 13",
  271: "Trader Team Heals 14",
  272: "Trader Team Heals 15",
  273: "Trader Team Heals 16",
  274: "Trader Team Heals 17",
  275: "UNUSED1",
  276: "TowerSmokeBuffEffects",
  277: "Drone Tower Buff",
  278: "Enforcer Piercing Buff",
  279: "Enforcer Melee Energy Buff",
  280: "Soldier Shotgun Buff",
  281: "Soldier Full Auto Buff",
  282: "Complete Healing Line",
  283: "Self Root/Snare Resist Buff",
  284: "Other Root/Snare Resist Buff",
  285: "Pet Snare/Root Resistance Buff",
  286: "Engineer Special Attack Absorber",
  287: "Ransack/Deprive Resist Buff",
  288: "Engineer Pet AOE Snare Buff",
  289: "TemporalChaliceVisualEffectBuff",
  290: "Teporary Root/Snare Resistance Buff",
  291: "Mongo HoT Component",
  292: "Unhallowed Force Line",
  293: "Beacon Warp",
  294: "BurntOutArmor Proc",
  295: "HellGun Dispel Proc",
  296: "Perk Limber",
  297: "Perk Dance O fFools",
  298: "Perk Chemical Blindness",
  299: "Perk Poison Sprinkle",
  300: "Perk Seal Wounds",
  301: "Perk Tranquilizer",
  302: "Perk Toxic Shock",
  303: "Perk Concussive Shot",
  304: "Perk Assasinate",
  305: "Perk BattlegroupHeal 1",
  306: "Perk BattlegroupHeal 2",
  307: "Perk Viral Combination",
  308: "Perk BattlegroupHeal 3",
  309: "Perk BattlegroupHeal 4",
  310: "Perk Bio Shield",
  311: "Perk Bio Cocoon",
  312: "Perk Bio Rejuvenation",
  313: "Perk Bio Regrowth",
  314: "Perk Chaotic Modulation",
  315: "Perk Soften Up",
  316: "Perk Pinpoint Strike",
  317: "Perk Death Strike",
  318: "Perk Lay On Hands",
  319: "Perk Devotional Armor",
  320: "Perk Curing Touch",
  321: "Perk Quick Bash",
  322: "Perk Crush Bone",
  323: "Perk Bring The Pain",
  324: "Perk Devastating Blow",
  325: "Perk Big Smash",
  326: "Perk Followup Smash",
  327: "Perk Blindside Blow",
  328: "Perk Bureaucratic Shuffle",
  329: "Perk Succumb",
  330: "Perk Confound With Rules",
  331: "Perk Evasive Stance",
  332: "Perk Elementary Teleportation 1",
  333: "Perk Elementary Teleportation 2",
  334: "Perk Elementary Teleportation 3",
  335: "Perk Elementary Teleportation 4",
  336: "Perk ICC Node Teleportation",
  337: "Perk Channel Rage",
  338: "Perk Blessing Of Life",
  339: "Perk Lifeblood",
  340: "Perk Draw Blood",
  341: "Perk Install Explosive Devices",
  342: "Perk Install Notum Depletion Device",
  343: "Perk Suppressive Primer",
  344: "Perk Thermal Primer",
  345: "Perk Leadership",
  346: "Perk Governance",
  347: "Perk The Director",
  348: "Perk Balance Of Yin and Yang",
  349: "Perk Reap Life",
  350: "Perk Bloodletting",
  351: "Perk Vital Shock",
  352: "Perk Quick Cut",
  353: "Perk Flay",
  354: "Perk Flurry of Cuts",
  355: "Perk Ribbon Flesh",
  356: "Perk Reconstruct DNA",
  357: "Perk Viral Wipe",
  358: "Perk Breach Defenses",
  359: "Perk Nano Heal",
  360: "Perk Exploration Teleportation 1",
  361: "Perk Exploration Teleportation 2",
  362: "Perk Devour",
  363: "Perk Bleeding Wounds",
  364: "Perk Gutting Blow",
  365: "Perk Heal",
  366: "Perk Invocation",
  367: "Perk Troll Form",
  368: "Perk Disable Natural Healing",
  369: "Perk Stonefist",
  370: "Perk Avalanche",
  371: "Perk Grasp",
  372: "Perk Bearhug",
  373: "Perk Grip of Colossus",
  374: "Perk Removal 1",
  375: "Perk Removal 2",
  376: "Perk Purge 1",
  377: "Perk Purge 2",
  378: "Perk Great Purge",
  379: "Perk Reconstruction",
  380: "Perk Taunt Box",
  381: "Perk Siphon Life",
  382: "Perk Chaotic Energy",
  383: "Perk Regain Nano",
  384: "Perk NCU Booster",
  385: "Perk Laser Paint Target",
  386: "Perk Weapon Bash",
  387: "Perk Triangulate Target",
  388: "Perk Napalm Spray",
  389: "Perk Mark of Vengeance",
  390: "Perk Mark of Sufferance",
  391: "Perk Mark of the Unclean",
  392: "Perk Mark of the Unhallowed",
  393: "Perk Armor Piercing Shot",
  394: "Perk Find the Flaw",
  395: "Perk Called Shot",
  396: "Perk Tremor Hand",
  397: "Perk Harmonize Body and Mind",
  398: "Perk Taunt",
  399: "Perk Charge",
  400: "Perk Headbutt",
  401: "Perk Hatred",
  402: "Perk Groin Kick",
  403: "Perk Deconstruction",
  404: "Perk Encase in Stone",
  405: "Perk Detonate StoneWorks",
  406: "Perk Shutdown Removal 1",
  407: "Perk Shutdown Removal 2",
  408: "Perk Enhanced Heal",
  409: "Perk Malicious Prohibition",
  410: "Perk Team Heal",
  411: "Perk Treatment Transfer",
  412: "Perk Zap Nano",
  413: "Perk Nano Shakes",
  414: "Perk Strip Nano",
  415: "Perk Annihilate Notum Molecules",
  416: "Perk Fade Anger",
  417: "Perk Tap Notum Source",
  418: "Perk Access Notum Source",
  419: "Perk Blast Nano",
  420: "Perk Stop Notum Flow",
  421: "Perk Notum Overflow",
  422: "Perk Stoneworks",
  423: "Perk Cripple Psyche",
  424: "Perk Shatter Psyche",
  425: "Perk Dominator",
  426: "Perk Stab",
  427: "Perk Double Stab",
  428: "Perk Perforate",
  429: "Perk Lacerate",
  430: "Perk Impale",
  431: "Perk Gore",
  432: "Perk Hecatomb",
  433: "Perk Quick Shot",
  434: "Perk Double Shot",
  435: "Perk Deadeye",
  436: "Perk Energize",
  437: "Perk Power Volley",
  438: "Perk Power Shock",
  439: "Perk Power Blast",
  440: "Perk Power Combo",
  441: "Perk Atrophy",
  442: "Perk Doom Touch",
  443: "Perk Spirit Dissolution",
  444: "Perk Fade Armor",
  445: "Perk Shadow Bullet",
  446: "Perk Night Killer",
  447: "Perk Shadow Stab",
  448: "Perk Blade of Night",
  449: "Perk Shadow Killer",
  450: "Perk Snipe Shot 1",
  451: "Perk Snipe Shot 2",
  452: "Perk Leg Shot",
  453: "Perk Easy Shot",
  454: "Perk Reinforce Slugs",
  455: "Perk Jarring Burst",
  456: "Perk Solid Slug",
  457: "Perk Neutronium Slug",
  458: "Perk Field Bandage",
  459: "Perk Tracer",
  460: "Perk Contained Burst",
  461: "Perk Violence",
  462: "Perk Guardian",
  463: "Perk Cure",
  464: "Perk Vaccinate",
  465: "Perk Cure 2",
  466: "Perk Vaccinate 2",
  467: "Perk Hale and Hearty",
  468: "Perk Team Hale and Hearty",
  469: "Perk Capture Vigor",
  470: "Perk Unhealed Blight",
  471: "Perk Capture Essence",
  472: "Perk Unsealed Pestilence",
  473: "Perk Capture Spirit",
  474: "Perk Unsealed Contagation",
  475: "Perk Capture Vitality",
  476: "Perk Bane",
  477: "Perk Dragonfire",
  478: "Perk Chi Conductor",
  479: "Perk Incapacitate",
  480: "Perk Flesh Quiver",
  481: "Perk Oboliterate",
  482: "Perk Dazzle with Lights",
  483: "Perk Combust",
  484: "Perk Thermal Detonation",
  485: "Perk Supernova",
  486: "Perk Deep Cuts",
  487: "Perk Blade Whirlwind",
  488: "Perk Honoring The Ancients",
  489: "Perk Seppuku Slash",
  490: "Perk Exultation",
  491: "Perk Etheral Touch",
  492: "Perk Dimensional Fist",
  493: "Perk Disorient",
  494: "Perk Convulsive Tremor",
  495: "Perk Symbiosis",
  496: "Perk Malicious Symbiosis",
  497: "Perk Malevolent Symbiosis",
  498: "Perk Chtonian Symbiosis",
  499: "Perk Quark Containment Field",
  500: "Perk Accelerate Decaying Quarks",
  501: "Perk Knowledge Enhancer",
  502: "Perk Escape",
  503: "Perk Sabotage Quark Field",
  504: "Perk Ignition Flare",
  505: "Perk Ritual of Devotion",
  506: "Perk Devour Vigor",
  507: "Perk Ritual of Zeal",
  508: "Perk Devour Essence",
  509: "Perk Ritual of Spirit",
  510: "Perk Devour Vitality",
  511: "Perk Ritual of Blood",
  512: "Perk ECM 1",
  513: "Perk ECM 2",
  514: "Perk SPECIAL Acrobat",
  515: "Perk SPECIAL bureaucratic shuffle",
  516: "Perk SPECIAL persuader",
  517: "Perk SPECIAL alchemist",
  518: "Keeper Deflect/Riposte Buff",
  519: "Fast Attack Buffs",
  520: "Shade Damage Proc-Damage Inflict Segment",
  521: "Shade Proc Buff",
  522: "Shade HP/NP DoT Proc-Damage Inflict Segment",
  523: "Shade Init Debuff Proc",
  524: "Keeper Sanctifier Proc-Damage Inflict Segment",
  525: "Keeper Reaper Proc-Damage Inflict Segment",
  526: "Keeper Proc Buff",
  527: "Keeper Aura-HP and NP Heal",
  528: "Keeper Aura-Absorb/Reflect/AMS Buff",
  529: "Keeper Aura-Damage/Snare Reduction Buff",
  530: "Keeper Heal Aura-Team",
  531: "Keeper NP Heal Aura-Team",
  532: "Keeper Absorb Aura-Team",
  533: "Keeper AMS/DMS Aura-Team",
  534: "Keeper Reflect Aura-Team",
  535: "Keeper Damage Aura-Team",
  536: "Keeper Snare Reduction Aura-Team",
  537: "Perk SPECIAL Assasin",
  538: "Add All Def. Perk Buff",
  539: "Keeper Str/Stam/Agi Buff",
  540: "Perk SPECIAL Tinkerer",
  541: "Perk Special Thief",
  542: "Perk SPECIAL Starfall",
  543: "Perk Special Shadowsneak",
  544: "Perk Special Kungfu Master",
  545: "Keeper Evade/Dodge/Duck Buff",
  546: "Shade Piercing Buff",
  547: "Dimach Buff",
  548: "Perk Aura Of Revival-Heal Stopper",
  549: "Perk Commanding Presence",
  550: "Perk Directorship Buff",
  551: "Perk Channeling Of Notum-Heal Stopper",
  552: "Perk Theoretical Research",
  553: "Perk Street Samurai",
  554: "Perk Special Forces",
  555: "Perk SMG Mastery",
  556: "Perk Nano Surgeon",
  557: "Perk Heavy Ranged",
  558: "Perk Grid NCU",
  559: "Perk Enhanced Nano Damage",
  560: "GM Nano buff",
  561: "Perk Nano Surgeon",
  562: "UNUSED 2",
  563: "General Dimach Buff",
  564: "General Melee Multiple Buff",
  565: "MonsterWaveSpawn1",
  566: "MonsterWaveSpawn2",
  567: "MonsterWaveSpawn3",
  568: "MonsterWaveSpawn4",
  569: "MonsterWaveSpawn5",
  570: "MonsterWaveSpawn6",
  571: "MonsterWaveSpawn7",
  572: "MonsterWaveSpawn8",
  573: "MonsterWaveSpawn9",
  574: "MonsterWaveSpawn10",
  575: "Battlegroup Heal",
  576: "Psy/Int Buff",
  577: "Bio Shielding",
  578: "Bio Cocoon",
  579: "Bio Rejuvenation",
  580: "Bio Regrowth",
  581: "General Ranged Multiple Buff",
  582: "DOT Strain C",
  583: "Devotional Armor",
  584: "Scale Repair",
  585: "Slobber Wounds",
  586: "Lick Wounds NA",
  587: "SL Nanopoint Drain",
  588: "Nano Point Heals",
  589: "Blessing of Life",
  590: "Lifeblood",
  591: "Draw Blood",
  592: "Heavy Weapons Buffs",
  593: "Ethereal Touch",
  594: "Convulsive Tremor",
  595: "Nano Recharge",
  596: "Health Recharge",
  597: "Damage Change Buffs",
  598: "Bonfire Recharger",
  599: "Ritual of Devotion",
  600: "Ritual of Zeal",
  601: "Ritual of Spirit",
  602: "Ritual of Blood",
  603: "MonsterEffect1",
  604: "MonsterEffect2",
  605: "MonsterEffect3",
  606: "MonsterEffect4",
  607: "MonsterEffect5",
  608: "MonsterEffect6",
  609: "MonsterEffect7",
  610: "MonsterEffect8",
  611: "Short Term XP Gain",
  612: "Double Stab Bleeding Wounds",
  613: "Lacerate Bleeding Wounds",
  614: "Gore Bleeding Wounds",
  615: "Hecatomb Bleeding Wounds",
  616: "MonsterEffect_Breakable",
  617: "MonsterEffect_DuringFight",
  618: "Perk Cleave",
  619: "Perk Transfix",
  620: "Perk Pain Lance",
  621: "Perk Slice And Dice",
  622: "Perk Pulverize",
  623: "Perk Hammer And Anvil",
  624: "Perk Overwhelming Might",
  625: "Perk Seismic Smash",
  626: "Pain Lance DoT",
  627: "Enforcer Taunt Procs",
  628: "Enforcer Taunt Procs Fearbringer",
  629: "Enforcer Taunt Procs Irebringer",
  630: "Enforcer Taunt Procs Wrathbringer",
  631: "Enforcer Taunt Procs Hatebringer",
  632: "Enforcer Taunt Procs Ragebringer",
  633: "Enforcer Taunt Procs Dreadbringer",
  634: "Accelerate Decaying Quarks Debuff",
  635: "Agent Damage Proc-DamageInflictSegment",
  636: "Agent Proc Buff",
  637: "MonsterEffect_MainLoop",
  638: "Atrophy",
  639: "Deep Cuts",
  640: "Trader Debuff AC Nanos",
  641: "Leg Shot",
  642: "Crush Bone",
  643: "Nano Resistance Debuff (Line A)",
  644: "Debuff NanoAC Heavy",
  645: "Called Shot Bleeding Wounds",
  646: "Energize",
  647: "Mark of Vengeance",
  648: "Mark of Sufferance",
  649: "Mark of the Unclean",
  650: "Mark of the Unhallowed",
  651: "Toxic Shock",
  652: "Toxic Shock Proc Effect",
  653: "Dodge the Blame",
  654: "Confound with Rules",
  655: "Succumb",
  656: "Troll Form",
  657: "Disable Natural Healing",
  658: "MP Damage Debuff Line A",
  659: "MP Damage Debuff Line B",
  660: "Nano Shakes",
  661: "Tap Notum Source",
  662: "Blast Nano",
  663: "Stop Notum Flow",
  664: "Notum Overflow",
  665: "Blade of Night",
  666: "Violence",
  667: "Violence Controller",
  668: "Guardian",
  669: "Total Mirror Shield",
  670: "Dazzle with Lights",
  671: "Knowledge Enhancer",
  672: "Bleeding Wounds",
  673: "Fixer Dodge Buff Line",
  674: "Hammer and Anvil",
  675: "Zap Nano",
  676: "Channel Rage",
  677: "Chaotic Modulation",
  678: "Freak Strength Stun",
  679: "Freak Strength Self Stun",
  680: "Agent Escape Nanos",
  681: "Reconstruction",
  682: "Taunt Box",
  683: "Siphon Box",
  684: "Gadgeteer Pet Procs",
  685: "Groin Kick",
  686: "Reconstruction",
  687: "Taunt Box",
  688: "Siphon Box",
  689: "Deconstruction",
  690: "Install Explosive Device DoT",
  691: "Install Notum Depletion Device DoT",
  692: "Install Explosive Device Countdown",
  693: "Install Notum Depletion Device Countdown",
  694: "Shadowland Reflect Base",
  695: "Blackstep",
  696: "Obscure Vision",
  697: "Gather Darkness",
  698: "Silence",
  699: "Silence Debuff",
  700: "Misery",
  701: "Death",
  702: "Path of Darkness",
  703: "Path of Darkness Debuff",
  704: "Road To Darkness",
  705: "Road To Darkness Debuff",
  706: "The Choice (Omni)",
  707: "The Choice Debuff (Omni)",
  708: "Blackfist",
  709: "Slam of Darkness",
  710: "Slam of Darkness Debuff",
  711: "Scream of Death",
  712: "Scream of Death Debuff",
  713: "Lightstep",
  714: "Gather Light",
  715: "Rain of Light",
  716: "Rain of Light Buff",
  717: "Morning",
  718: "Morning Debuff",
  719: "Hope",
  720: "Hope Buff",
  721: "Hope Debuff",
  722: "Life",
  723: "Path of Light",
  724: "Tunnel of Light",
  725: "Tunnel of Light Buff",
  726: "The Choice (Clan)",
  727: "Screen of Light",
  728: "Shield of Light",
  729: "Shield of Light Buff",
  730: "Fortress of Light",
  731: "Fortress of Light Buff",
  732: "Misery Buff",
  733: "Misery Debuff",
  734: "Quark Containment Field",
  735: "Fury",
  736: "Reinforced Slugs",
  737: "Affected by Nano Heal",
  738: "Shadowland Bind and Recall",
  739: "Performed Ritual of Devotion",
  740: "Performed Ritual of Zeal",
  741: "Performed Ritual of Spirit",
  742: "Performed Ritual of Blood",
  743: "Performed Devour Vigor",
  744: "Performed Devour Essence",
  745: "Performed Devour Vitality",
  746: "Performed Stab",
  747: "Performed Perforate",
  748: "Performed Impale",
  749: "Performed Double Stab",
  750: "Performed Lacerate",
  751: "Performed Gore",
  752: "Performed Hecatomb",
  753: "Performed Capture Vigor",
  754: "Performed Capture Essence",
  755: "Performed Capture Spirit",
  756: "Performed Capture Vitality",
  757: "Affected by Taint Wounds",
  758: "Performed Unsealed Blight",
  759: "Performed Unsealed Pestilence",
  760: "Performed Unsealed Contagion",
  761: "Transition Of Ergo",
  762: "Insurance Agent",
  763: "Insurance Claim",
  764: "Affected by Insurance Claim",
  765: "Regain Nano",
  766: "Grove Healing Multiplier",
  767: "Instinctive Control",
  768: "Special Attack Absorber Base",
  769: "Total Focus",
  770: "Soldier Damage Base",
  771: "Affected By Defensive Stance",
  772: "Defensive Stance",
  773: "Agent Detaunt Proc-Detaunt Segment",
  774: "Affected by Deceptive Stance",
  775: "Deceptive Stance",
  776: "Affected by Consume the Soul",
  777: "Short Term HP Buff",
  778: "Affected by Spirit of Blessing",
  779: "Affected by Spirit of Purity",
  780: "Spirit of Blessing",
  781: "Spirit of Purity",
  782: "WaitForAttackEffectNano2",
  783: "DuringFightNanoEffect2",
  784: "Dance of Fools",
  785: "Environmental Damage",
  786: "Fixer Runspeed Base",
  787: "AIPERK Blur",
  788: "AIPERK Sacrifice",
  789: "MINI DoT",
  790: "Zix Line",
  791: "AI AMSmodifier proc",
  792: "AIPERK Silent Plague",
  793: "AIPERK Insight",
  794: "AIPERK Assume Target",
  795: "Daring",
  796: "Leet Empower",
  797: "Link",
  798: "No Terraform",
  799: "Boss Root",
  800: "Cocoon",
  801: "NT Area Nukes",
  802: "AE Level Spawn",
  803: "Scones",
  804: "Privacy Shield",
  805: "Batter Up",
  806: "Armor Damage",
  807: "Healing Construct Empowerment",
  808: "PH",
  809: "Damage to Nano",
  810: "Mesmerization Construct Empowerment",
  811: "Engineer Miniaturization",
  812: "Research Ability 1",
  813: "Research Ability 2",
  814: "Trader AAO Drain",
  815: "Martial Artist Bow Buffs",
  816: "Pet Defensive Nanos",
  817: "Pet Damage Over Time Resist Nanos",
  818: "Cold Blooded",
  819: "Singed Fists",
  820: "AMS",
  821: "Shovel Buffs",
  822: "Ancient Blessings",
  823: "Augmented Mirror Shield Nano",
  824: "Nullity Sphere Nano",
  825: "DOT Removal",
  826: "Trader Nano Theft 1",
  827: "Trader Nano Theft 2",
  828: "Health and Nano Over Time Drain",
  829: "Health and Nano Over Time Transfer",
  830: "True Profession",
  831: "Shield of the Obedient Servant",
  832: "NT Area Nukes 2",
  833: "Bureaucrat Research Stun 1",
  834: "Bureaucrat Research Stun 2",
  835: "Nano Resist Buff ",
  836: "AAO Buffs",
  837: "Affected by OFAB Debuff",
  838: "Dust Brigade Turrets I",
  839: "Dust Brigade Turrets II",
  840: "Dust Brigade Turrets III",
  841: "Adventurer Damage Modifier",
  842: "DeTaunt",
  843: "Pet Heal Delta",
  844: "Health Drain",
  845: "Damage Drain",
  847: "Skill Lock Modifier Debuff",
  848: "Health Drain Effect",
  849: "Incapacitate",
  850: "Pet Heal Delta",
  851: "Reanimated Cloak Buffs",
  852: "Reanimated Cloak Blocker",
  853: "Reanimated Cloak Debuffs",
  854: "Aggressive Construct Empowerment",
  855: "Max Nano Buffs",
  856: "Nano Drain - Line B",
  857: "Notum Shield",
  858: "Nano Burst (Cyberdeck Special)",
  859: "Martial Artist HOT Line A",
  860: "Malpractice",
  861: "Weapon Effect Add-On 2",
  862: "Nano Resist Debuff Proc",
  863: "MP Attack Pet Damage Type",
  864: "Magnifying Glass Buffs",
  865: "Breathing Line 1",
  866: "Breathing Line 2",
  867: "Breathing Line 3",
  868: "Evasion Debuffs (Agent)",
  869: "DBPF Teleport A",
  870: "DBPF Teleport B",
  871: "DBPF Teleport C",
  872: "DBPF Teleport D",
  873: "DBPF Teleport E",
  874: "DBPF Teleport F",
  875: "DBPF Teleport X",
  876: "Magnifying Glass Attunement BX11",
  877: "Magnifying Glass Attunement WQEL",
  878: "Magnifying Glass Attunement MVCN",
  879: "Magnifying Glass Attunement ZLQ6",
  880: "Alien Dropship Shield 1 inside west",
  881: "Alien Dropship Shield 2 inside east",
  882: "Alien Dropship Shield 3 inside north",
  883: "Fear - PVP",
  884: "Knockback",
  885: "Fear - Cooldown",
  886: "Reverse Knockback",
  887: "Unremovable Snare",
  888: "Interpretation",
  889: "Trader Shutdown Skill Debuff",
  890: "Trader Shutdown Skill Buff",
  892: "Enhanced Snare",
  893: "Last Minute Negotiations",
  894: "Notum Dis/Reconnect",
  895: "Ancient Collapse",
  898: "False Redemption - Silvertail",
  899: "False Redemption - Tempterus",
  900: "Keeper Fear Immunity",
  901: "Fixer Fear Immunity",
  903: "Notum Drain",
  904: "Light Bullet Effect",
  905: "Power of Light Effect",
  906: "Power of Light Effect 2",
  907: "Light Killer Effect",
  908: "VP Gift/Reward",
  909: "Endurance Skin",
  910: "PvP Enabled",
  911: "Dark Ruins Root and Snare",
  912: "VIP Access",
  913: "Phasefront Racing",
  914: "Vehicles",
  916: "Prototype Nanoformula",
  917: "Gravity Shift",
  918: "Major Health Collection - Red",
  919: "Major Health Collection - Blue",
  920: "Hide/Stun",
  921: "Nanobot Cleaning",
  922: "Borrow Reflect",
  924: "Total Control",
  925: "Troll Form Run Debuff",
  926: "Social Pets",
  927: "Mark of the Pious",
  928: "Focus",
  929: "Loophole",
  930: "Optimize Bot Protocol",
  931: "Freak Shield",
  932: "Flim Focus",
  933: "Bring The Pain",
  934: "Chemical Blindness",
  935: "Poison Sprinkle",
  936: "Mongo Fury",
  937: "Wit of the Atrox",
  938: "Way of The Atrox",
  939: "Notum Domination",
  940: "Notum Spring",
  941: "Blinded by Delights",
  942: "Derivate",
  943: "Dizzying Heights",
  944: "Sprained Ankle",
  945: "Feel",
  946: "Propaganda",
  947: "Treatment Transfer",
  949: "General Perception Buff",
  950: "Defensive Stance",
  951: "Single Target Healing",
  952: "Team Healing",
  955: "Wall Hacks",
  956: "Kyr'Ozch Gene Pool",
  957: "Alien Parasite",
  958: "Mind Control",
  959: "Experience Constructs - XP Bonus",
  962: "Refreshment",
  963: "Dietmart Buff/Debuff",
  1000: "Nemesis Nano Programs",
  1002: "AAD Buffs",
  1003: "Stun",
  1004: "AOE Mezz",
  1005: "AOE Snare",
  1006: "AOE Root",
  1007: "Snare Removal Self",
  1008: "Snare Removal Other",
  1009: "Snare Removal Team",
  1010: "Root Removal Self",
  1011: "Root Removal Other",
  1012: "Root Removal Team",
  1013: "Pet Root, Snare, Charm, and Mezz Removal",
  1014: "Pet Healing",
  1015: "Attack Pets",
  1016: "Heal Pets",
  1017: "Support Pets",
  1018: "Pet Sacrifice",
  1019: "Pet Warp",
  1020: "Pet Proc (Line B)",
  1021: "Pet AOE Snare",
  1022: "Charm (Short)",
  1023: "Pet Proc (Line A)",
  1024: "Damage To Pet",
  1025: "Nukes",
  1026: "Alpha Nukes",
  1027: "Finishing Nukes",
  1028: "Special Effect Nukes",
  1029: "Boss Buffs",
  1030: "Self Grid",
  1031: "Team Grid",
  1032: "Emergency Grid",
  1033: "Shadowlands Maps",
  1034: "Team Run Speed Buffs",
  1035: "Spirit Drain",
  1036: "Summon Item",
  1037: "Taunt",
  1038: "AOE Taunt DOT",
  1039: "Fixer Grid",
  1040: "Nano Delta Debuff",
  1041: "Nuke",
  1042: "Alpha Nuke",
  1043: "Omega Nuke",
  1044: "AOE Nuke",
  1045: "Resurrection Sickness Removal",
  1046: "Food and Drink Buffs",
  1047: "Pet Debuff Cleanse",
  1048: "Proximity Range Debuff",
  1049: "Emergency Sneak",
  1050: "Heal Delta Debuff",
  1051: "Drain Heal",
  1052: "Critical Decrease Buff",
  1053: "Skill Lock Modifier Debuff",
  1054: "ICC Surveillance Software",
  1055: "Heal Reactivity Multiplier Buff",
  1056: "Heal Reactivity Multiplier Debuff",
  1057: "Charge",
  1058: "Martial Artist Zazen Stance",
  1059: "Martial Artist HOT - Line B",
  1060: "Trader AAD Drain",
  1061: "Nano Over Time - Line B",
  1062: "Nano Damage Multiplier Buffs",
  1063: "Health Transfer",
  1064: "Nano Transfer",
  1065: "Agent Disguise",
  1066: "Timed Taunt",
  1067: "Engineer Pet Aura Cancellation",
  1068: "PvP Pet",
  1069: "AoE Root/Snare Reduction",
  1070: "Shadowlands Garden Teleport",
  1071: "Summon Back Item",
  1072: "Team AC Buff",
  1073: "Evades Buff",
  1074: "Flight",
  1075: "Enhanced Nukes",
  1076: "Skill Wrangle",
  1077: "Composite Nano Skill Buffs",
  99999: "Test Item"
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

export type StatId = keyof typeof STAT;
export type StatName = typeof STAT[StatId];

export type RequirementId = keyof typeof REQUIREMENTS;
export type RequirementName = typeof REQUIREMENTS[RequirementId];

export type ProfessionId = keyof typeof PROFESSION;
export type ProfessionName = typeof PROFESSION[ProfessionId];

export type BreedId = keyof typeof BREED;
export type BreedName = typeof BREED[BreedId];

export type FactionId = keyof typeof FACTION;
export type FactionName = typeof FACTION[FactionId];

export type NanoSchoolId = keyof typeof NANOSCHOOL;
export type NanoSchoolName = typeof NANOSCHOOL[NanoSchoolId];

export type NanoStrainId = keyof typeof NANO_STRAIN;
export type NanoStrainName = typeof NANO_STRAIN[NanoStrainId];

// ============================================================================
// Implant Planning Constants (from TinkerPlants utils.py)
// ============================================================================

/**
 * Nano Programming skill modifiers for implant clusters
 * Used to calculate NP requirements for different skills
 */
/**

/**
 * Nano program substrain classifications
 * Maps substrain IDs to descriptive names for nano organization
 */
export const NANO_SUBSTRAINS = {
  0: "",
  1: "1H Blunt",
  2: "1H Blunt Buffs",
  3: "1H Blunt and 2H Blunt Buffs",
  4: "1H Edged Buffs",
  5: "2H Blunt",
  6: "2H Blunt Buffs",
  7: "2H Edged Buffs",
  8: "Add All Offensive",
  9: "Add All Offensive and Defensive",
  10: "Adventurer",
  11: "All AC Types",
  12: "Ammo",
  13: "Anima",
  14: "Area",
  15: "Armor",
  16: "Banshee",
  17: "Barrier",
  18: "Breakable",
  19: "Bureaucrat",
  20: "Calm",
  21: "Chimera",
  22: "Critical Buffs",
  23: "Critical Debuffs",
  24: "Cult Pets",
  25: "Damage",
  26: "Damage Charm",
  27: "Damage Robot",
  28: "Damage Shield",
  29: "Direct Damage",
  30: "Distance Weapon",
  31: "Doctor",
  32: "Dot",
  33: "Enervate",
  34: "Enforcer",
  35: "Engineer",
  36: "Evade Debuff",
  37: "Evocation",
  38: "Fixer",
  39: "Ghost",
  40: "Hacked Blind",
  41: "Hard to Resist",
  42: "Health",
  43: "Health and Nano",
  44: "Imminence",
  45: "Inits",
  46: "Kodaik",
  47: "Leet",
  48: "Long",
  49: "Lost Eden",
  50: "Loungemaster",
  51: "MC/Weapon Scaling",
  52: "Major Evasion Buffs",
  53: "Martial Artist",
  54: "Max Nano Debuffs",
  55: "Melee Weapon",
  56: "Meta-Physicist",
  57: "Misc",
  58: "Nano",
  59: "Nano Resist Debuffs",
  60: "Nano Resist/Evade Close Combat Debuff Proc",
  61: "Nano-Technician",
  62: "Normal",
  63: "Orphan",
  64: "Other",
  65: "Percent",
  66: "Phantom",
  67: "Pierce Reflect",
  68: "Pit Lizard",
  69: "Reaper",
  70: "Reet",
  71: "Reflect AC",
  72: "Reflect Damage",
  73: "Resistance Buffs",
  74: "Run Speed Buffs",
  75: "Sabretooth",
  76: "Sanctifier",
  77: "Scaling",
  78: "Self",
  79: "Shadowland Reflect Base",
  80: "Shadowlands",
  81: "Shadowlands Aura",
  82: "Shield",
  83: "Shield AC",
  84: "Short",
  85: "Single Pet",
  86: "Snare",
  87: "Social",
  88: "Soldier",
  89: "Soldier Damage Base",
  90: "Source Crystal",
  91: "Spectre",
  92: "Stun",
  93: "Target",
  94: "Taunt Only",
  95: "Team",
  96: "Team Run Speed Buffs",
  97: "Team-Empowered",
  98: "Totem",
  99: "Trader",
  100: "Umbral",
  101: "Unbreakable",
  102: "Vengance",
  103: "Wolf",
  104: "Wraith",
} as const;

export const NP_MODS = {
  '1h Blunt': 1.8,
  '1h Edged Weapon': 1.9,
  '2h Blunt': 1.8,
  '2h Edged': 1.9,
  'Adventuring': 1.5,
  'Agility': 2.25,
  'Aimed Shot': 2.1,
  'Assault Rif': 2.25,
  'Bio.Metamor': 2.4,
  'Body Dev': 2.0,
  'Bow': 2.0,
  'Bow Spc Att': 2.0,
  'Brawling': 1.65,
  'Break & Entry': 2.0,
  'Burst': 2.1,
  'Chemical AC': 2.0,
  'Chemistry': 2.0,
  'Cold AC': 2.0,
  'Comp. Liter': 2.0,
  'Concealment': 1.8,
  'Dimach': 2.25,
  'Disease AC': 1.75,
  'Dodge-Rng': 2.0,
  'Duck-Exp': 2.0,
  'Elec. Engi': 2.0,
  'Energy AC': 2.25,
  'Evade-ClsC': 2.0,
  'Fast Attack': 1.9,
  'Fire AC': 2.0,
  'First Aid': 1.8,
  'Fling Shot': 1.8,
  'Full Auto': 2.25,
  'Grenade': 1.9,
  'Heavy Weapons': 1.0,
  'Imp/Proj AC': 2.25,
  'Intelligence': 2.25,
  'Map Nav': 1.25,
  'Martial Arts': 2.5,
  'Matter Crea': 2.4,
  'Matt.Metam': 2.4,
  'Max Health': 2.5,
  'Max Nano': 2.5,
  'Mech. Engi': 2.0,
  'Melee Ener': 2.0,
  'Melee. Init': 2.0,
  'Melee AC': 2.25,
  'MG / SMG': 2.0,
  'Mult. Melee': 2.25,
  'Multi Ranged': 2.0,
  'NanoC. Init': 2.0,
  'Nano Pool': 3.0,
  'Nano Progra': 2.0,
  'Nano Resist': 2.0,
  'Parry': 2.1,
  'Perception': 2.0,
  'Pharma Tech': 2.0,
  'Physic. Init': 2.0,
  'Piercing': 1.6,
  'Pistol': 2.0,
  'Psychic': 2.25,
  'Psycho Modi': 2.4,
  'Psychology': 2.0,
  'Quantum FT': 2.0,
  'Radiation AC': 2.0,
  'Ranged Energy': 2.0,
  'Ranged Init': 2.0,
  'Rifle': 2.25,
  'Riposte': 2.5,
  'Run Speed': 2.0,
  'Sense': 2.25,
  'Sensory Impr': 2.20,
  'Sharp Obj': 1.25,
  'Shotgun': 1.7,
  'Sneak Atck': 2.5,
  'Stamina': 2.25,
  'Strength': 2.25,
  'Swimming': 1.25,
  'Time & Space': 2.4,
  'Trap Disarm': 1.8,
  'Treatment': 2.15,
  'Tutoring': 1.3,
  'Vehicle Air': 1.0,
  'Vehicle Ground': 1.5,
  'Vehicle Water': 1.2,
  'Weapon Smt': 2.0
} as const;

/**
 * Maps Jobe cluster skills to their required combining skills
 */
export const JOBE_SKILL = {
  'Add All Def.': 'Psychology',
  'Add All Off': 'Psychology',
  'Add. Chem. Dam.': 'Quantum FT',
  'Add. Energy Dam.': 'Quantum FT',
  'Add. Fire Dam.': 'Quantum FT',
  'Add. Melee Dam.': 'Quantum FT',
  'Add. Poison Dam.': 'Quantum FT',
  'Add. Proj. Dam.': 'Quantum FT',
  'Add.Rad. Dam.': 'Quantum FT',
  'Add. Xp': 'Psychology',
  'Heal Delta': 'Pharma Tech',
  'Max NCU': 'Computer Literacy',
  'Nano Delta': 'Pharma Tech',
  'Nano Point Cost Modifier': 'Quantum FT',
  'NF Interrupt': 'Psychology',
  'Nano Formula Interrupt Modifier': 'Nanoprogramming',
  'RangeInc. NF': 'Nanoprogramming',
  'RangeInc. Weapon': 'Weaponsmithing',
  'Shield Chemical AC': 'Quantum FT',
  'Shield Cold AC': 'Quantum FT',
  'Shield Melee AC': 'Quantum FT',
  'Shield Poison AC': 'Quantum FT',
  'Shield Energy AC': 'Quantum FT',
  'Shield Fire AC': 'Quantum FT',
  'Shield Projectile AC': 'Quantum FT',
  'Shield Radiation AC': 'Quantum FT',
  'Skill Time Lock Modifier': 'Psychology'
} as const;

/**
 * Jobe cluster slot modifiers
 */
export const JOBE_MODS = {
  'Shiny': 6.25,
  'Bright': 4.75,
  'Faded': 3.25
} as const;

/**
 * All possible implant skills
 */
export const ALL_SKILLS = [
  'Empty', 'Shield Energy AC', 'Fast Attack', 'Fire AC', 'Heavy Weapons', 'Skill Time Lock Modifier', 
  'Riposte', 'Bow Spc Att', 'Melee/Ma AC', 'Shield Cold AC', 'Vehicle Grnd', 'Mult. Melee', 
  'Add. Energy Dam.', 'Rifle', 'Weapon Smt', 'NanoC. Init', 'Dimach', 'Concealment', 'Sharp Obj', 
  'Bow', 'Elec. Engi', 'Add All Off', 'Time & Space', 'Add. Proj. Dam.', '1h Blunt', 'Add. Chem. Dam.', 
  '1h Edged Weapon', 'Duck-Exp', 'Add. Xp', 'Ranged Ener', 'Nano Delta', 'Psychic', 'Imp/Proj AC', 
  'Full Auto', 'Evade-ClsC', 'Strength', '2h Edged', 'Energy AC', 'Body Dev', 'Shield Fire AC', 
  'Disease AC', 'Melee Ener', 'RangeInc. NF', 'Pistol', 'Piercing', 'Adventuring', 'Nano Progra', 
  'Sense', 'Nano Point Cost Modifier', 'Vehicle Hydr', 'Break & Entry', 'Comp. Liter', 
  'Nano Formula Interrupt Modifier', 'RangeInc. Weapon', 'Add. Fire Dam.', 'Max Nano', 'Agility', 
  'Matt.Metam', 'Shield Melee AC', 'Stamina', 'Add. Melee Dam.', 'Ranged. Init', 'Map Navig', 
  'Pharma Tech', 'Grenade', 'First Aid', 'Matter Crea', 'Bio.Metamor', 'Max Health', 'Vehicle Air', 
  'Heal Delta', 'Shield Radiation AC', 'Mech. Engi', 'Shield Poison AC', 'Treatment', 'Add. Poison Dam.', 
  'Chemistry', 'Run Speed', 'Sneak Atck', 'Add.Rad. Dam.', 'Dodge-Rng', 'Physic. Init', 'Psychology', 
  'Psycho Modi', 'Burst', 'Melee. Init', 'Trap Disarm', 'Swimming', 'Shield Projectile AC', 'MG / SMG', 
  'Cold AC', 'Nano Pool', 'Radiation AC', 'Quantum FT', 'Perception', 'Aimed Shot', 'Max NCU', 
  'Tutoring', 'Assault Rif', 'Parry', 'Chemical AC', 'Multi Ranged', 'Add All Def.', '2h Blunt', 
  'Shotgun', 'Martial Arts', 'Brawling', 'Shield Chemical AC', 'Sensory Impr', 'Fling Shot', 
  'Nano Resist', 'Intelligence'
] as const;

/**
 * Implant slot name to index mapping
 */
export const IMP_SLOT_INDEX = {
  'Eye': 1,
  'Head': 2,
  'Ear': 3,
  'Right-Arm': 4,
  'Right arm': 4,
  'Chest': 5,
  'Body': 5,
  'Left-Arm': 6,
  'Left arm': 6,
  'Right-Wrist': 7,
  'Right wrist': 7,
  'Waist': 8,
  'Left-Wrist': 9,
  'Left wrist': 9,
  'Right-Hand': 10,
  'Right hand': 10,
  'Leg': 11,
  'Legs': 11,
  'Left-Hand': 12,
  'Left hand': 12,
  'Feet': 13
} as const;

/**
 * Ordered list of implant slots
 */
export const IMP_SLOTS = [
  'Eye',
  'Head',
  'Ear',
  'Right-Arm',
  'Chest',
  'Left-Arm',
  'Right-Wrist',
  'Waist',
  'Left-Wrist',
  'Right-Hand',
  'Leg',
  'Left-Hand',
  'Feet'
] as const;

/**
 * Complete implant skills mapping by slot and cluster type
 */
export const IMP_SKILLS = {
  'Eye': {
    'Shiny': ['Empty','Aimed Shot','Elec. Engi','Map Navig','RangeInc. Weapon','Rifle','Tutoring','Vehicle Air'],
    'Bright': ['Empty','Chemistry','Comp. Liter','Grenade','Heavy Weapons','Intelligence','Mech. Engi','Mult. Melee','Nano Progra','NanoC. Init','Perception','Pharma Tech','Psycho Modi','Quantum FT','Ranged Ener','Sensory Impr','Treatment','Vehicle Grnd','Vehicle Hydr'],
    'Faded': ['Empty','Assault Rif','Bow','Concealment','Matter Crea','Multi Ranged','Pistol','Psychology','Sharp Obj','Sneak Atck','Time & Space','Weapon Smt']
  },
  'Head': {
    'Shiny': ['Empty','Bio.Metamor','Bow Spc Att','Chemistry','Comp. Liter','Disease AC','First Aid','Intelligence','Matt.Metam','Matter Crea','Max Nano','Mech. Engi','Melee Ener','Nano Progra','Nano Resist','NanoC. Init','Pharma Tech','Psychic','Psycho Modi','Psychology','Quantum FT','Ranged Ener','Sensory Impr','Time & Space','Treatment','Vehicle Grnd','Vehicle Hydr'],
    'Bright': ['Empty','Dimach','Elec. Engi','Map Navig','Nano Pool','Ranged. Init','Weapon Smt'],
    'Faded': ['Empty','Perception','Sense','Trap Disarm','Tutoring','Vehicle Air']
  },
  'Ear': {
    'Shiny': ['Empty','Add. Xp','Max NCU','Perception'],
    'Bright': ['Empty','Concealment','Nano Point Cost Modifier','Psychology','Tutoring','Vehicle Air'],
    'Faded': ['Empty','Intelligence','Map Navig','Psychic','Psycho Modi','Vehicle Grnd','Vehicle Hydr']
  },
  'Right-Arm': {
    'Shiny': ['Empty','1h Blunt','1h Edged Weapon','2h Blunt','2h Edged','Assault Rif','Bow','Break & Entry','Burst','Fling Shot','Full Auto','Grenade','Heavy Weapons','MG / SMG','Piercing','Shotgun','Strength'],
    'Bright': ['Empty','Add All Def.','Add All Off','Brawling','Chemical AC','Nano Delta','Physic. Init','Swimming'],
    'Faded': ['Empty','Fast Attack','Mech. Engi','Parry','Radiation AC','RangeInc. NF','RangeInc. Weapon','Riposte']
  },
  'Chest': {
    'Shiny': ['Empty','Body Dev','Dimach','Energy AC','Max Health','Melee/Ma AC','Nano Pool','Sense','Stamina'],
    'Bright': ['Empty','Bio.Metamor','Imp/Proj AC','Matt.Metam','Psychic'],
    'Faded': ['Empty','2h Blunt','Adventuring','Break & Entry','Disease AC','MG / SMG','Max Nano','Nano Formula Interrupt Modifier','NanoC. Init','Sensory Impr','Skill Time Lock Modifier','Strength']
  },
  'Left-Arm': {
    'Shiny': ['Empty','Add All Def.','Add All Off','Brawling','Heal Delta','RangeInc. NF'],
    'Bright': ['Empty','2h Blunt','2h Edged','Bow','Break & Entry','Piercing','Radiation AC','Strength'],
    'Faded': ['Empty','Chemical AC','Matt.Metam','Nano Point Cost Modifier','Physic. Init','Swimming']
  },
  'Right-Wrist': {
    'Shiny': ['Empty','Nano Delta','Parry','Pistol','Ranged. Init','Riposte','Run Speed','Sharp Obj'],
    'Bright': ['Empty','1h Blunt','1h Edged Weapon','Aimed Shot','Burst','Full Auto','Max NCU','Multi Ranged','Nano Resist','Rifle','Sneak Atck'],
    'Faded': ['Empty','Add. Chem. Dam.','Add. Energy Dam.','Add. Fire Dam.','Add. Melee Dam.','Add. Poison Dam.','Add. Proj. Dam.','Add.Rad. Dam.','Bow Spc Att','Fling Shot','Melee Ener','Mult. Melee']
  },
  'Waist': {
    'Shiny': ['Empty','Chemical AC','Cold AC','Fire AC','Nano Point Cost Modifier','Radiation AC'],
    'Bright': ['Empty','Adventuring','Body Dev','Duck-Exp','Max Health','Max Nano','Melee/Ma AC','Sense'],
    'Faded': ['Empty','2h Edged','Agility','Bio.Metamor','Brawling','Dimach','Dodge-Rng','Energy AC','Evade-ClsC','Full Auto','Imp/Proj AC','Melee. Init','Nano Pool','Piercing','Shotgun','Stamina']
  },
  'Left-Wrist': {
    'Shiny': ['Empty','Mult. Melee','Multi Ranged','Shield Energy AC','Shield Fire AC','Shield Projectile AC','Shield Radiation AC'],
    'Bright': ['Empty','Add. Chem. Dam.','Add. Energy Dam.','Add. Fire Dam.','Add. Melee Dam.','Add. Poison Dam.','Add. Proj. Dam.','Add.Rad. Dam.','Melee Ener','Parry','Riposte','Run Speed'],
    'Faded': ['Empty','Nano Resist','Rifle','Shield Chemical AC','Shield Cold AC','Shield Melee AC','Shield Poison AC']
  },
  'Right-Hand': {
    'Shiny': ['Empty','Add. Chem. Dam.','Add. Energy Dam.','Add. Fire Dam.','Add. Melee Dam.','Add. Poison Dam.','Add. Proj. Dam.','Add.Rad. Dam.','Martial Arts','Trap Disarm','Weapon Smt'],
    'Bright': ['Empty','Assault Rif','Bow Spc Att','Cold AC','Fast Attack','First Aid','Fling Shot','MG / SMG','Matter Crea','Pistol','Sharp Obj','Shotgun','Time & Space'],
    'Faded': ['Empty','1h Blunt','1h Edged Weapon','Aimed Shot','Burst','Chemistry','Comp. Liter','Elec. Engi','Fire AC','Grenade','Heavy Weapons','Nano Progra','Pharma Tech','Quantum FT','Ranged. Init','Treatment']
  },
  'Leg': {
    'Shiny': ['Empty','Adventuring','Agility','Dodge-Rng','Duck-Exp','Imp/Proj AC','Nano Formula Interrupt Modifier','Skill Time Lock Modifier','Swimming'],
    'Bright': ['Empty','Disease AC','Energy AC','Evade-ClsC','Melee. Init','Stamina'],
    'Faded': ['Empty','Add. Xp','Body Dev','Heal Delta','Max Health','Max NCU','Melee/Ma AC','Run Speed','Shield Energy AC','Shield Fire AC','Shield Projectile AC','Shield Radiation AC']
  },
  'Left-Hand': {
    'Shiny': ['Empty','Fast Attack','Shield Chemical AC','Shield Cold AC','Shield Melee AC','Shield Poison AC'],
    'Bright': ['Empty','Fire AC','Nano Formula Interrupt Modifier','RangeInc. NF','Shield Energy AC','Shield Fire AC','Shield Projectile AC','Shield Radiation AC','Skill Time Lock Modifier','Trap Disarm'],
    'Faded': ['Empty','Cold AC','First Aid','Martial Arts','Ranged Ener']
  },
  'Feet': {
    'Shiny': ['Empty','Concealment','Evade-ClsC','Melee. Init','Physic. Init','Sneak Atck'],
    'Bright': ['Empty','Add. Xp','Agility','Dodge-Rng','Heal Delta','Martial Arts','RangeInc. Weapon','Shield Chemical AC','Shield Cold AC','Shield Melee AC','Shield Poison AC'],
    'Faded': ['Empty','Add All Def.','Add All Off','Duck-Exp','Nano Delta']
  }
} as const;

/**
 * Cluster type slot indices
 */
export const CLUSTER_SLOTS = {
  'Shiny': 0,
  'Bright': 1,
  'Faded': 2
} as const;

/**
 * Minimum QL ratios for cluster types
 */
export const CLUSTER_MIN_QL = {
  'Shiny': 0.86,
  'Bright': 0.84,
  'Faded': 0.82
} as const;

// ============================================================================
// TinkerNukes Constants (Nanotechnician Specialization Data)
// ============================================================================

/**
 * Character breed ID to name mapping
 */
export const BREEDS = {
  0: 'Solitus',
  1: 'Opifex',
  2: 'Nanomage',
  3: 'Atrox'
} as const;

/**
 * Cyberdeck types for Nanotechnician specialization
 */
export const DECKS = {
  0: 'Worn Cyberdeck',
  1: 'Basic Cyberdeck',
  2: 'Augmented Cyberdeck',
  4: 'Jobe-chipped Cyberdeck',
  8: 'Izgimmer Modified Cyberdeck'
} as const;

/**
 * Specialization level mapping
 */
export const SPECS = {
  0: 0,
  1: 1,
  2: 2,
  4: 3,
  8: 4
} as const;

/**
 * Humidity Extractor nano damage bonuses by level
 */
export const HUMIDITY = {
  0: 0,
  1: 0.333333,
  2: 1.4,
  3: 3.4,
  4: 6.8,
  5: 8.733333,
  6: 12.7333,
  7: 15.66666
} as const;

/**
 * Crunchcom nano damage bonuses by level
 */
export const CRUNCHCOM = {
  0: 0,
  1: 6,
  2: 9,
  3: 11,
  4: 13,
  5: 18,
  6: 22,
  7: 28
} as const;

/**
 * Notum Siphon nano damage bonuses by level
 */
export const NOTUM_SIPHON = {
  0: 0.0,
  1: 5.0,
  2: 9.0,
  3: 14.4444,
  4: 21.1111,
  5: 25.0,
  6: 26.875,
  7: 34.2857,
  8: 37.1428,
  9: 42.8571,
  10: 83.4
} as const;

/**
 * Channeling of Notum nano damage bonuses by level
 */
export const CHANNELING_OF_NOTUM = {
  0: 0.0,
  1: 1.7857,
  2: 4.6153,
  3: 7.5,
  4: 15.4545
} as const;

/**
 * Enhance Nano Damage bonuses by level
 */
export const ENHANCE_NANO_DAMAGE = {
  0: 0,
  1: 2,
  2: 4,
  3: 7,
  4: 10,
  5: 13,
  6: 18
} as const;

/**
 * Ancient Matrix nano damage bonuses by level
 */
export const ANCIENT_MATRIX = {
  0: 0,
  1: 0,
  2: 0,
  3: 1,
  4: 1,
  5: 1,
  6: 2,
  7: 2,
  8: 2,
  9: 3,
  10: 3
} as const;

/**
 * CAN flags - bitflags for item capabilities (stat 30)
 */
export const CANFLAG = {
  NONE: 0,
  Carry: 1 << 0,        // 2**0
  Sit: 1 << 1,          // 2**1
  Wear: 1 << 2,         // 2**2
  Use: 1 << 3,          // 2**3
  ConfirmUse: 1 << 4,   // 2**4
  Consume: 1 << 5,      // 2**5
  TutorChip: 1 << 6,    // 2**6
  TutorDevice: 1 << 7,  // 2**7
  BreakingAndEntering: 1 << 8,  // 2**8
  Stackable: 1 << 9,    // 2**9
  NoAmmo: 1 << 10,      // 2**10
  Burst: 1 << 11,       // 2**11
  FlingShot: 1 << 12,   // 2**12
  FullAuto: 1 << 13,    // 2**13
  AimedShot: 1 << 14,   // 2**14
  Bow: 1 << 15,         // 2**15
  ThrowAttack: 1 << 16, // 2**16
  SneakAttack: 1 << 17, // 2**17
  FastAttack: 1 << 18,  // 2**18
  DisarmTraps: 1 << 19, // 2**19
  AutoSelect: 1 << 20,  // 2**20
  ApplyOnFriendly: 1 << 21, // 2**21
  ApplyOnHostile: 1 << 22,  // 2**22
  ApplyOnSelf: 1 << 23,     // 2**23
  CantSplit: 1 << 24,       // 2**24
  Brawl: 1 << 25,           // 2**25
  Dimach: 1 << 26,          // 2**26
  EnableHandAttractors: 1 << 27, // 2**27
  CanBeWornWithSocialArmor: 1 << 28 // 2**28
} as const;

/**
 * Item flags - bitflags for item properties (stat 0)
 */
export const ITEM_NONE_FLAG = {
  NONE: 0,
  Visible: 1 << 0,               // 2**0
  ModifiedDescription: 1 << 1,   // 2**1
  ModifiedName: 1 << 2,          // 2**2
  CanBeTemplateItem: 1 << 3,     // 2**3
  TurnOnUse: 1 << 4,             // 2**4
  HasMultipleCount: 1 << 5,      // 2**5
  Locked: 1 << 6,                // 2**6
  Open: 1 << 7,                  // 2**7
  ItemSocialArmour: 1 << 8,      // 2**8
  TellCollision: 1 << 9,         // 2**9
  NoSelectionIndicator: 1 << 10, // 2**10
  UseEmptyDestruct: 1 << 11,     // 2**11
  Stationary: 1 << 12,           // 2**12
  Repulsive: 1 << 13,            // 2**13
  DefaultTarget: 1 << 14,        // 2**14
  ItemTextureOverride: 1 << 15,  // 2**15
  Null: 1 << 16,                 // 2**16
  HasAnimation: 1 << 17,         // 2**17
  HasRotation: 1 << 18,          // 2**18
  WantCollision: 1 << 19,        // 2**19
  WantSignals: 1 << 20,          // 2**20
  HasSentFirstIIR: 1 << 21,      // 2**21
  HasEnergy: 1 << 22,            // 2**22
  MirrorInLeftHand: 1 << 23,     // 2**23
  IllegalClan: 1 << 24,          // 2**24
  IllegalOmni: 1 << 25,          // 2**25
  NoDrop: 1 << 26,               // 2**26
  Unique: 1 << 27,               // 2**27
  CanBeAttacked: 1 << 28,        // 2**28
  DisableFalling: 1 << 29,       // 2**29
  HasDamage: 1 << 30,            // 2**30
  DisableStatelCollision: 1 << 31 // 2**31
} as const;

/**
 * Specialization flags - bitflags for nano specializations
 */
export const SPECIALIZATION_FLAG = {
  NONE: 0,
  First: 1 << 0,    // 2**0
  Second: 1 << 1,   // 2**1
  Third: 1 << 2,    // 2**2
  Fourth: 1 << 3,   // 2**3
  Bit5: 1 << 5,     // 2**5
  Bit6: 1 << 6,     // 2**6
  Bit7: 1 << 7,     // 2**7
  Bit8: 1 << 8      // 2**8
} as const;

/**
 * Action flags - bitflags for available actions
 */
export const ACTION_FLAG = {
  NONE: 0,
  Bit0: 1 << 0,           // 2**0
  Fighting: 1 << 1,       // 2**1
  Moving: 1 << 2,         // 2**2
  Falling: 1 << 3,        // 2**3
  ImplantAccess: 1 << 4,  // 2**4
  Chat: 1 << 5,           // 2**5
  SkillTime: 1 << 6,      // 2**6
  Concealment: 1 << 7,    // 2**7
  CryForHelp: 1 << 8,     // 2**8
  VicinityInfo: 1 << 9,   // 2**9
  Attack: 1 << 10,        // 2**10
  OnGrid: 1 << 11,        // 2**11
  BankAccess: 1 << 12,    // 2**12
  Zoning: 1 << 13,        // 2**13
  Help: 1 << 14,          // 2**14
  WalkOnLand: 1 << 15,    // 2**15
  Bit15: 1 << 16,         // 2**16
  SwimInWater: 1 << 17,   // 2**17
  FlyInAir: 1 << 18,      // 2**18
  Terminate: 1 << 19,     // 2**19
  Bit20: 1 << 20,         // 2**20
  Bit21: 1 << 21,         // 2**21
  Bit22: 1 << 22,         // 2**22
  Bit23: 1 << 23,         // 2**23
  Anon: 1 << 24,          // 2**24
  Bit25: 1 << 25,         // 2**25
  PvP: 1 << 26,           // 2**26
  Bit27: 1 << 27,         // 2**27
  Bit28: 1 << 28          // 2**28
} as const;

/**
 * Nano flags - bitflags for nano program properties
 */
export const NANO_NONE_FLAG = {
  NONE: 0,
  Visible: 1 << 0,                  // 2**0
  NoResistCannotFumble: 1 << 1,     // 2**1
  IsShapeChange: 1 << 2,            // 2**2
  BreakOnAttack: 1 << 3,            // 2**3
  TurnOnUse: 1 << 4,                // 2**4
  BreakOnDebuff: 1 << 5,            // 2**5
  BreakOnInterval: 1 << 6,          // 2**6
  BreakOnSpellAttack: 1 << 7,       // 2**7
  NoRemoveNoNCUFriendly: 1 << 8,    // 2**8
  TellCollision: 1 << 9,            // 2**9
  NoSelectionIndicator: 1 << 10,    // 2**10
  UseEmptyDestruct: 1 << 11,        // 2**11
  NoIIR: 1 << 12,                   // 2**12
  NoResist: 1 << 13,                // 2**13
  NotRemovable: 1 << 14,            // 2**14
  IsHostile: 1 << 15,               // 2**15
  IsBuff: 1 << 16,                  // 2**16
  IsDebuff: 1 << 17,                // 2**17
  PlayshiftRequirements: 1 << 18,   // 2**18
  NoTimerNotify: 1 << 19,           // 2**19
  NoTimeoutNotify: 1 << 20,         // 2**20
  DontRemoveOnDeath: 1 << 21,       // 2**21
  DontBreakOnAttack: 1 << 22,       // 2**22
  CannotRefresh: 1 << 23,           // 2**23
  IsHidden: 1 << 24,                // 2**24
  ClassDebuffMMBM: 1 << 25,         // 2**25
  ClassDebuffMCTS: 1 << 26,         // 2**26
  ClassDebuffPMSI: 1 << 27,         // 2**27
  ClassCombatDebuff: 1 << 28        // 2**28
} as const;

/**
 * Expansion flags - bitflags for required expansions
 */
export const EXPANSION_FLAG = {
  NONE: 0,
  NotumWars: 1 << 0,              // 2**0
  Shadowlands: 1 << 1,            // 2**1
  ShadowlandsPreorder: 1 << 2,    // 2**2
  AlienInvasion: 1 << 3,          // 2**3
  AlienInvasionPreorder: 1 << 4,  // 2**4
  LostEden: 1 << 5,               // 2**5
  LostEdenPreorder: 1 << 6,       // 2**6
  LexacyOfXan: 1 << 7,            // 2**7
  LegacyOfXanPreorder: 1 << 8     // 2**8
} as const;

/**
 * Worn item flags - bitflags for equipped items
 */
export const WORN_ITEM = {
  BasicCyberDeck: 1 << 0,     // 2**0
  AugmentedCyberDeck: 1 << 1, // 2**1
  JobeCyberDeck: 1 << 2,      // 2**2
  IzgimmerCyberDeck: 1 << 3,  // 2**3
  GridArmor: 1 << 4,          // 2**4
  SocialArmor: 1 << 5,        // 2**5
  NanoDeck: 1 << 6,           // 2**6
  MpSummonedWeapon: 1 << 7,   // 2**7
  Bit8: 1 << 8,               // 2**8
  Bit9: 1 << 9,               // 2**9
  Bit10: 1 << 10,             // 2**10
  Bit11: 1 << 11,             // 2**11
  Bit12: 1 << 12,             // 2**12
  Bit13: 1 << 13,             // 2**13
  Bit14: 1 << 14,             // 2**14
  Bit15: 1 << 15,             // 2**15
  Bit16: 1 << 16,             // 2**16
  Bit17: 1 << 17,             // 2**17
  Bit18: 1 << 18,             // 2**18
  Bit19: 1 << 19,             // 2**19
  Bit20: 1 << 20,             // 2**20
  Bit21: 1 << 21,             // 2**21
  Bit22: 1 << 22,             // 2**22
  Bit23: 1 << 23,             // 2**23
  Bit24: 1 << 24,             // 2**24
  Bit25: 1 << 25,             // 2**25
  Bit26: 1 << 26,             // 2**26
  Bit27: 1 << 27,             // 2**27
  Bit28: 1 << 28,             // 2**28
  Bit29: 1 << 29              // 2**29
} as const;

/**
 * Weapon slot flags - bitflags for weapon slot positions
 */
export const WEAPON_SLOT = {
  NONE: 0,
  Bit0: 1 << 0,      // 2**0
  Hud1: 1 << 1,      // 2**1
  Hud3: 1 << 2,      // 2**2
  Util1: 1 << 3,     // 2**3
  Util2: 1 << 4,     // 2**4
  Util3: 1 << 5,     // 2**5
  RightHand: 1 << 6, // 2**6
  Deck: 1 << 7,      // 2**7
  LeftHand: 1 << 8,  // 2**8
  Deck1: 1 << 9,     // 2**9
  Deck2: 1 << 10,    // 2**10
  Deck3: 1 << 11,    // 2**11
  Deck4: 1 << 12,    // 2**12
  Deck5: 1 << 13,    // 2**13
  Deck6: 1 << 14,    // 2**14
  Hud2: 1 << 15      // 2**15
} as const;

/**
 * Armor slot flags - bitflags for armor slot positions
 */
export const ARMOR_SLOT = {
  NONE: 0,
  Bit0: 1 << 0,           // 2**0
  Neck: 1 << 1,           // 2**1
  Head: 1 << 2,           // 2**2
  Back: 1 << 3,           // 2**3
  RightShoulder: 1 << 4,  // 2**4
  Chest: 1 << 5,          // 2**5
  LeftShoulder: 1 << 6,   // 2**6
  RightArm: 1 << 7,       // 2**7
  Hands: 1 << 8,          // 2**8
  LeftArm: 1 << 9,        // 2**9
  RightWrist: 1 << 10,    // 2**10
  Legs: 1 << 11,          // 2**11
  LeftWrist: 1 << 12,     // 2**12
  RightFinger: 1 << 13,   // 2**13
  Feet: 1 << 14,          // 2**14
  LeftFinger: 1 << 15,    // 2**15
  PerkAction: 1 << 31     // 2**31
} as const;

/**
 * Implant slot flags - bitflags for implant slot positions
 */
export const IMPLANT_SLOT = {
  NONE: 0,
  Bit0: 1 << 0,      // 2**0
  Eyes: 1 << 1,      // 2**1
  Head: 1 << 2,      // 2**2
  Ears: 1 << 3,      // 2**3
  RightArm: 1 << 4,  // 2**4
  Chest: 1 << 5,     // 2**5
  LeftArm: 1 << 6,   // 2**6
  RightWrist: 1 << 7, // 2**7
  Waist: 1 << 8,     // 2**8
  LeftWrist: 1 << 9, // 2**9
  RightHand: 1 << 10, // 2**10
  Legs: 1 << 11,     // 2**11
  LeftHand: 1 << 12, // 2**12
  Feet: 1 << 13      // 2**13
} as const;

/**
 * Weapon type flags - bitflags for weapon types
 */
export const WEAPON_TYPE = {
  NONE: 0,
  Fists: 1 << 0,         // 2**0
  Melee: 1 << 1,         // 2**1
  Ranged: 1 << 2,        // 2**2
  Bow: 1 << 3,           // 2**3
  SMG: 1 << 4,           // 2**4
  OneHandEdge: 1 << 5,   // 2**5
  OneHandBlunt: 1 << 6,  // 2**6
  TwoHandEdge: 1 << 7,   // 2**7
  TwoHandBlunt: 1 << 8,  // 2**8
  Piercing: 1 << 9,      // 2**9
  Pistol: 1 << 10,       // 2**10
  AssaultRifle: 1 << 11, // 2**11
  Rifle: 1 << 12,        // 2**12
  Shotgun: 1 << 13,      // 2**13
  Energy: 1 << 14,       // 2**14
  Grenade: 1 << 15,      // 2**15
  HeavyWeapons: 1 << 16, // 2**16
  Bit17: 1 << 17,        // 2**17
  Bit18: 1 << 18,        // 2**18
  Bit19: 1 << 19,        // 2**19
  Bit20: 1 << 20,        // 2**20
  Bit21: 1 << 21,        // 2**21
  Bit22: 1 << 22,        // 2**22
  TestItem: 1 << 23,     // 2**23
  Bit24: 1 << 24,        // 2**24
  Bit25: 1 << 25,        // 2**25
  Bit26: 1 << 26,        // 2**26
  Bit27: 1 << 27,        // 2**27
  Bit28: 1 << 28         // 2**28
} as const;

/**
 * Shadowlands zone protection flags
 */
export const SL_ZONE_PROTECTION = {
  Adonis: 0,            // Special case - no protection needed
  Penumbra: 1 << 0,     // 2**0
  Inferno: 1 << 1,      // 2**1
  Pandemonium: 1 << 2   // 2**2
} as const;

/**
 * Damage type ID to name mapping
 */
export const DAMAGE_TYPES = {
  0: 'All',
  1: 'Chemical',
  2: 'Cold',
  3: 'Energy',
  4: 'Fire',
  5: 'Melee',
  6: 'Poison',
  7: 'Projectile',
  8: 'Radiation'
} as const;

/**
 * Spell format ID to format string mapping
 * Used for formatting spell descriptions with parameter interpolation
 */
export const SPELL_FORMATS = {
  53002: 'Hit {Stat} for {MinValue} to {MaxValue}',
  53003: 'Animation effect, A={A} B={B} C={C} D={D} E={E}',
  53012: 'Modify {Stat} by {Amount}',
  53014: 'Modify {Stat} for {Duration}s by {Amount}',
  53016: 'Teleport to {X}x{Z}x{Y} in playfield {Playfield}',
  53019: 'Upload {NanoID}',
  53025: 'Animation, A={A} B={B} C={C}',
  53026: 'Set {Skill} by {Amount}',
  53028: 'Add Skill {Skill} by {Amount}',
  53030: 'Gfx effect',
  53032: 'Save character',
  53033: 'Lock skill {Skill} for {Duration}s',
  53035: 'Head mesh, A={A} B={B}',
  53037: 'Back Mesh, A={A} B={B}',
  53038: 'Apply shoulder mesh A={A} B={B}',
  53039: 'Apply texture {Texture} to {Location}',
  53044: 'System text: {Text}',
  53045: 'Modify {Stat} by {Amount}',
  53051: 'Cast {NanoID}',
  53054: 'Change body mesh, A={A}',
  53055: 'Attractor Mesh, A={A} B={B}',
  53057: 'Float text: {Text}',
  53060: 'Temporarily change shape to {Shape}',
  53063: 'Spawn QL{Quality} {MonsterHash} for {Duration}s',
  53064: 'Spawn QL{Quality} {Item}',
  53065: 'Attractor Effect A, A={A} B={B} C={C} D={D}',
  53066: 'Cast {NanoID} on team',
  53067: 'Change action {Action} restriction for {Duration}s',
  53068: 'Restrict action {Action}',
  53069: 'Change to next head',
  53070: 'Change to previous head',
  53073: 'Hit all {Stat} within {Radius}m for {MinAmount} to {MaxAmount}, modified by {ModifierStat}',
  53075: 'Attractor Effect B, A={A} B={B} C={C} D={D}',
  53076: 'Attractor Effect C, A={A} B={B} C={C} D={D}',
  53078: 'Social animation: {Animation}',
  53079: 'Change effect, A={A} B={B} C={C}',
  53082: 'Teleport to {Playfield}, subgroup {SG}',
  53083: 'Teleport to {Playfield}',
  53086: 'Refresh model',
  53087: 'Cast {NanoID} with radius {Radius}m',
  53089: '{Chance}% chance to cast {NanoID}',
  53092: 'Open bank',
  53100: 'Equip monster weapon {Item}',
  53104: 'NPC say {Message}',
  53105: 'Remove {NanoStrain} nanos <= {NCU} NCU {Times} times',
  53107: 'Run script {Script}',
  53109: 'Enter apartment',
  53110: 'Temporarily change {Stat} to {Value}',
  53115: 'Display GUI element',
  53117: 'Taunt {Amount} for {Duration}s',
  53118: 'Pacify',
  53121: 'Fear',
  53122: 'Stun',
  53124: '{Chance}% chance to spawn QL{Quality} item {Item}',
  53126: 'Wipe hate list',
  53127: 'Charm',
  53128: 'Daze',
  53130: 'Destroy item',
  53132: 'Generate name',
  53133: 'Set government type {Government}',
  53134: 'Text: {Text}',
  53137: 'Create apartment in {Playfield}',
  53138: 'Enable flight',
  53139: 'Set flag {Stat} {BitNum}',
  53140: 'Clear flag {Stat} {BitNum}',
  53142: 'Unknown',
  53144: 'Teleport to last insurance point',
  53153: 'Mezz',
  53154: 'Teleport selected player to current location',
  53155: 'Teleport team to current location',
  53162: 'Resist {NanoStrain} by {Resistance}%',
  53164: 'Save character',
  53166: 'Generate name',
  53167: 'Summon level {Level} pet for {Lifetime}s',
  53173: 'Deploy to land control area',
  53175: 'Modify {Stat} by {Amount}',
  53177: 'Reduce strain {NanoStrain} by {Duration}s',
  53178: 'Disable defensive shield',
  53181: 'Summon pets',
  53182: 'Add action: {UseItem}',
  53184: 'Modify base {Stat} {Percent}%',
  53185: 'Hit {Stat} for {MinValue} to {MaxValue} and recover {DrainAmount}%',
  53187: 'Lock perk {PerkID} for {Duration}s',
  53189: 'Update {Skill}',
  53191: '{Action}',
  53192: 'Spawn QL{Quality} {Monster} corpse',
  53193: 'Apply model {Model}',
  53196: 'Hit {Stat} for {MinValue} to {MaxValue}, checks {ModifierStat}',
  53204: 'Attractor Gfx Effect',
  53206: 'If possible, cast {NanoID}',
  53208: 'Set anchor',
  53209: 'Teleport to anchor',
  53210: 'Say {Message}',
  53213: 'Control hate',
  53220: 'Spawn QL {Quality} NPC {Spawnee}',
  53221: 'Run script {Script} with parameters {A} {B} {C}',
  53222: 'Join battlestation queue',
  53223: 'Register control point',
  53224: 'Add defensive proc {Proc} with {Chance}% chance to trigger',
  53225: 'Destroy all humans',
  53226: 'Spawn mission {Quest}',
  53227: 'Add offensive proc {Proc} with {Chance}% chance to trigger',
  53228: 'Cast {NanoID} on playfield',
  53229: 'Complete mission {Quest}',
  53230: 'Knock back within radius {Radius} with force {Power}',
  53231: 'Enable raid lock for current playfield',
  53232: 'Mind control',
  53233: 'Instanced player city',
  53234: 'Reset all perks',
  53235: 'Create city guest key for {Playfield}',
  53236: 'Remove strain {NanoStrain}',
  53237: 'Modify buffed {Stat} by {Percent}%',
  53238: 'Switch breed to {Breed} {Gender}',
  53239: 'Change gender to {Gender}',
  53240: 'Cast {NanoID} on all pets',
  53241: 'Unknown',
  53242: 'Cast {NanoID}',
  53243: 'Unknown',
  53244: 'Global message: {Message}',
  53247: '{Text}',
  53248: 'Remove cooldown, Entity={Entity} Value={Value}',
  53249: 'Transfer {Credits} credits from {TakeFrom}',
  53250: 'Delete quest {QuestId}',
  53251: 'Fail mission {Quest}',
  53252: 'Send mail',
  53253: 'End fight',
  53254: 'Try sneak on {Target}'
} as const;

// ============================================================================
// Type Definitions for All Constants
// ============================================================================

export type NPModKey = keyof typeof NP_MODS;
export type JobeSkillKey = keyof typeof JOBE_SKILL;
export type JobeModKey = keyof typeof JOBE_MODS;
export type AllSkillsType = typeof ALL_SKILLS[number];
export type ImpSlotKey = keyof typeof IMP_SLOT_INDEX;
export type ImpSlotName = typeof IMP_SLOTS[number];
export type ClusterType = keyof typeof CLUSTER_SLOTS;
export type ClusterMinQLKey = keyof typeof CLUSTER_MIN_QL;
export type BreedId = keyof typeof BREEDS;
export type BreedName = typeof BREEDS[BreedId];
export type DeckId = keyof typeof DECKS;
export type DeckName = typeof DECKS[DeckId];
export type SpecId = keyof typeof SPECS;
export type DamageTypeId = keyof typeof DAMAGE_TYPES;
export type DamageTypeName = typeof DAMAGE_TYPES[DamageTypeId];
export type SpellFormatId = keyof typeof SPELL_FORMATS;
export type SpellFormatString = typeof SPELL_FORMATS[SpellFormatId];

// ============================================================================
// IP Calculator Data - Breed and Profession Constants
// ============================================================================

/**
 * Breed ability data indexed by BREED constant IDs
 */
export const BREED_ABILITY_DATA = {
  // Initial ability values by breed [breed][ability: str, agi, sta, int, sen, psy]
  initial: {
    0: [0, 0, 0, 0, 0, 0],    // Unknown breed
    1: [6, 6, 6, 6, 6, 6],    // Solitus
    2: [3, 15, 6, 6, 10, 3],  // Opifex
    3: [3, 3, 3, 15, 6, 10],  // Nanomage
    4: [15, 6, 10, 3, 3, 3]   // Atrox
  } as Record<number, number[]>,

  // Ability caps pre-level 201 by breed [breed][ability]
  caps_pre201: {
    0: [0, 0, 0, 0, 0, 0],              // Unknown breed
    1: [472, 480, 480, 480, 480, 480],  // Solitus
    2: [464, 544, 480, 464, 512, 448],  // Opifex
    3: [464, 464, 448, 512, 480, 512],  // Nanomage
    4: [512, 480, 512, 400, 400, 400]   // Atrox
  } as Record<number, number[]>,

  // Ability increase per level post-201 by breed [breed][ability]
  caps_post201_per_level: {
    0: [0, 0, 0, 0, 0, 0],       // Unknown breed
    1: [15, 15, 15, 15, 15, 15], // Solitus
    2: [15, 20, 10, 15, 20, 15], // Opifex
    3: [10, 10, 15, 20, 15, 20], // Nanomage
    4: [20, 15, 20, 10, 10, 10]  // Atrox
  } as Record<number, number[]>,

  // Ability cost factors by breed [breed][ability]
  cost_factors: {
    0: [0, 0, 0, 0, 0, 0], // Unknown breed
    1: [2, 2, 2, 2, 2, 2], // Solitus
    2: [2, 1, 3, 2, 1, 2], // Opifex
    3: [3, 3, 2, 1, 2, 1], // Nanomage
    4: [1, 2, 1, 3, 3, 3]  // Atrox
  } as Record<number, number[]>,

  // Base HP values by breed
  base_hp: {
    0: 0,  // Unknown
    1: 10, // Solitus
    2: 15, // Opifex
    3: 10, // Nanomage
    4: 25  // Atrox
  } as Record<number, number>,

  // Base NP values by breed
  base_np: {
    0: 0,  // Unknown
    1: 10, // Solitus
    2: 10, // Opifex
    3: 15, // Nanomage
    4: 8   // Atrox
  } as Record<number, number>,

  // HP factors by breed
  body_factor: {
    0: 0, // Unknown
    1: 3, // Solitus
    2: 3, // Opifex
    3: 2, // Nanomage
    4: 4  // Atrox
  } as Record<number, number>,

  // NP factors by breed
  nano_factor: {
    0: 0, // Unknown
    1: 3, // Solitus
    2: 3, // Opifex
    3: 4, // Nanomage
    4: 2  // Atrox
  } as Record<number, number>,

  // HP level modifiers by breed
  hp_modifier: {
    0: 0,  // Unknown
    1: 0,  // Solitus
    2: -1, // Opifex
    3: -1, // Nanomage
    4: 0   // Atrox
  } as Record<number, number>,

  // NP level modifiers by breed
  np_modifier: {
    0: 0,  // Unknown
    1: 0,  // Solitus
    2: -1, // Opifex
    3: 1,  // Nanomage
    4: -2  // Atrox
  } as Record<number, number>
} as const;

/**
 * Profession HP and NP per level by title level
 * Indexed by profession ID from PROFESSION constant
 */
export const PROFESSION_VITALS = {
  // HP per level by title level [profession_id][tl1, tl2, tl3, tl4, tl5, tl6]
  hp_per_level: {
    1: [6, 7, 8, 8, 9, 9],   // Soldier
    2: [6, 7, 7, 8, 9, 12],  // MartialArtist
    3: [6, 6, 6, 6, 6, 6],   // Engineer
    4: [6, 7, 7, 8, 8, 10],  // Fixer
    5: [6, 7, 7, 8, 8, 9],   // Agent
    6: [6, 7, 8, 8, 9, 9],   // Adventurer
    7: [6, 6, 7, 7, 8, 9],   // Trader
    8: [6, 7, 7, 7, 8, 9],   // Bureaucrat
    9: [7, 8, 9, 10, 11, 12], // Enforcer
    10: [6, 6, 6, 6, 6, 6],  // Doctor
    11: [6, 6, 6, 6, 6, 6],  // NanoTechnician
    12: [6, 6, 6, 6, 6, 6],  // MetaPhysicist
    14: [6, 7, 8, 9, 10, 11], // Keeper
    15: [6, 7, 8, 9, 9, 10]  // Shade
  } as Record<number, number[]>,

  // NP per level by title level [profession_id][tl1, tl2, tl3, tl4, tl5, tl6]
  np_per_level: {
    1: [4, 4, 4, 4, 4, 4],   // Soldier
    2: [4, 4, 4, 4, 4, 4],   // MartialArtist
    3: [4, 5, 6, 7, 8, 9],   // Engineer
    4: [4, 4, 4, 4, 4, 4],   // Fixer
    5: [5, 5, 6, 6, 7, 7],   // Agent
    6: [4, 5, 5, 6, 6, 7],   // Adventurer
    7: [4, 5, 5, 5, 6, 7],   // Trader
    8: [4, 5, 5, 5, 6, 7],   // Bureaucrat
    9: [4, 4, 4, 4, 4, 4],   // Enforcer
    10: [4, 5, 6, 7, 8, 10], // Doctor
    11: [4, 5, 6, 7, 8, 10], // NanoTechnician
    12: [4, 5, 6, 7, 8, 10], // MetaPhysicist
    14: [4, 4, 4, 4, 4, 4],  // Keeper
    15: [4, 4, 4, 6, 6, 6]   // Shade
  } as Record<number, number[]>
} as const;

/**
 * Skill cost factors indexed by STAT ID and Profession ID
 * Complete data from AOSkills4 VB source (97 skills × 14 professions)
 */
export const SKILL_COST_FACTORS: Record<number, Record<number, number>> = {
  152: { // Body Dev (BodyDevelopment)
    6: 1.2,   // Adventurer
    5: 2.4,   // Agent
    8: 2.4,   // Bureaucrat
    10: 2.0,  // Doctor
    9: 1.0,   // Enforcer
    3: 2.4,   // Engineer
    4: 1.8,   // Fixer
    14: 1.2,  // Keeper
    2: 1.5,   // MartialArtist
    12: 2.4,  // MetaPhysicist
    11: 2.4,  // NanoTechnician
    15: 2.6,  // Shade
    1: 1.1,   // Soldier
    7: 2.0    // Trader
  },
  132: { // Nano Pool
    6: 1.6, 5: 1.2, 8: 1.4, 10: 1.0, 9: 2.0, 3: 1.8, 4: 1.6, 14: 2.2, 2: 1.6, 12: 1.0, 11: 1.0, 15: 2.5, 1: 2.0, 7: 1.2
  },
  100: { // Martial Arts
    6: 2.8, 5: 1.6, 8: 2.8, 10: 2.0, 9: 1.6, 3: 2.8, 4: 2.8, 14: 3.0, 2: 1.0, 12: 2.8, 11: 2.8, 15: 1.6, 1: 2.0, 7: 2.0
  },
  142: { // Brawl
    6: 2.4, 5: 2.8, 8: 3.2, 10: 2.8, 9: 1.0, 3: 2.4, 4: 1.8, 14: 2.0, 2: 1.2, 12: 2.8, 11: 2.8, 15: 4.0, 1: 2.0, 7: 2.0
  },
  144: { // Dimach
    6: 4.0, 5: 1.6, 8: 3.0, 10: 4.0, 9: 4.0, 3: 4.0, 4: 4.0, 14: 1.3, 2: 1.2, 12: 2.5, 11: 2.5, 15: 1.0, 1: 4.0, 7: 4.0
  },
  143: { // Riposte
    6: 3.2, 5: 3.0, 8: 3.2, 10: 3.2, 9: 1.2, 3: 3.2, 4: 2.4, 14: 1.0, 2: 1.0, 12: 3.2, 11: 2.4, 15: 1.4, 1: 2.4, 7: 3.2
  },
  137: { // Adventuring
    6: 1.0, 5: 3.0, 8: 2.0, 10: 2.0, 9: 1.5, 3: 2.0, 4: 2.0, 14: 1.8, 2: 1.6, 12: 2.0, 11: 2.0, 15: 1.6, 1: 1.5, 7: 1.4
  },
  138: { // Swimming
    6: 1.0, 5: 1.6, 8: 2.0, 10: 2.0, 9: 2.0, 3: 2.0, 4: 2.0, 14: 1.8, 2: 1.4, 12: 2.0, 11: 2.0, 15: 1.4, 1: 1.5, 7: 1.5
  },
  102: { // 1h Blunt
    6: 1.5, 5: 1.6, 8: 3.2, 10: 2.4, 9: 1.0, 3: 2.4, 4: 2.5, 14: 3.2, 2: 2.5, 12: 2.6, 11: 4.0, 15: 4.0, 1: 2.5, 7: 1.8
  },
  103: { // 1h Edged
    6: 1.0, 5: 2.0, 8: 4.0, 10: 2.4, 9: 1.0, 3: 3.2, 4: 2.0, 14: 3.2, 2: 2.0, 12: 4.0, 11: 4.0, 15: 4.0, 1: 2.0, 7: 3.2
  },
  106: { // Piercing
    6: 1.5, 5: 2.5, 8: 4.0, 10: 2.4, 9: 1.0, 3: 3.2, 4: 2.5, 14: 3.2, 2: 2.0, 12: 3.2, 11: 4.0, 15: 1.0, 1: 2.5, 7: 2.5
  },
  107: { // 2h Blunt
    6: 1.5, 5: 2.5, 8: 4.0, 10: 3.2, 9: 1.4, 3: 3.2, 4: 3.2, 14: 3.2, 2: 2.0, 12: 4.0, 11: 3.2, 15: 4.0, 1: 2.5, 7: 2.5
  },
  105: { // 2h Edged
    6: 1.5, 5: 2.5, 8: 4.0, 10: 3.2, 9: 1.0, 3: 3.2, 4: 2.5, 14: 1.0, 2: 2.0, 12: 2.5, 11: 2.5, 15: 4.0, 1: 2.5, 7: 2.5
  },
  104: { // Melee Energy
    6: 1.5, 5: 3.2, 8: 4.0, 10: 3.2, 9: 1.8, 3: 4.0, 4: 3.2, 14: 3.2, 2: 3.0, 12: 4.0, 11: 3.2, 15: 4.0, 1: 2.2, 7: 2.5
  },
  145: { // Parry (mapped from Deflect in VB)
    6: 1.5, 5: 1.6, 8: 3.2, 10: 2.4, 9: 1.4, 3: 4.0, 4: 2.4, 14: 1.0, 2: 1.5, 12: 4.0, 11: 3.2, 15: 1.4, 1: 2.5, 7: 2.5
  },
  146: { // Sneak Attack
    6: 1.5, 5: 1.0, 8: 2.4, 10: 3.2, 9: 2.0, 3: 4.0, 4: 3.9, 14: 4.0, 2: 3.0, 12: 4.0, 11: 3.2, 15: 1.0, 1: 3.0, 7: 4.0
  },
  101: { // Multi Melee (mapped from Mult. Melee)
    6: 1.4, 5: 2.5, 8: 4.0, 10: 3.2, 9: 1.0, 3: 4.0, 4: 2.5, 14: 3.2, 2: 2.5, 12: 4.0, 11: 4.0, 15: 1.0, 1: 2.0, 7: 3.2
  },
  147: { // Fast Attack
    6: 2.0, 5: 2.5, 8: 4.0, 10: 2.4, 9: 1.5, 3: 4.0, 4: 2.5, 14: 1.0, 2: 2.0, 12: 4.0, 11: 3.2, 15: 1.4, 1: 2.4, 7: 3.0
  },
  108: { // Sharp Objects
    6: 1.6, 5: 1.2, 8: 3.2, 10: 3.2, 9: 1.6, 3: 3.2, 4: 2.5, 14: 4.0, 2: 1.0, 12: 3.2, 11: 2.4, 15: 1.6, 1: 1.6, 7: 2.4
  },
  109: { // Grenade
    6: 1.6, 5: 1.6, 8: 4.0, 10: 3.2, 9: 2.5, 3: 2.0, 4: 2.2, 14: 4.0, 2: 2.4, 12: 4.0, 11: 2.4, 15: 4.0, 1: 1.6, 7: 2.4
  },
  110: { // Heavy Weapons
    6: 3.0, 5: 3.0, 8: 4.0, 10: 4.0, 9: 2.5, 3: 2.0, 4: 2.5, 14: 4.0, 2: 4.0, 12: 4.0, 11: 4.0, 15: 4.0, 1: 1.0, 7: 4.0
  },
  111: { // Bow
    6: 1.8, 5: 2.0, 8: 4.0, 10: 4.0, 9: 4.0, 3: 4.0, 4: 2.4, 14: 4.0, 2: 1.0, 12: 2.5, 11: 4.0, 15: 4.0, 1: 2.4, 7: 4.0
  },
  112: { // Pistol
    6: 1.0, 5: 1.8, 8: 1.6, 10: 1.6, 9: 3.0, 3: 1.5, 4: 1.6, 14: 4.0, 2: 3.5, 12: 2.4, 11: 1.6, 15: 4.0, 1: 1.0, 7: 2.0
  },
  116: { // Assault Rifle
    6: 1.6, 5: 3.0, 8: 4.0, 10: 4.0, 9: 3.5, 3: 3.0, 4: 2.8, 14: 4.0, 2: 4.0, 12: 4.0, 11: 4.5, 15: 4.0, 1: 1.0, 7: 4.0
  },
  114: { // MG/SMG
    6: 2.5, 5: 2.5, 8: 3.2, 10: 3.2, 9: 2.5, 3: 3.2, 4: 1.0, 14: 4.0, 2: 3.0, 12: 3.2, 11: 3.2, 15: 4.0, 1: 1.5, 7: 2.4
  },
  115: { // Shotgun
    6: 2.4, 5: 3.2, 8: 3.2, 10: 2.4, 9: 2.5, 3: 3.2, 4: 1.8, 14: 4.0, 2: 4.0, 12: 4.0, 11: 3.0, 15: 4.0, 1: 1.5, 7: 1.5
  },
  113: { // Rifle
    6: 1.7, 5: 1.3, 8: 4.0, 10: 4.0, 9: 4.0, 3: 4.0, 4: 2.0, 14: 4.0, 2: 4.0, 12: 4.0, 11: 4.0, 15: 4.0, 1: 2.0, 7: 2.8
  },
  133: { // Ranged Energy
    6: 2.4, 5: 2.5, 8: 4.0, 10: 4.0, 9: 4.0, 3: 3.0, 4: 2.5, 14: 4.0, 2: 4.0, 12: 4.0, 11: 4.0, 15: 4.0, 1: 1.0, 7: 3.0
  },
  150: { // Fling Shot
    6: 1.0, 5: 3.2, 8: 4.0, 10: 2.4, 9: 3.5, 3: 3.2, 4: 1.6, 14: 4.0, 2: 3.2, 12: 4.0, 11: 4.0, 15: 4.0, 1: 1.0, 7: 2.5
  },
  151: { // Aimed Shot
    6: 2.2, 5: 1.1, 8: 4.0, 10: 3.2, 9: 3.5, 3: 4.0, 4: 2.5, 14: 4.0, 2: 3.0, 12: 4.0, 11: 3.2, 15: 4.0, 1: 1.8, 7: 2.5
  },
  148: { // Burst
    6: 1.8, 5: 3.2, 8: 4.0, 10: 3.0, 9: 3.0, 3: 3.0, 4: 1.5, 14: 4.0, 2: 4.0, 12: 4.0, 11: 4.0, 15: 4.0, 1: 1.5, 7: 3.5
  },
  167: { // Full Auto
    6: 2.4, 5: 4.0, 8: 4.0, 10: 4.0, 9: 3.0, 3: 3.0, 4: 2.2, 14: 4.0, 2: 4.0, 12: 4.0, 11: 5.0, 15: 4.0, 1: 1.5, 7: 3.5
  },
  121: { // Bow Special Attack
    6: 1.6, 5: 2.0, 8: 4.0, 10: 4.0, 9: 2.0, 3: 3.5, 4: 2.0, 14: 4.0, 2: 1.0, 12: 2.5, 11: 4.0, 15: 4.0, 1: 2.0, 7: 4.0
  },
  134: { // Multi Ranged
    6: 1.5, 5: 1.8, 8: 4.0, 10: 4.0, 9: 4.0, 3: 4.0, 4: 2.0, 14: 4.0, 2: 4.0, 12: 2.5, 11: 4.0, 15: 4.0, 1: 2.0, 7: 2.5
  },
  118: { // Melee Init
    6: 1.8, 5: 1.6, 8: 4.0, 10: 3.2, 9: 1.0, 3: 3.2, 4: 2.5, 14: 1.0, 2: 2.0, 12: 3.0, 11: 3.5, 15: 1.0, 1: 2.4, 7: 3.2
  },
  119: { // Ranged Init
    6: 2.0, 5: 1.6, 8: 3.2, 10: 3.2, 9: 3.0, 3: 3.2, 4: 1.6, 14: 3.8, 2: 2.4, 12: 4.0, 11: 3.0, 15: 4.0, 1: 1.0, 7: 2.5
  },
  120: { // Physical Init
    6: 1.6, 5: 1.6, 8: 2.0, 10: 2.0, 9: 1.6, 3: 3.0, 4: 2.4, 14: 3.8, 2: 1.0, 12: 3.2, 11: 3.2, 15: 3.4, 1: 2.4, 7: 3.2
  },
  149: { // Nano Init
    6: 2.0, 5: 1.6, 8: 1.0, 10: 1.0, 9: 2.4, 3: 1.6, 4: 2.4, 14: 3.2, 2: 2.5, 12: 1.0, 11: 1.0, 15: 2.8, 1: 4.0, 7: 1.5
  },
  154: { // Dodge Ranged
    6: 1.6, 5: 2.1, 8: 2.4, 10: 2.4, 9: 2.0, 3: 2.5, 4: 1.0, 14: 1.6, 2: 1.0, 12: 1.6, 11: 2.4, 15: 2.4, 1: 1.5, 7: 1.9
  },
  155: { // Evade Close Combat
    6: 1.8, 5: 2.4, 8: 2.4, 10: 3.2, 9: 1.5, 3: 4.0, 4: 1.6, 14: 1.4, 2: 1.0, 12: 1.6, 11: 3.2, 15: 1.0, 1: 2.0, 7: 1.9
  },
  153: { // Duck Explosions
    6: 1.6, 5: 1.6, 8: 2.4, 10: 2.4, 9: 2.0, 3: 2.2, 4: 1.0, 14: 1.6, 2: 1.0, 12: 2.4, 11: 2.4, 15: 1.2, 1: 1.8, 7: 1.9
  },
  168: { // Nano Resist
    6: 2.4, 5: 1.6, 8: 1.6, 10: 1.2, 9: 2.2, 3: 1.5, 4: 1.6, 14: 1.8, 2: 1.6, 12: 1.6, 11: 1.0, 15: 1.5, 1: 2.2, 7: 1.6
  },
  156: { // Run Speed
    6: 1.0, 5: 1.6, 8: 2.4, 10: 2.4, 9: 2.4, 3: 2.0, 4: 1.0, 14: 2.0, 2: 1.0, 12: 2.4, 11: 2.4, 15: 1.0, 1: 2.0, 7: 1.9
  },
  125: { // Mechanical Engineering
    6: 1.2, 5: 1.5, 8: 1.8, 10: 2.0, 9: 2.0, 3: 1.0, 4: 1.5, 14: 3.2, 2: 2.4, 12: 2.0, 11: 2.0, 15: 3.2, 1: 2.0, 7: 1.2
  },
  126: { // Electrical Engineering
    6: 1.6, 5: 2.0, 8: 2.4, 10: 1.6, 9: 1.8, 3: 1.0, 4: 1.5, 14: 3.2, 2: 3.2, 12: 2.0, 11: 1.6, 15: 3.2, 1: 2.4, 7: 1.0
  },
  157: { // Quantum FT
    6: 1.6, 5: 2.0, 8: 2.4, 10: 1.6, 9: 3.2, 3: 1.0, 4: 1.5, 14: 3.2, 2: 3.2, 12: 2.4, 11: 1.6, 15: 1.4, 1: 2.4, 7: 1.2
  },
  158: { // Weapon Smithing
    6: 1.6, 5: 4.0, 8: 2.5, 10: 1.5, 9: 1.5, 3: 1.0, 4: 1.3, 14: 2.0, 2: 2.4, 12: 2.5, 11: 3.2, 15: 3.2, 1: 1.5, 7: 1.0
  },
  159: { // Pharmaceuticals
    6: 2.4, 5: 1.6, 8: 2.4, 10: 1.0, 9: 1.6, 3: 1.5, 4: 1.5, 14: 3.2, 2: 2.4, 12: 2.0, 11: 2.4, 15: 1.8, 1: 2.0, 7: 1.0
  },
  160: { // Nano Programming
    6: 4.0, 5: 2.4, 8: 1.6, 10: 1.6, 9: 2.4, 3: 1.2, 4: 2.0, 14: 3.2, 2: 2.4, 12: 1.0, 11: 1.0, 15: 4.0, 1: 2.0, 7: 1.4
  },
  161: { // Computer Literacy
    6: 1.6, 5: 1.6, 8: 1.0, 10: 1.0, 9: 1.6, 3: 1.3, 4: 1.0, 14: 2.4, 2: 2.0, 12: 1.0, 11: 1.0, 15: 2.4, 1: 2.0, 7: 1.5
  },
  162: { // Psychology
    6: 1.6, 5: 1.0, 8: 1.0, 10: 2.3, 9: 1.0, 3: 2.4, 4: 1.5, 14: 1.0, 2: 1.6, 12: 1.6, 11: 2.4, 15: 2.4, 1: 1.5, 7: 1.0
  },
  163: { // Chemistry
    6: 1.6, 5: 1.5, 8: 2.4, 10: 2.0, 9: 1.0, 3: 1.2, 4: 2.0, 14: 3.2, 2: 2.4, 12: 2.0, 11: 2.0, 15: 3.2, 1: 2.4, 7: 1.3
  },
  141: { // Tutoring
    6: 1.0, 5: 1.0, 8: 1.0, 10: 1.0, 9: 1.0, 3: 1.0, 4: 1.0, 14: 1.0, 2: 1.0, 12: 1.0, 11: 1.0, 15: 1.0, 1: 1.0, 7: 1.0
  },
  127: { // Material Metamorphose
    6: 1.8, 5: 1.2, 8: 1.6, 10: 1.0, 9: 2.5, 3: 1.0, 4: 2.4, 14: 3.2, 2: 2.0, 12: 1.0, 11: 1.0, 15: 3.2, 1: 2.0, 7: 1.6
  },
  128: { // Biological Metamorphose
    6: 1.5, 5: 1.6, 8: 1.0, 10: 1.0, 9: 2.5, 3: 2.4, 4: 3.2, 14: 1.8, 2: 1.6, 12: 1.0, 11: 1.0, 15: 1.9, 1: 2.4, 7: 1.8
  },
  129: { // Psychological Modification
    6: 1.8, 5: 1.6, 8: 1.0, 10: 1.6, 9: 2.5, 3: 2.4, 4: 2.4, 14: 1.6, 2: 2.0, 12: 1.6, 11: 1.0, 15: 1.4, 1: 2.0, 7: 1.5
  },
  130: { // Material Creation
    6: 1.8, 5: 1.4, 8: 1.6, 10: 1.6, 9: 2.5, 3: 1.0, 4: 2.5, 14: 3.2, 2: 2.4, 12: 1.0, 11: 1.0, 15: 3.2, 1: 2.5, 7: 1.5
  },
  131: { // Space Time
    6: 1.8, 5: 2.4, 8: 1.6, 10: 1.6, 9: 2.5, 3: 1.0, 4: 3.2, 14: 1.4, 2: 1.6, 12: 1.0, 11: 1.0, 15: 1.9, 1: 3.2, 7: 1.5
  },
  122: { // Sensory Improvement
    6: 1.6, 5: 1.6, 8: 1.0, 10: 1.6, 9: 2.5, 3: 2.4, 4: 2.4, 14: 2.4, 2: 1.6, 12: 1.6, 11: 1.0, 15: 1.6, 1: 2.4, 7: 1.8
  },
  123: { // First Aid
    6: 1.2, 5: 2.0, 8: 2.0, 10: 1.0, 9: 1.6, 3: 2.0, 4: 1.2, 14: 1.2, 2: 1.6, 12: 2.0, 11: 2.0, 15: 2.5, 1: 2.0, 7: 1.6
  },
  124: { // Treatment
    6: 1.0, 5: 2.0, 8: 2.0, 10: 1.0, 9: 2.0, 3: 1.6, 4: 1.2, 14: 1.8, 2: 2.0, 12: 2.0, 11: 2.0, 15: 1.5, 1: 2.0, 7: 1.6
  },
  164: { // Concealment
    6: 1.7, 5: 1.0, 8: 2.4, 10: 2.4, 9: 2.0, 3: 3.2, 4: 1.5, 14: 3.2, 2: 1.5, 12: 2.5, 11: 2.5, 15: 1.0, 1: 2.0, 7: 1.8
  },
  165: { // Breaking Entry
    6: 2.0, 5: 1.5, 8: 2.0, 10: 2.0, 9: 2.0, 3: 1.6, 4: 1.0, 14: 2.4, 2: 2.0, 12: 2.4, 11: 2.5, 15: 1.6, 1: 2.0, 7: 1.8
  },
  135: { // Trap Disarm
    6: 1.6, 5: 2.0, 8: 2.4, 10: 2.4, 9: 2.4, 3: 1.6, 4: 1.0, 14: 2.4, 2: 2.5, 12: 2.4, 11: 2.4, 15: 1.8, 1: 2.4, 7: 2.4
  },
  136: { // Perception
    6: 1.6, 5: 1.0, 8: 1.6, 10: 2.4, 9: 2.4, 3: 2.4, 4: 1.0, 14: 1.2, 2: 1.6, 12: 2.4, 11: 2.4, 15: 2.4, 1: 2.4, 7: 1.4
  },
  139: { // Vehicle Air
    6: 1.0, 5: 2.4, 8: 2.0, 10: 2.4, 9: 1.6, 3: 1.6, 4: 1.0, 14: 2.4, 2: 3.0, 12: 2.5, 11: 2.4, 15: 3.2, 1: 1.6, 7: 1.4
  },
  166: { // Vehicle Ground
    6: 1.0, 5: 2.4, 8: 2.4, 10: 1.6, 9: 1.0, 3: 1.6, 4: 1.0, 14: 2.4, 2: 2.5, 12: 2.5, 11: 2.4, 15: 3.2, 1: 1.0, 7: 1.4
  },
  117: { // Vehicle Water
    6: 1.0, 5: 2.4, 8: 2.4, 10: 2.4, 9: 1.6, 3: 1.6, 4: 1.0, 14: 2.4, 2: 2.5, 12: 2.5, 11: 2.4, 15: 3.2, 1: 1.6, 7: 1.4
  },
  140: { // Map Navigation
    6: 1.0, 5: 1.6, 8: 2.0, 10: 1.6, 9: 1.6, 3: 1.6, 4: 2.0, 14: 1.2, 2: 2.0, 12: 2.0, 11: 1.6, 15: 2.4, 1: 1.6, 7: 1.3
  }
} as const;

/**
 * Skill trickle-down factors indexed by STAT ID
 * Factors for how abilities contribute to skill bonuses [str, agi, sta, int, sen, psy]
 * Complete data from AOSkills4 VB source (97 skills × 6 abilities)
 */
export const SKILL_TRICKLE_DOWN: Record<number, number[]> = {
  152: [0.0, 0.0, 1.0, 0.0, 0.0, 0.0], // Body Dev → Stamina
  132: [0.0, 0.0, 0.1, 0.1, 0.1, 0.7], // Nano Pool → Mixed, heavy Psychic
  100: [0.2, 0.5, 0.0, 0.0, 0.0, 0.3], // Martial Arts → Agility/Psychic
  142: [0.6, 0.0, 0.4, 0.0, 0.0, 0.0], // Brawl → Strength/Stamina
  144: [0.0, 0.0, 0.0, 0.0, 0.8, 0.2], // Dimach → Sense/Psychic
  143: [0.0, 0.5, 0.0, 0.0, 0.5, 0.0], // Riposte → Agility/Sense
  137: [0.2, 0.5, 0.3, 0.0, 0.0, 0.0], // Adventuring → Physical stats
  138: [0.2, 0.2, 0.6, 0.0, 0.0, 0.0], // Swimming → Stamina heavy
  102: [0.5, 0.1, 0.4, 0.0, 0.0, 0.0], // 1h Blunt → Strength/Stamina
  103: [0.3, 0.4, 0.3, 0.0, 0.0, 0.0], // 1h Edged → Strength/Agility/Stamina
  106: [0.2, 0.5, 0.3, 0.0, 0.0, 0.0], // Piercing → Agility/Stamina/Strength
  107: [0.5, 0.0, 0.5, 0.0, 0.0, 0.0], // 2h Blunt → Strength/Stamina
  105: [0.6, 0.0, 0.4, 0.0, 0.0, 0.0], // 2h Edged → Strength/Stamina
  104: [0.0, 0.0, 0.5, 0.5, 0.0, 0.0], // Melee Energy → Stamina/Intelligence
  145: [0.5, 0.2, 0.0, 0.0, 0.3, 0.0], // Parry → Strength/Agility/Sense
  146: [0.0, 0.5, 0.0, 0.3, 0.2, 0.0], // Sneak Attack → Agility/Intelligence/Sense
  101: [0.3, 0.6, 0.1, 0.0, 0.0, 0.0], // Multi Melee → Agility/Strength
  147: [0.0, 0.6, 0.0, 0.0, 0.4, 0.0], // Fast Attack → Agility/Sense
  108: [0.2, 0.6, 0.0, 0.0, 0.2, 0.0], // Sharp Objects → Agility/Strength/Sense
  109: [0.0, 0.4, 0.0, 0.2, 0.4, 0.0], // Grenade → Agility/Intelligence/Sense
  110: [0.4, 0.6, 0.0, 0.0, 0.0, 0.0], // Heavy Weapons → Agility/Strength
  111: [0.2, 0.4, 0.0, 0.0, 0.4, 0.0], // Bow → Agility/Strength/Sense
  112: [0.0, 0.6, 0.0, 0.0, 0.4, 0.0], // Pistol → Agility/Sense
  116: [0.1, 0.3, 0.4, 0.0, 0.2, 0.0], // Assault Rifle → Mixed physical
  114: [0.3, 0.3, 0.3, 0.0, 0.1, 0.0], // MG/SMG → Physical stats
  115: [0.4, 0.6, 0.0, 0.0, 0.0, 0.0], // Shotgun → Agility/Strength
  113: [0.0, 0.6, 0.0, 0.0, 0.4, 0.0], // Rifle → Agility/Sense
  133: [0.0, 0.0, 0.0, 0.2, 0.4, 0.4], // Ranged Energy → Intelligence/Sense/Psychic
  150: [0.0, 1.0, 0.0, 0.0, 0.0, 0.0], // Fling Shot → Agility
  151: [0.0, 0.0, 0.0, 0.0, 1.0, 0.0], // Aimed Shot → Sense
  148: [0.3, 0.5, 0.2, 0.0, 0.0, 0.0], // Burst → Physical stats
  167: [0.6, 0.0, 0.4, 0.0, 0.0, 0.0], // Full Auto → Strength/Stamina
  121: [0.1, 0.5, 0.0, 0.0, 0.4, 0.0], // Bow Special Attack → Agility/Sense
  134: [0.0, 0.6, 0.0, 0.4, 0.0, 0.0], // Multi Ranged → Agility/Intelligence
  118: [0.0, 0.1, 0.0, 0.1, 0.6, 0.2], // Melee Init → Sense/Psychic
  119: [0.0, 0.1, 0.0, 0.1, 0.6, 0.2], // Ranged Init → Sense/Psychic
  120: [0.0, 0.1, 0.0, 0.1, 0.6, 0.2], // Physical Init → Sense/Psychic
  149: [0.0, 0.4, 0.0, 0.0, 0.6, 0.0], // Nano Init → Sense/Agility
  154: [0.0, 0.5, 0.0, 0.2, 0.3, 0.0], // Dodge Ranged → Agility/Intelligence/Sense
  155: [0.0, 0.5, 0.0, 0.2, 0.3, 0.0], // Evade Close → Agility/Intelligence/Sense
  153: [0.0, 0.5, 0.0, 0.2, 0.3, 0.0], // Duck Explosions → Agility/Intelligence/Sense
  168: [0.0, 0.0, 0.0, 0.2, 0.0, 0.8], // Nano Resist → Intelligence/Psychic
  156: [0.2, 0.4, 0.4, 0.0, 0.1, 0.0], // Run Speed → Physical stats
  125: [0.0, 0.5, 0.0, 0.5, 0.0, 0.0], // Mechanical Engineering → Agility/Intelligence
  126: [0.0, 0.3, 0.2, 0.5, 0.0, 0.0], // Electrical Engineering → Mixed
  157: [0.0, 0.0, 0.0, 0.5, 0.0, 0.5], // Quantum FT → Intelligence/Psychic
  158: [0.5, 0.0, 0.0, 0.5, 0.0, 0.0], // Weapon Smithing → Strength/Intelligence
  159: [0.0, 0.2, 0.0, 0.8, 0.0, 0.0], // Pharmaceuticals → Intelligence/Agility
  160: [0.0, 0.0, 0.0, 1.0, 0.0, 0.0], // Nano Programming → Intelligence
  161: [0.0, 0.0, 0.0, 1.0, 0.0, 0.0], // Computer Literacy → Intelligence
  162: [0.0, 0.0, 0.0, 0.5, 0.5, 0.0], // Psychology → Intelligence/Sense
  163: [0.0, 0.0, 0.5, 0.5, 0.0, 0.0], // Chemistry → Stamina/Intelligence
  141: [0.0, 0.0, 0.0, 0.7, 0.2, 0.1], // Tutoring → Intelligence/Sense/Psychic
  127: [0.0, 0.0, 0.0, 0.8, 0.0, 0.2], // Material Metamorphose → Intelligence/Psychic
  128: [0.0, 0.0, 0.0, 0.8, 0.0, 0.2], // Biological Metamorphose → Intelligence/Psychic
  129: [0.0, 0.0, 0.0, 0.8, 0.2, 0.0], // Psychological Modification → Intelligence/Sense
  130: [0.0, 0.0, 0.2, 0.8, 0.0, 0.0], // Material Creation → Intelligence/Stamina
  131: [0.0, 0.2, 0.0, 0.8, 0.0, 0.0], // Space Time → Intelligence/Agility
  122: [0.2, 0.0, 0.0, 0.8, 0.0, 0.0], // Sensory Improvement → Intelligence/Strength
  123: [0.0, 0.3, 0.0, 0.3, 0.4, 0.0], // First Aid → Mixed
  124: [0.0, 0.3, 0.0, 0.5, 0.2, 0.0], // Treatment → Intelligence/Agility/Sense
  164: [0.0, 0.3, 0.0, 0.0, 0.7, 0.0], // Concealment → Sense/Agility
  165: [0.0, 0.4, 0.0, 0.0, 0.3, 0.3], // Breaking Entry → Agility/Sense/Psychic
  135: [0.0, 0.2, 0.0, 0.2, 0.6, 0.0], // Trap Disarm → Sense/Agility/Intelligence
  136: [0.0, 0.0, 0.0, 0.3, 0.7, 0.0], // Perception → Sense/Intelligence
  139: [0.0, 0.2, 0.0, 0.2, 0.6, 0.0], // Vehicle Air → Sense/Agility/Intelligence
  166: [0.0, 0.2, 0.0, 0.2, 0.6, 0.0], // Vehicle Ground → Sense/Agility/Intelligence
  117: [0.0, 0.2, 0.0, 0.2, 0.6, 0.0], // Vehicle Water → Sense/Agility/Intelligence
  140: [0.0, 0.0, 0.0, 0.4, 0.5, 0.1]  // Map Navigation → Intelligence/Sense/Psychic
} as const;