import {
  DREVER_INTERNAL_SLIDE_COMPONENT,
  DREVER_INTERNAL_STEP_COMPONENT,
  type ThemeElementName,
} from "@drever/schema";
import type { ElementType } from "react";
import { MotionGroup, Note, Slide, Step } from "./primitives.tsx";
import { DreverRuntimeError } from "./runtime-error.ts";

export type MDXComponents = Readonly<Record<string, ElementType>>;

export type ComponentRegistryInput = Readonly<{
  elements?: Partial<Readonly<Record<ThemeElementName, ElementType>>>;
  layouts?: MDXComponents;
  components?: MDXComponents;
}>;

export const coreComponents = Object.freeze({
  MotionGroup,
  Note,
  Slide,
  Step,
}) satisfies MDXComponents;

const internalComponents = Object.freeze({
  [DREVER_INTERNAL_SLIDE_COMPONENT]: Slide,
  [DREVER_INTERNAL_STEP_COMPONENT]: Step,
}) satisfies MDXComponents;

const register = (
  source: string,
  components: MDXComponents | undefined,
  names: Map<string, string>,
  resolved: [string, ElementType][],
): void => {
  for (const [name, component] of Object.entries(components ?? {})) {
    if (Object.hasOwn(coreComponents, name) || Object.hasOwn(internalComponents, name)) {
      throw new DreverRuntimeError(
        "DREVER_RUNTIME_COMPONENT_PROTECTED",
        `Generated component registry attempted to replace protected component "${name}".`,
        { name, source },
      );
    }

    const existing = names.get(name);
    if (existing) {
      throw new DreverRuntimeError(
        "DREVER_RUNTIME_COMPONENT_CONFLICT",
        `Generated component registry contains duplicate component "${name}".`,
        { name, owners: [existing, source] },
      );
    }

    names.set(name, source);
    resolved.push([name, component]);
  }
};

export const createComponentRegistry = ({
  elements,
  layouts,
  components,
}: ComponentRegistryInput = {}): MDXComponents => {
  const names = new Map<string, string>();
  const resolved: [string, ElementType][] = [];
  register("theme:elements", elements, names, resolved);
  register("theme:layouts", layouts, names, resolved);
  register("plugins:components", components, names, resolved);
  return Object.freeze({
    ...coreComponents,
    ...internalComponents,
    ...Object.fromEntries(resolved),
  });
};
