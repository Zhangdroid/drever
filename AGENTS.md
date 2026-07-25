# Drever repository instructions

Follow [CONTRIBUTING.md](./CONTRIBUTING.md) for code, testing, language, and
commit expectations.

An official plugin change is not complete until the package behavior, Feature
Gallery output, website plugin catalog and guide, canonical official-plugin
guide, release metadata, and any default/facade wiring are updated together.
Keep consumer-facing agent skills catalog-agnostic; active plugin manifests and
authoring context are the source of capability truth.

When completed work changes published package behavior or public exports, treat
release as part of completion: update the changelog, choose the matching SemVer
level, pass `vp run ready` and `vp run release:check`, then dispatch the trusted
publishing workflow without asking for a separate approval. Use a patch for
compatible fixes, a minor for compatible capabilities, and—while the project is
on `0.x`—a minor for breaking API changes. Do not publish packages for
website-only, documentation-only, or showcase-only changes.
