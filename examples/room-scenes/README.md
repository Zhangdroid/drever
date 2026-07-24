# Room scenes

A focused demo of presentation-native components from `@drever/scenes`.

```sh
vp run demo:scenes
```

The opening combines a live audience countdown with `RoomAudio`. Its committed
procedural loop is a reliable first look. Presenters can instead share computer
audio from any player or let the microphone hear the room.

The background is a persistent `AmbientStage` configured through Drever's Stage
layer. It changes narrative state without joining the slide View Transition.
Speaker, document, and export surfaces render deterministic static versions.
Captured audio remains inside the browser and every permissioned track stops
when the scene unmounts.

The WAV file is generated from the checked-in dependency-free Node script:

```sh
vp run -F @drever/example-room-scenes generate:audio
```
