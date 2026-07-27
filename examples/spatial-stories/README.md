# Spatial Stories

This focused Drever study uses two official Spline Viewer scenes and one CC0 Spline Community scene
to demonstrate distinct narrative jobs for live 3D:

1. one persistent scene moves from atmosphere to evidence, then yields as context;
2. one isolated object carries quiet continuous motion;
3. one ambient environment gives the canvas depth without competing with the reading.

Run it after building the workspace packages:

```sh
vp run demo:spatial
```

The audience surface bundles `@splinetool/runtime@1.12.98` for the Viewer scenes and isolates the
community study in its public preview frame. Only one remote 3D renderer is mounted at a time: the
first scene persists across its three narrative states, then each later study owns one focused job.
Speaker previews, Document View, reduced-motion mode, offline loading, and PDF export use an
original deterministic CSS poster for each study instead, so those surfaces do not depend on
cross-origin WebGL.

## External scene sources

- Spline Viewer examples: <https://viewer.spline.design/>
- Persistent cloner example:
  <https://prod.spline.design/fJ2ptJKzT-sDkpfO/scene.splinecode>
- Cloner remix source:
  <https://app.spline.design/file/4ace4b60-c262-4340-a06e-904da30bfa34>
- Follow example:
  <https://prod.spline.design/PBQQBw8bfXDhBo7w/scene.splinecode>
- Particle Nebula community source (CC0 1.0):
  <https://community.spline.design/file/cea96ce0-da30-46cc-bd5c-dc73a6497abd>
- Spline Code API documentation:
  <https://docs.spline.design/exporting-your-scene/web/code-api-for-web>

The official Viewer page provides copyable embeds for the first two remote scenes. The community
page identifies Particle Nebula as CC0 1.0. The example does not copy `.splinecode` files, scene
screenshots, or model assets into the repository. The fallback poster geometry in
`spatial-stories.css` is original to this example. Sources and behavior were verified on
2026-07-26.
