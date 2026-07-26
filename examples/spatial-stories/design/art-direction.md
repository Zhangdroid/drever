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
   becomes the centered evidence → docks at lower contrast behind the lifecycle explanation →
   deterministic cloner poster in reduced-motion, document, speaker, and export surfaces.
2. **Interaction can change understanding** → official orbit scene → begins as a stable poster →
   becomes a directly manipulable camera → a Step names the audience's new ownership → same poster
   plus final statement outside the live audience.

## Motion

- Keep both Spline canvases outside native View Transition capture.
- Let the persistent Stage scene move as live DOM with fixed `760 × 720` bounds. Translate and fade
  the shell; never resize or stretch its captured geometry.
- Cut between the persistent and interactive chapters. One WebGL scene is active at a time.
- Let the audience manipulate the orbit scene directly; do not add automatic camera choreography.
- Keep reduced-motion and non-audience surfaces immediately settled.

## Sources and licensing boundary

- Official Viewer examples and copyable embeds: <https://viewer.spline.design/>
- Viewer integration documentation:
  <https://docs.spline.design/exporting-your-scene/web/exporting-as-spline-viewer>
- Spline optimization guidance:
  <https://docs.spline.design/exporting-your-scene/how-to-optimize-your-scene>
- Runtime: `@splinetool/viewer@1.12.98`, loaded from the official documented unpkg entry point.
- Cloner scene:
  <https://prod.spline.design/fJ2ptJKzT-sDkpfO/scene.splinecode>
- Cloner remix source:
  <https://app.spline.design/file/4ace4b60-c262-4340-a06e-904da30bfa34>
- Orbit scene remix:
  <https://app.spline.design/file/5e551c2f-7f10-4a4f-80fc-5b0e6f7f8008>

The remote scenes, runtime, Spline branding, and model assets are not copied into this repository.
The original CSS posters are the deterministic fallback. Sources were verified on 2026-07-26.

## Avoid

- 3D on every slide, simultaneous WebGL scenes, or camera movement without a narrative job.
- Body copy over a high-contrast scene without a local glass surface.
- Native continuity around a cross-origin canvas.
- Hidden Spline attribution, copied scene screenshots, or claims that public community work is
  automatically reusable.
