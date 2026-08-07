import type { DreverConfig } from "drever";
import rivertonTheme from "./design/theme.ts";

export default {
  canvas: {
    width: 1600,
    height: 900,
  },
  deck: {
    lang: "en",
    dir: "ltr",
  },
  theme: rivertonTheme,
  stage: {
    background: "./design/stage-background.tsx",
  },
} satisfies DreverConfig;
