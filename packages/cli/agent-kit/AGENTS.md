<!-- drever-agent-kit:start -->

## Drever presentation authoring

- Treat the configured MDX entry, normally `slides.mdx`, as the source of truth.
- Prefer the read-only `drever_get_context`, `drever_get_slide`, `drever_check`, and `drever_get_current` MCP tools when connected. For an existing deck, use them before a substantial edit. For a new deck, expose the coherent Draft 1 first, then run `npm exec -- drever context --json` and the fuller checks. These contracts describe the exact slide and Step manifest, source ranges, active design system, components, and current preflight findings.
- Treat this generated kit and the resolved authoring context as the complete public contract. During ordinary deck creation, do not inspect Drever repository or package source, `node_modules`, declaration files, schemas, internals, official design implementations, or example decks. Load project-local skills only for the active phase. After a concrete diagnostic, inspect at most the one named public declaration or guide required to resolve it.
- Detect the project's package manager before invoking its local CLI. Use `npm exec -- drever`, `pnpm exec drever`, `yarn exec drever`, or `bunx --no-install drever` as appropriate, and use the same manager for project scripts. Examples below use npm syntax; never assume a bare global `drever` executable is on `PATH`.
- Separate slides with a root-level `---`. Author `Step` as static MDX JSX in the slide body, never inside a JavaScript expression, component implementation, or JSX-valued prop. Use `Note` for speaker-only guidance.
- Prefer semantic Markdown and documented theme layouts over one-off containers. Use React components only when interaction materially improves the explanation.
- Derive the visual system from the subject, audience, and purpose. When research is allowed, use current primary official sources and respect asset and font licenses.
- Never edit `dist/`, `.drever/`, `__DreverSlide`, or `__DreverStep`.
- During creation and iteration, keep one development preview alive and update it through HMR. Share a coherent Draft 1 before exhaustive validation, continue without waiting for approval, and do not run repeated production builds merely to expose changes. Before final delivery, run `npm exec -- drever check --json` and `npm exec -- drever build`, then inspect affected exact slide and Step routes with rendered evidence. If rendered inspection is unavailable, report the gap and do not claim presentation readiness.
- Use the project-local `drever-review-deck` skill as the completion gate after creating or materially editing a deck. Fix material rendered issues and repeat affected review passes; successful commands alone do not prove presentation readiness.
- Use the project-local Drever skills for creation, subject-led art direction, focused authoring, presentation-readiness review, and delivery. Do not load every skill before Draft 1.

<!-- drever-agent-kit:end -->
