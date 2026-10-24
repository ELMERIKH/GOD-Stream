import { buildReaderSources, newestChapterIndex, nextReaderSource, visibleReaderNotice } from "./readerSources";

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

test("a missing-chapter note stays on its own when the catalog fell back", () => {
  const manga = {
    source: "mangadex",
    title: "Kagurabachi",
    notice: "Loaded from MangaDex because AniList did not respond.",
    chapters: [],
  };
  const source = {
    id: "sanka",
    notice: "Chapter 136 is not on Sanka. Showing chapter 135.",
    chapters: [{ id: "sanka:komikindo:kagurabachi-chapter-135", number: "135", title: "Chapter 135", pages: 1 }],
  };
  const note = visibleReaderNotice(manga, source);
  expect(note).toBe("Chapter 136 is not on Sanka. Showing chapter 135.");
  expect(note).not.toMatch(/did not respond/);
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
  expect(sources.map((source) => source.id)).toEqual(["mangadex", "komikstation"]);
  expect(sources[1].label).toBe("Komikstation · Indonesian");
  expect(newestChapterIndex(sources[1].chapters)).toBe(0);
  const withSanka = buildReaderSources(manga, [
    dex,
    {
      id: "sanka",
      label: "Sanka",
      chapters: [{ id: "sanka:komikindo:martial-peak-chapter-1", number: "1", title: "Chapter 1", pages: 1 }],
    },
    {
      id: "weebcentral",
      label: "Weeb Central",
      notice: "English chapter pages come from Weeb Central.",
      chapters: [{ id: "weebchapter:01J76XY7E5E1C5Y9J0M2FCVQ8H", number: "10", title: "Chapter 10", pages: 1 }],
    },
  ]);
  expect(withSanka.map((source) => source.id)).toEqual(["weebcentral", "mangadex", "komikindo", "komikstation"]);
  expect(withSanka[2].label).toBe("Komikindo · Indonesian");
  expect(visibleReaderNotice(manga, withSanka[0])).toBe("English chapter pages come from Weeb Central.");
  expect(buildReaderSources(manga, [])).toHaveLength(1);
});

test("an Indonesian Komikindo list is not the reader when English pages exist", () => {
  const manga = {
    source: "sanka",
    title: "Kagurabachi",
    notice: "Chapter 136 is not on Sanka. Showing chapter 135.",
    chapters: [{ id: "sanka:komikindo:kagurabachi-chapter-135", number: "135", title: "Chapter 135", pages: 1 }],
  };
  const english = {
    id: "weebcentral",
    label: "Weeb Central",
    notice: "Chapter 136 is not on Weeb Central. Showing chapter 135.",
    chapters: [{ id: "weebchapter:01M57RRV54GD4MNM4D2V8WPWR4", number: "135", title: "Chapter 135", pages: 1 }],
  };
  const sources = buildReaderSources(manga, [english]);
  expect(sources.map((source) => source.id)).toEqual(["weebcentral", "komikindo"]);
  expect(sources[0].id).toBe("weebcentral");
  expect(sources[1].label).toBe("Komikindo · Indonesian");
  expect(sources[0].notice).toMatch(/Weeb Central/);
});

test("a failed first manga source falls through to a second source with pages", () => {
  const sources = [
    {
      id: "weebcentral",
      chapters: [{ id: "weebchapter:01J76XYCRVY3QGYAMRR3STW941", number: "232", pages: 30 }],
    },
    {
      id: "mangadex",
      chapters: [{ id: "en-232", number: "232", pages: 20 }],
    },
    {
      id: "bacakomik",
      chapters: [{ id: "sanka:bacakomik:chainsaw-man-chapter-232", number: "232", pages: 1 }],
    },
  ];
  expect(nextReaderSource(sources, ["weebcentral"])?.id).toBe("mangadex");
  const noPages = [
    { id: "komikindo", chapters: [{ id: "", number: "232", pages: 0 }] },
    { id: "bacakomik", chapters: [{ id: "sanka:bacakomik:kagurabachi-chapter-135", number: "135", pages: 1 }] },
  ];
  expect(nextReaderSource(noPages)?.id).toBe("bacakomik");
  expect(nextReaderSource(sources, ["weebcentral", "mangadex", "bacakomik"])).toBeNull();
});

test("MangaPill chapters are never selected, even as a placeholder list", () => {
  const manga = {
    source: "mangapill",
    chapters: [{ id: "mangapill:1", number: 1, title: "Chapter 1", pages: 1 }],
  };
  expect(buildReaderSources(manga, [])).toEqual([]);
});
