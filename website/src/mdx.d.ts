declare module "*.mdx" {
  import type { ComponentType } from "react";

  const MDXContent: ComponentType<{
    components?: Record<string, ComponentType<Record<string, unknown>>>;
  }>;
  export default MDXContent;
}

declare module "*.md" {
  import type { ComponentType } from "react";

  const MarkdownContent: ComponentType<{
    components?: Record<string, ComponentType<Record<string, unknown>>>;
  }>;
  export default MarkdownContent;
}
