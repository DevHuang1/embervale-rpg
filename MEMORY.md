# Embervale — Implementation Notes

- The game uses an isometric diorama rather than a pixel-art sprite field to honor the generated visual target while keeping gameplay legible and lightweight.
- Keep all generated originals outside the deployable project tree and reference only uploaded storage URLs.
- The hero’s lantern and the beacon should remain the strongest warm lights in the scene; do not add competing bright colors.
- Browser inspection confirmed the first implementation mounts correctly: the opening folio, illustrated ledger, live diorama, and touch controls are present. The visual pass then strengthened the amber lantern aura, objective readability, and wax-sealed engraved ledger framing.
- The deterministic `?demo` route completed the full quest, reaching the restored-beacon resolution at lantern level 2 and 35 Ember marks. Keyboard combat shortcuts now match the labelled 1 / 2 / 3 controls.
