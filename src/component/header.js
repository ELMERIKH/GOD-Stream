import React, { useContext, useState, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom';
import './Header.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { AuthicateContext } from './Auth'

const Header = () => {
  const [authInfo, setAuthInfo] = useContext(AuthicateContext)
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate()

  useEffect(() => {
    if (authInfo.isAuthenticated === true)
      setIsLoggedIn(true)
  }, [authInfo.isAuthenticated]);

  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn);
  }, [isLoggedIn]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/" className="brand" onClick={closeMenu}>
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="18" height="18" focusable="false">
              <path d="M11 7.5v17l14-8.5-14-8.5z" fill="currentColor" />
            </svg>
          </span>
          <span className="brand__name">StreamGod</span>
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`header__nav ${menuOpen ? 'is-open' : ''}`}>
          <NavLink to="/movies" className="nav-link" onClick={closeMenu}>Movies</NavLink>
          <NavLink to="/tv" className="nav-link" onClick={closeMenu}>Shows</NavLink>
          <NavLink to="/Anime" className="nav-link" onClick={closeMenu}>Anime</NavLink>
          <NavLink to="/Manga" className="nav-link" onClick={closeMenu}>Manga</NavLink>
          <NavLink to="/ChatBot" className="nav-link" onClick={closeMenu}>MovieBot</NavLink>
          {isLoggedIn ? (
            <button
              type="button"
              className="nav-logout"
              onClick={() => navigate('/Create') ||
                setIsLoggedIn(false) ||
                localStorage.setItem('isLoggedIn', false) ||
                localStorage.removeItem('email') ||
                setAuthInfo(() => (
                  { token: '', isAuthenticated: false }
                ))}
            >
              Logout
            </button>
          ) : (
            <Link to="/login" className="nav-login" onClick={closeMenu}>Login</Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
