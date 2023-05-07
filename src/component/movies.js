import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate,Link } from 'react-router-dom';
import './movie.css'


function MovieList() {
    const [movies, setMovies] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const email = localStorage.getItem('email');
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredMovies, setFilteredMovies] = useState([]);
    const [Url, setUrl] = useState('https://api.themoviedb.org/3/movie/now_playing?api_key=152f41397d36a9af171b938124f0281c');


    const navigate = useNavigate()
    useEffect(() => {
      console.log(email)
      async function fetchUserData() {
        
        const res = await axios.get(`http://localhost:9000/api/auth/getRole/${email}`);
        console.log(res.data.role)
       if(res.data.role!=="admin") {setIsAdmin(false)}
       else setIsAdmin(true)
      }
      fetchUserData();
    }, []);
    
  
    const [page, setPage] = useState(1); // current page number
    const moviesPerPage = 20; // number of movies to display per page
   // state to control modal visibility
  
  
    // get current movies based on current page
    const indexOfLastMovie = page * moviesPerPage;
    const indexOfFirstMovie = indexOfLastMovie - moviesPerPage;
    const currentMovies = filteredMovies.slice(indexOfFirstMovie, indexOfLastMovie);

    const handleDelete = (movieId) => {
      // make DELETE request to your backend using the movie id
      axios.delete(`http://localhost:9000/api/delete/${movieId}`)
        .then(res => {
          console.log(res.data);
          // update your frontend state to remove the deleted movie
          setMovies(movies.filter(movie => movie._id !== movieId));
        })
        .catch(err => console.error(err));
    };
    const handleUrlChange = (prop) => {
      setUrl(prop);
      setPage(1);
    };
    useEffect(() => {
      async function fetchMovies() {
        let moviesData = [];
  
        if (searchTerm !== '') {
          // If searchTerm is not empty, make a search request
          const res = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=152f41397d36a9af171b938124f0281c&query=${searchTerm}`);
          if (res.data.results) {
            moviesData = res.data.results.map((movie) => ({
              id: movie.id,
              title: movie.title,
              image: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
              rating: movie.vote_average,
              overview: movie.overview,
              releaseDate: movie.release_date,
            }));
          }
        } else {
          // If searchTerm is empty, fetch all the movies
          for (let i = 1; i <= 100; i++) {
            const res = await axios.get(`${Url}&page=${i}`);
            const movies = res.data.results.map((movie) => ({
              id: movie.id,
              title: movie.title,
              image: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
              rating: movie.vote_average,
              overview: movie.overview,
              releaseDate: movie.release_date,
            }));
            moviesData.push(...movies);
          }
        }
        setMovies(moviesData);
        setFilteredMovies(moviesData);
      }
  
      fetchMovies();
    }, [searchTerm,Url]);
  
  
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
      <div className="search-box">
     <input 
        type="text"
        placeholder="Search movies..."
        value={searchTerm}
        onChange={event => setSearchTerm(event.target.value)}
      />
         <div><td>               <button onClick={() => handleUrlChange(`https://api.themoviedb.org/3/movie/top_rated?api_key=152f41397d36a9af171b938124f0281c`)} >Top Rated  </button>
</td><td>               <button onClick={() => handleUrlChange(`https://api.themoviedb.org/3/movie/now_playing?api_key=152f41397d36a9af171b938124f0281c`)} >Lastest </button>
</td><td>              <button onClick={() => handleUrlChange(`https://api.themoviedb.org/3/movie/popular?api_key=152f41397d36a9af171b938124f0281c`)} >Popular  </button>

</td></div>
      <div className='movie-component'>
        
         
        {movieRows.map((row, index) => (
          <div key={index} className="movie-row">
            {row.map(movie => (
              <div key={movie.id} className="movie-card">
                <img src={movie.image} alt={movie.title} />
             <h4> <Link style={{textDecoration: 'none'}}to={`/movie/${movie.id}`}
   className="h2" > {movie.title} </Link></h4>
                <p className='p'>rating : {movie.rating}</p>
                {isAdmin && (
                <button className='btn btn-warning' onClick={() =>   navigate(`/Update/${movie._id}`)}>Update</button>)}
                {isAdmin && (
                <button className='btn btn-danger' onClick={() => handleDelete(movie._id)}>Delete</button>)}
                
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
      
      </div>
      
    );
  }
  

  
export default MovieList;