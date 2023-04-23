
import { useEffect,useState } from "react";
import axios from "axios";
import './movie.css'
import { useParams} from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.min.css';
import Rate from "./rating";
import Comments from "./comments";
import { Container } from "react-bootstrap";
import ReactPlayer from "react-player";


function Movie() {
  const [movie, setMovie] = useState({});  
  const [title, setTitle] = useState('');
  
  const email = localStorage.getItem('email');
  const [videoKey, setVideoKey] = useState(null);
  const [url, setUrl] = useState(''); 
  const [pid, setId] = useState({});

 
  let { id } = useParams();
  
  useEffect(() => {
    async function fetchMovie() {
      const res = await axios.get(`https://api.themoviedb.org/3/movie/${id}?api_key=152f41397d36a9af171b938124f0281c`);
      setMovie(res.data);
       setTitle(res.data.title.replace(/\s+/g, '-').toLowerCase());
       setId(res.data.imdb_id)
     

    }
    
    async function fetchVideo() {
      const res = await axios.get(`https://api.themoviedb.org/3/movie/${id}/videos?api_key=152f41397d36a9af171b938124f0281c`);
      if (res.data.results.length > 0) {
        setVideoKey(res.data.results[0].key);
      }
    }

    fetchMovie();
    fetchVideo();
  }, [id]);

  const handleUrlChange = (prop) => {
    setUrl(prop);
  };
  return ( <body style={{ backgroundColor: "#2E2E2E" }}> 
   
    <div className="container my-5">
      <div className="row">
        <div className="col-md-4">
          <img
            src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
            alt={movie.title}
            className="img-fluid rounded"
          />
          <h1 className="rate">Rating :{movie.vote_average}</h1>
          <h3 className="voters">Total Voters: {movie.vote_count}</h3>
        </div>
        <div className="col-md-8" style={{  color: "#F2F2F2" }}>
          <h1>{movie.title}</h1>
          <div className="my-4">
            <p>{movie.overview}</p>
          </div>
          <div className="my-4">
            {videoKey && (
              <div className="embed-responsive embed-responsive-16by9">
                <iframe
                  width="560"
                  height="315"
                  src={`https://www.youtube.com/embed/${videoKey}`}
                  title={`${movie.title} Trailer`}
                  className="embed-responsive-item"
                  allowFullScreen
                ></iframe>
                  
              </div>
              
            )}
            <div>  {title && (
              <div className="embed-responsive embed-responsive-16by9">
                <iframe
                  width="560"
                  height="315"
                  src={url+pid}
              
                  className="embed-responsive-item"
                  allowFullScreen
                ></iframe>
                
               
              
              </div>
              
               )} <button title="Load URL 1" onClick={() => handleUrlChange('https://v2.vidsrc.me/embed/')}>Load URL 1</button>
               <button title="Load URL 2" onClick={() => handleUrlChange('https://2embed.org/embed/')}>Load URL 2</button></div>
          </div>
          <div className="my-4">
            <Rate />
          </div>
        </div>
      </div>

      <div className="row my-5">
        <div className="col-md-12">
          <Comments user={email} movie={id} />
        </div>
      </div>
    </div>
    
    </body>
  );
}

export default Movie;
