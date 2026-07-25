# Drever presentation

Open this project folder in Codex, Claude Code, or another coding agent. Ask it
to use the installed `drever-create-deck` skill. In Codex, paste:

> Use `$drever-create-deck` to turn `brief.md` into a complete, validated Drever presentation. Inspect the result in a browser and deliver the requested outputs.

In Claude Code, use `/drever-create-deck` instead of `$drever-create-deck`.

The editable presentation lives in `slides.mdx`.

## Manual commands

- `npm run dev` previews the presentation.
- `npm run check` validates the authored deck with human-readable diagnostics.
- `npm run build` creates a deployable website.
- `npm run export` creates a PDF.
