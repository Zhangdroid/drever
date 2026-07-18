import { defineRehypePlugin } from "@drever/plugin";
import rehypeKatex from "rehype-katex";

const strictness = (value: unknown): "error" | "ignore" | "warn" =>
  value === "error" || value === "ignore" || value === "warn" ? value : "warn";

export default defineRehypePlugin(({ pluginConfig }) => [
  rehypeKatex,
  {
    output: "htmlAndMathml",
    strict: strictness(pluginConfig.strict),
    throwOnError: typeof pluginConfig.throwOnError === "boolean" ? pluginConfig.throwOnError : true,
    trust: false,
  },
]);
