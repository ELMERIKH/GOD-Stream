import { useEffect,useState } from "react";
import axios from "axios";
import './movie.css'
import { useParams} from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.min.css';
import Rate from "./rating";
function Movie() {
  const [movies, setMovie] = useState({});
 
 
  let { id } = useParams();

  
  
      useEffect(() => {
    async function fetchMovie() {
      const res = await axios.get(`http://localhost:5000/api/movie/${id}`);
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
      <Rate/>
     
    </div>
  );
}
  

  
export default Movie;