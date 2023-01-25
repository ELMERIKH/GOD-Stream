import { useEffect,useState } from "react";
import axios from "axios";
import './movie.css'
import { useParams} from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.min.css';
function Rate() {
  
    const [rating, setRating] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    let { id } = useParams();
    const handleRatingChange = (event) => {
      setRating(event.target.value);
    }
    const submitRating = async () => {
      
    try{
      const res2 = await axios.patch(`http://localhost:5000/api/rating/${id}`, { rating });
      console.log(res2.data.message);
      setSubmitting(true);
      alert("thank you for rating this movie");
    }catch (err){

        alert("error");
    }
     
       
    }
    
    
     
  
      return (
         <div>
    
        <label>Select a rating:</label>
        <form className="f" onSubmit={submitRating}>
        <select className="s" value={rating} onChange={handleRatingChange}>
          {Array.from({ length: 10 }, (_, i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
              </select>
              <button className="rate-button"  disabled={submitting}>Rate</button>
              </form>
      </div>
    );
  }
    
  
    
  export default Rate;