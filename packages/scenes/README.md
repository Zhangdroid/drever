# @drever/scenes

Presentation-native scenes for moments that ordinary slide primitives do not
cover: opening a room, preserving an ambient visual across pages, introducing
live evidence, or closing a story.

This package is incubating inside the Drever workspace. It is private,
unpublished, and not a supported public authoring API yet. It is intentionally
not a generic UI kit and is not registered globally. Import only the scene that
has a real job in a workspace study.

```tsx
import { Soundtrack } from "@drever/scenes";
import "@drever/scenes/styles.css";

export function OpeningRoom() {
  return (
    <Soundtrack
      artist="Drever studio"
      src="/audio/opening-loop.wav"
      title="Before the room speaks"
    />
  );
}
```

`src` must be a local, self-hosted, or CORS-enabled audio asset. Drever creates
the Web Audio graph only after the presenter presses **Start room**. Audible
autoplay is deliberately unsupported.

A Spotify or Apple Music URL has a different contract:

```tsx
<Soundtrack playlistUrl="https://open.spotify.com/playlist/..." title="Doors open playlist" />
```

The official provider player loads on demand and the background uses a quiet
ambient animation. Provider iframes do not expose raw audio to Web Audio, so
this mode never claims to be frequency-reactive. Leaving the slide disconnects
local audio and unloads the provider frame; the first version does not create a
deck-wide music service.

`RoomAudio` connects sound reaching the presenter's microphone to the same
persistent Stage signal:

```tsx
import { RoomAudio } from "@drever/scenes";

<RoomAudio label="Listen to the room" />;
```

The presenter explicitly enables the microphone, then may play music through
the computer speakers, speak, clap, or use any other nearby sound. The analyzer
writes low, mid, high, and overall levels onto the persistent
`[data-drever-stage]`. Captured audio is processed only in the browser and is
never recorded or uploaded. When the room is silent or listening stops, all
values return to zero and the authored background rests. Non-audience surfaces
render deterministic metadata without media or permission controls.

## Render surfaces

| Surface                 | Behavior                                     |
| ----------------------- | -------------------------------------------- |
| Audience                | Explicit playback or provider-player control |
| Reduced-motion audience | Audio may play; the visual stays still       |
| Speaker current / next  | Deterministic metadata card                  |
| Document                | Deterministic metadata card and source link  |
| Export                  | Deterministic metadata card and source link  |

`AmbientStage` is a decorative persistent background for a project Stage. Give
it one of four narrative states (`quiet`, `gather`, `focus`, `resolve`) rather
than inventing an animation per page. `RoomCountdown` updates only in audience
view and uses its authored fallback elsewhere.

## AI authoring rule

Use a Scene only when its live behavior explains or supports a real room
moment. Keep one primary attention target at a time. Do not add a soundtrack,
countdown, spatial model, or ambient loop merely to make a slide move.

Good next candidates are `BrowserJourney`, `CompareLens`, `DataStory`,
`MediaCue`, and `AudiencePulse`. They belong in this one package; each should
keep deterministic export semantics and avoid mandatory provider SDKs.
