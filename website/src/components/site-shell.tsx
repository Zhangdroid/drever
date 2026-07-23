import lockupDarkHref from "@drever/brand/assets/drever-lockup-dark.svg";
import lockupHref from "@drever/brand/assets/drever-lockup.svg";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { githubURL, primaryNavigation } from "../site-data";
import { ArrowUpRightIcon, GithubIcon } from "./icons";

export function SiteHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link aria-label="Drever home" className="site-header__brand" to="/">
          <img alt="" src={lockupHref} />
        </Link>

        <nav aria-label="Primary navigation" className="site-header__nav">
          {primaryNavigation.map((item) => {
            const isParentLocation = item.href === "/docs" && pathname.startsWith("/docs/");
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
        </nav>

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
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
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
          <Link activeOptions={{ exact: true }} to="/demos">
            Demos
          </Link>
          <Link activeOptions={{ exact: true }} to="/themes">
            Themes
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
          <a href="/llms.txt">llms.txt</a>
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
