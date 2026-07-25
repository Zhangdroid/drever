# Drever feature gallery

Executable documentation for Drever's authoring and delivery surface. The deck
uses the public CLI and official Studio theme, then proves each capability with
real output rather than a mock screenshot:

- readable MDX composed with React components;
- default GitHub Flavored Markdown tables, task lists, autolinks, and strikethrough;
- opt-in LaTeX compiled to HTML and MathML;
- default build-time Shiki syntax highlighting;
- default Tailwind CSS v4 utilities without Preflight;
- opt-in animated numbers and presentation-scale bar, line, area, dot, and donut charts;
- surface-aware YouTube media;
- local React interaction and addressable Step states;
- audience, speaker, document, build, and export surfaces;
- the typed plugin boundary for custom Vite, Remark, Rehype, and MDX behavior.

Mermaid is intentionally absent because Drever does not yet ship an official
diagram plugin with stable SVG identifiers, accessibility, export, and security
contracts. The gallery documents implemented behavior only.

Run from the repository root:

```sh
vp run demo:features
```

Open <http://localhost:4324>. To keep every related link live, start all three
showcases with `vp run demo:showcases`. Local development uses ports `4320`,
`4322`, and `4324`; sibling `dist` builds use relative file links. A production
host mounts the same artifacts at `/showcase/product/`, `/showcase/motion/`, and
`/showcase/features/`.
