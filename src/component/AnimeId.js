import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./movie.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Rate from "./rating";
import Comments from "./comments";
import CatalogSkeleton from "./CatalogSkeleton";
import { getAnimeDetail, onPosterError, POSTER_PLACEHOLDER, sourceLabel } from "../API/catalog";

function Anime() {
  const { id } = useParams();
  const email = localStorage.getItem("email");
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEpisode, setSelectedEpisode] = useState(0);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setMovie(null);
    setSelectedEpisode(0);
    getAnimeDetail(id)
      .then((detail) => {
        if (!cancelled) setMovie(detail);
      })
      .catch(() => {
        if (!cancelled) setError("This anime could not be loaded from any source.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, retryToken]);

  if (loading) {
    return (
      <div className="search-box">
        <CatalogSkeleton />
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="search-box">
        <div className="catalog-error" role="alert">
          <p>{error || "This anime could not be loaded."}</p>
          <button type="button" onClick={() => setRetryToken((value) => value + 1)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const episodes = movie.episodes || [];
  const episode = episodes[selectedEpisode] || null;

  return (
    <div className="container my-5 catalog-detail">
      <div className="row">
        <div className="col-md-4">
          <img
            src={movie.image || POSTER_PLACEHOLDER}
            alt={movie.title}
            className="img-fluid rounded"
            onError={onPosterError}
          />
          {movie.rating ? <h2 className="rate">Score {movie.rating}</h2> : null}
          <p className="catalog-note">{sourceLabel(movie.source)}</p>
        </div>
        <div className="col-md-8">
          <h1>{movie.title}</h1>
          {movie.notice ? <p className="catalog-note">{movie.notice}</p> : null}
          <div className="my-4">
            <p className="catalog-description">{movie.description || "No description is available."}</p>
          </div>
          {episodes.length > 0 ? (
            <div className="reader-toolbar">
              <label htmlFor="episode-select">Episode</label>
              <select
                id="episode-select"
                value={selectedEpisode}
                onChange={(event) => setSelectedEpisode(Number(event.target.value))}
              >
                {episodes.map((entry, index) => (
                  <option key={`${entry.number}-${index}`} value={index}>
                    {entry.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="catalog-note">No episode list is available for this title.</p>
          )}
          {episode?.thumbnail ? (
            <img className="episode-thumb" src={episode.thumbnail} alt="" onError={onPosterError} />
          ) : null}
          {episode?.url ? (
            <p className="reader-toolbar">
              <a className="watch-link" href={episode.url} target="_blank" rel="noopener noreferrer">
                Watch {episode.site ? `on ${episode.site}` : "episode"}
              </a>
            </p>
          ) : (
            <p className="catalog-note">Stream playback is unavailable. The poster and episode list stay on this page.</p>
          )}
          <div className="my-4">
            <Rate />
          </div>
        </div>
      </div>
      <div className="row my-5">
        <div className="col-md-12">
          <Comments user={email} movie={id} />
        </div>
      </div>
    </div>
  );
}

export default Anime;
