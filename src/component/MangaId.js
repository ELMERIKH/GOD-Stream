import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import "./movie.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Rate from "./rating";
import Comments from "./comments";
import CatalogSkeleton, { LoaderMark } from "./CatalogSkeleton";
import WatchRail from "./WatchRail";
import { getMangaDetail, getMangaPages, loadMangaSources, onPosterError, POSTER_PLACEHOLDER, sourceLabel } from "../API/catalog";

function isImageChapter(chapter) {
  if (!chapter?.id || !chapter.pages) return false;
  return !String(chapter.id).startsWith("mangapill:");
}

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

function buildSources(manga, extraSources) {
  const sources = [];
  const identity = readerIdentity(manga);
  const primary = (manga?.chapters || []).filter(isImageChapter);
  if (primary.length && identity.id !== "mangapill") {
    sources.push({ id: identity.id, label: identity.label, chapters: primary });
  }
  (extraSources || []).forEach((source) => {
    if (!source?.id || source.id === "mangapill") return;
    const chapters = (source.chapters || []).filter(isImageChapter);
    if (!chapters.length || sources.some((item) => item.id === source.id)) return;
    sources.push({ id: source.id, label: source.label || sourceLabel(source.id), chapters });
  });
  if (!sources.length && manga?.chapters?.length) {
    const listed = (manga.chapters || []).filter((chapter) => !String(chapter.id || "").startsWith("mangapill:"));
    if (listed.length && identity.id !== "mangapill") {
      sources.push({ id: identity.id, label: identity.label, chapters: listed });
    }
  }
  return sources;
}

function MangaId() {
  const { id } = useParams();
  const email = localStorage.getItem("email");
  const [manga, setManga] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chapterIndex, setChapterIndex] = useState(0);
  const [chapterQuery, setChapterQuery] = useState("");
  const [pages, setPages] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pageNote, setPageNote] = useState("");
  const [pageFailed, setPageFailed] = useState(false);
  const [pageTry, setPageTry] = useState(0);
  const [extraSources, setExtraSources] = useState([]);
  const [sourcesReady, setSourcesReady] = useState(false);
  const [activeSource, setActiveSource] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const failedSources = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setManga(null);
    setChapterIndex(0);
    setChapterQuery("");
    setPages([]);
    setExtraSources([]);
    setSourcesReady(false);
    setActiveSource("");
    failedSources.current = new Set();
    getMangaDetail(id, retryToken > 0)
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
    setSourcesReady(false);
    loadMangaSources(manga.title)
      .then((sources) => {
        if (!cancelled) setExtraSources(Array.isArray(sources) ? sources : []);
      })
      .catch(() => {
        if (!cancelled) setExtraSources([]);
      })
      .finally(() => {
        if (!cancelled) setSourcesReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [manga]);

  const sources = useMemo(() => buildSources(manga, extraSources), [manga, extraSources]);
  const currentSource = sources.find((source) => source.id === activeSource) || sources[0] || null;
  const chapters = currentSource?.chapters || [];
  const safeIndex = chapters[chapterIndex] ? chapterIndex : 0;
  const chapter = chapters[safeIndex] || null;

  useEffect(() => {
    if (!manga) return undefined;
    const sourceId = currentSource?.id || "";
    if (!chapter?.id || !isImageChapter(chapter)) {
      const next = sources.find((source) => source.id !== sourceId && !failedSources.current.has(source.id) && source.chapters.some(isImageChapter));
      if (next) {
        setActiveSource(next.id);
        setChapterIndex(0);
        setPageNote("");
        return undefined;
      }
      setPages([]);
      setPageIndex(0);
      setPagesLoading(false);
      setPageNote(
        !sourcesReady
          ? "Looking for a reader with page images."
          : (chapter
            ? "This chapter has no page images."
            : manga.notice || "No chapters are available.")
      );
      return undefined;
    }

    let cancelled = false;
    setPagesLoading(true);
    setPageNote("");
    getMangaPages(chapter.id)
      .then((nextPages) => {
        if (cancelled) return;
        if (!nextPages.length) {
          failedSources.current.add(sourceId);
          const next = sources.find((source) => source.id !== sourceId && !failedSources.current.has(source.id));
          if (next) {
            setActiveSource(next.id);
            setChapterIndex(0);
            setPages([]);
            setPageNote("");
            return;
          }
        }
        setPages(nextPages);
        setPageIndex(0);
        setPageNote(nextPages.length ? "" : "Pages could not be loaded for this chapter.");
      })
      .catch(() => {
        if (cancelled) return;
        failedSources.current.add(sourceId);
        const next = sources.find((source) => source.id !== sourceId && !failedSources.current.has(source.id));
        if (next) {
          setActiveSource(next.id);
          setChapterIndex(0);
          setPages([]);
          setPageNote("");
          return;
        }
        setPages([]);
        setPageNote("Pages could not be loaded. The chapter list is still available.");
      })
      .finally(() => {
        if (!cancelled) setPagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [manga, sources, chapter, currentSource?.id, sourcesReady]);

  useEffect(() => {
    setPageFailed(false);
  }, [pages, pageIndex]);

  useEffect(() => {
    const upcoming = pages[pageIndex + 1];
    if (!upcoming) return undefined;
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.src = upcoming;
    return undefined;
  }, [pages, pageIndex]);

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
  const railItems = chapters.length ? chapters : (manga.chapters || []).filter((entry) => !String(entry.id || "").startsWith("mangapill:"));

  return (
    <div className="watch-page">
      <div className="watch-layout">
        <div className="watch-stage">
          {manga.stale ? (
            <div className="status-banner" role="status">
              <p>Showing a saved copy while sources catch up.</p>
              <button type="button" onClick={() => setRetryToken((value) => value + 1)}>Refresh</button>
            </div>
          ) : null}
          {sources.length > 0 ? (
            <div className="source-row" role="group" aria-label="Reading sources">
              {sources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className={source.id === currentSource?.id ? "is-active" : ""}
                  onClick={() => {
                    failedSources.current.delete(source.id);
                    setActiveSource(source.id);
                    setChapterIndex(0);
                    setPageIndex(0);
                  }}
                >
                  {source.label}
                </button>
              ))}
            </div>
          ) : null}
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
          ) : pageFailed ? (
            <div className="reader-fallback" role="alert">
              <p>This page did not load.</p>
              <div className="reader-toolbar">
                <button type="button" onClick={() => { setPageFailed(false); setPageTry((value) => value + 1); }}>
                  Retry page
                </button>
                <button
                  type="button"
                  disabled={pageIndex >= pageCount - 1}
                  onClick={() => setPageIndex((value) => Math.min(pageCount - 1, value + 1))}
                >
                  Next page
                </button>
              </div>
            </div>
          ) : pages[pageIndex] ? (
            <img
              key={`${pages[pageIndex]}:${pageTry}`}
              className="reader-page"
              src={pages[pageIndex]}
              alt={`${manga.title} page ${pageIndex + 1}`}
              referrerPolicy="no-referrer"
              decoding="async"
              onError={() => setPageFailed(true)}
            />
          ) : null}
        </div>
        <WatchRail
          label="Chapters"
          query={chapterQuery}
          onQuery={setChapterQuery}
          items={railItems}
          selectedIndex={safeIndex}
          onSelect={(index) => {
            setChapterIndex(index);
            setPageIndex(0);
          }}
          emptyNote="No chapter list is available for this title."
        />
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
