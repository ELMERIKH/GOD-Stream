import { useMemo } from "react";

const RAIL_CAP = 36;

export function visibleRailEntries(items, selectedIndex, query, cap = RAIL_CAP) {
  const rows = (items || []).map((item, index) => ({ item, index }));
  const q = String(query || "").trim().toLowerCase();
  if (!q) {
    if (rows.length <= cap) return { visible: rows, hidden: 0 };
    const start = Math.max(0, Math.min(Math.max(0, selectedIndex) - 4, rows.length - cap));
    return { visible: rows.slice(start, start + cap), hidden: rows.length - cap };
  }
  const matched = rows.filter(({ item }) => {
    const title = String(item?.title || "").toLowerCase();
    const number = String(item?.number ?? "").toLowerCase();
    return title.includes(q) || number === q || number.includes(q);
  });
  matched.sort((left, right) => {
    const leftExact = String(left.item?.number ?? "") === q ? 0 : 1;
    const rightExact = String(right.item?.number ?? "") === q ? 0 : 1;
    return leftExact - rightExact;
  });
  return { visible: matched.slice(0, cap), hidden: Math.max(0, matched.length - cap) };
}

function WatchRail({ label, query, onQuery, items, selectedIndex, onSelect, emptyNote }) {
  const { visible, hidden } = useMemo(
    () => visibleRailEntries(items, selectedIndex, query),
    [items, selectedIndex, query]
  );
  const filterId = `${label}-filter`.replace(/\s+/g, "-").toLowerCase();

  return (
    <aside className="watch-rail" aria-label={label}>
      <label className="watch-rail__label" htmlFor={filterId}>
        {label}
        {items?.length ? <span>{items.length}</span> : null}
      </label>
      <input
        id={filterId}
        type="search"
        value={query}
        placeholder={`Filter ${String(label || "").toLowerCase()}`}
        autoComplete="off"
        onChange={(event) => onQuery(event.target.value)}
      />
      {items?.length ? (
        visible.length ? (
          <ul>
            {visible.map(({ item, index }) => (
              <li key={`${item.id || item.number || item.title}-${index}`}>
                <button
                  type="button"
                  className={index === selectedIndex ? "is-active" : ""}
                  aria-current={index === selectedIndex ? "true" : undefined}
                  onClick={() => onSelect(index)}
                >
                  {item.title}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="watch-rail__note">No matches.</p>
        )
      ) : (
        <p className="watch-rail__note">{emptyNote}</p>
      )}
      {hidden > 0 ? (
        <p className="watch-rail__note">
          {String(query || "").trim()
            ? `${hidden} more matches. Refine the filter.`
            : `${hidden} more. Filter to jump ahead.`}
        </p>
      ) : null}
    </aside>
  );
}

export default WatchRail;
