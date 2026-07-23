import lockupHref from "@drever/brand/assets/drever-lockup.svg";
import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Drever — Under development" },
  {
    name: "description",
    content: "Drever is an AI-first framework for expressive, interactive presentations.",
  },
  { name: "robots", content: "noindex, nofollow" },
];

export default function HomePage() {
  return (
    <main className="placeholder">
      <img className="placeholder__logo" src={lockupHref} alt="Drever" />

      <div className="placeholder__message">
        <span className="placeholder__status">In development</span>
        <h1>Drever is under development.</h1>
        <p>The new website will be here soon.</p>
      </div>

      <span className="placeholder__domain">drever.dev</span>
    </main>
  );
}
