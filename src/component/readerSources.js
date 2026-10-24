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
  if (chapters.some((chapter) => String(chapter.id || "").startsWith("weebchapter:"))) {
    return { id: "weebcentral", label: "Weeb Central" };
  }
  if (chapters.some((chapter) => String(chapter.id || "").startsWith("sanka:"))) {
    return { id: "sanka", label: "Sanka" };
  }
  if (chapters.some((chapter) => chapter.id && chapter.pages && !String(chapter.id).includes(":"))) {
    return { id: "mangadex", label: "MangaDex" };
  }
  return { id: detail?.source || "catalog", label: sourceLabel(detail?.source) };
}

function indonesianScan(source) {
  if (source?.id === "sanka") return true;
  return (source?.chapters || []).some((chapter) => /^sanka:(komikindo|bacakomik|komiku|komikcast|softkomik|komikuindo):/i.test(String(chapter.id || "")));
}

function nonEnglishDex(source) {
  if (source?.id !== "mangadex") return false;
  return (source.chapters || []).some((chapter) => chapter.language && chapter.language !== "en");
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
  const english = sources.find((source) => source.id === "weebcentral");
  if (sources[0]?.id === "komikstation") {
    return sources.filter((source) => !indonesianScan(source));
  }
  if (english) {
    const rest = sources.filter((source) => source !== english && !indonesianScan(source) && !nonEnglishDex(source));
    return [english, ...rest];
  }
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
  const loadFailure = /did not respond/i.test(fromCatalog);
  if (imageSource && (placeholder || (fromSource && loadFailure))) return fromSource;
  if (fromSource && fromCatalog && fromSource !== fromCatalog) return `${fromSource} ${fromCatalog}`;
  return fromSource || fromCatalog;
}
