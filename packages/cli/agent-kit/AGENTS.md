<!-- drever-agent-kit:start -->

## Drever presentation authoring

- Treat the configured MDX entry, normally `slides.mdx`, as the source of truth.
- Prefer the read-only `drever_get_context`, `drever_get_slide`, `drever_check`, and `drever_get_current` MCP tools when connected. Otherwise run `drever context --json` before substantial authoring work. These contracts describe the exact slide and Step manifest, source ranges, active design system, components, and current preflight findings.
- Separate slides with a root-level `---`. Use static `Step` elements for meaningful reveals and static `Note` elements for speaker-only guidance.
- Prefer semantic Markdown and documented theme layouts over one-off containers. Use React components only when interaction materially improves the explanation.
- Derive the visual system from the subject, audience, and purpose. When research is allowed, use current primary official sources and respect asset and font licenses.
- Never edit `dist/`, `.drever/`, `__DreverSlide`, or `__DreverStep`.
- Run `drever check --json` and `drever build` after authored changes. Inspect affected exact slide and Step routes with rendered evidence. If rendered inspection is unavailable, report the gap and do not claim presentation readiness.
- Use the project-local `drever-review-deck` skill as the completion gate after creating or materially editing a deck. Fix material rendered issues and repeat affected review passes; successful commands alone do not prove presentation readiness.
- Use the project-local Drever skills for creation, subject-led art direction, focused authoring, presentation-readiness review, and delivery.

<!-- drever-agent-kit:end -->
