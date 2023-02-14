import React, { useState,useContext,useEffect } from "react";
import axios from "axios";
import { AuthicateContext } from "./Auth";
import { useNavigate,Link } from 'react-router-dom'
function AddMovie() { 
  const [authInfo, setAuthInfo] = useContext(AuthicateContext)
  const token = localStorage.getItem('token');
  const [isAdmin, setIsAdmin] = useState(false);
  const email = localStorage.getItem('email');
  const navigate = useNavigate()
  const [movie, setMovie] = useState({
    title: "",
    image: "",
    release_date: "",
    description: "",
    rating: "",
 
  });

  const handleChange = (event) => {
    setMovie({ ...movie, [event.target.name]: event.target.value });
    
  };

  const handleSubmit = (event) => {
    
    event.preventDefault();
    console.log(authInfo.token);
   console.log(token);
    axios
      .post("http://localhost:9000/api/Create", movie,{ headers: {
        Authorization: `Bearer ${token}`,
      }, })
      .then((res) => { 
        
        console.log(res);
        alert("Movie added successfully!");
        
    console.log(authInfo);
      })
      .catch((err) => {
        console.log(err);
        alert("Error adding movie. Please try again.");
             
  
      });
   
  };
  useEffect(() => {
    console.log(email)
    async function fetchUserData() {
      const res = await axios.get(`http://localhost:9000/api/auth/getRole/${email}`);
      console.log(res.data.role)
     if(res.data.role!=="admin") {  navigate('/')}
     else setIsAdmin(true)
    }
    fetchUserData();
  }, []);
  
  return ( <div className="h">
    <form  onSubmit={handleSubmit}>
      <label>
        Title:
        <input
          type="text"
          name="title"
          value={movie.title}
          onChange={handleChange}
        />
      </label>
      <br />
      <label>
        Image:
        <input 
          type="text"
          name="image"
          value={movie.image}
          onChange={handleChange}
        />
      </label>
      <br />
      <label>
        Release Date:
        <input 
          type="text"
          name="release_date"
          value={movie.release_date}
          onChange={handleChange}
        />
      </label>
      <br />
      <label>
        Description:
        <textarea
          name="description"
          value={movie.description}
          onChange={handleChange}
        />
      </label>
      <br />
      <label>
        Rating:
        <input 
          type="text"
          name="rating"
          value={movie.rating}
          onChange={handleChange}
        />
      </label>
      <br />
      <button type="submit">Add Movie</button>
    </form>
    </div>
  );
}

export default AddMovie;