import { useEffect,useState } from "react";
import axios from "axios";
import './movie.css'
import { useParams} from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.min.css';
import Rate from "./rating";
import Comments from "./comments";
import { Container } from "react-bootstrap";
import ReactPlayer from "react-player";



function Anime() {
  const [movie, setMovie] = useState({});  
  
  const email = localStorage.getItem('email');
  const [selectedEpisode, setSelectedEpisode] = useState(0);

  const [url, setUrl] = useState(''); 
  const [tit, setep] = useState('');

 
  let { id } = useParams();
  
  useEffect(() => {
    async function fetchMovie() {
      const resu = await axios.get(`https://consumet-api-m8mf.onrender.com/anime/gogoanime/info/${id}`);
      const r =resu.data.episodes;
      const rt=resu.data.title;
      setep(rt)
      
      const res = await axios.get(`https://consumet-api-m8mf.onrender.com/anime/gogoanime/servers/${r[selectedEpisode].id}`);


      setMovie(resu.data);
       
        setUrl(res.data[0].url)
        console.log(selectedEpisode)
      
        
      

    }

    fetchMovie();
   
  }, [id, selectedEpisode]);

 
  return ( <body style={{ backgroundColor: "#2E2E2E" }}> 
   
    <div className="container my-5">
      <div className="row">
        <div className="col-md-4">
          <img
            src={movie.image}
            alt={tit}
            className="img-fluid rounded"
          />
          <h1 className="rate">Rating :{movie.rating}</h1>
         
        </div>
        <div className="col-md-8" style={{  color: "#F2F2F2" }}>
          <h1>{tit}</h1>
          <div className="my-4">
            <p>{movie.description}</p>
          </div>
          <div className="my-4">
            
            <div>  {url && (
              <div className="embed-responsive embed-responsive-16by9">
                <iframe
                  width="560"
                  height="315"
                  src={url}
              
                  className="embed-responsive-item"
                  allowFullScreen
                ></iframe>
                
               
              
              </div>
              
               )} <select value={selectedEpisode} onChange={(e) => setSelectedEpisode(e.target.value)&& console.log(e.target.value)}>
  {movie.episodes && movie.episodes.map((episode, index) => (
    <option key={index} value={episode.number-1}>
      Episode : {episode.number}
    </option>
    
  ))}

</select></div>
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

export default Anime;
