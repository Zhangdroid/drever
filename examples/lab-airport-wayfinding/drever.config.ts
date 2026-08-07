import type { DreverConfig } from "drever";
import theme from "./design/theme.ts";

export default {
  canvas: {
    width: 1600,
    height: 900,
  },
  deck: {
    lang: "en",
    dir: "ltr",
  },
  theme,
  stage: {
    background: "./design/stage-background.tsx",
  },
} satisfies DreverConfig;
