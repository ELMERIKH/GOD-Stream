import React, { useState,useEffect,useContext} from 'react';
import './style.css';
import axios from '../API/auth';
import { Link} from 'react-router-dom';

import { AuthicateContext } from "./Auth";



function Login() {
  const [user, setUser] = useState({});

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authInfo,setAuthInfo] = useContext(AuthicateContext);
  const loginUser = (user) => {
    return axios.post('/api/auth/login',user )
  }
  
  useEffect(() => {
    if (isLoggedIn) {
      window.location.href = "/home";
     
    }
  }, [isLoggedIn]);

  const storeToken = (token) => {
    localStorage.setItem("token", token);
 
  };

 
 
  const handleSubmit = async (e) => {
    
    e.preventDefault();
    
    try {

      const response = await loginUser(user)
        console.log(response.data);
        setAuthInfo(()=> ({ token:response.data.token, isAuthenticated: true }));
      
  
      console.log("response.data", response.data)
      setIsLoggedIn(true);
      storeToken(response.data.token);
   
 
      
      console.log(authInfo.token)
    
      alert("logged")
      setUser({});
    
    
    
    } catch (err) {
   
      alert("user not found");
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit }>
        <input
          type="email"
          placeholder="Email"
          value={user.email}
          onChange={(e) => setUser({ ...user, email: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={user.password}
          onChange={(e) => setUser({ ...user, password: e.target.value })}
          required
        />
        <button  type="submit" className='LOG'>Login</button>
        <button>
                <Link to="/register" className='R'>Register</Link>
              </button>
      </form>
     
    </div>
  );
}

export default Login;
