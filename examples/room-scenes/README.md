# Room scenes

A focused demo of presentation-native components from `@drever/scenes`.

```sh
vp run demo:scenes
```

The opening page combines a live audience countdown with an original procedural
audio loop. Press **Start room** to create the Web Audio graph; no audio starts
on mount. The second page demonstrates an on-demand Spotify embed and explains
why provider playback uses ambient rather than frequency-reactive motion.

The background is a persistent `AmbientStage` configured through Drever's Stage
layer. It changes narrative state without joining the slide View Transition.
Speaker, document, and export surfaces render deterministic static versions.

The WAV file is generated from the checked-in dependency-free Node script:

```sh
vp run -F @drever/example-room-scenes generate:audio
```
