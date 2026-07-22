# Releasing Drever

Drever publishes its public packages with one lockstep version. In particular, `drever` and `create-drever` must always share the same version so `npm create drever@latest` installs a compatible creator and framework.

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

This clean-consumer flow is required because workspace resolution can hide missing package dependencies and native bindings.

Publishing should use npm provenance and two-factor authentication. The release process must not use `postinstall` scripts to modify user files or install Playwright Chromium. PDF browser installation remains an explicit, recoverable delivery step.
