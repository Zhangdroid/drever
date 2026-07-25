import { expect, test } from "@playwright/test";
import { monitorPageHealth } from "./support/page-health.ts";

type RoomAudioTestState = Readonly<{
  requests: number;
  stoppedTracks: number;
}>;

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    const state = { requests: 0, stoppedTracks: 0 };
    Object.defineProperty(window, "__dreverRoomAudioTest", {
      configurable: true,
      value: state,
    });

    const track = {
      addEventListener: () => undefined,
      stop: () => {
        state.stoppedTracks += 1;
      },
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          state.requests += 1;
          return {
            getAudioTracks: () => [track],
            getTracks: () => [track],
          };
        },
      },
    });

    class RoomAudioContext {
      readonly destination = {};
      readonly sampleRate = 48_000;

      createAnalyser() {
        return {
          connect: () => undefined,
          fftSize: 256,
          get frequencyBinCount() {
            return this.fftSize / 2;
          },
          getByteFrequencyData: (data: Uint8Array) => data.fill(92),
          smoothingTimeConstant: 0,
        };
      }

      createGain() {
        return { connect: () => undefined, gain: { value: 1 } };
      }

      createMediaStreamSource() {
        return {
          connect: () => undefined,
          disconnect: () => undefined,
        };
      }

      close() {
        return Promise.resolve();
      }

      resume() {
        return Promise.resolve();
      }

      suspend() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: RoomAudioContext,
    });
  });
});

const audioState = async (page: import("@playwright/test").Page): Promise<RoomAudioTestState> =>
  page.evaluate(() => {
    const state = (
      window as Window &
        typeof globalThis & {
          __dreverRoomAudioTest: RoomAudioTestState;
        }
    ).__dreverRoomAudioTest;
    return { requests: state.requests, stoppedTracks: state.stoppedTracks };
  });

test("the active opening requests one microphone and drives the full Stage", async ({
  context,
  page,
}) => {
  const health = monitorPageHealth(page);
  await page.goto("/");

  const ambient = page.locator('.drever-room-audio[data-variant="ambient"]');
  const stage = page.locator("[data-drever-stage]");
  await expect(ambient).toHaveCount(1);
  await expect(ambient.locator("button")).toHaveCount(0);
  await expect(stage).toHaveAttribute("data-drever-room-audio-active", "");
  await expect.poll(() => audioState(page)).toMatchObject({ requests: 1 });
  await expect
    .poll(() =>
      stage.evaluate((element) =>
        Number.parseFloat(element.style.getPropertyValue("--drever-audio-low")),
      ),
    )
    .toBeGreaterThan(0.5);

  const fieldOpacity = await stage.evaluate((element) => {
    const read = (selector: string) => {
      const target = element.querySelector(selector);
      return target === null ? 0 : Number.parseFloat(getComputedStyle(target, "::after").opacity);
    };
    return {
      lime: read('[data-signal="primary"]'),
      nearRing: read('[data-orbit="near"]'),
      violet: read('[data-signal="secondary"]'),
    };
  });
  expect(fieldOpacity.lime).toBeGreaterThan(0.2);
  expect(fieldOpacity.violet).toBeGreaterThan(0.2);
  expect(fieldOpacity.nearRing).toBeGreaterThan(0.2);

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/2$/u);
  await expect(stage).not.toHaveAttribute("data-drever-room-audio-active");
  await expect.poll(() => audioState(page)).toMatchObject({ requests: 1, stoppedTracks: 1 });
  health.expectHealthy();

  for (const route of ["/2", "/speaker/2", "/document"]) {
    const surface = await context.newPage();
    await surface.goto(route);
    await surface.waitForTimeout(250);
    expect(await audioState(surface), route).toMatchObject({ requests: 0 });
    await surface.close();
  }
});
