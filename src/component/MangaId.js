import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./movie.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Rate from "./rating";
import Comments from "./comments";
import CatalogSkeleton, { LoaderMark } from "./CatalogSkeleton";
import { getMangaDetail, getMangaPages, loadMangaSources, onPosterError, POSTER_PLACEHOLDER, sourceLabel } from "../API/catalog";

function readerIdentity(detail) {
  const chapters = detail?.chapters || [];
  if (chapters.some((chapter) => String(chapter.id || "").startsWith("komikstation:"))) {
    return { id: "komikstation", label: "Komikstation" };
  }
  if (chapters.some((chapter) => String(chapter.id || "").startsWith("mangapill:"))) {
    return { id: "mangapill", label: "MangaPill" };
  }
  if (chapters.some((chapter) => chapter.id && chapter.pages && !String(chapter.id).includes(":"))) {
    return { id: "mangadex", label: "MangaDex" };
  }
  return { id: detail?.source || "catalog", label: sourceLabel(detail?.source) };
}

function MangaId() {
  const { id } = useParams();
  const email = localStorage.getItem("email");
  const [manga, setManga] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chapterIndex, setChapterIndex] = useState(0);
  const [pages, setPages] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pageNote, setPageNote] = useState("");
  const [extraSources, setExtraSources] = useState([]);
  const [activeSource, setActiveSource] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setManga(null);
    setChapterIndex(0);
    setPages([]);
    setExtraSources([]);
    setActiveSource("");
    getMangaDetail(id)
      .then((detail) => {
        if (!cancelled) setManga(detail);
      })
      .catch(() => {
        if (!cancelled) setError("This manga could not be loaded from any source.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, retryToken]);

  useEffect(() => {
    if (!manga?.title) return undefined;
    let cancelled = false;
    loadMangaSources(manga.title)
      .then((sources) => {
        if (!cancelled) setExtraSources(Array.isArray(sources) ? sources : []);
      })
      .catch(() => {
        if (!cancelled) setExtraSources([]);
      });
    return () => {
      cancelled = true;
    };
  }, [manga]);

  const readablePrimary = (manga?.chapters || []).some((chapter) => chapter.id && chapter.pages);
  const primaryIdentity = readerIdentity(manga);
  const sources = [];
  if (readablePrimary) {
    sources.push({
      id: primaryIdentity.id,
      label: primaryIdentity.label,
      chapters: manga.chapters,
    });
  }
  extraSources.forEach((source) => {
    if (source?.chapters?.length && !sources.some((item) => item.id === source.id)) sources.push(source);
  });
  if (!sources.length && manga?.chapters?.length) {
    sources.push({
      id: primaryIdentity.id,
      label: primaryIdentity.label,
      chapters: manga.chapters,
    });
  }
  const currentSource = sources.find((source) => source.id === activeSource) || sources[0] || null;
  const chapters = currentSource?.chapters || [];
  const chapter = chapters[chapterIndex] || null;

  useEffect(() => {
    if (!manga) return undefined;
    if (!chapter?.id || !chapter.pages) {
      setPages([]);
      setPageIndex(0);
      setPagesLoading(false);
      setPageNote(
        chapter
          ? "This chapter has no page images. The cover, description, and chapter list are still here."
          : manga.notice || "No chapters are available."
      );
      return undefined;
    }

    let cancelled = false;
    setPagesLoading(true);
    setPageNote("");
    getMangaPages(chapter.id)
      .then((nextPages) => {
        if (cancelled) return;
        setPages(nextPages);
        setPageIndex(0);
        setPageNote(nextPages.length ? "" : "Pages could not be loaded for this chapter.");
      })
      .catch(() => {
        if (cancelled) return;
        setPages([]);
        setPageNote("Pages could not be loaded. The chapter list is still available.");
      })
      .finally(() => {
        if (!cancelled) setPagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [manga, chapter, chapterIndex]);

  if (loading) {
    return <CatalogSkeleton variant="watch" label="Opening the reader" />;
  }

  if (!manga) {
    return (
      <div className="search-box">
        <div className="catalog-error" role="alert">
          <p>{error || "This manga could not be loaded."}</p>
          <button type="button" onClick={() => setRetryToken((value) => value + 1)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const pageCount = pages.length;

  return (
    <div className="watch-page">
      <div className="watch-stage">
        <div className="source-row" role="group" aria-label="Reading sources">
          {sources.map((source) => (
            <button
              key={source.id}
              type="button"
              className={source.id === currentSource?.id ? "is-active" : ""}
              onClick={() => {
                setActiveSource(source.id);
                setChapterIndex(0);
                setPageIndex(0);
              }}
            >
              {source.label}
            </button>
          ))}
        </div>
        {chapters.length > 0 ? (
          <div className="reader-toolbar">
            <label htmlFor="chapter-select">Chapter</label>
            <select
              id="chapter-select"
              value={chapters[chapterIndex] ? chapterIndex : 0}
              onChange={(event) => setChapterIndex(Number(event.target.value))}
            >
              {chapters.map((entry, index) => (
                <option key={`${entry.id || entry.number}-${index}`} value={index}>
                  {entry.title}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="catalog-note">No chapter list is available for this title.</p>
        )}
          <div className="reader-toolbar">
            <button
              type="button"
              disabled={pageIndex === 0 || pageCount === 0}
              onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              disabled={pageCount === 0 || pageIndex >= pageCount - 1}
              onClick={() => setPageIndex((value) => Math.min(pageCount - 1, value + 1))}
            >
              Next
            </button>
            <span>{pageCount ? `Page ${pageIndex + 1} of ${pageCount}` : "No pages"}</span>
          </div>
          {pageNote ? <p className="catalog-note">{pageNote}</p> : null}
          {pagesLoading ? (
            <div className="reader-page reader-page--loading" role="status" aria-live="polite">
              <LoaderMark />
              <p>Loading pages</p>
            </div>
          ) : pages[pageIndex] ? (
            <img
              className="reader-page"
              src={pages[pageIndex]}
              alt={`${manga.title} page ${pageIndex + 1}`}
              referrerPolicy="no-referrer"
              onError={onPosterError}
            />
          ) : null}
      </div>
      <section className="watch-meta">
        <img
          className="watch-poster"
          src={manga.image || POSTER_PLACEHOLDER}
          alt={manga.title}
          referrerPolicy="no-referrer"
          onError={onPosterError}
        />
        <div>
          <p className="source-pill">{sourceLabel(manga.source)}</p>
          <h1>{manga.title}</h1>
          {manga.rating ? <p className="rate">Score {manga.rating}</p> : null}
          {manga.notice ? <p className="catalog-note">{manga.notice}</p> : null}
          <p className="catalog-description">{manga.description || "No description is available."}</p>
        </div>
      </section>
      <div className="my-4">
        <Rate />
      </div>
      <Comments user={email} movie={id} />
    </div>
  );
}

export default MangaId;
