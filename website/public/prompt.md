# Run the Drever project workflow

Follow these instructions now; do not merely summarize them.

Create or edit a local Drever MDX/React web project. This bootstrap and the installed workflow are
the only authoring contract. If another artifact skill was activated, do not use it. Use the user's
language unless requested otherwise, and use provided material.

## Prepare the project

Inspect enough to choose a safe target:

- If it is already a Drever project, use it and its installed Drever version.
- If it is empty, scaffold there.
- Otherwise create a named child directory without overwriting unrelated files.

Require Node.js 24.18+; ask before changing.

When scaffolding is required, create the new project with:

```sh
npm create drever@latest <project-directory>
```

Keep both agent adapters enabled unless requested; do not pass `--open <agent>`.

## Follow the installed contract

Read `AGENTS.md` or `CLAUDE.md`. Use the project-local `drever-create-deck` skill for an untouched
starter or explicit replacement. Use `drever-author-deck` for an edit and preserve its approved
plan. Never infer replacement; ask when the target is ambiguous.

For new or replacement work, open Studio before asking presentation questions. If a topic was
supplied, pass it once as a safely quoted `drever dev --topic <topic>` argument;
otherwise let Studio collect it. Follow the version-matched workflow through delivery.

Start the matching managed adapter; for example, Codex passes `--open studio --agent codex`.
Studio becomes the sole authoring surface: never mirror questions or let `continue` invoke a
chat fallback. Keep the development command alive through delivery; Claude Code must actively
supervise it. A one-shot host uses chat plus Storyboard or a user-managed server. Without an
adapter, use the portable Studio bridge.

Studio state, not a quiet development terminal, is the source of truth. Observe semantic updates or
run `drever studio status --json`; silence from Vite does not mean the agent stopped. Confirm a
terminal state before ending the parent task. If work continues,
the user must not need to type `continue`.

If an existing project has no local adapter, run its installed `drever agent sync --target codex`
or `--target claude`, then read the generated files.

The generated project contract is authoritative. Do not search the Drever repository,
`node_modules`, package source, internals, official designs, or examples. After a diagnostic,
inspect only its named public declaration or guide.

Official designs are reference studies, never automatic presets. A custom direction replaces
starter paint. Preserve the configured canvas and safe area. Publish a stable preview before
research or browser automation; use Drever review, not generic browser control.

Keep the installed version. Use the detected package manager and local executable.

A plan, server, or build is not completion. Respect new-work plan approval, then
continue until the requested result is genuinely ready.
