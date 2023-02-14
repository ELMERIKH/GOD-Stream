import React, { useState, useEffect,useContext } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import './movie.css'
import { useNavigate } from 'react-router-dom';
import { AuthicateContext } from './Auth';
function Update () {
  const [movie, setMovie] = useState({});
  let { id } = useParams();

  const token = localStorage.getItem('token');
  const [isAdmin, setIsAdmin] = useState(false);
  const email = localStorage.getItem('email');
  const navigate = useNavigate()

  
  
  
      useEffect(() => {
    async function fetchMovie() {
      const res = await axios.get(`http://localhost:9000/api/movie/${id}`);
      setMovie(res.data.movies);
      console.log(res.data.movies);
     
   
    }
    fetchMovie();
   
  }, [id]);

  const handleChange = (event) => {
    setMovie({ ...movie, [event.target.name]: event.target.value });
    
  };

  const handleSubmit = async event => {
    event.preventDefault();

    await axios.patch(`http://localhost:9000/api/update/${id}`, movie,{ headers: {
        Authorization: `Bearer ${token}`,
      }, }).then((res) => { 
        
        console.log(res);
        alert("Movie Updated successfully!");
        
   
      })
      .catch((err) => {
        console.log(err);
        alert("Error Updating movie. Please try again.");
             
  
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
  return (
    <div>
       
    
      
      <form onSubmit={handleSubmit}>
        <div>
          <label>Title:</label>
          <input type="text" name="title" value={movie.title} onChange={handleChange} />
        </div>
        <div>
          <label>image:</label>
          <input type="text" name="image" value={movie.image} onChange={handleChange} />
        </div>
        <img className='pic' src={movie.image} alt={movie.title} />
        <div>
        <label>
        Release Date:
        <input 
          type="text"
          name="release_date"
          value={movie.release_date}
          onChange={handleChange}
        />
      </label>
        </div>
        <div>   <label>Description:</label>
          <input type="text" name="description" value={movie.description} onChange={handleChange} />
       
        </div>
        <div>
          <label>Rating:</label>
          <input type="number" name="rating" value={movie.rating} onChange={handleChange} />
        </div>
        <button type="submit">Update</button>
      </form>
    </div>
  );
};

export default Update;