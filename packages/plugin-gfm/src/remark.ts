import { defineRemarkPlugin } from "@drever/plugin";
import remarkGfm from "remark-gfm";

export default defineRemarkPlugin(({ pluginConfig }) => [
  remarkGfm,
  {
    singleTilde: typeof pluginConfig.singleTilde === "boolean" ? pluginConfig.singleTilde : true,
  },
]);
