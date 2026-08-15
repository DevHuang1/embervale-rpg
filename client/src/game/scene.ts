// Moss & Candlewax design reminder: React frames the canvas; this module owns the scene and releases every listener on disposal.

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { GameWorld } from "@/game/GameWorld";
import type { GameState, MoveIntent, PlayerAction } from "@/game/types";

export type GameHandle = {
  scene: Scene;
  performAction: (action: PlayerAction) => void;
  setMoveIntent: (intent: MoveIntent, active: boolean) => void;
  restart: () => void;
  dispose: () => void;
};

export async function createGameScene(
  engine: Engine,
  canvas: HTMLCanvasElement,
  onStateChange: (state: GameState) => void,
): Promise<GameHandle> {
  const scene = new Scene(engine);
  const world = new GameWorld({
    scene,
    canvas,
    onStateChange,
    demoMode: new URLSearchParams(window.location.search).has("demo"),
  });

  scene.onBeforeRenderObservable.add(() => {
    world.update(scene.getEngine().getDeltaTime() / 1000);
  });

  return {
    scene,
    performAction: (action) => world.performAction(action),
    setMoveIntent: (intent, active) => world.setMoveIntent(intent, active),
    restart: () => world.restart(),
    dispose: () => {
      world.dispose();
      scene.dispose();
    },
  };
}
