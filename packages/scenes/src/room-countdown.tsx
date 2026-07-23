import { useDreverRenderMode } from "@drever/core";
import {
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type ReactElement,
} from "react";

export type RoomCountdownProps = Omit<ComponentPropsWithoutRef<"time">, "dateTime"> &
  Readonly<{
    completeLabel?: string;
    fallbackLabel?: string;
    target: string;
  }>;

const formatRemaining = (milliseconds: number): string => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

/** A live room countdown that becomes deterministic on speaker, document, and export surfaces. */
export function RoomCountdown({
  className,
  completeLabel = "Ready when you are",
  fallbackLabel = "Starting soon",
  target,
  ...props
}: RoomCountdownProps): ReactElement {
  const renderMode = useDreverRenderMode();
  const targetTime = Date.parse(target);
  if (Number.isNaN(targetTime)) {
    throw new RangeError("RoomCountdown target must be a valid date-time string.");
  }

  const interactive = renderMode === "audience";
  const [remaining, setRemaining] = useState<number>();

  useEffect(() => {
    if (!interactive) {
      return;
    }

    const update = (): void => setRemaining(targetTime - Date.now());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [interactive, targetTime]);

  const label =
    remaining === undefined
      ? fallbackLabel
      : remaining <= 0
        ? completeLabel
        : formatRemaining(remaining);

  return (
    <time
      {...props}
      className={["drever-room-countdown", className].filter(Boolean).join(" ")}
      dateTime={target}
      suppressHydrationWarning
    >
      {label}
    </time>
  );
}
