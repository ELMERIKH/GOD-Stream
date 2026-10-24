import { useState } from 'react';
import CatalogView from './CatalogView';
import { loadTmdbList } from '../API/catalog';

const KEY = '152f41397d36a9af171b938124f0281c';

const FILTERS = [
  { id: 'top_rated', label: 'Top Rated', path: `https://api.themoviedb.org/3/tv/top_rated?api_key=${KEY}` },
  { id: 'airing_today', label: 'Lastest', path: `https://api.themoviedb.org/3/tv/airing_today?api_key=${KEY}` },
  { id: 'popular', label: 'Popular', path: `https://api.themoviedb.org/3/tv/popular?api_key=${KEY}` },
];

function TVList() {
  const [path, setPath] = useState(FILTERS[1].path);

  return (
    <CatalogView
      queryKey={path}
      searchId="show-search"
      placeholder="Search shows..."
      href={(item) => `/tv/${item.id}`}
      load={(page, search) => loadTmdbList({ kind: 'tv', path, page, search })}
      filters={(
        <div>
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={path.includes(`/${filter.id}`)}
              className={path.includes(`/${filter.id}`) ? 'is-active' : undefined}
              onClick={() => setPath(filter.path)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}
    />
  );
}

export default TVList;
