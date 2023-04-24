import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate,Link } from 'react-router-dom';
import './movie.css'


function POKEList() {
    const [movies, setMovies] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const email = localStorage.getItem('email');
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredMovies, setFilteredMovies] = useState([]);

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
    const handleSearch = (event) => {
      setSearchTerm(event.target.value);
    };
  
    const [page, setPage] = useState(1); // current page number
    const moviesPerPage = 15; // number of movies to display per page
   // state to control modal visibility
   useEffect(() => {
    const filtered = movies.filter((movie) => {
      return movie.title.toLowerCase().includes(searchTerm.toLowerCase());
    });
    setFilteredMovies(filtered);
  }, [movies, searchTerm]);

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
  
    useEffect(() => {
      async function fetchMovies() {
        const moviesData = [];
    for (let i = 1; i <= 100; i++) {
      const res = await axios.get(`https://pokeapi.co/api/v2/pokemon-form/${i}`);
      const movie = {
        id: res.data.id,
        title: res.data.name,
        image: res.data.sprites.front_default,
      };
      moviesData.push(movie);

    }
    setMovies(moviesData);

    
    setFilteredMovies(moviesData);

      }
      fetchMovies();
     
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
      <div className="search-box">
      <input 
        type="text"
        placeholder="Search movies..."
        value={searchTerm}
        onChange={event => setSearchTerm(event.target.value)}
      />
      
      <div className='movie-component'>
        
         
        {movieRows.map((row, index) => (
          <div key={index} className="movie-row">
            {row.map(movie => (
              <div key={movie.id} className="movie-card">
                <img src={movie.image} alt={movie.title} />
             <h2> <Link to={`/movie/${movie.id}`}
   className="h2" > {movie.title} </Link></h2>
               
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
  

  
export default POKEList;