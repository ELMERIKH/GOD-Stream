import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./movie.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Rate from "./rating";
import Comments from "./comments";
import CatalogSkeleton from "./CatalogSkeleton";
import {
  getAnimeDetail,
  loadEpisodeServers,
  onPosterError,
  POSTER_PLACEHOLDER,
  resolveEpisodeServer,
  sourceLabel,
} from "../API/catalog";

function Anime() {
  const { id } = useParams();
  const email = localStorage.getItem("email");
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEpisode, setSelectedEpisode] = useState(0);
  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [embedNote, setEmbedNote] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setMovie(null);
    setSelectedEpisode(0);
    setServers([]);
    setActiveServer("");
    setEmbedUrl("");
    setEmbedNote("");
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

  useEffect(() => {
    const episode = movie?.episodes?.[selectedEpisode];
    if (!episode?.episodeId) {
      setServers([]);
      setActiveServer("");
      setEmbedUrl("");
      setEmbedNote("");
      return undefined;
    }
    let cancelled = false;
    setEmbedUrl("");
    setEmbedNote("Loading player");
    loadEpisodeServers(episode.episodeId)
      .then(async (list) => {
        if (cancelled) return;
        setServers(list);
        for (const server of list) {
          const url = await resolveEpisodeServer(server);
          if (cancelled) return;
          if (url) {
            setActiveServer(server.id);
            setEmbedUrl(url);
            setEmbedNote("");
            return;
          }
        }
        setActiveServer("");
        setEmbedUrl("");
        setEmbedNote(list.length ? "This episode has no embeddable player." : "This episode has no stream sources.");
      })
      .catch(() => {
        if (cancelled) return;
        setServers([]);
        setEmbedUrl("");
        setEmbedNote("The player could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [movie, selectedEpisode]);

  function chooseServer(server) {
    setActiveServer(server.id);
    setEmbedUrl("");
    setEmbedNote("Loading player");
    resolveEpisodeServer(server)
      .then((url) => {
        setEmbedUrl(url || "");
        setEmbedNote(url ? "" : "This source has no embeddable player.");
      })
      .catch(() => {
        setEmbedUrl("");
        setEmbedNote("The player could not be loaded.");
      });
  }

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
  const watchLinks = movie.watchLinks || [];
  const preview = !embedUrl && !episode?.episodeId && movie.preview?.embed ? movie.preview : null;

  return (
    <div className="watch-page">
      {movie.banner ? <img className="watch-banner" src={movie.banner} alt="" /> : null}
      <div className="watch-stage">
        {embedUrl ? (
          <div className="stream-frame">
            <iframe
              title={`${movie.title} ${episode?.title || "player"}`}
              src={embedUrl}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="stream-frame stream-frame--empty">
            <p>{embedNote || "Choose a stream source"}</p>
          </div>
        )}
        {servers.length > 0 ? (
          <div className="source-row" role="group" aria-label="Stream sources">
            {servers.map((server) => (
              <button
                key={server.id || server.label}
                type="button"
                className={server.id === activeServer ? "is-active" : ""}
                onClick={() => chooseServer(server)}
              >
                {server.label}
              </button>
            ))}
          </div>
        ) : null}
        {watchLinks.length > 0 ? (
          <div className="source-row" aria-label="More stream links">
            {watchLinks.map((link) => (
              <a key={link.url} className="source-link" href={link.url} target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
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
        {embedUrl && embedNote ? <p className="catalog-note">{embedNote}</p> : null}
        {preview ? (
          <>
            <p className="catalog-note">{preview.label}</p>
            <div className="stream-frame">
              <iframe
                title={preview.label}
                src={preview.embed}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          </>
        ) : null}
        {!embedUrl && episode?.url && embedNote !== "Loading player" ? (
          <p className="reader-toolbar">
            <a className="watch-link" href={episode.url} target="_blank" rel="noopener noreferrer">
              Watch {episode.site ? `on ${episode.site}` : "episode"}
            </a>
          </p>
        ) : null}
      </div>
      <section className="watch-meta">
        <img
          className="watch-poster"
          src={movie.image || POSTER_PLACEHOLDER}
          alt={movie.title}
          referrerPolicy="no-referrer"
          onError={onPosterError}
        />
        <div>
          <p className="source-pill">{sourceLabel(movie.source)}</p>
          <h1>{movie.title}</h1>
          {movie.rating ? <p className="rate">Score {movie.rating}</p> : null}
          {movie.notice ? <p className="catalog-note">{movie.notice}</p> : null}
          <p className="catalog-description">{movie.description || "No description is available."}</p>
        </div>
      </section>
      <div className="my-4">
        <Rate />
      </div>
      <Comments user={email} movie={id} />
    </div>
  );
}

export default Anime;
