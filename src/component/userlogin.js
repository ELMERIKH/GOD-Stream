import React, { useState,useEffect } from 'react';
import './style.css';
import axios from '../API/auth';
import { Link} from 'react-router-dom';


function Login() {
  const [user, setUser] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
 
  const loginUser = (user) => {
    return axios.post('/api/auth/login',user );
  }
  useEffect(() => {
    if (isLoggedIn) {
      window.location.href = "/home";
    }
  }, [isLoggedIn]);

  

 
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await loginUser(user);
      localStorage.setItem('token', response.data.token);
      setSuccess(response.data.message);
      alert("logged")
      setUser({});
      setIsLoggedIn(true);
    
    
    } catch (err) {
      setError(err.response.data.error);
      alert("user not found");
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
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
        <button type="submit" className='LOG'>Login</button>
        <button>
                <Link to="/register" className='R'>Register</Link>
              </button>
      </form>
      {error && <p>{error}</p>}
      {success && <p>{success}</p>}
    </div>
  );
}

export default Login;
