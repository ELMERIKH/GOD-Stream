import React, { useState, useEffect } from 'react';
import axios from '../API/auth';
import { Container } from 'react-bootstrap';
import { useParams} from "react-router-dom";
function Comments({ user,movie}) {
  const [comments, setComments] = useState([]);
  const email = localStorage.getItem('email');
  const [text, setText] = useState('');
  

 
  


  useEffect(() => {
    const fetchData = async () => { 
      const res = await axios.get(`/api/comments/getall?movie=${movie}`);
    
      setComments(res.data.comments);
      console.log(res.data.comments)
  
    };

    fetchData();
  },[movie]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(email!==null){
      const res = await axios.post('/api/comments/create', {
        text,
        email: user,
        movieId: movie
        
      });
      alert('comment submited')
      console.log(res.data);
      setText('');
    }
    else   alert('you need to log in to post comment')
    
    
    
  };

  return (
    <Container>

<form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Enter comment text"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <input type="hidden" value={user}  />
      <input type="hidden" value={movie} />
      <button type="submit">Submit</button>
    </form>
      
      <h2>Comments</h2>
      <div>
      {comments.map(comment => (
        <div key={comment._id}>
          <h3>{comment.email}</h3>
          <p>{comment.text}</p>
        </div>
      ))}
    </div>
    </Container>
  );
};

export default Comments;