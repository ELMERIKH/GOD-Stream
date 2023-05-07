import React from 'react';
import './App.css';
import { AuthProvider } from './component/Auth';
import Register from './component/userRegister';

import MovieList from './component/movies';
import { BrowserRouter as Router, Route,Routes } from 'react-router-dom';
import Header from './component/header';
import Footer from './component/footer';
import Home from './component/home';
import Movie from './component/movieid';
import AddMovie from './component/addMovie';
import Protected from './component/Protected';
import Auth from './component/Login';
import Rate from './component/rating';
import Update from './component/Update';
import ChatBot from './component/ChatBot';
import AnimeList from './component/Anime';
import POKEList from './component/pokemon';
import Anime from './component/AnimeId';
import AnimeHome from './component/AnimeList';
import Popular from './component/Popular';
import Trending from './component/Trending';
import Manga from './component/Manga';
import MangaId from './component/MangaId';
import TVList from './component/TV';
import TV from './component/TVid';
function App() {
  return (
    <div>
      <AuthProvider>
         <Router>
        
            
         <Header/>
         
          <Routes>
          <Route exact path="/Anime/:id" element={<Anime/>} />
          <Route exact path="/movie/:id" element={<Movie/>} />
          <Route exact path="/tv/:id" element={<TV />} />
          <Route exact path="/Manga/:id" element={<MangaId/>} />
            <Route exact path="/" element={<Home />} />
            <Route exact path="/tv" element={<TVList />} />

            <Route exact path="/movies" element={<MovieList />} />
            <Route exact path="/register" element={<Register/>} />
            <Route exact path="/login" element={<Auth/>} />
            <Route exact path="/Update/:id" element={<Update/>} />
            <Route exact path="/ChatBot" element={<ChatBot/>} />
            <Route exact path="/Anime/All" element={<AnimeList/>} />
            <Route exact path="/Anime/Popular" element={<Popular/>} />
            <Route exact path="/Anime/Trending" element={<Trending/>} />
            <Route exact path="/Anime" element={<AnimeHome/>} />
            <Route exact path="/Manga" element={<Manga/>} />
            <Route exact path="/poke" element={<POKEList/>} />
            <Route element={<Protected/>}>
            <Route exact path="/Create" element={<AddMovie/>} />
            <Route exact path="/movies/:id" element={<Rate/>}/>
            <Route exact path="/Update/:id" element={<Update/>} />
            </Route>
            
          </Routes>
        <Footer/>
    </Router>
    </AuthProvider>
    
    </div>
  );
}

export default App;
