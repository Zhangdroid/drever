# Drever repository instructions

Follow [CONTRIBUTING.md](./CONTRIBUTING.md) for code, testing, language, and
commit expectations.

An official plugin change is not complete until the package behavior, Feature
Gallery output, website plugin catalog and guide, canonical official-plugin
guide, release metadata, and any default/facade wiring are updated together.
Keep consumer-facing agent skills catalog-agnostic; active plugin manifests and
authoring context are the source of capability truth.

When completed work changes published package behavior or public exports,
record it under `Unreleased` and identify the matching SemVer level. Do not
publish each small compatible fix independently; accumulate related work into a
coherent named release. Publish immediately only when the user explicitly asks,
a critical security or public regression warrants it, or the current task has
deliberately declared the accumulated batch release-ready.

At an intentional named-release boundary, pass `vp run ready` and
`vp run release:check`, then dispatch the trusted publishing workflow without
asking for a separate approval. Use a patch for a compatible fix batch, a minor
for compatible capabilities, and—while the project is on `0.x`—a minor for
breaking API changes. The `commit` channel is only for explicit distribution
testing; it is not the default completion path and does not automatically
trigger AI release smoke. Do not publish packages for website-only,
documentation-only, or showcase-only changes.
