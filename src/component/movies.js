import { useState } from 'react';
import CatalogView from './CatalogView';
import { loadTmdbList } from '../API/catalog';

const KEY = '152f41397d36a9af171b938124f0281c';

const FILTERS = [
  { id: 'top_rated', label: 'Top Rated', path: `https://api.themoviedb.org/3/movie/top_rated?api_key=${KEY}` },
  { id: 'now_playing', label: 'Latest', path: `https://api.themoviedb.org/3/movie/now_playing?api_key=${KEY}` },
  { id: 'popular', label: 'Popular', path: `https://api.themoviedb.org/3/movie/popular?api_key=${KEY}` },
];

function MovieList() {
  const [path, setPath] = useState(FILTERS[1].path);

  return (
    <CatalogView
      queryKey={path}
      searchId="movie-search"
      placeholder="Search movies..."
      href={(item) => `/movie/${item.id}`}
      load={(page, search, fresh) => loadTmdbList({ kind: 'movie', path, page, search, fresh })}
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

export default MovieList;
