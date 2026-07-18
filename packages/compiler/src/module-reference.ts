import type {
  Diagnostic,
  ExtensionOwner,
  ModuleReference,
  OwnedModuleReference,
  StyleReference,
} from "@drever/schema";
import { extensionDiagnostic, ownerLabel } from "./extension-diagnostic.ts";

const normalizeSpecifier = (
  specifier: string,
  baseURL: string | undefined,
  owner: ExtensionOwner,
  diagnostics: Diagnostic[],
): string | undefined => {
  if (specifier.length === 0 || specifier.trim() !== specifier || /\s/u.test(specifier)) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_MODULE_SPECIFIER_INVALID",
        `Extension "${owner.id}" contains invalid module specifier "${specifier}".`,
        "Use a package specifier, absolute path, URL, or a relative path without whitespace.",
        {
          plugin: owner.kind === "plugin" ? owner.id : undefined,
          details: { owner: ownerLabel(owner), specifier },
        },
      ),
    );
    return;
  }

  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return specifier;
  }

  if (!baseURL) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_MODULE_BASE_URL_REQUIRED",
        `Extension "${owner.id}" uses relative module "${specifier}" without baseURL.`,
        "Set baseURL: import.meta.url on the extension definition.",
        {
          plugin: owner.kind === "plugin" ? owner.id : undefined,
          details: { owner: ownerLabel(owner), specifier },
        },
      ),
    );
    return;
  }

  try {
    return new URL(specifier, baseURL).href;
  } catch {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_MODULE_BASE_URL_INVALID",
        `Extension "${owner.id}" has invalid baseURL "${baseURL}".`,
        "Use import.meta.url as the extension baseURL.",
        {
          plugin: owner.kind === "plugin" ? owner.id : undefined,
          details: { baseURL, owner: ownerLabel(owner) },
        },
      ),
    );
    return;
  }
};

export const normalizeModule = <Reference extends ModuleReference>(
  module: Reference,
  baseURL: string | undefined,
  owner: ExtensionOwner,
  diagnostics: Diagnostic[],
): Reference | undefined => {
  if (typeof module !== "object" || module === null || typeof module.specifier !== "string") {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_MODULE_REFERENCE_INVALID",
        `Extension "${owner.id}" contains an invalid module reference.`,
        "Provide an object with a string specifier.",
        {
          plugin: owner.kind === "plugin" ? owner.id : undefined,
          details: { owner: ownerLabel(owner) },
        },
      ),
    );
    return;
  }

  const specifier = normalizeSpecifier(module.specifier, baseURL, owner, diagnostics);
  if (!specifier) {
    return;
  }

  if (
    module.exportName !== undefined &&
    (typeof module.exportName !== "string" ||
      module.exportName.length === 0 ||
      module.exportName.trim() !== module.exportName)
  ) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_MODULE_EXPORT_INVALID",
        `Extension "${owner.id}" contains invalid export name "${module.exportName}".`,
        'Use a non-empty export name or omit exportName for "default".',
        {
          plugin: owner.kind === "plugin" ? owner.id : undefined,
          details: { exportName: module.exportName, owner: ownerLabel(owner) },
        },
      ),
    );
    return;
  }

  return { ...module, specifier };
};

export const normalizeStyle = (
  style: StyleReference,
  baseURL: string | undefined,
  owner: ExtensionOwner,
  diagnostics: Diagnostic[],
): StyleReference | undefined => {
  if (typeof style !== "object" || style === null || typeof style.specifier !== "string") {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_STYLE_REFERENCE_INVALID",
        `Extension "${owner.id}" contains an invalid style reference.`,
        "Provide an object with a string specifier and a valid cascade layer.",
        {
          plugin: owner.kind === "plugin" ? owner.id : undefined,
          details: { owner: ownerLabel(owner) },
        },
      ),
    );
    return;
  }

  const specifier = normalizeSpecifier(style.specifier, baseURL, owner, diagnostics);
  return specifier ? { ...style, specifier } : undefined;
};

export const collectOwnedModules = <Reference extends ModuleReference>(
  references: readonly Reference[] | undefined,
  owner: ExtensionOwner,
  baseURL: string | undefined,
  diagnostics: Diagnostic[],
): OwnedModuleReference<Reference>[] =>
  (references ?? []).flatMap((reference) => {
    const module = normalizeModule(reference, baseURL, owner, diagnostics);
    return module ? [{ owner, module }] : [];
  });
