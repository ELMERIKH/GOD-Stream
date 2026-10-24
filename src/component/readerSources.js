import { sourceLabel } from "../API/catalog";

const COMIC_LABELS = {
  bacakomik: "BacaKomik · Indonesian",
  komikindo: "Komikindo · Indonesian",
  komikstation: "Komikstation · Indonesian",
  mangakita: "MangaKita · Indonesian",
};

const SOURCE_ORDER = ["weebcentral", "mangadex", "bacakomik", "komikindo", "komikstation", "mangakita"];

export function isImageChapter(chapter) {
  if (!chapter?.id || !chapter.pages) return false;
  return !String(chapter.id).startsWith("mangapill:");
}

function chapterSourceId(chapterId) {
  const id = String(chapterId || "");
  const comic = id.match(/^sanka:([a-z0-9]+):/);
  if (comic && comic[1] !== "mangasusuku") return comic[1];
  if (id.startsWith("komikstation:")) return "komikstation";
  if (id.startsWith("weebchapter:")) return "weebcentral";
  if (id.startsWith("mangapill:")) return "mangapill";
  return "";
}

function readerIdentity(detail) {
  const chapters = detail?.chapters || [];
  const fromChapter = chapters.map((chapter) => chapterSourceId(chapter.id)).find(Boolean);
  if (fromChapter === "mangapill") return { id: "mangapill", label: "MangaPill" };
  if (fromChapter && COMIC_LABELS[fromChapter]) return { id: fromChapter, label: COMIC_LABELS[fromChapter] };
  if (fromChapter === "weebcentral") return { id: "weebcentral", label: "Weeb Central" };
  if (chapters.some((chapter) => chapter.id && chapter.pages && !String(chapter.id).includes(":"))) {
    return { id: "mangadex", label: "MangaDex" };
  }
  if (fromChapter) return { id: fromChapter, label: sourceLabel(fromChapter) };
  return { id: detail?.source || "catalog", label: sourceLabel(detail?.source) };
}

function nonEnglishDex(source) {
  if (source?.id !== "mangadex") return false;
  return (source.chapters || []).some((chapter) => chapter.language && chapter.language !== "en");
}

function normalizedSource(source) {
  const fromChapter = (source?.chapters || []).map((chapter) => chapterSourceId(chapter.id)).find(Boolean);
  const id = (fromChapter && fromChapter !== "mangapill") ? fromChapter : source.id;
  return {
    ...source,
    id,
    label: COMIC_LABELS[id] || source.label || sourceLabel(id),
  };
}

export function buildReaderSources(manga, extraSources) {
  const sources = [];
  const identity = readerIdentity(manga);
  const primary = (manga?.chapters || []).filter(isImageChapter);
  if (primary.length && identity.id !== "mangapill" && identity.id !== "anilist") {
    sources.push({
      id: identity.id,
      label: identity.label,
      chapters: primary,
      notice: manga?.notice || "",
    });
  }
  (extraSources || []).forEach((source) => {
    if (!source?.id || source.id === "mangapill" || source.id === "anilist") return;
    const chapters = (source.chapters || []).filter(isImageChapter);
    if (!chapters.length) return;
    const normalized = normalizedSource({ ...source, chapters });
    if (!normalized.id || normalized.id === "mangapill" || sources.some((item) => item.id === normalized.id)) return;
    sources.push(normalized);
  });
  return sources
    .filter((source) => !nonEnglishDex(source))
    .sort((left, right) => {
      const leftRank = SOURCE_ORDER.indexOf(left.id);
      const rightRank = SOURCE_ORDER.indexOf(right.id);
      return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank);
    });
}

export function nextReaderSource(sources, failedIds) {
  const failed = failedIds instanceof Set ? failedIds : new Set(failedIds || []);
  return (sources || []).find((source) => (
    source?.id && !failed.has(source.id) && (source.chapters || []).some(isImageChapter)
  )) || null;
}

export function newestChapterIndex(chapters) {
  const rows = chapters || [];
  let bestIndex = 0;
  let bestNumber = -Infinity;
  let sawNumber = false;
  rows.forEach((chapter, index) => {
    const number = parseFloat(chapter?.number);
    if (!Number.isFinite(number)) return;
    sawNumber = true;
    if (number >= bestNumber) {
      bestNumber = number;
      bestIndex = index;
    }
  });
  return sawNumber ? bestIndex : 0;
}

export function visibleReaderNotice(manga, source) {
  const fromSource = String(source?.notice || "").trim();
  const fromCatalog = String(manga?.notice || "").trim();
  const imageSource = Boolean(source?.chapters?.some(isImageChapter));
  if (imageSource && fromSource) return fromSource;
  const placeholder = /not chapter pages|no page images|another source matches|page images come from mangadex when/i.test(fromCatalog);
  const loadFailure = /did not respond/i.test(fromCatalog);
  if (imageSource && (placeholder || loadFailure)) return fromSource;
  if (fromSource && fromCatalog && fromSource !== fromCatalog) return `${fromSource} ${fromCatalog}`;
  return fromSource || fromCatalog;
}
