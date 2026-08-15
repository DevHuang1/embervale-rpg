// Moss & Candlewax design reminder: all gameplay states should spotlight a compact, hopeful lantern quest.

export type QuestStage = "seekSprite" | "claimShard" | "lightBeacon" | "complete";
export type CombatState = "exploring" | "combat" | "victory" | "defeated";
export type PlayerAction = "strike" | "guard" | "mend";
export type MoveIntent = "up" | "down" | "left" | "right";

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
}

export const initialGameState: GameState = {
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
};

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
