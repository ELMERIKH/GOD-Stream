import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CatalogSkeleton from "./CatalogSkeleton";
import {
  listAnime,
  listManga,
  onPosterError,
  POSTER_PLACEHOLDER,
  searchAnime,
  searchManga,
  sourceLabel,
} from "../API/catalog";
import "./movie.css";

const ANIME_TABS = [
  { preset: "all", to: "/Anime/All", label: "All" },
  { preset: "recent", to: "/Anime", label: "Latest" },
  { preset: "popular", to: "/Anime/Popular", label: "Popular" },
  { preset: "trending", to: "/Anime/Trending", label: "Trending" },
];

function CatalogBrowser({ kind, preset }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [query, setQuery] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1);
      setQuery(searchTerm.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setStale(false);

    const activeQuery = query.length >= 2 ? query : "";
    const fresh = retryToken > 0;
    const load = activeQuery
      ? kind === "manga"
        ? searchManga(activeQuery, page, fresh)
        : searchAnime(activeQuery, page, fresh)
      : kind === "manga"
        ? listManga(page, fresh)
        : listAnime(preset, page, fresh);

    load
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setHasNext(result.hasNext);
        setStale(Boolean(result.stale));
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setHasNext(false);
        setStale(false);
        setError("Every catalog source failed. Try again in a moment.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kind, preset, page, query, retryToken]);

  const detailBase = kind === "manga" ? "/Manga" : "/Anime";

  return (
    <div className="search-box">
      {kind === "anime" && (
        <div className="catalog-tabs">
          {ANIME_TABS.map((tab) => (
            <Link
              key={tab.preset}
              to={tab.to}
              className={preset === tab.preset && query.length < 2 ? "catalog-tab is-active" : "catalog-tab"}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      )}

      <label className="search-label" htmlFor={`${kind}-search`}>
        Search {kind}
      </label>
      <input
        id={`${kind}-search`}
        type="text"
        placeholder={`Search ${kind}...`}
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
      />

      {!loading && stale && items.length > 0 && (
        <div className="status-banner" role="status">
          <p>Showing a saved copy while sources catch up.</p>
          <button type="button" onClick={() => setRetryToken((value) => value + 1)}>Refresh</button>
        </div>
      )}

      {loading && <CatalogSkeleton />}
      {!loading && error && (
        <div className="catalog-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetryToken((value) => value + 1)}>
            Retry
          </button>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="catalog-empty" role="status">
          <p>{query.length >= 2 ? `No ${kind} matched "${query}".` : `No ${kind} titles are available right now.`}</p>
          <button type="button" onClick={() => setRetryToken((value) => value + 1)}>Retry</button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="movie-component">
          {items.map((item) => (
            <div key={item.id} className="movie-card">
              <Link to={`${detailBase}/${encodeURIComponent(item.id)}`} className="movie-card__link" title={item.title}>
                <img src={item.image || POSTER_PLACEHOLDER} alt={item.title} loading="lazy" referrerPolicy="no-referrer" onError={onPosterError} />
                <h2 className="h2">{item.title}</h2>
                <ul className="ep">
                  <li>{sourceLabel(item.source)}</li>
                  {item.rating ? <li>Score {item.rating}</li> : null}
                  {kind === "anime" && item.nextEpisode ? <li>Next ep {item.nextEpisode}</li> : null}
                  {kind === "anime" && !item.nextEpisode && item.episodeNumber ? (
                    <li>{item.episodeNumber} eps</li>
                  ) : null}
                </ul>
              </Link>
            </div>
          ))}
          <footer>
            <div className="pagination">
              <button type="button" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span>{page}</span>
              <button type="button" disabled={!hasNext || loading} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}

export default CatalogBrowser;
