declare module "virtual:drever/mdx-components" {
  export const components: import("@drever/core").MDXComponents;
  export function useMDXComponents(): import("@drever/core").MDXComponents;
}

declare module "virtual:drever/runtime" {
  export const theme: import("@drever/schema").PlannedTheme;
  export function runSetup<Runtime>(runtime: Runtime): Promise<() => Promise<void>>;
}

declare module "virtual:drever/export-runtime" {
  export function runExportSetup<Runtime>(runtime: Runtime): Promise<() => Promise<void>>;
}

declare module "virtual:drever/styles.css" {}
