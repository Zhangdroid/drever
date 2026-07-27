# Drever presentation

Open this project folder in Codex, Claude Code, or another coding agent. Ask it
to use the installed `drever-create-deck` skill. In Codex, paste:

> Use `$drever-create-deck` to turn `brief.md` into an early live Drever draft, then keep refining the same preview and deliver the requested outputs.

In Claude Code, use `/drever-create-deck` instead of `$drever-create-deck`.

The editable presentation lives in `slides.mdx`.
The typed `drever.config.ts` starts with an explicit English language contract. The agent
will update its language, direction, title, and sharing metadata to match the
presentation it authors.

## Manual commands

- `npm run dev` previews the presentation.
- `npm run check` validates the authored deck with human-readable diagnostics.
- `npm run build` creates a deployable website.
- `npm run export` creates a PDF.
