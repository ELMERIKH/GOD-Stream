import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';
import { loadHomeBillboard } from '../API/catalog';

const picks = [
  { to: '/movies', title: 'Movies', text: 'Now playing, popular, and top rated', tone: 'movies' },
  { to: '/tv', title: 'Shows', text: 'Series airing today and fan favorites', tone: 'shows' },
  { to: '/Anime', title: 'Anime', text: 'Recent episodes, popular, and trending', tone: 'anime' },
  { to: '/Manga', title: 'Manga', text: 'Find a series and pick up the story', tone: 'manga' },
];

function imageUrl(path, size) {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : '';
}

const Home = () => {
  const [titles, setTitles] = useState([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let ignore = false;
    loadHomeBillboard()
      .then((rows) => {
        if (!ignore) setTitles(rows);
      })
      .catch(() => {
        if (!ignore) setFailed(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const featured = titles[0];
  const spotlights = titles.slice(1, 4);

  return (
    <div className="home">
      <section className="billboard">
        {featured && (
          <img
            className="billboard__image"
            src={imageUrl(featured.backdrop_path, 'w1280')}
            alt=""
          />
        )}
        <div className="billboard__shade" />
        <div className="billboard__copy">
          <p className="eyebrow">Now playing</p>
          <h1>{featured ? featured.title : 'Welcome to movie reviews'}</h1>
          <p className="lede">
            {featured
              ? featured.overview
              : 'Watch, rate, and discuss all your favorite movies, shows, anime, and manga.'}
          </p>
          <div className="hero__actions">
            {featured && (
              <Link className="btn-gold" to={`/movie/${featured.id}`}>
                Open {featured.title}
              </Link>
            )}
            <Link className="btn-ghost" to="/movies">Browse movies</Link>
          </div>
          {failed && <p className="lede lede-quiet">Posters could not be loaded.</p>}
        </div>
        <div className="spotlights" aria-label="Featured posters">
          {(spotlights.length ? spotlights : [0, 1, 2]).map((movie, index) => (
            movie.id ? (
              <Link
                key={movie.id}
                to={`/movie/${movie.id}`}
                className={`spotlight spotlight-${index}`}
              >
                <img src={imageUrl(movie.poster_path, 'w500')} alt={movie.title} />
              </Link>
            ) : (
              <div key={index} className={`spotlight spotlight-${index} is-loading`} />
            )
          ))}
        </div>
      </section>

      <section className="rail-wrap">
        <div className="rail-head">
          <h2>In theaters</h2>
          <Link to="/movies">See all</Link>
        </div>
        <div className="rail">
          {titles.length === 0 && !failed && Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="rail__card is-loading" />
          ))}
          {titles.map((movie) => (
            <Link key={movie.id} to={`/movie/${movie.id}`} className="rail__card">
              <img src={imageUrl(movie.poster_path, 'w342')} alt={movie.title} />
              <span>{movie.title}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="picks">
        <h2>Start somewhere</h2>
        <div className="tile-grid">
          {picks.map((pick, index) => {
            const art = titles[index + 4];
            return (
              <Link key={pick.to} to={pick.to} className={`tile tile-${pick.tone}`}>
                {art && (
                  <img src={imageUrl(art.poster_path, 'w342')} alt="" />
                )}
                <span className="tile__title">{pick.title}</span>
                <span className="tile__text">{pick.text}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Home;
