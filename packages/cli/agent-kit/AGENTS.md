<!-- drever-agent-kit:start -->

## Drever presentation authoring

- Treat the configured MDX entry, normally `slides.mdx`, as the source of truth.
- Run `drever context --json` before substantial authoring work. It describes the exact slide and Step manifest, source ranges, active design system, components, and current preflight findings.
- Separate slides with a root-level `---`. Use static `Step` elements for meaningful reveals and static `Note` elements for speaker-only guidance.
- Prefer semantic Markdown and documented theme layouts over one-off containers. Use React components only when interaction materially improves the explanation.
- Never edit `dist/`, `.drever/`, `__DreverSlide`, or `__DreverStep`.
- Run `drever check --json` and `drever build` after authored changes. Inspect affected exact slide and Step routes when browser tooling is available.
- Use the project skills under `.agents/skills` for creation, focused authoring, and presentation-readiness review.

<!-- drever-agent-kit:end -->
