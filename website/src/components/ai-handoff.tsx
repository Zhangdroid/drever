import { useId, useMemo, useState } from "react";

import { CopyButton } from "./copy-button";

const emptyHandoff =
  "Help me create a Drever presentation. Follow https://drever.dev/prompt.md, set up everything in a new clearly named directory, then ask what the audience should understand, decide, or do. Ask only for choices that would materially change the result.";

const handoffFor = (brief: string) => {
  const normalized = brief.trim();
  if (normalized.length === 0) return emptyHandoff;

  return `Create a Drever presentation for this brief: “${normalized}” Follow https://drever.dev/prompt.md, set up everything in a new clearly named directory, use the generated project-local instructions, inspect the finished presentation, and leave it ready for review. Ask only when a missing decision would materially change the result.`;
};

export function CopyAIHandoff({ brief = "", className }: { brief?: string; className?: string }) {
  return (
    <CopyButton
      className={className}
      copiedText="Prompt copied"
      idleText="Copy prompt"
      label="for Codex or Claude Code"
      value={handoffFor(brief)}
    />
  );
}

export function AIHandoff({
  heading = "What should this presentation help people understand, decide, or do?",
  placeholder = "Help a team understand a new direction and decide what to do next.",
}: {
  heading?: string;
  placeholder?: string;
}) {
  const headingId = useId();
  const [brief, setBrief] = useState("");
  const handoff = useMemo(() => handoffFor(brief), [brief]);

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
          Copies the complete setup prompt. Paste it into Codex, Claude Code, or another coding
          agent; project creation and review instructions are included.
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
