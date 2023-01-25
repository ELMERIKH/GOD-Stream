import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './movie.css'
function MovieList() {
    const [movies, setMovies] = useState([]);
    const [page, setPage] = useState(1); // current page number
    const moviesPerPage = 15; // number of movies to display per page
  
    // get current movies based on current page
    const indexOfLastMovie = page * moviesPerPage;
    const indexOfFirstMovie = indexOfLastMovie - moviesPerPage;
    const currentMovies = movies.slice(indexOfFirstMovie, indexOfLastMovie);
  
    // handle page change
    
    useEffect(() => {
      async function fetchMovies() {
        const res = await axios.get("http://localhost:5000/api/movie/getall");
        setMovies(res.data.movies);
      }
      fetchMovies();
      console.log(fetchMovies);
    }, []);
  
    const movieRows = [];
    let movieRow = [];
    currentMovies.forEach((movie, index) => {
      movieRow.push(movie);
      if (index % 5 === 4 || index === currentMovies.length - 1) {
        movieRows.push(movieRow);
        movieRow = [];
      }
    });
  
    return (
      <div className='movie-component'>
        {movieRows.map((row, index) => (
          <div key={index} className="movie-row">
            {row.map(movie => (
              <div key={movie._id} className="movie-card">
                <img src={movie.image} alt={movie.title} />
             <h2> <Link to={`/movie/${movie._id}`}
   className="h2" > {movie.title} </Link></h2>
                <p className='p'>rating : {movie.rating}</p>
              </div>
            ))}
          </div>
        ))}
  <footer>
        <div className="pagination">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>{page}</span>
          <button
            disabled={page === Math.ceil(movies.length / moviesPerPage)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
        </footer>
      </div>
      
    );
  }
  

  
export default MovieList;