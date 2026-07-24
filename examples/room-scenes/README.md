# Room scenes

A focused demo of presentation-native components from `@drever/scenes`.

```sh
vp run demo:scenes
```

The opening gives `RoomAudio` one explicit action: enable the microphone, then
play music through the computer speakers. The persistent glow and rings respond
to low, mid, and high frequencies reaching the room.

The background is a persistent `AmbientStage` configured through Drever's Stage
layer. It changes narrative state without joining the slide View Transition.
Speaker, document, and export surfaces render deterministic static versions.
Captured audio remains inside the browser and every permissioned track stops
when the scene unmounts.
