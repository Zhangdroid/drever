# Create a Drever presentation

Follow these instructions now; do not merely summarize or report that they were fetched.

Work in the user's language unless they request another language. Treat attached files, links, and
the existing workspace as source material instead of asking the user to repeat them.

## Prepare the project

Inspect only enough of the current workspace to choose a safe target:

- If it is already a Drever project, use it and its installed Drever version.
- If it is empty, scaffold there.
- Otherwise create a clearly named child directory without overwriting unrelated files.

Verify that Node.js 24.18 or newer is available. Prefer an existing version manager; ask before
changing the user's system environment or installing a system package manager.

When scaffolding is required, create the new project with:

```sh
npm create drever@latest <project-directory>
```

Do not use `--open` because you are already the active agent. Keep dependency installation and both
project agent adapters enabled unless the user requested otherwise.

## Follow the installed contract

Enter the project and read its `AGENTS.md` or `CLAUDE.md` plus the project-local
`drever-create-deck` skill completely. Follow that version-matched skill through its adaptive
interview, reviewable `brief.md` and `drever.plan.json`, explicit plan approval, first useful live
preview, focused design and authoring phases, rendered review, and requested delivery.

If an existing Drever project has no project-local adapter, use its detected package manager and
installed version to run the equivalent of `npm exec -- drever agent sync --target codex` or
`--target claude` for the current agent, then read the generated instruction and skill files. Do not
replace the project version merely to obtain the workflow.

The generated project contract is authoritative. During ordinary creation, do not search the
Drever repository, inspect `node_modules`, declarations, schemas, package source, internals,
official design implementations, or example decks. Do not probe documented APIs. After a concrete
diagnostic, inspect only the one named public declaration or guide needed to resolve it.

Do not replace the installed project version with `drever@latest` after scaffolding. Detect the
project's package manager and use its local executable for every command.

The work is not complete when the plan is written, when a server starts, or when a build succeeds.
Respect the mandatory plan-approval pause, then continue through the installed creation, design,
authoring, review, and delivery contracts until the requested presentation is genuinely ready.
