import { useEffect, useRef, useState } from "react";

import { CheckIcon, CopyIcon } from "./icons";

export function CopyButton({
  className,
  copiedText = "Copied",
  idleText = "Copy",
  label,
  value,
}: {
  className?: string | undefined;
  copiedText?: string;
  idleText?: string;
  label: string;
  value: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const copy = async () => {
    window.clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    resetTimer.current = window.setTimeout(() => setStatus("idle"), 1600);
  };

  const text = status === "copied" ? copiedText : status === "failed" ? "Copy failed" : idleText;

  return (
    <button aria-label={`${text} ${label}`} className={className} onClick={copy} type="button">
      {status === "copied" ? <CheckIcon /> : <CopyIcon />}
      <span aria-live="polite">{text}</span>
    </button>
  );
}
