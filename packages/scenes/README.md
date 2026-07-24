# @drever/scenes

Presentation-native scenes for moments that ordinary slide primitives do not
cover: opening a room, preserving an ambient visual across pages, introducing
live evidence, or closing a story.

This package is incubating inside the Drever workspace. It is intentionally not
a generic UI kit and is not registered globally. Import only the scene that has
a real job in the presentation.

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

`RoomAudio` connects the same persistent Stage signal to one of three explicit
inputs:

```tsx
import { RoomAudio } from "@drever/scenes";

<RoomAudio
  track={{
    artist: "Example artist",
    sourceLabel: "Demo loop",
    src: "/audio/opening.mp3",
    title: "Example track",
  }}
/>;
```

- **Demo track** plays a local or CORS-enabled stream through Web Audio.
- **Computer audio** asks the presenter to share a tab or screen with audio.
- **Microphone** listens to sound reaching the room.

The analyzer writes low, mid, high, and overall levels onto the persistent
`[data-drever-stage]`. It sends no captured audio to Drever. When the input is
silent or stopped, all values return to zero and the authored background rests.
Non-audience surfaces render deterministic metadata without media or permission
controls.

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
