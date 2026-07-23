import { RoomCountdown, Soundtrack } from "@drever/scenes";
import { useMemo, type ReactElement } from "react";
import openingLoop from "./assets/opening-loop.wav";

export function OpeningRoom(): ReactElement {
  const target = useMemo(() => new Date(Date.now() + 5 * 60_000).toISOString(), []);

  return (
    <div className="room-opening">
      <header className="room-opening__intro">
        <span className="scene-kicker">Drever scenes / doors open</span>
        <h1>
          Before the room <em>speaks.</em>
        </h1>
        <p>A quiet moment for people to arrive, settle, and become curious.</p>
        <div className="room-opening__countdown">
          <span>We begin in</span>
          <RoomCountdown fallbackLabel="05:00" target={target} />
        </div>
      </header>

      <Soundtrack
        artist="An original procedural loop"
        className="room-opening__soundtrack"
        src={openingLoop}
        title="Soft Signal"
      />
    </div>
  );
}
