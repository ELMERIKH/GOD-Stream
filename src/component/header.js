import React, { useContext,useState, useEffect  } from 'react'
import { Link,useNavigate} from 'react-router-dom';
import './Header.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { AuthicateContext } from './Auth'
import { Container } from 'react-bootstrap'

const Header = () => {
  
  const [authInfo, setAuthInfo] = useContext(AuthicateContext)
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');
  const navigate = useNavigate()
  useEffect(() => {
    if (authInfo.isAuthenticated===true) 
     
     setIsLoggedIn(true)
    
  }, [authInfo.isAuthenticated]);
  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn);
  }, [isLoggedIn]);

  const logout= () => {
    setIsLoggedIn(false)
  }

    return (
   
      <header className="header">
      <Container>
        <div className="container">
        <button >
                <Link to="/" className='L' > <h1 className="header__title" >Movies Reviews</h1></Link>
              </button>
              
          <nav className="header__nav">
          
          <div className='links'> 
            <ul >
            {isLoggedIn ? (<button onClick={()=>     navigate('/Create')||
            setIsLoggedIn(false) ||
             localStorage.setItem('isLoggedIn', false)||
            localStorage.removeItem('email')||
    setAuthInfo(()=>(
                        {token:'',isAuthenticated:false }
                    )) } className='btn btn-danger' >Logout </button>  ) :<button className='btn btn'>
                    <Link to="/login" className='L'>Login</Link>
                  </button>}
              
              
              <button className='btn btn'>
                <Link to="/movies" className='L'>Movies</Link>
              </button>
              <button className='btn btn'>
                <Link to="/Anime" className='L'>Anime</Link>
              </button>
              <button className='btn btn'>
                <Link to="/ChatBot" className='L'>MovieBot</Link>
              </button>
              
              
            </ul>
          </div>
         
          </nav>
          
        </div>
        </Container>
      </header>
      
     
    );
  };
  
  export default Header;


