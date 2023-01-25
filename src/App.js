import React from 'react';
import './App.css';

import Register from './component/userauth';
import Login from './component/userlogin';
import MovieList from './component/movies';
import { BrowserRouter as Router, Route,Link,Routes } from 'react-router-dom';
import Header from './component/header';
import Footer from './component/footer';
import Home from './component/home';
import Movie from './component/movieid';
function App() {
  return (
    <div>
         <Router>
        
            
         <Header/>
         
          <Routes>
          <Route exact path="/movie/:id" element={<Movie/>} />
            <Route exact path="/home" element={<Home />} />
            <Route exact path="/movies" element={<MovieList />} />
            <Route exact path="/register" element={<Register/>} />
            <Route exact path="/login" element={<Login/>} />
          </Routes>
        <Footer/>
    </Router>
    </div>
  );
}

export default App;
