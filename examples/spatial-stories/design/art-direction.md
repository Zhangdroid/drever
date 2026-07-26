# Spatial Stories art direction

## Premise

The deck is a **Spatial Edit**: a 3D scene earns attention, changes narrative jobs, then yields. The
visual system treats depth as evidence or interaction rather than permanent spectacle.

## Visual system

- Use a near-black projection canvas so the Spline scenes retain their modeled light and volume.
- Use warm white for claims, violet for spatial continuity, and lime only for the current decision.
- Place explanation on restrained glass only when it must cross the 3D field.
- Keep labels large and scarce. The scene is the support; it is never paired with another prose
  panel.
- Use Bricolage Grotesque for claims and Instrument Sans for guidance, both supplied by
  `@drever/brand`.

## Signature moments

1. **A scene can carry the room** → official cloner scene → begins as right-side atmosphere →
   turns to expose its repeated structure → settles at lower contrast behind the lifecycle
   explanation → deterministic cloner poster in reduced-motion, document, speaker, and export
   surfaces.
2. **Interaction can change understanding** → the same cloner scene turns to a fourth authored
   angle → direct drag becomes available only when manipulation is the lesson → a Step names the
   audience's new ownership → the same poster carries the final meaning outside the live audience.

## Motion

- Keep the single Spline canvas outside native View Transition capture.
- Keep the persistent Stage shell fixed at `760 × 720`. Rotate the modeled roots between authored
  states; never translate, resize, or stretch the canvas to imply a new angle.
- Let each automatic turn settle before the scene changes narrative jobs.
- Enable direct drag only on the interaction slide, after the authored turn has established its
  starting angle.
- Keep reduced-motion and non-audience surfaces immediately settled.

## Sources and licensing boundary

- Official Viewer examples and copyable embeds: <https://viewer.spline.design/>
- Spline Code API documentation:
  <https://docs.spline.design/exporting-your-scene/web/code-api-for-web>
- Spline optimization guidance:
  <https://docs.spline.design/exporting-your-scene/how-to-optimize-your-scene>
- Runtime: `@splinetool/runtime@1.12.98`, installed only by this focused example.
- Cloner scene:
  <https://prod.spline.design/fJ2ptJKzT-sDkpfO/scene.splinecode>
- Cloner remix source:
  <https://app.spline.design/file/4ace4b60-c262-4340-a06e-904da30bfa34>

The remote scene, Spline branding, and model assets are not copied into this repository. The
version-pinned runtime is bundled by the example, and the original CSS poster is its deterministic
fallback. Sources were verified on 2026-07-26.

## Avoid

- 3D on every slide, simultaneous WebGL scenes, or camera movement without a narrative job.
- Body copy over a high-contrast scene without a local glass surface.
- Native continuity around a cross-origin canvas.
- Hidden Spline attribution, copied scene screenshots, or claims that public community work is
  automatically reusable.
