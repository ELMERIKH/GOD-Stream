import { useEffect,useState } from "react";
import axios from "axios";
import './movie.css'
import { useParams} from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.min.css';
import Rate from "./rating";
import Comments from "./comments";

function Movie() {
  const [movies, setMovie] = useState({});
  const email = localStorage.getItem('email');
 
  let { id } = useParams();
  

  
  
  
      useEffect(() => {
    async function fetchMovie() {
      const res = await axios.get(`http://localhost:9000/api/movie/${id}`);
      setMovie(res.data.movies);
      console.log(res.data.movies);
     
   
    }
    fetchMovie();
   
  }, [id]);


    return (
        <div className='movie-page'>
        
          
       
        <h1>{movies.title}</h1>
       <div className="des" ><p>{movies.description}</p>
      <img src={movies.image} alt={movies.title} />
      </div>
      
    <div > < Rate/></div>
    
     <Comments user={email} movie={id}/>
     
    </div>
  );
}
  

  
export default Movie;