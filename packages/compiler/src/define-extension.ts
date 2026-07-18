import type { DreverPlugin, ThemeDefinition } from "@drever/schema";

export const definePlugin = <const Plugin extends DreverPlugin>(plugin: Plugin): Plugin => plugin;

export const defineTheme = <const Theme extends ThemeDefinition>(theme: Theme): Theme => theme;
