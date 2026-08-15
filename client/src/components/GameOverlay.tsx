// Moss & Candlewax design reminder: an engraved brass-and-parchment HUD should frame, never cover, the living diorama.

import { useMemo, type PointerEvent } from "react";
import { ASSETS } from "@/game/assets";
import { questCopy, type GameState } from "@/game/types";

type GameOverlayProps = {
  state: GameState;
  introOpen: boolean;
  demoMode: boolean;
  onBegin: () => void;
  onMapClick: (normalizedX: number, normalizedY: number) => void;
  onEnemyClick: () => void;
  onRestart: () => void;
};

const healthPercent = (value: number, max: number) => `${Math.max(0, Math.round((value / max) * 100))}%`;

export default function GameOverlay({ state, introOpen, demoMode, onBegin, onMapClick, onEnemyClick, onRestart }: GameOverlayProps) {
  const quest = questCopy[state.stage];
  const combatLabel = useMemo(() => state.combatState === "combat" ? "Auto-strike engaged" : "Lantern bearer", [state.combatState]);
  const handleMapPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    onMapClick((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
  };

  return (
    <div className="game-overlay" aria-live="polite">
      {!introOpen && state.combatState !== "defeated" && state.stage !== "complete" && (
        <div className="map-command-layer" onPointerDown={handleMapPointer} aria-label="Click the grove to walk">
          {state.stage === "seekSprite" && <button className="enemy-hit-area" type="button" aria-label="Target the Hushling for automatic attacks" onPointerDown={(event) => { event.stopPropagation(); onEnemyClick(); }} />}
        </div>
      )}
      <header className="hud-brand hud-interactive">
        <img className="brand-knot" src={ASSETS.logo} alt="Embervale lantern knot" />
        <div>
          <p className="brand-eyebrow">A pocket tale</p>
          <h1>Embervale</h1>
        </div>
        {demoMode && <span className="demo-ribbon">Autoplaying tale</span>}
      </header>

      <aside className="quest-ledger hud-interactive">
        <div className="ledger-tacks"><span /><span /></div>
        <p className="ledger-chapter">{quest.chapter}</p>
        <h2>{quest.title}</h2>
        <p className="ledger-copy">{quest.instruction}</p>
        <div className="quest-art" style={{ backgroundImage: `linear-gradient(90deg, rgba(11,24,20,.94) 0%, rgba(11,24,20,.4) 57%, rgba(11,24,20,.08) 100%), url(${ASSETS.worldReference})` }} />
        <div className="ledger-rule" />
        <div className="ledger-meta">
          <span>Lantern level</span>
          <strong>0{state.level}</strong>
          <span>Ember marks</span>
          <strong>{state.xp.toString().padStart(2, "0")}</strong>
        </div>
      </aside>

      <section className="hero-status hud-interactive" aria-label="Lantern bearer status">
        <div className="portrait-frame">
          <img src={ASSETS.heroPortrait} alt="Elian, the lantern bearer" />
        </div>
        <div className="status-copy">
          <span className="status-name">Elian of the Old Road</span>
          <div className="bar-label"><span>Warmth</span><b>{state.hp}/{state.maxHp}</b></div>
          <div className="health-track"><span className="health-fill" style={{ width: healthPercent(state.hp, state.maxHp) }} /></div>
        </div>
        <span className="lantern-gem" aria-hidden="true" />
      </section>

      <section className="field-note hud-interactive">
        <span className="wax-mark">✦</span>
        <p>{state.log}</p>
      </section>

      {state.combatState === "combat" && (
        <section className="encounter-card hud-interactive" aria-label="Combat choices">
          <div className="encounter-head">
            <div className="enemy-portrait"><img src={ASSETS.spritePortrait} alt="The Hushling" /></div>
            <div>
              <p>Wild encounter</p>
              <h2>The Hushling</h2>
              <div className="bar-label enemy-label"><span>Shadow knot</span><b>{state.enemyHp}/{state.maxEnemyHp}</b></div>
              <div className="health-track enemy-track"><span className="health-fill enemy-fill" style={{ width: healthPercent(state.enemyHp, state.maxEnemyHp) }} /></div>
            </div>
          </div>
          <div className="turn-stamp"><span>{combatLabel}</span><i /></div>
          <div className="auto-strike-status"><span className="auto-sigil">✦</span><span><b>Target locked</b><small>Elian closes in and strikes as soon as the Hushling is within reach.</small></span></div>
        </section>
      )}

      {state.combatState === "defeated" && (
        <section className="story-modal hud-interactive">
          <p className="ledger-chapter">The mist settles</p>
          <h2>Keep the lantern close.</h2>
          <p>A brave path can be walked again. This time, let the flame answer first.</p>
          <button className="scribe-button" onClick={onRestart}>Return to the old road</button>
        </section>
      )}

      {state.stage === "complete" && (
        <section className="story-modal victory-modal hud-interactive">
          <p className="ledger-chapter">Beacon restored</p>
          <h2>The way remembers you.</h2>
          <p>The Ember Shard sings from the altar. Beyond the grove, another small tale is waiting.</p>
          <button className="scribe-button" onClick={onRestart}>Walk the path once more</button>
        </section>
      )}

      <footer className="control-strip hud-interactive">
        <span><b>Click the grove</b> to walk</span><i />
        <span><b>Click the Hushling</b> to chase and strike</span><i />
        <span>Carry the glow close.</span>
      </footer>

      {introOpen && (
        <section className="title-card hud-interactive">
          <div className="title-art" style={{ backgroundImage: `linear-gradient(90deg, rgba(10,25,18,.96) 10%, rgba(10,25,18,.78) 43%, rgba(10,25,18,.04) 100%), url(${ASSETS.worldReference})` }} />
          <div className="title-copy">
            <img className="title-knot" src={ASSETS.logo} alt="" />
            <p className="ledger-chapter">A lantern-bearer’s brief tale</p>
            <h2>The Lantern Path</h2>
            <p>Whispergrove’s beacon has gone dim. Carry your flame through the hush, gather its lost ember, and make the old road warm again.</p>
            <button className="scribe-button" onClick={onBegin}>Carry the flame <span>→</span></button>
          </div>
        </section>
      )}
    </div>
  );
}
