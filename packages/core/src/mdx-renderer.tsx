import { createElement, type ComponentType, type ReactElement } from "react";
import { createComponentRegistry, type MDXComponents } from "./component-registry.ts";

export type MDXContentProps = Readonly<{
  components?: MDXComponents;
}>;

export type MDXContent = ComponentType<MDXContentProps>;

export type MDXRendererProps = Readonly<{
  Content: MDXContent;
  registry?: MDXComponents;
}>;

const defaultRegistry = createComponentRegistry();

export const MDXRenderer = ({
  Content,
  registry = defaultRegistry,
}: MDXRendererProps): ReactElement => createElement(Content, { components: registry });
