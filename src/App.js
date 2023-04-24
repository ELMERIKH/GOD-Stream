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
function App() {
  return (
    <div><AuthProvider>
         <Router>
        
            
         <Header/>
         
          <Routes>
          <Route exact path="/movie/:id" element={<Movie/>} />
            <Route exact path="/" element={<Home />} />
            <Route exact path="/movies" element={<MovieList />} />
            <Route exact path="/register" element={<Register/>} />
            <Route exact path="/login" element={<Auth/>} />
            <Route exact path="/Update/:id" element={<Update/>} />
            <Route exact path="/ChatBot" element={<ChatBot/>} />
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
