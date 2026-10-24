import { sourceLabel } from "../API/catalog";

export function isImageChapter(chapter) {
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

export function buildReaderSources(manga, extraSources) {
  const sources = [];
  const identity = readerIdentity(manga);
  const primary = (manga?.chapters || []).filter(isImageChapter);
  if (primary.length && identity.id !== "mangapill") {
    sources.push({
      id: identity.id,
      label: identity.label,
      chapters: primary,
      notice: manga?.notice || "",
    });
  }
  (extraSources || []).forEach((source) => {
    if (!source?.id || source.id === "mangapill") return;
    const chapters = (source.chapters || []).filter(isImageChapter);
    if (!chapters.length || sources.some((item) => item.id === source.id)) return;
    sources.push({
      id: source.id,
      label: source.label || sourceLabel(source.id),
      chapters,
      notice: source.notice || "",
    });
  });
  return sources;
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
  const placeholder = /not chapter pages|no page images|another source matches|page images come from mangadex when/i.test(fromCatalog);
  if (imageSource && placeholder) return fromSource;
  if (fromSource && fromCatalog && fromSource !== fromCatalog) return `${fromSource} ${fromCatalog}`;
  return fromSource || fromCatalog;
}
