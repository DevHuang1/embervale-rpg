// Moss & Candlewax design reminder: React is a quiet picture frame; the lantern-lit Babylon diorama is the experience.

import { useCallback, useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";
import { createInitialGameState, type GameState, type ItemId, type SkillId } from "@/game/types";
import GameOverlay from "@/components/GameOverlay";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  const handleRef = useRef<GameHandle | null>(null);
  const demoMode = new URLSearchParams(window.location.search).has("demo");
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState());
  const [introOpen, setIntroOpen] = useState(!demoMode);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });
    let disposed = false;

    createGameScene(engine, canvas, (state) => {
      if (!disposed) setGameState(state);
    }).then((handle) => {
      if (disposed) {
        handle.dispose();
        return;
      }
      handleRef.current = handle;
      engine.runRenderLoop(() => handle.scene.render());
    });

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      handleRef.current?.dispose();
      handleRef.current = null;
      engine.dispose();
      startedRef.current = false;
    };
  }, []);

  const onRestart = useCallback(() => {
    setIntroOpen(false);
    handleRef.current?.restart();
  }, []);
  const onMapClick = useCallback((normalizedX: number, normalizedY: number) => {
    handleRef.current?.moveToMapPoint(normalizedX, normalizedY);
  }, []);
  const onEnemyClick = useCallback(() => handleRef.current?.engageEnemy(), []);
  const onUseItem = useCallback((itemId: ItemId) => handleRef.current?.useInventoryItem(itemId), []);
  const onUseSkill = useCallback((skillId: SkillId) => handleRef.current?.useSkill(skillId), []);

  return (
    <main className="game-shell">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Embervale playable forest scene" style={{ touchAction: "none" }} />
      <GameOverlay
        state={gameState}
        introOpen={introOpen}
        demoMode={demoMode}
        onBegin={() => setIntroOpen(false)}
        onMapClick={onMapClick}
        onEnemyClick={onEnemyClick}
        onUseItem={onUseItem}
        onUseSkill={onUseSkill}
        onRestart={onRestart}
      />
    </main>
  );
}
