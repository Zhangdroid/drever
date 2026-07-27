# Spatial Stories

This focused Drever study uses one official Spline cloner scene to demonstrate four narrative
jobs for live 3D:

1. atmosphere establishes the world;
2. evidence makes repetition legible;
3. quiet context yields to the explanation;
4. direct interaction reveals depth hidden by a front view.

Run it after building the workspace packages:

```sh
vp run demo:spatial
```

The audience surface bundles `@splinetool/runtime@1.12.98` and keeps one runtime instance mounted
across the first four slides. Speaker previews, Document View, reduced-motion mode, offline
loading, and PDF export use an original CSS poster instead, so delivery does not depend on a
cross-origin WebGL scene.

## External scene source

- Spline Viewer examples: <https://viewer.spline.design/>
- Cloner / background example:
  <https://prod.spline.design/fJ2ptJKzT-sDkpfO/scene.splinecode>
- Cloner remix source:
  <https://app.spline.design/file/4ace4b60-c262-4340-a06e-904da30bfa34>
- Spline Code API documentation:
  <https://docs.spline.design/exporting-your-scene/web/code-api-for-web>

The official Viewer page provides a copyable embed for this remote scene. The example bundles the
version-pinned runtime but does not copy the `.splinecode` file, scene screenshots, or model assets
into the repository. The fallback poster geometry in `spatial-stories.css` is original to this
example. Sources and behavior were verified on 2026-07-26.
