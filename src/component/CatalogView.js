import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './movie.css';
import CatalogSkeleton from './CatalogSkeleton';

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function useAdminFlag() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const email = localStorage.getItem('email');
    if (!email || email === 'null') return undefined;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1200);
    fetch(`http://localhost:9000/api/auth/getRole/${encodeURIComponent(email)}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.role === 'admin') setIsAdmin(true);
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, []);
  return isAdmin;
}

function Poster({ src, alt }) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) return <div className="poster-fallback" aria-hidden="true" />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setOk(false)}
    />
  );
}

function CatalogView({
  queryKey,
  load,
  href,
  searchId,
  placeholder,
  links = [],
  filters = null,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = useAdminFlag();
  const loadRef = useRef(load);
  loadRef.current = load;

  const [search, setSearch] = useState('');
  const query = useDebounced(search, 350);
  const [page, setPage] = useState(1);
  const scope = `${queryKey}::${query}`;
  const [scopeKey, setScopeKey] = useState(scope);
  if (scope !== scopeKey) {
    setScopeKey(scope);
    setPage(1);
  }

  const [items, setItems] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setStale(false);
    loadRef.current(page, query, retryToken > 0)
      .then((result) => {
        if (ignore) return;
        setItems(result?.items || []);
        setTotalPages(result?.totalPages || 1);
        setSource(result?.source || '');
        setStale(Boolean(result?.stale));
      })
      .catch(() => {
        if (ignore) return;
        setItems([]);
        setTotalPages(1);
        setSource('');
        setStale(false);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [page, query, queryKey, retryToken]);

  return (
    <div className="search-box">
      {links.length > 0 && (
        <div className="filter-row">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={location.pathname === link.to ? 'is-active' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
      <label className="search-label" htmlFor={searchId}>Search</label>
      <input
        id={searchId}
        type="text"
        placeholder={placeholder}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {filters}
      {source && <p className="catalog-source">Source: {source}</p>}
      {!loading && stale && items.length > 0 && (
        <div className="status-banner" role="status">
          <p>Showing a saved copy while sources catch up.</p>
          <button type="button" onClick={() => setRetryToken((value) => value + 1)}>Refresh</button>
        </div>
      )}
      {loading && <CatalogSkeleton />}
      <div className="movie-component">
        {!loading && items.length === 0 && (
          <div className="catalog-empty" role="status">
            <p>No titles loaded from the available sources.</p>
            <button type="button" onClick={() => setRetryToken((value) => value + 1)}>Retry</button>
          </div>
        )}
        {items.map((item) => (
          <div key={item.id} className="movie-card">
            <Link to={href(item)} className="movie-card__link">
              <Poster src={item.image} alt={item.title} />
              <h2 className="h2">{item.title}</h2>
              {item.rating != null && <p className="p">rating : {Number(item.rating).toFixed(1)}</p>}
              {item.episodes ? <ul className="ep">{item.episodes} eps</ul> : null}
            </Link>
            {isAdmin && (
              <button type="button" className="btn btn-warning" onClick={() => navigate(`/Update/${item.id}`)}>Update</button>
            )}
            {isAdmin && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  fetch(`http://localhost:9000/api/delete/${item.id}`, { method: 'DELETE' }).catch(() => {});
                  setItems((current) => current.filter((row) => row.id !== item.id));
                }}
              >
                Delete
              </button>
            )}
          </div>
        ))}
        <footer>
          <div className="pagination">
            <button type="button" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>{page}</span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default CatalogView;
