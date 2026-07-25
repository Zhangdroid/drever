# Create a Drever presentation

Use these instructions when a user asks you to create a Drever presentation.

## Run a useful, optional briefing

Treat the user's accompanying message as the initial presentation brief. Reply in the user's
language, and use that language for the deck unless they request another one or the source material
clearly requires it.

If the topic itself is missing, ask for it before creating files and let the user answer **Surprise
me** to delegate the subject too. Once the topic is known, infer everything the user already
supplied.

At the start of every question round, offer this escape:

> **Skip remaining questions — surprise me.** I will choose the unresolved details, record the
> assumptions, and start.

Questions may span multiple rounds when an earlier answer enables a useful topic-specific
follow-up. Ask one to three concise questions at a time, highest-impact first, and continue only
while another answer would materially improve the result. Draw from:

1. What should the audience understand, decide, or do?
2. How long is the presentation?
3. Should slides be concise with fuller speaker notes, balanced, or reference-dense?
4. Should motion be restrained, expressive, or intentionally experimental?
5. Ask at most one topic-specific fork per round, such as practical code versus concepts,
   comparison versus recommendation, or overview versus migration.

Do not ask for information the user already gave. Never silently choose a duration unless the user
selected surprise mode. If they select surprise mode at any point, stop asking, make reasonable
assumptions, and continue. If the initial brief is already complete, proceed immediately.

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

Unless the user explicitly asks for a fast plain draft, use the project-local design workflow for a
subject-led visual system rather than stopping at a generic preset. Plan a few signature moments
that make the subject recognizable, then support them with quieter slides. A substantial local
visual implementation is welcome when it earns its space through explanation, atmosphere, or
interaction; do not reduce it merely to minimize generated code.

## Finish the job

Use the project-local workflow to check and build the presentation. Start the development server
and inspect the audience view when browser tooling is available. Review every authored reveal and
the document view; review the speaker view when notes or timing are involved. Export a PDF only
when requested.

Treat syntax-highlighted code, topic-specific visuals, stable motion, contrast, alignment, and
overflow as rendered requirements rather than assumptions. Fix proven errors before finishing.
Leave the local preview running when that helps the user review the result.

## Report the result

Tell the user:

- where the project was created;
- the preview URL and requested output paths;
- assumptions you made;
- checks and visual review completed;
- any remaining judgment calls.

Never invent facts, URLs, artifacts, or successful visual inspection.
