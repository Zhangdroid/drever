import { RoomAudio, RoomCountdown, type RoomAudioTrack } from "@drever/scenes";
import { useMemo, type ReactElement } from "react";
import openingLoop from "./assets/opening-loop.wav";

export type OpeningRoomProps = Readonly<{
  "aria-label"?: string;
}>;

const demoTrack: RoomAudioTrack = {
  artist: "An original procedural loop",
  loop: true,
  sourceLabel: "Demo loop",
  src: openingLoop,
  title: "Soft Signal",
};

export function OpeningRoom({ "aria-label": ariaLabel }: OpeningRoomProps): ReactElement {
  const target = useMemo(() => new Date(Date.now() + 5 * 60_000).toISOString(), []);

  return (
    <div aria-label={ariaLabel} className="room-opening">
      <header className="room-opening__intro">
        <span className="scene-kicker">Drever scenes / sound on</span>
        <h1>
          Let the room move the <em>light.</em>
        </h1>
        <p>Start the demo—or let Drever listen to audio already playing around you.</p>
        <div className="room-opening__countdown">
          <span>We begin in</span>
          <RoomCountdown fallbackLabel="05:00" target={target} />
        </div>
      </header>

      <RoomAudio
        aria-label="Choose audio for the room"
        className="room-opening__audio"
        label="Choose what the room hears"
        track={demoTrack}
      />
    </div>
  );
}
