import { COMPILE_PLAN_VERSION, type CompilePlan } from "@drever/schema";

type TestPlanOptions = Readonly<{
  target?: CompilePlan["target"];
  plugins?: CompilePlan["plugins"];
  build?: Partial<CompilePlan["build"]>;
  runtime?: Partial<CompilePlan["runtime"]>;
}>;

export const createTestPlan = (options: TestPlanOptions = {}): CompilePlan => ({
  version: COMPILE_PLAN_VERSION,
  target: options.target ?? "canonical",
  theme: {
    id: "@drever/theme-test",
    tokens: { color: { canvas: "#fff", text: "#111" } },
    manifest: { title: "Test", summary: "Vite adapter test theme." },
  },
  plugins: options.plugins ?? [],
  build: {
    remark: [],
    rehype: [],
    recma: [],
    vite: [],
    ...options.build,
  },
  runtime: {
    elements: [],
    layouts: [],
    components: [],
    styles: [],
    setup: [],
    exportSetup: [],
    ...options.runtime,
  },
});
