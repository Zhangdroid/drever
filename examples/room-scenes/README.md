# Room scenes

An incubating source study of presentation-native components from
`@drever/scenes`. The package is private to this workspace and is not currently
published or supported as a public authoring API.

```sh
vp run demo:scenes
```

When the opening audience slide becomes active, its ambient `RoomAudio` requests
microphone access without adding a control card to the composition. Allow it,
then play music through the computer speakers. The full-canvas lime and violet
field responds to low, mid, and high frequencies reaching the room.

The background is a persistent `AmbientStage` configured through Drever's Stage
layer. It changes narrative state without joining the slide View Transition.
Speaker, document, and export surfaces render deterministic static versions.
Captured audio remains inside the browser and every permissioned track stops
when the opening slide is left or the scene unmounts.
