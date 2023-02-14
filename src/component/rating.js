import { useEffect,useState } from "react";
import axios from "axios";
import './movie.css'
import { useParams} from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.min.css';
import { Alert } from "bootstrap";

import { useNavigate,Link } from 'react-router-dom'
function Rate() {
  
    const [rating, setRating] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    let { id } = useParams();
    const email = localStorage.getItem('email');
    const navigate = useNavigate()
    const handleRatingChange = (event) => {
      setRating(event.target.value);
    }
    const submitRating = async () => {
      
    if(email!==null){
      const res = await axios.patch(`http://localhost:9000/api/rating/${id}`, { rating });
      console.log(res.data);
      setSubmitting(true);
      alert("thanks you for rating")
    }
    else{
      alert("You need to loggin")
      navigate('/login')
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
              <button type = "submit" className="rate-button"  disabled={submitting}>Rate</button>
              </form>
      </div>
    );
  }
    
  
    
  export default  Rate;