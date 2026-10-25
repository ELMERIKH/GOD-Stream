import { useState,useEffect } from 'react';
import axios from '../API/auth';

import './style.css';
function Register() {
  const [user, setUser] = useState({});
  const [error, setError] = useState('');
      const [success, setSuccess] = useState('');
      const [isLoggedIn, setIsLoggedIn] = useState(false);
      const registerUser = (user) => {
        return axios.post('/api/auth/register',user);
      }
      useEffect(() => {
        if (isLoggedIn) {
          window.location.href = "/login";
        }
      }, [isLoggedIn]);
    
      
      const handleSubmit = async (e) => {
        e.preventDefault();
        try {
          const response = await registerUser(user);
          setSuccess(response.data.message);
          setUser({});
          
         setIsLoggedIn(true);
    

        } catch (err) {
          setError(err.response.data.error);
        }
      };
    
      return (
        <div className="auth-screen">
          <form className="panel-form" onSubmit={handleSubmit}>
            <label htmlFor="register-username">Username</label>
            <input
              id="register-username"
              type="text"
              placeholder="Username"
              value={user.username}
              onChange={(e) => setUser({ ...user, username: e.target.value })}
              required
            />
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              placeholder="Email"
              value={user.email}
              onChange={(e) => setUser({ ...user, email: e.target.value })}
              required
            />
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              placeholder="Password"
              value={user.password}
              onChange={(e) => setUser({ ...user, password: e.target.value })}
              required
            />
            <button type="submit" className='R2'>Register</button>
          </form>
          {error && <p>{error}</p>}
          {success && <p>{success}</p>}
        </div>
      );
    }
    
    export default Register