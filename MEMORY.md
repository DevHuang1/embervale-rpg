# Embervale — Implementation Notes

- The game uses an isometric diorama rather than a pixel-art sprite field to honor the generated visual target while keeping gameplay legible and lightweight.
- Keep all generated originals outside the deployable project tree and reference only uploaded storage URLs.
- The hero’s lantern and the beacon should remain the strongest warm lights in the scene; do not add competing bright colors.
- Browser inspection confirmed the first implementation mounts correctly: the opening folio, illustrated ledger, live diorama, and touch controls are present. The visual pass then strengthened the amber lantern aura, objective readability, and wax-sealed engraved ledger framing.
- The deterministic `?demo` route completed the full quest, reaching the restored-beacon resolution at lantern level 2 and 35 Ember marks. Keyboard combat shortcuts now match the labelled 1 / 2 / 3 controls.
- The cursor-control upgrade now presents direct on-screen instructions: click any grove location to walk and click the Hushling to begin a chase-and-auto-strike engagement. The opening folio can be dismissed normally before interacting with the world.
- Initial browser interaction confirmed the cursor-control instruction surface but did not yet expose an auto-strike state after clicking the apparent enemy center; the picking path is under active verification.
- A fresh browser run dismisses the opening folio correctly and presents the Hushling unobstructed in the grove for the final selection test.
- Direct browser coordinate clicks did not produce the expected target-lock overlay in the captured state, so the final verification is switching to programmatic canvas event tracing rather than relying on coordinate translation alone.
- The preview canvas reports a 1280 × 1100 client rectangle even though browser screenshots are visually scaled; a direct pointer gesture has been dispatched using the unscaled enemy-center coordinates for the next state readback.
- After restarting with the direct canvas handler, the title folio again dismisses correctly and the live game world is ready for a fresh, unscaled pointer-coordinate selection check.
- A browser-side pointer trace has been attached to the canvas to confirm the actual coordinate values delivered by browser-driven clicks before the final interaction adjustment.
- Pointer tracing confirms the browser sends the visually selected Hushling location as `clientX 438 / clientY 341`; the game must translate this scaled browser coordinate to its 1280 × 1100 Babylon render surface before picking.
- The actual browser canvas, render buffer, and viewport are all 1280 × 1100; a true-coordinate direct pointer gesture at the Hushling’s expected screen position has been dispatched to validate normal browser input independent of the screenshot tool’s coordinate scaling.
- The development pick inspector reports no hit at either candidate screen coordinate, revealing that the procedural world meshes need explicit Babylon pickability before click navigation or target selection can resolve.
- Even with pickability enabled, the current ArcRotate/Babylon preview reports no screen-space pick hit through the browser harness. The control implementation is therefore moving to a deterministic map-space pointer command model that preserves player-facing click controls without relying on fragile preview pick behavior.
- The cursor-command layer now mounts an accessible, correctly placed Hushling target control in the live browser after the opening folio closes; this provides a robust user-facing click target for automatic engagement.
- Live browser verification confirms that selecting the Hushling starts the chase-and-auto-strike loop, reduces enemy and player warmth, awards 35 Ember marks on victory, and advances to the Ember Shard stage. An empty-grove pointer command has also been dispatched through the cursor-command layer to verify click-to-move routing.
