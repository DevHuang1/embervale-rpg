// Moss & Candlewax design reminder: inventory and class tools are a field kit—small, hand-inked, and arranged around the living grove.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ASSETS } from "@/game/assets";
import { playLootSound, playSatchelSound, prepareInterfaceAudio } from "@/game/sound";
import { classSkills, questCopy, type GameState, type ItemId, type SkillId } from "@/game/types";

type GameOverlayProps = {
  state: GameState;
  introOpen: boolean;
  demoMode: boolean;
  onBegin: () => void;
  onMapClick: (normalizedX: number, normalizedY: number) => void;
  onEnemyClick: () => void;
  onUseItem: (itemId: ItemId) => void;
  onUseSkill: (skillId: SkillId) => void;
  onRestart: () => void;
};

const healthPercent = (value: number, max: number) => `${Math.max(0, Math.round((value / max) * 100))}%`;
const cooldownCopy = (seconds: number) => seconds > 0 ? `${Math.ceil(seconds)}s` : "Ready";

export default function GameOverlay({ state, introOpen, demoMode, onBegin, onMapClick, onEnemyClick, onUseItem, onUseSkill, onRestart }: GameOverlayProps) {
  const quest = questCopy[state.stage];
  const combatLabel = useMemo(() => state.combatState === "combat" ? "Auto-strike engaged" : "Lantern bearer", [state.combatState]);
  const itemCount = state.inventory.reduce((total, item) => total + item.quantity, 0);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [showLoot, setShowLoot] = useState(false);
  const [tooltipItem, setTooltipItem] = useState<ItemId | null>(null);
  const inventoryOpenRef = useRef(false);
  const minimapPoint = useCallback((x: number, z: number) => ({
    left: `${Math.max(5, Math.min(95, ((x + 22) / 44) * 100))}%`,
    top: `${Math.max(7, Math.min(93, ((z + 16) / 32) * 100))}%`,
  }) as CSSProperties, []);
  const playerMapStyle = useMemo(() => minimapPoint(state.playerPosition.x, state.playerPosition.z), [minimapPoint, state.playerPosition]);
  const hushlingMapStyle = useMemo(() => minimapPoint(-6.4, 3.15), [minimapPoint]);
  const shardMapStyle = useMemo(() => minimapPoint(1.25, -4.1), [minimapPoint]);
  const beaconMapStyle = useMemo(() => minimapPoint(14.2, -10.4), [minimapPoint]);
  const handleMapPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    onMapClick((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
  };
  const toggleInventory = useCallback(() => {
    const next = !inventoryOpenRef.current;
    inventoryOpenRef.current = next;
    setInventoryOpen(next);
    playSatchelSound(next);
  }, []);
  const closeInventory = useCallback(() => {
    if (!inventoryOpenRef.current) return;
    inventoryOpenRef.current = false;
    setInventoryOpen(false);
    playSatchelSound(false);
  }, []);
  useEffect(() => {
    const unlock = () => prepareInterfaceAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  useEffect(() => {
    if (!state.lootNotice) return;
    setShowLoot(true);
    playLootSound();
    const timeout = window.setTimeout(() => setShowLoot(false), 2800);
    return () => window.clearTimeout(timeout);
  }, [state.lootNotice, state.lootPulse]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        toggleInventory();
      }
      if (event.key === "Escape") closeInventory();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [closeInventory, toggleInventory]);

  return (
    <div className="game-overlay" aria-live="polite">
      {!introOpen && state.combatState !== "defeated" && state.stage !== "complete" && (
        <div className="map-command-layer" onPointerDown={handleMapPointer} aria-label="Click the grove to walk">
          {state.stage === "seekSprite" && <button className="enemy-hit-area" type="button" aria-label="Target the Hushling for automatic attacks" onPointerDown={(event) => { event.stopPropagation(); onEnemyClick(); }} />}
        </div>
      )}

      <header className="hud-brand hud-interactive">
        <img className="brand-knot" src={ASSETS.logo} alt="Embervale lantern knot" />
        <div><p className="brand-eyebrow">A pocket tale</p><h1>Embervale</h1></div>
        {demoMode && <span className="demo-ribbon">Autoplaying tale</span>}
      </header>

      <aside className="quest-ledger hud-interactive">
        <div className="ledger-tacks"><span /><span /></div>
        <p className="ledger-chapter">{quest.chapter}</p><h2>{quest.title}</h2><p className="ledger-copy">{quest.instruction}</p>
        <div className="quest-art" style={{ backgroundImage: `linear-gradient(90deg, rgba(11,24,20,.94) 0%, rgba(11,24,20,.4) 57%, rgba(11,24,20,.08) 100%), url(${ASSETS.worldReference})` }} />
        <div className="ledger-rule" />
        <div className="ledger-meta"><span>Lantern level</span><strong>0{state.level}</strong><span>Ember marks</span><strong>{state.xp.toString().padStart(2, "0")}</strong></div>
      </aside>

      <section className="player-overlay hud-interactive" aria-label="Player status">
        <div className="overlay-health"><span className="overlay-sigil">✦</span><div><div className="overlay-label"><span>Warmth</span><b>{state.hp}/{state.maxHp}</b></div><div className="health-track"><span className="health-fill" style={{ width: healthPercent(state.hp, state.maxHp) }} /></div></div></div>
        <div className="overlay-class"><span>Class</span><b>{state.playerClass}</b><em>Lv. {state.level}</em></div>
        <button className="inventory-trigger" type="button" aria-expanded={inventoryOpen} aria-controls="inventory-drawer" onPointerDown={(event) => event.stopPropagation()} onClick={toggleInventory}><span>Satchel <kbd>I</kbd></span><b>{itemCount}</b><i>{inventoryOpen ? "−" : "+"}</i></button>
      </section>

      <section className="minimap-control hud-interactive" aria-label="Forest minimap controls">
        <button className="minimap-toggle" type="button" aria-expanded={minimapOpen} aria-controls="forest-minimap" onPointerDown={(event) => event.stopPropagation()} onClick={() => setMinimapOpen((open) => !open)}><span>Grove map</span><i>{minimapOpen ? "−" : "+"}</i></button>
        {minimapOpen && <aside className="forest-minimap" id="forest-minimap" aria-label="Whispergrove minimap"><div className="map-header"><span>Whispergrove expanse</span><b>{quest.chapter}</b></div><div className="map-field"><i className="map-path path-a" /><i className="map-path path-b" /><span className="map-marker player" style={playerMapStyle}>✦<em>You</em></span><span className={`map-marker hushling ${state.stage === "seekSprite" ? "active" : ""}`} style={hushlingMapStyle}>◌<em>Hushling</em></span><span className={`map-marker shard ${state.stage === "claimShard" ? "active" : ""}`} style={shardMapStyle}>◆<em>Ember</em></span><span className={`map-marker beacon ${state.stage === "lightBeacon" ? "active" : ""}`} style={beaconMapStyle}>✦<em>Beacon</em></span></div><p>Explore the wide grove; Elian’s lantern tracks every step.</p></aside>}
      </section>

      {inventoryOpen && <section className="inventory-drawer hud-interactive" id="inventory-drawer" aria-label="Satchel inventory">
        <header className="drawer-heading"><div><span>Field satchel</span><b>{itemCount} items carried</b></div><button type="button" aria-label="Close inventory" onPointerDown={(event) => event.stopPropagation()} onClick={closeInventory}>×</button></header>
        <div className="inventory-grid">
          {state.inventory.map((item) => {
            const usable = item.kind === "consumable" && item.quantity > 0;
            return <div key={item.id} className="inventory-item-wrap" onMouseEnter={() => setTooltipItem(item.id)} onMouseLeave={() => setTooltipItem(null)} onFocus={() => setTooltipItem(item.id)} onBlur={() => setTooltipItem(null)}>
              <button className={`inventory-item ${item.kind} ${usable ? "usable" : ""}`} disabled={!usable} onPointerDown={(event) => event.stopPropagation()} onClick={() => usable && onUseItem(item.id)}>
                <span className="item-sigil">{item.id === "moss-tonic" ? "✦" : item.id === "hushling-thorn" ? "⌁" : "◆"}</span>
                <span className="item-details"><b>{item.name}</b><small>{item.rarity} · {item.kind}</small></span>
                <span className="item-quantity">×{item.quantity}</span>{usable && <em>{item.useLabel}</em>}
              </button>
              {tooltipItem === item.id && <aside className={`item-tooltip ${item.rarity.toLowerCase()}`} role="tooltip"><span>{item.rarity} {item.kind}</span><b>{item.name}</b><p>{item.description}</p><ul>{item.stats.map((stat) => <li key={stat}>{stat}</li>)}</ul></aside>}
            </div>;
          })}
        </div>
        <div className="drawer-class"><span>Active class · {state.playerClass}</span><small>{state.classPassive}</small></div>
        <div className="skill-row">
          {classSkills.map((skill) => {
            const cooldown = state.skillCooldowns[skill.id];
            return <button key={skill.id} className={`skill-button ${skill.accent}`} disabled={cooldown > 0} onPointerDown={(event) => event.stopPropagation()} onClick={() => onUseSkill(skill.id)}><span className="skill-rune">{skill.id === "cinder-lash" ? "✦" : "✚"}</span><span><b>{skill.shortName}</b><small>{cooldownCopy(cooldown)}</small></span></button>;
          })}
        </div>
      </section>}

      {showLoot && state.lootNotice && <section key={state.lootPulse} className="loot-counter hud-interactive" aria-live="polite"><span className="loot-count">+{state.lootCount}</span><div><b>Loot secured</b><p>{state.lootNotice}</p></div><i>✦</i></section>}
      <section className="field-note hud-interactive"><span className="wax-mark">✦</span><p>{state.log}</p></section>

      {state.combatState === "combat" && <section className="encounter-card hud-interactive" aria-label="Automatic combat status"><div className="encounter-head"><div className="enemy-portrait"><img src={ASSETS.spritePortrait} alt="The Hushling" /></div><div><p>Wild encounter</p><h2>The Hushling</h2><div className="bar-label enemy-label"><span>Shadow knot</span><b>{state.enemyHp}/{state.maxEnemyHp}</b></div><div className="health-track enemy-track"><span className="health-fill enemy-fill" style={{ width: healthPercent(state.enemyHp, state.maxEnemyHp) }} /></div></div></div><div className="turn-stamp"><span>{combatLabel}</span><i /></div><div className="auto-strike-status"><span className="auto-sigil">✦</span><span><b>Target locked</b><small>Elian closes in and strikes as soon as the Hushling is within reach.</small></span></div></section>}

      {state.combatState === "defeated" && <section className="story-modal hud-interactive"><p className="ledger-chapter">The mist settles</p><h2>Keep the lantern close.</h2><p>A brave path can be walked again. This time, let the flame answer first.</p><button className="scribe-button" onClick={onRestart}>Return to the old road</button></section>}
      {state.stage === "complete" && <section className="story-modal victory-modal hud-interactive"><p className="ledger-chapter">Beacon restored</p><h2>The way remembers you.</h2><p>The Ember Shard sings from the altar. Beyond the grove, another small tale is waiting.</p><button className="scribe-button" onClick={onRestart}>Walk the path once more</button></section>}
      <footer className="control-strip hud-interactive"><span><b>Click the grove</b> to walk</span><i /><span><b>Click the Hushling</b> to chase and strike</span><i /><span>Guard the glow.</span></footer>
      {introOpen && <section className="title-card hud-interactive"><div className="title-art" style={{ backgroundImage: `linear-gradient(90deg, rgba(10,25,18,.96) 10%, rgba(10,25,18,.78) 43%, rgba(10,25,18,.04) 100%), url(${ASSETS.worldReference})` }} /><div className="title-copy"><img className="title-knot" src={ASSETS.logo} alt="" /><p className="ledger-chapter">A lantern-bearer’s brief tale</p><h2>The Lantern Path</h2><p>Whispergrove’s beacon has gone dim. Carry your flame through the hush, gather its lost ember, and make the old road warm again.</p><button className="scribe-button" onClick={onBegin}>Carry the flame <span>→</span></button></div></section>}
    </div>
  );
}
