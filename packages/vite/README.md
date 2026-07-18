# @drever/vite

The canonical Vite and MDX execution adapter for Drever. It is intended for the
`drever` CLI and advanced application integrators, not ordinary deck config.
Plugin developers may expose Vite capabilities through `@drever/plugin` rather
than asking deck authors to edit Vite configuration.

```ts
import { createDreverVitePlugins } from "@drever/vite";
import type { CompilePlan } from "@drever/schema";

export async function createViteConfig(plan: CompilePlan) {
  const result = await createDreverVitePlugins(plan);
  if (!result.ok) {
    throw new Error(result.diagnostics.map(({ message }) => message).join("\n"));
  }

  return { plugins: result.value };
}
```

The adapter loads capability descriptors, assembles the canonical MDX pipeline,
adds React support, and generates deterministic virtual modules for components,
styles, motion, and lifecycle hooks.

Generated TypeScript projects include `import "@drever/vite/virtual-modules"`
in `drever-env.d.ts`. That type-only subpath declares every private Drever
virtual module; application code should not add local `declare module` shims.

## Status

Version `0.0.0` is part of Drever's from-first-principles rewrite. The API is
under active development and is not yet stable for production use.

For the canonical adapter contract, architecture, and development setup, see
the Drever main project repository.
