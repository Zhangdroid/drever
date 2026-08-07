import { spawn, type ChildProcess } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, relative, sep } from "node:path";
import { expect, test } from "@playwright/test";
import { monitorPageHealth } from "./support/page-health.ts";

const workspaceRoot = join(import.meta.dirname, "..");
const fixtureRoot = join(import.meta.dirname, "fixtures", "core-deck");
const dreverCli = join(workspaceRoot, "packages", "cli", "dist", "bin.mjs");

const availablePort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new TypeError("The Studio test could not reserve a local port.");
  }
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
};

const stop = async (process: ChildProcess): Promise<void> => {
  if (process.exitCode !== null) return;
  const waitForExit = async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (process.exitCode !== null) return true;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return false;
  };
  process.kill("SIGTERM");
  if (await waitForExit()) return;
  process.kill("SIGKILL");
  await waitForExit();
};

const waitForStudioUrl = async (
  process: ChildProcess,
  readOutput: () => string,
): Promise<string> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (process.exitCode !== null) {
      throw new Error("The Drever dev server exited before publishing its Studio URL.");
    }
    const url = readOutput().match(/Creation room:\s+(https?:\/\/\S+)/u)?.[1];
    if (url !== undefined) return url;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("The Drever dev server did not publish its Studio URL within ten seconds.");
};

const planSlide = (
  index: number,
  title: string,
  job: "opening" | "claim" | "evidence" | "demo" | "close",
) => ({
  id: `story-${String(index)}`,
  job,
  title,
  purpose: `Keep the stable core fixture contract visible on slide ${String(index)}.`,
  evidence: [`Core fixture evidence ${String(index)}`],
  focalArtifact: `Core fixture artifact ${String(index)}`,
});

const approvedPlan = {
  version: 2,
  status: "approved",
  brief: {
    topic: "Stable Drever browser contracts",
    audience: "Drever contributors",
    desiredChange: "Trust the live draft bridge across Studio and the embedded presentation",
    durationMinutes: 5,
    language: "en",
    density: "concise",
  },
  slides: [
    planSlide(1, "Slides can stay useful.", "opening"),
    planSlide(2, "Motion should carry meaning.", "claim"),
    planSlide(3, "Static output and living interface", "evidence"),
    planSlide(4, "Interfaces remember.", "demo"),
    planSlide(5, "Stable identities begin with explicit geometry.", "evidence"),
    planSlide(6, "Position may change without changing identity.", "claim"),
    planSlide(7, "Ship the story.", "close"),
  ],
} as const;

const prepareFixture = async (root: string, port: number): Promise<void> => {
  await cp(fixtureRoot, root, {
    recursive: true,
    filter(source) {
      const path = relative(fixtureRoot, source);
      return !(
        path === "node_modules" ||
        path.startsWith(`node_modules${sep}`) ||
        path === ".drever" ||
        path.startsWith(`.drever${sep}`) ||
        path === "drever.plan.json"
      );
    },
  });
  await symlink(join(fixtureRoot, "node_modules"), join(root, "node_modules"), "dir");

  const configPath = join(root, "drever.config.ts");
  const planPath = join(root, "drever.plan.json");
  const studioRoot = join(root, ".drever", "studio");
  const config = await readFile(configPath, "utf8");
  await writeFile(configPath, config.replace("port: 4317", `port: ${String(port)}`), "utf8");
  await writeFile(planPath, JSON.stringify(approvedPlan), "utf8");
  const actionsRoot = join(studioRoot, "actions");
  await mkdir(actionsRoot, { recursive: true });
  await writeFile(
    join(actionsRoot, "00000001.json"),
    JSON.stringify({
      version: 1,
      revision: 1,
      receivedAt: "2026-08-05T12:00:00.000Z",
      action: {
        version: 1,
        requestId: "studio-live-draft-e2e",
        expectedRevision: 0,
        type: "submit-common-brief",
        brief: {
          topic: approvedPlan.brief.topic,
          audience: approvedPlan.brief.audience,
          desiredChange: approvedPlan.brief.desiredChange,
          durationMinutes: approvedPlan.brief.durationMinutes,
          language: approvedPlan.brief.language,
          density: approvedPlan.brief.density,
        },
      },
    }),
    "utf8",
  );
  await writeFile(
    join(studioRoot, "state.json"),
    JSON.stringify({
      version: 1,
      phase: "preview",
      handledActionRevision: 1,
      activity: [
        {
          id: "story-approved",
          label: "Story approved",
          detail: "The stable core fixture is ready for authoring.",
          status: "complete",
        },
        {
          id: "draft-started",
          label: "Draft 1 started",
          detail: "The presentation source and speaker notes are being assembled.",
          status: "complete",
        },
        ...Array.from({ length: 9 }, (_, index) => ({
          id: `draft-pass-${String(index + 1)}`,
          label: `Draft refinement ${String(index + 1)}`,
          detail: "A bounded refinement was published without changing the approved story.",
          status: "complete" as const,
        })),
        {
          id: "draft-ready",
          label: "Draft 1 published",
          detail: "The stable core fixture is ready for review.",
          status: "complete",
        },
      ],
    }),
    "utf8",
  );
  await writeFile(
    join(studioRoot, "agent-heartbeat.json"),
    JSON.stringify({ version: 1, seenAt: new Date().toISOString() }),
    "utf8",
  );
};

test("Studio keeps the embedded live draft navigable with real speaker notes", async ({ page }) => {
  test.setTimeout(90_000);
  const root = await mkdtemp(join(workspaceRoot, ".drever-studio-e2e-"));
  let server: ChildProcess | undefined;
  let output = "";

  try {
    const port = await availablePort();
    await prepareFixture(root, port);
    server = spawn(process.execPath, [dreverCli, "dev"], {
      cwd: root,
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
    server.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
    const studioUrl = await waitForStudioUrl(server, () => output);
    let presentationRequests = 0;
    await page.route(/\/presentation\.js(?:\?|$)/u, async (route) => {
      presentationRequests += 1;
      if (presentationRequests === 1) {
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    await page.goto(studioUrl);

    const iframe = page.locator('iframe[title="Live Drever draft"]');
    await expect(iframe).toBeVisible();
    await expect(
      page
        .frameLocator('iframe[title="Live Drever draft"]')
        .getByRole("navigation", { name: "Presentation controls" }),
    ).toBeVisible({ timeout: 60_000 });
    expect(presentationRequests).toBeGreaterThan(1);
    const currentDraft = async () => {
      const iframeHandle = await iframe.elementHandle();
      const draft = await iframeHandle?.contentFrame();
      if (draft === undefined || draft === null) {
        throw new TypeError("Studio did not attach the live draft frame.");
      }
      await draft.waitForLoadState("domcontentloaded");
      return draft;
    };

    const draft = await currentDraft();
    expect(await draft.evaluate(() => document.fullscreenEnabled)).toBe(true);
    await draft.evaluate(() => {
      const state = globalThis as typeof globalThis & { __dreverStudioFullscreen: boolean };
      state.__dreverStudioFullscreen = false;
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        get: () => (state.__dreverStudioFullscreen ? document.documentElement : null),
      });
      Object.defineProperty(document.documentElement, "requestFullscreen", {
        configurable: true,
        value: async () => {
          state.__dreverStudioFullscreen = true;
          document.dispatchEvent(new Event("fullscreenchange"));
        },
      });
      Object.defineProperty(document, "exitFullscreen", {
        configurable: true,
        value: async () => {
          state.__dreverStudioFullscreen = false;
          document.dispatchEvent(new Event("fullscreenchange"));
        },
      });
      Object.defineProperty(navigator, "wakeLock", {
        configurable: true,
        value: {
          async request() {
            return {
              addEventListener() {},
              async release() {},
              removeEventListener() {},
            };
          },
        },
      });
    });
    const controls = draft.getByRole("navigation", { name: "Presentation controls" });
    await controls.getByRole("button", { name: "Enter fullscreen" }).click();
    await expect(controls.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
    await controls.getByRole("button", { name: "Exit fullscreen" }).click();
    await expect(controls.getByRole("button", { name: "Enter fullscreen" })).toBeVisible();
    const health = monitorPageHealth(page);

    const mode = page.locator(".drever-studio-mode-switcher");
    await expect(mode.getByRole("button", { name: "Live draft" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator(".drever-studio-preview__notes small")).toContainText(
      "Speaker notes · Slide 1",
      { timeout: 20_000 },
    );
    const draftStatus = page.locator(".drever-studio-draft-status");
    const geometry = async () =>
      Promise.all(
        [
          page.locator(".drever-studio-workspace"),
          page.locator(".drever-studio-preview"),
          page.locator(".drever-studio-direction"),
          draftStatus,
          page.locator(".drever-studio-preview__frame"),
          page.locator(".drever-studio-preview iframe"),
        ].map(async (locator) => {
          const box = await locator.boundingBox();
          if (box === null) throw new TypeError("Studio geometry was unavailable.");
          return box;
        }),
      );
    const beforeHistory = await geometry();
    await draftStatus.getByRole("button", { name: /View history/u }).click();
    await expect(draftStatus.locator(".drever-studio-activity-history__reveal")).toBeVisible();
    await expect
      .poll(() =>
        draftStatus
          .locator(".drever-studio-activity-history__reveal ol")
          .evaluate((element) => element.scrollHeight > element.clientHeight),
      )
      .toBe(true);
    const afterHistory = await geometry();
    for (const [index, before] of beforeHistory.entries()) {
      const after = afterHistory[index];
      if (after === undefined) throw new TypeError("Studio geometry changed shape.");
      for (const dimension of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(after[dimension] - before[dimension])).toBeLessThan(1);
      }
    }
    await draftStatus.getByRole("button", { name: /View history/u }).click();
    await expect(draftStatus.locator(".drever-studio-activity-history__reveal")).toBeHidden();
    const afterHistoryClose = await geometry();
    for (const [index, before] of beforeHistory.entries()) {
      const after = afterHistoryClose[index];
      if (after === undefined) throw new TypeError("Studio geometry changed shape after closing.");
      for (const dimension of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(after[dimension] - before[dimension])).toBeLessThan(1);
      }
    }
    const rail = page.getByRole("navigation", { name: "Presentation slides" });
    const firstThumbnail = rail.locator('iframe[title="Slide 1 preview"]');
    await expect(firstThumbnail).toBeVisible();
    await expect(
      page
        .frameLocator('iframe[title="Slide 1 preview"]')
        .locator('[data-drever-slide][data-slide-index="0"]'),
    ).toBeVisible();
    await expect(
      page
        .frameLocator('iframe[title="Slide 1 preview"]')
        .getByRole("navigation", { name: "Presentation controls" }),
    ).toHaveCount(0);
    await expect(firstThumbnail).toHaveAttribute("src", /[?&]drever-studio-thumbnail=1(?:&|$)/u);
    const beforeSlideNavigation = await geometry();
    await rail.getByRole("button", { name: /Motion should carry meaning/u }).click();

    await expect(mode.getByRole("button", { name: "Live draft" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect.poll(async () => new URL((await currentDraft()).url()).pathname).toBe("/2");
    await expect(page.locator(".drever-studio-preview__notes")).toContainText(
      "Pause at step 2, then jump to step 5.",
    );
    const afterSlideNavigation = await geometry();
    for (const [index, before] of beforeSlideNavigation.entries()) {
      const after = afterSlideNavigation[index];
      if (after === undefined) throw new TypeError("Studio geometry changed shape between slides.");
      for (const dimension of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(after[dimension] - before[dimension])).toBeLessThan(1);
      }
    }

    const draftStep = page.getByRole("button", { name: "View Draft", exact: true });
    await page.getByRole("button", { name: "View Brief", exact: true }).click();
    await expect(page.getByLabel("Presentation topic")).toHaveValue(approvedPlan.brief.topic);
    await expect(draftStep).toHaveAttribute("aria-current", "step");
    await page.getByRole("button", { name: "Return to current step", exact: true }).click();
    await page.getByRole("button", { name: "View Direction", exact: true }).click();
    await expect(page.getByText("Your direction is saved.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Return to current step", exact: true }).click();
    await page.getByRole("button", { name: "View Storyboard", exact: true }).click();
    await expect(page.getByText("Structure preview", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve story" })).toHaveCount(0);
    await draftStep.click();
    await expect(draftStep).toHaveAttribute("aria-pressed", "true");
    await rail.getByRole("button", { name: /Motion should carry meaning/u }).click();
    await expect.poll(async () => new URL((await currentDraft()).url()).pathname).toBe("/2");

    const directionPanel = page.locator(".drever-studio-direction");
    await expect(directionPanel).toContainText("Core fixture artifact 2");
    await directionPanel.getByRole("button", { name: "Slide context" }).click();
    await expect(directionPanel).toContainText("Anchor evidence");

    const deckFeedback = directionPanel.getByRole("button", { name: "Entire deck" });
    const slideFeedback = directionPanel.getByRole("button", {
      name: /This slide: Motion should carry meaning/u,
    });
    await deckFeedback.click();
    await expect(deckFeedback).toHaveAttribute("aria-pressed", "true");
    await expect(slideFeedback).toHaveAttribute("aria-pressed", "false");
    await expect(directionPanel).toContainText("Feedback applies to the entire deck.");
    await expect(
      rail.getByRole("button", { name: /Motion should carry meaning/u }),
    ).toHaveAttribute("aria-current", "page");
    await expect.poll(async () => new URL((await currentDraft()).url()).pathname).toBe("/2");
    const feedbackBox = directionPanel.getByRole("textbox", { name: "What should change?" });
    const feedback = "Make the whole deck more concise without changing its conclusion.";
    await feedbackBox.fill(feedback);
    await page.getByRole("button", { name: "View Brief", exact: true }).click();
    const discardDialog = page.getByRole("alertdialog", { name: "Leave this step?" });
    await expect(discardDialog).toBeVisible();
    await discardDialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(feedbackBox).toHaveValue(feedback);
    await directionPanel.getByRole("button", { name: /Send to agent/u }).click();
    await expect
      .poll(async () => {
        try {
          const action = JSON.parse(
            await readFile(join(root, ".drever", "studio", "actions", "00000002.json"), "utf8"),
          ) as { action?: { scope?: { kind?: string }; type?: string } };
          return `${action.action?.type ?? ""}:${action.action?.scope?.kind ?? ""}`;
        } catch {
          return "";
        }
      })
      .toBe("submit-feedback:deck");

    await writeFile(
      join(root, ".drever", "studio", "state.json"),
      JSON.stringify({
        version: 1,
        phase: "waiting-for-agent",
        handledActionRevision: 2,
        activity: [
          {
            id: "draft-ready",
            label: "Draft 1 published",
            detail: "The stable core fixture remains available while agent telemetry reconnects.",
            status: "complete",
          },
        ],
      }),
      "utf8",
    );
    await rm(join(root, ".drever", "studio", "agent-heartbeat.json"));
    await expect(page.getByText("No agent connected", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "View previous Draft", exact: true }).click();
    await expect(page.getByText("Previous draft remains available", { exact: true })).toBeVisible();
    const previewFrame = page.locator(".drever-studio-preview__frame");
    await expect
      .poll(async () => {
        const [frameBox, iframeBox] = await Promise.all([
          previewFrame.boundingBox(),
          iframe.boundingBox(),
        ]);
        if (frameBox === null || iframeBox === null || iframeBox.height === 0) return false;
        const ratio = iframeBox.width / iframeBox.height;
        const coverage = Math.max(
          iframeBox.width / frameBox.width,
          iframeBox.height / frameBox.height,
        );
        return Math.abs(ratio - 16 / 9) < 0.03 && iframeBox.height > 200 && coverage > 0.85;
      })
      .toBe(true);
    health.expectHealthy();
  } catch (error) {
    throw new Error(`Studio Live Draft E2E failed.\n${output}`, { cause: error });
  } finally {
    if (server !== undefined) await stop(server);
    await rm(root, { force: true, recursive: true });
  }
});
