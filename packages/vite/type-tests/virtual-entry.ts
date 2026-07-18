import type { ViewerRuntimeModule } from "@drever/client";
import type { MDXComponents } from "@drever/core";
import { components, useMDXComponents } from "virtual:drever/mdx-components";
import { runExportSetup } from "virtual:drever/export-runtime";
import { runSetup, theme } from "virtual:drever/runtime";
import "virtual:drever/styles.css";

const registry: MDXComponents = components;
const providedRegistry: MDXComponents = useMDXComponents();
const runtime = { runSetup, theme } satisfies ViewerRuntimeModule;
const exportSetup: <Runtime>(value: Runtime) => Promise<() => Promise<void>> = runExportSetup;

void exportSetup;
void providedRegistry;
void registry;
void runtime;
