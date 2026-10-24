import { buildReaderSources, newestChapterIndex, visibleReaderNotice } from "./readerSources";

test("empty AniList chapters are replaced by a MangaDex source with page files", () => {
  const manga = {
    source: "anilist",
    title: "Kagurabachi",
    notice: "AniList has the catalog entry, not chapter pages.",
    chapters: [{ id: "", number: 1, title: "Chapter 1", pages: 0 }],
  };
  const dex = {
    id: "mangadex",
    label: "MangaDex",
    notice: "Chapter 136 is not on MangaDex. Showing chapter 135.",
    chapters: [
      { id: "es-1", number: "1", title: "Chapter 1", pages: 10 },
      { id: "es-135", number: "135", title: "Chapter 135", pages: 14 },
    ],
  };
  const sources = buildReaderSources(manga, [dex]);
  expect(sources).toHaveLength(1);
  expect(sources[0].id).toBe("mangadex");
  expect(newestChapterIndex(sources[0].chapters)).toBe(1);
  expect(visibleReaderNotice(manga, sources[0])).toMatch(/136 is not on MangaDex/);
  expect(visibleReaderNotice(manga, sources[0])).not.toMatch(/AniList/);
});

test("a Kiryuu title that already has Komikstation pages stays on that source", () => {
  const manga = {
    source: "kiryuu",
    notice: "Chapter pages come from Komikstation.",
    chapters: [
      { id: "komikstation:martial-peak-chapter-26", number: "Chapter 26", title: "Chapter 26", pages: 1 },
      { id: "komikstation:martial-peak-chapter-1", number: "Chapter 1", title: "Chapter 1", pages: 1 },
    ],
  };
  const dex = {
    id: "mangadex",
    label: "MangaDex",
    chapters: [{ id: "uuid", number: "10", title: "Chapter 10", pages: 8 }],
  };
  const sources = buildReaderSources(manga, [dex]);
  expect(sources[0].id).toBe("komikstation");
  expect(sources[1].id).toBe("mangadex");
  expect(newestChapterIndex(sources[0].chapters)).toBe(0);
  expect(buildReaderSources(manga, [])).toHaveLength(1);
});

test("MangaPill chapters are never selected, even as a placeholder list", () => {
  const manga = {
    source: "mangapill",
    chapters: [{ id: "mangapill:1", number: 1, title: "Chapter 1", pages: 1 }],
  };
  expect(buildReaderSources(manga, [])).toEqual([]);
});
