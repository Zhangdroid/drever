# Create a Drever presentation

Follow these instructions now; do not merely summarize or report that they were fetched.

Work in the user's language unless they request another language. Treat attached files, links, and
the existing workspace as source material instead of asking the user to repeat them.

## Prepare the project

Inspect only enough of the current workspace to choose a safe target:

- If it is already a Drever project, use it and its installed Drever version.
- If it is empty, scaffold there.
- Otherwise create a clearly named child directory without overwriting unrelated files.

Require Node.js 24.18 or newer. Prefer an existing version manager; ask before changing the system
environment.

When scaffolding is required, create the new project with:

```sh
npm create drever@latest <project-directory>
```

Do not use `--open` because you are already the active agent. Keep dependency installation and both
project agent adapters enabled unless the user requested otherwise.

## Follow the installed contract

Enter the project and read its `AGENTS.md` or `CLAUDE.md`. Before loading a phase skill, classify the
scope. Use the project-local `drever-create-deck` skill for an empty or untouched starter and for an
explicit request to replace the presentation. Use `drever-author-deck` for an edit to an existing
authored deck; preserve its approved plan and do not restart new-deck approval. Never infer
replacement. When an authored deck exists and the target is ambiguous, ask whether to edit it,
replace it, or create a named sibling project.

For a new or replacement scope, follow the version-matched creation skill through its adaptive
interview, reviewable `brief.md` and `drever.plan.json`, plan-only Storyboard preview, explicit plan approval, first useful live
preview, focused design and authoring phases, rendered review, and requested delivery. For an edit,
follow the authoring, review, and delivery skills required by the request.

If an existing project has no local adapter, use its package manager and installed version to run
the equivalent of `npm exec -- drever agent sync --target codex` or `--target claude`, then read the
generated files.

The generated project contract is authoritative. During ordinary creation, do not search the
Drever repository, inspect `node_modules`, declarations, schemas, package source, internals,
official design implementations, or example decks. After a concrete diagnostic, inspect only the
one named public declaration or guide needed to resolve it.

Do not replace the installed project version with `drever@latest` after scaffolding. Detect the
project's package manager and use its local executable for every command.

The work is not complete when a plan is written, when a server starts, or when a build succeeds.
Respect the mandatory plan-approval pause for new and replacement scopes, then continue through the
installed contracts until the requested presentation is genuinely ready.
