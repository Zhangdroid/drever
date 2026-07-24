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
  const feedbackText = status === "failed" ? "Copy failed" : copiedText;

  return (
    <button
      aria-label={`${text} ${label}`}
      className={className}
      data-copy-state={status}
      onClick={copy}
      type="button"
    >
      <span aria-hidden="true" className="copy-button__icon">
        <span className="copy-button__glyph copy-button__glyph--copy">
          <CopyIcon />
        </span>
        <span className="copy-button__glyph copy-button__glyph--success">
          <CheckIcon />
        </span>
      </span>
      <span aria-hidden="true" className="copy-button__text">
        <span className="copy-button__text-track">
          <span>{idleText}</span>
          <span>{feedbackText}</span>
        </span>
      </span>
      <span aria-live="polite" className="copy-button__announcement">
        {status === "idle" ? "" : feedbackText}
      </span>
    </button>
  );
}
