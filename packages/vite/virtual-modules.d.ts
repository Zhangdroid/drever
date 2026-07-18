declare module "virtual:drever/mdx-components" {
  export const components: import("@drever/core").MDXComponents;
  export function useMDXComponents(): import("@drever/core").MDXComponents;
}

declare module "virtual:drever/runtime" {
  type PlannedTheme = import("@drever/schema").PlannedTheme;
  type ThemeMotion = Omit<NonNullable<PlannedTheme["motion"]>, "module">;

  export const theme: Omit<PlannedTheme, "motion"> &
    Readonly<{
      motion?: ThemeMotion;
    }>;
  export const motion:
    | (ThemeMotion &
        Readonly<{
          implementation: unknown;
        }>)
    | undefined;
  export function runSetup<Runtime>(runtime: Runtime): Promise<() => Promise<void>>;
}

declare module "virtual:drever/export-runtime" {
  export function runExportSetup<Runtime>(runtime: Runtime): Promise<() => Promise<void>>;
}

declare module "virtual:drever/styles.css" {}
