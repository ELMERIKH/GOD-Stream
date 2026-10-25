import { sourceLabel } from "../API/catalog";

const SOURCE_ORDER = ["weebcentral", "mangadex"];
const INDONESIAN_SOURCE_IDS = new Set(["bacakomik", "komikindo", "komikstation", "mangakita", "sanka"]);

export function isImageChapter(chapter) {
  if (!chapter?.id || !chapter.pages) return false;
  return !String(chapter.id).startsWith("mangapill:");
}

export function isIndonesianChapterId(chapterId) {
  const id = String(chapterId || "");
  return id.startsWith("sanka:")
    || id.startsWith("komikstation:")
    || id.startsWith("bacakomik:")
    || id.startsWith("komikindo:")
    || id.startsWith("mangakita:");
}

export function isEnglishImageChapter(chapter) {
  return isImageChapter(chapter) && !isIndonesianChapterId(chapter?.id);
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
  if (fromChapter && INDONESIAN_SOURCE_IDS.has(fromChapter)) return { id: fromChapter, label: sourceLabel(fromChapter) };
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
    label: source.label || sourceLabel(id),
  };
}

export function buildReaderSources(manga, extraSources) {
  const sources = [];
  const identity = readerIdentity(manga);
  const primary = (manga?.chapters || []).filter(isEnglishImageChapter);
  if (primary.length && identity.id !== "mangapill" && identity.id !== "anilist" && !INDONESIAN_SOURCE_IDS.has(identity.id)) {
    sources.push({
      id: identity.id,
      label: identity.label,
      chapters: primary,
      notice: manga?.notice || "",
    });
  }
  (extraSources || []).forEach((source) => {
    if (!source?.id || source.id === "mangapill" || source.id === "anilist" || INDONESIAN_SOURCE_IDS.has(source.id)) return;
    const chapters = (source.chapters || []).filter(isEnglishImageChapter);
    if (!chapters.length) return;
    const normalized = normalizedSource({ ...source, chapters });
    if (!normalized.id || normalized.id === "mangapill" || INDONESIAN_SOURCE_IDS.has(normalized.id) || sources.some((item) => item.id === normalized.id)) return;
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
    source?.id
    && !INDONESIAN_SOURCE_IDS.has(source.id)
    && !failed.has(source.id)
    && (source.chapters || []).some(isEnglishImageChapter)
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
