import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate,Link } from 'react-router-dom';
import './movie.css'

function Manga() {
    const [movies, setMovies] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const email = localStorage.getItem('email');
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredMovies, setFilteredMovies] = useState([]);
    const [img, setimg] = useState([]);

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
  
      const handleSearch  = async () => {
       
        const res = await axios.get(`https://consumet-api-m8mf.onrender.com/manga/mangadex/${searchTerm}`, {
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        });
      
        setFilteredMovies([]);
        if (res.data.results ) {
          const movies = res.data.results.map(movie => axios.get(`https://consumet-api-m8mf.onrender.com/manga/mangadex/info/${movie.id}`, {
            headers: {
              'Access-Control-Allow-Origin': '*',
            },
          }));
          const resolvedMovies = await Promise.all(movies);
          const newMovies = resolvedMovies.map(res => ({
            id: res.data.id,
            title: res.data.title ,
            image: res.data.image,
          }));
       
          
          setFilteredMovies((prevMoviesData) => [...prevMoviesData, ...newMovies]);

          
        
        }
        
      };
      
      // Add this button element to your JSX
      
      
    
  
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
  
    useEffect(() => {
      
      async function fetchMovies() {
       
    for (let i = 1; i <= 10; i++) {
      const res = await axios.get(`https://consumet-api-m8mf.onrender.com/manga/mangadex/info$o?page=${i}`
       
      );
      
      const newMovies = [];
      
      if (res.data.results) { // check if results exists
        const movies = res.data.results.map(movie => axios.get(`https://consumet-api-m8mf.onrender.com/manga/mangadex/info/${movie.id}`
         
        ));
        
        const resolvedMovies = await Promise.all(movies);
        const newMovies= resolvedMovies.map((movie) => ({
          id: movie.data.id,
          title:  movie.data.title,
          image: movie.data.image
        }));
        setFilteredMovies((prevMoviesData) => [...prevMoviesData, ...newMovies]);
       
      }
    }
    


 

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
      <ul><input 
        type="text"
        placeholder="Search movies..."
        value={searchTerm}
        onChange={event => setSearchTerm(event.target.value)}
      />
      <button onClick={handleSearch}>Search</button></ul>
      <div className='movie-component'>
        
         
        {movieRows.map((row, index) => (
          <div key={index} className="movie-row">
            {row.map((movie) => (
              <div key={movie.id }  className="movie-card">
                <img src={movie.image} alt={movie.title} />
             <h2> <Link to={`/Manga/${movie.id}`}
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
  

  
export default Manga;
