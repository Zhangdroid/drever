# Create a Drever presentation

Use these instructions when a user asks you to create a Drever presentation.

## Understand the handoff

Treat the user's accompanying message as the presentation brief. Infer a clear project name,
audience, desired outcome, duration, tone, source material, and requested deliverables. State
reasonable assumptions. Ask only when missing facts or decisions would materially change the
result.

## Prepare a safe workspace

Inspect the current workspace before writing files.

- If it is already a Drever project, use it and its installed Drever version.
- If the workspace is empty, scaffold there.
- Otherwise create a new, clearly named child directory.
- Never overwrite or mix a scaffold into unrelated files.

Verify that Node.js 24.18 or newer is available. Use an existing version manager when possible. Ask
before changing the user's system environment or installing a system package manager.

Create a new project with:

```sh
npm create drever@latest <project-directory>
```

Do not use `--open` because you are already the active agent. Keep dependency installation and both
project agent adapters enabled unless the user requested otherwise.

## Follow the project contract

Enter the project and explicitly read the instructions for the current agent, the project-local
Drever skills, `brief.md`, `package.json`, the configuration, and the configured MDX entry.

The generated, version-matched project instructions override this bootstrap document. Never
substitute `drever@latest` for the installed project version after creation.

Write the normalized brief to `brief.md`, then follow the project-local creation workflow. Design
from the subject, audience, and purpose rather than choosing a random attractive style. When a
topic has an established visual language and research is allowed, consult current primary official
sources for color, typography, imagery, and motion cues. Respect asset and font licenses, and create
an original interpretation instead of copying a website.

## Finish the job

Use the project-local workflow to check and build the presentation. Start the development server
and inspect the audience view when browser tooling is available. Review every authored reveal and
the document view; review the speaker view when notes or timing are involved. Export a PDF only
when requested.

Fix proven errors before finishing. Leave the local preview running when that helps the user review
the result.

## Report the result

Tell the user:

- where the project was created;
- the preview URL and requested output paths;
- assumptions you made;
- checks and visual review completed;
- any remaining judgment calls.

Never invent facts, URLs, artifacts, or successful visual inspection.
