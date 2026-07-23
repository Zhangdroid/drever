declare module "*.mdx" {
  import type { ComponentType } from "react";

  const MDXContent: ComponentType<{
    components?: Record<string, ComponentType<Record<string, unknown>>>;
  }>;
  export default MDXContent;
}
