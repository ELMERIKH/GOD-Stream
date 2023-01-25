import axios from "axios";

export default axios.create({baseURL: 'http://localhost:5000'});

// Register a new user
export const registerUser = (user) => {
  return axios.post('/api/auth/register', user);
}

// Login a user
export const loginUser = (user) => {
  return axios.post('http://localhost:5000/api/auth/login', );
}
