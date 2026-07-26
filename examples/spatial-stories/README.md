# Spatial Stories

This focused Drever study uses two official Spline Viewer examples to demonstrate two
presentation-native roles for live 3D:

1. a persistent cloner scene that moves from atmosphere to evidence to quiet context;
2. an orbitable character scene whose direct manipulation is the lesson.

Run it after building the workspace packages:

```sh
vp run demo:spatial
```

The audience surface loads Spline Viewer `1.12.98` from its documented CDN entry point. Speaker
previews, Document View, reduced-motion mode, offline loading, and PDF export use original CSS
posters instead, so delivery does not depend on a cross-origin WebGL scene.

## External scene sources

- Spline Viewer examples: <https://viewer.spline.design/>
- Cloner / background example:
  <https://prod.spline.design/fJ2ptJKzT-sDkpfO/scene.splinecode>
- Cloner remix source:
  <https://app.spline.design/file/4ace4b60-c262-4340-a06e-904da30bfa34>
- Orbit and zoom example:
  <https://app.spline.design/file/5e551c2f-7f10-4a4f-80fc-5b0e6f7f8008>
- Spline Viewer export documentation:
  <https://docs.spline.design/exporting-your-scene/web/exporting-as-spline-viewer>

The official Viewer page provides copyable embed snippets for these remote scenes. Drever does not
redistribute the `.splinecode` files, Spline runtime, scene screenshots, or model assets. The
fallback poster geometry in `spatial-stories.css` is original to this example. Sources and behavior
were verified on 2026-07-26.
