import type { Config } from "@react-router/dev/config";

export default {
  ssr: false,
  prerender: ["/", "/docs"],
} satisfies Config;
