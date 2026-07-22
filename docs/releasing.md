# Releasing Drever

Drever publishes its public packages with one lockstep version. In particular,
`drever`, `create-drever`, and `@drever/agent` must always share the same
version so project creation and global agent workflows stay compatible.

Before publishing, run:

```sh
pnpm release:check
```

The release gate:

1. builds every workspace package;
2. verifies public package versions, licenses, descriptions, and required tarball files;
3. packs every public package;
4. installs those tarballs in a clean temporary project outside the workspace;
5. runs the packed `create-drever`, then validates and builds the generated deck with the packed `drever` CLI.

The gate also verifies the Codex and Claude plugin manifests, the Claude
marketplace version, and the byte-identical packaged copy of every canonical
agent skill. Plugin packaging fails when a generated file is missing, changed,
or unexpectedly added.

This clean-consumer flow is required because workspace resolution can hide missing package dependencies and native bindings.

Publishing should use npm provenance and two-factor authentication. The release process must not use `postinstall` scripts to modify user files or install Playwright Chromium. PDF browser installation remains an explicit, recoverable delivery step.
