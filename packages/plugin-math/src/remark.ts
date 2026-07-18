import { defineRemarkPlugin } from "@drever/plugin";
import remarkMath from "remark-math";

export default defineRemarkPlugin(({ pluginConfig }) => [
  remarkMath,
  {
    singleDollarTextMath:
      typeof pluginConfig.singleDollarTextMath === "boolean"
        ? pluginConfig.singleDollarTextMath
        : true,
  },
]);
