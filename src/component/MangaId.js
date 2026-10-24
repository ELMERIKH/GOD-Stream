import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./movie.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Rate from "./rating";
import Comments from "./comments";
import CatalogSkeleton from "./CatalogSkeleton";
import { getMangaDetail, getMangaPages, onPosterError, POSTER_PLACEHOLDER, sourceLabel } from "../API/catalog";

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
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setManga(null);
    setChapterIndex(0);
    setPages([]);
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
    const chapter = manga?.chapters?.[chapterIndex];
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
  }, [manga, chapterIndex]);

  if (loading) {
    return (
      <div className="search-box">
        <CatalogSkeleton />
      </div>
    );
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

  const chapters = manga.chapters || [];
  const pageCount = pages.length;

  return (
    <div className="container my-5 catalog-detail">
      <div className="row">
        <div className="col-md-4">
          <img
            src={manga.image || POSTER_PLACEHOLDER}
            alt={manga.title}
            className="img-fluid rounded"
            onError={onPosterError}
          />
          {manga.rating ? <h2 className="rate">Score {manga.rating}</h2> : null}
          <p className="catalog-note">{sourceLabel(manga.source)}</p>
        </div>
        <div className="col-md-8">
          <h1>{manga.title}</h1>
          {manga.notice ? <p className="catalog-note">{manga.notice}</p> : null}
          <div className="my-4">
            <p className="catalog-description">{manga.description || "No description is available."}</p>
          </div>
          {chapters.length > 0 ? (
            <div className="reader-toolbar">
              <label htmlFor="chapter-select">Chapter</label>
              <select
                id="chapter-select"
                value={chapterIndex}
                onChange={(event) => setChapterIndex(Number(event.target.value))}
              >
                {chapters.map((chapter, index) => (
                  <option key={`${chapter.id || chapter.number}-${index}`} value={index}>
                    {chapter.title}
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
          {pagesLoading && <p className="catalog-note">Loading pages</p>}
          {pageNote ? <p className="catalog-note">{pageNote}</p> : null}
          {pages[pageIndex] ? (
            <img
              className="reader-page"
              src={pages[pageIndex]}
              alt={`${manga.title} page ${pageIndex + 1}`}
              onError={onPosterError}
            />
          ) : null}
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

export default MangaId;
