// Moss & Candlewax design reminder: progression should feel like a compact field kit—warm, tactile, and immediately legible.

export type QuestStage = "seekSprite" | "claimShard" | "lightBeacon" | "complete";
export type CombatState = "exploring" | "combat" | "victory" | "defeated";
export type ItemId = "moss-tonic" | "hushling-thorn" | "ember-shard";
export type ItemKind = "consumable" | "relic" | "quest";
export type SkillId = "cinder-lash" | "mend-flame";

export interface InventoryItem {
  id: ItemId;
  name: string;
  kind: ItemKind;
  quantity: number;
  description: string;
  useLabel?: string;
}

export interface ClassSkill {
  id: SkillId;
  name: string;
  shortName: string;
  description: string;
  cooldown: number;
  accent: "amber" | "moss";
}

export const classSkills: ClassSkill[] = [
  {
    id: "cinder-lash",
    name: "Cinder Lash",
    shortName: "Lash",
    description: "Snap a bright arc through a locked target for 16 damage.",
    cooldown: 6,
    accent: "amber",
  },
  {
    id: "mend-flame",
    name: "Mend Flame",
    shortName: "Mend",
    description: "Mend 10 warmth from the lantern’s steady core.",
    cooldown: 9,
    accent: "moss",
  },
];

export interface GameState {
  hp: number;
  maxHp: number;
  enemyHp: number;
  maxEnemyHp: number;
  level: number;
  xp: number;
  stage: QuestStage;
  combatState: CombatState;
  log: string;
  shardCollected: boolean;
  beaconLit: boolean;
  playerClass: string;
  classPassive: string;
  skillCooldowns: Record<SkillId, number>;
  inventory: InventoryItem[];
  lootNotice: string | null;
}

export const createInitialGameState = (): GameState => ({
  hp: 34,
  maxHp: 34,
  enemyHp: 28,
  maxEnemyHp: 28,
  level: 1,
  xp: 0,
  stage: "seekSprite",
  combatState: "exploring",
  log: "The old path hums beneath your boots.",
  shardCollected: false,
  beaconLit: false,
  playerClass: "Cinder Warden",
  classPassive: "Every third auto-strike blooms with 4 bonus ember damage.",
  skillCooldowns: { "cinder-lash": 0, "mend-flame": 0 },
  inventory: [
    { id: "moss-tonic", name: "Moss Tonic", kind: "consumable", quantity: 1, description: "A cool green draft that restores 12 warmth.", useLabel: "Drink" },
    { id: "hushling-thorn", name: "Hushling Thorn", kind: "relic", quantity: 0, description: "A cold bramble trophy. It hums near old magic." },
    { id: "ember-shard", name: "Ember Shard", kind: "quest", quantity: 0, description: "A lost fragment needed to awaken the grove beacon." },
  ],
  lootNotice: null,
});

export const initialGameState = createInitialGameState();

export const questCopy: Record<QuestStage, { chapter: string; title: string; instruction: string }> = {
  seekSprite: {
    chapter: "I. The Quiet Grove",
    title: "Find the Hushling",
    instruction: "Follow the pale path until the bramble sprite stirs.",
  },
  claimShard: {
    chapter: "II. A Warm Fragment",
    title: "Claim the Ember Shard",
    instruction: "The light it dropped is close. Gather it before the mist takes it.",
  },
  lightBeacon: {
    chapter: "III. The Way Back",
    title: "Restore the Beacon",
    instruction: "Carry the Ember Shard to the ruined altar in the north-east grove.",
  },
  complete: {
    chapter: "IV. A Path Relit",
    title: "The Grove Remembers",
    instruction: "The old road will hold its warmth until the next traveler comes through.",
  },
};
