import { useEffect,useState } from "react";
import axios from "axios";
import './movie.css'
import { useParams} from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.min.css';
import Rate from "./rating";
import Comments from "./comments";
import { Container } from "react-bootstrap";



function MangaId() {
  const [movie, setMovie] = useState('');  
  
  const email = localStorage.getItem('email');
  const [selectedEpisode, setSelectedEpisode] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [url, setUrl] = useState({}); 
  const [tit, setep] = useState('');
  const [ti, sete] = useState('');
  const [img, setimg] = useState(``);

  

 
  let { id } = useParams();
  
  useEffect(() => {
    async function fetchMovie() {
      const resu = await axios.get(`https://consumet-api-m8mf.onrender.com/manga/mangadex/info/${id}`, {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    
      
      const r =resu.data.chapters;
     
      setep(resu.data.image);
      sete(resu.data.title)
     console.log(r)
      
      const res = await axios.get(`https://consumet-api-m8mf.onrender.com/at-home/server/${r[selectedEpisode].id}`
       
      );

      const rt=res.data.chapter;
      
      setimg(`https://uploads.mangadex.org/data/${rt.hash}/${rt.data[currentIndex]}` 
       
      );

      setMovie(resu.data.chapters);

    
        setUrl(rt);
        console.log(selectedEpisode);
        console.log(r[selectedEpisode].id);
        console.log(resu.data);
        
        
     

    }

    fetchMovie();
   
  }, [id, selectedEpisode,currentIndex]);
  const handleNextClick = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % url.data.length);
  };

  const handlePrevClick = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? url.data.length - 1 : prevIndex - 1
    );
  };

  
 
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
          
          
          <select value={selectedEpisode} onChange={(e) => setSelectedEpisode(e.target.value)}>
  {movie && movie.map((episode, index) => (
    <option key={index} value={index}>
      Episode : {episode.title}  
    </option>
  

    
  ))}

</select> PAGE : {currentIndex}

 <div>
 <td><button onClick={handlePrevClick}>Prev</button></td><td><button onClick={handleNextClick}>Next</button></td>

  {url && <img src={img} alt="" width="600" height="800"/>}
  
 </div>

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
