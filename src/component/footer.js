import React from 'react';
import { Link } from 'react-router-dom';
import './footer.css'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p className="footer__credit">
          <span className="footer__mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="14" height="14" focusable="false">
              <path d="M11 7.5v17l14-8.5-14-8.5z" fill="currentColor" />
            </svg>
          </span>
          StreamGod · by Khafif Moncef year {new Date().getFullYear()}
        </p>
        <nav className="footer__links" aria-label="Footer">
          <Link to="/movies">Movies</Link>
          <Link to="/tv">Shows</Link>
          <Link to="/Anime">Anime</Link>
          <Link to="/Manga">Manga</Link>
        </nav>
      </div>
    </footer>
  );
}

export default Footer;
