import {
  clearCatalogCache,
  getAnimeDetail,
  getMangaDetail,
  getMangaPages,
  listAnime,
  listManga,
  loadEpisodeEmbed,
  loadEpisodeServers,
  loadMangaSources,
  mergeSankaChapterPages,
  parseSankaChapterPage,
  searchManga,
  sankaChapterPageInfo,
} from "./catalog";

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

beforeEach(() => {
  clearCatalogCache();
  sessionStorage.clear();
  global.fetch = jest.fn();
});

test("listManga uses MangaDex when it returns items and does not call Kiryuu", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("api.mangadex.org")) {
      return jsonResponse({
        result: "ok",
        total: 1,
        data: [
          {
            id: "one-piece-id",
            attributes: { title: { en: "One Piece" }, description: {} },
            relationships: [
              { type: "cover_art", attributes: { fileName: "cover.jpg" } },
            ],
          },
        ],
      });
    }
    if (href.includes("/comic/kiryuu/home")) {
      return jsonResponse({
        trending: [
          {
            slug: "martial-peak",
            title: "Martial Peak",
            imageSrc: "https://v7.kiryuu.to/cover.jpg",
            rating: "8.5",
          },
        ],
      });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const result = await listManga(1);
  expect(result.source).toBe("mangadex");
  expect(result.items[0].id).toBe("mangadex:one-piece-id");
  expect(result.items[0].title).toBe("One Piece");
  const urls = global.fetch.mock.calls.map((call) => String(call[0]));
  expect(urls.some((url) => url.includes("api.mangadex.org"))).toBe(true);
  expect(urls.some((url) => url.includes("/comic/kiryuu/home"))).toBe(false);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("searchManga keeps a MangaDex match when the other catalogs fail", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("api.mangadex.org")) {
      return jsonResponse({
        result: "ok",
        total: 1,
        data: [
          {
            id: "berserk-id",
            attributes: { title: { en: "Berserk" }, description: {} },
            relationships: [],
          },
        ],
      });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const result = await searchManga("Berserk", 1);
  expect(result.source).toBe("mangadex");
  expect(result.items.map((item) => item.title)).toEqual(["Berserk"]);
  expect(result.items.some((item) => item.source === "kiryuu")).toBe(false);
  const urls = global.fetch.mock.calls.map((call) => String(call[0]));
  expect(urls.some((url) => url.includes("title=Berserk"))).toBe(true);
  expect(urls.some((url) => url.includes("/comic/komikindo/search/"))).toBe(true);
});

test("Fairy Tail search returns a Sanka match and ignores unrelated Kiryuu hits", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("/comic/komikindo/search/")) {
      return jsonResponse({
        komikList: [
          { title: "Fairy Tail", slug: "231744-fairy-tail", image: "https://komikindo.ch/fairy.jpg", rating: "8" },
          { title: "Mashima HERO'S", slug: "mashima-heros", image: "https://komikindo.ch/hero.jpg" },
        ],
      });
    }
    if (href.includes("/comic/bacakomik/search/")) {
      return jsonResponse({
        komikList: [{ title: "Fairy Tail", slug: "fairy-tail", image: "https://bacakomik.example/fairy.jpg" }],
      });
    }
    if (href.includes("api.mangadex.org")) {
      return jsonResponse({
        result: "ok",
        total: 1,
        data: [{
          id: "ft",
          attributes: { title: { en: "FAIRY TAIL" }, description: {} },
          relationships: [],
        }],
      });
    }
    if (href.includes("graphql.anilist.co")) {
      return jsonResponse({
        data: {
          Page: {
            pageInfo: { hasNextPage: false },
            media: [{
              id: 670,
              title: { romaji: "Fairy Tail", english: "Fairy Tail" },
              coverImage: { large: "https://s4.anilist.co/ft.jpg" },
            }],
          },
        },
      });
    }
    if (href.includes("/comic/kiryuu/search/")) {
      return jsonResponse({
        seriesList: [
          { title: "Martial Peak", slug: "martial-peak", image: "https://kiryuu.example/mp.jpg", rating: "7.6" },
          { title: "Solo Leveling", slug: "solo-leveling" },
        ],
      });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const result = await searchManga("fairy tail", 1);
  expect(result.items[0]).toMatchObject({
    id: "sanka:komikindo:231744-fairy-tail",
    source: "sanka",
    title: "Fairy Tail",
  });
  expect(result.items.some((item) => item.source === "kiryuu")).toBe(false);
  expect(result.items.some((item) => /martial peak|solo leveling|mashima/i.test(item.title))).toBe(false);
  expect(result.items.filter((item) => item.title === "Fairy Tail")).toHaveLength(1);
});

test("listManga continues when MangaDex fails", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("/comic/kiryuu/home")) return jsonResponse({ trending: [] });
    if (href.includes("api.mangadex.org")) return jsonResponse({}, 500);
    if (href.includes("kitsu.io")) {
      return jsonResponse({
        data: [
          {
            id: "9",
            attributes: {
              canonicalTitle: "Bee",
              posterImage: { medium: "https://media.kitsu.app/bee.jpg" },
            },
          },
        ],
      });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const result = await listManga(1);
  expect(result.source).toBe("kitsu");
  expect(result.items[0].title).toBe("Bee");
});

test("listAnime uses AniList covers before the Sanka poster host", async () => {
  global.fetch.mockImplementation((url) => {
    if (String(url).includes("graphql.anilist.co")) {
      return jsonResponse({
        data: {
          Page: {
            pageInfo: { hasNextPage: true },
            media: [
              {
                id: 20,
                title: { romaji: "Naruto", english: "Naruto" },
                coverImage: { large: "https://s4.anilist.co/naruto.jpg" },
                averageScore: 80,
              },
            ],
          },
        },
      });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });

  const result = await listAnime("recent", 1);
  expect(result.source).toBe("anilist");
  expect(result.items[0].image).toContain("anilist.co");
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("getMangaPages reads Komikstation images and caches them", async () => {
  global.fetch.mockResolvedValue(
    jsonResponse({
      images: [
        "https://img.klikcdn.com/page-1.jpg",
        "https://img.klikcdn.com/page-2.jpg",
      ],
    })
  );

  const first = await getMangaPages("komikstation:martial-peak-chapter-3862");
  const second = await getMangaPages("komikstation:martial-peak-chapter-3862");
  expect(first).toEqual([
    "https://img.klikcdn.com/page-1.jpg",
    "https://img.klikcdn.com/page-2.jpg",
  ]);
  expect(second).toEqual(first);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("anime detail attaches Sanka episodes and prefers a filedon player", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("graphql.anilist.co")) {
      return jsonResponse({
        data: {
          Media: {
            id: 1,
            title: { romaji: "Naruto", english: "Naruto" },
            description: "A ninja",
            coverImage: { extraLarge: "https://s4.anilist.co/naruto.jpg" },
            averageScore: 80,
            episodes: 1,
            streamingEpisodes: [],
          },
        },
      });
    }
    if (href.includes("/anime/search/")) {
      return jsonResponse({
        data: {
          animeList: [{ animeId: "naruto-sub-indo", title: "Naruto", poster: "" }],
        },
      });
    }
    if (href.includes("/anime/anime/")) {
      return jsonResponse({
        data: {
          title: "Naruto",
          poster: "",
          synopsis: { paragraphs: ["A ninja"] },
          episodeList: [{ eps: "1", episodeId: "naruto-episode-1" }],
        },
      });
    }
    if (href.includes("/anime/episode/")) {
      return jsonResponse({
        data: {
          defaultStreamingUrl: "https://desustream.net/embed/blocked",
          server: {
            qualities: [
              {
                serverList: [
                  { title: "desustream", serverId: "desu" },
                  { title: "filedon", serverId: "file-1" },
                ],
              },
            ],
          },
        },
      });
    }
    if (href.includes("/anime/server/file-1")) {
      return jsonResponse({ data: { url: "https://filedon.co/embed/abc" } });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const detail = await getAnimeDetail("anilist:1");
  expect(detail.episodes[0].episodeId).toBe("naruto-episode-1");
  expect(detail.image).toContain("anilist.co");
  expect(detail.notice).toMatch(/Sanka/);

  const embed = await loadEpisodeEmbed("naruto-episode-1");
  expect(embed).toBe("https://filedon.co/embed/abc");
  const again = await loadEpisodeEmbed("naruto-episode-1");
  expect(again).toBe(embed);
  const episodeCalls = global.fetch.mock.calls.filter((call) =>
    String(call[0]).includes("/anime/episode/")
  );
  expect(episodeCalls).toHaveLength(1);
});

test("a bare manga uuid opens through MangaDex", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("/feed")) return jsonResponse({ result: "ok", data: [] });
    if (href.includes("/manga/04f6660b-0018-452d-844a-a205594dd66d")) {
      return jsonResponse({
        result: "ok",
        data: {
          id: "04f6660b-0018-452d-844a-a205594dd66d",
          attributes: { title: { en: "Old Link" }, description: {} },
          relationships: [],
        },
      });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const detail = await getMangaDetail("04f6660b-0018-452d-844a-a205594dd66d");
  expect(detail.source).toBe("mangadex");
  expect(detail.title).toBe("Old Link");
});

test("episode source buttons keep the highest quality for each server", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("/anime/episode/")) {
      return jsonResponse({
        data: {
          server: {
            qualities: [
              {
                title: "360p",
                serverList: [
                  { title: "filedon", serverId: "low" },
                  { title: "vidhide", serverId: "vh" },
                ],
              },
              {
                title: "720p",
                serverList: [
                  { title: "filedon", serverId: "high" },
                  { title: "mega", serverId: "mg" },
                ],
              },
            ],
          },
        },
      });
    }
    if (href.includes("/anime/server/high")) {
      return jsonResponse({ data: { url: "https://filedon.co/embed/high" } });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const servers = await loadEpisodeServers("ep-1");
  expect(servers.map((server) => server.label)).toEqual(["filedon 720p", "vidhide 360p", "mega 720p"]);
  expect(await loadEpisodeEmbed("ep-1")).toBe("https://filedon.co/embed/high");
});

test("embed skips hosts that refuse iframes", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("/anime/episode/")) {
      return jsonResponse({
        data: {
          server: {
            qualities: [
              {
                title: "720p",
                serverList: [
                  { title: "filedon", serverId: "bad" },
                  { title: "vidhide", serverId: "good" },
                ],
              },
            ],
          },
        },
      });
    }
    if (href.includes("/anime/server/bad")) {
      return jsonResponse({ data: { url: "https://desustream.com/maintenance/" } });
    }
    if (href.includes("/anime/server/good")) {
      return jsonResponse({ data: { url: "https://odvidhide.com/embed/ok" } });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  expect(await loadEpisodeEmbed("ep-blocked")).toBe("https://odvidhide.com/embed/ok");
});

test("anime detail matches Sanka on an alternate title and stops there", async () => {
  const searches = [];
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("graphql.anilist.co")) {
      return jsonResponse({
        data: {
          Media: {
            id: 16498,
            idMal: 16498,
            title: { romaji: "Shingeki no Kyojin", english: "Attack on Titan", native: "進撃の巨人" },
            description: "Walls",
            coverImage: { extraLarge: "https://s4.anilist.co/aot.jpg" },
            averageScore: 85,
            episodes: 1,
            streamingEpisodes: [],
          },
        },
      });
    }
    if (href.includes("/anime/search/")) {
      const query = decodeURIComponent(href.split("/anime/search/")[1]);
      searches.push(query);
      if (query === "Shingeki no Kyojin") {
        return jsonResponse({
          data: {
            animeList: [{ animeId: "shingeki-no-kyojin", title: "Shingeki no Kyojin", poster: "" }],
          },
        });
      }
      return jsonResponse({ data: { animeList: [] } });
    }
    if (href.includes("/anime/anime/")) {
      return jsonResponse({
        data: {
          title: "Shingeki no Kyojin",
          poster: "",
          synopsis: { paragraphs: ["Walls"] },
          episodeList: [{ eps: "1", episodeId: "snk-episode-1" }],
        },
      });
    }
    if (href.includes("shikimori.io")) return jsonResponse([]);
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const detail = await getAnimeDetail("anilist:16498");
  expect(detail.malId).toBe(16498);
  expect(detail.episodes[0].episodeId).toBe("snk-episode-1");
  expect(searches).toEqual(["Attack on Titan", "Shingeki no Kyojin"]);
});

test("an earlier catalog source still wins when a later one answers first", async () => {
  let release = () => {};
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("api.mangadex.org")) {
      return gate.then(() => jsonResponse({
        result: "ok",
        total: 1,
        data: [
          {
            id: "dex-1",
            attributes: { title: { en: "One Piece" }, description: {} },
            relationships: [],
          },
        ],
      }));
    }
    if (href.includes("graphql.anilist.co")) {
      return jsonResponse({
        data: {
          Page: {
            pageInfo: { hasNextPage: false },
            media: [
              {
                id: 30013,
                title: { romaji: "One Piece", english: "One Piece" },
                coverImage: { large: "https://s4.anilist.co/op.jpg" },
              },
            ],
          },
        },
      });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const pending = listManga(1);
  try {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 800));
    const started = global.fetch.mock.calls.map((call) => String(call[0]));
    expect(started.some((url) => url.includes("api.mangadex.org"))).toBe(true);
    expect(started.some((url) => url.includes("graphql.anilist.co"))).toBe(true);
    release();
    const result = await pending;
    const urls = global.fetch.mock.calls.map((call) => String(call[0]));
    expect(result.source).toBe("mangadex");
    expect(result.items[0].id).toBe("mangadex:dex-1");
    expect(urls.some((url) => url.includes("/comic/kiryuu/home"))).toBe(false);
  } finally {
    release();
  }
});

test("anilist official streaming sites stay as watch links", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("graphql.anilist.co")) {
      return jsonResponse({
        data: {
          Media: {
            id: 195516,
            idMal: 61987,
            title: { romaji: "Kusuriya no Hitorigoto 3rd Season", english: "The Apothecary Diaries Season 3" },
            description: "Maomao",
            coverImage: { extraLarge: "https://s4.anilist.co/apo.jpg" },
            averageScore: 85,
            episodes: 12,
            trailer: { id: "YvNvvUeCztE", site: "youtube" },
            streamingEpisodes: [],
            externalLinks: [
              { site: "Crunchyroll", url: "https://www.crunchyroll.com/series/G3KHEVDJ7/the-apothecary-diaries", type: "STREAMING" },
              { site: "Netflix", url: "http://www.netflix.com/us/title/81712068", type: "STREAMING" },
              { site: "Twitter", url: "https://twitter.com/kusuriya_PR", type: "SOCIAL" },
            ],
          },
        },
      });
    }
    if (href.includes("/anime/search/")) return jsonResponse({ data: { animeList: [] } });
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const detail = await getAnimeDetail("anilist:195516");
  expect(detail.malId).toBe(61987);
  expect(detail.episodes).toHaveLength(12);
  expect(detail.watchLinks.map((link) => link.label)).toEqual(["Crunchyroll", "Netflix"]);
  expect(detail.watchLinks[1].url).toMatch(/^https:\/\//);
  expect(detail.preview.embed).toContain("YvNvvUeCztE");
  expect(detail.notice).toMatch(/No Sanka stream/);
});

test("a failed refresh keeps the last anime list and retry bypasses it", async () => {
  let fail = false;
  global.fetch.mockImplementation((url) => {
    if (fail) return Promise.reject(new Error("down"));
    if (String(url).includes("graphql.anilist.co")) {
      return jsonResponse({
        data: {
          Page: {
            pageInfo: { hasNextPage: false },
            media: [
              {
                id: 20,
                title: { romaji: "Naruto", english: "Naruto" },
                coverImage: { large: "https://s4.anilist.co/naruto.jpg" },
                averageScore: 80,
              },
            ],
          },
        },
      });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });

  const first = await listAnime("recent", 1);
  expect(first.stale).toBe(false);
  expect(first.items[0].title).toBe("Naruto");

  fail = true;
  const now = Date.now;
  Date.now = () => now() + 11 * 60 * 1000;
  try {
    const second = await listAnime("recent", 1);
    expect(second.stale).toBe(true);
    expect(second.items[0].title).toBe("Naruto");
    const callsBeforeRetry = global.fetch.mock.calls.length;
    fail = false;
    const third = await listAnime("recent", 1, true);
    expect(third.stale).toBe(false);
    expect(third.items[0].title).toBe("Naruto");
    expect(global.fetch.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
  } finally {
    Date.now = now;
  }
});

test("MangaDex chapter feed pages through every chapter and keeps the hosted language", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("/manga/kagura/feed")) {
      const offset = Number(new URL(href).searchParams.get("offset") || "0");
      if (offset === 0) {
        const data = Array.from({ length: 100 }, (_, index) => {
          const number = index + 1;
          if (number === 40) {
            return {
              id: "en-40",
              attributes: {
                chapter: "40",
                title: "English",
                pages: 8,
                translatedLanguage: "en",
                externalUrl: null,
              },
            };
          }
          return {
            id: `es-${number}`,
            attributes: {
              chapter: String(number),
              title: number === 1 ? "Mision" : "",
              pages: 10,
              translatedLanguage: "es-la",
              externalUrl: null,
            },
          };
        });
        return jsonResponse({ result: "ok", total: 105, data });
      }
      if (offset === 100) {
        return jsonResponse({
          result: "ok",
          total: 105,
          data: [
            {
              id: "es-135",
              attributes: {
                chapter: "135",
                title: "Comienza la guerra",
                pages: 14,
                translatedLanguage: "es-la",
                externalUrl: null,
              },
            },
            {
              id: "en-133",
              attributes: {
                chapter: "133",
                title: "External",
                pages: 0,
                translatedLanguage: "en",
                externalUrl: "https://mangaplus.shueisha.co.jp/viewer/1",
              },
            },
          ],
        });
      }
      return jsonResponse({ result: "ok", total: 105, data: [] });
    }
    if (href.includes("/manga/kagura")) {
      return jsonResponse({
        result: "ok",
        data: {
          id: "kagura",
          attributes: { title: { en: "Kagurabachi" }, description: {} },
          relationships: [],
        },
      });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const detail = await getMangaDetail("mangadex:kagura");
  expect(detail.chapters.some((chapter) => chapter.id === "es-135" && chapter.pages === 14)).toBe(true);
  expect(detail.chapters.some((chapter) => String(chapter.number) === "1")).toBe(true);
  expect(detail.chapters.some((chapter) => chapter.id === "en-40" || chapter.id === "en-133")).toBe(false);
  expect(detail.chapters.every((chapter) => chapter.language === "es-la" && chapter.pages > 0)).toBe(true);
  expect(detail.notice).toMatch(/Chapter 136 is not on MangaDex/);
  expect(detail.notice).toMatch(/Showing chapter 135/);
  const feedUrls = global.fetch.mock.calls.map((call) => String(call[0])).filter((href) => href.includes("/feed"));
  expect(feedUrls.some((href) => href.includes("offset=100"))).toBe(true);
  expect(feedUrls.every((href) => href.includes("includeExternalUrl=0"))).toBe(true);

  const feedCalls = feedUrls.length;
  const again = await getMangaDetail("mangadex:kagura");
  expect(again.chapters).toHaveLength(detail.chapters.length);
  expect(global.fetch.mock.calls.filter((call) => String(call[0]).includes("/feed"))).toHaveLength(feedCalls);
});

test("MangaDex prefers a hosted language over a longer list that stops earlier", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("/feed")) {
      return jsonResponse({
        result: "ok",
        total: 2,
        data: [
          {
            id: "en-12",
            attributes: { chapter: "12", title: "", pages: 4, translatedLanguage: "en", externalUrl: null },
          },
          {
            id: "es-9",
            attributes: { chapter: "9", title: "", pages: 30, translatedLanguage: "es-la", externalUrl: null },
          },
        ],
      });
    }
    if (href.includes("/manga/blue")) {
      return jsonResponse({
        result: "ok",
        data: {
          id: "blue",
          attributes: { title: { en: "Blue Box" }, description: {} },
          relationships: [],
        },
      });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const detail = await getMangaDetail("mangadex:blue");
  expect(detail.chapters).toHaveLength(1);
  expect(detail.chapters[0].id).toBe("en-12");
  expect(detail.notice).toBe("");
});

test("loadMangaSources uses Komikstation when MangaDex has no hosted pages", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("/feed")) {
      return jsonResponse({
        result: "ok",
        total: 1,
        data: [
          {
            id: "external-only",
            attributes: {
              chapter: "1",
              pages: 0,
              translatedLanguage: "en",
              externalUrl: "https://mangaplus.shueisha.co.jp/viewer/1",
            },
          },
        ],
      });
    }
    if (href.includes("api.mangadex.org")) {
      return jsonResponse({
        result: "ok",
        total: 1,
        data: [
          {
            id: "mp-1",
            attributes: { title: { en: "Martial Peak" }, description: {} },
            relationships: [],
          },
        ],
      });
    }
    if (href.includes("/comic/kiryuu/search/")) {
      return jsonResponse({ seriesList: [{ title: "Martial Peak", slug: "martial-peak" }] });
    }
    if (href.includes("/comic/kiryuu/manga/")) {
      return jsonResponse({ title: "Martial Peak", synopsis: "A climber.", imageSrc: "" });
    }
    if (href.includes("/comic/komikstation/manga/")) {
      return jsonResponse({
        title: "Martial Peak",
        synopsis: "A climber.",
        imageSrc: "https://example.com/martial.jpg",
        chapters: [{ slug: "martial-peak-chapter-1", title: "Chapter 1" }],
      });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const sources = await loadMangaSources("Martial Peak");
  expect(sources).toHaveLength(1);
  expect(sources[0].id).toBe("komikstation");
  expect(sources[0].chapters[0].id).toBe("komikstation:martial-peak-chapter-1");
  expect(sources[0].chapters[0].pages).toBeGreaterThan(0);
});

test("Sanka comic chapter pages keep chapter 1 and the latest chapter", () => {
  const chapters = mergeSankaChapterPages("komikindo", [
    {
      data: {
        chapters: [
          { title: "Chapter 135", slug: "kagurabachi-chapter-135" },
          { title: "Chapter 100", slug: "kagurabachi-chapter-100" },
        ],
      },
      pagination: { currentPage: 1, hasNextPage: true },
    },
    {
      data: {
        chapters: [
          { title: "Chapter 135", slug: "kagurabachi-chapter-135" },
          { title: "Chapter 1", slug: "kagurabachi-chapter-1" },
          { title: "Chapter 112.5", slug: "kagurabachi-chapter-112-5" },
        ],
      },
      pagination: { currentPage: 2, hasNextPage: false },
    },
  ]);
  expect(chapters.map((chapter) => chapter.number)).toEqual(["135", "100", "1", "112.5"]);
  expect(chapters[0].id).toBe("sanka:komikindo:kagurabachi-chapter-135");
  expect(sankaChapterPageInfo({ pagination: { current_page: 1, total_pages: 6 } }).hasNext).toBe(true);
  expect(sankaChapterPageInfo({ pagination: { currentPage: 2, hasNextPage: false } }).hasNext).toBe(false);

  const fromSlug = parseSankaChapterPage("bacakomik", {
    detail: { chapters: [{ title: "", slug: "kagurabachi-chapter-1" }] },
  });
  expect(fromSlug[0]).toMatchObject({
    id: "sanka:bacakomik:kagurabachi-chapter-1",
    number: "1",
    pages: 1,
  });
  const shinigami = parseSankaChapterPage("shinigami", {
    data: [{ chapter_id: "abc", chapter_number: 135, chapter_title: null }],
  });
  expect(shinigami[0].id).toBe("sanka:shinigami:abc");
  expect(shinigami[0].number).toBe("135");
});

test("loadMangaSources prefers Sanka when it reaches the latest hosted chapter", async () => {
  global.fetch.mockImplementation((url) => {
    const href = String(url);
    if (href.includes("/comic/komikindo/search/")) {
      return jsonResponse({ komikList: [{ title: "Kagurabachi", slug: "kagurabachi" }] });
    }
    if (href.includes("/comic/komikindo/detail/")) {
      const page = Number(new URL(href).searchParams.get("page") || "1");
      if (page === 1) {
        return jsonResponse({
          success: true,
          data: {
            chapters: [
              { title: "Chapter 135", slug: "kagurabachi-chapter-135" },
              { title: "Chapter 100", slug: "kagurabachi-chapter-100" },
            ],
          },
          pagination: { currentPage: 1, hasNextPage: true },
        });
      }
      return jsonResponse({
        success: true,
        data: {
          chapters: [{ title: "Chapter 1", slug: "kagurabachi-chapter-1" }],
        },
        pagination: { currentPage: 2, hasNextPage: false },
      });
    }
    if (href.includes("/feed")) {
      return jsonResponse({
        result: "ok",
        total: 1,
        data: [
          {
            id: "en-10",
            attributes: { chapter: "10", pages: 4, translatedLanguage: "en", externalUrl: null },
          },
        ],
      });
    }
    if (href.includes("api.mangadex.org")) {
      return jsonResponse({
        result: "ok",
        total: 1,
        data: [
          {
            id: "kagura",
            attributes: { title: { en: "Kagurabachi" }, description: {} },
            relationships: [],
          },
        ],
      });
    }
    return Promise.reject(new Error(`unexpected ${href}`));
  });

  const sources = await loadMangaSources("Kagurabachi");
  expect(sources[0].id).toBe("sanka");
  expect(sources[0].label).toBe("Sanka");
  expect(sources[0].chapters.map((chapter) => chapter.number)).toEqual(["135", "100", "1"]);
  expect(sources[0].notice).toMatch(/Chapter 136 is not on Sanka/);
  expect(sources[0].notice).toMatch(/Showing chapter 135/);
  expect(sources[1].id).toBe("mangadex");
  expect(global.fetch.mock.calls.map((call) => String(call[0])).some((href) => href.includes("page=2"))).toBe(true);
});
