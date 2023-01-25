import React from 'react';
import './Home.css';
import 'bootstrap/dist/css/bootstrap.min.css';
const Home = () => {
  return (
    <div className="home">
      <div className="container">
        <div className="jumbotron">
          <h1 className="display-4">Welcome to Movie reviews</h1>
          <p >rate and discuss all your favorite movies.</p>
          <hr className="my-4" />
          <p>Explore the world of cinema and stay updated with the latest releases.</p>
          <a className="btn btn-primary btn-lg" href="#1" role="button">Explore</a>
        </div>
      </div>
    </div>
  );
};

export default Home;
