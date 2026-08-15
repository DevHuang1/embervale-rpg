# Embervale — Technical Structure

React supplies the full-screen shell. Babylon owns the canvas, scene, camera, meshes, lighting, input, and game loop. Gameplay is framework-independent TypeScript under `client/src/game/`.

| Module | Responsibility |
|---|---|
| `components/GameCanvas.tsx` | Owns the canvas lifecycle, one-time engine initialization, resize behavior, and cleanup |
| `game/scene.ts` | Creates the Babylon scene and returns the game handle |
| `game/GameWorld.ts` | Builds the diorama, cursor commands, auto-combat, loot drops, inventory effects, class skills, and quest progression |
| `game/types.ts` | Shares game state plus inventory and Cinder Warden class-skill definitions |
| `game/palette.ts` | Holds the intentional Moss & Candlewax material colors |
| `components/GameOverlay.tsx` | Renders the branded HUD, satchel inventory, class skill kit, loot feedback, combat status, quest log, and title intro |
| `pages/Home.tsx` | Composes canvas and overlay; state is driven through a small event bridge |

## Data Model

```text
QuestStage = seekSprite | claimShard | lightBeacon | complete
CombatState = exploring | combat | victory | defeated
InventoryItem = consumable | relic | quest item with quantity and description
ClassSkill = Cinder Lash | Mend Flame with independent cooldowns
GameState = { hp, enemyHp, level, xp, stage, combatState, inventory, playerClass, classPassive, skillCooldowns, lootNotice }
```

## Scene Composition

The scene uses a top-down orthographic-like ArcRotate camera, procedural low-poly terrain, cylinder trunks, foliage clusters, warm point lights, a large generated art reference texture on the quest board, and fog. The hero and sprite are composed of simple meshes with glowing accents for consistent fidelity and performance.
