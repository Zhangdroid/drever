import lockupDarkHref from "@drever/brand/assets/drever-lockup-dark.svg";
import lockupHref from "@drever/brand/assets/drever-lockup.svg";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { githubURL, primaryNavigation } from "../site-data";
import { CopyAIHandoff } from "./ai-handoff";
import { ArrowUpRightIcon, GithubIcon } from "./icons";

export function SiteHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const headerRef = useRef<HTMLElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const [tone, setTone] = useState<"dark" | "light">("light");

  useEffect(() => {
    let frame = 0;
    const updateTone = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const header = headerRef.current;
        if (header === null) return;

        const bounds = header.getBoundingClientRect();
        const elements = document.elementsFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        );
        const surface = elements
          .filter((element) => !header.contains(element))
          .map((element) => element.closest<HTMLElement>("[data-header-tone]"))
          .find((element) => element !== null);
        setTone(surface?.dataset.headerTone === "dark" ? "dark" : "light");
      });
    };

    updateTone();
    window.addEventListener("resize", updateTone);
    window.addEventListener("scroll", updateTone, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateTone);
      window.removeEventListener("scroll", updateTone);
    };
  }, [pathname]);

  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", tone === "dark" ? "#111018" : "#f6f3e9");
  }, [tone]);

  useLayoutEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;

    let frame = 0;
    const updateIndicator = (animate: boolean) => {
      const activeLink = navigation.querySelector<HTMLElement>("a.is-active");
      if (!activeLink) {
        delete navigation.dataset.hasActive;
        return;
      }

      const navigationBounds = navigation.getBoundingClientRect();
      const activeBounds = activeLink.getBoundingClientRect();
      const nextPosition = {
        width: activeBounds.width,
        x: activeBounds.left - navigationBounds.left,
      };

      navigation.dataset.hasActive = "true";
      navigation.style.setProperty("--site-nav-indicator-width", `${nextPosition.width}px`);
      navigation.style.setProperty("--site-nav-indicator-x", `${nextPosition.x}px`);

      if (!animate || navigation.dataset.indicatorReady === "true") return;
      frame = requestAnimationFrame(() => {
        navigation.dataset.indicatorReady = "true";
      });
    };

    updateIndicator(true);
    const handleResize = () => updateIndicator(false);
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, [pathname]);

  return (
    <header className="site-header" data-tone={tone} ref={headerRef}>
      <div className="site-header__inner">
        <Link aria-label="Drever home" className="site-header__brand" to="/">
          <img alt="" src={tone === "dark" ? lockupDarkHref : lockupHref} />
        </Link>

        <nav aria-label="Primary navigation" className="site-header__nav" ref={navigationRef}>
          {primaryNavigation.map((item) => {
            const isParentLocation = pathname !== item.href && pathname.startsWith(`${item.href}/`);
            return (
              <Link
                activeOptions={{ exact: true }}
                activeProps={{ "aria-current": "page", className: "is-active" }}
                aria-current={isParentLocation ? "location" : undefined}
                className={isParentLocation ? "is-active" : undefined}
                key={item.href}
                to={item.href}
              >
                {item.label}
              </Link>
            );
          })}
          <i className="site-header__indicator" aria-hidden="true" />
        </nav>

        <div className="site-header__utility">
          <CopyAIHandoff className="site-header__ai" />
          <a
            aria-label="Drever on GitHub"
            className="site-header__github"
            href={githubURL}
            rel="noreferrer"
            target="_blank"
          >
            <GithubIcon />
            <span>GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer" data-header-tone="dark">
      <div className="site-footer__lead">
        <img alt="Drever" src={lockupDarkHref} />
        <p>Clear ideas. Expressive slides. One editable source.</p>
      </div>

      <div className="site-footer__links">
        <div>
          <span>Explore</span>
          <Link activeOptions={{ exact: true }} to="/docs">
            Documentation
          </Link>
          <Link activeOptions={{ exact: true }} to="/showcase">
            Showcase
          </Link>
        </div>
        <div>
          <span>Project</span>
          <a href={githubURL} rel="noreferrer" target="_blank">
            GitHub <ArrowUpRightIcon />
          </a>
          <a href="https://www.npmjs.com/package/create-drever" rel="noreferrer" target="_blank">
            npm <ArrowUpRightIcon />
          </a>
          <a href="/prompt.md">prompt.md</a>
          <a href="/llms.txt">llms.txt</a>
          <Link activeOptions={{ exact: true }} to="/docs/credits">
            Credits
          </Link>
        </div>
      </div>

      <div className="site-footer__bottom">
        <span>Open source under the MIT License.</span>
        <span>Drever is under active development.</span>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const heading = document.querySelector("main h1");
      if (!(heading instanceof HTMLElement)) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
