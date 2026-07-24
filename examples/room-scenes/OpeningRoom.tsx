import { RoomAudio } from "@drever/scenes";
import type { ReactElement } from "react";

export type OpeningRoomProps = Readonly<{
  "aria-label"?: string;
}>;

export function OpeningRoom({ "aria-label": ariaLabel }: OpeningRoomProps): ReactElement {
  return (
    <div aria-label={ariaLabel} className="room-opening">
      <header className="room-opening__intro">
        <span className="scene-kicker">Room Sense / microphone reactive</span>
        <h1>
          Let the room move the <em>light.</em>
        </h1>
        <p>
          Play music through your computer speakers. The glow and rings will follow what the
          microphone hears.
        </p>
      </header>

      <RoomAudio
        aria-label="Room Sense microphone"
        className="room-opening__audio"
        label="Listen to the room"
      />
    </div>
  );
}
