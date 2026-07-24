import type { Diagnostic, ExtensionOwner, ThemeElementName } from "@drever/schema";
import { extensionDiagnostic, ownerLabel } from "./extension-diagnostic.ts";

const THEME_ELEMENT_NAMES: ReadonlySet<string> = new Set([
  "a",
  "blockquote",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

const PROTECTED_COMPONENT_NAMES: ReadonlySet<string> = new Set([
  "MotionGroup",
  "Note",
  "Slide",
  "SlideTransition",
  "Step",
]);

export const isThemeElementName = (name: string): name is ThemeElementName =>
  THEME_ELEMENT_NAMES.has(name);

const isComponentName = (value: string): boolean => /^[A-Z][A-Za-z\d]*$/u.test(value);

export const registerComponentName = (
  name: string,
  owner: ExtensionOwner,
  names: Map<string, string>,
  diagnostics: Diagnostic[],
): boolean => {
  const plugin = owner.kind === "plugin" ? owner.id : undefined;
  if (!isComponentName(name)) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_COMPONENT_NAME_INVALID",
        `Component "${name}" from "${owner.id}" is not a valid public MDX component name.`,
        "Use a PascalCase ASCII component name.",
        { plugin, details: { name, owner: ownerLabel(owner) } },
      ),
    );
    return false;
  }

  if (PROTECTED_COMPONENT_NAMES.has(name)) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_COMPONENT_PROTECTED",
        `Component "${name}" is a protected Drever primitive and cannot be replaced.`,
        "Choose a different component or layout name.",
        { plugin, details: { name, owner: ownerLabel(owner) } },
      ),
    );
    return false;
  }

  const existing = names.get(name);
  if (existing) {
    diagnostics.push(
      extensionDiagnostic(
        "DREVER_COMPONENT_CONFLICT",
        `Component "${name}" is provided by both "${existing}" and "${ownerLabel(owner)}".`,
        "Rename or explicitly alias one component; Drever does not silently override components.",
        { plugin, details: { name, owners: [existing, ownerLabel(owner)] } },
      ),
    );
    return false;
  }

  names.set(name, ownerLabel(owner));
  return true;
};
