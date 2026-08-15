# Embervale — Production Plan

## Player-Facing Goal

Complete a short RPG quest: travel through Whispergrove, defeat or evade a corrupted sprite, collect the Ember Shard, and light the ruined beacon.

## Core Loop

| Step | Player action | Visible outcome |
|---|---|---|
| Explore | Move with WASD/arrows or touch controls | Lantern-bearer crosses the grove toward the beacon |
| Encounter | Enter a sprite’s proximity | Tactical action panel opens with enemy intent |
| Decide | Strike, Guard, or Mend | Enemy/player health changes and log confirms the turn |
| Progress | Win the encounter and reach Ember Shard | Quest changes to return to the beacon |
| Resolve | Reach beacon with shard | Beacon lights, victory card appears, restart is offered |

## Risk Slices

| Risk | Mitigation | Verification |
|---|---|---|
| React/Babylon lifecycle | Use a guarded full-screen canvas component and explicit disposal | Navigate/reload without duplicate canvas or console error |
| Isometric gameplay readability | Use generated art as a visual target plus simple procedural geometry with layered lighting | Screenshot visibly distinguishes player, enemy, shrine, paths, and quest target |
| Keyboard and touch playability | Support keyboard, on-screen directional controls, and action buttons | Both input styles move/act in preview |
| Combat state clarity | Lock movement during combat; action panel and combat log reflect every turn | Screenshot and manual test reveal current turn and result |
| Deterministic verification | Add `?demo` autopilot showcasing encounter and restoration | Screenshot with `?demo` captures active game state |

## Acceptance Criteria

- The game launches directly into a full-screen, original fantasy RPG scene, using the generated world illustration in the quest ledger, a generated lantern knot as brand mark, and original illustrated portraits in the HUD and encounter card.
- A player can move through a compact 3D forest map with keyboard and touch controls.
- At least one combat encounter supports Strike, Guard, and Mend.
- The player can obtain an Ember Shard and relight the beacon to complete the quest.
- HUD shows health, quest state, controls, and a readable combat/action surface.
- `?demo` drives a deterministic walkthrough for visual checks.
- Type checking passes and the representative screenshots have no obvious visual regressions.
