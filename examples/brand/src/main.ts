import dreverLockupDarkUrl from "@drever/brand/assets/drever-lockup-dark.svg";
import dreverLockupUrl from "@drever/brand/assets/drever-lockup.svg";
import dreverMarkDarkUrl from "@drever/brand/assets/drever-mark-dark.svg";
import dreverMarkUrl from "@drever/brand/assets/drever-mark.svg";
import dreverFaviconUrl from "@drever/brand/assets/favicon.svg";
import "@drever/brand/fonts.css";
import "@drever/brand/tokens.css";
import "./styles.css";

type Theme = "light" | "dark";

const root = document.documentElement;
const favicon = document.querySelector<HTMLLinkElement>("[data-drever-favicon]")!;
const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;
const themeToggle = document.querySelector<HTMLButtonElement>("[data-theme-toggle]")!;
const themeLabel = document.querySelector<HTMLElement>("[data-theme-label]")!;
const motionDemo = document.querySelector<HTMLElement>("[data-motion-demo]")!;
const motionReplay = document.querySelector<HTMLButtonElement>("[data-motion-replay]")!;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const systemTheme = matchMedia("(prefers-color-scheme: dark)");

favicon.href = dreverFaviconUrl;

const savedTheme = localStorage.getItem("drever-brand-theme");
let theme: Theme =
  savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : systemTheme.matches
      ? "dark"
      : "light";

function applyTheme(nextTheme: Theme): void {
  theme = nextTheme;
  root.dataset.theme = theme;

  const isDark = theme === "dark";
  themeToggle.ariaPressed = String(isDark);
  themeToggle.ariaLabel = `Switch to ${isDark ? "light" : "dark"} mode`;
  themeLabel.textContent = isDark ? "Light" : "Dark";
  themeColor.content = isDark ? "#0d1019" : "#f8f8f4";

  for (const image of document.querySelectorAll<HTMLImageElement>("[data-drever-lockup]")) {
    image.src = isDark ? dreverLockupDarkUrl : dreverLockupUrl;
  }

  for (const image of document.querySelectorAll<HTMLImageElement>("[data-drever-mark]")) {
    const useDarkAsset =
      image.dataset.logoTheme === "dark" || (image.dataset.logoTheme !== "light" && isDark);
    image.src = useDarkAsset ? dreverMarkDarkUrl : dreverMarkUrl;
  }
}

applyTheme(theme);

themeToggle.addEventListener("click", () => {
  const nextTheme = theme === "light" ? "dark" : "light";
  localStorage.setItem("drever-brand-theme", nextTheme);
  document.startViewTransition(() => applyTheme(nextTheme));
});

motionReplay.addEventListener("click", () => {
  motionDemo.classList.remove("is-playing");
  if (reducedMotion.matches) return;
  void motionDemo.offsetWidth;
  motionDemo.classList.add("is-playing");
});

motionDemo.addEventListener("animationend", (event) => {
  if ((event.target as Element).classList.contains("motion-pulse")) {
    motionDemo.classList.remove("is-playing");
  }
});

document.querySelector<HTMLElement>("[data-current-year]")!.textContent = String(
  new Date().getFullYear(),
);
