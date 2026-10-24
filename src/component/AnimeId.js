import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./movie.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Rate from "./rating";
import Comments from "./comments";
import CatalogSkeleton, { LoaderMark } from "./CatalogSkeleton";
import WatchRail from "./WatchRail";
import {
  getAnimeDetail,
  loadEpisodeServers,
  onPosterError,
  POSTER_PLACEHOLDER,
  resolveEpisodeServer,
  sourceLabel,
} from "../API/catalog";

function malAnimeEmbed(malId, episodeNumber) {
  const id = Number(malId);
  const episode = Number(episodeNumber);
  if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(episode) || episode <= 0) return "";
  return `https://vidsrc.me/embed/anime/mal/${id}/${episode}`;
}

function Anime() {
  const { id } = useParams();
  const email = localStorage.getItem("email");
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEpisode, setSelectedEpisode] = useState(0);
  const [episodeQuery, setEpisodeQuery] = useState("");
  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [embedNote, setEmbedNote] = useState("");
  const [blockedServers, setBlockedServers] = useState([]);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setMovie(null);
    setSelectedEpisode(0);
    setEpisodeQuery("");
    setServers([]);
    setActiveServer("");
    setEmbedUrl("");
    setEmbedNote("");
    setBlockedServers([]);
    getAnimeDetail(id, retryToken > 0)
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

  const episodes = movie?.episodes || [];
  const episode = episodes[selectedEpisode] || null;
  const malEmbed = malAnimeEmbed(movie?.malId, episode?.number || (episodes.length ? 0 : 1));

  useEffect(() => {
    if (!movie) return undefined;
    if (!episode?.episodeId) {
      setServers([]);
      setBlockedServers([]);
      if (malEmbed) {
        setActiveServer("mal-vidsrc");
        setEmbedUrl(malEmbed);
        setEmbedNote("");
      } else {
        setActiveServer("");
        setEmbedUrl("");
        setEmbedNote("");
      }
      return undefined;
    }
    let cancelled = false;
    setEmbedUrl("");
    setEmbedNote("Loading player");
    setBlockedServers([]);
    loadEpisodeServers(episode.episodeId)
      .then(async (list) => {
        if (cancelled) return;
        setServers(list);
        const skipped = [];
        for (const server of list) {
          const url = await resolveEpisodeServer(server);
          if (cancelled) return;
          if (url) {
            setBlockedServers(skipped);
            setActiveServer(server.id);
            setEmbedUrl(url);
            setEmbedNote("");
            return;
          }
          skipped.push(server.id);
        }
        setBlockedServers(skipped);
        if (malEmbed) {
          setActiveServer("mal-vidsrc");
          setEmbedUrl(malEmbed);
          setEmbedNote("");
          return;
        }
        setActiveServer("");
        setEmbedUrl("");
        setEmbedNote("");
      })
      .catch(() => {
        if (cancelled) return;
        setServers([]);
        if (malEmbed) {
          setActiveServer("mal-vidsrc");
          setEmbedUrl(malEmbed);
          setEmbedNote("");
          return;
        }
        setEmbedUrl("");
        setEmbedNote("");
      });
    return () => {
      cancelled = true;
    };
  }, [movie, selectedEpisode, episode?.episodeId, malEmbed]);

  function chooseServer(server) {
    setActiveServer(server.id);
    setEmbedUrl("");
    setEmbedNote("Loading player");
    resolveEpisodeServer(server)
      .then((url) => {
        if (url) {
          setEmbedUrl(url);
          setEmbedNote("");
          return;
        }
        setBlockedServers((current) => (current.includes(server.id) ? current : [...current, server.id]));
        if (malEmbed) {
          setActiveServer("mal-vidsrc");
          setEmbedUrl(malEmbed);
          setEmbedNote("");
          return;
        }
        setEmbedUrl("");
        setEmbedNote("");
      })
      .catch(() => {
        if (malEmbed) {
          setActiveServer("mal-vidsrc");
          setEmbedUrl(malEmbed);
          setEmbedNote("");
          return;
        }
        setEmbedUrl("");
        setEmbedNote("");
      });
  }

  function playMal() {
    if (!malEmbed) return;
    setActiveServer("mal-vidsrc");
    setEmbedUrl(malEmbed);
    setEmbedNote("");
  }

  function playTrailer() {
    if (!movie?.preview?.embed) return;
    setActiveServer("trailer");
    setEmbedUrl(movie.preview.embed);
    setEmbedNote("");
  }

  if (loading) {
    return <CatalogSkeleton variant="watch" label="Opening the player" />;
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

  const seenSites = new Set();
  const watchLinks = (movie.watchLinks || []).filter((link) => {
    const key = String(link.label || link.url || "").trim().toLowerCase();
    if (!key || seenSites.has(key)) return false;
    seenSites.add(key);
    return true;
  });
  const loadingPlayer = embedNote === "Loading player";
  const hasOffers = Boolean(servers.length || malEmbed || movie.preview?.embed || watchLinks.length || episode?.url);

  const sourceButtons = (
    <>
      {servers.map((server) => (
        <button
          key={server.id || server.label}
          type="button"
          className={[
            server.id === activeServer ? "is-active" : "",
            blockedServers.includes(server.id) ? "is-blocked" : "",
          ].filter(Boolean).join(" ")}
          onClick={() => chooseServer(server)}
        >
          {server.label}
        </button>
      ))}
      {malEmbed ? (
        <button type="button" className={activeServer === "mal-vidsrc" ? "is-active" : ""} onClick={playMal}>
          VidSrc
        </button>
      ) : null}
      {movie.preview?.embed ? (
        <button type="button" className={activeServer === "trailer" ? "is-active" : ""} onClick={playTrailer}>
          {movie.preview.label || "Trailer"}
        </button>
      ) : null}
      {watchLinks.map((link) => (
        <a key={link.url} className="source-link" href={link.url} target="_blank" rel="noopener noreferrer">
          {link.label}
        </a>
      ))}
      {!embedUrl && episode?.url && !watchLinks.some((link) => link.url === episode.url) ? (
        <a className="source-link" href={episode.url} target="_blank" rel="noopener noreferrer">
          Watch {episode.site ? `on ${episode.site}` : "episode"}
        </a>
      ) : null}
    </>
  );

  return (
    <div className="watch-page">
      {movie.banner ? <img className="watch-banner" src={movie.banner} alt="" /> : null}
      <div className="watch-layout">
        <div className="watch-stage">
          {embedUrl ? (
            <div className="stream-frame">
              <iframe
                key={embedUrl}
                title={`${movie.title} ${episode?.title || "player"}`}
                src={embedUrl}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="origin"
              />
            </div>
          ) : (
            <div className={`stream-frame stream-frame--empty${loadingPlayer ? " is-loading" : ""}`}>
              {loadingPlayer ? (
                <div className="player-loader">
                  <LoaderMark />
                  <p>Loading player</p>
                </div>
              ) : (
                <div className="empty-player">
                  {hasOffers ? (
                    <>
                      <p>Choose a source to start this episode.</p>
                      <div className="source-row" role="group" aria-label="Stream sources">{sourceButtons}</div>
                    </>
                  ) : (
                    <p>No playable source is listed for this episode.</p>
                  )}
                </div>
              )}
            </div>
          )}
          {movie.stale ? (
            <div className="status-banner" role="status">
              <p>Showing a saved copy while sources catch up.</p>
              <button type="button" onClick={() => setRetryToken((value) => value + 1)}>Refresh</button>
            </div>
          ) : null}
          {embedUrl ? (
            <div className="source-row" role="group" aria-label="Stream sources">
              {sourceButtons}
            </div>
          ) : null}
          {blockedServers.length > 0 && embedUrl ? (
            <p className="catalog-note">Some hosts block embedded players. The highlighted source is the one that can play here.</p>
          ) : null}
        </div>
        <WatchRail
          label="Episodes"
          query={episodeQuery}
          onQuery={setEpisodeQuery}
          items={episodes}
          selectedIndex={selectedEpisode}
          onSelect={setSelectedEpisode}
          emptyNote="No episode list is available for this title."
        />
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
