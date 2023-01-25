import React from 'react';
import { Link} from 'react-router-dom';
import './Header.css';
import 'bootstrap/dist/css/bootstrap.min.css';
const Header = () => {
    return (
      <header className="header">
        <div className="container">
        <button >
                <Link to="/home" className='L' > <h1 className="header__title" >Movies Reviews</h1></Link>
              </button>
          
          <nav className="header__nav">
           
          <div className='links'> 
            <ul>
              <button>
                <Link to="/login" className='L'>Login</Link>
              </button>
              
              <button>
                <Link to="/movies" className='L'>Movies</Link>
              </button>
            </ul>
          </div>
            
          </nav>
        </div>
      </header>
    );
  };
  
  export default Header;


