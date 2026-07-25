import type { ReactNode } from "react";

export function PageHero({
  children,
  description,
  eyebrow,
  title,
}: {
  children?: ReactNode;
  description: string;
  eyebrow: string;
  title: ReactNode;
}) {
  return (
    <header className="page-hero">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </header>
  );
}
