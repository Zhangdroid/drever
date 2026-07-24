# @drever/compiler

Deterministic MDX deck parsing and extension planning for Drever. This package
is for Drever adapters, config loaders, and authors of themes or plugin
descriptors; most deck authors will use it indirectly through the `drever` CLI.

```ts
import { parseDeck } from "@drever/compiler";

const result = parseDeck("# Opening\n\n---\n\n# Closing", {
  path: "slides.mdx",
});

if (!result.ok) {
  throw new Error(result.diagnostics.map(({ message }) => message).join("\n"));
}

console.log(result.value.slides.length); // 2
```

The compiler produces structured diagnostics and immutable, serializable
artifacts. It also exports `definePlugin`, `defineTheme`, and
`createCompilePlan`. Internal MDX grammar/finalizer exports are intended only
for canonical build adapters.

Static `<Note>...</Note>` blocks accept Markdown and are captured in each
slide's manifest as exact Markdown plus readable plain text. Drever removes
them from audience MDX before extension transforms run. JavaScript expressions
inside notes fail compilation instead of being silently omitted.

## Status

Drever is pre-1.0. The API is under active development and is not yet stable
for production use.

For the overall architecture, extension contract, and development setup, see
the Drever main project repository.
