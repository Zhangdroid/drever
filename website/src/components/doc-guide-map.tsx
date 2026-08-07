export interface DocGuideMapItem {
  description: string;
  href: `#${string}`;
  label: string;
}

export function DocGuideMap({
  items,
  sequence,
}: {
  items: readonly DocGuideMapItem[];
  sequence: string;
}) {
  return (
    <nav className="doc-guide-map" aria-label="On this page">
      <header className="doc-guide-map__header">
        <span>In this guide</span>
        <p>{sequence}</p>
      </header>
      <ol>
        {items.map((item, index) => (
          <li key={item.href}>
            <a href={item.href}>
              <span className="doc-guide-map__index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
