# @drever/plugin-media

Opt-in media components for Drever. The first component is a lazy,
privacy-enhanced YouTube embed with no third-party React runtime.

```bash
pnpm add -D @drever/plugin-media
```

```ts
import { defineConfig } from "drever";
import mediaPlugin from "@drever/plugin-media";

export default defineConfig({
  plugins: [mediaPlugin],
});
```

Use a video id rather than a full URL and provide a meaningful title:

```mdx
<YouTube id="M7lc1UVf-VE" title="YouTube player API demo" start={30} aspectRatio="16:9" />
```

`id` must be an 11-character YouTube video id. `start` accepts a non-negative
whole number of seconds. `aspectRatio` accepts `16:9`, `4:3`, `1:1`, or `9:16`.
Invalid values fail with a component-specific error.

The active audience slide receives a lazy iframe from `youtube-nocookie.com`;
leaving the slide removes its remote source so playback cannot continue over
the next slide. The component does not autoplay. Speaker previews, Document
View, PDF export, and print use a stable title and link instead of loading an
iframe or a remote thumbnail.
Privacy-enhanced mode limits storage before playback, but opening or playing the
video still connects to YouTube.
