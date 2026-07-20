import lockupDarkHref from "@drever/brand/assets/drever-lockup-dark.svg";
import lockupHref from "@drever/brand/assets/drever-lockup.svg";
import { useEffect, useState } from "react";
import { Link } from "react-router";

type Appearance = "system" | "light" | "dark";

function applyAppearance(appearance: Appearance) {
  if (appearance === "system") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }

  document.documentElement.dataset.theme = appearance;
}

export function BrandLockup() {
  return (
    <span className="brand-lockup" aria-label="Drever">
      <img className="brand-lockup__light" src={lockupHref} alt="" />
      <img className="brand-lockup__dark" src={lockupDarkHref} alt="" />
    </span>
  );
}

export function AppearanceControl({ compact = false }: { compact?: boolean }) {
  const [appearance, setAppearance] = useState<Appearance>("system");

  useEffect(() => {
    const stored = localStorage.getItem("drever-site-appearance");
    if (stored === "light" || stored === "dark" || stored === "system") {
      setAppearance(stored);
      applyAppearance(stored);
    }
  }, []);

  function choose(next: Appearance) {
    setAppearance(next);
    localStorage.setItem("drever-site-appearance", next);
    applyAppearance(next);
  }

  return (
    <div className={compact ? "appearance appearance--compact" : "appearance"}>
      <span className="appearance__label">Appearance</span>
      <div className="appearance__options" aria-label="Color appearance">
        {(["system", "light", "dark"] as const).map((option) => (
          <button
            aria-pressed={appearance === option}
            key={option}
            onClick={() => choose(option)}
            type="button"
          >
            {option[0]?.toUpperCase()}
            {option.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SiteHeader({ docs = false }: { docs?: boolean }) {
  return (
    <header className={docs ? "site-header site-header--docs" : "site-header"}>
      <Link className="site-header__brand" to="/">
        <BrandLockup />
      </Link>
      <nav className="site-header__nav" aria-label="Primary navigation">
        <Link to="/#story">Stories</Link>
        <Link to="/docs">Docs</Link>
        <Link className="site-header__cta" to="/docs">
          Create slides <span aria-hidden="true">→</span>
        </Link>
      </nav>
    </header>
  );
}
