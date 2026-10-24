import { useMemo, useState } from "react";

const RAIL_CAP = 36;

function newestFirstList(items) {
  const numbers = [];
  (items || []).forEach((item) => {
    const number = parseFloat(item?.number);
    if (Number.isFinite(number)) numbers.push(number);
  });
  if (numbers.length < 2) return true;
  return numbers[0] > numbers[numbers.length - 1];
}

export function nextRailOffset(length, offset, direction, cap = RAIL_CAP) {
  const maxOffset = Math.max(0, length - cap);
  const current = Math.max(0, Math.min(Number(offset) || 0, maxOffset));
  if (direction === "earlier") return Math.min(maxOffset, current + cap);
  return Math.max(0, current - cap);
}

export function railWindow(items, selectedIndex, query, offset = 0, cap = RAIL_CAP) {
  const rows = (items || []).map((item, index) => ({ item, index }));
  const q = String(query || "").trim().toLowerCase();
  if (q) {
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
    return {
      visible: matched.slice(0, cap),
      hidden: Math.max(0, matched.length - cap),
      hasEarlier: false,
      hasNewer: false,
      offset: 0,
    };
  }
  if (rows.length <= cap) {
    return { visible: rows, hidden: 0, hasEarlier: false, hasNewer: false, offset: 0 };
  }
  const newestFirst = newestFirstList(items);
  const maxOffset = rows.length - cap;
  const clamped = Math.max(0, Math.min(Number(offset) || 0, maxOffset));
  const start = newestFirst ? clamped : rows.length - cap - clamped;
  let visible = rows.slice(start, start + cap);
  const selected = selectedIndex >= 0 ? rows[selectedIndex] : null;
  if (selected && !visible.some((row) => row.index === selected.index)) {
    visible = newestFirst ? [selected, ...visible] : [...visible, selected];
  }
  return {
    visible,
    hidden: rows.length - cap,
    hasEarlier: clamped < maxOffset,
    hasNewer: clamped > 0,
    offset: clamped,
  };
}

export function visibleRailEntries(items, selectedIndex, query, cap = RAIL_CAP) {
  const windowed = railWindow(items, selectedIndex, query, 0, cap);
  return { visible: windowed.visible, hidden: windowed.hidden };
}

function WatchRail({ label, query, onQuery, items, selectedIndex, onSelect, emptyNote }) {
  const length = items?.length || 0;
  const [offset, setOffset] = useState(0);
  const [seenQuery, setSeenQuery] = useState(query);
  const [seenLength, setSeenLength] = useState(length);
  const queryChanged = query !== seenQuery || length !== seenLength;
  if (queryChanged) {
    setSeenQuery(query);
    setSeenLength(length);
    setOffset(0);
  }
  const pageOffset = queryChanged ? 0 : offset;
  const { visible, hidden, hasEarlier, hasNewer } = useMemo(
    () => railWindow(items, selectedIndex, query, pageOffset),
    [items, selectedIndex, query, pageOffset]
  );
  const filterId = `${label}-filter`.replace(/\s+/g, "-").toLowerCase();
  const paging = !String(query || "").trim() && (hasEarlier || hasNewer);

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
      {paging ? (
        <div className="watch-rail__pager">
          <button
            type="button"
            disabled={!hasEarlier}
            onClick={() => setOffset((value) => nextRailOffset(length, value, "earlier"))}
          >
            Earlier
          </button>
          <button
            type="button"
            disabled={!hasNewer}
            onClick={() => setOffset((value) => nextRailOffset(length, value, "newer"))}
          >
            Newer
          </button>
        </div>
      ) : null}
      {hidden > 0 ? (
        <p className="watch-rail__note">
          {String(query || "").trim()
            ? `${hidden} more matches. Refine the filter.`
            : "Filter to jump to a number."}
        </p>
      ) : null}
    </aside>
  );
}

export default WatchRail;
