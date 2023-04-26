import { useEffect,useState } from "react";
import axios from "axios";
import './movie.css'
import { useParams} from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.min.css';
import Rate from "./rating";
import Comments from "./comments";
import { Container } from "react-bootstrap";
import ReactPlayer from "react-player";



function MangaId() {
  const [movie, setMovie] = useState({});  
  
  const email = localStorage.getItem('email');
  const [selectedEpisode, setSelectedEpisode] = useState(0);
   
  const [url, setUrl] = useState(''); 
  const [tit, setep] = useState('');
  const [ti, sete] = useState('');

 
  let { id } = useParams();
  
  useEffect(() => {
    async function fetchMovie() {
      const resu = await axios.get(`https://api.consumet.org/meta/anilist-manga/info/${id}?provider=mangahere`);
    
      
      const r =resu.data.chapters;
      const rt=resu.data.title;
      setep(resu.data.image);
      sete(rt.romaji)
      console.log(url);
      
      const res = await axios.get(`https://api.consumet.org/meta/anilist-manga/read?chapterId=${r[selectedEpisode].id}&provider=mangahere`);


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
            src={tit}
           
            className="img-fluid rounded"
          />
          <h1 className="rate">Rating :{movie.rating}</h1>
         
        </div>
        <div className="col-md-8" style={{  color: "#F2F2F2" }}>
          <h1>{ti}</h1>
          <div className="my-4">
            <p>{movie.description}</p>
          </div>
         
            
         
          
          <select value={selectedEpisode} onChange={(e) => setSelectedEpisode(e.target.value)&& console.log(e.target.value)}>
  {movie.episodes && movie.episodes.map((episode, index) => (
    <option key={index} value={episode.number-1}>
      Episode : {episode.number}
    </option>
    
  ))}

</select>
  


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
   
    
    </body>
  );
}

export default MangaId;
