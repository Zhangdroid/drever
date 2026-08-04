# Room Sense

An incubating source study of room-aware presentation components. Its
implementation lives beside the deck in [`components`](./components) so the
ideas can evolve without implying a supported public package.

```sh
vp run demo:scenes
```

When the opening audience slide becomes active, its local `RoomAudio` component
requests microphone access without adding a control card to the composition.
Allow it, then play music through the computer speakers. The full-canvas lime
and violet field responds to low, mid, and high frequencies reaching the room.
Captured audio stays inside the browser, and every permissioned track stops
when the opening slide is left or the component unmounts.

The background is a persistent `AmbientStage` configured through Drever's Stage
layer. It changes narrative state without joining the slide View Transition.
Speaker, document, and export surfaces render deterministic static versions.

The same local study preserves early `Soundtrack` and `RoomCountdown`
prototypes, together with their behavioral tests. They are not public authoring
APIs. If several genuinely reusable presentation components mature across
different examples, they can graduate together into a future
`@drever/components` package.

## Component rules

- Give each component one narrative job rather than building a generic widget
  catalog.
- Keep reduced-motion, speaker, document, and export output deterministic.
- Request permissions only when the audience surface genuinely needs them.
- Bound continuous motion and never let a component own slide navigation or the
  page transition.

Provider playback and frequency analysis remain separate contracts. Spotify
and Apple Music embeds can expose their own players, but protected iframes do
not expose raw audio samples to the deck. Link-only playback must therefore use
ambient motion and never claim to be frequency-reactive.
