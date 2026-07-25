import { RoomAudio } from "@drever/scenes";
import type { ReactElement } from "react";

export type OpeningRoomProps = Readonly<{
  "aria-label"?: string;
}>;

export function OpeningRoom({ "aria-label": ariaLabel }: OpeningRoomProps): ReactElement {
  return (
    <div aria-label={ariaLabel} className="room-opening">
      <header className="room-opening__intro">
        <span className="scene-kicker">Room Sense / nearby sound → ambient light</span>
        <h1>
          Let the room move the <em>light.</em>
        </h1>
        <p>
          Allow the microphone, then play music through your computer speakers. The lime and violet
          field will move with what the room hears.
        </p>
      </header>

      <RoomAudio
        aria-label="Room Sense microphone"
        autoStart
        className="room-opening__audio"
        variant="ambient"
      />
    </div>
  );
}
