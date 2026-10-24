import { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import "./movie.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Rate from "./rating";
import Comments from "./comments";
import CatalogSkeleton from "./CatalogSkeleton";
import { onPosterError, POSTER_PLACEHOLDER } from "../API/catalog";
import { STREAM_SOURCES, movieEmbed, tmdbUrl, tvEmbed, youtubeEmbed } from "./tmdbEmbeds";

function pickTrailer(results) {
  const videos = Array.isArray(results) ? results : [];
  return videos.find((video) => video.site === "YouTube" && video.type === "Trailer" && video.key)
    || videos.find((video) => video.site === "YouTube" && video.key)
    || null;
}

function TmdbWatch({ kind }) {
  const { id } = useParams();
  const email = localStorage.getItem("email");
  const [title, setTitle] = useState(null);
  const [videoKey, setVideoKey] = useState("");
  const [imdbId, setImdbId] = useState("");
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [active, setActive] = useState("vidsrc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setTitle(null);
    setVideoKey("");
    setImdbId("");
    setSeason(1);
    setEpisode(1);
    setActive("vidsrc");
    const requests = [
      axios.get(tmdbUrl(`/${kind}/${id}`)),
      axios.get(tmdbUrl(`/${kind}/${id}/videos`)).catch(() => ({ data: { results: [] } })),
    ];
    if (kind === "tv") {
      requests.push(axios.get(tmdbUrl(`/tv/${id}/external_ids`)).catch(() => ({ data: {} })));
    }
    Promise.all(requests)
      .then(([titleRes, videoRes, externalRes]) => {
        if (cancelled) return;
        const data = titleRes.data || {};
        setTitle(data);
        setVideoKey(pickTrailer(videoRes.data?.results)?.key || "");
        const imdb = kind === "tv" ? externalRes?.data?.imdb_id : data.imdb_id;
        setImdbId(imdb || "");
        if (kind === "tv") {
          const seasons = (data.seasons || []).filter((row) => Number(row.episode_count) > 0);
          const preferred = seasons.find((row) => Number(row.season_number) > 0) || seasons[0];
          setSeason(Number(preferred?.season_number) || 1);
          setEpisode(1);
        }
      })
      .catch(() => {
        if (!cancelled) setError(kind === "tv" ? "This show could not be loaded." : "This movie could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, kind, retryToken]);

  if (loading) {
    return <CatalogSkeleton variant="watch" label={kind === "tv" ? "Opening the show" : "Opening the movie"} />;
  }

  if (!title) {
    return (
      <div className="search-box">
        <div className="catalog-error" role="alert">
          <p>{error || "This title could not be loaded."}</p>
          <button type="button" onClick={() => setRetryToken((value) => value + 1)}>Retry</button>
        </div>
      </div>
    );
  }

  const displayTitle = title.title || title.name || title.original_name || "Untitled";
  const poster = title.poster_path
    ? `https://image.tmdb.org/t/p/w500${title.poster_path}`
    : POSTER_PLACEHOLDER;
  const seasons = (title.seasons || []).filter((row) => Number(row.episode_count) > 0);
  const seasonRows = seasons.length ? seasons : [{ season_number: 1, episode_count: 24, name: "Season 1" }];
  const seasonRow = seasonRows.find((row) => Number(row.season_number) === Number(season)) || seasonRows[0];
  const episodeCount = Math.max(1, Number(seasonRow?.episode_count) || 1);
  const episodeNumber = Math.min(Math.max(1, Number(episode) || 1), episodeCount);
  const ids = { imdb: imdbId, tmdb: id, season, episode: episodeNumber };
  const embedFor = kind === "tv" ? tvEmbed : movieEmbed;
  const resolvedActive = active === "trailer" || embedFor(active, ids)
    ? active
    : (STREAM_SOURCES.find((source) => embedFor(source.id, ids))?.id || active);
  const embedUrl = resolvedActive === "trailer" ? youtubeEmbed(videoKey) : embedFor(resolvedActive, ids);

  function chooseSeason(value) {
    const nextSeason = Number(value);
    const nextRow = seasonRows.find((row) => Number(row.season_number) === nextSeason);
    const nextCount = Math.max(1, Number(nextRow?.episode_count) || 1);
    setSeason(nextSeason);
    setEpisode((current) => Math.min(Math.max(1, current), nextCount));
  }

  return (
    <div className="watch-page">
      <div className="title-layout">
        <div className="watch-stage">
          {embedUrl ? (
            <div className="stream-frame">
              <iframe
                key={embedUrl}
                title={resolvedActive === "trailer" ? `${displayTitle} trailer` : displayTitle}
                src={embedUrl}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="origin"
              />
            </div>
          ) : (
            <div className="stream-frame stream-frame--empty">
              <p>No embed is available for this selection.</p>
            </div>
          )}
          <div className="source-row" role="group" aria-label="Stream sources">
            {STREAM_SOURCES.map((source) => {
              const url = embedFor(source.id, ids);
              return (
                <button
                  key={source.id}
                  type="button"
                  className={resolvedActive === source.id ? "is-active" : ""}
                  disabled={!url}
                  onClick={() => setActive(source.id)}
                >
                  {source.label}
                </button>
              );
            })}
            {videoKey ? (
              <button
                type="button"
                className={resolvedActive === "trailer" ? "is-active" : ""}
                onClick={() => setActive("trailer")}
              >
                Trailer
              </button>
            ) : null}
          </div>
          {kind === "tv" ? (
            <div className="reader-toolbar">
              <label htmlFor="season-select">
                Season
                <select id="season-select" value={String(seasonRow.season_number)} onChange={(event) => chooseSeason(event.target.value)}>
                  {seasonRows.map((row) => (
                    <option key={row.season_number} value={String(row.season_number)}>
                      {row.name || `Season ${row.season_number}`}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="episode-number">
                Episode
                <select
                  id="episode-number"
                  value={String(episodeNumber)}
                  onChange={(event) => setEpisode(Number(event.target.value))}
                >
                  {Array.from({ length: episodeCount }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {index + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>
        <aside className="title-side">
          <img src={poster} alt={displayTitle} referrerPolicy="no-referrer" onError={onPosterError} />
          <h1>{displayTitle}</h1>
          {Number.isFinite(Number(title.vote_average)) ? (
            <p className="rate">Rating {Number(title.vote_average).toFixed(1)}</p>
          ) : null}
          {title.vote_count ? <p className="catalog-note">{title.vote_count} voters</p> : null}
          <p className="catalog-description">{title.overview || "No overview is available."}</p>
        </aside>
      </div>
      <div className="my-4">
        <Rate />
      </div>
      <Comments user={email} movie={id} />
    </div>
  );
}

export default TmdbWatch;
