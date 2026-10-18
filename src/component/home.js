import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const picks = [
  { to: '/movies', title: 'Movies', text: 'Now playing, popular, and top rated', tone: 'movies' },
  { to: '/tv', title: 'Shows', text: 'Series airing today and fan favorites', tone: 'shows' },
  { to: '/Anime', title: 'Anime', text: 'Recent episodes, popular, and trending', tone: 'anime' },
  { to: '/Manga', title: 'Manga', text: 'Find a series and pick up the story', tone: 'manga' },
];

const Home = () => {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Reviews, ratings, and new releases</p>
          <h1>Welcome to movie reviews</h1>
          <p className="lede">
            Watch, rate, and discuss all your favorite movies, shows, anime, and manga.
          </p>
          <p className="lede lede-quiet">
            Explore the world of entertainment and stay updated with the latest releases.
          </p>
          <div className="hero__actions">
            <Link className="btn-gold" to="/movies">Browse movies</Link>
            <Link className="btn-ghost" to="/Anime">Watch anime</Link>
          </div>
        </div>
        <div className="hero__stage" aria-hidden="true">
          <div className="poster poster-a"><span>Now</span></div>
          <div className="poster poster-b"><span>Top</span></div>
          <div className="poster poster-c"><span>New</span></div>
        </div>
      </section>

      <section className="picks">
        <h2>Start somewhere</h2>
        <div className="tile-grid">
          {picks.map((pick) => (
            <Link key={pick.to} to={pick.to} className={`tile tile-${pick.tone}`}>
              <span className="tile__title">{pick.title}</span>
              <span className="tile__text">{pick.text}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
