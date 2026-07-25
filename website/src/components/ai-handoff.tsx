import { useId, useMemo, useState } from "react";

import { CopyButton } from "./copy-button";

const emptyHandoff = "Fetch https://drever.dev/prompt.md";

export const createAIHandoff = (brief: string) => {
  const normalized = brief.trim();
  if (normalized.length === 0) return emptyHandoff;

  return `${emptyHandoff}. Brief: “${normalized}”`;
};

export function CopyAIHandoff({
  brief = "",
  className,
  describedBy,
}: {
  brief?: string;
  className?: string;
  describedBy?: string;
}) {
  return (
    <CopyButton
      className={className}
      copiedText="Prompt copied"
      describedBy={describedBy}
      idleText="Copy prompt"
      label="for Codex or Claude Code"
      value={createAIHandoff(brief)}
    />
  );
}

export function AIHandoff({
  heading = "What should this presentation help people understand, decide, or do?",
  placeholder = "Create a 10-minute project update for the team: progress, key decisions, risks, and next steps.",
}: {
  heading?: string;
  placeholder?: string;
}) {
  const headingId = useId();
  const [brief, setBrief] = useState("");
  const handoff = useMemo(() => createAIHandoff(brief), [brief]);

  return (
    <section className="ai-handoff" aria-labelledby={headingId}>
      <header>
        <span>Begin with the room</span>
        <h2 id={headingId}>{heading}</h2>
      </header>
      <label>
        <span>Presentation brief</span>
        <textarea
          onChange={(event) => setBrief(event.target.value)}
          placeholder={placeholder}
          rows={4}
          value={brief}
        />
      </label>
      <footer>
        <p>
          Copies one short handoff. The versioned workflow lives in prompt.md and the generated
          project, so the instructions stay current.
        </p>
        <div>
          <a href="/prompt.md">Read prompt.md</a>
          <CopyButton
            copiedText="Prompt copied"
            idleText="Copy prompt"
            label="for this presentation"
            value={handoff}
          />
        </div>
      </footer>
    </section>
  );
}
