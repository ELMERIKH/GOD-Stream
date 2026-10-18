import React from 'react';
import { Link } from 'react-router-dom';
import './footer.css'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p className="footer__credit">by Khafif Moncef year {new Date().getFullYear()}</p>
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
