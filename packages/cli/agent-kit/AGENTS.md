<!-- drever-agent-kit:start -->

## Drever presentation authoring

- Treat the configured MDX entry, normally `slides.mdx`, as the source of truth.
- Prefer the read-only `drever_get_context`, `drever_get_slide`, `drever_check`, and `drever_get_current` MCP tools when connected. Otherwise run `drever context --json` before substantial authoring work. These contracts describe the exact slide and Step manifest, source ranges, active design system, components, and current preflight findings.
- Separate slides with a root-level `---`. Use static `Step` elements for meaningful reveals and static `Note` elements for speaker-only guidance.
- Prefer semantic Markdown and documented theme layouts over one-off containers. Use React components only when interaction materially improves the explanation.
- Never edit `dist/`, `.drever/`, `__DreverSlide`, or `__DreverStep`.
- Run `drever check --json` and `drever build` after authored changes. Inspect affected exact slide and Step routes when browser tooling is available.
- Use the project-local Drever skills for creation, focused authoring, presentation-readiness review, and delivery.

<!-- drever-agent-kit:end -->
