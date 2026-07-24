# @drever/plugin

Capability-specific build and runtime contracts for Drever plugin authors. Use
this package inside plugin implementation modules; use `@drever/compiler` to
define the published plugin descriptor that references those modules.

```ts
import { defineRemarkPlugin } from "@drever/plugin";

const remarkExample = () => (tree: unknown) => {
  // Transform the MDX syntax tree.
  void tree;
};

export default defineRemarkPlugin(() => remarkExample);
```

Separate helpers cover Remark, Rehype, Recma, and Vite capabilities. Every
factory receives frozen plugin identity, resolved registration config, and
hook-local options. It also receives the absolute deck `projectRoot`, so a
build plugin never has to infer the user's project from a generated adapter
root or `process.cwd()`. Runtime setup/export hook types support async acquisition
and disposal without coupling them to a build tool.

## Status

Drever is pre-1.0. The API is under active development and is not yet stable
for production use.

For the full extension model, ordering rules, and development setup, see the
Drever main project repository.
